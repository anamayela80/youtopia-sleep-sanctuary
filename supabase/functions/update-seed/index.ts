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
    const { checkinAnswer, existingSeeds, monthlyTheme, themeIntention } = await req.json();

    if (!checkinAnswer || !existingSeeds || existingSeeds.length < 5) {
      return new Response(JSON.stringify({ error: "Check-in answer and existing seeds are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You are a seed phrase writer for YOUTOPIA.
Generate ONE new seed phrase that reflects and supports the user's check-in response, matching the tone and style of their existing seeds.

Rules:
- 8 to 14 words
- First person, present tense
- Identity-based, calm, grounded
- Must positively reflect the user's check-in answer
${monthlyTheme ? `Monthly theme: "${monthlyTheme}".${themeIntention ? ` Intention: "${themeIntention}".` : ''}` : ''}

Return ONLY the single phrase, no quotes, no numbering.`;

    const userPrompt = `My existing seeds:
1. ${existingSeeds[0]}
2. ${existingSeeds[1]}
3. ${existingSeeds[2]}
4. ${existingSeeds[3]}
5. ${existingSeeds[4]}

My check-in answer: "${checkinAnswer}"`;

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

    if (!response.ok) throw new Error("Failed to generate updated seed");

    const data = await response.json();
    const newPhrase = data.choices?.[0]?.message?.content?.trim().replace(/^[""]|[""]$/g, "");

    if (!newPhrase) throw new Error("No phrase generated");

    return new Response(JSON.stringify({ phrase: newPhrase }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-seed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
