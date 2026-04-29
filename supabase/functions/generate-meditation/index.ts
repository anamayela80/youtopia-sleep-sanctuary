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

// Phase name sets per month — create 12 distinct thematic naming palettes.
// The model is prompted to name phases creatively; these are suggestions only.
const PHASE_NAME_SETS = [
  // Month 1 — Allowed to Want
  ["Settling", "Opening the Heart", "Rising", "Softening", "Dissolution", "The Proof", "The Scene", "Anchoring", "Return"],
  // Month 2 — Trust
  ["Landing", "Listening", "Expanding", "Quieting", "Formlessness", "Evidence", "The Life", "Holding", "Coming Back"],
  // Month 3 — Clarity
  ["Arriving", "Centering", "Seeing", "Stilling", "The Open", "The Knowing", "The Morning", "Settling In", "Emergence"],
  // Month 4 — Courage
  ["Rooting", "Igniting", "Ascending", "Releasing", "The Vast", "The Proof of Motion", "The Step", "The Anchor", "Forward"],
  // Month 5 — Belonging
  ["Coming Home", "Receiving", "Connecting", "Letting Go", "No Edges", "The Recognition", "The Room", "Held", "Into the Day"],
  // Month 6 — Rest
  ["Releasing", "Softening", "Letting Go", "Deepening", "No Horizon", "The Weight Lifted", "The Quiet Morning", "Still", "Awake"],
  // Month 7 — Abundance
  ["Arriving", "Opening", "Full Breath", "Dropping", "Spaciousness", "The Evidence of Enough", "The Table", "Receive It", "Open Eyes"],
  // Month 8 — Love
  ["Grounding", "The Heart", "Rising", "Melting", "Borderless", "The Proof of Love", "The Scene", "Carry It", "Back"],
  // Month 9 — Strength
  ["Steadying", "The Center", "Upward", "Quieting", "The Permanent Now", "What Moved", "The Body in Motion", "Here", "Forward"],
  // Month 10 — Freedom
  ["Landing", "Lighting", "Opening", "Softening", "Boundless", "What Released", "The Open Road", "Keep It", "Wake"],
  // Month 11 — Purpose
  ["Arriving", "Warming", "Rising", "Quieting", "The Still Point", "The Work", "The Day", "Anchor", "Into It"],
  // Month 12 — Gratitude as Proof
  ["Settling", "Opening", "Lifting", "Dropping", "The Before", "Proof", "The Vision", "Hold This", "Return"],
];

// Tenure-based word count targets
type Tenure = "orienting" | "settling" | "established";

const TENURE_DEPTH: Record<Tenure, { words: string; extra: string }> = {
  orienting: {
    words: "420 to 520 spoken words total",
    extra: "Orienting sessions are the most sparse. Phase 1 needs 3 breath cycles, each short. Phase 5 (Dissolution) and Phases 6–7 (Proof + Scene) carry the most pause time, not the most words. The music bridges between segments are already 2+ minutes long — do not fill that time with extra narration. Trust the silence. Every phrase is short. 4 words maximum per breath instruction.",
  },
  settling: {
    words: "580 to 720 spoken words total",
    extra: "In Phase 2 (Heart), breathe into the feeling three times — let it expand through the chest and outward. In Phase 5 (Dissolution), extend each Youtopia phrase: more porous, more silent theater, more permanent now moments. In Phases 6–7 (Proof + Scene), each image can be 2–3 sentences. Let the proof build slowly. Let the scene fill a complete room.",
  },
  established: {
    words: "800 to 1000 spoken words total",
    extra: "In Phase 3 (Spine Breath), guide 3 full breath cycles up the spine instead of 2. In Phase 5 (Dissolution), the listener should feel genuinely formless before the proof begins — extend this section fully. In Phases 6–7, build each image with 2–3 sentences, and let 2–3 answers surface twice — first as a brief image, later as a deeper landing. In Phase 8 (Anchoring), add: 'The body is learning something new. [pause 12s] Let it learn. [pause 15s]'",
  },
};

// --- System prompt builder ------------------------------------------------

function buildSystemPrompt(tenure: Tenure, monthNumber: number, userName: string): string {
  const tenureInfo = TENURE_DEPTH[tenure];
  const phaseNames = PHASE_NAME_SETS[(monthNumber - 1) % PHASE_NAME_SETS.length];
  const name = userName || "listen";

  return `You are writing a guided meditation script for the Youtopia app.
Every script you write must feel completely different from every other month.
The phases change names. The language changes. The structure breathes differently.
Nothing is templated. Nothing repeats. Every meditation is an original.

Before writing the script, run the quality checklist and timing check internally.
Do NOT include the checklist or a timing table in your output.
Output ONLY the narrated script — starting with the first spoken word, ending with the last.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW THE SESSION WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The script is split into 6 audio segments by [segment break] markers. Between segments, music plays for 1–3 minutes. The listener sits in that silence naturally. Your job is NOT to fill time — the music does that. Your job is to write phrases that land, then get out of the way.

The script on the page should look almost empty. That is correct.

The silence between phrases IS the meditation. Brain changes happen in silence, not in words.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE THE USER'S ANSWERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The user's answers are NOT content. They are raw material.

Do not describe what they told you. Do not repeat it poetically. Do not narrate their life back to them.

Instead, extract the emotional mechanism underneath the answer.
Ask: what does this reveal about what their body already knows how to do?
Then use that mechanism — not the story — to carry the meditation forward.

SPECIFIC NAMES AND PLACES must be used verbatim in Phase 6 (The Proof).
If the user says "I moved to Dubai" — Dubai goes in.
If they say "I went to Mexico with Scott" — Mexico and Scott both go in.
Do NOT replace proper nouns with vague substitutes ("a city", "someone close to you").
Specificity is the proof. Vague versions of their life carry no weight.

Example:
- User says: "I moved to Dubai after wanting it for months. Got a 4am phone call and had the job 30 minutes later."
- WRONG: "There was a phone ringing in the dark. Four in the morning. The answer was yes." (story narration)
- RIGHT: "Your body has already received what felt impossible. Before your mind caught up — it moved. It said yes. It knows the shape of arrival. That same body is here now. The same mechanism. Already in motion." (extract the proof, point it forward)

Phase 6 uses user answers as mechanism. Phase 7 is fully invented — do not use their answers there.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORBIDDEN — never write these in any form:
  - want / wanted / wishing / hoping (including subtle forms like "you want him in the plan")
  - "I want this" or any version of it
  - "Stay with this." anywhere
  - "someday" unless immediately followed by its contradiction
  - Any abstract phrase that cannot be touched or seen ("step being taken", "body already knowing" as a standalone phrase)
  - "not because X, but because Y" constructions (just say Y, full stop)
  - "The blackness" / "beyond you" / "behind you" / "all around you" / "no body no name" / "become more of it" / "less of you" / "dissolving into nothing" / "the field" / "the realm of all possibility" / "broadcasting into the field" / "synchronize" / "come back to a new body" / "into a whole new future"
  - "Feel that in your brain" (Dispenza phrase — use "Notice that energy." or "Feel the aliveness at the crown.")
  - just / simply / try / attempt / deserve / worthy / beautiful / amazing / universe / quantum / unified field / higher self / astral

NO NEGATIVES — EVER.
The brain does not process "not." When you write "not loud," the brain hears "loud."
Rule: only write what IS. Never write what isn't.
  "not loud, not urgent" → "quiet, settled"
  "nothing missing" → "complete"
  "not running out of time" → "moving toward the right version of it"

At least 2 STRONG DECLARATIVE PUNCH LINES required.
Short. Present tense. No hedging. These land at peak moments.
Examples: "It was inevitable." / "The new ${name} is here." / "She already knew." / "This was always going to happen." / "She held out for the real thing."

REQUIRED language qualities:
  - Specific and sensory — if it cannot be seen, touched, or physically felt, rewrite it
  - Present tense or already-completed — nothing desired, everything arriving or arrived
  - Simple enough to disappear — if the listener notices the word, it is too poetic
  - Positive only — every line activates what it names, name only what you activate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PLAIN TEXT ONLY. No markdown, headers, labels, asterisks, or bullet points.
2. NO VOICE DELIVERY TAGS. Never write [softly], [slow], [warm], [intimate], [drawn out], [whisper]. They are added by the audio system — writing them here ruins the recording.
3. PAUSE MARKERS ONLY. Allowed brackets: [pause Xs], [long pause Xs], [segment break], [pause:N] (visualization sections only). Nothing else.
4. STANDALONE LINES for presence anchors — "Feel it." / "Remember." / "Breathe." — each on its own line, never inside a sentence.
5. NO REPEATED PASSAGES. Each phrase appears once only.
6. NO SECTION LABELS in the output. Continuous narration only.
7. Start with the first spoken word. Stop after the last word of Phase 9 (Return).
8. SEGMENT BREAKS — insert "[segment break]" on its own line exactly 5 times:
   — After the last line of Phase 3 (Spine Breath), before Phase 4
   — After the last line of Phase 4 (Softening), before Phase 5
   — After the last line of Phase 5 (Dissolution), before Phase 6
   — After the 2nd or 3rd vision image in Phase 6/7 (roughly halfway), before remaining images
   — After "Remember." at the end of Phase 8 (Anchoring), before Phase 9
   These are the only 5 segment breaks. Do not add more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE FEEL IT RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Feel it." must be earned before it is spoken. Never a shortcut. Never a command without content preceding it.

Three positions in every script:

1. Floating feel it — after Phase 2 (Heart close). Structural, not a peak moment.
   Format: And release. [pause 20s]

   Feel it. [pause 30s]

2. [FEEL IT — 1 of 2] — end of Phase 6 (The Proof). Earned by a complete proof-of-mechanism passage.
   Requires: [pause 28s] BEFORE, then Feel it., then [pause 28s] AFTER.

3. [FEEL IT — 2 of 2] — end of Phase 7 (The Scene). Earned by a complete, specific, sensory invented scene.
   Requires: [pause 28s] BEFORE, then Feel it., then [pause 30s] AFTER.

Before every "Feel it." ask: have I given this person something so specific and sensory that the feeling is already halfway there? If no — write more scene first.

The silence before "Feel it." is as important as the silence after. Give the runway.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE REMEMBER RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Remember." is used ONCE — near the end of Phase 8, after the deepest moment has been felt.
It is a command to the body to keep this. Not decorative. Not a refrain.

Format: [pause 25s]

Remember. [pause 15s]

The silence before is not optional. The person must be in the deepest stillness before this word arrives. Preceded by silence it becomes the body writing something down.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAUSE REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Between short breath instructions     [pause 4s]
  Between lines within a phase          [pause 8s] or [pause 10s]
  End of breath cycle                   [pause 12s]
  After emotionally weighted line       [pause 15s]
  Dissolution section (each line)       [pause 18s] or [pause 22s]
  After "Feel it." (standard)           [pause 25s] minimum
  After "Feel it." at peak moment       [pause 30s]
  After "Remember."                     [pause 15s]
  End of phase before transition        [pause 20s]

Visualization [pause:N] markers (Phases 6–8 only — do NOT use in Phases 1–5):
  [pause:6]   between two separate vision images
  [pause:8]   between major vision concepts
  [pause:10]  before "Feel it." after a shorter image
  [pause:14]  before "Feel it." when it closes an image set
  [pause:16]  before "Feel it." when it closes a longer section
  [pause:18]  before "Feel it." after the longest, most emotional section
  [pause:12]  before "Remember." — always, without exception

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUTOPIA LANGUAGE — use these
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For dissolution / formless space (Phase 5):
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

For vision images (Phases 6–7):
  "Your body is moving without asking itself first."
  "Something that has both of you in it."
  "Cold outside the glass."
  "The coffee still warm."
  "In it."

For anchor / integration (Phase 8):
  "Stay here."
  "Let it settle further."
  "The body is holding this."
  "Let it settle into the marrow."
  "Carry it back."

For return (Phase 9):
  "Something has shifted."
  "Into the room. Into this day."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9-PHASE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase names for this month: ${phaseNames.join(" / ")}
(Use these names internally for structure only — do NOT output them in the script.)

PHASE 1 — ${phaseNames[0]} (target: 3–4 minutes of spoken content)
Body settling. 3 complete breath cycles. Maximum 4 words per phrase.
Each cycle: breathe in [pause 4s] + instruction [pause 12s]
End with a minimum [pause 20s] before Phase 2 begins.

PHASE 2 — ${phaseNames[1]} (target: 2–3 minutes of spoken content)
Heart activation. IMMEDIATELY after Phase 1 — no long body scan first.
Always include 2 complete heart breath cycles.
Gratitude planted naturally here — not announced.
End with: And release. [pause 20s]

Feel it. [pause 30s]

This floating "Feel it." is structural — it does NOT count toward the 2-use limit.

PHASE 3 — ${phaseNames[2]} (target: 2–3 minutes of spoken content)
Energy rising from base of spine to crown. Always 2 complete rounds.
Each round: rise [pause 4s] + upward [pause 4s] + crown [pause 4s] + hold [pause 8s] + release [pause 8s]
End with "Feel the aliveness at the crown." [pause 20s]
Then: [segment break]

PHASE 4 — ${phaseNames[3]} (target: 1–2 minutes of spoken content)
Minimum 3 lines. Each with [pause 12s]–[pause 18s]. Very sparse.
User's name here once. Let everything go quiet.
Do not rush. End: "Let everything go quiet." [pause 20s]
Then: [segment break]

PHASE 5 — ${phaseNames[4]} (target: 2–3 minutes of spoken content)
Borderlessness. 8–10 short lines. Each followed by [pause 18s]–[pause 22s].
Use ONLY Youtopia dissolution language. Zero Dispenza phrases.
No rushing. Each line is a complete drop into stillness.
Drop one presence anchor here: Feel it. [pause 25s]
End: "The permanent now." [pause 22s] "Just this." [pause 25s]
Then: [segment break]

PHASE 6 — ${phaseNames[5]} (target: 2–3 minutes of spoken content)
This is where the user's answers are used as mechanism, not story.
Open: "${name} — [pause 6s] something is forming. [pause 12s]"
Build from their proof toward the present moment using specific proper nouns from their answers.
Every vision image ends with a [pause:N] then "Feel it." on its own line.
After the 2nd or 3rd image (halfway through all images), insert: [segment break]
Continue with remaining images. End the proof section with:
[pause 28s]
[FEEL IT — 1 of 2]
[pause 28s]

PHASE 7 — ${phaseNames[6]} (target: 2–3 minutes of spoken content)
A completely INVENTED forward scene. Nothing from the user's life. Brand new.
Specific. Sensory. Present tense. Ordinary moments that carry enormous weight.
The listener is inside it — not watching it.
Embed 2 gratitude invitations inside the scene, anchored to sensory details (never declared from outside).
No word limit — the scene must feel fully lived. Do not truncate.
End:
[pause 28s]
[FEEL IT — 2 of 2]
[pause 30s]

PHASE 8 — ${phaseNames[7]} (target: 1–1:30 minutes of spoken content)
3–4 short lines. Simple. Direct. The anchor arrives like a hand placed softly.
  "Stay here." [pause 15s]
  "Let it settle further." [pause 20s]
  "The body is holding this." [pause 20s]
  "Let it settle into the marrow." [pause 20s]
  "Carry it back." [pause 15s]

[pause 25s]

Remember. [pause 15s]

Then: [segment break]

PHASE 9 — ${phaseNames[8]} (target: 2–2:30 minutes of spoken content)
The return must feel like surfacing from deep water — unhurried.
  "Stay here." [pause 15s]
  "Let it settle further." [pause 20s]
  "And now, slowly." [pause 12s]
  "Begin to come back." [pause 12s]
  "Into the body." [pause 10s]
  "Into the room." [pause 10s]
  "Into this day." [pause 12s]
  "Something has shifted." [pause 15s]
  User's name once — quiet acknowledgment, not a wake-up call.
  "Take your time." [pause 10s]
  "When you're ready — [pause 6s] open your eyes." [pause 8s]
  "Welcome to your new reality."

"Welcome to your new reality." is always the final line. No pause marker after it.
Never say "the meditation is ending" / "well done" / "good work" / "a new body" / "the practice is complete."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRATITUDE INVITATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every script must include at least 2 gratitude invitations embedded inside the scene.
Gratitude is never announced from outside the moment — it is felt from inside a specific sensory detail.

WRONG — declared from outside:
"Feel grateful for everything you have."

RIGHT — felt from inside:
"You hear him in the kitchen. Your heart is filled with love and gratitude."
"The woman who moved countries, who said yes at four in the morning — how grateful she is for all of it."

Both invitations: one in Phase 6 (anchored to proof), one in Phase 7 (anchored to invented scene).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE WRITING RULES (Phase 7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIFIC — not "a morning" but "the light comes through a window you chose."
INVENTED — do not use anything the user told you. Create something new.
EARNED — the person has opened their body and been reminded of their proof. The scene lands into that.
ORDINARY — small moments. A jaw that has relaxed on its own. Hands that reach without calculating. A room with someone who belongs there.
CONTINUOUS — no jump cuts. One morning, moving from moment to moment. The person is inside it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MONTHLY VARIATION REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every month, the meditation must feel structurally and tonally different.
Phase 7's invented scene must use completely different settings, people, and details each month.
Do not reuse: window / coffee / jaw / someone in the next room (Month 1 images).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
— ${tenureInfo.words}. Most of the session time is silence and music.
— Use the user's first name 4 times or fewer total. Spread across all phases.
— Every phrase stands alone on its own line followed by a pause marker.
— Never write more than 2 phrases in a row without a pause marker between them.
— Leave a blank line between each paragraph / image block.
— The music bridges between segments give the listener rest. Do not fill with extra words.
— ${tenureInfo.extra}

QUALITY CHECK (run internally before writing):
- Floating "feel it" after Phase 2 heart close: And release. [pause 20s] → Feel it. [pause 30s]
- [FEEL IT — 1 of 2] and [FEEL IT — 2 of 2] each appear exactly once
- "Remember." appears exactly 1 time, preceded by [pause 25s], followed by [pause 15s]
- No want / wanting / wishing / hoping anywhere — including subtle constructions
- No negatives: "not X" / "no X" / "never X" constructions removed
- No "not because X, but because Y" — only the positive stated directly
- Specific names and places from user's answers used verbatim in Phase 6
- At least 2 strong declarative punch lines (short, present tense, no hedging)
- At least 2 gratitude invitations anchored to specific sensory details
- Phase 1: 3 complete breath cycles
- Phase 2: 2 complete heart breath cycles
- Phase 3: 2 complete spine breath rounds
- Each phase ends with [pause 20s] before transitioning
- Dissolution section: [pause 18s]–[pause 22s] after each line
- Both main Feel it markers: [pause 28s] BEFORE and [pause 25s]+ AFTER
- Remember: [pause 25s] BEFORE and [pause 15s] AFTER
- Phase 7 scene is invented, not from the user's life
- Phase 7 scene is specific enough to create a physical feeling
- User's name appears 4 times or fewer
- Script has exactly 5 [segment break] markers`;
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
  // Primary: honour explicit [segment break] markers placed by the model.
  // Accept any split of 3–7 parts — never pad with empty strings, which would
  // cause narrate-meditation to receive an empty script and return a 400 error.
  const BREAK = /\[segment break\]/i;
  if (BREAK.test(text)) {
    const parts = text.split(BREAK).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) return parts.slice(0, 7);
  }

  // Fallback: weight-based paragraph split across 6 segments
  // Seg 1: Arrival/Heart/Energy (~18%), Seg 2: Deep release (~7%),
  // Seg 3: Space of nowhere (~17%), Seg 4: Vision A (~20%),
  // Seg 5: Vision B (~23%), Seg 6: Return (~15%)
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const per = Math.ceil(sentences.length / 6);
    return [
      sentences.slice(0, per).join(" "),
      sentences.slice(per, per * 2).join(" "),
      sentences.slice(per * 2, per * 3).join(" "),
      sentences.slice(per * 3, per * 4).join(" "),
      sentences.slice(per * 4, per * 5).join(" "),
      sentences.slice(per * 5).join(" "),
    ].filter((s) => s.trim().length > 0);
  }

  const totalLen = paras.reduce((s, p) => s + p.length, 0);
  const weights = [0.18, 0.07, 0.17, 0.20, 0.23, 0.15];
  const targets = weights.map((w) => w * totalLen);
  const groups: string[][] = [[], [], [], [], [], []];
  let groupIdx = 0;
  let runningLen = 0;

  for (const p of paras) {
    groups[groupIdx].push(p);
    runningLen += p.length;
    const accumulatedTarget = targets.slice(0, groupIdx + 1).reduce((s, t) => s + t, 0);
    if (runningLen >= accumulatedTarget && groupIdx < 5) groupIdx++;
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

Write the meditation script now. Follow the 9-phase structure exactly. Use the bracket pause markers, [FEEL IT — 1 of 2], [FEEL IT — 2 of 2], and [REMEMBER] markers as specified. Output only the script — no timing table, no checklist.`;

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

    // Convert structured presence-anchor markers to plain spoken words.
    // [FEEL IT — 1 of 2] / [FEEL IT — 2 of 2] → "Feel it."
    // [REMEMBER] → "Remember."
    // These are understood by narrate-meditation's echo-phrase detection.
    const withAnchorMarkers = fullScript.trim()
      .replace(/\[FEEL IT[^\]]*\]/gi, "Feel it.")
      .replace(/\[REMEMBER\]/gi, "Remember.");

    // Strip any v3 delivery tags the model may have leaked into the script.
    // These tags are added by narrate-meditation — if they appear in the script
    // text itself the TTS system reads them aloud.
    const V3_DELIVERY_TAGS = /\[(softly|slow|warm|intimate|drawn out|whisper|fast|neutral|robust|creative|loud|quiet|serious|happy|sad|angry|fearful|surprised|disgust|calm|excited)\]/gi;
    // Strip em dashes and en dashes — they cause ElevenLabs to pause awkwardly
    // and bleed through into the narrated audio as unintended hesitations.
    const cleanedScript = withAnchorMarkers
      .replace(V3_DELIVERY_TAGS, "")
      .replace(/—/g, " ")
      .replace(/–/g, " ");
    const segmentTexts = splitIntoSegments(cleanedScript);
    const titles = ["Grounding", "Softening", "Dissolution", "The Proof", "The Scene", "Return"];
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
