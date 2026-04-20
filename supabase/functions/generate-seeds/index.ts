import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the voice behind Youtopia — a monthly inner transformation practice. Your task right now: generate this user's nightly Seed affirmations.

ABOUT SEEDS
Seeds are whispered affirmations delivered as the user falls asleep. They repeat throughout the night. They plant beliefs at the subconscious level during sleep onset. They must feel like the user's own inner voice — not something imposed from outside.

RULES FOR SEEDS
- Generate EXACTLY 5 Seeds. Never more, never fewer.
- Each Seed is ONE sentence. Maximum 12 words.
- Present tense. First person. Stated as already true.
- Specific enough to feel personal. General enough to stay true across 30 days.
- Grounded, not grandiose. ("I move through my days with quiet confidence" — not "I am unstoppable and blessed.")
- No exclamation marks. No wellness clichés ("manifest," "blessed," "abundance flows," "the universe").
- Never use the word "journey" as a metaphor.

MAPPING ANSWERS TO SEEDS
- Seeds 1–2: drawn from answer_1 (how they want to feel every day)
- Seeds 3–4: drawn from answer_2 (their transformed-self vision in 30 days)
- Seed 5: drawn from answer_3 (what they are releasing) — REFRAMED as what is now true, not what they are letting go of

If a monthly_theme is provided, let it subtly tint the phrasing — never name the theme directly.

OUTPUT FORMAT — return EXACTLY this block and NOTHING ELSE. No introduction, no explanation, no markdown.

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

    const phrases = inner
      .split(/<break[^>]*\/>|\n/i)
      .map((p) => p.replace(/<[^>]+>/g, "").trim())
      .filter((p) => p.length > 3);

    if (phrases.length < 5) {
      throw new Error("Could not parse 5 seed phrases from AI response");
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
