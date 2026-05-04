import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You generate NIGHTLY SEED AFFIRMATIONS for Youtopia.

Seeds are whispered affirmations delivered in the user's own voice as they fall asleep. They repeat throughout the night, planting beliefs at the subconscious level during sleep onset.

RULES FOR SEEDS
- Generate EXACTLY 5 Seeds. Never more, never fewer.
- Each Seed is ONE sentence. Maximum 12 words.
- Always first person ("I" / "me"). Present tense. Stated as already true.
- NEVER use any pronoun other than "I" and "me". No "you", "they", "she", "he", "we", "her", "his", "them", "us", "our".
- No gendered pronouns anywhere, not in the Seeds, not in framing.
- Specific enough to feel personal to this user's answers. General enough to stay true across 30 days.
- Must feel like the user's own inner voice, never imposed from outside.
- Grounded, not grandiose. ("I move through my days with quiet confidence", not "I am unstoppable and blessed.")
- No exclamation marks.
- NEVER use em dashes (—) or en dashes (–) anywhere. Use commas or periods instead.
- NEVER use these words: manifest, universe, blessed, worthy, enough, journey, sacred, divine, or any wellness cliché.
- NO NEGATIVES — EVER. The brain does not process "not." Write only what IS, never what isn't.
  Wrong: "I am no longer afraid" → Right: "I move forward with quiet courage."
  Wrong: "I don't hold back" → Right: "I act with full commitment."
  Wrong: "I am not stuck" → Right: "I am in motion."
- Every seed names a state that exists right now — arrived, active, present. Nothing desired, nothing releasing, nothing becoming. Already here.

MAPPING ANSWERS TO SEEDS
- Seeds 1-2: drawn from answer_1 (how they want to feel / what they want to experience)
- Seeds 3-4: drawn from answer_2 (their transformed vision of themselves)
- Seed 5: drawn from answer_3 (what they are releasing), REFRAMED as what is now true, not what they are letting go of

If a monthly_theme is provided, let it subtly tint the phrasing, never name the theme directly.

OUTPUT FORMAT, return EXACTLY this block and NOTHING ELSE. No introduction, no explanation, no commentary, no markdown.

[whisper][slow]
Seed one here.<break time="2s" />
Seed two here.<break time="2s" />
Seed three here.<break time="2s" />
Seed four here.<break time="2s" />
Seed five here.
[/slow][/whisper]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { question1, question2, question3, userName, monthlyTheme, themeIntention } = await req.json();

    if (!question1 || !question2 || !question3) {
      return new Response(JSON.stringify({ error: "All 3 answers are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userPrompt = `USER CONTEXT:
- user_name: ${userName || "(not provided)"}
- monthly_theme: ${monthlyTheme || "(none)"}
- theme_intro: ${themeIntention || "(none)"}
- answer_1 (how they want to feel every day): "${question1}"
- answer_2 (transformed self in 30 days): "${question2}"
- answer_3 (what they are releasing): "${question3}"

Generate their 5 Seeds now in the exact required format.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error("Failed to generate seeds");
    }

    const data = await response.json();
    const content: string = data.content?.[0]?.text || "";
    if (!content) throw new Error("No seeds generated");

    // Strip wrapper tags, then split on the break tags / newlines to extract 5 plain phrases.
    const inner = content
      .replace(/\[\/?whisper\]/gi, "")
      .replace(/\[\/?slow\]/gi, "");

    let phrases = inner
      .split(/<break[^>]*\/>|\n/i)
      .map((p) => p.replace(/<[^>]+>/g, "").trim())
      .filter((p) => p.length > 3);

    if (phrases.length < 5) {
      throw new Error("Could not parse 5 seed phrases from AI response");
    }

    // Language guardian pass — rewrite any phrases that still contain negatives.
    const guardianCheck = phrases.slice(0, 5).join("\n");
    const hasNegative = /\b(not|no |never|don't|doesn't|didn't|can't|cannot|won't|isn't|aren't|wasn't|weren't|without|no longer|nothing|nowhere|nobody)\b/i.test(guardianCheck);
    if (hasNegative) {
      const guardianResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: `You are a language guardian. Rewrite each affirmation so it contains zero negatives (no "not", "no", "never", "don't", "can't", "without", "no longer", etc.). The brain processes only what IS — state only what exists, never what doesn't. Keep first person, present tense, 12 words max per line. Output ONLY the 5 rewritten lines, one per line, nothing else.`,
          messages: [{ role: "user", content: guardianCheck }],
        }),
      });
      if (guardianResponse.ok) {
        const guardianData = await guardianResponse.json();
        const fixed = (guardianData.content?.[0]?.text || "").trim().split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 3);
        if (fixed.length >= 5) phrases = fixed;
      }
    }

    return new Response(JSON.stringify({
      phrases: phrases.slice(0, 5),
      formatted: content.trim(), // full ElevenLabs-formatted block for narration
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seeds error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
