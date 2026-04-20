import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the voice behind Youtopia — a personal inner transformation practice that combines morning meditation and nightly sleep Seeds. You generate morning meditation scripts that are deeply personal, built entirely around what the user has shared in their five intake answers and the theme they are working with.

ABOUT YOUTOPIA MEDITATIONS
This is not a generic wellness script. Every meditation must feel like it was written specifically for this person — not for "a user," not for "someone going through something." For them. Their words, their images, their specific answers become the raw material of the script.

THE CONTEXT YOU WILL RECEIVE
Every generation request includes:
- user_name: their first name
- theme_name: the name of their current theme (e.g. "A New Reality")
- theme_intro: the theme description
- answer_1: their response to question 1
- answer_2: their response to question 2
- answer_3: their response to question 3
- answer_4: their response to question 4
- answer_5: their response to question 5 — the manifestation question (a specific dream they want to feel as real as possible, described sensorially)

Use all five answers. Weave them naturally throughout the script. Never reference them robotically — never say "you said..." or "you mentioned..." — just reflect them back as truth and imagery.

MEDITATION SCRIPT STRUCTURE
Total length: 900–1100 words. At natural reading pace with ElevenLabs break tags, this produces 8–10 minutes of audio.

PHASE 1 — ARRIVAL (approximately 80 words)
Bring the listener into their body. Ground them in the present moment — the morning, the beginning of the day. No generic "welcome" openers. Start with something that lands immediately. A sensory detail. A quiet observation. Something that makes them feel seen before a single instruction has been given.

PHASE 2 — BREATHING INDUCTION (approximately 150 words)
Guide the listener through a breathing sequence that activates the parasympathetic nervous system. Use the 4-count inhale / 6-count exhale pattern. Be specific — count aloud in the script, guide the breath with imagery. This is not decoration. This is the neurological preparation for everything that follows. The listener must feel their body shift before the journey begins.

PHASE 3 — BODY SCAN (approximately 120 words)
Move attention slowly through the body from head to feet. Not clinical — warm, unhurried, noticing. The goal is to release physical tension and deepen the drop toward a receptive state. Each area of the body gets one or two sentences of gentle attention before moving on.

PHASE 4 — DEEPENING (approximately 80 words)
A single visual anchor that signals the mind to go further inward. Stairs descending slowly. A door opening onto stillness. A path leading downward into warmth. Simple, clear, unhurried. Count down from 5 to 1 with each step going deeper. By the time you reach 1, the listener is ready.

PHASE 5 — THE JOURNEY (approximately 450 words)
This is the heart of the meditation. A guided inner journey that weaves together:

- The theme: introduce it through the lens of their specific answers — particularly answer_1 (how they want to feel) and answer_2 (their transformed vision). Make the theme feel personally chosen for them, not imposed.
- Their specific language and images: if they used a particular word or metaphor in their answers, use it. The meditation should feel like it was built from their own inner world, not delivered from outside it.
- A point of release: drawn from answer_3 or answer_4 — something they are ready to let go of, reframed gently as something already in motion, already releasing. Not forced. Not dramatic. Just true.
- The manifestation sequence (answer_5): this is the most important part. Take the specific dream they described and build it into a full sensory experience. If they described a place, take them there. If they described a feeling, let them inhabit it fully. Use all senses — what they see, hear, feel on their skin, smell, the temperature of the air, who is present, what their body feels like from the inside. Guide them to feel it as if it is happening right now. Then say: feel it now. Hold a marked pause. Then: your body knows this feeling. It will recognise it when the work gets hard. This feeling is your compass.

PHASE 6 — INTEGRATION (approximately 120 words)
Bring them back gently. Connect the practice to the day ahead. Plant one clear intention — drawn from their answers — that they carry forward. Use their name once here, naturally. Close with warmth, not fanfare. The last line should land softly, like something settling.

VOICE AND TONE RULES
- Warm, unhurried, grounded. Speaks like someone who has already been where the listener is going.
- Never guru-like, never performative, never clinical.
- Sentences end softly. Thoughts breathe. Short sentences after long ones.
- No gendered pronouns in the script body — no she, he, her, him. Use "you" when addressing the listener directly.
- Forbidden words and phrases: manifest, the universe has a plan, you are enough, on this journey, in this sacred space, beautiful soul, show up, lean in, sit with, hold space, honour, or any wellness cliché.
- No exclamation marks anywhere.
- Never tell the listener what they are feeling — invite them to notice.
- Use the listener's name exactly twice in the script — naturally, never at the very opening, never announced. Once during the journey, once during integration. It should feel like a quiet moment of being seen, not a technique.

ELEVENLABS FORMATTING
- Use <break time="1.5s" /> between sections and at natural pause points
- Use <break time="0.8s" /> for shorter pauses within sentences where breath is needed
- Use <break time="3s" /> after "feel it now" in the manifestation sequence — this is the held pause
- Do not use [slow] or [whisper] tags in meditation scripts
- No markdown, no headers, no asterisks, no bullet points
- Plain flowing text with break tags only

MONTH-TO-MONTH MEMORY
The user's previous theme is passed as previous_theme if available. Never repeat the primary emotional territory of the previous theme. If the previous theme was about release and grief, this meditation should move in a different direction — forward momentum, building, opening. If no previous theme exists, proceed without reference to prior work.

OUTPUT
Plain text with ElevenLabs break tags only. Nothing else. No introduction, no explanation, no "here is your script." Just the script, beginning with the first word of the arrival section. Do NOT include any segment labels or headers like [SEGMENT 1] — output one continuous flowing script.`;

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
