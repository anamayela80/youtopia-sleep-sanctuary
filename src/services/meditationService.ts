import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface GenerateMeditationParams {
  question1: string;
  question2: string;
  question3: string;
  monthlyTheme?: string;
}

export async function generateMeditationScript(params: GenerateMeditationParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-meditation", {
    body: params,
  });

  if (error) throw new Error(error.message || "Failed to generate meditation script");
  if (data?.error) throw new Error(data.error);
  return data.script;
}

export async function narrateMeditation(script: string, voiceId: string): Promise<Blob> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/narrate-meditation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ script, voiceId }),
  });

  if (!response.ok) {
    let errorMsg = `Narration failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch { /* binary response */ }
    throw new Error(errorMsg);
  }

  return await response.blob();
}

export async function uploadMeditationAudio(userId: string, audioBlob: Blob, month: string): Promise<string> {
  const fileName = `${userId}/${month}-${Date.now()}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from("meditations")
    .upload(fileName, audioBlob, { contentType: "audio/mpeg" });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("meditations")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export async function saveMeditation(params: {
  userId: string;
  title: string;
  script: string;
  audioUrl: string;
  voiceId: string;
  musicMood: string;
  month: string;
}) {
  const { error } = await supabase.from("meditations").insert({
    user_id: params.userId,
    title: params.title,
    script: params.script,
    audio_url: params.audioUrl,
    voice_id: params.voiceId,
    music_mood: params.musicMood,
    month: params.month,
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

  const response = await fetch(`${SUPABASE_URL}/functions/v1/clone-voice`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Voice cloning failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch { /* */ }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.voiceId;
}

export async function deleteVoice(voiceId: string): Promise<void> {
  try {
    await supabase.functions.invoke("delete-voice", {
      body: { voiceId },
    });
  } catch (e) {
    console.warn("Failed to delete cloned voice:", e);
  }
}
