import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface MeditationSegment {
  number: number;
  title: string;
  text: string;
}

export interface GenerateMeditationParams {
  answers: string[]; // up to 5 intake answers
  userName?: string;
  monthlyTheme?: string;
  themeIntention?: string;
  previousTheme?: string;
  /** Controls length/depth of the meditation. Defaults to "orienting" in the edge function. */
  tenureBand?: "orienting" | "settling" | "established";
  /**
   * Months since the user joined (1-based). Drives the monthly variation
   * rotation — opening device, light metaphor, and coherence emotion all
   * cycle by this number so the structure stays fresh.
   */
  monthNumber?: number;
}

/**
 * Calculate how many months the user has been a member, starting at 1 for
 * their first month. Used as the variation seed for meditation generation.
 */
export function getMonthNumber(membershipStartDate: string | null | undefined): number {
  if (!membershipStartDate) return 1;
  const start = new Date(membershipStartDate);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    1; // 1-based
  return Math.max(1, months);
}

export async function generateMeditationScript(params: GenerateMeditationParams): Promise<{
  script: string;
  segments: MeditationSegment[];
}> {
  const { data, error } = await supabase.functions.invoke("generate-meditation", {
    body: params,
  });
  if (error) throw new Error(error.message || "Failed to generate meditation script");
  if (data?.error) throw new Error(data.error);
  return {
    script: data.script,
    segments: data.segments,
  };
}

export async function generateMonthlyPackage(params: {
  meditationId: string;
  userName?: string;
  monthlyTheme?: string;
  themeIntention?: string;
  answers: string[];
}): Promise<{ meditationName: string | null; messageForYou: string | null; imagePrompt: string | null }> {
  const { data, error } = await supabase.functions.invoke("generate-monthly-package", {
    body: params,
  });
  if (error) throw new Error(error.message || "Failed to generate monthly package");
  if (data?.error) throw new Error(data.error);
  return {
    meditationName: data.meditationName ?? null,
    messageForYou: data.messageForYou ?? null,
    imagePrompt: data.imagePrompt ?? null,
  };
}

export async function generateMeditationArtwork(params: {
  meditationId: string;
  imagePrompt?: string;
}): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("generate-meditation-artwork", {
    body: params,
  });
  if (error) throw new Error(error.message || "Failed to generate artwork");
  if (data?.error) throw new Error(data.error);
  return data?.artworkUrl ?? null;
}

async function getVoiceSettings() {
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  return {
    model: data?.default_voice_model || "eleven_v3",
    // v3 preset: Creative (0.0) — lets [intimate][drawn out] tags take full effect
    stability: data?.default_voice_stability ?? 0.0,
    style: data?.default_voice_style ?? 0.0,
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("Not signed in. Please sign in again.");
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

export async function narrateSegment(segmentText: string, voiceId: string, segmentNumber: number): Promise<Blob> {
  const settings = await getVoiceSettings();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/narrate-meditation`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ script: segmentText, voiceId, segmentNumber, ...settings }),
  });

  if (!response.ok) {
    let errorMsg = `Narration failed (${response.status})`;
    try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
    throw new Error(errorMsg);
  }
  return await response.blob();
}

export async function uploadSegmentAudio(userId: string, audioBlob: Blob, month: string, segmentNumber: number): Promise<string> {
  const ext = audioBlob.type === "audio/wav" ? "wav" : "mp3";
  const fileName = `${userId}/segments/${month}-seg${segmentNumber}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("meditations")
    .upload(fileName, audioBlob, { contentType: audioBlob.type || "audio/mpeg" });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("meditations").getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveMeditation(params: {
  userId: string;
  title: string;
  script: string;
  voiceId: string;
  musicMood: string;
  month: string;
  themeId?: string;
  meditationName?: string | null;
  messageForYou?: string | null;
  meditationArtworkUrl?: string | null;
}) {
  const { data, error } = await supabase.from("meditations").insert({
    user_id: params.userId,
    title: params.title,
    script: params.script,
    voice_id: params.voiceId,
    music_mood: params.musicMood,
    month: params.month,
    theme_id: params.themeId || null,
    meditation_name: params.meditationName ?? null,
    message_for_you: params.messageForYou ?? null,
    meditation_artwork_url: params.meditationArtworkUrl ?? null,
  }).select("id").single();

  if (error) throw error;
  return data.id;
}

export async function getUserProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getUserAnswers(userId: string) {
  const { data } = await supabase
    .from("user_answers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export function getTenureBand(membershipStartDate: string | null | undefined): "orienting" | "settling" | "established" {
  if (!membershipStartDate) return "orienting";
  const start = new Date(membershipStartDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months <= 1) return "orienting";
  if (months <= 4) return "settling";
  return "established";
}

export async function saveMeditationSegment(meditationId: string, segmentNumber: number, audioUrl: string) {
  const { error } = await supabase.from("meditation_segments").insert({
    meditation_id: meditationId,
    segment_number: segmentNumber,
    audio_url: audioUrl,
  });
  if (error) throw error;
}

export async function saveUserAnswers(userId: string, answers: string[]) {
  const { error } = await supabase.from("user_answers").insert({
    user_id: userId,
    question_1: answers[0],
    question_2: answers[1],
    question_3: answers[2],
  });
  if (error) throw error;
}

export async function cloneVoice(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "voice-sample.webm");

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("Not signed in. Please sign in again.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/clone-voice`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Voice cloning failed (${response.status})`;
    try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.voiceId;
}

export async function saveVoiceClone(userId: string, voiceId: string) {
  // Upsert — one voice clone per user
  const { data: existing } = await supabase
    .from("user_voice_clones")
    .select("id, elevenlabs_voice_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Delete the old ElevenLabs voice so clones don't accumulate against the account limit
    if (existing.elevenlabs_voice_id && existing.elevenlabs_voice_id !== voiceId) {
      await deleteVoice(existing.elevenlabs_voice_id);
    }
    const { error } = await supabase
      .from("user_voice_clones")
      .update({ elevenlabs_voice_id: voiceId })
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_voice_clones")
      .insert({ user_id: userId, elevenlabs_voice_id: voiceId });
    if (error) throw error;
  }
}

export async function getUserVoiceClone(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_voice_clones")
    .select("elevenlabs_voice_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.elevenlabs_voice_id || null;
}

export async function deleteVoice(voiceId: string): Promise<void> {
  try {
    await supabase.functions.invoke("delete-voice", { body: { voiceId } });
  } catch (e) {
    console.warn("Failed to delete voice:", e);
  }
}

export async function deleteUserVoiceClone(userId: string): Promise<void> {
  const voiceId = await getUserVoiceClone(userId);
  if (voiceId) {
    await deleteVoice(voiceId);
    await supabase.from("user_voice_clones").delete().eq("user_id", userId);
  }
}

export async function generateSeeds(params: {
  question1: string;
  question2: string;
  question3: string;
  userName?: string;
  monthlyTheme?: string;
  themeIntention?: string;
}): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("generate-seeds", { body: params });
  if (error) throw new Error(error.message || "Failed to generate seeds");
  if (data?.error) throw new Error(data.error);
  return data.phrases;
}

export async function narrateSeed(phrase: string, voiceId: string): Promise<Blob> {
  const settings = await getVoiceSettings();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/narrate-seeds`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ phrase, voiceId, ...settings }),
  });

  if (!response.ok) {
    let errorMsg = `Seed narration failed (${response.status})`;
    try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch {}
    throw new Error(errorMsg);
  }
  return await response.blob();
}

export async function uploadSeedAudio(userId: string, audioBlob: Blob, month: string, seedNumber: number): Promise<string> {
  const fileName = `${userId}/seeds/${month}-seed${seedNumber}-${Date.now()}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from("meditations")
    .upload(fileName, audioBlob, { contentType: "audio/mpeg" });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("meditations").getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveSeeds(params: {
  userId: string;
  month: string;
  themeId?: string;
  phrases: string[];
  audioUrls: string[];
}) {
  const { error } = await supabase.from("seeds").insert({
    user_id: params.userId,
    month: params.month,
    theme_id: params.themeId || null,
    phrase_1: params.phrases[0],
    phrase_2: params.phrases[1],
    phrase_3: params.phrases[2],
    phrase_4: params.phrases[3],
    phrase_5: params.phrases[4],
    audio_url_1: params.audioUrls[0] || null,
    audio_url_2: params.audioUrls[1] || null,
    audio_url_3: params.audioUrls[2] || null,
    audio_url_4: params.audioUrls[3] || null,
    audio_url_5: params.audioUrls[4] || null,
  });
  if (error) throw error;
}

export async function getActiveTheme() {
  const { data } = await supabase
    .from("monthly_themes")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function getLatestMeditation(userId: string) {
  const { data } = await supabase
    .from("meditations")
    .select("*, meditation_segments(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getLatestSeeds(userId: string) {
  const { data } = await supabase
    .from("seeds")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Regenerate a meditation for an existing user without re-asking intake
 * questions. Admin-only tool for testing prompt changes against the user's
 * saved answers + active theme. Creates a NEW meditation row; the old row
 * stays in history so you can compare.
 */
export async function regenerateMeditationForUser(
  userId: string,
  onStatus?: (msg: string) => void,
): Promise<string> {
  const status = (m: string) => { onStatus?.(m); console.log("[regenerate]", m); };

  status("Loading user context…");
  const profile = await getUserProfile(userId);
  const answersRow = await getUserAnswers(userId);
  if (!answersRow) throw new Error("No intake answers found for this user");

  // Latest intake → theme
  const { data: latestIntake } = await supabase
    .from("user_monthly_intakes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let theme: any = null;
  if (latestIntake?.theme_id) {
    const { data } = await supabase
      .from("monthly_themes")
      .select("*")
      .eq("id", latestIntake.theme_id)
      .maybeSingle();
    theme = data;
  }
  if (!theme) theme = await getActiveTheme();
  if (!theme) throw new Error("No active theme found");

  const rawAnswers: string[] = Array.isArray(latestIntake?.answers)
    ? (latestIntake!.answers as string[])
    : [
        answersRow.question_1 || "",
        answersRow.question_2 || "",
        answersRow.question_3 || "",
      ];
  const answers = rawAnswers.filter((a) => a && a.trim().length > 0);

  const userName = (profile?.full_name || "").split(" ")[0] || "";
  const tenureBand = getTenureBand(profile?.membership_start_date);
  const monthNumber = getMonthNumber(profile?.membership_start_date);
  const guideVoiceId = theme?.guide_voice_id || "9BDgg2Q7WSrW0x8naPLw";
  const themeSlug = (theme?.theme || "practice").toLowerCase().replace(/\s+/g, "-");
  const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  status("Writing your meditation…");
  const { script, segments } = await generateMeditationScript({
    answers,
    userName,
    monthlyTheme: theme?.theme,
    themeIntention: theme?.intention,
    tenureBand,
    monthNumber,
  });

  const segmentAudioUrls: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].text || segments[i].text.trim().length === 0) continue;
    status(`Recording segment ${i + 1} of ${segments.length}…`);
    const audioBlob = await narrateSegment(segments[i].text, guideVoiceId, i + 1);
    if (!audioBlob || audioBlob.size === 0) throw new Error(`Segment ${i + 1} narration failed`);
    const audioUrl = await uploadSegmentAudio(userId, audioBlob, themeSlug, i + 1);
    segmentAudioUrls.push(audioUrl);
  }

  status("Saving meditation…");
  const meditationId = await saveMeditation({
    userId,
    title: `${theme?.theme || "Monthly"} Meditation`,
    script,
    voiceId: guideVoiceId,
    musicMood: "theme",
    month: monthLabel,
    themeId: theme?.id,
    meditationName: null,
    messageForYou: null,
    meditationArtworkUrl: null,
  });
  for (let i = 0; i < segmentAudioUrls.length; i++) {
    await saveMeditationSegment(meditationId, i + 1, segmentAudioUrls[i]);
  }

  status("Composing monthly message…");
  try {
    await generateMonthlyPackage({
      meditationId,
      userName,
      monthlyTheme: theme?.theme,
      themeIntention: theme?.intention,
      answers,
    });
    try {
      status("Painting artwork…");
      await generateMeditationArtwork({ meditationId });
    } catch (e) {
      console.warn("Artwork failed (non-blocking):", e);
    }
  } catch (e) {
    console.warn("Monthly package failed (non-blocking):", e);
  }

  status("Done");
  return meditationId;
}

export async function getAllMeditations(userId: string) {
  const { data } = await supabase
    .from("meditations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}
