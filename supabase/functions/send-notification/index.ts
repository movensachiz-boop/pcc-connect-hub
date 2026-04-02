import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ZAVU_API_KEY = Deno.env.get("ZAVU_API_KEY");
    if (!ZAVU_API_KEY) {
      throw new Error("ZAVU_API_KEY is not configured");
    }

    // Verify the caller is an admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { guardianPhone, studentName, registrationNumber, channel } = await req.json();

    if (!guardianPhone || !studentName || !registrationNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields: guardianPhone, studentName, registrationNumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = `Dear Guardian,\n\nYour child ${studentName} has been registered at PCC School.\n\nRegistration Number: ${registrationNumber}\n\nPlease use this registration number to set up the student portal account at the school's portal.\n\nThank you.`;

    // Send via Zavu API
    const zavuResponse = await fetch("https://api.zavu.dev/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAVU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: guardianPhone,
        text: message,
      }),
    });

    const zavuData = await zavuResponse.json();

    if (!zavuResponse.ok) {
      console.error("Zavu API error:", JSON.stringify(zavuData));
      return new Response(JSON.stringify({ 
        error: "Failed to send notification", 
        details: zavuData 
      }), {
        status: zavuResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: zavuData?.message?.id,
      channel: zavuData?.message?.channel,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notification error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
