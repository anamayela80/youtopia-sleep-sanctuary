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
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Audio file is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read audio file bytes
    const audioBytes = await audioFile.arrayBuffer();
    console.log("Audio file size:", audioBytes.byteLength, "type:", audioFile.type);

    // Create instant voice clone via ElevenLabs
    const cloneForm = new FormData();
    cloneForm.append("name", `youtopia-clone-${Date.now()}`);
    cloneForm.append("files", new File([audioBytes], audioFile.name || "voice-sample.webm", { type: audioFile.type || "audio/webm" }));
    cloneForm.append("remove_background_noise", "true");
    cloneForm.append("description", "Temporary voice clone for YOUTOPIA meditation");

    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: cloneForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs clone error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "ElevenLabs authentication failed" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Voice cloning failed: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ voiceId: data.voice_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clone-voice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
