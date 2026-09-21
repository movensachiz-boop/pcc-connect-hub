import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FEES_ACCOUNT = "3251011999451";
const INVENTORY_ACCOUNT = "3251011999452";

const FEE_CATEGORIES = [
  { code: "TUITION", name: "Tuition / School Fees", description: "Main termly school fees for all forms", account: FEES_ACCOUNT, ledger: "fees" },
  { code: "LEVY", name: "Levy", description: "Class levies, including the Gold stream levy", account: FEES_ACCOUNT, ledger: "fees" },
  { code: "UNIFORMS", name: "Uniforms", description: "Uniforms and other inventory items", account: INVENTORY_ACCOUNT, ledger: "inventory" },
  { code: "TRIP", name: "Trip", description: "Educational trips and excursions", account: INVENTORY_ACCOUNT, ledger: "inventory" },
];

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const buildClass = (form?: string | null, stream?: string | null) => {
  if (!form) return null;
  const f = /^form\s/i.test(form) ? form.replace(/^form\s*/i, "Form ") : `Form ${form}`;
  return [f, stream].filter(Boolean).join(" ");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("bank-api");
  const route = (idx >= 0 ? segments.slice(idx + 1) : segments).filter(s => s !== "v1");
  const endpoint = "/" + route.join("/");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let apiKeyId: string | null = null;
  const log = async (status: number, extra: Record<string, unknown> = {}) => {
    try {
      await supabase.from("bank_api_logs").insert({
        api_key_id: apiKeyId,
        endpoint,
        method: req.method,
        status_code: status,
        ...extra,
      });
    } catch (_) { /* logging must never break the API */ }
  };

  try {
    if (endpoint === "/health" && req.method === "GET") {
      return json({ status: "ok", service: "PCC Fees Collection API", version: "1.0", time: new Date().toISOString() });
    }

    // Friendly root response so opening the base URL in a browser confirms the service is live
    if ((endpoint === "/" || endpoint === "") && req.method === "GET") {
      return json({
        status: "online",
        service: "PCC Fees Collection API",
        version: "1.0",
        message: "This is a machine-to-machine payment interface, not a web page. The bank connects here using its API key.",
        endpoints: ["GET /health", "GET /students", "GET /students/{registration_number}", "GET /students/{registration_number}/payments", "POST /payments", "GET /fee-categories"],
        authentication: "Authorization: Bearer <api-key>",
      });
    }

    // ---- Authentication: Bearer token (API key) ----
    const header = req.headers.get("authorization") || "";
    const presented = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : (req.headers.get("x-api-key") || "").trim();

    if (!presented) {
      await log(401, { error: "missing_credentials" });
      return json({ error: "unauthorized", message: "Provide your API key as: Authorization: Bearer <key>" }, 401);
    }

    const { data: keyRow } = await supabase
      .from("bank_api_keys")
      .select("id, is_active, revoked_at")
      .eq("key_hash", await sha256(presented))
      .maybeSingle();

    if (!keyRow || !keyRow.is_active || keyRow.revoked_at) {
      await log(401, { error: "invalid_key" });
      return json({ error: "unauthorized", message: "Invalid or revoked API key" }, 401);
    }
    apiKeyId = keyRow.id;
    await supabase.from("bank_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    // ---- GET /fee-categories ----
    if (endpoint === "/fee-categories" && req.method === "GET") {
      await log(200);
      return json({ fee_categories: FEE_CATEGORIES });
    }

    // ---- GET /students ----
    if (endpoint === "/students" && req.method === "GET") {
      const page = Math.max(1, Number(url.searchParams.get("page") || 1));
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
      const search = (url.searchParams.get("search") || "").trim();
      const form = (url.searchParams.get("form") || "").trim();

      let query = supabase
        .from("profiles")
        .select("registration_number, first_name, last_name, form, stream, status, balance", { count: "exact" })
        .order("registration_number", { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (form) query = query.eq("form", form);
      if (search) {
        query = query.or(
          `registration_number.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      await log(200);
      return json({
        page,
        limit,
        total: count || 0,
        students: (data || []).map(s => ({
          registration_number: s.registration_number,
          full_name: `${s.first_name} ${s.last_name}`.trim(),
          first_name: s.first_name,
          last_name: s.last_name,
          class: buildClass(s.form, s.stream),
          form: s.form,
          stream: s.stream,
          status: s.status,
        })),
      });
    }

    // ---- GET /students/{registration_number} and /students/{reg}/payments ----
    if (route[0] === "students" && route[1] && req.method === "GET") {
      const reg = decodeURIComponent(route[1]).trim().toUpperCase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, registration_number, first_name, last_name, form, stream, status, guardian_name, guardian_phone")
        .ilike("registration_number", reg)
        .maybeSingle();

      if (!profile) {
        await log(404, { registration_number: reg, error: "student_not_found" });
        return json({ error: "not_found", message: `No student with registration number ${reg}` }, 404);
      }

      const { data: term } = await supabase
        .from("academic_terms").select("id, name, year, term_number").eq("is_current", true).maybeSingle();

      const { data: summaryRows } = await supabase.rpc("get_student_fee_summary", { _term_id: term?.id ?? null });
      const summary = (summaryRows as Array<Record<string, unknown>> | null)?.find(r => r.profile_id === profile.id);
      const totalFees = Number(summary?.total_fees || 0);
      const totalPaid = Number(summary?.total_paid || 0);

      const wantsPayments = route[2] === "payments";
      const { data: payments } = await supabase
        .from("payments")
        .select("receipt_number, amount, currency, method, status, description, paynow_reference, created_at")
        .eq("student_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(wantsPayments ? 200 : 10);

      const history = (payments || []).map(p => ({
        receipt_number: p.receipt_number,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        description: p.description,
        bank_reference: p.paynow_reference,
        paid_at: p.created_at,
      }));

      const account = {
        registration_number: profile.registration_number,
        full_name: `${profile.first_name} ${profile.last_name}`.trim(),
        class: buildClass(profile.form, profile.stream),
        form: profile.form,
        stream: profile.stream,
        status: profile.status,
        guardian_name: profile.guardian_name,
        guardian_phone: profile.guardian_phone,
        term: term ? { id: term.id, name: term.name, year: term.year, term_number: term.term_number } : null,
        currency: "USD",
        total_fees: totalFees,
        total_paid: totalPaid,
        outstanding_balance: Number((totalFees - totalPaid).toFixed(2)),
        payment_status: summary?.payment_status || "Outstanding",
      };

      await log(200, { registration_number: profile.registration_number });
      return wantsPayments
        ? json({ student: account, payments: history })
        : json({ student: account, recent_payments: history });
    }

    // ---- POST /payments ----
    if (endpoint === "/payments" && req.method === "POST") {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) {
        await log(400, { error: "invalid_json" });
        return json({ error: "bad_request", message: "Request body must be valid JSON" }, 400);
      }

      const reg = String(body.registration_number || "").trim().toUpperCase();
      const amount = Number(body.amount);
      const currency = String(body.currency || "USD").toUpperCase();
      const bankRef = String(body.bank_reference || body.reference || "").trim();
      const category = String(body.fee_category || "TUITION").toUpperCase();
      const channel = String(body.channel || "Bank Transfer").trim();
      const payer = String(body.payer_name || "").trim();

      const errors: string[] = [];
      if (!reg) errors.push("registration_number is required");
      if (!Number.isFinite(amount) || amount <= 0) errors.push("amount must be a positive number");
      if (!bankRef) errors.push("bank_reference is required and must be unique per transaction");
      if (!FEE_CATEGORIES.some(c => c.code === category)) {
        errors.push(`fee_category must be one of ${FEE_CATEGORIES.map(c => c.code).join(", ")}`);
      }
      if (currency !== "USD") errors.push("currency must be USD");
      if (errors.length) {
        await log(400, { registration_number: reg, bank_reference: bankRef, amount, error: errors.join("; ") });
        return json({ error: "validation_failed", details: errors }, 400);
      }

      // Idempotency — a repeated bank reference returns the original receipt.
      const { data: existing } = await supabase
        .from("payments")
        .select("receipt_number, amount, currency, status, created_at")
        .eq("paynow_reference", bankRef)
        .maybeSingle();

      if (existing) {
        await log(200, { registration_number: reg, bank_reference: bankRef, amount });
        return json({
          duplicate: true,
          message: "This bank reference was already posted; the original receipt is returned.",
          receipt_number: existing.receipt_number,
          amount: Number(existing.amount),
          currency: existing.currency,
          status: existing.status,
          posted_at: existing.created_at,
        });
      }

      const { data: profile } = await supabase
        .from("profiles").select("id, first_name, last_name, form, stream, registration_number")
        .ilike("registration_number", reg).maybeSingle();

      if (!profile) {
        await log(404, { registration_number: reg, bank_reference: bankRef, amount, error: "student_not_found" });
        return json({ error: "not_found", message: `No student with registration number ${reg}` }, 404);
      }

      const label = FEE_CATEGORIES.find(c => c.code === category)?.name || category;
      const { data: inserted, error: insertError } = await supabase
        .from("payments")
        .insert({
          student_profile_id: profile.id,
          amount,
          currency,
          method: channel || "Bank Transfer",
          status: "paid",
          paynow_reference: bankRef,
          bank_name: "National Building Society",
          description: payer ? `${label} — NBS (${payer})` : `${label} — NBS`,
        })
        .select("receipt_number, created_at")
        .single();

      if (insertError) throw insertError;

      await log(201, { registration_number: reg, bank_reference: bankRef, amount });
      return json({
        success: true,
        receipt_number: inserted.receipt_number,
        registration_number: profile.registration_number,
        student_name: `${profile.first_name} ${profile.last_name}`.trim(),
        class: buildClass(profile.form, profile.stream),
        amount,
        currency,
        fee_category: category,
        bank_reference: bankRef,
        posted_at: inserted.created_at,
        verification_url: `https://progresscentresys.com/verify?receipt=${inserted.receipt_number}`,
      }, 201);
    }

    await log(404, { error: "unknown_endpoint" });
    return json({ error: "not_found", message: `Unknown endpoint ${endpoint}` }, 404);
  } catch (err) {
    console.error("bank-api error:", err);
    await log(500, { error: String((err as Error)?.message || err) });
    return json({ error: "server_error", message: (err as Error)?.message || "Unexpected error" }, 500);
  }
});
