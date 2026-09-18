import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StockRow = { item?: string; quantity?: string | number; unit?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return json({ error: "AI service not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Forbidden: admin only" }, 403);

    const { imageBase64 } = await req.json();
    if (!imageBase64) return json({ error: "No image provided" }, 400);

    const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const instructions = `You read handwritten or printed KITCHEN STOCK lists from a school store book.

The page normally has a heading (e.g. "Current Stock In from Machingara") and two columns: ITEM and QTY.

Rules:
- Return one row per item line.
- item: the product name exactly as written, corrected to normal spelling and Title Case (e.g. "Cofee" -> "Coffee", "Backed Beans" -> "Baked Beans", "Sunjam" -> "Sun Jam", "Buttercup Magarine" -> "Buttercup Margarine", "Macarroni" -> "Macaroni").
- quantity: the numeric total. If the line shows an addition like "840 units + 96 units", return the SUM (936). If a number is crossed out and replaced, use the FINAL written number.
- unit: the written unit (usually "units"); default to "units".
- Skip the heading, column headers, blank lines and totals.
- title: the heading of the page if present (e.g. supplier or source name), else empty.

Return ONLY JSON: {"title":"...","rows":[{"item":"...","quantity":0,"unit":"units"}]} with no markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        instructions,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract every stock item and its quantity from this page. Return the JSON object only." },
              { type: "input_image", image_url: imageUrl },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) return json({ error: "AI service is busy. Please try again." }, 429);
      if (aiResponse.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable Cloud." }, 402);
      return json({ error: "Failed to process image" }, 500);
    }

    const aiData = await aiResponse.json();
    let text: string = aiData.output_text || "";
    if (!text && Array.isArray(aiData.output)) {
      for (const item of aiData.output) {
        for (const c of item?.content || []) {
          if (typeof c?.text === "string") text += c.text;
        }
      }
    }

    let parsed: { title?: string; rows?: StockRow[] } = {};
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e) { console.error("Parse error:", e); }
    }

    const rows = (parsed.rows || [])
      .map((r) => ({
        item: String(r.item || "").trim(),
        quantity: String(r.quantity ?? "").replace(/[^0-9.]/g, ""),
        unit: String(r.unit || "units").trim() || "units",
      }))
      .filter((r) => r.item);

    return json({ title: (parsed.title || "").trim(), rows });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
