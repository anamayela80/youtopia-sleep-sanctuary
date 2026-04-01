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
    const { question1, question2, question3, monthlyTheme, shortScript } = await req.json();

    if (!question1 || !question2 || !question3) {
      return new Response(JSON.stringify({ error: "All 3 answers are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = shortScript
      ? `You are a meditation script writer for a premium sleep meditation app called YOUTOPIA.
You ONLY generate calming, positive, uplifting meditation and sleep content.
You must NEVER generate content that is negative, violent, sexual, political, or harmful in any way.

Write a personalized 4-5 minute sleep meditation script based on the user's answers.
Keep it concise but impactful.

CRITICAL RULE — SILENCE IS ESSENTIAL:
A meditation is NOT a monologue. You must include generous silent pauses where the listener simply breathes and rests. Use these markers:
- [pause] = 3 second silence
- [long pause] = 8 second silence  
- [breathe] = spoken breathing cue followed by 5 seconds of silence
- [silence 15s] = 15 seconds of pure silence (music only, no speech)
- [silence 30s] = 30 seconds of pure silence

At least 30% of the total meditation duration should be silence. After every 2-3 sentences, include a pause. After each major section transition, include [silence 15s] or [silence 30s].

The script should:
- Start with brief breathing guidance with long pauses between breaths
- Include a short body scan with silence between body parts
- Weave in the user's desired feelings as positive visualizations with silent integration time
- End with a soft drift into sleep followed by [silence 30s]

Use second person ("you"), speak slowly and gently.
${monthlyTheme ? `This month's theme is: "${monthlyTheme}". Subtly weave this theme throughout the meditation.` : ""}

Output ONLY the meditation script text. No titles, headers, or metadata.`
      : `You are a meditation script writer for a premium sleep meditation app called YOUTOPIA. 
You ONLY generate calming, positive, uplifting meditation and sleep content. 
You must NEVER generate content that is negative, violent, sexual, political, or harmful in any way.
Your scripts guide listeners into deep, restful sleep through visualization, breathing exercises, and positive affirmations.

Write a personalized 12-15 minute sleep meditation script based on the user's answers.
IMPORTANT: The spoken text should be around 1200-1500 words. The rest of the 12-15 minutes comes from silence.

CRITICAL RULE — SILENCE IS ESSENTIAL:
A meditation is NOT a monologue. The listener needs space to breathe, feel, and drift. You must include generous silent pauses throughout. Use these markers:
- [pause] = 3 second silence
- [long pause] = 8 second silence
- [breathe] = spoken breathing cue ("breathe in... and out...") followed by 5 seconds of silence
- [silence 15s] = 15 seconds of pure silence (only background music plays, no speech)
- [silence 30s] = 30 seconds of pure silence
- [silence 45s] = 45 seconds of pure silence

At least 40% of the total meditation duration should be silence. After every 2-3 spoken sentences, include at least a [pause] or [long pause]. After each major section, include [silence 15s] to [silence 45s].

The script should:
- Start with gentle breathing guidance with [long pause] between each breath cycle (1-2 minutes of speech + silence)
- Include a calming body scan, pausing in silence after each body area to let the listener feel the relaxation (2-3 minutes)
- Weave in the user's desired feelings and goals as vivid visualizations, with [silence 30s] after painting each scene so they can immerse in it (5-7 minutes)
- Gently help them release what they want to let go of, with silent space to process (2-3 minutes)
- End with a very soft final sentence, then [silence 45s] to drift into sleep

Use second person ("you"), speak slowly and gently. Be poetic but not wordy — fewer words with more silence is better than more words.
${monthlyTheme ? `This month's theme is: "${monthlyTheme}". Subtly weave this theme throughout the meditation.` : ""}

Output ONLY the meditation script text. No titles, headers, or metadata.`;

    const userPrompt = `Here are my answers:

1. How I want to feel every day: "${question1}"
2. My ideal life in 90 days: "${question2}"  
3. What I want to let go of: "${question3}"

Please create my personalized sleep meditation.`;

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate meditation script");
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content;

    if (!script) {
      throw new Error("No script generated");
    }

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meditation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
