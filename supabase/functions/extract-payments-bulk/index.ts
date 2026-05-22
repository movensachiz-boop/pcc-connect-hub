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
            content: `You are an OCR assistant for a school accounts office processing a BANK STATEMENT table of fee deposits. Accuracy is more important than speed.

COLUMN ORDER (fixed): [Posting Date] [Details/Description] [Debit] [Credit] [Balance].

ANCHOR RULE (MOST IMPORTANT):
- Every visible value in the Posting Date column starts a NEW STUDENT TRANSACTION. Treat each Posting Date as a hard boundary/anchor.
- Process anchors from top to bottom. For anchor N, the transaction block starts at Posting Date N and ends immediately BEFORE Posting Date N+1.
- NEVER read student information from anchor N+1 while processing anchor N. If another Posting Date appears, you have already moved to the next student.
- The first student and the last student must be captured using the exact same anchor method.

HOW EACH TRANSACTION BLOCK IS LAID OUT:
- TOP LINE of the block: Posting Date + Details header + Credit amount are on the SAME horizontal row. The header is often "FEES", "DEPOSIT", or "VACATION FEES T1 2026".
- NAME LINE of the block: the student name is normally the description line DIRECTLY BELOW that Posting Date, still before the next Posting Date anchor.
- AMOUNT: take ONLY the Credit column value horizontally aligned with this same Posting Date anchor/top line. NEVER take Debit. NEVER take Credit from the next Posting Date row.
- NAME: take the first full student name found inside this same anchored block. Prefer the line directly below the Posting Date. If the top Details line contains "FEES" followed by a name, take the first full name after "FEES". Stop scanning as soon as the next Posting Date starts.

DO NOT shift rows. A common mistake is to read the student name from one transaction and pair it with the next transaction's amount — this is WRONG. The amount always belongs to the Posting Date on the same horizontal row as that amount, and the student name must come from the block under that same Posting Date only.

For EACH transaction block, return:
- date: value from the Posting Date column (YYYY-MM-DD if possible, else as printed).
- details: the full description block (header line + name line) as printed.
- student_name: the student full name parsed from the same anchored block, normally the line DIRECTLY BELOW the Posting Date. If multiple names appear inside this block, take the first full person name after "FEES". Strip labels (FEES, FEES-, DEPOSIT, VACATION, TERM/T1/T2/T3 + year, F1..F6, FORM 1..6, BLUE/YELLOW/GREEN/RED/G1/G2/G22/SCIENCES/COMMERCIALS/ARTS). Title case. Never include phone or account numbers.
- amount: the number from the Credit column HORIZONTALLY ALIGNED with this Posting Date anchor (same row as the header line, NOT the name line). NEVER take Debit. NEVER take the next Posting Date row's Credit. If the Credit cell on this Posting Date row is empty/zero, SKIP this transaction.

FINAL SELF-CHECK BEFORE RETURNING:
- For every returned row, confirm: date and amount are on the same horizontal row; student_name appears after that date and before the next Posting Date.
- If a name is below one Posting Date but the amount is aligned to the next Posting Date, your extraction is wrong; fix it before returning.
- Do not guess missing names by using the next transaction block.

Skip "Brought Forward Balance", running totals, headers, and any debit-only rows.

Return ONLY a JSON object: {"rows":[{...}, ...]}. No markdown.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Use Posting Date anchors. Every Posting Date starts a new student transaction. For each date, take the Credit amount on the same horizontal row as that date, then take the student name from the description line directly below that same date, before the next Posting Date appears. Do not borrow the next row's amount or the next student's name. Capture the first student through the last student using this exact same method. Skip rows whose Credit cell on the date row is empty or zero." },
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
