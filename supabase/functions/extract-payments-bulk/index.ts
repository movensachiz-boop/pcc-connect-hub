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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an OCR assistant for a school accounts office processing a BANK STATEMENT table of fee deposits.

COLUMN ORDER (fixed): [Posting Date] [Details/Description] [Channel ID] [Value Date] [Debit] [Credit] [Balance]. Preserve column positions and row alignment.

CRITICAL EXTRACTION STRATEGY — ANCHOR ON THE CREDIT AMOUNT, NOT ON THE NAME:
1. First identify every NON-ZERO amount in the CREDIT column only. Ignore Debit, Balance, and 0.00 credit values.
2. For each non-zero Credit amount, read horizontally left to find the same visual row/line in the Details column and the nearest Posting Date for that row/block.
3. The student name normally appears BELOW that credit-aligned row, in the same transaction block. Assign the Credit amount to the FIRST full student name BELOW that credit line before the next non-zero Credit amount or next transaction block.
4. Never assign a Credit amount to a student name ABOVE the credit line if there is another full student name below that same credit line. This prevents shifting an amount to the previous student.
5. If there is a full student name ABOVE the credit line and there is NO full student name below it before the transaction block ends, then the amount can belong to the name above. This covers wrapped last-row cases where the valid Credit amount is directly below the student's name in the same block.
6. If a Credit amount has no student name below it and no unambiguous same-block student name immediately above it, SKIP it.

SPECIFIC BANK STATEMENT PATTERN TO FOLLOW:
- A line like "Cash Deposit Same" with Credit 275.00 followed BELOW by "ZANELE PANDE" means 275.00 belongs to Zanele Pande, NOT to any name above such as Ruvarashe Remigio.
- The next Credit 270.00 followed BELOW by "FEES SAINT SHERENI" belongs to Saint Shereni.
- If the final visible transaction has "MITCHEL DHEMBA" and the only non-zero Credit amount for that block is directly below/within the same wrapped block, capture that non-zero Credit amount for Mitchel Dhemba, not the nearby 0.00.

DO NOT shift rows incorrectly:
- Do not start from a student name and grab the amount below it if that amount has another student name below it.
- Do not use Debit or Balance values.
- Do not capture rows where the only aligned Credit value is 0.00.
- Do not duplicate one Credit amount for two names.

For EACH valid transaction, return:
- date: value from the Posting Date column for that credit/name block (YYYY-MM-DD if possible, else as printed).
- details: the full valid transaction block as printed.
- student_name: the first full student name linked to that Credit amount by the rules above. Strip labels (FEES, FEES-, DEPOSIT, VACATION, TERM/T1/T2/T3 + year, F1..F6, FORM 1..6, BLUE/YELLOW/GREEN/RED/G1/G2/G22/SCIENCES/COMMERCIALS/ARTS). Title case. Never include phone/account numbers.
- amount: the non-zero number from the CREDIT column linked to that block.

Skip "Brought Forward Balance", running totals, headers, debit-only rows, and credit rows without a linked student name.

Return ONLY a JSON object: {"rows":[{...}, ...]}. No markdown.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract payments by anchoring on each NON-ZERO CREDIT column amount. For each credit amount, find the student name in the same visual transaction block: usually the first full student name BELOW that credit line. Do NOT give the credit to a name above if another name appears below it. Example: Credit 275.00 on the 'Cash Deposit Same' line belongs to Zanele Pande below it, not Ruvarashe Remigio above it; the next 270.00 belongs to Saint Shereni below it. If a final wrapped block has the student name above and the only non-zero credit is directly below with no next student below, assign it to that above name (e.g. Mitchel Dhemba 270.00), not to 0.00." },
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
