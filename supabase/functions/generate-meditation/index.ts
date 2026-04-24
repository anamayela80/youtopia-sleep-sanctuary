import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Youtopia meditation generator.
 *
 * Writes a deeply structured, neuroscience-informed meditation script that
 * takes the listener through a fixed 8-section arc:
 *   1. Arrival
 *   2. Release
 *   3. Body settling
 *   4. Heart coherence (elevated emotion BEFORE vision)
 *   5. Space of nowhere (formless awareness — the structural change point)
 *   6. Becoming (embodied future-state using the user's own answers)
 *   7. Anchor
 *   8. Return
 *
 * Tenure-aware length:
 *   orienting   (month 1)   → ~800 words  / ~20 min session
 *   settling    (months 2-4) → ~1100 words / ~28 min session
 *   established (month 5+)   → ~1500 words / ~38 min session
 *
 * Monthly variation:
 *   openingDevice, lightMetaphor, and coherenceEmotion rotate by the user's
 *   monthNumber so the structure feels fresh each cycle even when the
 *   underlying theme repeats.
 */

// --- Variation pools (rotate by monthNumber) -------------------------------

const OPENING_DEVICES = [
  "Guide three unhurried breaths. On each exhale, say the weight of the body is finding the surface beneath it.",
  "Bring attention to the feet first, then the seat, then the shoulders — each one landing.",
  "Notice the pull of gravity — something in the body is already letting go. Name that.",
  "Describe the morning light (or the dark) on the skin. Let the user notice one tactile thing in the room.",
  "Describe a threshold — a doorway between the day and this practice. The user has already stepped across it.",
];

const LIGHT_METAPHORS = [
  "a warm light low in the chest",
  "a slow tide moving through the body",
  "an open horizon just past the breath",
  "an inner sun that is already lit",
  "a still lake behind the eyes",
  "a quiet river at the base of the spine",
  "a morning field after rain",
  "soft rain on warm skin",
  "rising warmth at the heart",
  "a single steady star",
  "an ember that won't go out",
  "a clearing in a forest, just past the trees",
];

const COHERENCE_EMOTIONS = ["gratitude", "love", "peace", "awe", "trust"];

const PRESENCE_ANCHORS = [
  "Remember.",
  "Feel it.",
  "Breathe.",
  "Stay with this.",
  "This is real.",
  "You're here.",
];

// --- Tenure-based length bands --------------------------------------------

type Tenure = "orienting" | "settling" | "established";

const LENGTH_BANDS: Record<Tenure, {
  totalWords: string;
  sectionWords: Record<string, string>;
  extraDepth: string;
}> = {
  orienting: {
    totalWords: "780 to 860",
    sectionWords: {
      arrival: "40-55",
      release: "60-80",
      body: "55-75",
      coherence: "100-130",
      nowhere: "60-85",
      becoming: "260-310",
      anchor: "60-80",
      return: "50-70",
    },
    extraDepth:
      "Keep the Space of Nowhere short but spacious. Becoming is the heart of the session — give it the most words.",
  },
  settling: {
    totalWords: "1050 to 1150",
    sectionWords: {
      arrival: "50-70",
      release: "80-110",
      body: "75-100",
      coherence: "150-190",
      nowhere: "110-150",
      becoming: "330-400",
      anchor: "90-120",
      return: "70-100",
    },
    extraDepth:
      "In Heart Coherence, add one sub-beat where the user generates the emotion twice — once for themselves, once for someone they love. In Space of Nowhere, extend the dissolution — more declarative single-phrase lines with [long pause 12s] between them.",
  },
  established: {
    totalWords: "1440 to 1570",
    sectionWords: {
      arrival: "60-85",
      release: "100-140",
      body: "100-130",
      coherence: "200-260",
      nowhere: "180-230",
      becoming: "480-560",
      anchor: "130-170",
      return: "90-120",
    },
    extraDepth:
      "Add a Second Descent after Heart Coherence: a brief body scan (~60 words) that returns attention to the breath before Space of Nowhere. In Becoming, include at least two sensory-rich rehearsal passages — one focused on being, one focused on doing. In Anchor, include one sentence that explicitly names the biological change ('your body is already learning to be this person').",
  },
};

// --- System prompt builder ------------------------------------------------

function buildSystemPrompt(tenure: Tenure, monthNumber: number): string {
  const band = LENGTH_BANDS[tenure];

  // Deterministic monthly rotation
  const openingDevice = OPENING_DEVICES[(monthNumber - 1) % OPENING_DEVICES.length];
  const lightMetaphor = LIGHT_METAPHORS[(monthNumber - 1) % LIGHT_METAPHORS.length];
  const coherenceEmotion = COHERENCE_EMOTIONS[(monthNumber - 1) % COHERENCE_EMOTIONS.length];

  const sw = band.sectionWords;

  return `You are writing a deeply personal, neuroscience-informed guided meditation for the Youtopia app. The meditation will be narrated by a warm, slow, intimate female voice over ambient music. Your script must be ${band.totalWords} words of spoken content. The remaining session time is silence created by pause markers — the silence is where the rewiring happens.

GROUND RULES FOR LANGUAGE
Use accessible, nervous-system-grounded language. Your job is to help the user descend into the frequency of dreaming — the state where the body quiets, the thinking mind softens, and new patterns can actually settle in.

YOU MAY USE: breath, heart rhythm, nervous system, attention, awareness, neural pathways, chemistry, energy centers, the field of what's possible, the space where everything is still open, the place between thought and dream, the frequency of dreaming, the new you, becoming, rest, receive.

DO NOT USE: pineal gland, chakras, quantum field, unified field, higher self, astral, spiritual entities, timeline jumping, frequency matching, ascension. Never reference specific scientific studies or neuroscientists by name.

METAPHOR POLICY
Metaphor is a grounding device, not a journey. Do NOT take the user on imagined walks through forests, rivers, beaches, or gardens. The meditation is a descent into formless awareness and an emergence into the user's own real life.

The single monthly light metaphor for THIS session is: "${lightMetaphor}". Reference this once in Release and once in Anchor — no more. Every other image must either be (a) an abstract sensory description (warmth, weight, light, sound) or (b) a specific detail from the user's own onboarding answers.

THE 8-SECTION STRUCTURE — follow exactly

SECTION 1 — Arrival (${sw.arrival} words)
The device for this month: ${openingDevice}
Insert [pause 4s] after each breath instruction. Keep it concrete and body-centered. No metaphor yet.

SECTION 2 — Release (${sw.release} words)
Guide the user to let go of the day, the known self, what the mind is still holding. The autonomic nervous system is downshifting. This is the only section in the first half where the monthly light metaphor may be gently named ("${lightMetaphor}"). Insert [pause 5s] after each release instruction. Insert [long pause 8s] at the end of this section.

SECTION 3 — Body settling (${sw.body} words)
Attention moves through the body — jaw, throat, chest, belly, pelvis, legs, feet. The nervous system is quieting further. No metaphor. Short declarative sentences. Insert [pause 5s] between body regions. End with [long pause 10s].

SECTION 4 — Heart coherence (${sw.coherence} words)
This is the hinge of the meditation. Bring attention to the center of the chest. The user generates the feeling of ${coherenceEmotion} BEFORE any vision arrives — the elevated emotion precedes the image, not the other way around. Guide them to breathe the feeling through the chest, to let it warm outward. Do NOT name anything they will visualize yet. Insert [pause 6s] between beats. End with [long pause 12s].

SECTION 5 — Space of nowhere (${sw.nowhere} words)
THIS IS WHERE THE STRUCTURE CHANGES. The user dissolves into awareness without edges. No body, no name, no story, no time. Pure witness. Pure space.
Use short, declarative, single-sentence lines — almost one per pause. Examples of the TONE (do not quote these directly, write your own in this register): "No shape." "No one holding on." "The you that existed before any thought."
Insert [long pause 12s] between each line. Drop one PRESENCE ANCHOR on its own line here — either "You're here." or "Stay with this." — followed by [long pause 15s]. Do NOT use any metaphor in this section. Do NOT reference the body by name.

SECTION 6 — Becoming (${sw.becoming} words)
This is the heart. Using the user's specific dream life details from their onboarding answers, guide them into their future reality as if it is already present. Use present tense throughout — not "imagine you will" but "you are here now", "you are the one who".
Include specific sensory details, real names from their answers, real places, real activities they described. Each image should be one sentence, followed by [vision pause 10s]. Use the words "notice", "sense", "feel", and "allow yourself to see" — use "imagine" at most once.
Drop PRESENCE ANCHORS into this section 2-3 times — standalone lines reading "Remember." or "Feel it." or "This is real." — each surrounded by [long pause 12s] on either side. These are the most important beats of the whole meditation.
Toward the end of this section, include one sentence that names the biological reality of what is happening ("your body is already learning to be this person" or equivalent — in your own words).

SECTION 7 — Anchor (${sw.anchor} words)
The new identity consolidates. "This is already who you are" — in your own words. The monthly light metaphor ("${lightMetaphor}") may return here one final time to close the loop from Release. Insert [affirm pause 6s] after each anchoring statement. Drop one final PRESENCE ANCHOR here — "Remember." on its own line with [long pause 15s] after.

SECTION 8 — Return (${sw.return} words)
Gently bring awareness back to physical body — fingers, hands, feet, breath. Close with 2-3 empowering sentences that send the user into their day from this new identity. Do NOT say the meditation is ending. Say this feeling continues. Insert [pause 6s] between beats.

${band.extraDepth}

PRESENCE ANCHORS — how to use
The phrases "Remember.", "Feel it.", "Breathe.", "Stay with this.", "This is real.", "You're here." are sacred beats. Each one appears on its OWN LINE, ALONE, surrounded by [long pause] markers. Never string them together. Never put them inside a sentence. They only appear in sections 5, 6, and 7, and no more than 5 times total across the whole meditation.

FORMATTING RULES (follow without exception)
- Insert [pause 4s] after every breath instruction
- Insert [vision pause 10s] after every visualization sentence in Section 6
- Insert [long pause 12s] between each line in Section 5
- Insert [long pause 8-15s] between major sections
- Insert [affirm pause 6s] after every identity statement
- Never write more than two sentences without a pause marker
- The script should feel almost uncomfortably sparse on the page — that spaciousness is intentional

TONE RULES
Warm, intimate, unhurried. Address the user by name at least four times across the script. Never use the words "just", "simply", "try", or "attempt". Vision section is always present tense. Never end with a generic wellness closing.

ANTI-HALLUCINATION RULES (critical)
- You may ONLY reference people, places, activities, and details that appear verbatim in the user's onboarding answers. Do not invent names, family members, friends, cities, or events.
- If the answers don't mention a specific person, don't introduce one. Use abstract sensory description (warmth, light, breath, sound) instead.
- Stay strictly within the 8-section structure and the ${band.totalWords} word limit. Do not append extra paragraphs after Section 8.

OUTPUT
Plain text with bracket pause markers and standalone PRESENCE ANCHOR lines only — no SSML, no <speak>, no <break>, no headers, no section labels, no explanations. Begin directly with the first word of Section 1 and stop immediately after the final word of Section 8.`;
}

// --- Segment splitter -----------------------------------------------------

/**
 * Split the 8-section script into 4 audio segments for the mixer.
 *
 *   Segment 1 = Arrival + Release + Body settling (sections 1-3)
 *   Segment 2 = Heart coherence (section 4)
 *   Segment 3 = Space of nowhere + Becoming (sections 5-6) — the deep work
 *   Segment 4 = Anchor + Return (sections 7-8)
 *
 * The mixer inserts ~135-210s of music-only between segments so each beat
 * can land before the next begins.
 */
function splitIntoSegments(text: string): string[] {
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    // Fallback: split by sentences into 4 rough chunks
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const per = Math.ceil(sentences.length / 4);
    return [
      sentences.slice(0, per).join(" "),
      sentences.slice(per, per * 2).join(" "),
      sentences.slice(per * 2, per * 3).join(" "),
      sentences.slice(per * 3).join(" "),
    ].filter((s) => s.trim().length > 0);
  }

  // Group paragraphs into 4 segments by approximate length.
  // We weight segment 3 (Space of nowhere + Becoming) to receive the most
  // content since it carries sections 5-6 which are the largest.
  const totalLen = paras.reduce((s, p) => s + p.length, 0);
  const weights = [0.20, 0.15, 0.45, 0.20];
  const targets = weights.map((w) => w * totalLen);

  const groups: string[][] = [[], [], [], []];
  let groupIdx = 0;
  let runningLen = 0;
  let accumulatedTarget = 0;

  for (const p of paras) {
    groups[groupIdx].push(p);
    runningLen += p.length;
    accumulatedTarget = targets.slice(0, groupIdx + 1).reduce((s, t) => s + t, 0);
    if (runningLen >= accumulatedTarget && groupIdx < 3) {
      groupIdx++;
    }
  }
  return groups.filter((g) => g.length > 0).map((g) => g.join("\n\n"));
}

// --- Entry point ---------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      userName,
      monthlyTheme,
      themeIntention,
      previousTheme,
      practice,
      tenureBand,
      monthNumber,
    } = body;

    let answers: string[] = Array.isArray(body.answers)
      ? body.answers.filter((a: any) => typeof a === "string")
      : [];
    if (answers.length === 0) {
      answers = [body.question1, body.question2, body.question3].filter(
        (a) => typeof a === "string" && a.trim(),
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

    const tenure: Tenure =
      tenureBand === "settling" || tenureBand === "established" ? tenureBand : "orienting";
    const monthNum =
      typeof monthNumber === "number" && monthNumber > 0 ? Math.floor(monthNumber) : 1;

    const systemPrompt = buildSystemPrompt(tenure, monthNum);
    const answerLines = answers.map((a, i) => `- onboarding_answer_${i + 1}: "${a}"`).join("\n");

    const userPrompt = `USER CONTEXT
- user_name: ${userName || "(not provided)"}
- chapter_theme: ${monthlyTheme || "(none)"}
- chapter_intro: ${themeIntention || "(none)"}
- previous_theme: ${previousTheme || "(none)"}
- monthly_relaxation_technique: ${practice || "(none — use the 8-section structure as defined)"}
- tenure_band: ${tenure}
- month_number: ${monthNum}
${answerLines}

Write the meditation script now. Follow the 8-section structure exactly. Use the bracket pause markers and PRESENCE ANCHOR lines as specified. Output only the script.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error("Failed to generate meditation script");
    }

    const data = await response.json();
    const fullScript: string = data.content?.[0]?.text;
    if (!fullScript) throw new Error("No script generated");

    const segmentTexts = splitIntoSegments(fullScript.trim());
    const titles = ["Arrival", "Coherence", "Becoming", "Return"];
    const segments = segmentTexts.map((text, i) => ({
      number: i + 1,
      title: titles[i] || `Segment ${i + 1}`,
      text,
    }));

    return new Response(JSON.stringify({ script: fullScript, segments }), {
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
