CREATE TABLE public.kitchen_stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'units',
  source text,
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_stock_entries TO authenticated;
GRANT ALL ON public.kitchen_stock_entries TO service_role;

ALTER TABLE public.kitchen_stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kitchen stock" ON public.kitchen_stock_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER kitchen_stock_updated_at
  BEFORE UPDATE ON public.kitchen_stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_kitchen_stock_received_on ON public.kitchen_stock_entries (received_on DESC);