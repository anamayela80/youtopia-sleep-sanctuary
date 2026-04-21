import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { question, answer, questionNumber, intakeId } = await req.json();
    if (!question || !answer || !intakeId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compute mood_context: average mood score from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentCheckins } = await supabase
      .from("checkins")
      .select("mood_score")
      .eq("user_id", user.id)
      .gte("checkin_date", sevenDaysAgo.toISOString().slice(0, 10));

    let moodContext: number | null = null;
    if (recentCheckins && recentCheckins.length > 0) {
      moodContext = recentCheckins.reduce((s: number, c: any) => s + c.mood_score, 0) / recentCheckins.length;
    }

    let toneInstruction = "warm and steady, grounded in the present";
    if (moodContext !== null) {
      if (moodContext <= 2) toneInstruction = "softer, more nurturing, focused on self-compassion and gentleness";
      else if (moodContext >= 4) toneInstruction = "expansive, forward-looking, focused on possibility and identity growth";
    }

    // Load intake + theme + answers + seeds
    const { data: intake } = await supabase
      .from("user_monthly_intakes")
      .select("*, monthly_themes(*)")
      .eq("id", intakeId)
      .maybeSingle();
    if (!intake) throw new Error("Intake not found");

    const { data: ans } = await supabase
      .from("user_answers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const firstName = (prof?.full_name || "").split(" ")[0] || "friend";
    const themeName = intake.monthly_themes?.theme || "Your Practice";

    const systemPrompt = `You are a meditation guide writing a single Seed (a personal whispered affirmation).

Chapter theme: "${themeName}"
User's name: ${firstName}
Onboarding answers:
1. ${ans?.question_1 || ""}
2. ${ans?.question_2 || ""}
3. ${ans?.question_3 || ""}

Mid-month check-in question asked: "${question}"
User's answer: "${answer}"

Tone instruction (based on the user's recent mood): ${toneInstruction}

Write ONE Seed only. Rules:
- Personal, present tense, identity-level (e.g. "I am...", "I belong...", "I trust...")
- Maximum 25 words
- Warm and grounded — never exaggerated, generic, or performative
- Never use the word "affirmation"
- Plain text only, no quotes, no labels, just the Seed itself.`;

    // Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: "Write the Seed now." }],
      }),
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      console.error("Claude error", claudeRes.status, t);
      throw new Error(`Claude API error: ${claudeRes.status}`);
    }
    const claudeJson = await claudeRes.json();
    const newSeed: string = (claudeJson.content?.[0]?.text || "").trim().replace(/^["']|["']$/g, "");
    if (!newSeed) throw new Error("Empty Seed from Claude");

    // Find user's seeds row for this chapter
    const { data: seedsRow } = await supabase
      .from("seeds")
      .select("*")
      .eq("user_id", user.id)
      .eq("theme_id", intake.theme_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let newAudioUrl: string | null = null;

    // Regenerate audio with ElevenLabs (use voice clone if available, else theme/default voice)
    if (ELEVENLABS_API_KEY) {
      const { data: voiceClone } = await supabase
        .from("user_voice_clones")
        .select("elevenlabs_voice_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: settings } = await supabase
        .from("app_settings")
        .select("default_voice_id, default_voice_model, default_voice_stability, default_voice_style")
        .maybeSingle();

      const voiceId =
        voiceClone?.elevenlabs_voice_id ||
        intake.monthly_themes?.seed_voice_id ||
        intake.monthly_themes?.voice_id ||
        settings?.default_voice_id ||
        "zA6D7RyKdc2EClouEMkP";

      try {
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: newSeed,
              model_id: settings?.default_voice_model || "eleven_multilingual_v2",
              voice_settings: {
                stability: Number(settings?.default_voice_stability ?? 0.5),
                similarity_boost: 0.75,
                style: Number(settings?.default_voice_style ?? 0.5),
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (ttsRes.ok) {
          const audioBuf = await ttsRes.arrayBuffer();
          const path = `${user.id}/seed5-${Date.now()}.mp3`;
          const { error: upErr } = await supabase.storage
            .from("meditations")
            .upload(path, audioBuf, { contentType: "audio/mpeg", upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("meditations").getPublicUrl(path);
            newAudioUrl = pub.publicUrl;
          } else {
            console.error("Storage upload error:", upErr);
          }
        } else {
          console.error("ElevenLabs error:", ttsRes.status, await ttsRes.text());
        }
      } catch (e) {
        console.error("TTS exception:", e);
      }
    }

    // Update seeds row
    if (seedsRow) {
      const update: any = { phrase_5: newSeed };
      if (newAudioUrl) update.audio_url_5 = newAudioUrl;
      await supabase.from("seeds").update(update).eq("id", seedsRow.id);
    }

    // Save the response with mood_context
    await supabase.from("checkin_responses").insert({
      user_id: user.id,
      month: intake.intake_start_date?.slice(0, 7) || new Date().toISOString().slice(0, 7),
      question,
      answer,
      chapter_id: intakeId,
      question_number: questionNumber || 1,
      mood_context: moodContext,
    });

    // Mark intake_checkin_state as answered
    await supabase
      .from("intake_checkin_state")
      .upsert(
        {
          user_id: user.id,
          intake_id: intakeId,
          question_number: questionNumber || 1,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "user_id,intake_id,question_number" }
      );

    return new Response(
      JSON.stringify({ success: true, newSeed, newAudioUrl, moodContext }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("regenerate-seed-5 error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
