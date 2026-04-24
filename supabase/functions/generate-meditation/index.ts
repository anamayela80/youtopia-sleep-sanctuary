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

  return `You are writing a neuroscience-informed guided meditation for the Youtopia app. It will be narrated by a warm, intimate voice over ambient music.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE OUTPUT RULES — violating any of these makes the output unusable
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PLAIN TEXT ONLY. No markdown, no headers, no labels, no section titles, no asterisks, no bullet points.
2. NO VOICE DELIVERY TAGS. Never write [softly], [slow], [warm], [intimate], [drawn out], [whisper], or any similar bracketed delivery instruction. These are added by the audio system — if you include them they will be read aloud and ruin the recording.
3. PAUSE MARKERS ONLY. The only bracket content allowed: [pause Xs], [long pause Xs], [vision pause 10s], [affirm pause 6s] — where X is a number.
4. PRESENCE ANCHORS on their own line only — never inside a sentence.
5. NO REPEATED PASSAGES. Each technique, image, or structural device appears exactly once.
6. DO NOT label sections. Output flows as continuous narration.
7. Begin with the first spoken word. End immediately after the last word of Section 8. No preamble, no sign-off.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOU MAY USE: breath, heart rhythm, nervous system, attention, awareness, neural pathways, energy centers, the field of what's possible, frequency of dreaming, the new you, becoming, rest, receive.

NEVER USE: pineal gland, chakras, quantum, unified field, higher self, astral, timeline jumping, motivational phrases like "you deserve this", "you are worthy". No named scientists or studies.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METAPHOR RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do NOT take the user on a guided journey through nature (no forests, rivers, beaches, gardens, meadows). The meditation descends into formlessness and emerges into the user's felt identity — not a movie of their life.

The ONLY metaphor allowed is this month's: "${lightMetaphor}". Use it ONCE in Section 2 and ONCE in Section 7. Nowhere else.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CRITICAL DISTINCTION — this is what makes Youtopia different
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Most meditation apps describe the future TO the user ("your partner is there, breakfast is made, you feel successful"). This is a motivational speech, not neuroplastic change.

Youtopia does the opposite:
  STEP 1 — Build the ELEVATED EMOTION first, from nothing, before any vision.
  STEP 2 — Take the user into formless awareness (no body, no time, no identity).
  STEP 3 — From that space, let them FEEL who they already are becoming — not what they will have, but WHO they are.
  STEP 4 — Brief, felt sensory anchors to their real life details — one breath, one texture, one knowing — not a scene description.

The Becoming section is NOT a movie. It is a felt identity. The user is not watching their future — they ARE it. The difference is: "sense the particular ease in your chest of someone who is no longer afraid" NOT "you are sitting at the breakfast table and your partner hands you coffee."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8-SECTION STRUCTURE — write all 8 in sequence, no skipping
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — Arrival (${sw.arrival} words)
${openingDevice}
Concrete, body-centered. No metaphor. [pause 4s] after each breath or body instruction.

SECTION 2 — Release (${sw.release} words)
The autonomic nervous system is downshifting. Guide the user to release the known self — the roles, the to-do list, the day's accumulated identity. This is the only place (outside Section 7) where "${lightMetaphor}" may appear. [pause 5s] after each release instruction. [long pause 8s] to close.

SECTION 3 — Body settling (${sw.body} words)
Attention moves through the body regions once: jaw → throat → chest → belly → pelvis → legs → feet. Short declarative sentences. No metaphor. No countdown technique here — do not use a numbered count in this section. [pause 5s] between regions. [long pause 10s] to close.

SECTION 4 — Heart coherence (${sw.coherence} words)
Bring attention to the center of the chest. The user generates the feeling of ${coherenceEmotion} — NOT from a vision, but from the feeling itself. "Let the feeling come before anything you picture. Breathe it open." Guide the breath through the chest, outward. Do NOT introduce any future images yet. [pause 6s] between beats. [long pause 12s] to close.

SECTION 5 — Space of nowhere (${sw.nowhere} words)
THE STRUCTURAL HINGE. Everything stops here. The user dissolves into awareness without edges.
Rules for this section:
- Each line is ONE short declarative sentence. Maximum 8 words. Then [long pause 12s].
- No body references. No name. No story. No time. No metaphor.
- The register: "Nothing to hold." / "No one here." / "Only this." (Write your own — do not copy these.)
- Drop one PRESENCE ANCHOR on its own line here — "Stay with this." or "You're here." — followed by [long pause 15s].
- Total: ${sw.nowhere} words of spoken text surrounded by long pauses.

SECTION 6 — Becoming (${sw.becoming} words)
From the formless space, the new identity arises. This is the heart of the session.
IMPORTANT — BECOMING IS FELT IDENTITY, NOT SCENE DESCRIPTION:
  ✓ "Sense the particular quality of a person who is no longer bracing."
  ✓ "You know this feeling. You have always known it."
  ✓ "Notice how it feels to move through the world as her."
  ✗ NOT: "You are at the table, breakfast is made, your partner is there."
  ✗ NOT: listing their desires back at them as a scene.

Use the user's onboarding answers to name the EMOTIONAL TEXTURE of their new identity — the felt quality of being that person — not the external circumstances of their life. One or two brief, specific sensory anchors from their real life are allowed (a texture, a sound, a known physical sensation) but not a scene.

Use present tense: "you are", "you notice", "you sense", "you carry". Never "you will" or "you'll have".
[vision pause 10s] after each felt-identity statement.
Drop PRESENCE ANCHORS 2-3 times — "Remember." / "Feel it." / "This is real." — each on its own line, surrounded by [long pause 12s] on both sides.
Near the end: one sentence naming the biological reality — "your nervous system is already learning to be this person" in your own words.

SECTION 7 — Anchor (${sw.anchor} words)
The identity lands and consolidates. "This is already who you are" — in your own words. "${lightMetaphor}" returns here one final time, closing the loop from Section 2. [affirm pause 6s] after each anchoring statement. Drop one final PRESENCE ANCHOR: "Remember." on its own line, [long pause 15s] after.

SECTION 8 — Return (${sw.return} words)
Bring awareness back: fingers, hands, breath, the surface beneath the body. 2-3 sentences send the user into their day from this new identity. Do NOT say "the meditation is ending". Say this feeling travels with them. [pause 6s] between beats.

${band.extraDepth}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESENCE ANCHORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Remember." / "Feel it." / "Breathe." / "Stay with this." / "This is real." / "You're here."
— Each appears on its OWN LINE, surrounded by pause markers.
— Only in Sections 5, 6, and 7.
— Maximum 5 total across the whole script.
— Never string two together. Never embed in a sentence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACING & TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
— Address the user by name 4-6 times, spread across all sections.
— Never write more than 2 sentences without a pause marker.
— Script should look sparse on the page — that spaciousness IS the meditation.
— Total spoken words: ${band.totalWords}.
— Never use: "just", "simply", "try", "attempt", "deserve", "worthy".
— Never end with a generic wellness phrase.`;
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

    // Strip any v3 delivery tags the model may have leaked into the script.
    // These tags are added by narrate-meditation — if they appear in the script
    // text itself the TTS system reads them aloud.
    const V3_DELIVERY_TAGS = /\[(softly|slow|warm|intimate|drawn out|whisper|fast|neutral|robust|creative|loud|quiet|serious|happy|sad|angry|fearful|surprised|disgust|calm|excited)\]/gi;
    const cleanedScript = fullScript.trim().replace(V3_DELIVERY_TAGS, "");
    const segmentTexts = splitIntoSegments(cleanedScript);
    const titles = ["Arrival", "Coherence", "Becoming", "Return"];
    const segments = segmentTexts.map((text, i) => ({
      number: i + 1,
      title: titles[i] || `Segment ${i + 1}`,
      text,
    }));

    return new Response(JSON.stringify({ script: cleanedScript, segments }), {
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
