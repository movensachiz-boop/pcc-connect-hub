CREATE SEQUENCE IF NOT EXISTS public.vacation_receipt_seq START 1;

CREATE TABLE public.vacation_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  stream text NOT NULL,
  gender text NOT NULL DEFAULT 'other',
  guardian_name text,
  guardian_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_students TO authenticated;
GRANT ALL ON public.vacation_students TO service_role;
ALTER TABLE public.vacation_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage vacation students"
ON public.vacation_students FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'developer')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'developer')
);

CREATE TABLE public.vacation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacation_student_id uuid NOT NULL REFERENCES public.vacation_students(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'Cash',
  status text NOT NULL DEFAULT 'paid',
  receipt_number text,
  description text,
  term_id uuid REFERENCES public.academic_terms(id),
  cashier_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_payments TO authenticated;
GRANT ALL ON public.vacation_payments TO service_role;
ALTER TABLE public.vacation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage vacation payments"
ON public.vacation_payments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'developer')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
  OR public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'developer')
);

CREATE OR REPLACE FUNCTION public.generate_vacation_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'VAC-' || LPAD(nextval('vacation_receipt_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vacation_receipt_number
BEFORE INSERT ON public.vacation_payments
FOR EACH ROW EXECUTE FUNCTION public.generate_vacation_receipt_number();

CREATE TRIGGER trg_vacation_payments_updated
BEFORE UPDATE ON public.vacation_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_vacation_students_updated
BEFORE UPDATE ON public.vacation_students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_vacation_payments_set_term
BEFORE INSERT ON public.vacation_payments
FOR EACH ROW EXECUTE FUNCTION public.set_payment_term();