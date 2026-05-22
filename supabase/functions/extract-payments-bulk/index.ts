import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExtractedRow = {
  date?: string;
  details?: string;
  student_name?: string;
  amount?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an OCR assistant for a school accounts office processing a BANK STATEMENT table containing many fee deposit transactions.

CRITICAL — USE TABLE STRUCTURE / COLUMN ALIGNMENT:
The statement has these columns in this fixed order: [Posting Date] [Details/Description] [Debit] [Credit] [Balance].
You MUST read each transaction as ONE HORIZONTAL ROW. A value belongs to a transaction ONLY if it sits on the same horizontal row (same y-position) as that row's Posting Date. Never mix values from the row above or below. Preserve column positions when parsing.

For EACH transaction row, return:
- date: the value from the leftmost "Posting Date" column on that row (YYYY-MM-DD if possible, else as printed).
- details: the raw narration from the "Details/Description" column on that same row. Description text may sit directly below or beside the date but still belongs to the same row — include wrapped lines only if they clearly belong to this transaction and not the next.
- student_name: the student's full name parsed from that row's description. If the word "FEES" appears, take the FIRST full student name that appears AFTER "FEES". Otherwise take the first clear person name. Strip labels like FEES, FEES-, DEPOSIT, VACATION, TERM/T1/T2/T3 + year, form labels (F1..F6, FORM 1..6), and streams/colours (BLUE, YELLOW, GREEN, RED, G1, G2, G22, SCIENCES, COMMERCIALS, ARTS). Title case. Never include phone or account numbers.
- amount: the number from the "Credit" column that is HORIZONTALLY ALIGNED with this row's Posting Date. NEVER take the Debit value. NEVER take a Credit value from a different row. Numeric only, no currency symbol. If this row's Credit cell is empty or 0.00, SKIP the row entirely.

Skip "Brought Forward Balance", running totals, headers, and any row whose Credit cell is empty/zero. Skip pure debit rows.

Return ONLY a JSON object: {"rows":[{...}, ...]}. No markdown.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Detect each transaction row separately by horizontal alignment. For each row: date from Posting Date column, description from Details column on the same row, amount strictly from the Credit column horizontally aligned with that row. Ignore Debit values and skip rows with empty/zero Credit. If the description has multiple names, take the first full student name after the word FEES." },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_payments",
              description: "Extract many fee deposit rows from a bank statement",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        details: { type: "string" },
                        student_name: { type: "string" },
                        amount: { type: "string" },
                      },
                      required: ["student_name", "amount"],
                    },
                  },
                },
                required: ["rows"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_payments" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI service is busy. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Cloud." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to process image" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let rows: ExtractedRow[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    // Clean up: drop empty/zero amounts, strip phone-like strings
    rows = rows
      .map((r) => ({
        date: (r.date || "").trim(),
        details: (r.details || "").trim(),
        student_name: (r.student_name || "").replace(/\+?\d[\d\s-]{6,}/g, "").trim(),
        amount: String(r.amount || "").replace(/[^0-9.]/g, ""),
      }))
      .filter((r) => r.student_name && r.amount && parseFloat(r.amount) > 0);

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
