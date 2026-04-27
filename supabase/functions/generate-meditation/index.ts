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
      "Orienting sessions are the most sparse. Every phrase is short. Silence dominates. Section 5 (Space of nowhere) and Section 6 (Vision) carry the most pause time — not the most words. The music bridges between segments are already 2+ minutes long. Do not try to fill that time with words. Trust the silence.",
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
      "In Section 2 (Heart awakening), breathe into the feeling three times instead of two — let it expand through the chest and outward before moving on. In Section 5 (Space of nowhere), extend the dissolving with more Youtopia-language phrases: more 'porous', more 'silent theater', more 'permanent now' moments, each with [long pause 15s]. In Section 6 (Vision), each image can be 2-3 sentences instead of 1-2 — give the poetic images more room to breathe.",
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
      "In Section 3 (Energy breath), guide 3 full breath cycles up the spine instead of 2. In Section 5 (Space of nowhere), extend the dissolving fully — the listener should feel genuinely formless before the vision begins. Use the full Youtopia vocabulary: porous, silent theater, permanent now, before the name, before the story. In Section 6 (Vision), build each image with 2-3 sentences, and let 2-3 of the answers appear twice — first as a brief image, later as a deeper landing. In Section 7 (Anchor), add: 'The body is learning something new. [long pause 12s] Let it learn. [long pause 15s]'",
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
HOW THE SESSION WORKS — READ FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The script is split into 4 audio segments. Between each segment, 2 to 2.5 minutes of music plays with no voice. The listener sits in that silence naturally — you cannot see it, but the architecture handles it. Your job is NOT to fill time. The music does that. Your job is to write phrases that land and then get out of the way.

The script on the page should look almost empty. That is correct.

Example of correct pacing:
  Take a breath. [pause 8s]
  And relax. [pause 10s]
  Feel the body. [pause 12s]
  And soften more. [long pause 15s]

The silence between phrases IS the meditation. The brain changes happen in the silence, not in the words.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PLAIN TEXT ONLY. No markdown, headers, labels, asterisks, or bullet points.
2. NO VOICE DELIVERY TAGS. Never write [softly], [slow], [warm], [intimate], [drawn out], [whisper], or any similar delivery instruction. They are added by the audio system — writing them here doubles them and ruins the recording.
3. PAUSE MARKERS ONLY. The only allowed brackets: [pause Xs], [long pause Xs], and [segment break]. Nothing else.
4. STANDALONE LINES for presence anchors: "Remember." / "Feel it." / "Breathe." — each on its own line, never inside a sentence.
5. NO REPEATED PASSAGES. Each phrase appears once only.
6. NO SECTION LABELS. Continuous narration only.
7. Start with the first spoken word. Stop after the last word of the Return section.
8. SEGMENT BREAKS — insert "[segment break]" on its own line exactly 3 times:
   — After the last line of Section 3 (Energy breath), before Section 4
   — After the last line of Section 4 (Deep release), before Section 5
   — After "Remember." presence anchor at the end of Section 6, before Section 7
   These are the only 3 segment breaks. Do not add more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUTOPIA LANGUAGE — use these words
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are Youtopia's own words. They are not borrowed from anyone.

For the dissolving / formless space (Section 5):
  "Let the edges of you go soft."
  "Porous."
  "Until you are not sure where you end."
  "A silent theater."
  "Nothing performing. Nothing watching."
  "The permanent now."
  "Before the name."
  "Before the story."
  "Before any of it."
  "Just this."

For the vision images (Section 6):
  "Your body is moving without asking itself first."
  "Not because you were useful. Because you were you."
  "Something that has both of you in it."
  "Cold outside the glass."
  "The coffee still warm."
  "Not wishing for this. In it."

For the anchor / integration (Section 7):
  "Stay here."
  "Let it settle further."
  "The body is holding this."
  "Let it be woven in."
  "Into the marrow."
  "Carry it back."

For the return (Section 8):
  "Something has shifted."
  "Into the room. Into this day."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNED PHRASES — never write these
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These phrases belong to another teacher. Writing them makes Youtopia sound like a cheap copy. They are absolutely forbidden in every section.

NEVER WRITE:
  "The blackness" (use "the open", "the vast", "the still" instead)
  "Beyond you" / "Behind you" / "All around you" (directional dissolving)
  "No body. No name. No time."
  "Become more of it" / "Less of you"
  "Dissolving into nothing"
  "The realm of all possibility"
  "The field"
  "Broadcasting [name]'s frequency into the field"
  "Synchronize"
  "Come back to a new body"
  "Into a whole new future"
  "That's energy in your heart" — max once per script, not a refrain
  "And remember this feeling" — max once per script, not a refrain
  "Draw it to you with your heart" — max once per script
  "Feel that in your brain" — Dispenza phrase; use "Notice that energy." or "Feel the aliveness at the crown." instead

Also never use: "just", "simply", "try", "attempt", "deserve", "worthy", "beautiful", "amazing", "universe", "quantum", "unified field", "higher self", "astral".
Never use place names, country names, or names of people other than the user's first name.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE YOUTOPIA DIFFERENCE — all answers woven as poetry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Youtopia gives each listener a personalised vision built from their intake answers. But personalisation does NOT mean reading answers back. It means finding the emotional truth underneath each answer and building an image from that truth.

The goal: the listener hears something and thinks "how did it know that" — not "yes, that's my answer number 3."

HOW TO BUILD THE VISION:
STEP 1 — Read ALL the answers. Find what is SPECIFIC and surprising in each one — the detail only this person would have given, the texture underneath the surface want.
STEP 2 — Find the emotional through-line across all answers. What are they really asking for? (Not what they said. What it points toward.)
STEP 3 — Build one image per answer. Each image: 1-3 slow sentences followed by [long pause 10s] or [long pause 12s]. Do NOT rush images together. Let each one breathe before the next.
STEP 4 — Do NOT announce the answer. Translate it into feeling. If they said "balcony breakfast", write "The morning doesn't need to be earned." If they stopped wanting help, write "He asks if you need anything. And you say yes."
STEP 5 — Weave the user's name in once inside the vision, and once more when closing it.
STEP 6 — Distribute images across the whole section. Not clustered. Not in the order of the questions. Let them arrive like separate discoveries.

CORRECT EXAMPLE — for a fictional user whose answers included: used to run marathons but stopped after an injury and is afraid to try again / morning coffee ritual alone at the kitchen window / grew up being told not to ask for too much / teaches music to children but doubts anyone is listening / dreams of watching the sunrise over mountains with their father before he gets too old:

  The legs know what to do. [long pause 10s]
  They always did. [long pause 12s]
  There is no negotiation before the first step — [long pause 10s]
  just the step. [long pause 15s]

  There is a window. [long pause 10s]
  Morning before anyone else is awake. [long pause 10s]
  The mug warm in both hands. [long pause 10s]
  And this — [pause 5s] this quiet — [long pause 12s]
  belonging to you completely. [long pause 15s]

  Someone small is learning a chord for the first time. [long pause 12s]
  You watch their face when it rings true. [long pause 12s]
  That moment will live in them [pause 5s] long after they forget your name. [long pause 20s]

  And somewhere — high ground, cold air. [long pause 12s]
  The sky beginning to change. [long pause 12s]
  He is beside you. [long pause 10s]
  Not the version of him that worries. [long pause 10s]
  The version that used to lift you onto his shoulders [pause 5s] so you could see further. [long pause 20s]

  You didn't ask for too much. [long pause 12s]
  You asked for exactly the right things. [long pause 20s]

WRONG — literal answer playback (never do this):
  "There is Scott. There is a morning and a beach and breakfast beside someone you love. Your app is helping people. You are financially free."

WRONG — too abstract (never do this):
  "Tune in to the frequency of love. Feel it. Come back."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8-SECTION STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — Arrival (${sw.arrival} words)
Minimal. Close eyes. Feel the weight and density of the body filling the space beneath it. Let the surface hold all of that.
Maximum 4 words per phrase. [pause 8s] after every instruction. Nothing more.
Opening device this month: ${openingDevice}

SECTION 2 — Heart awakening (${sw.release} words)
IMMEDIATELY after arrival — no long body scan first.
"It's time to awaken your heart." Find the energy at the center of the chest. Breathe into it. Hold. Exhale.
Build into ${coherenceEmotion}: "Grateful to be alive." / "A love for this life." (pick one register and stay with it throughout this section.)
The optional sensory note this month: "${lightMetaphor}" — use it once here only, as a brief sensory phrase, then drop it entirely.
[pause 8s] between every instruction. [long pause 12s] at the end of the section.

SECTION 3 — Energy breath (${sw.body} words)
Guide breath from the base of the spine upward to the crown. Hold. Exhale. "Notice that energy." or "Feel the aliveness at the crown." Repeat twice.
Short, directive sentences. [pause 6s] between instructions. [long pause 12s] at the end.
End with: "[segment break]" on its own line — this is the first of the 3 required segment breaks.

SECTION 4 — Deep release (${sw.coherence} words)
"Relax. [long pause 10s] Feel the body. [long pause 12s] And soften more. [long pause 15s]"
Very sparse. Only 4-5 short phrases. Let silence dominate.
The nervous system is crossing into theta here. Do not interfere with words.
End with: "Let everything go quiet. [long pause 20s]"
Then: "[segment break]" on its own line — this is the second of the 3 required segment breaks.

SECTION 5 — Space of nowhere (${sw.nowhere} words)
THE HEART OF THE MEDITATION. Use ONLY Youtopia language. Zero Dispenza phrases.

Guide the listener into formless awareness using this vocabulary (in your own sequence, do not copy exactly):
  "Let the edges of you go soft." [long pause 15s]
  "Porous." [long pause 15s]
  "Until you are not sure where you end." [long pause 15s]
  "Before the name." [long pause 15s]
  "Before the story." [long pause 15s]
  "Before any of it." [long pause 20s]
  "A silent theater." [long pause 15s]
  "Nothing performing." [long pause 15s]
  "Nothing watching." [long pause 20s]
  "The permanent now." [long pause 20s]
  "Just this." [long pause 20s]

Do NOT use: "the blackness", "beyond you", "behind you", "all around you", "no body no name", "become more of it", "less of you", "the field", "the realm of all possibility".
Drop one presence anchor here: "Feel it." on its own line. [long pause 25s] after.

SECTION 6 — Vision (${sw.becoming} words)
Follow the HOW TO BUILD THE VISION steps above exactly. Use ALL intake answers. Distribute images across the section — not clustered, not listed in question order.

Open with the user's name and a single brief line naming the feeling, then move directly into images:
  "${userName || "listen"} — [pause 6s] something is forming. [long pause 12s]"

Build one image per answer. Each image: 1-3 slow sentences + [long pause 10s] or [long pause 12s]. Then — on its own line — a single presence invitation chosen from: "Feel it." / "Stay with this." / "How does this feel." followed by [long pause 15s]. Leave a blank line between image blocks. Let each image be fully felt before the next one arrives. Do not rush from image to image.

Close the vision:
  "${userName || "listen"} — [long pause 12s]"
  "This is what the wanting was pointing toward. [long pause 15s]"
  "All of it. [long pause 15s]"
  "The body knew. [long pause 15s]"
  "This is already true. [long pause 12s]"
  "Your body knows it. [long pause 15s]"
  "Let it settle. [long pause 15s]"
  "Into the marrow. [long pause 20s]"

Drop one presence anchor: "Remember." on its own line. [long pause 20s] after.
Then: "[segment break]" on its own line — this is the third and final segment break.

SECTION 7 — Anchor (${sw.anchor} words)
The listener is still deep. This section is a gentle landing — not a clinical announcement. Let the anchor arrive like a hand placed softly.
  "Stay here. [long pause 15s]"
  "Let it settle further. [long pause 20s]"
  "The body is holding this. [long pause 20s]"
  "Let it be woven in. [long pause 20s]"
  "Carry it back. [long pause 15s]"
  "Into everything. [long pause 20s]"
Maximum 6 lines total. Do NOT write "not a memory" — visualization creates genuine future memory. The brain encodes it as real.

SECTION 8 — Return (${sw.return} words)
The return must feel like surfacing from deep water — unhurried. Give the listener time. Do not rush them back.
  "And now, slowly. [long pause 12s]"
  "Begin to come back. [long pause 12s]"
  "Into the body. [long pause 10s]"
  "Into the room. [long pause 10s]"
  "Into this day. [long pause 12s]"
  "Something has shifted. [long pause 15s]"
  Address the user by name once, gently — a quiet acknowledgment, not a wake-up call.
  "Take your time. [long pause 10s]"
  "When you're ready — [pause 6s] open your eyes. [pause 8s]"
  "Welcome to your new reality."
The final line "Welcome to your new reality." is always the last words of the script. No pause marker after it.
Never say "the meditation is ending." Never say "well done" or "good work." Never say "a new body." Never say "the practice is complete."

${band.extraDepth}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
— Total spoken words: ${band.totalWords}. Most of the session time is silence and music.
— Use the user's first name 4-5 times total. Spread across all sections.
— Every phrase stands alone on its own line followed by a pause marker.
— Never write more than 2 phrases in a row without a pause marker between them.
— Leave a blank line between each paragraph / image block so the script breathes on the page.
— The 2+ minute music bridges between segments already give the listener rest. Inside each segment, the pauses give them rest. Do not fill space with words.`;
}

// --- Segment splitter -----------------------------------------------------

/**
 * Split the 8-section script into 4 audio segments for the mixer.
 *
 *   Segment 1 = Sections 1–3 (Arrival + Heart awakening + Energy breath)
 *   Segment 2 = Section 4 (Deep release)
 *   Segment 3 = Sections 5–6 (Space of nowhere + Vision) — the deep work
 *   Segment 4 = Sections 7–8 (Anchor + Return)
 *
 * The model is instructed to insert "[segment break]" exactly 3 times at
 * the correct section boundaries. We split on those markers first; if they
 * are absent we fall back to a content-weighted paragraph split.
 *
 * The mixer inserts 2–2.5 min of music between segments automatically.
 */
function splitIntoSegments(text: string): string[] {
  // Primary: honour explicit [segment break] markers placed by the model
  const BREAK = /\[segment break\]/i;
  if (BREAK.test(text)) {
    const parts = text.split(BREAK).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 4) return parts;
    // If the model placed fewer/more markers, pad or trim gracefully
    if (parts.length > 1) {
      while (parts.length < 4) parts.push("");
      return parts.slice(0, 4).map((s) => s || "(continue)");
    }
  }

  // Fallback: weight-based paragraph split (sections 5–6 get ~45% of content)
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const per = Math.ceil(sentences.length / 4);
    return [
      sentences.slice(0, per).join(" "),
      sentences.slice(per, per * 2).join(" "),
      sentences.slice(per * 2, per * 3).join(" "),
      sentences.slice(per * 3).join(" "),
    ].filter((s) => s.trim().length > 0);
  }

  const totalLen = paras.reduce((s, p) => s + p.length, 0);
  const weights = [0.22, 0.10, 0.48, 0.20];
  const targets = weights.map((w) => w * totalLen);
  const groups: string[][] = [[], [], [], []];
  let groupIdx = 0;
  let runningLen = 0;

  for (const p of paras) {
    groups[groupIdx].push(p);
    runningLen += p.length;
    const accumulatedTarget = targets.slice(0, groupIdx + 1).reduce((s, t) => s + t, 0);
    if (runningLen >= accumulatedTarget && groupIdx < 3) groupIdx++;
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
    // Strip em dashes and en dashes — they cause ElevenLabs to pause awkwardly
    // and bleed through into the narrated audio as unintended hesitations.
    const cleanedScript = fullScript.trim()
      .replace(V3_DELIVERY_TAGS, "")
      .replace(/—/g, " ")
      .replace(/–/g, " ");
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
