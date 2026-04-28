import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Settings as SettingsIcon, Check, Flame, Headphones, Clock } from "lucide-react";
import spiralLogo from "@/assets/youtopia-sun.png";

/**
 * /home-preview — static mockup of how the Home page evolves over time.
 * Renders 3 columns (3, 6, 12 months completed) with fake data + stats.
 * No DB writes, no auth — purely visual.
 */

// ===== Fake themes (same naming style as the real app) =====
const ALL_THEMES = [
  "Becoming Yours Again",
  "Rooted in Trust",
  "Soft Power",
  "Open Heart",
  "Quiet Courage",
  "Coming Home",
  "Tender Boundaries",
  "Inner Spring",
  "Slow Bloom",
  "Lit From Within",
  "Sacred Pause",
  "Wholeness",
  "Becoming Light",
];

const monthLabel = (offsetBack: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offsetBack);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const monthKey = (offsetBack: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offsetBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ===== Glyphs (copied from Home.tsx) =====
const SunGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--gold))" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="3.6" fill="hsl(var(--gold))" stroke="none" />
    <line x1="12" y1="2.5" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="21.5" y2="12" />
    <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
    <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
    <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
    <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
  </svg>
);
const MoonGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="hsl(var(--moon))" opacity="0.85" />
  </svg>
);
const JournalGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--sage-soft))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1V4z" />
    <line x1="9" y1="8.5" x2="15" y2="8.5" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="15.5" x2="13" y2="15.5" />
  </svg>
);

const CompletionCircle = ({ done }: { done: boolean }) => (
  <span
    className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
    style={{
      border: done ? "1.5px solid hsl(var(--sage))" : "1.5px solid #C8B090",
      background: done ? "hsl(var(--sage))" : "transparent",
    }}
  >
    {done && <Check size={12} strokeWidth={3} className="text-white" />}
  </span>
);

const PracticeItem = ({
  icon, iconBg, title, subtitle, done,
}: {
  icon: React.ReactNode; iconBg: string;
  title: string; subtitle: string; done: boolean;
}) => (
  <div
    className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3"
    style={{
      background: "hsl(var(--background))",
      border: "1px solid rgba(160, 120, 70, 0.08)",
    }}
  >
    <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-heading text-[15px] leading-tight truncate" style={{ color: "hsl(var(--foreground))" }}>{title}</span>
      <span className="block text-[11px] italic mt-0.5 truncate" style={{ color: "hsl(var(--subtitle))" }}>{subtitle}</span>
    </span>
    <CompletionCircle done={done} />
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase font-body mb-3 px-6" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
    {children}
  </p>
);

const StatTile = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div
    className="flex-1 rounded-2xl px-3 py-3 flex flex-col items-center text-center"
    style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160, 120, 70, 0.12)" }}
  >
    <span className="mb-1.5" style={{ color: "hsl(var(--coral))" }}>{icon}</span>
    <span className="font-heading text-[20px] leading-none" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>{value}</span>
    <span className="text-[10px] italic mt-1" style={{ color: "hsl(var(--subtitle))" }}>{label}</span>
  </div>
);

// ===== Mock home for a given completed-month count =====
// Mood palette from MoodOrb (1=low → 5=high)
const MOOD_COLORS = ["#7A9BB5", "#9B8BBE", "#B89A6A", "#C4A030", "#C4604A"];

// Deterministic pseudo-random so colors stay stable per render.
const rand = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Build mock mood history: one row per past month + current (in-progress) month.
const buildMoodHistory = (monthsCompleted: number) => {
  const months: { label: string; days: (number | null)[] }[] = [];
  // oldest first
  for (let m = monthsCompleted; m >= 0; m--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    const label = d.toLocaleDateString(undefined, { month: "short" });
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const isCurrent = m === 0;
    const today = new Date();
    const fillThrough = isCurrent ? today.getDate() : daysInMonth;
    // Trend: gently rising mood as journey progresses
    const baseMood = 2.4 + (monthsCompleted - m) * 0.18;
    const days: (number | null)[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      if (i > fillThrough) { days.push(null); continue; }
      const r = rand(m * 100 + i);
      // 88% checkin rate
      if (r > 0.88) { days.push(null); continue; }
      const noise = (rand(m * 31 + i * 7) - 0.5) * 1.6;
      const score = Math.max(1, Math.min(5, Math.round(baseMood + noise)));
      days.push(score);
    }
    months.push({ label, days });
  }
  return months;
};

const MockHome = ({ monthsCompleted }: { monthsCompleted: number }) => {
  // Current chapter is the next one in the sequence
  const currentTheme = ALL_THEMES[monthsCompleted % ALL_THEMES.length];
  const past = Array.from({ length: monthsCompleted }, (_, i) => ({
    key: monthKey(i + 1),
    label: monthLabel(i + 1),
    themeName: ALL_THEMES[(monthsCompleted - 1 - i) % ALL_THEMES.length],
  }));

  const [openKey, setOpenKey] = useState<string | null>(null);

  // Derived stats
  const totalMinutes = monthsCompleted * 28 * 12; // ~12 min average
  const streak = Math.min(monthsCompleted * 9, 180);

  const hoursLabel =
    totalMinutes >= 60
      ? `${Math.round(totalMinutes / 60)}h`
      : `${totalMinutes}m`;

  const moodHistory = buildMoodHistory(monthsCompleted);


  return (
    <div className="bg-background flex flex-col rounded-3xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(120,90,60,0.4)]" style={{ border: "1px solid rgba(160,120,70,0.18)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <img src={spiralLogo} alt="Youtopia" className="w-[26px] h-[26px] object-contain" />
        <div className="flex items-center gap-2">
          <SettingsIcon size={20} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
          <Menu size={22} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
        </div>
      </div>

      {/* Greeting */}
      <div className="px-[22px] pt-3 pb-5">
        <p className="italic mb-2 lowercase" style={{ fontSize: "12px", letterSpacing: "0.14em", color: "hsl(var(--sage))" }}>
          good morning
        </p>
        <h1 className="font-heading leading-tight" style={{ fontSize: "34px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          friend<span style={{ color: "hsl(var(--coral))" }}>.</span>
        </h1>
        <div className="mt-3">
          <span
            className="inline-block italic"
            style={{
              background: "rgba(107, 158, 143, 0.12)",
              border: "1px solid rgba(107, 158, 143, 0.35)",
              color: "#4E8C7A",
              fontSize: "11px",
              padding: "5px 14px",
              borderRadius: "20px",
            }}
          >
            {currentTheme}
          </span>
        </div>
      </div>

      <div className="mx-5 mb-5" style={{ height: "1px", background: "rgba(120, 90, 60, 0.12)" }} />

      {/* Stats */}
      <div className="mb-7">
        <SectionLabel>Your Journey</SectionLabel>
        <div className="px-4 flex gap-2">
          <StatTile icon={<Headphones size={16} />} value={String(monthsCompleted)} label="months" />
          <StatTile icon={<Flame size={16} />} value={String(streak)} label="day streak" />
          <StatTile icon={<Clock size={16} />} value={hoursLabel} label="practiced" />
        </div>
      </div>

      {/* Mood over time — grid of month cards */}
      <div className="mb-7">
        <SectionLabel>Mood Over Time</SectionLabel>
        <div className="px-4 grid grid-cols-2 gap-2.5">
          {moodHistory.map((row, idx) => (
            <div
              key={idx}
              className="rounded-xl p-2.5"
              style={{
                background: "hsl(var(--background))",
                border: "1px solid rgba(160, 120, 70, 0.14)",
                boxShadow: "0 2px 8px -4px rgba(120, 90, 60, 0.15)",
              }}
            >
              <p
                className="font-heading mb-1.5 text-center"
                style={{
                  fontSize: "11px",
                  color: "hsl(var(--foreground))",
                  fontFamily: "Georgia, serif",
                }}
              >
                {row.label}
              </p>
              <div
                className="grid gap-[2px] mx-auto"
                style={{
                  gridTemplateColumns: "repeat(7, 1fr)",
                  maxWidth: "98px",
                }}
              >
                {row.days.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-[2px] aspect-square"
                    style={{
                      background: m !== null ? MOOD_COLORS[m - 1] : "transparent",
                      border:
                        m === null
                          ? "1px solid rgba(160, 120, 70, 0.22)"
                          : "1px solid rgba(160, 120, 70, 0.18)",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current chapter */}
      <div className="mb-7">
        <SectionLabel>Current Chapter</SectionLabel>
        <div
          className="mx-4"
          style={{
            background: "hsl(var(--folder))",
            border: "1px solid rgba(160, 120, 70, 0.15)",
            borderRadius: "22px",
            padding: "20px 16px 16px",
          }}
        >
          <h2 className="font-heading mb-4 px-1" style={{ fontSize: "20px", lineHeight: 1.3, color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
            {currentTheme}
          </h2>
          <div className="space-y-2">
            <PracticeItem icon={<SunGlyph />} iconBg="#F5E4C0" title="Morning Meditation" subtitle="Listen with headphones, eyes closed" done={false} />
            <PracticeItem icon={<MoonGlyph />} iconBg="#DDD0EE" title="Evening Seeds" subtitle="Plant the seeds before sleep" done={false} />
            <PracticeItem icon={<JournalGlyph />} iconBg="#C8DED8" title="Reflect" subtitle="your daily moment of honesty" done={false} />
          </div>
        </div>
      </div>

      {/* Previous chapters */}
      {past.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Previous Chapters</SectionLabel>
          <div>
            {past.map((c) => {
              const open = openKey === c.key;
              return (
                <div
                  key={c.key}
                  className="mx-4 mb-2"
                  style={{
                    background: "hsl(var(--folder-past))",
                    border: "1px solid rgba(160, 120, 70, 0.1)",
                    borderRadius: "16px",
                    opacity: 0.85,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenKey(open ? null : c.key)}
                    className="w-full flex items-center gap-3 text-left"
                    style={{ padding: "14px 18px" }}
                  >
                    <span className="flex-1 min-w-0 italic font-heading truncate" style={{ fontSize: "15px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
                      {c.themeName}
                    </span>
                    <span className="text-[10px] italic mr-2" style={{ color: "hsl(var(--subtitle))" }}>{c.label}</span>
                    <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "hsl(var(--sage))" }} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          <PracticeItem icon={<SunGlyph />} iconBg="#F5E4C0" title="Morning Meditation" subtitle="Revisit this practice" done />
                          <PracticeItem icon={<MoonGlyph />} iconBg="#DDD0EE" title="Evening Seeds" subtitle="Revisit this practice" done />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const HomePreview = () => {
  const presets = [3, 6, 12];

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-6xl mx-auto mb-10 text-center">
        <p className="text-[10px] uppercase font-body mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
          Mockup
        </p>
        <h1 className="font-heading leading-tight mb-3" style={{ fontSize: "36px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          Your home page over time<span style={{ color: "hsl(var(--coral))" }}>.</span>
        </h1>
        <p className="italic" style={{ fontSize: "13px", color: "hsl(var(--subtitle))" }}>
          A glimpse of how your library and journey grow as the months pass.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
        {presets.map((m) => (
          <div key={m} className="flex flex-col items-center">
            <div className="mb-4 text-center">
              <span
                className="inline-block italic"
                style={{
                  background: "rgba(107, 158, 143, 0.12)",
                  border: "1px solid rgba(107, 158, 143, 0.35)",
                  color: "#4E8C7A",
                  fontSize: "11px",
                  padding: "5px 14px",
                  borderRadius: "20px",
                }}
              >
                after {m} months
              </span>
            </div>
            <MockHome monthsCompleted={m} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePreview;
