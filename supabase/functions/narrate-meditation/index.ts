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
    const { script, voiceId, segmentNumber } = await req.json();

    if (!script) {
      return new Response(JSON.stringify({ error: "Script text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    // Use the provided voiceId (guide voice from admin) or default
    const elevenLabsVoiceId = voiceId || "9BDgg2Q7WSrW0x8naPLw";
    console.log(`Narrating segment ${segmentNumber || 'full'} with voice ${elevenLabsVoiceId}, text length: ${script.length}`);

    const doTTS = async (vid: string, text: string) => {
      // Wrap in slow+breathe tags for v3 meditative delivery
      const wrappedText = `[slow][breathe]${text}[/breathe][/slow]`;
      return await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: wrappedText,
            model_id: "eleven_multilingual_v3",
            voice_settings: {
              stability: 0.85,
              similarity_boost: 0.75,
              style: 0.05,
              use_speaker_boost: true,
            },
          }),
        }
      );
    };

    let response = await doTTS(elevenLabsVoiceId, script);

    // Fallback to default if voice not found
    const fallbackVoiceId = "9BDgg2Q7WSrW0x8naPLw";
    if (response.status === 404 && elevenLabsVoiceId !== fallbackVoiceId) {
      console.warn(`Voice ${elevenLabsVoiceId} not found, falling back to default`);
      response = await doTTS(fallbackVoiceId, script);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);

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

      // Check for quota exceeded
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
