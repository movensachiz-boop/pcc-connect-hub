import { supabase } from "@/integrations/supabase/client";

export async function logSlaActivity(
  action: string,
  agreement_id?: string | null,
  details?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("sla_audit_log").insert({
      agreement_id: agreement_id ?? null,
      action,
      actor_user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      details: details ?? null,
    } as any);
  } catch {
    // best effort
  }
}
