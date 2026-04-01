import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const moodPrompts: Record<string, string> = {
  "deep-sleep":
    "Very slow, extremely soft ambient drone music for deep sleep. Minimal melody, gentle pads, low frequency warmth, no percussion, no vocals. Calming and hypnotic.",
  "calm-mind":
    "Gentle ambient soundscape for relaxation. Soft piano notes with warm reverb, light atmospheric textures, peaceful and meditative. No percussion, no vocals.",
  "inner-peace":
    "Soft nature-inspired ambient music with gentle rain-like textures and birdsong undertones. Peaceful flute and pad sounds, very slow tempo, serene and grounding.",
  "confidence":
    "Warm, uplifting ambient music with gentle harmonic progressions. Soft strings and bright pads, hopeful and empowering feeling. Slow tempo, no percussion, no vocals.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mood } = await req.json();

    if (!mood || !moodPrompts[mood]) {
      return new Response(
        JSON.stringify({ error: "Invalid mood. Use: deep-sleep, calm-mind, inner-peace, confidence" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    console.log("Generating music for mood:", mood);

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: moodPrompts[mood],
        duration_seconds: 120,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs music error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "ElevenLabs authentication failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Music generation failed: ${response.status}`);
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
    console.error("generate-music error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
