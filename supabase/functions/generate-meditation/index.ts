import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are writing a deeply personal guided meditation for a monthly transformation app called Youtopia. The meditation will be narrated by a warm, calm female voice and layered over sacred ambient music. It runs for approximately 20 to 22 minutes. Your script must be 800 to 900 words of spoken content. The remaining time is silence created by pause markers.

You have access to the following user information which you must weave naturally and specifically into the meditation: the user's name, their three onboarding answers describing their dream life, their current chapter theme, and the monthly relaxation technique assigned to this chapter.

The meditation has six sections. Follow this structure exactly.

Section 1 — Opening breath. Maximum 60 words. Three breathing cycles guiding the user to close their eyes and arrive. Simple, grounding, unhurried. Insert [pause 4s] after each breath instruction.

Section 2 — Central metaphor introduction. Maximum 80 words. Introduce the central metaphor for this month — a warm light, a tide, a forest path, or whatever technique is assigned. This metaphor must connect naturally to the chapter theme. It will thread through the entire meditation. Insert [pause 5s] after each image.

Section 3 — Personal gratitude and activation. Maximum 150 words. Using the user's onboarding answers, bring in specific people, places, feelings, and memories they mentioned. Make this intensely personal — use real names and real details from their answers. The central metaphor intensifies here, filling with their specific love and gratitude. Insert [pause 6s] after each personal reference.

Section 4 — Deepening induction. Maximum 150 words. Use the monthly relaxation technique assigned to this chapter. If it is the countdown, count from ten to zero with the central metaphor traveling through the body section by section. If it is a staircase, describe each step. If it is a tide, describe each wave. This section gives the mind a task while the body surrenders. Insert [pause 4s] after each count or step. Insert [long pause 8s] at the halfway point and at zero or the final step.

Section 5 — Vision sequence. Maximum 300 words. This is the heart of the meditation. Using the user's specific dream life details from their onboarding answers, guide them through their future reality as if it is already present. Use present tense throughout — not "imagine you will" but "you are here now". Include specific sensory details — sounds, temperatures, textures, smells. Include specific people they mentioned by name. Include specific places and activities they described. Each image must be one sentence only. Insert [vision pause 10s] after every single sentence without exception. Never put two images in one sentence. Use the words "notice", "sense", "feel", and "allow yourself to see" — use "imagine" a maximum of once.

Section 6 — Identity anchoring and return. Maximum 160 words. First anchor the vision as present reality — "this is already who you are". Then gently return awareness to the physical body — fingers, hands, feet, breath. Then close with 2 to 3 empowering sentences that send the user into their day from this new identity. The closing must never say the meditation is ending. It must say this feeling continues. Insert [pause 6s] after each anchoring statement. Insert [long pause 15s] before the physical return begins.

Formatting rules that must be followed without exception. Insert [pause 4s] after every breath instruction. Insert [vision pause 10s] after every visualization sentence. Insert [long pause 8s] between major sections. Insert [affirm pause 6s] after every identity statement. Never write more than two sentences without a pause marker. The script must feel almost uncomfortably sparse on the page — that spaciousness is intentional. The silence is where the transformation happens.

Tone rules. Warm, intimate, and unhurried. Speak directly to the user by name at least four times throughout the script. Never use the words "just", "simply", "try", or "attempt". Never use future tense in the vision section — everything is present tense. Never end with a generic wellness closing. End with something that feels like a personal promise from one human to another.

OUTPUT
Plain text with bracket pause markers only — no SSML, no headers, no explanations. Begin directly with the first word of Section 1.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userName, monthlyTheme, themeIntention, previousTheme, practice } = body;

    let answers: string[] = Array.isArray(body.answers)
      ? body.answers.filter((a: any) => typeof a === "string")
      : [];
    if (answers.length === 0) {
      answers = [body.question1, body.question2, body.question3].filter(
        (a) => typeof a === "string" && a.trim()
      );
    }

    if (answers.length < 1) {
      return new Response(JSON.stringify({ error: "At least one intake answer is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const answerLines = answers.map((a, i) => `- onboarding_answer_${i + 1}: "${a}"`).join("\n");

    const userPrompt = `USER CONTEXT
- user_name: ${userName || "(not provided)"}
- chapter_theme: ${monthlyTheme || "(none)"}
- chapter_intro: ${themeIntention || "(none)"}
- monthly_relaxation_technique: ${practice || "a slow countdown from ten to zero with the central metaphor traveling through the body"}
- previous_theme: ${previousTheme || "(none)"}
${answerLines}

Write the meditation script now. 800–900 spoken words. Use the bracket pause markers exactly as specified. Output only the script.`;

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
    const fullScript: string = data.content?.[0]?.text;
    if (!fullScript) throw new Error("No script generated");

    const segments = [{ number: 1, title: "Morning Meditation", text: fullScript.trim() }];

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
