CREATE SEQUENCE IF NOT EXISTS public.dataplex_doc_seq START 1;

CREATE TABLE public.dataplex_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('quotation','invoice','receipt')),
  doc_number TEXT NOT NULL DEFAULT ('DPX-' || lpad(nextval('public.dataplex_doc_seq')::text, 4, '0')),
  agreement_id UUID REFERENCES public.sla_agreements(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT 'New Client',
  contact_person TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  provider JSONB NOT NULL DEFAULT '{}'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataplex_documents TO authenticated;
GRANT ALL ON public.dataplex_documents TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.dataplex_doc_seq TO authenticated, service_role;

ALTER TABLE public.dataplex_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage dataplex documents"
ON public.dataplex_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE TRIGGER update_dataplex_documents_updated_at
BEFORE UPDATE ON public.dataplex_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dataplex_documents_type_date ON public.dataplex_documents (doc_type, issue_date DESC);