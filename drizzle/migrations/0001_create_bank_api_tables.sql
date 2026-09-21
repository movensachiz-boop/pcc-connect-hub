CREATE TABLE public.bank_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_api_keys TO authenticated;
GRANT ALL ON public.bank_api_keys TO service_role;
ALTER TABLE public.bank_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and developers manage bank api keys"
ON public.bank_api_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE TRIGGER bank_api_keys_updated_at BEFORE UPDATE ON public.bank_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.bank_api_keys(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  bank_reference text,
  registration_number text,
  amount numeric,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bank_api_logs TO authenticated;
GRANT ALL ON public.bank_api_logs TO service_role;
ALTER TABLE public.bank_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and developers read bank api logs"
ON public.bank_api_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE INDEX idx_bank_api_logs_created ON public.bank_api_logs (created_at DESC);
CREATE INDEX idx_payments_paynow_reference ON public.payments (paynow_reference);