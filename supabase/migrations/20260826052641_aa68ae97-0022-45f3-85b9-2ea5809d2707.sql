REVOKE ALL ON FUNCTION public.auto_unset_beginner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_inventory_stock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_role_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_term_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_payment_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_payment_term() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_document_fingerprint(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_payment_hash(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_fee_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_fee_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_new_term(text, integer, integer, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;

-- keep the app working for signed-in users
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_fee_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_term(text, integer, integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;