-- 1. activity_log: no NULL-user or spoofed actor inserts
DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_log;
CREATE POLICY "Users insert own activity"
ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (actor_email IS NULL OR actor_email = (auth.jwt() ->> 'email'))
);

-- 2. payment_audit_log: only the SECURITY DEFINER trigger / service role writes
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.payment_audit_log;
REVOKE INSERT ON public.payment_audit_log FROM authenticated;

-- 3. user_roles: defence-in-depth trigger against privilege escalation
CREATE OR REPLACE FUNCTION public.enforce_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL means service_role / server-side (edge functions, migrations)
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can modify user roles';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_assignment ON public.user_roles;
CREATE TRIGGER trg_enforce_role_assignment
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_role_assignment();

-- 4. Revoke EXECUTE on SECURITY DEFINER functions not meant for client calls
REVOKE ALL ON FUNCTION public.enforce_role_assignment() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_current_term_id() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_payment_hash(text, text, text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_document_fingerprint(text, text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_unset_beginner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_inventory_stock() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_payment_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_payment_term() FROM anon, authenticated;

-- anon must not run these; authenticated app code still needs them
REVOKE ALL ON FUNCTION public.get_student_fee_summary() FROM anon;
REVOKE ALL ON FUNCTION public.get_student_fee_summary(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.start_new_term(text, integer, integer, date) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;