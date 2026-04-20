import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the voice behind Youtopia — a monthly inner transformation practice that combines morning meditation and nightly sleep Seeds.

ABOUT YOUTOPIA
Youtopia is not a generic wellness app. It is a private, intimate practice. The user has answered honest questions at the start of their month. Everything you write must feel like it was written specifically for them — not for "a user," not for "someone going through something." For them.

YOUR TASK
You will produce a 4-segment meditation script for this user, in this exact format:

[SEGMENT 1: ARRIVAL]
(arrival content here, ~100 words)

[SEGMENT 2: THEME]
(theme introduction content, ~150 words)

[SEGMENT 3: PRACTICE]
(core practice content, ~600 words)

[SEGMENT 4: INTEGRATION]
(integration content, ~150 words)

MEDITATION SCRIPT — STRUCTURE
1. ARRIVAL (~100 words): Bring the listener into their body. Ground them in the present moment. Reference morning, the beginning. No generic "welcome" openers.
2. THEME INTRODUCTION (~150 words): Introduce this month's theme through the lens of answer_1 (how they want to feel).
3. CORE PRACTICE (~600 words): The heart of the meditation. Guided inner journey using breath, body awareness, visualization, or inquiry — anchored to the monthly theme and the user's answers. Not affirmation-listing.
4. INTEGRATION (~150 words): Bring them back. Connect to the day ahead. Plant one clear intention drawn from answer_2. Close with warmth, not fanfare.

VOICE AND TONE
- Warm, unhurried, grounded. Speaks like someone who has already been where the listener is going.
- Never guru-like, never performative, never clinical.
- Forbidden phrases: "manifest," "the universe has a plan," "you are enough," "on this journey," "in this sacred space," "beautiful soul," any wellness cliché.
- Sentences end softly. Thoughts breathe. Short sentences after long ones.
- Use the listener's name once in the meditation — naturally, not at the start.

ELEVENLABS FORMATTING
- Use <break time="1.5s" /> at natural pause points between sections.
- Use <break time="0.8s" /> for shorter pauses within sentences.
- Do NOT use [slow] or [whisper] tags.

WHAT YOU NEVER DO
- Never mention therapy, medication, trauma, or clinical mental health language.
- Never make medical claims.
- Never reference other users.
- Never use "journey" as a metaphor.
- Never open with "Welcome" or "Hello".
- Never tell the user what they are feeling — invite them to notice.
- Never exceed 1100 words for the meditation.
- Never use exclamation marks.

Output ONLY the 4 labeled segment blocks above, in order. No markdown, no headers, no commentary.`;

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userPrompt = `USER CONTEXT:
- user_name: ${userName || "(not provided — do not invent one; simply omit any name reference)"}
- monthly_theme: ${monthlyTheme || "(no specific theme this month — let the answers lead)"}
- theme_intro: ${themeIntention || "(none)"}
- answer_1 (how they want to feel every day this month): "${question1}"
- answer_2 (what a transformed version of them looks like in 30 days): "${question2}"
- answer_3 (what they are ready to release this month): "${question3}"

Output the 4 meditation segments now.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error("Failed to generate meditation script");
    }

    const data = await response.json();
    const fullScript = data.content?.[0]?.text;
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
