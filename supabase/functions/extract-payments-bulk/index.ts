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

type StatementLine = {
  line_no?: number;
  date?: string;
  details?: string;
  debit?: string;
  credit?: string;
  balance?: string;
  student_name?: string;
};

const parseMoney = (value?: string) => {
  const cleaned = String(value || "").replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
};

const cleanStudentName = (value?: string) =>
  String(value || "")
    .replace(/\+?\d[\d\s-]{6,}/g, "")
    .replace(/\b(FEES?|DEPOSIT|VACATION|TERM|T[123]|20\d{2}|FORM\s*[1-6]|F[1-6]|BLUE|YELLOW|GREEN|RED|G1|G2|G22|SCIENCES|COMMERCIALS|ARTS)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const hasStudentName = (line?: StatementLine) => {
  const name = cleanStudentName(line?.student_name || line?.details);
  return name.split(/\s+/).filter(Boolean).length >= 2 ? name : "";
};

const isDepositMarker = (details?: string) => /\b(cash\s+deposit|deposit|credit|cash\s+dep)\b/i.test(details || "");

const buildRowsFromStatementLines = (lines: StatementLine[]): ExtractedRow[] => {
  const ordered = [...lines]
    .map((line, index) => ({ ...line, line_no: Number(line.line_no || index + 1) }))
    .sort((a, b) => Number(a.line_no) - Number(b.line_no));

  return ordered.flatMap((line, index) => {
    const amount = parseMoney(line.credit);
    if (amount <= 0) return [];

    const sameLineName = hasStudentName(line);
    let chosenName = sameLineName;

    if (!chosenName || isDepositMarker(line.details)) {
      for (let i = index + 1; i < ordered.length; i++) {
        const next = ordered[i];
        if (parseMoney(next.credit) > 0) break;
        const candidate = hasStudentName(next);
        if (candidate) {
          chosenName = candidate;
          break;
        }
      }
    }

    if (!chosenName) {
      for (let i = index - 1; i >= 0; i--) {
        const prev = ordered[i];
        if (parseMoney(prev.credit) > 0) break;
        const candidate = hasStudentName(prev);
        if (candidate) {
          chosenName = candidate;
          break;
        }
      }
    }

    if (!chosenName) return [];

    const blockDetails = [ordered[index - 1]?.details, line.details, ordered[index + 1]?.details]
      .filter(Boolean)
      .join(" | ");

    return [{
      date: line.date || ordered[index - 1]?.date || "",
      details: blockDetails,
      student_name: chosenName,
      amount: amount.toFixed(2),
    }];
  });
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
            content: `You are an OCR assistant for a school accounts office processing a BANK STATEMENT table.

Your job is ONLY to transcribe the statement into VISUAL LINES from top to bottom. Do NOT decide final payment matching.

COLUMN ORDER (fixed): [Posting Date] [Details/Description] [Channel ID] [Value Date] [Debit] [Credit] [Balance]. Preserve the row/line alignment exactly as seen.

CRITICAL COLUMN RULES:
1. Return one object per visible printed line, ordered top-to-bottom with line_no starting at 1.
2. Put numbers in credit ONLY when the number is visually in the CREDIT column. Never copy Balance or Debit values into credit.
3. Put numbers in debit ONLY when visually in the DEBIT column. Balance values belong only in balance.
4. Include 0.00 credit values as credit: "0.00" if they are printed in the Credit column, because the app will ignore zero credits later.
5. If a transaction wraps over multiple printed lines, return each printed line separately. Do not merge rows.
6. If a student name appears on a line, put the clean full name in student_name as well as leaving the original wording in details. If there is no clear full student name, leave student_name empty.

IMPORTANT ALIGNMENT EXAMPLES:
- If "Cash Deposit Same" has Credit 275.00 on its line and "ZANELE PANDE" appears on the next visual line, return TWO separate lines: line A details "Cash Deposit Same" credit "275.00"; line B details/student_name "ZANELE PANDE" with no credit unless a credit is also printed on that exact line.
- If "FEES SAINT SHERENI" appears below a Credit 270.00 line, keep Saint Shereni on its own lower line.
- If "MITCHEL DHEMBA" is above a continuation line where Credit 270.00 is printed, keep Mitchel Dhemba on the name line and Credit 270.00 on the continuation line.

Skip only page headers/footers that are not table lines. Return ONLY the tool call data.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe every visible bank statement table line in top-to-bottom order. Preserve which numbers are in the CREDIT column. Do not merge wrapped lines and do not move an amount from one line to another." },
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
              description: "Transcribe visible bank statement lines with column alignment preserved",
              parameters: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        line_no: { type: "number" },
                        date: { type: "string" },
                        details: { type: "string" },
                        debit: { type: "string" },
                        credit: { type: "string" },
                        balance: { type: "string" },
                        student_name: { type: "string" },
                      },
                      required: ["line_no", "details"],
                    },
                  },
                },
                required: ["lines"],
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
    let statementLines: StatementLine[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        statementLines = Array.isArray(parsed?.lines) ? parsed.lines : [];
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    let rows: ExtractedRow[] = buildRowsFromStatementLines(statementLines);

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
