import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Only allow users with the `developer` role. Checks server-side via user_roles. */
const DeveloperGuard = ({ children }: { children: ReactNode }) => {
  const { loading } = useUserRole();
  const [isDev, setIsDev] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsDev(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "developer" as any)
        .maybeSingle();
      setIsDev(!!data);
    })();
  }, []);

  if (loading || isDev === null) return null;
  if (!isDev) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default DeveloperGuard;
