import { supabase } from "@/integrations/supabase/client";

/**
 * User-locked monthly cycle helpers.
 *
 * - Each user has one intake per theme (unique).
 * - Their personal practice runs from intake_start_date → intake_end_date (start + 30 days).
 * - The active theme they've intaken stays "theirs" for the full 30 days,
 *   even if admin publishes a new theme during that time.
 */

export interface UserIntake {
  id: string;
  user_id: string;
  theme_id: string;
  intake_start_date: string; // YYYY-MM-DD
  intake_end_date: string;   // YYYY-MM-DD
  answers: string[];
  meditation_id: string | null;
  completed_at: string;
  created_at: string;
}

/** Most recent completed intake for the user, or null. */
export async function getCurrentIntake(userId: string): Promise<UserIntake | null> {
  const { data } = await supabase
    .from("user_monthly_intakes")
    .select("*")
    .eq("user_id", userId)
    .order("intake_end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    answers: Array.isArray(data.answers) ? (data.answers as string[]) : [],
  } as UserIntake;
}

/**
 * True if the intake's full 30-day window has passed and a new chapter is ready.
 * Calendar months are NOT considered — only the personal cycle matters.
 */
export function isIntakeExpired(intake: UserIntake | null): boolean {
  if (!intake) return false;
  const today = new Date();
  const end = new Date(intake.intake_end_date + "T23:59:59");
  return today > end;
}

/** Has this user ever completed an intake? Used to gate Welcome + Science screens. */
export async function hasEverCompletedIntake(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("user_monthly_intakes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

/**
 * The next theme this user should intake into.
 *
 * Logic: pick the theme at index = number of completed intakes, ordered by
 * `sequence` ASC. So a user with 0 intakes gets sequence #1, one with 1
 * intake gets sequence #2, etc. Falls back to the last theme if exhausted.
 */
export async function getNextThemeForUser(userId: string) {
  const { count: completedCount } = await supabase
    .from("user_monthly_intakes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: themes } = await supabase
    .from("monthly_themes")
    .select("*")
    .eq("is_active", true)
    .not("month_key", "is", null)
    .order("sequence", { ascending: true, nullsFirst: false });

  if (!themes || themes.length === 0) return null;

  const idx = Math.min(completedCount ?? 0, themes.length - 1);
  return themes[idx];
}

/** Save a completed intake row and snapshot the answers. Returns the new intake id. */
export async function saveIntake(params: {
  userId: string;
  themeId: string;
  answers: string[];
  meditationId: string | null;
}): Promise<string> {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 30);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Upsert by (user_id, theme_id) — re-running the same theme refreshes the cycle.
  const { data: existing } = await supabase
    .from("user_monthly_intakes")
    .select("id")
    .eq("user_id", params.userId)
    .eq("theme_id", params.themeId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("user_monthly_intakes")
      .update({
        answers: params.answers,
        meditation_id: params.meditationId,
        intake_start_date: fmt(today),
        intake_end_date: fmt(end),
        completed_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    await supabase
      .from("profiles")
      .update({ current_intake_id: data.id })
      .eq("user_id", params.userId);
    return data.id;
  }

  const { data, error } = await supabase
    .from("user_monthly_intakes")
    .insert({
      user_id: params.userId,
      theme_id: params.themeId,
      answers: params.answers,
      meditation_id: params.meditationId,
      intake_start_date: fmt(today),
      intake_end_date: fmt(end),
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("profiles")
    .update({ current_intake_id: data.id })
    .eq("user_id", params.userId);

  return data.id;
}
