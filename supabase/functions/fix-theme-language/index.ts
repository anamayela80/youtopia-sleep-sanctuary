import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GUARDIAN_SYSTEM = `You are a language guardian for a mindfulness app. Your only job is to rewrite any negative language constructions so every statement names only what IS, never what isn't.

Rules:
- "not because X, but because Y" → just write Y
- "not X" adjective pairs → positive equivalents ("not loud, not urgent" → "quiet, settled")
- "nothing missing" → "complete"
- "no need to" → rephrase positively or remove
- "not running out of time" → "moving at the right pace"
- "don't / doesn't / didn't / can't / cannot / won't / isn't / aren't / wasn't / weren't" → rewrite positively
- "without X" → rewrite to state what IS present
- "no longer X" → state the positive current state
- "never X" → state what always IS
- Keep all other text identical — only fix negative constructions
- Keep questions as questions
- Preserve question marks, paragraph breaks, and sentence structure
- If a sentence has no negative construction, leave it exactly as-is

Output ONLY the corrected text. No explanation, no commentary.`;

async function fixText(text: string, apiKey: string): Promise<string> {
  const hasNegative = /\b(not|no |never|don't|doesn't|didn't|can't|cannot|won't|isn't|aren't|wasn't|weren't|without|no longer|nothing|nowhere|nobody)\b/i.test(text);
  if (!hasNegative) return text;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: GUARDIAN_SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!response.ok) return text; // fail safe — return original on error
  const data = await response.json();
  return data.content?.[0]?.text?.trim() || text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin-only: verify the requesting user has an admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Load all themes
    const { data: themes, error: loadError } = await serviceClient
      .from("monthly_themes")
      .select("id, theme, description, intention, intro_orienting, intro_settling, intro_established, about, science, practice, questions, checkin_question, checkin_question_2");

    if (loadError) throw loadError;
    if (!themes || themes.length === 0) {
      return new Response(JSON.stringify({ fixed: 0, message: "No themes found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixedCount = 0;
    const results: { id: string; theme: string; fieldsFixed: string[] }[] = [];

    for (const t of themes) {
      const patch: Record<string, any> = {};
      const fieldsFixed: string[] = [];

      // Text fields to check and fix
      const textFields = [
        "description", "intention", "intro_orienting", "intro_settling",
        "intro_established", "about", "science", "practice",
        "checkin_question", "checkin_question_2",
      ] as const;

      for (const field of textFields) {
        const original = t[field as keyof typeof t];
        if (!original || typeof original !== "string") continue;
        const fixed = await fixText(original, ANTHROPIC_API_KEY);
        if (fixed !== original) {
          patch[field] = fixed;
          fieldsFixed.push(field);
        }
      }

      // Questions: each question has label, text, placeholder — all text
      if (t.questions) {
        let qs: any[] = [];
        try {
          qs = typeof t.questions === "string" ? JSON.parse(t.questions) : t.questions;
        } catch {}

        if (Array.isArray(qs) && qs.length > 0) {
          let questionsChanged = false;
          const fixedQs = await Promise.all(
            qs.map(async (q: any) => {
              if (typeof q === "string") {
                const fixed = await fixText(q, ANTHROPIC_API_KEY);
                if (fixed !== q) questionsChanged = true;
                return fixed;
              }
              const fixedLabel = q.label ? await fixText(q.label, ANTHROPIC_API_KEY) : q.label;
              const fixedText = q.text ? await fixText(q.text, ANTHROPIC_API_KEY) : q.text;
              const fixedPlaceholder = q.placeholder ? await fixText(q.placeholder, ANTHROPIC_API_KEY) : q.placeholder;
              if (fixedLabel !== q.label || fixedText !== q.text || fixedPlaceholder !== q.placeholder) {
                questionsChanged = true;
              }
              return { ...q, label: fixedLabel, text: fixedText, placeholder: fixedPlaceholder };
            })
          );
          if (questionsChanged) {
            patch.questions = fixedQs;
            fieldsFixed.push("questions");
          }
        }
      }

      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await serviceClient
          .from("monthly_themes")
          .update(patch)
          .eq("id", t.id);
        if (!updateError) {
          fixedCount++;
          results.push({ id: t.id, theme: t.theme || t.id, fieldsFixed });
        } else {
          console.error(`Failed to update theme ${t.id}:`, updateError);
        }
      }
    }

    return new Response(JSON.stringify({
      fixed: fixedCount,
      total: themes.length,
      results,
      message: fixedCount === 0
        ? "All theme copy is already positive. No changes needed."
        : `Fixed negative language in ${fixedCount} of ${themes.length} themes.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("fix-theme-language error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
