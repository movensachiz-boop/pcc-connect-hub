-- ============ PROFILE COLUMNS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_occupation text,
  ADD COLUMN IF NOT EXISTS guardian_address text,
  ADD COLUMN IF NOT EXISTS guardian2_name text,
  ADD COLUMN IF NOT EXISTS guardian2_relationship text,
  ADD COLUMN IF NOT EXISTS guardian2_phone text,
  ADD COLUMN IF NOT EXISTS guardian2_email text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS doctor_contact text,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS year_joined text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS residency text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- ============ PREPAID ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.prepaid_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  item_name text NOT NULL,
  unit text,
  default_unit_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepaid_accounts TO authenticated;
GRANT ALL ON public.prepaid_accounts TO service_role;

ALTER TABLE public.prepaid_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage prepaid accounts"
  ON public.prepaid_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_prepaid_accounts_updated_at
  BEFORE UPDATE ON public.prepaid_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PREPAID ENTRIES ============
CREATE TABLE IF NOT EXISTS public.prepaid_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.prepaid_accounts(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('deposit','delivery')),
  amount numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  note text,
  occurred_on date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prepaid_entries_account ON public.prepaid_entries(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepaid_entries TO authenticated;
GRANT ALL ON public.prepaid_entries TO service_role;

ALTER TABLE public.prepaid_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage prepaid entries"
  ON public.prepaid_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));