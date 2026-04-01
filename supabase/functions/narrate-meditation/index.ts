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
    const { script, voiceId } = await req.json();

    if (!script || !voiceId) {
      return new Response(JSON.stringify({ error: "Script and voiceId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Map friendly voice IDs to ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      sofia: "EXAVITQu4vr4xnSDxMaL",   // Sarah - warm and gentle
      james: "JBFqnCBsd6RMkjVDRZzb",    // George - deep and calming
      aria: "FGY2WhTYpPnrIDTdsKH5",     // Laura - soft and soothing
      marco: "TX3LPaxmHKxFdv7VOQHJ",    // Liam - smooth and grounding
    };

    // If voiceId is in the map, use the mapped value; otherwise treat it as a direct ElevenLabs voice ID (e.g. cloned voice)
    const isClonedVoice = !voiceMap[voiceId];
    const elevenLabsVoiceId = voiceMap[voiceId] || voiceId;
    console.log("Using voice:", voiceId, "→ ElevenLabs ID:", elevenLabsVoiceId, "isCloned:", isClonedVoice);

    // Clean script: remove [pause] and [breathe] markers, replace with natural pauses
    const cleanedScript = script
      .replace(/\[pause\]/gi, "...")
      .replace(/\[breathe\]/gi, "... Take a slow, deep breath ...");

    // Try TTS, fallback to default voice on 404
    const fallbackVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - reliable default
    
    const doTTS = async (vid: string) => {
      return await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: cleanedScript,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
              speed: 0.85,
            },
          }),
        }
      );
    };

    let response = await doTTS(elevenLabsVoiceId);

    // If voice not found, retry with fallback
    if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
      console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
      response = await doTTS(fallbackVoiceId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "ElevenLabs authentication failed" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "ElevenLabs rate limit. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`ElevenLabs TTS failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
