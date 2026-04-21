import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSSML(phrase: string, _index: number): string {
  // All seeds use the same gentle whisper tags — matches the working config from ElevenLabs UI.
  return `[whisper] [slow] ${phrase.trim()}`;
}

async function callTTS(voiceId: string, ssml: string, apiKey: string) {
  return await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ssml,
        model_id: "eleven_v3",
        // Creative mode: stability 0 = maximum expressiveness, lets [whisper] tag fully take effect.
        voice_settings: {
          stability: 0,
          similarity_boost: 0.75,
          style: 0,
          speed: 0.75,
          use_speaker_boost: true,
        },
      }),
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phrase, voiceId, index } = await req.json();

    if (!phrase || !voiceId) {
      return new Response(JSON.stringify({ error: "phrase and voiceId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const idx = typeof index === "number" ? index : 0;
    const ssml = buildSSML(phrase, idx);

    // First attempt
    let response = await callTTS(voiceId, ssml, ELEVENLABS_API_KEY);

    // Retry once after 2 seconds on transient failure
    if (!response.ok && response.status !== 404 && response.status !== 401 && response.status !== 402) {
      console.warn(`Seed ${idx + 1} TTS failed (${response.status}), retrying in 2s`);
      await new Promise((r) => setTimeout(r, 2000));
      response = await callTTS(voiceId, ssml, ELEVENLABS_API_KEY);
    }

    // SSML rejected → strip tags and retry as plain text
    if (response.status === 400) {
      const errBody = await response.text();
      console.warn(`Seed SSML rejected, retrying as plain text:`, errBody);
      response = await callTTS(voiceId, phrase.trim(), ELEVENLABS_API_KEY);
    }

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
