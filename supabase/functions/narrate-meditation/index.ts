import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert Claude bracket pause markers into ElevenLabs v3 native [silence: Xs] tags.
// ElevenLabs v3 handles [silence: Xs] natively — no hallucination risk.
// Dots were previously used but caused hallucinations ("vad", "mavi", etc.)
// in dot-dense sections like Space of Nowhere. [silence: Xs] is the correct format.
function toNarrationText(raw: string): string {
  let s = raw;

  // Strip any SSML the model may have leaked in
  s = s.replace(/<\/?speak>/gi, "");
  s = s.replace(/<break\s+time="(\d+)s"\s*\/?>/gi, (_m, sec) => `[silence: ${sec}s]`);
  s = s.replace(/<[^>]+>/g, " ");

  // Convert bracket pause markers → ElevenLabs native silence tags
  s = s.replace(/\[long\s+pause\s+(\d{1,2})s\]/gi, (_m, sec) => `[silence: ${sec}s]`);
  s = s.replace(/\[pause\s+(\d{1,2})s\]/gi, (_m, sec) => `[silence: ${sec}s]`);
  // Generic fallback: any remaining [... Xs ...] pattern
  s = s.replace(/\[[^\]]*?(\d{1,2})s[^\]]*?\]/gi, (_m, sec) => `[silence: ${sec}s]`);

  // Strip any remaining bracket markers — but preserve [silence: Xs] tags
  s = s.replace(/\[(?!silence:)[^\]]*\]/g, "");

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
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=pcm_22050`,
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

    // Build a minimal 44-byte WAV header for 16-bit PCM mono.
    // ElevenLabs pcm_22050 returns raw signed 16-bit little-endian samples at
    // 22050 Hz mono — no container, no headers. We wrap all chunks in one WAV
    // so the browser can decode it with decodeAudioData() without any MP3
    // frame-boundary artifacts.
    const buildWavHeader = (dataByteLength: number): Uint8Array => {
      const SAMPLE_RATE = 22050;
      const NUM_CHANNELS = 1;
      const BITS_PER_SAMPLE = 16;
      const byteRate = SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8;
      const blockAlign = NUM_CHANNELS * BITS_PER_SAMPLE / 8;

      const header = new ArrayBuffer(44);
      const v = new DataView(header);
      // RIFF chunk descriptor
      v.setUint32(0,  0x52494646, false); // "RIFF"
      v.setUint32(4,  36 + dataByteLength, true); // file size - 8 bytes
      v.setUint32(8,  0x57415645, false); // "WAVE"
      // fmt sub-chunk
      v.setUint32(12, 0x666d7420, false); // "fmt "
      v.setUint32(16, 16, true);          // sub-chunk size (PCM = 16)
      v.setUint16(20, 1,  true);          // audio format (1 = PCM)
      v.setUint16(22, NUM_CHANNELS, true);
      v.setUint32(24, SAMPLE_RATE, true);
      v.setUint32(28, byteRate, true);
      v.setUint16(32, blockAlign, true);
      v.setUint16(34, BITS_PER_SAMPLE, true);
      // data sub-chunk
      v.setUint32(36, 0x64617461, false); // "data"
      v.setUint32(40, dataByteLength, true);
      return new Uint8Array(header);
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

    // Apply delivery tags only to the first chunk that contains actual spoken
    // words (letters). If the very first chunk is all dots/whitespace (a pure
    // pause), applying wrapV3 to it causes ElevenLabs v3 to produce a
    // vocalization artifact ("mavi", "ma", etc.) instead of silence.
    const firstWordIdx = groupedChunks.findIndex((c) => /[a-zA-Z]/.test(c));
    const chunks = groupedChunks.map((c, i) => i === firstWordIdx ? wrapV3(c, true) : c);
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

    // Concatenate all raw PCM chunks — no frame boundaries, no bit-reservoir
    // resets. Each chunk is just raw 16-bit samples; stitching is seamless.
    const totalPcmLength = rawBuffers.reduce((sum, b) => sum + b.byteLength, 0);
    const wavHeader = buildWavHeader(totalPcmLength);
    const audioBuffer = new Uint8Array(44 + totalPcmLength);
    audioBuffer.set(wavHeader, 0);
    let pcmOffset = 44;
    for (const buf of rawBuffers) {
      audioBuffer.set(buf, pcmOffset);
      pcmOffset += buf.byteLength;
    }

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/wav",
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
