import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SAMPLE_RATE = 22050; // matches pcm_22050 output from ElevenLabs

// ── Silence generator ────────────────────────────────────────────────────────
// [pause:N] markers → exact N seconds of silent PCM. Never sent to ElevenLabs.
function generateSilence(seconds: number): Uint8Array {
  // 16-bit mono PCM: 2 bytes per sample, all zeros = silence
  return new Uint8Array(Math.floor(SAMPLE_RATE * seconds) * 2);
}

// ── Echo phrases ─────────────────────────────────────────────────────────────
// "Feel it." and "Remember." get a warm hall reverb tail after TTS.
const ECHO_PHRASES = new Set(["feel it.", "feel it", "remember.", "remember"]);

function isEchoPhrase(text: string): boolean {
  return ECHO_PHRASES.has(text.trim().toLowerCase());
}

// ── Reverb / echo ────────────────────────────────────────────────────────────
// Three delay taps — close reflection, mid room, far fade — ~0.9 s tail.
function applyEcho(pcmBytes: Uint8Array): Uint8Array {
  const taps = [
    { delayMs: 120, gain: 0.50 },
    { delayMs: 300, gain: 0.28 },
    { delayMs: 520, gain: 0.14 },
  ];
  const tailSamples = Math.floor(SAMPLE_RATE * 0.9);
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
  const output  = new Int16Array(samples.length + tailSamples);

  for (let i = 0; i < samples.length; i++) output[i] = samples[i];

  for (const tap of taps) {
    const delay = Math.floor((SAMPLE_RATE * tap.delayMs) / 1000);
    for (let i = 0; i < samples.length; i++) {
      const idx = i + delay;
      if (idx < output.length) {
        const mixed = output[idx] + Math.round(samples[i] * tap.gain);
        output[idx] = Math.max(-32768, Math.min(32767, mixed));
      }
    }
  }
  return new Uint8Array(output.buffer);
}

// ── Pause marker cleanup for ElevenLabs text ─────────────────────────────────
// Converts bracket pause markers to ElevenLabs native [silence: Xs] tags.
// [pause:N] markers are extracted BEFORE this step (handled as PCM silence).
function toNarrationText(raw: string): string {
  let s = raw;

  // Strip SSML the model may have leaked
  s = s.replace(/<\/?speak>/gi, "");
  s = s.replace(/<break\s+time="(\d+)s"\s*\/?>/gi, (_m, sec) => `[silence: ${sec}s]`);
  s = s.replace(/<[^>]+>/g, " ");

  // Convert bracket pause markers → ElevenLabs native silence tags
  s = s.replace(/\[long\s+pause\s+(\d{1,2})s\]/gi, (_m, sec) => `[silence: ${sec}s]`);
  s = s.replace(/\[pause\s+(\d{1,2})s\]/gi, (_m, sec) => `[silence: ${sec}s]`);
  s = s.replace(/\[[^\]]*?(\d{1,2})s[^\]]*?\]/gi, (_m, sec) => `[silence: ${sec}s]`);

  // Strip remaining brackets but preserve [silence: Xs]
  s = s.replace(/\[(?!silence:)[^\]]*\]/g, "");

  return s.replace(/\s+/g, " ").trim();
}

// ── Delivery tag wrapper ──────────────────────────────────────────────────────
// First chunk of segment: full pacing set. Echo phrases: [softly] only.
// Everything else: no tags (stability=0.0 Creative already sets the tone).
function wrapV3(text: string, isFirst: boolean): string {
  if (isFirst) return `[softly][slow][warm][intimate][drawn out] ${text}`;
  if (isEchoPhrase(text)) return `[softly] ${text}`;
  return `[softly][slow][warm][intimate] ${text}`;
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

    // ── Step 1: Parse lines into typed tokens ─────────────────────────────
    // [pause:N] lines  → silence tokens (real PCM silence, no ElevenLabs call)
    // Echo phrases     → solo TTS tokens (isolated so echo is applied cleanly)
    // Everything else  → text tokens (grouped into ≤280-char chunks below)

    type SilenceToken = { kind: "silence"; seconds: number };
    type TtsToken     = { kind: "tts"; text: string; isEcho: boolean };
    type Token        = SilenceToken | TtsToken;

    const rawLines = (script as string)
      .replace(/\[segment break\]/gi, "")
      .split(/\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const parsedTokens: Token[] = [];
    for (const line of rawLines) {
      const pauseMatch = line.match(/^\[pause:(\d+)\]$/i);
      if (pauseMatch) {
        parsedTokens.push({ kind: "silence", seconds: parseInt(pauseMatch[1]) });
        continue;
      }
      const processed = toNarrationText(line);
      if (processed.replace(/[\s.]/g, "").length === 0) continue;
      parsedTokens.push({ kind: "tts", text: processed, isEcho: isEchoPhrase(line) });
    }

    // ── Step 2: Group text tokens into ≤280-char chunks ───────────────────
    // Silence tokens and echo phrases are never merged — each stays solo.
    const MAX_CHUNK_CHARS = 280;
    const queue: Token[] = [];
    let currentText = "";

    const flushText = () => {
      if (!currentText.trim()) return;
      queue.push({ kind: "tts", text: currentText.trim(), isEcho: false });
      currentText = "";
    };

    for (const token of parsedTokens) {
      if (token.kind === "silence") { flushText(); queue.push(token); continue; }
      if (token.isEcho)             { flushText(); queue.push(token); continue; }
      const merged = currentText ? currentText + " " + token.text : token.text;
      if (currentText && merged.length > MAX_CHUNK_CHARS) { flushText(); currentText = token.text; }
      else currentText = merged;
    }
    flushText();

    // ── Step 3: Apply wrapV3 delivery tags to TTS items ───────────────────
    // First TTS item with actual letters gets the full pacing opener.
    const firstTtsIdx = queue.findIndex(
      (item) => item.kind === "tts" && /[a-zA-Z]/.test((item as TtsToken).text)
    );
    const taggedQueue = queue.map((item, i) => {
      if (item.kind !== "tts") return item;
      return { ...item, text: wrapV3(item.text, i === firstTtsIdx) } as TtsToken;
    });

    console.log(
      `Queue: ${taggedQueue.length} items — ` +
      `${taggedQueue.filter((q) => q.kind === "tts").length} TTS, ` +
      `${taggedQueue.filter((q) => q.kind === "silence").length} silence`
    );

    // ── Step 4: TTS helper ─────────────────────────────────────────────────
    const processTtsItem = async (text: string, idx: number): Promise<Uint8Array> => {
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let response = await doTTS(elevenLabsVoiceId, text);
        if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
          console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
          response = await doTTS(fallbackVoiceId, text);
        }
        if (response.ok) return new Uint8Array(await response.arrayBuffer());

        const errorText = await response.text();
        console.error(`ElevenLabs error item ${idx} attempt ${attempt}:`, response.status, errorText);
        try {
          if (JSON.parse(errorText)?.detail?.status === "quota_exceeded") throw new Error("QUOTA_EXCEEDED");
        } catch (e) { if (e instanceof Error && e.message === "QUOTA_EXCEEDED") throw e; }

        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400)));
          continue;
        }
        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
      }
      throw new Error("ElevenLabs TTS failed: retries exhausted");
    };

    // ── Step 5: Process queue — silence sync, TTS concurrent ──────────────
    const CONCURRENCY = 8;
    const orderedResults: Uint8Array[] = new Array(taggedQueue.length);

    // Fill silence slots immediately (no async needed)
    for (let i = 0; i < taggedQueue.length; i++) {
      const item = taggedQueue[i];
      if (item.kind === "silence") orderedResults[i] = generateSilence(item.seconds);
    }

    // TTS slots: process with concurrency pool, apply echo where flagged
    const ttsIndices = taggedQueue
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.kind === "tts")
      .map(({ i }) => i);

    let nextTts = 0;
    let rawBuffers: Uint8Array[];
    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, ttsIndices.length) }, async () => {
          while (true) {
            const local = nextTts++;
            if (local >= ttsIndices.length) return;
            const qi   = ttsIndices[local];
            const item = taggedQueue[qi] as TtsToken;
            let pcm    = await processTtsItem(item.text, qi);
            if (item.isEcho) pcm = applyEcho(pcm);
            orderedResults[qi] = pcm;
          }
        })
      );
      rawBuffers = orderedResults;
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
