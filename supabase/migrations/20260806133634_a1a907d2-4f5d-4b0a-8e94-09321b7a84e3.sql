CREATE TABLE public.cash_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cashier_user_id uuid,
  cashier_name text NOT NULL DEFAULT 'Cashier',
  business_date date NOT NULL DEFAULT CURRENT_DATE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_float numeric NOT NULL DEFAULT 0,
  closing_counted numeric,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cash sessions" ON public.cash_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Staff can create cash sessions" ON public.cash_sessions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Staff can update cash sessions" ON public.cash_sessions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Admins can delete cash sessions" ON public.cash_sessions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE TRIGGER trg_cash_sessions_updated BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  cashier_user_id uuid,
  cashier_name text NOT NULL DEFAULT 'Cashier',
  business_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  recipient text,
  reference text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cash movements" ON public.cash_movements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Staff can create cash movements" ON public.cash_movements FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Staff can update cash movements" ON public.cash_movements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'cashier') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE POLICY "Admins can delete cash movements" ON public.cash_movements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'developer'));

CREATE TRIGGER trg_cash_movements_updated BEFORE UPDATE ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cash_movements_date ON public.cash_movements(business_date);
CREATE INDEX idx_cash_sessions_date ON public.cash_sessions(business_date);