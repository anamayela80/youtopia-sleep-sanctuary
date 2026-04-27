import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert Claude bracket pause markers into ElevenLabs v3 audio-tag pacing
// plus ellipses (which the model interprets as natural pauses). We deliberately
// do NOT wrap in <speak> or use <break> SSML, eleven_v3 reads those literally
// or paces them poorly, which made the narration sound rushed and triggered
// hallucinated additions on long inputs.
//
// Dot density calibration:
//   ElevenLabs v3 with [slow][drawn out] delivery renders each dot at roughly
//   0.35–0.45 s. We use a modest increase over baseline to add breathing room
//   WITHOUT flooding the model with dots — dot-heavy inputs cause hallucination
//   in the Space of Nowhere section where phrases are short and pauses are long.
//   Duration is primarily controlled by the music bridge lengths in the mixer.
//
//   Mapping (target → dots → expected render):
//     ≤4s  →  7 dots  → ~2.5–3 s
//      6s  → 10 dots  → ~3.5–4.5 s
//     10s  → 14 dots  → ~5–6 s
//     12s  → 17 dots  → ~6–7.5 s
//     15s  → 19 dots  → ~7–8.5 s
//     20s  → 21 dots  → ~7.5–9.5 s
function pausesFor(seconds: number): string {
  if (seconds <= 4)  return " ....... ";
  if (seconds <= 6)  return " .......... ";
  if (seconds <= 10) return " .............. ";
  if (seconds <= 14) return " ................. ";
  return " ..................... ";
}

function toNarrationText(raw: string): string {
  let s = raw;

  // Strip any SSML the model may have leaked in
  s = s.replace(/<\/?speak>/gi, "");
  s = s.replace(/<break\s+time="(\d+)s"\s*\/?>/gi, (_m, sec) => pausesFor(parseInt(sec, 10)));
  s = s.replace(/<[^>]+>/g, " "); // remove any other stray tags

  // Convert all bracket pause markers to ellipsis pacing
  s = s.replace(/\[[^\]]*?(\d{1,2})s[^\]]*?\]/gi, (_m, sec) => pausesFor(parseInt(sec, 10)));

  // Strip any remaining bracket markers (so they aren't read aloud)
  s = s.replace(/\[[^\]]*\]/g, "");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

// Wrap each chunk for v3 with calm pacing tags. These ARE interpreted by
// eleven_v3 as delivery hints (not read aloud). [softly] + [slow] +
// [warm] + [drawn out] keep the delivery intimate and unhurried.
function wrapV3(text: string, isFirst: boolean): string {
  // [intimate] + [drawn out] lean hard into the soulful, unhurried delivery
  // the user wants during the vision section. Applied to every chunk so the
  // pacing doesn't snap back to neutral mid-meditation.
  const opener = isFirst
    ? "[softly][slow][warm][intimate][drawn out] "
    : "[softly][slow][warm][intimate] ";
  return `${opener}${text}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, voiceId, segmentNumber } = await req.json();

    if (!script) {
      return new Response(JSON.stringify({ error: "Script text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const requestedVoiceId = typeof voiceId === "string" && voiceId.trim().length > 0
      ? voiceId.trim()
      : null;
    const fallbackVoiceId = "9BDgg2Q7WSrW0x8naPLw";
    const elevenLabsVoiceId = requestedVoiceId || fallbackVoiceId;
    const modelId = "eleven_v3";

    console.log(`Narrating segment ${segmentNumber || 'full'} voice=${elevenLabsVoiceId} model=${modelId}, script length=${script.length}`);

    const doTTS = async (vid: string, text: string) => {
      return await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              // Eleven v3 maps stability to 3 presets: Creative=0, Neutral=0.5,
              // Robust=1. Creative (0.0) is correct for meditation — it lets
              // the [intimate][drawn out][softly][slow] v3 tags take full
              // effect. Pacing is controlled by speed: 0.80 + the [slow]
              // tag, so we don't need stability to slow things down.
              stability: 0.0,
              similarity_boost: 0.85,
              style: 0,
              speed: 0.80,
              use_speaker_boost: true,
            },
          }),
        }
      );
    };

    const stripId3Tag = (buffer: Uint8Array) => {
      if (buffer.length < 10) return buffer;
      if (buffer[0] !== 0x49 || buffer[1] !== 0x44 || buffer[2] !== 0x33) return buffer;
      const size =
        ((buffer[6] & 0x7f) << 21) |
        ((buffer[7] & 0x7f) << 14) |
        ((buffer[8] & 0x7f) << 7) |
        (buffer[9] & 0x7f);
      const footerSize = (buffer[5] & 0x10) !== 0 ? 10 : 0;
      const offset = Math.min(buffer.length, 10 + size + footerSize);
      return buffer.slice(offset);
    };

    // Per-phrase chunking (2-3 lines per call) to prevent hallucination while
    // avoiding start-of-call audio artifacts.
    //
    // WHY NOT one-phrase-per-call:
    //   Applying wrapV3 delivery tags ([softly][slow][warm][intimate]) to every
    //   individual phrase causes ElevenLabs v3 to produce a small vocalization
    //   artifact at the start of each call. Stitched together, these sound like
    //   random syllables ("jana", "ma", "do") between every spoken line.
    //
    // WHY NOT paragraph chunks:
    //   Large chunks (400-1200 chars) of dot-heavy Space of Nowhere text cause
    //   the model to hallucinate filler text mid-passage.
    //
    // SOLUTION: Group 2-3 phrases per call (max 280 chars), NO delivery tags.
    //   - Short enough to prevent hallucination
    //   - Fewer stitching points (~10-13 vs 26+) = fewer artifact opportunities
    //   - Delivery style controlled entirely by voice_settings (stability=0.0
    //     Creative + speed=0.80 already produces intimate, slow narration)
    //   - wrapV3 applied only to the very first chunk to set initial tone

    const rawLines = (script as string)
      .replace(/\[segment break\]/gi, "")
      .split(/\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => toNarrationText(line))
      .filter((line: string) => line.replace(/[\s.]/g, "").length > 0);

    const MAX_CHUNK_CHARS = 280;
    const groupedChunks: string[] = [];
    let current = "";
    for (const line of rawLines) {
      if (current && (current + " " + line).length > MAX_CHUNK_CHARS) {
        groupedChunks.push(current.trim());
        current = line;
      } else {
        current = current ? current + " " + line : line;
      }
    }
    if (current.trim()) groupedChunks.push(current.trim());

    // Apply delivery tags to the first chunk only — sets the opening tone
    // without risking artifacts on every subsequent stitch point.
    const chunks = groupedChunks.map((c, i) => i === 0 ? wrapV3(c, true) : c);
    console.log(`Split into ${chunks.length} chunk(s)`);

    const processChunk = async (chunkText: string, idx: number): Promise<Uint8Array> => {
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let response = await doTTS(elevenLabsVoiceId, chunkText);

        if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
          console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
          response = await doTTS(fallbackVoiceId, chunkText);
        }

        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }

        const errorText = await response.text();
        console.error(`ElevenLabs error chunk ${idx + 1} (attempt ${attempt}):`, response.status, errorText);

        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.detail?.status === "quota_exceeded") {
            throw new Error("QUOTA_EXCEEDED");
          }
        } catch (e) {
          if (e instanceof Error && e.message === "QUOTA_EXCEEDED") throw e;
        }

        // Retry on 429 (concurrent limit) and 5xx with jittered backoff
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          const backoff = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
      }
      throw new Error("ElevenLabs TTS failed: retries exhausted");
    };

    // Run chunks with limited concurrency. ElevenLabs caps free/starter plans
    // at 10 concurrent requests — going over yields 429 concurrent_limit_exceeded.
    // Cap at 8 to leave headroom for any other in-flight calls (e.g. seeds).
    const CONCURRENCY = 8;
    let rawBuffers: Uint8Array[];
    try {
      const results: Uint8Array[] = new Array(chunks.length);
      let nextIdx = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, async () => {
        while (true) {
          const i = nextIdx++;
          if (i >= chunks.length) return;
          results[i] = await processChunk(chunks[i], i);
        }
      });
      await Promise.all(workers);
      rawBuffers = results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      if (msg === "QUOTA_EXCEEDED") {
        return new Response(JSON.stringify({
          error: "Your ElevenLabs credits are too low. Please top up credits.",
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw err;
    }

    const audioBuffers = rawBuffers.map((b, i) => i === 0 ? b : stripId3Tag(b));


    const totalLength = audioBuffers.reduce((sum, b) => sum + b.byteLength, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      audioBuffer.set(buf, offset);
      offset += buf.byteLength;
    }

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (e) {
    console.error("narrate-meditation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
