import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert Claude bracket pause markers → SSML <break> tags.
// Wrap in <speak>…</speak>. Strip any leftover bracket markers as a safety net.
function toSSML(raw: string): string {
  let s = raw;
  const replacements: [RegExp, string][] = [
    [/\[pause\s*4s\]/gi, '<break time="4s"/>'],
    [/\[pause\s*5s\]/gi, '<break time="5s"/>'],
    [/\[pause\s*6s\]/gi, '<break time="6s"/>'],
    [/\[vision\s*pause\s*10s\]/gi, '<break time="10s"/>'],
    [/\[long\s*pause\s*8s\]/gi, '<break time="8s"/>'],
    [/\[long\s*pause\s*15s\]/gi, '<break time="15s"/>'],
    [/\[affirm\s*pause\s*6s\]/gi, '<break time="6s"/>'],
    [/\[seed\s*pause\s*6s\]/gi, '<break time="6s"/>'],
  ];
  for (const [re, val] of replacements) s = s.replace(re, val);
  // Generic safety: any remaining [pause Ns] / [... Ns]
  s = s.replace(/\[[^\]]*?(\d{1,2})s[^\]]*?\]/gi, (_m, sec) => `<break time="${sec}s"/>`);
  // Strip any remaining bracket markers entirely so they aren't read aloud
  s = s.replace(/\[[^\]]*\]/g, "");
  return `<speak>${s.trim()}</speak>`;
}

function stripSSML(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
              style: 0,
              speed: 0.72,
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

    // Convert pause markers → SSML before chunking. Chunk on natural section boundaries
    // (use long breaks as splitters) to keep each chunk under ElevenLabs limits.
    let ssmlScript: string;
    try {
      ssmlScript = toSSML(script);
    } catch (e) {
      console.error("SSML conversion failed, falling back to plain text:", e);
      ssmlScript = `<speak>${stripSSML(script)}</speak>`;
    }

    const MAX_CHARS = 1500;
    const chunkScript = (text: string): string[] => {
      const inner = text.replace(/^<speak>/i, "").replace(/<\/speak>$/i, "");
      if (inner.length <= MAX_CHARS) return [`<speak>${inner}</speak>`];

      const chunks: string[] = [];
      // Split on any break tag as natural boundaries
      const parts = inner.split(/(<break time="\d+s"\s*\/>)/i);
      let current = "";
      for (const part of parts) {
        if ((current + part).length <= MAX_CHARS) {
          current += part;
        } else {
          if (current.trim()) chunks.push(`<speak>${current}</speak>`);
          if (part.length > MAX_CHARS) {
            const sentences = part.split(/(?<=[.!?])\s+/);
            current = "";
            for (const s of sentences) {
              if ((current + " " + s).length <= MAX_CHARS) {
                current = current ? current + " " + s : s;
              } else {
                if (current.trim()) chunks.push(`<speak>${current}</speak>`);
                current = s;
              }
            }
          } else {
            current = part;
          }
        }
      }
      if (current.trim()) chunks.push(`<speak>${current}</speak>`);
      return chunks;
    };

    const chunks = chunkScript(ssmlScript);
    console.log(`Split into ${chunks.length} chunk(s)`);

    const processChunk = async (chunkText: string, idx: number): Promise<Uint8Array> => {
      let response = await doTTS(elevenLabsVoiceId, chunkText);

      if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
        console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
        response = await doTTS(fallbackVoiceId, chunkText);
      }

      if (response.status === 400) {
        const errBody = await response.text();
        console.warn(`SSML rejected on chunk ${idx + 1}, retrying as plain text:`, errBody);
        const plain = stripSSML(chunkText);
        response = await doTTS(elevenLabsVoiceId, plain);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs error chunk ${idx + 1}:`, response.status, errorText);
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.detail?.status === "quota_exceeded") {
            throw new Error("QUOTA_EXCEEDED");
          }
        } catch (e) {
          if (e instanceof Error && e.message === "QUOTA_EXCEEDED") throw e;
        }
        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    };

    // Run all chunks in parallel to stay under the edge function timeout
    let rawBuffers: Uint8Array[];
    try {
      rawBuffers = await Promise.all(chunks.map((c, i) => processChunk(c, i)));
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
