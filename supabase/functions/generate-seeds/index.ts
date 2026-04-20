import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question1, question2, question3, monthlyTheme, themeIntention } = await req.json();

    if (!question1 || !question2 || !question3) {
      return new Response(JSON.stringify({ error: "All 3 answers are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You are a seed phrase writer for YOUTOPIA, a premium inner transformation app.
Seeds are short identity-based statements designed to be whispered as the listener drifts into sleep. They plant positive intentions in the subconscious.

Generate EXACTLY 5 seed phrases based on the user's answers and the monthly theme.

STYLE GUIDELINES:
- Each seed is 8 to 14 words
- First person, present tense
- Identity-based, not instructional
- Calm and grounded, not exaggerated
- No exclamation marks

CORRECT examples:
"I build beautiful things from a place of deep stillness."
"My body knows how to rest and I trust its wisdom."
"I am already becoming the person I dream of being."

INCORRECT examples:
"You should try to feel calm today." (wrong person, instructional)
"I AM THE MOST POWERFUL BEING IN THE UNIVERSE!" (exaggerated)

${monthlyTheme ? `This month's theme is: "${monthlyTheme}".${themeIntention ? ` Core intention: "${themeIntention}".` : ''} Let the theme subtly influence the seed phrasing.` : ''}

Return ONLY the 5 phrases, one per line, numbered 1-5. No other text.`;

    const userPrompt = `My answers:
1. How I want to feel: "${question1}"
2. My life in 90 days: "${question2}"
3. What I release: "${question3}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate seeds");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No seeds generated");

    // Parse numbered lines
    const phrases = content
      .split("\n")
      .map((line: string) => line.replace(/^\d+[\.\)]\s*/, "").replace(/^[""]|[""]$/g, "").trim())
      .filter((line: string) => line.length > 5);

    if (phrases.length < 5) {
      throw new Error("Could not parse 5 seed phrases from AI response");
    }

    return new Response(JSON.stringify({ phrases: phrases.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seeds error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
