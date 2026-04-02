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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, registrationNumber, password } = await req.json();

    if (action === "check") {
      // Check if registration number exists and is unclaimed
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, claimed")
        .eq("registration_number", registrationNumber)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Registration number not found. Contact your admin." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (profile.claimed) {
        return new Response(JSON.stringify({ error: "This account has already been set up. Use the login page." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        valid: true,
        name: `${profile.first_name} ${profile.last_name}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "claim") {
      if (!registrationNumber || !password) {
        return new Response(JSON.stringify({ error: "Registration number and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify registration number exists and is unclaimed
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, claimed")
        .eq("registration_number", registrationNumber)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Registration number not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (profile.claimed) {
        return new Response(JSON.stringify({ error: "This account has already been set up" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const email = `${registrationNumber.toLowerCase()}@pcc.local`;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          registration_number: registrationNumber,
          first_name: profile.first_name,
          last_name: profile.last_name,
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile with user_id and mark as claimed
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ user_id: newUser.user.id, claimed: true })
        .eq("id", profile.id);

      if (updateError) {
        // Cleanup auth user if profile update fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Assign student role
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "student",
      });

      // Sign in the user
      const supabase = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(JSON.stringify({
          success: true,
          message: "Account created. Please log in.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        session: signInData.session,
        name: `${profile.first_name} ${profile.last_name}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
