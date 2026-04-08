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
    const { question1, question2, question3, userName, monthlyTheme, themeIntention } = await req.json();

    if (!question1 || !question2 || !question3) {
      return new Response(JSON.stringify({ error: "All 3 answers are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const nameRef = userName ? `, ${userName},` : "";

    const systemPrompt = `You are a meditation script writer for YOUTOPIA, a premium inner transformation app.
You ONLY generate calming, positive, uplifting content related to wellness, grounding, identity, and positive transformation.
You must NEVER generate content that is negative, violent, sexual, political, or harmful.

Write a morning meditation divided into EXACTLY 4 clearly labelled segments. Each segment will be narrated separately and interleaved with music bridges by the app.

FORMAT — Return EXACTLY this structure with these labels:

[SEGMENT 1: GROUNDING]
(~90 seconds of speech when read at a calm pace. Body awareness, breathing, arriving in the present moment. Use the user's name${nameRef ? '' : ' if provided'}. Reflect the monthly theme tone.)

[SEGMENT 2: INTENTION]
(~90 seconds. Personalized from the user's answer to "How do you want to feel." Reflect their desired feelings. Use their name.)

[SEGMENT 3: VISION AND MANIFESTATION]
(~90 seconds. Personalized from "What does your life look like in 90 days." Use present-tense language as if the vision is already unfolding. The user is not waiting — they are creating NOW from where they are. Include a manifestation angle.)

[SEGMENT 4: RELEASE AND CLOSE]
(~60 seconds. Personalized from "What are you ready to release." Closes the session gently and warmly.)

VOICE STYLE:
- Second person ("you")
- Calm, warm, unhurried
- Poetic but not wordy
- Include natural pauses via ellipses (...)
- Each segment should be ~250-400 words (total ~1100-1500 words across all 4)
${monthlyTheme ? `\nThis month's theme is: "${monthlyTheme}".${themeIntention ? ` Core intention: "${themeIntention}".` : ''} Weave this theme throughout all segments.` : ''}

Output ONLY the 4 segments with their labels. No additional commentary.`;

    const userPrompt = `${userName ? `My name is ${userName}.\n\n` : ''}Here are my answers:

1. How I want to feel every day: "${question1}"
2. My ideal life in 90 days: "${question2}"
3. What I am ready to release: "${question3}"

Please create my personalized morning meditation in 4 segments.`;

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate meditation script");
    }

    const data = await response.json();
    const fullScript = data.choices?.[0]?.message?.content;
    if (!fullScript) throw new Error("No script generated");

    // Parse the 4 segments
    const segmentRegex = /\[SEGMENT\s+(\d+):\s*([^\]]+)\]\s*([\s\S]*?)(?=\[SEGMENT\s+\d+:|$)/gi;
    const segments: { number: number; title: string; text: string }[] = [];
    let match;
    while ((match = segmentRegex.exec(fullScript)) !== null) {
      segments.push({
        number: parseInt(match[1]),
        title: match[2].trim(),
        text: match[3].trim(),
      });
    }

    if (segments.length < 4) {
      console.warn("Could not parse 4 segments, returning full script as single segment");
      return new Response(JSON.stringify({ 
        script: fullScript,
        segments: [{ number: 1, title: "Full Meditation", text: fullScript }],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ script: fullScript, segments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meditation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
