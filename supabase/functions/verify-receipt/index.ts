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

    // Look up the payment (accept any "successful" status)
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("receipt_number, amount, currency, method, status, created_at, student_profile_id, verification_hash, description")
      .eq("receipt_number", cleanReceipt)
      .in("status", ["paid", "confirmed", "completed"])
      .maybeSingle();

    if (error || !payment) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the hash by recomputing it (don't fail the whole verification if RPC errors)
    let isValid = true;
    if (payment.verification_hash) {
      const { data: hashCheck } = await supabaseAdmin.rpc("verify_payment_hash", {
        p_receipt_number: payment.receipt_number,
        p_amount: String(payment.amount),
        p_student_profile_id: payment.student_profile_id,
        p_created_at: payment.created_at,
        p_stored_hash: payment.verification_hash,
      });
      isValid = hashCheck === true || hashCheck === "true";
    }

    // Get student details
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, registration_number, form, stream")
      .eq("id", payment.student_profile_id)
      .maybeSingle();

    const titleCase = (s: string) =>
      s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const firstName = titleCase(profile?.first_name || "");
    const lastName = titleCase(profile?.last_name || "");
    const fullName = `${firstName} ${lastName}`.trim() || "Unknown";
    // Privacy mask: first 2 chars + asterisks
    const mask = (n: string) =>
      n.length <= 2 ? n : `${n.substring(0, 2)}${"*".repeat(n.length - 2)}`;
    const maskedName = `${mask(firstName)} ${mask(lastName)}`.trim();

    const formRaw = profile?.form || "";
    const formClean = formRaw
      ? /^form\s/i.test(formRaw)
        ? formRaw.replace(/^form\s*/i, "Form ")
        : `Form ${formRaw}`
      : "";
    const studentClass = [formClean, profile?.stream].filter(Boolean).join(" ") || "—";

    // Mask reg number too
    const reg = profile?.registration_number || "";
    const maskedReg = reg.length <= 3 ? reg : `${reg.substring(0, 3)}${"*".repeat(reg.length - 3)}`;

    return new Response(JSON.stringify({
      valid: isValid,
      receiptNumber: payment.receipt_number,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      date: new Date(payment.created_at).toLocaleDateString("en-GB"),
      studentName: maskedName || "Unknown",
      studentNameFull: fullName,
      regNumber: maskedReg,
      studentClass,
      method: payment.method,
      description: payment.description,
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
