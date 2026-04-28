import { Menu, Settings as SettingsIcon, Check, Flame, Headphones, Clock, Mic, Play, Pause, ChevronRight, Sparkles, BookOpen, ArrowLeft } from "lucide-react";
import spiralLogo from "@/assets/youtopia-sun.png";

/**
 * /flow-preview — full-app phone mockup gallery in horizontal scroll row.
 * Each "phone" is a 375x812 frame showing one screen with mixed mock data.
 * Static visuals only, no auth/DB.
 */

// ===== Phone frame =====
const PhoneFrame = ({ label, step, children }: { label: string; step: number; children: React.ReactNode }) => (
  <div className="flex flex-col items-center flex-shrink-0">
    <div className="mb-3 text-center">
      <p className="text-[10px] uppercase italic mb-1" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
        Step {step}
      </p>
      <p className="font-heading text-[15px]" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        {label}
      </p>
    </div>
    <div
      className="relative bg-background overflow-hidden"
      style={{
        width: "375px",
        height: "750px",
        borderRadius: "44px",
        border: "10px solid #2D2418",
        boxShadow: "0 30px 80px -30px rgba(60, 40, 20, 0.5)",
      }}
    >
      {/* Notch */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20"
        style={{ width: "120px", height: "26px", background: "#2D2418", borderRadius: "0 0 16px 16px" }}
      />
      <div className="w-full h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {children}
      </div>
    </div>
  </div>
);

// ===== Shared bits =====
const TopBar = ({ showMenu = true }: { showMenu?: boolean }) => (
  <div className="flex items-center justify-between px-5 pt-10 pb-2">
    <img src={spiralLogo} alt="" className="w-[26px] h-[26px] object-contain" />
    {showMenu && (
      <div className="flex items-center gap-2">
        <SettingsIcon size={20} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
        <Menu size={22} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
      </div>
    )}
  </div>
);

const BottomNavMock = ({ active }: { active: "home" | "month" | "reflect" }) => (
  <div
    className="absolute bottom-0 left-0 right-0 flex justify-around items-center px-6 py-3"
    style={{ background: "hsl(var(--background))", borderTop: "1px solid rgba(160,120,70,0.12)" }}
  >
    {[
      { key: "home", label: "home" },
      { key: "month", label: "month" },
      { key: "reflect", label: "reflect" },
    ].map((t) => (
      <span
        key={t.key}
        className="text-[11px] italic"
        style={{
          color: active === t.key ? "hsl(var(--coral))" : "hsl(var(--subtitle))",
          fontFamily: "Georgia, serif",
        }}
      >
        {t.label}
      </span>
    ))}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase font-body mb-3 px-6" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
    {children}
  </p>
);

const SunGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--gold))" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="3.6" fill="hsl(var(--gold))" stroke="none" />
    <line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" />
    <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" /><line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
    <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" /><line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
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
    <line x1="9" y1="8.5" x2="15" y2="8.5" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15.5" x2="13" y2="15.5" />
  </svg>
);

// ============= SCREENS =============

// 1. Splash
const SplashScreen = () => (
  <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "hsl(var(--background))" }}>
    <img src={spiralLogo} alt="" className="w-[90px] h-[90px] object-contain mb-6" />
    <h1 className="font-heading text-[34px]" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      Youtopia<span style={{ color: "hsl(var(--coral))" }}>.</span>
    </h1>
    <p className="italic mt-3 text-[13px]" style={{ color: "hsl(var(--subtitle))" }}>
      become yours again
    </p>
  </div>
);

// 2. Auth
const AuthScreen = () => (
  <div className="w-full h-full flex flex-col px-8 pt-24" style={{ background: "hsl(var(--background))" }}>
    <img src={spiralLogo} alt="" className="w-[44px] h-[44px] object-contain mb-8" />
    <h1 className="font-heading text-[28px] mb-2" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      welcome back<span style={{ color: "hsl(var(--coral))" }}>.</span>
    </h1>
    <p className="italic text-[13px] mb-8" style={{ color: "hsl(var(--subtitle))" }}>
      sign in to continue your practice
    </p>
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.15)", color: "hsl(var(--subtitle))" }}>
        sarah@example.com
      </div>
      <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.15)", color: "hsl(var(--subtitle))" }}>
        ••••••••••
      </div>
      <button className="w-full rounded-xl py-3 text-[14px] italic mt-2" style={{ background: "hsl(var(--coral))", color: "white", fontFamily: "Georgia, serif" }}>
        continue
      </button>
      <p className="text-center text-[12px] italic mt-6" style={{ color: "hsl(var(--subtitle))" }}>
        new here? <span style={{ color: "hsl(var(--coral))" }}>create an account</span>
      </p>
    </div>
  </div>
);

// 3. Onboarding Welcome
const OnboardingWelcome = () => (
  <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "hsl(var(--background))" }}>
    <p className="text-[10px] uppercase italic mb-4" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
      a beginning
    </p>
    <h1 className="font-heading text-[30px] mb-4 leading-tight" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      this is for the woman ready to come home to herself<span style={{ color: "hsl(var(--coral))" }}>.</span>
    </h1>
    <p className="italic text-[13px] mb-10 leading-relaxed" style={{ color: "hsl(var(--subtitle))" }}>
      a 30-day rhythm of meditation, seeds, and reflection. shaped by your voice, your answers, your season.
    </p>
    <button className="rounded-xl px-8 py-3 text-[14px] italic" style={{ background: "hsl(var(--coral))", color: "white", fontFamily: "Georgia, serif" }}>
      begin
    </button>
  </div>
);

// 4. Onboarding Questions
const OnboardingQuestions = () => (
  <div className="w-full h-full flex flex-col px-8 pt-20" style={{ background: "hsl(var(--background))" }}>
    <p className="text-[10px] uppercase italic mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
      question 1 of 3
    </p>
    <h1 className="font-heading text-[24px] mb-8 leading-tight" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      how do you want to feel every day this month?
    </h1>
    <div className="space-y-2.5">
      {["softer with myself", "anchored and steady", "more alive in my body", "lit from within"].map((opt, i) => (
        <div
          key={i}
          className="rounded-xl px-4 py-3.5 text-[14px] italic"
          style={{
            background: i === 1 ? "rgba(107,158,143,0.12)" : "hsl(var(--folder))",
            border: i === 1 ? "1px solid rgba(107,158,143,0.45)" : "1px solid rgba(160,120,70,0.12)",
            color: "hsl(var(--foreground))",
            fontFamily: "Georgia, serif",
          }}
        >
          {opt}
        </div>
      ))}
    </div>
    <button className="rounded-xl py-3 text-[14px] italic mt-8" style={{ background: "hsl(var(--coral))", color: "white", fontFamily: "Georgia, serif" }}>
      continue
    </button>
  </div>
);

// 5. Voice capture
const VoiceCaptureMock = () => (
  <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "hsl(var(--background))" }}>
    <p className="text-[10px] uppercase italic mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
      your voice
    </p>
    <h1 className="font-heading text-[24px] mb-3" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      record a 30-second sample<span style={{ color: "hsl(var(--coral))" }}>.</span>
    </h1>
    <p className="italic text-[12px] mb-10" style={{ color: "hsl(var(--subtitle))" }}>
      we'll use it to whisper your evening seeds back to you
    </p>
    <div
      className="w-32 h-32 rounded-full flex items-center justify-center mb-8"
      style={{ background: "rgba(196,96,74,0.12)", border: "2px solid hsl(var(--coral))" }}
    >
      <Mic size={48} style={{ color: "hsl(var(--coral))" }} strokeWidth={1.5} />
    </div>
    <p className="text-[13px] italic" style={{ color: "hsl(var(--sage))" }}>
      recording • 0:14
    </p>
  </div>
);

// 6. Generating
const GeneratingMock = () => (
  <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "hsl(var(--background))" }}>
    <Sparkles size={40} style={{ color: "hsl(var(--gold))" }} className="mb-6" />
    <h1 className="font-heading text-[24px] mb-3 leading-tight" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
      shaping your first chapter<span style={{ color: "hsl(var(--coral))" }}>.</span>
    </h1>
    <p className="italic text-[13px]" style={{ color: "hsl(var(--subtitle))" }}>
      your meditation, your seeds, your artwork. just a moment.
    </p>
    <div className="mt-10 space-y-2 text-left text-[12px] italic" style={{ color: "hsl(var(--sage))" }}>
      <p>✓ writing your meditation</p>
      <p>✓ planting your seeds</p>
      <p style={{ color: "hsl(var(--subtitle))" }}>○ recording in your voice...</p>
      <p style={{ color: "hsl(var(--subtitle))" }}>○ painting your artwork...</p>
    </div>
  </div>
);

// 7. Home (mid-journey, month 6)
const HomeMock = () => (
  <div className="w-full h-full pb-16" style={{ background: "hsl(var(--background))" }}>
    <TopBar />
    <div className="px-[22px] pt-3 pb-5">
      <p className="italic mb-2 lowercase" style={{ fontSize: "12px", letterSpacing: "0.14em", color: "hsl(var(--sage))" }}>
        good morning
      </p>
      <h1 className="font-heading leading-tight" style={{ fontSize: "34px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        sarah<span style={{ color: "hsl(var(--coral))" }}>.</span>
      </h1>
      <span
        className="inline-block italic mt-3"
        style={{
          background: "rgba(107,158,143,0.12)", border: "1px solid rgba(107,158,143,0.35)",
          color: "#4E8C7A", fontSize: "11px", padding: "5px 14px", borderRadius: "20px",
        }}
      >
        Coming Home
      </span>
    </div>
    <div className="mx-5 mb-5" style={{ height: "1px", background: "rgba(120,90,60,0.12)" }} />
    <SectionLabel>Your Journey</SectionLabel>
    <div className="px-4 flex gap-2 mb-6">
      {[
        { i: <Headphones size={16} />, v: "6", l: "months" },
        { i: <Flame size={16} />, v: "54", l: "day streak" },
        { i: <Clock size={16} />, v: "33h", l: "practiced" },
      ].map((s, i) => (
        <div key={i} className="flex-1 rounded-2xl px-3 py-3 flex flex-col items-center text-center" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.12)" }}>
          <span className="mb-1.5" style={{ color: "hsl(var(--coral))" }}>{s.i}</span>
          <span className="font-heading text-[20px] leading-none" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>{s.v}</span>
          <span className="text-[10px] italic mt-1" style={{ color: "hsl(var(--subtitle))" }}>{s.l}</span>
        </div>
      ))}
    </div>
    <SectionLabel>Current Chapter</SectionLabel>
    <div className="mx-4 mb-6" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.15)", borderRadius: "22px", padding: "20px 16px 16px" }}>
      <h2 className="font-heading mb-4 px-1" style={{ fontSize: "20px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        Coming Home
      </h2>
      <div className="space-y-2">
        {[
          { icon: <SunGlyph />, bg: "#F5E4C0", title: "Morning Meditation", sub: "Listen with headphones", done: true },
          { icon: <MoonGlyph />, bg: "#DDD0EE", title: "Evening Seeds", sub: "Plant before sleep", done: false },
          { icon: <JournalGlyph />, bg: "#C8DED8", title: "Reflect", sub: "your daily moment of honesty", done: false },
        ].map((p, i) => (
          <div key={i} className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={{ background: "hsl(var(--background))", border: "1px solid rgba(160,120,70,0.08)" }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: p.bg }}>{p.icon}</span>
            <span className="flex-1">
              <span className="block font-heading text-[15px]" style={{ color: "hsl(var(--foreground))" }}>{p.title}</span>
              <span className="block text-[11px] italic mt-0.5" style={{ color: "hsl(var(--subtitle))" }}>{p.sub}</span>
            </span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ border: "1.5px solid " + (p.done ? "hsl(var(--sage))" : "#C8B090"), background: p.done ? "hsl(var(--sage))" : "transparent" }}>
              {p.done && <Check size={12} strokeWidth={3} className="text-white" />}
            </span>
          </div>
        ))}
      </div>
    </div>
    <BottomNavMock active="home" />
  </div>
);

// 8. My Month
const MyMonthMock = () => (
  <div className="w-full h-full pb-16" style={{ background: "hsl(var(--background))" }}>
    <TopBar />
    <div className="px-6 pt-6">
      <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>this month</p>
      <h1 className="font-heading text-[28px] mb-2" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        Coming Home<span style={{ color: "hsl(var(--coral))" }}>.</span>
      </h1>
      <p className="italic text-[12px] mb-6" style={{ color: "hsl(var(--subtitle))" }}>
        a chapter on returning to the body you've been away from
      </p>
      <div className="rounded-2xl p-4 mb-3" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.12)" }}>
        <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.18em", color: "hsl(var(--label))" }}>a message for you</p>
        <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          this month is a soft invitation back to yourself. not the version you perform, but the one who waits quietly underneath...
        </p>
        <p className="text-[11px] italic mt-2" style={{ color: "hsl(var(--coral))" }}>read more</p>
      </div>
      <div className="rounded-2xl p-4 mb-3" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.12)" }}>
        <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.18em", color: "hsl(var(--label))" }}>this month's practice</p>
        <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          each morning, sit for 12 minutes with the meditation. each night, plant the five seeds before sleep...
        </p>
      </div>
      <div className="rounded-2xl p-4" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.12)" }}>
        <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.18em", color: "hsl(var(--label))" }}>what you shared</p>
        <p className="text-[13px] italic leading-relaxed" style={{ color: "hsl(var(--subtitle))", fontFamily: "Georgia, serif" }}>
          "i want to feel softer with myself, anchored, alive in my body..."
        </p>
      </div>
    </div>
    <BottomNavMock active="month" />
  </div>
);

// 9. Practice (morning meditation player)
const PracticeMock = () => (
  <div className="w-full h-full flex flex-col" style={{ background: "linear-gradient(180deg, #F5E4C0 0%, hsl(var(--background)) 70%)" }}>
    <div className="flex items-center justify-between px-5 pt-12 pb-4">
      <ArrowLeft size={22} style={{ color: "hsl(var(--foreground))" }} />
      <span className="text-[11px] italic" style={{ color: "hsl(var(--subtitle))" }}>morning meditation</span>
      <span className="w-5" />
    </div>
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div
        className="w-56 h-56 rounded-full mb-8"
        style={{
          background: "radial-gradient(circle at 30% 30%, #F5E4C0, #E8B888 60%, #C4604A)",
          boxShadow: "0 20px 60px -20px rgba(196,96,74,0.5)",
        }}
      />
      <h1 className="font-heading text-[24px] mb-2" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        Coming Home
      </h1>
      <p className="italic text-[12px] mb-10" style={{ color: "hsl(var(--subtitle))" }}>day 14 of 28</p>
      <div className="w-full mb-3">
        <div className="h-1 rounded-full" style={{ background: "rgba(160,120,70,0.15)" }}>
          <div className="h-1 rounded-full" style={{ width: "42%", background: "hsl(var(--coral))" }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] italic" style={{ color: "hsl(var(--subtitle))" }}>
          <span>5:02</span><span>12:00</span>
        </div>
      </div>
      <div className="flex items-center gap-6 mt-4">
        <span className="text-[12px] italic" style={{ color: "hsl(var(--subtitle))" }}>−15s</span>
        <button
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "hsl(var(--coral))", color: "white" }}
        >
          <Pause size={28} />
        </button>
        <span className="text-[12px] italic" style={{ color: "hsl(var(--subtitle))" }}>+15s</span>
      </div>
    </div>
  </div>
);

// 10. Reflect
const ReflectMock = () => {
  const moods = ["#7A9BB5", "#9B8BBE", "#B89A6A", "#C4A030", "#C4604A"];
  return (
    <div className="w-full h-full pb-16" style={{ background: "hsl(var(--background))" }}>
      <TopBar />
      <div className="px-6 pt-4">
        <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>today</p>
        <h1 className="font-heading text-[26px] mb-6" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          how are you<span style={{ color: "hsl(var(--coral))" }}>?</span>
        </h1>
        <div className="flex justify-between mb-8 px-2">
          {moods.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full" style={{ background: c, border: i === 3 ? "3px solid hsl(var(--foreground))" : "none" }} />
            </div>
          ))}
        </div>
        <p className="text-[10px] uppercase italic mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>journal</p>
        <div className="rounded-2xl p-4 mb-6" style={{ background: "#E8DCC8", minHeight: "100px", border: "1px solid rgba(160,120,70,0.12)" }}>
          <p className="italic text-[13px]" style={{ color: "hsl(var(--subtitle))", fontFamily: "Georgia, serif" }}>
            today i noticed how my shoulders soften when i finally exhale...
          </p>
        </div>
        <p className="text-[10px] uppercase italic mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>previous entries</p>
        <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: "#E8DCC8", border: "1px solid rgba(160,120,70,0.08)" }}>
          <span className="flex-1 italic font-heading text-[14px]" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>Coming Home</span>
          <span className="text-[10px] italic" style={{ color: "hsl(var(--subtitle))" }}>Apr 2026 · 12</span>
          <ChevronRight size={14} style={{ color: "hsl(var(--subtitle))" }} />
        </div>
      </div>
      <BottomNavMock active="reflect" />
    </div>
  );
};

// 11. Settings
const SettingsMock = () => (
  <div className="w-full h-full pb-16" style={{ background: "hsl(var(--background))" }}>
    <TopBar showMenu={false} />
    <div className="px-6 pt-4">
      <h1 className="font-heading text-[28px] mb-8" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        settings<span style={{ color: "hsl(var(--coral))" }}>.</span>
      </h1>
      {[
        { label: "your voice", value: "cloned · ready" },
        { label: "morning reminder", value: "7:00 AM" },
        { label: "evening reminder", value: "10:00 PM" },
        { label: "seed voice", value: "your voice" },
        { label: "account", value: "sarah@example.com" },
      ].map((row, i) => (
        <div key={i} className="flex items-center justify-between py-4" style={{ borderBottom: "1px solid rgba(160,120,70,0.1)" }}>
          <span className="text-[14px] italic" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>{row.label}</span>
          <span className="text-[12px] italic" style={{ color: "hsl(var(--subtitle))" }}>{row.value} ›</span>
        </div>
      ))}
      <button className="w-full text-center text-[12px] italic mt-10" style={{ color: "hsl(var(--coral))" }}>
        sign out
      </button>
    </div>
  </div>
);

// 12. Admin
const AdminMock = () => (
  <div className="w-full h-full" style={{ background: "hsl(var(--background))" }}>
    <TopBar showMenu={false} />
    <div className="px-6 pt-4">
      <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>admin</p>
      <h1 className="font-heading text-[26px] mb-6" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
        dashboard<span style={{ color: "hsl(var(--coral))" }}>.</span>
      </h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { v: "1,247", l: "members" },
          { v: "89%", l: "weekly active" },
          { v: "13", l: "themes" },
          { v: "428h", l: "practiced" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.12)" }}>
            <p className="font-heading text-[22px]" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>{s.v}</p>
            <p className="text-[10px] italic mt-1" style={{ color: "hsl(var(--subtitle))" }}>{s.l}</p>
          </div>
        ))}
      </div>
      {["themes", "music library", "voice settings", "check-ins", "onboarding"].map((row, i) => (
        <div key={i} className="flex items-center justify-between py-3.5 px-4 rounded-xl mb-2" style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160,120,70,0.1)" }}>
          <span className="text-[13px] italic" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>{row}</span>
          <ChevronRight size={16} style={{ color: "hsl(var(--subtitle))" }} />
        </div>
      ))}
    </div>
  </div>
);

// ============= GALLERY =============
const SECTIONS = [
  { title: "Arrival", screens: [
    { label: "Splash", node: <SplashScreen /> },
    { label: "Sign In / Up", node: <AuthScreen /> },
  ]},
  { title: "Onboarding", screens: [
    { label: "Welcome", node: <OnboardingWelcome /> },
    { label: "Guided Questions", node: <OnboardingQuestions /> },
    { label: "Voice Capture", node: <VoiceCaptureMock /> },
    { label: "Generating Chapter", node: <GeneratingMock /> },
  ]},
  { title: "Daily Practice", screens: [
    { label: "Home", node: <HomeMock /> },
    { label: "My Month", node: <MyMonthMock /> },
    { label: "Practice Player", node: <PracticeMock /> },
    { label: "Reflect", node: <ReflectMock /> },
  ]},
  { title: "Account & Admin", screens: [
    { label: "Settings", node: <SettingsMock /> },
    { label: "Admin", node: <AdminMock /> },
  ]},
];

const FlowPreview = () => {
  let stepCounter = 0;
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-6 mb-12 text-center">
        <p className="text-[10px] uppercase italic mb-3" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
          Mockup
        </p>
        <h1 className="font-heading leading-tight mb-3" style={{ fontSize: "40px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
          The full Youtopia journey<span style={{ color: "hsl(var(--coral))" }}>.</span>
        </h1>
        <p className="italic" style={{ fontSize: "13px", color: "hsl(var(--subtitle))" }}>
          Every screen, in order. Scroll horizontally inside each section to walk through the flow.
        </p>
      </div>

      <div className="space-y-16">
        {SECTIONS.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="max-w-4xl mx-auto px-6 mb-6">
              <p className="text-[10px] uppercase italic mb-2" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
                Section {sIdx + 1}
              </p>
              <h2 className="font-heading text-[24px]" style={{ color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
                {section.title}<span style={{ color: "hsl(var(--coral))" }}>.</span>
              </h2>
            </div>
            <div className="overflow-x-auto pb-6">
              <div className="flex gap-10 px-10" style={{ width: "max-content" }}>
                {section.screens.map((s, i) => {
                  stepCounter += 1;
                  return (
                    <PhoneFrame key={i} label={s.label} step={stepCounter}>
                      {s.node}
                    </PhoneFrame>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center italic text-[12px] mt-16" style={{ color: "hsl(var(--subtitle))" }}>
        — end of flow —
      </p>
    </div>
  );
};

export default FlowPreview;
