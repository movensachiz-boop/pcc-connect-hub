ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_sales REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_sales;