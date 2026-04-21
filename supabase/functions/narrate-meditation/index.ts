import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, voiceId, segmentNumber, model, stability, style, speed } = await req.json();

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
    const elevenLabsVoiceId = requestedVoiceId || "9BDgg2Q7WSrW0x8naPLw";
    const modelId = typeof model === "string" && model.trim() ? model.trim() : "eleven_v3";
    const stabilityVal = typeof stability === "number" ? stability : 0.0;
    const styleVal = typeof style === "number" ? style : 0.0;
    const speedVal = typeof speed === "number" ? speed : 0.72;
    console.log(`Narrating segment ${segmentNumber || 'full'} voice=${elevenLabsVoiceId} model=${modelId} stab=${stabilityVal} style=${styleVal} speed=${speedVal}, len=${script.length}`);

    const doTTS = async (vid: string, text: string, prev?: string, next?: string) => {
      const wrapped = `[soft][slow][whisper]${text}[/whisper][/slow][/soft]`;
      const body: Record<string, unknown> = {
        text: wrapped,
        model_id: modelId,
        voice_settings: {
          stability: stabilityVal,
          similarity_boost: 0.85,
          style: styleVal,
          use_speaker_boost: false,
          speed: speedVal,
        },
      };
      // eleven_v3 does not support previous_text/next_text stitching
      const supportsStitching = !modelId.includes("v3");
      if (supportsStitching && prev) body.previous_text = prev;
      if (supportsStitching && next) body.next_text = next;
      return await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
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

    // Chunk script into ≤4500 char pieces, splitting at paragraph/sentence boundaries
    const MAX_CHARS = 4500;
    const chunkScript = (text: string): string[] => {
      if (text.length <= MAX_CHARS) return [text];
      const chunks: string[] = [];
      // Split by paragraphs first
      const paragraphs = text.split(/\n\n+/);
      let current = "";
      for (const p of paragraphs) {
        if ((current + "\n\n" + p).length <= MAX_CHARS) {
          current = current ? current + "\n\n" + p : p;
        } else {
          if (current) chunks.push(current);
          if (p.length <= MAX_CHARS) {
            current = p;
          } else {
            // Split paragraph by sentences
            const sentences = p.split(/(?<=[.!?])\s+/);
            current = "";
            for (const s of sentences) {
              if ((current + " " + s).length <= MAX_CHARS) {
                current = current ? current + " " + s : s;
              } else {
                if (current) chunks.push(current);
                current = s;
              }
            }
          }
        }
      }
      if (current) chunks.push(current);
      return chunks;
    };

    const chunks = chunkScript(script);
    console.log(`Split into ${chunks.length} chunk(s)`);

    const fallbackVoiceId = "9BDgg2Q7WSrW0x8naPLw";
    const audioBuffers: Uint8Array[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const prev = i > 0 ? chunks[i - 1].slice(-300) : undefined;
      const next = i < chunks.length - 1 ? chunks[i + 1].slice(0, 300) : undefined;

      let response = await doTTS(elevenLabsVoiceId, chunks[i], prev, next);

      if (response.status === 404 && requestedVoiceId) {
        return new Response(JSON.stringify({
          error: "Configured voice was not found in ElevenLabs. Please re-save the theme voice or paste a valid voice ID.",
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
        console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
        response = await doTTS(fallbackVoiceId, chunks[i], prev, next);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs error chunk ${i + 1}:`, response.status, errorText);

        if (response.status === 401) {
          return new Response(JSON.stringify({ error: "ElevenLabs authentication failed" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "ElevenLabs rate limit. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.detail?.status === "quota_exceeded") {
            return new Response(JSON.stringify({
              error: "Your ElevenLabs credits are too low. Please top up credits.",
            }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {}
        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
      }

      const rawAudio = new Uint8Array(await response.arrayBuffer());
      audioBuffers.push(audioBuffers.length === 0 ? rawAudio : stripId3Tag(rawAudio));
    }

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
