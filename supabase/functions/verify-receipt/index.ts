import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { receiptNumber } = await req.json();

    if (!receiptNumber || typeof receiptNumber !== "string") {
      return new Response(JSON.stringify({ error: "Receipt number required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanReceipt = receiptNumber.trim().toUpperCase();

    // Look up the payment
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("receipt_number, amount, currency, method, created_at, student_profile_id, verification_hash")
      .eq("receipt_number", cleanReceipt)
      .eq("status", "paid")
      .maybeSingle();

    if (error || !payment) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the hash by recomputing it
    const { data: hashCheck, error: rpcError } = await supabaseAdmin.rpc("verify_payment_hash", {
      p_receipt_number: payment.receipt_number,
      p_amount: String(payment.amount),
      p_student_profile_id: payment.student_profile_id,
      p_created_at: payment.created_at,
      p_stored_hash: payment.verification_hash || "",
    });
    console.log("RPC params:", JSON.stringify({
      p_receipt_number: payment.receipt_number,
      p_amount: String(payment.amount),
      p_student_profile_id: payment.student_profile_id,
      p_created_at: payment.created_at,
      p_stored_hash: payment.verification_hash || "",
    }));
    console.log("Hash check result:", hashCheck, "rpcError:", rpcError);

    // Get student name (partially masked for privacy)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", payment.student_profile_id)
      .maybeSingle();

    const firstName = profile?.first_name || "";
    const lastName = profile?.last_name || "";
    // Mask: show first 2 chars, rest as *
    const maskedName = `${firstName.substring(0, 2)}${"*".repeat(Math.max(0, firstName.length - 2))} ${lastName.substring(0, 2)}${"*".repeat(Math.max(0, lastName.length - 2))}`;

    const isValid = hashCheck === true || hashCheck === "true";

    return new Response(JSON.stringify({
      valid: isValid,
      receiptNumber: payment.receipt_number,
      amount: payment.amount,
      currency: payment.currency,
      date: new Date(payment.created_at).toLocaleDateString("en-GB"),
      studentName: maskedName,
      method: payment.method,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
