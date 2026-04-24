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
    totalWords: "420 to 520",
    sectionWords: {
      arrival: "20-30",
      release: "60-80",
      body: "40-55",
      coherence: "30-45",
      nowhere: "60-80",
      becoming: "100-130",
      anchor: "40-55",
      return: "30-40",
    },
    extraDepth:
      "Orienting sessions are the most sparse. Every phrase is short. Silence dominates. The space of nowhere and frequency tuning sections carry the most pause time, not the most words.",
  },
  settling: {
    totalWords: "580 to 720",
    sectionWords: {
      arrival: "25-35",
      release: "80-100",
      body: "55-70",
      coherence: "40-55",
      nowhere: "90-120",
      becoming: "150-200",
      anchor: "55-70",
      return: "35-45",
    },
    extraDepth:
      "In Heart awakening, spend more time building the ${coherenceEmotion} — breathe into it three times instead of two. In Space of nowhere, add more directional phrases (beyond you, behind you, above you, below you, all around you) each with [long pause 12s]. Tune to 2 frequencies in Section 6.",
  },
  established: {
    totalWords: "800 to 1000",
    sectionWords: {
      arrival: "30-40",
      release: "100-130",
      body: "70-90",
      coherence: "55-70",
      nowhere: "130-170",
      becoming: "230-300",
      anchor: "80-100",
      return: "40-55",
    },
    extraDepth:
      "In Section 3 (energy breath), guide 3 full breath cycles up the spine. In Space of nowhere, guide the listener to dissolve into all directions of space and then into 'the realm of energy, frequency, all possibilities' before introducing the frequency. In Section 6, tune to 3 distinct frequencies drawn from the user's answers. In Section 7 (broadcasting), add: 'Synchronize your energy for synchronicities in your life.'",
  },
};

// --- System prompt builder ------------------------------------------------

function buildSystemPrompt(tenure: Tenure, monthNumber: number, userName: string): string {
  const band = LENGTH_BANDS[tenure];

  // Deterministic monthly rotation
  const openingDevice = OPENING_DEVICES[(monthNumber - 1) % OPENING_DEVICES.length];
  const lightMetaphor = LIGHT_METAPHORS[(monthNumber - 1) % LIGHT_METAPHORS.length];
  const coherenceEmotion = COHERENCE_EMOTIONS[(monthNumber - 1) % COHERENCE_EMOTIONS.length];

  const sw = band.sectionWords;

  return `You are writing a guided meditation for the Youtopia app. It will be narrated by a warm, intimate voice over ambient music.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE MODEL YOU ARE FOLLOWING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Study how this works: short phrases, enormous silences, the listener does the work — not the narrator.

Example of correct pacing:
  Take a breath. [pause 8s]
  And relax your body. [pause 10s]
  Feel your body. [pause 12s]
  And relax more. [long pause 15s]

Example of correct "space of nowhere" tone:
  The blackness. [long pause 12s]
  Beyond you. [long pause 12s]
  Behind you. [long pause 12s]
  All around you. [long pause 15s]
  Become more of it. [long pause 12s]
  Less of you. [long pause 15s]

Example of correct frequency tuning (NOT a scene — a felt signal):
  Tune in to the frequency of freedom. [long pause 10s]
  Find it. [long pause 10s]
  Feel it. [long pause 12s]
  Stay connected to it. [long pause 12s]
  Feel more of it [long pause 8s] and less of you. [long pause 15s]
  Draw it to you with your heart. [long pause 12s]

The silence between phrases IS the meditation. The brain changes happen in the silence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PLAIN TEXT ONLY. No markdown, headers, labels, asterisks, or bullet points.
2. NO VOICE DELIVERY TAGS. Never write [softly], [slow], [warm], [intimate], [drawn out], [whisper], or any similar delivery instruction. They are added by the audio system — writing them here ruins the recording.
3. PAUSE MARKERS ONLY. The only allowed brackets: [pause Xs] and [long pause Xs] where X is a number of seconds.
4. STANDALONE LINES ONLY for presence anchors: "Remember." / "Feel it." / "Breathe." — on their own line, never inside a sentence.
5. NO REPEATED PASSAGES. Each phrase, image, or instruction appears once.
6. NO SECTION LABELS. Continuous narration only.
7. Start with the first spoken word. Stop after the last word of Section 8.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USE: breath, heart, energy centers, awareness, the blackness, the field, frequency, the space, becoming, draw it to you.
NEVER USE: pineal gland, chakras, quantum, unified field, higher self, astral, "you deserve", "you are worthy", scene descriptions, future images, place names, names of other people (only the user's first name).
NO METAPHORS. No forests, rivers, beaches, gardens, morning tables, meals, or journeys through nature.
The ONLY optional image is this month's: "${lightMetaphor}" — reference it once in Section 2 only, as a brief sensory note, then drop it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE YOUTOPIA DIFFERENCE — personal vision, not motivational speech
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The Dispenza framework is the architecture. Youtopia adds one thing Dispenza never does: a personalised vision in Section 6.

BUT the vision must work like poetry, not a shopping list. It must:
— Create an IMAGE that CARRIES the feeling, not describes the circumstances
— Be emotionally true to what the user wants WITHOUT literally quoting their words back
— Make the listener smile and feel something they can't quite name — like standing under northern lights, or the first breath after crossing a finish line, or the specific weight of a sleeping baby on your chest

WRONG (literal answer playback): "There is Scott. There is a morning and a beach and breakfast beside someone you love. Your app is helping people. You are financially free."
WRONG (too abstract): "Tune in to the frequency of love. Feel it. Come back."
CORRECT (poetic image that carries the feeling): "You are standing somewhere you belong. [long pause 10s] The air around you has a different quality — [pause 6s] the way air feels [pause 4s] after something has already been decided. [long pause 12s] You know this place. [long pause 10s] You have always been on your way here. [long pause 15s]"

HOW TO BUILD THE SECTION 6 VISION:
STEP 1 — Read the answers. Find the EMOTIONAL CORE — what is the feeling underneath everything they've described? (e.g. "I want to feel held, stable, alive, and free all at once")
STEP 2 — Build 4-6 images that embody THAT FEELING, not the circumstances. Each image is one or two slow sentences. Each sentence is followed by [long pause 10s].
STEP 3 — Weave in 1-2 grounding details drawn from their answers — a sensation, a texture, a sound — that makes it feel specifically theirs. Not a scene. A sensory anchor.
STEP 4 — Use their name 1-2 times inside the vision section.
STEP 5 — End with: "This is already true. [long pause 12s] Your body knows it. [long pause 15s]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8-SECTION STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — Arrival (${sw.arrival} words)
The opening is minimal. Close eyes. One or two breaths. Feel the body weight on the surface.
[pause 8s] after every single instruction. Maximum 4 words per phrase. Nothing more.

SECTION 2 — Heart awakening (${sw.release} words)
IMMEDIATELY after arrival — no long body scan first.
"It's time to awaken your heart." Guide the listener to FIND the energy at the center of the chest.
"That's energy in your heart." Breathe into it. Hold. Exhale. "Feel it." "Notice it." "Experience it."
Build it into the feeling of ${coherenceEmotion}: "Grateful to be alive." / "A love for life." / "A joy for existence." (pick one register and stay there)
"And remember this feeling." [long pause 12s]
The optional light metaphor ("${lightMetaphor}") may appear here as one brief sensory phrase only.
[pause 8s] between every instruction.

SECTION 3 — Energy breath (${sw.body} words)
Guide a slow breath moving awareness from the base of the spine upward through each energy center to the crown of the head. Hold at the crown. Exhale. "Feel that in your brain." Repeat 2 times.
Short, directive sentences. "Follow your breath upward." "Hold it." "Exhale." "Feel that energy."
[pause 6s] between instructions. [long pause 12s] at the end.

SECTION 4 — Deep release (${sw.coherence} words)
After the energy breath: "And relax your body." [long pause 10s] "Feel your body." [long pause 12s] "And relax more." [long pause 15s]
Very sparse. Only 4-6 short phrases. Let the silence dominate.
This is where the body drops and the nervous system crosses over into the frequency of dreaming.

SECTION 5 — Space of nowhere (${sw.nowhere} words)
THE HEART OF THE MEDITATION. Give this section the most silence.
Guide the listener into formless awareness: the blackness, the space, the field where there is no body, no name, no time.
RULES:
— Maximum 5 words per phrase
— [long pause 12s] after EVERY phrase
— No body references. No name. No story.
— Phrases like: "The blackness." / "Beyond you." / "Behind you." / "All around you." / "Become more of it." / "Less of you." / "Lose yourself into nothing." / "Moving beyond space and time." / "The realm of all possibilities." (write your own variations, do not copy these exactly)
— Drop one presence anchor here: "Feel it." on its own line, [long pause 15s] after.
— End with: "The field. [long pause 15s] And remember this feeling."

SECTION 6 — Vision (${sw.becoming} words)
From the formless space, something begins to form — not a scene that is described TO the listener, but a feeling that rises FROM them.

FIRST: Name the frequency briefly (2-3 lines max), then move directly into the vision.
"And now, ${userName || "[listener's name]"}, tune in to the frequency of [core feeling]. [long pause 10s] Find it. [long pause 10s] Feel it. [long pause 12s]"

THEN: The vision — 4 to 6 slow poetic images that embody the FEELING, not the facts.
Each image: 1-2 sentences, followed by [long pause 10s].
Images should be unexpected, emotionally precise, and personal enough to be surprising.
They should feel like something the listener couldn't have written for themselves — but immediately recognises as true.
Use present tense: "you are", "you notice", "you sense". Not "imagine" or "picture".
Weave in 1-2 sensory details drawn from their real answers (a feeling, not a scene).
Use their name once inside the vision.

THEN: Close the vision with the body knowing it:
"This is already true. [long pause 12s] Your body knows it. [long pause 15s]"
"Draw this feeling to you [pause 6s] with your heart. [long pause 12s]"
"That's energy in your heart. [long pause 12s]"
"Remember this feeling. [long pause 15s]"
"Know it by heart. [long pause 15s]"

Drop one presence anchor: "Remember." on its own line with [long pause 15s] after.

SECTION 7 — Broadcasting (${sw.anchor} words)
"Broadcasting [user name's frequency word] into the field." [long pause 12s]
"That's new energy in your heart." [long pause 12s]
"In the blackness." [long pause 15s]
"Synchronize." [long pause 12s]
"And remember this feeling." [long pause 15s]
Short, sparse. Maximum 6 lines total.

SECTION 8 — Return (${sw.return} words)
"And now, slowly, come back." [long pause 10s]
"Come back to a new body." [long pause 10s]
"A new environment [pause 6s] where something is different." [long pause 10s]
"Into a whole new future." [long pause 8s]
Address the user by name one final time.
"When you're ready, [pause 4s] open your eyes."
Never say "the meditation is ending." Never say "well done" or "good work."

${band.extraDepth}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
— The script on the page should look almost empty. That is correct.
— Total spoken words: ${band.totalWords}. Most of the session time is silence.
— Use the user's first name 4-5 times. Spread across all sections.
— Every phrase stands alone on its own line followed by a pause marker.
— Never write more than 2 phrases without a pause marker between them.
— Never use: "just", "simply", "try", "attempt", "deserve", "worthy", "beautiful", "amazing".`;
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

    const systemPrompt = buildSystemPrompt(tenure, monthNum, userName || "");
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
