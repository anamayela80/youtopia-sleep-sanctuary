import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentIntake } from "@/services/intakeService";
import { BottomNav } from "@/components/BottomNav";
import { MoodOrb, MOODS } from "@/components/reflect/MoodOrb";
import spiralLogo from "@/assets/youtopia-sun.png";

const MOOD_COLORS = MOODS.map((m) => m.color);
const SOFT_BORDER = "1px solid rgba(160, 120, 70, 0.08)";
const DIVIDER = "rgba(120, 90, 60, 0.1)";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="uppercase mb-5"
    style={{
      fontSize: "10px",
      letterSpacing: "0.22em",
      color: "#A08060",
      fontFamily: "Georgia, serif",
    }}
  >
    {children}
  </p>
);

const Divider = () => (
  <div className="mx-6 my-10" style={{ height: "1px", background: DIVIDER }} />
);

type CheckinRow = { mood_score: number; mood_note: string | null; checkin_date: string };
type JournalRow = { id: string; entry_text: string; created_at: string; chapter_theme: string | null };

const todayISO = () => new Date().toISOString().slice(0, 10);

const Reflect = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [intakeStart, setIntakeStart] = useState<string | null>(null);
  const [intakeEnd, setIntakeEnd] = useState<string | null>(null);
  const [chapterTheme, setChapterTheme] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Mood
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodNote, setMoodNote] = useState("");
  const [todaysCheckin, setTodaysCheckin] = useState<CheckinRow | null>(null);
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [justSubmittedMood, setJustSubmittedMood] = useState(false);

  // Journal
  const [journalText, setJournalText] = useState("");
  const [journalSaving, setJournalSaving] = useState(false);
  const [pastEntries, setPastEntries] = useState<JournalRow[]>([]);

  // All chapter check-ins (for constellation)
  const [chapterCheckins, setChapterCheckins] = useState<CheckinRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?mode=login");
        return;
      }
      setUserId(user.id);

      const intake = await getCurrentIntake(user.id);
      const intakeIdLocal = intake?.id || null;
      setIntakeId(intakeIdLocal);
      setIntakeStart(intake?.intake_start_date || null);
      setIntakeEnd(intake?.intake_end_date || null);

      let themeName = "";
      if (intake?.theme_id) {
        const { data: t } = await supabase
          .from("monthly_themes")
          .select("theme")
          .eq("id", intake.theme_id)
          .maybeSingle();
        themeName = t?.theme || "";
      }
      setChapterTheme(themeName);

      // Today's check-in
      const today = todayISO();
      const { data: todays } = await supabase
        .from("checkins")
        .select("mood_score, mood_note, checkin_date")
        .eq("user_id", user.id)
        .eq("checkin_date", today)
        .maybeSingle();
      if (todays) setTodaysCheckin(todays as CheckinRow);

      // All check-ins for current chapter (for constellation)
      const startDate = intake?.intake_start_date || today;
      const { data: allCheckins } = await supabase
        .from("checkins")
        .select("mood_score, mood_note, checkin_date")
        .eq("user_id", user.id)
        .gte("checkin_date", startDate)
        .order("checkin_date", { ascending: true });
      setChapterCheckins((allCheckins || []) as CheckinRow[]);

      // Past journal entries
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, entry_text, created_at, chapter_theme")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setPastEntries((entries || []) as JournalRow[]);

      setLoading(false);
    })();
  }, [navigate]);

  const submitMood = async () => {
    if (!userId || selectedMood === null) return;
    setMoodSubmitting(true);
    const { error, data } = await supabase
      .from("checkins")
      .insert({
        user_id: userId,
        chapter_id: intakeId,
        mood_score: selectedMood,
        mood_note: moodNote.trim() || null,
        checkin_date: todayISO(),
      })
      .select()
      .single();
    setMoodSubmitting(false);
    if (!error && data) {
      setJustSubmittedMood(true);
      setTodaysCheckin({
        mood_score: data.mood_score,
        mood_note: data.mood_note,
        checkin_date: data.checkin_date,
      });
      setChapterCheckins((prev) => [
        ...prev.filter((c) => c.checkin_date !== data.checkin_date),
        { mood_score: data.mood_score, mood_note: data.mood_note, checkin_date: data.checkin_date },
      ]);
    }
  };

  const saveJournal = async () => {
    if (!userId || !journalText.trim()) return;
    setJournalSaving(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        chapter_id: intakeId,
        chapter_theme: chapterTheme || null,
        entry_text: journalText.trim(),
      })
      .select()
      .single();
    setJournalSaving(false);
    if (!error && data) {
      setPastEntries((prev) => [data as JournalRow, ...prev]);
      setJournalText("");
    }
  };

  // Build constellation grid: every day of the current calendar month (1 → last day).
  // A circle is filled only if a check-in exists for that date AND the date is not in the future.
  const constellation = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDay = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const checkinMap = new Map(chapterCheckins.map((c) => [c.checkin_date, c.mood_score]));
    const days: { date: string; mood: number | null; isFuture: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        date: iso,
        mood: checkinMap.get(iso) ?? null,
        isFuture: d > todayDay,
      });
    }
    return days;
  }, [chapterCheckins]);

  const isEmpty = !todaysCheckin && pastEntries.length === 0 && chapterCheckins.length === 0 && !justSubmittedMood;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2EAD8" }}>
        <motion.div
          className="w-12 h-12 rounded-full"
          style={{ background: "rgba(107, 158, 143, 0.3)" }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: "#F2EAD8", fontFamily: "Georgia, serif" }}>
      {/* Top bar with sun logo */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <img src={spiralLogo} alt="Youtopia" className="w-[26px] h-[26px] object-contain" />
      </div>

      {/* Title — left aligned */}
      <div className="pt-4 pb-8 px-6">
        <h1
          style={{ fontSize: "26px", color: "#3D2E1E", fontFamily: "Georgia, serif" }}
        >
          reflect
        </h1>
        <p
          className="italic mt-2"
          style={{ fontSize: "13px", color: "#9A7B5A", fontFamily: "Georgia, serif" }}
        >
          your daily moment of honesty
        </p>
      </div>

      {/* ===== Section 1: Mood ===== */}
      <section className="px-6">
        <SectionLabel>how are you feeling today</SectionLabel>

        {todaysCheckin && !justSubmittedMood ? (
          <div className="flex flex-col items-center py-4">
            <div className="flex justify-between items-start w-full px-2 mb-4">
              {MOODS.map((m, i) => (
                <MoodOrb
                  key={m.key}
                  mood={m}
                  selected={false}
                  glowing={todaysCheckin.mood_score === i + 1}
                  disabled
                />
              ))}
            </div>
            <p className="italic text-center mt-2" style={{ fontSize: "13px", color: "#9A7B5A" }}>
              you checked in today
            </p>
          </div>
        ) : justSubmittedMood ? (
          <p
            className="italic text-center py-8"
            style={{ fontSize: "14px", color: "#9A7B5A", fontFamily: "Georgia, serif" }}
          >
            Received. See you tomorrow.
          </p>
        ) : (
          <>
            <div className="flex justify-between items-start px-2 mb-6">
              {MOODS.map((m, i) => (
                <MoodOrb
                  key={m.key}
                  mood={m}
                  selected={selectedMood === i + 1}
                  onSelect={() => setSelectedMood(i + 1)}
                />
              ))}
            </div>

            <div className="px-2 mb-4">
              <input
                type="text"
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value.slice(0, 140))}
                placeholder="anything you want to add?"
                maxLength={140}
                className="w-full bg-transparent outline-none italic py-2"
                style={{
                  fontSize: "13px",
                  color: "#3D2E1E",
                  fontFamily: "Georgia, serif",
                  borderBottom: "1px solid #C8B090",
                }}
              />
            </div>

            <div className="flex justify-end px-2 mb-4">
              <button
                onClick={submitMood}
                disabled={selectedMood === null || moodSubmitting}
                className="lowercase transition-opacity"
                style={{
                  fontSize: "13px",
                  color: "#6B9E8F",
                  fontFamily: "Georgia, serif",
                  opacity: selectedMood === null || moodSubmitting ? 0.4 : 1,
                  padding: "6px 12px",
                }}
              >
                done
              </button>
            </div>
          </>
        )}
      </section>

      {/* ===== Section 2: Journal ===== */}
      {!isEmpty || true ? (
        <>
          <Divider />
          <section className="px-6">
            <SectionLabel>your journal</SectionLabel>

            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="what's present for you today?"
              className="w-full bg-transparent outline-none resize-none italic"
              style={{
                minHeight: "120px",
                fontSize: "15px",
                color: "#3D2E1E",
                fontFamily: "Georgia, serif",
                lineHeight: 1.7,
                border: "none",
                padding: "8px 4px",
              }}
              rows={5}
            />

            <div className="flex justify-end mt-3">
              <button
                onClick={saveJournal}
                disabled={!journalText.trim() || journalSaving}
                className="lowercase transition-opacity"
                style={{
                  fontSize: "13px",
                  color: "#6B9E8F",
                  fontFamily: "Georgia, serif",
                  background: "rgba(107, 158, 143, 0.1)",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  opacity: !journalText.trim() || journalSaving ? 0.4 : 1,
                }}
              >
                {journalSaving ? "saving..." : "save to my journal"}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {/* ===== Empty state line ===== */}
      {isEmpty && (
        <div className="px-6 pt-10">
          <p
            className="italic text-center"
            style={{ fontSize: "14px", color: "#9A7B5A", fontFamily: "Georgia, serif" }}
          >
            this is your space. begin whenever you're ready.
          </p>
        </div>
      )}

      {/* ===== Section 3: Constellation ===== */}
      {constellation.length > 0 && (
        <>
          <Divider />
          <section className="px-6">
            <SectionLabel>your month so far</SectionLabel>
            <div
              className="flex flex-wrap"
              style={{ gap: "6px", maxWidth: `${7 * 14 + 6 * 6}px` }}
            >
              {constellation.map((d, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: "14px",
                    height: "14px",
                    background:
                      d.mood !== null ? MOOD_COLORS[d.mood - 1] : "transparent",
                    border:
                      d.mood !== null
                        ? "none"
                        : d.isFuture
                        ? "1px solid rgba(160, 120, 70, 0.08)"
                        : "1px solid rgba(160, 120, 70, 0.15)",
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ===== Section 4: Past entries ===== */}
      {pastEntries.length > 0 && (
        <>
          <Divider />
          <section className="px-6">
            <SectionLabel>previous entries</SectionLabel>
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {pastEntries.map((e) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: "#E8DCC8",
                      borderRadius: "16px",
                      padding: "16px",
                      border: "1px solid rgba(160, 120, 70, 0.08)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "15px",
                        color: "#3D2E1E",
                        fontFamily: "Georgia, serif",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {e.entry_text}
                    </p>
                    {e.chapter_theme && (
                      <p
                        className="italic mt-3"
                        style={{
                          fontSize: "11px",
                          color: "#9A7B5A",
                          fontFamily: "Georgia, serif",
                        }}
                      >
                        written during · {e.chapter_theme}
                      </p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        </>
      )}

      <BottomNav />
    </div>
  );
};

export default Reflect;
