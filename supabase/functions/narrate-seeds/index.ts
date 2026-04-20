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
    const { phrase, voiceId } = await req.json();

    if (!phrase || !voiceId) {
      return new Response(JSON.stringify({ error: "phrase and voiceId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const wrappedText = `[soft][slow][whisper]${phrase.trim()}[/whisper][/slow][/soft]`;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: wrappedText,
          model_id: "eleven_v3",
          voice_settings: {
            stability: 0.0,        // Creative — matches ElevenLabs UI
            similarity_boost: 0.85,
            style: 0,
            use_speaker_boost: false,
            speed: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs seed narration error:", response.status, errorText);

      if (response.status === 404) {
        return new Response(JSON.stringify({ 
          error: "voice_refresh_needed",
          message: "Your voice needs a refresh. It only takes a minute.",
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.detail?.status === "quota_exceeded") {
          return new Response(JSON.stringify({ error: "ElevenLabs credits too low." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {}

      throw new Error(`Seed narration failed: ${response.status}`);
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
    console.error("narrate-seeds error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
