import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiting
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_DEVICES = 2;

function checkLoginRate(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.set(key, { count: 1, lastAttempt: now });
    return false;
  }
  record.count++;
  record.lastAttempt = now;
  return record.count > MAX_LOGIN_ATTEMPTS;
}

function resetLoginRate(key: string) {
  loginAttempts.delete(key);
}

// Simple device fingerprint from IP + User-Agent
function getDeviceFingerprint(req: Request): { ip: string; fingerprint: string; userAgent: string } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             req.headers.get("x-real-ip") ||
             "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  // Create a simple fingerprint from IP + a hash of user agent
  const fingerprint = `${ip}::${userAgent.substring(0, 100)}`;
  return { ip, fingerprint, userAgent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { registrationNumber, password } = await req.json();

    if (!registrationNumber || !password || typeof registrationNumber !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Registration number and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanInput = registrationNumber.trim();

    // Rate limiting (keyed by lowercase identifier)
    if (checkLoginRate(cleanInput.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the input looks like an email (e.g. owner accounts), use it directly.
    // Otherwise treat it as a registration number and map to the virtual email.
    const email = cleanInput.includes("@")
      ? cleanInput.toLowerCase()
      : `${cleanInput.toUpperCase().toLowerCase()}@pcc.local`;

    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "Invalid registration number or password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Successful login - reset rate limit
    resetLoginRate(cleanInput.toLowerCase());

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Device session fingerprinting ──
    const { ip, fingerprint, userAgent } = getDeviceFingerprint(req);

    // Get existing sessions for this user
    const { data: existingSessions } = await supabaseAdmin
      .from("device_sessions")
      .select("id, device_fingerprint, ip_address, last_active_at")
      .eq("user_id", data.user.id)
      .order("last_active_at", { ascending: false });

    const sessions = existingSessions || [];
    const currentSession = sessions.find((s) => s.device_fingerprint === fingerprint);

    if (currentSession) {
      // Known device — update last active
      await supabaseAdmin
        .from("device_sessions")
        .update({ last_active_at: new Date().toISOString(), ip_address: ip })
        .eq("id", currentSession.id);
    } else {
      // Device limit temporarily disabled — allow any device to connect
      await supabaseAdmin.from("device_sessions").insert({
        user_id: data.user.id,
        ip_address: ip,
        device_fingerprint: fingerprint,
        user_agent: userAgent.substring(0, 500),
      });
    }

    // Get role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    return new Response(JSON.stringify({
      session: data.session,
      role: roleData?.role || "student",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
