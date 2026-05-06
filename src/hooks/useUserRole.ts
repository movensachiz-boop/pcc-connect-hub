import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "student" | "teacher" | "owner" | "cashier" | "timetable_manager";

export function useUserRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) { setRole(null); setLoading(false); } return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (mounted) { setRole((data?.role as AppRole) ?? "student"); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  return { role, loading };
}
