import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert Claude bracket pause markers into ElevenLabs v3 audio-tag pacing
// plus ellipses (which the model interprets as natural pauses). We deliberately
// do NOT wrap in <speak> or use <break> SSML — eleven_v3 reads those literally
// or paces them poorly, which made the narration sound rushed and triggered
// hallucinated additions on long inputs.
//
// Mapping:
//   short pauses (≤5s)  → " ... "        (one ellipsis ≈ short beat)
//   medium pauses (6s)  → " ...... "     (longer beat)
//   long pauses (8s+)   → " ......... "  (extended beat)
// Every chunk is wrapped with [soft][slow] so the whole delivery stays calm.
function pausesFor(seconds: number): string {
  if (seconds <= 4) return " ... ";
  if (seconds <= 6) return " ...... ";
  if (seconds <= 10) return " ......... ";
  return " ............ ";
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
  const opener = isFirst ? "[softly][slow][warm][drawn out] " : "[softly][slow][warm] ";
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
              stability: 0.6,
              similarity_boost: 0.85,
              style: 0,
              speed: 0.85,
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

    // Convert pause markers → ellipsis pacing (no SSML).
    const narrationText = toNarrationText(script);

    // Chunk on sentence boundaries to keep each request small. eleven_v3 can
    // hallucinate / drift on very long inputs, so we keep chunks tight.
    const MAX_CHARS = 1200;
    const chunkScript = (text: string): string[] => {
      if (text.length <= MAX_CHARS) return [text];
      const chunks: string[] = [];
      const sentences = text.split(/(?<=[.!?])\s+/);
      let current = "";
      for (const s of sentences) {
        if ((current + " " + s).trim().length <= MAX_CHARS) {
          current = current ? current + " " + s : s;
        } else {
          if (current.trim()) chunks.push(current.trim());
          current = s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks;
    };

    const chunks = chunkScript(narrationText).map(wrapV3);
    console.log(`Split into ${chunks.length} chunk(s)`);

    const processChunk = async (chunkText: string, idx: number): Promise<Uint8Array> => {
      let response = await doTTS(elevenLabsVoiceId, chunkText);

      if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
        console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
        response = await doTTS(fallbackVoiceId, chunkText);
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
