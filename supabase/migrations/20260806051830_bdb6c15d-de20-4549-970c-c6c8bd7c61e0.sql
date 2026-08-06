CREATE POLICY "Developers can view payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'developer')) WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers can delete payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Owners can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));