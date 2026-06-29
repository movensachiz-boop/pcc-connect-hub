
-- Sequence for agreement numbers
CREATE SEQUENCE IF NOT EXISTS public.sla_agreement_seq START 1;

-- Agreements
CREATE TABLE public.sla_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_number TEXT UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'sla',
  status TEXT NOT NULL DEFAULT 'draft',
  client_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT,
  school_name TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  start_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 60.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  provider JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version INTEGER NOT NULL DEFAULT 1,
  signed_at TIMESTAMPTZ,
  signed_by_client TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_agreements TO authenticated;
GRANT ALL ON public.sla_agreements TO service_role;
GRANT USAGE ON SEQUENCE public.sla_agreement_seq TO authenticated, service_role;

ALTER TABLE public.sla_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage SLA agreements"
ON public.sla_agreements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Versions (immutable snapshots)
CREATE TABLE public.sla_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.sla_agreements(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_versions TO authenticated;
GRANT ALL ON public.sla_versions TO service_role;
ALTER TABLE public.sla_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage SLA versions"
ON public.sla_versions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Templates
CREATE TABLE public.sla_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'sla',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_templates TO authenticated;
GRANT ALL ON public.sla_templates TO service_role;
ALTER TABLE public.sla_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage SLA templates"
ON public.sla_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Audit log
CREATE TABLE public.sla_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID REFERENCES public.sla_agreements(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sla_audit_log TO authenticated;
GRANT ALL ON public.sla_audit_log TO service_role;
ALTER TABLE public.sla_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers read SLA audit"
ON public.sla_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers write SLA audit"
ON public.sla_audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Auto agreement number
CREATE OR REPLACE FUNCTION public.generate_sla_agreement_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.agreement_number IS NULL THEN
    NEW.agreement_number := 'SLA-' || LPAD(nextval('sla_agreement_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sla_agreement_number
BEFORE INSERT ON public.sla_agreements
FOR EACH ROW EXECUTE FUNCTION public.generate_sla_agreement_number();

CREATE TRIGGER trg_sla_agreements_updated
BEFORE UPDATE ON public.sla_agreements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_sla_templates_updated
BEFORE UPDATE ON public.sla_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
