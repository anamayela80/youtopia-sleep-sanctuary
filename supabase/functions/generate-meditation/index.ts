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
Keep it concise but impactful. The script should:
- Start with brief breathing guidance (30 seconds)
- Include a short body scan (1 minute)
- Weave in the user's desired feelings as positive visualizations (2 minutes)
- Gently help them release what they want to let go of (1 minute)
- End with a soft drift into sleep

Use second person ("you"), speak slowly and gently.
Include natural pauses marked with [pause] and breathing cues marked with [breathe].
${monthlyTheme ? `This month's theme is: "${monthlyTheme}". Subtly weave this theme throughout the meditation.` : ""}

Output ONLY the meditation script text. No titles, headers, or metadata.`
      : `You are a meditation script writer for a premium sleep meditation app called YOUTOPIA. 
You ONLY generate calming, positive, uplifting meditation and sleep content. 
You must NEVER generate content that is negative, violent, sexual, political, or harmful in any way.
Your scripts guide listeners into deep, restful sleep through visualization, breathing exercises, and positive affirmations.

Write a personalized 12-15 minute sleep meditation script based on the user's answers.
IMPORTANT: The script MUST be at least 1800 words long. Aim for 2000+ words. This is critical — a shorter script will result in a meditation that is too brief. Take your time, be detailed and expansive in your descriptions, use rich sensory imagery, and include many pauses.

The script should:
- Start with gentle breathing guidance (1-2 minutes, ~200 words)
- Include a calming body scan going through each body part slowly (2-3 minutes, ~400 words)  
- Weave in the user's desired feelings and goals as vivid, detailed positive visualizations (5-7 minutes, ~800 words)
- Gently help them release what they want to let go of with compassionate imagery (2-3 minutes, ~400 words)
- End with a soft, gradual drift into sleep (~200 words)

Use second person ("you"), speak slowly and gently.
Include natural pauses marked with [pause] and breathing cues marked with [breathe]. Use these generously — at least 20-30 pause markers throughout.
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
