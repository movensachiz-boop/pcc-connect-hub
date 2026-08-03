CREATE POLICY "Cashiers can view payments" ON public.payments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can update payments" ON public.payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can delete payments" ON public.payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'cashier'::app_role));