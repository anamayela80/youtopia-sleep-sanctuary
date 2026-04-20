import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { voiceId, model, stability, style, speed, text } = await req.json();
    if (!voiceId) {
      return new Response(JSON.stringify({ error: "voiceId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const sample = (typeof text === "string" && text.trim())
      ? text.trim()
      : "Take a slow breath in. And gently release. You are exactly where you need to be.";
    const wrapped = `[soft][slow]${sample}[/slow][/soft]`;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: wrapped,
          model_id: typeof model === "string" && model.trim() ? model.trim() : "eleven_v3",
          voice_settings: {
            stability: typeof stability === "number" ? stability : 0.0,
            similarity_boost: 0.85,
            style: typeof style === "number" ? style : 0.0,
            use_speaker_boost: false,
            speed: typeof speed === "number" ? speed : 0.85,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("preview-voice error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Preview failed (${response.status})` }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await response.arrayBuffer();
    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("preview-voice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
