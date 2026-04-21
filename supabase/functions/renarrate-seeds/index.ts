import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { preference } = await req.json(); // 'clone' | 'preset'
    if (preference !== "clone" && preference !== "preset") {
      return new Response(JSON.stringify({ error: "Invalid preference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Latest seeds row
    const { data: seedsRow } = await supabase
      .from("seeds").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!seedsRow) {
      return new Response(JSON.stringify({ error: "No seeds found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve voice
    const { data: clone } = await supabase
      .from("user_voice_clones").select("elevenlabs_voice_id").eq("user_id", user.id).maybeSingle();
    const { data: theme } = seedsRow.theme_id
      ? await supabase.from("monthly_themes").select("seed_voice_id, guide_voice_id, voice_id, voice_model, voice_stability, voice_style").eq("id", seedsRow.theme_id).maybeSingle()
      : { data: null as any };
    const { data: settings } = await supabase
      .from("app_settings").select("default_voice_id, default_voice_model, default_voice_stability, default_voice_style").maybeSingle();

    const presetVoiceId =
      theme?.seed_voice_id ||
      theme?.guide_voice_id ||
      theme?.voice_id ||
      settings?.default_voice_id ||
      "zA6D7RyKdc2EClouEMkP";

    let voiceId: string;
    if (preference === "preset") {
      voiceId = presetVoiceId;
    } else {
      if (!clone?.elevenlabs_voice_id) {
        return new Response(JSON.stringify({ error: "No voice clone on file" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      voiceId = clone.elevenlabs_voice_id;
    }

    const phrases = [seedsRow.phrase_1, seedsRow.phrase_2, seedsRow.phrase_3, seedsRow.phrase_4, seedsRow.phrase_5];
    const newUrls: (string | null)[] = [null, null, null, null, null];

    const buildSSML = (phrase: string, i: number) => {
      const isWhisper = i % 2 === 0; // seeds 1,3,5 whisper; 2,4 soft
      const t = phrase.trim();
      return isWhisper
        ? `<speak><prosody rate="x-slow">[whisper]${t}[/whisper]</prosody></speak>`
        : `<speak><prosody rate="slow" volume="soft">${t}</prosody></speak>`;
    };

    const callTTS = async (text: string) => fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_v3",
          voice_settings: { style: 0, speed: 0.75, use_speaker_boost: true },
        }),
      }
    );

    for (let i = 0; i < 5; i++) {
      const phrase = phrases[i];
      if (!phrase) continue;
      let ttsRes = await callTTS(buildSSML(phrase, i));
      if (!ttsRes.ok && ttsRes.status !== 401 && ttsRes.status !== 402) {
        await new Promise((r) => setTimeout(r, 2000));
        ttsRes = await callTTS(buildSSML(phrase, i));
      }
      if (ttsRes.status === 400) {
        // SSML rejected, fall back to plain text
        ttsRes = await callTTS(phrase.trim());
      }
      if (!ttsRes.ok) {
        const err = await ttsRes.text();
        console.error(`Seed ${i + 1} TTS failed:`, ttsRes.status, err);
        throw new Error(`Voice narration failed (seed ${i + 1})`);
      }
      const buf = await ttsRes.arrayBuffer();
      const path = `${user.id}/seeds/${seedsRow.month}-seed${i + 1}-${preference}-${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage
        .from("meditations")
        .upload(path, buf, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("meditations").getPublicUrl(path);
      newUrls[i] = pub.publicUrl;
    }

    await supabase.from("seeds").update({
      audio_url_1: newUrls[0],
      audio_url_2: newUrls[1],
      audio_url_3: newUrls[2],
      audio_url_4: newUrls[3],
      audio_url_5: newUrls[4],
    }).eq("id", seedsRow.id);

    await supabase.from("profiles").update({ seed_voice_preference: preference }).eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("renarrate-seeds error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
