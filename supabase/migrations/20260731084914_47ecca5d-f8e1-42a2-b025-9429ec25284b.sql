
CREATE TABLE public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  term_number integer NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT ALL ON public.academic_terms TO service_role;

ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view terms" ON public.academic_terms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert terms" ON public.academic_terms
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "Admins can update terms" ON public.academic_terms
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'developer')
  );

CREATE POLICY "Admins can delete terms" ON public.academic_terms
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'developer')
  );

CREATE TRIGGER update_academic_terms_updated_at
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX one_current_term ON public.academic_terms (is_current) WHERE is_current;

-- Seed the first term with existing data
INSERT INTO public.academic_terms (name, year, term_number, start_date, is_current)
VALUES ('Term 1 2026', 2026, 1, '2026-01-01', true);

-- Link payments to terms
ALTER TABLE public.payments ADD COLUMN term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL;
CREATE INDEX idx_payments_term_id ON public.payments (term_id);

UPDATE public.payments SET term_id = (SELECT id FROM public.academic_terms WHERE is_current LIMIT 1) WHERE term_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_current_term_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.academic_terms WHERE is_current LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.set_payment_term()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.term_id IS NULL THEN
    NEW.term_id := public.get_current_term_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_set_term
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_term();

-- Start a new term (admins only)
CREATE OR REPLACE FUNCTION public.start_new_term(_name text, _year integer, _term_number integer, _start_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'developer')) THEN
    RAISE EXCEPTION 'Not authorised to start a new term';
  END IF;

  UPDATE public.academic_terms SET is_current = false, end_date = COALESCE(end_date, _start_date) WHERE is_current;

  INSERT INTO public.academic_terms (name, year, term_number, start_date, is_current)
  VALUES (_name, _year, _term_number, _start_date, true)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Fee summary now scoped to the current term
CREATE OR REPLACE FUNCTION public.get_student_fee_summary()
 RETURNS TABLE(profile_id uuid, total_fees numeric, total_paid numeric, balance numeric, payment_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS profile_id,
    COALESCE(fee_calc.total_fees, 0) AS total_fees,
    COALESCE(pay_calc.total_paid, 0) AS total_paid,
    COALESCE(pay_calc.total_paid, 0) - COALESCE(fee_calc.total_fees, 0) AS balance,
    CASE
      WHEN COALESCE(fee_calc.total_fees, 0) = 0 THEN 'No Fees'
      WHEN COALESCE(pay_calc.total_paid, 0) >= COALESCE(fee_calc.total_fees, 0) THEN
        CASE WHEN COALESCE(pay_calc.total_paid, 0) > COALESCE(fee_calc.total_fees, 0) THEN 'Overpaid' ELSE 'Paid in Full' END
      ELSE 'Outstanding'
    END AS payment_status
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT SUM(fr.amount) AS total_fees
    FROM fee_requirements fr
    WHERE fr.is_active = true
      AND p.form = ANY(fr.form_levels)
      AND (
        (p.is_beginner = true AND fr.returning_only = false)
        OR (p.is_beginner = false AND fr.beginner_only = false)
      )
      AND ((p.is_beginner = true) OR (fr.category = 'fees'))
      AND (fr.learning_area IS NULL OR fr.learning_area = p.stream)
      AND (
        fr.gender = 'all'
        OR fr.gender = CASE WHEN p.gender = 'male' THEN 'boys' WHEN p.gender = 'female' THEN 'girls' ELSE 'all' END
      )
  ) fee_calc ON true
  LEFT JOIN LATERAL (
    SELECT SUM(pay.amount) AS total_paid
    FROM payments pay
    WHERE pay.student_profile_id = p.id
      AND pay.status IN ('paid', 'completed')
      AND pay.term_id IS NOT DISTINCT FROM public.get_current_term_id()
  ) pay_calc ON true
  WHERE p.form IS NOT NULL;
$function$;
