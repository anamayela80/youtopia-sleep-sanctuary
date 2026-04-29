import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2
      className="font-heading mb-3"
      style={{ fontSize: "18px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
    >
      {title}
    </h2>
    <div className="space-y-3" style={{ fontSize: "14px", color: "hsl(var(--subtitle))", lineHeight: 1.75 }}>
      {children}
    </div>
  </div>
);

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1" aria-label="Back">
          <ArrowLeft size={20} style={{ color: "hsl(var(--subtitle))" }} />
        </button>
        <h1
          className="font-heading"
          style={{ fontSize: "16px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
        >
          Privacy Policy
        </h1>
      </div>

      <div className="max-w-xl mx-auto px-6 pt-8">
        {/* Last updated */}
        <p
          className="italic mb-8"
          style={{ fontSize: "11px", letterSpacing: "0.1em", color: "hsl(var(--subtitle))" }}
        >
          Last updated: April 2026
        </p>

        <p className="mb-8" style={{ fontSize: "14px", color: "hsl(var(--subtitle))", lineHeight: 1.75 }}>
          YOUtopia Within is a personalised meditation experience. We take your privacy seriously.
          This policy explains what we collect, why we collect it, and how we protect it.
        </p>

        <Section title="What we collect">
          <p><strong style={{ color: "hsl(var(--foreground))" }}>Account information</strong> — your email address and name when you sign up.</p>
          <p><strong style={{ color: "hsl(var(--foreground))" }}>Intake answers</strong> — the personal reflection questions you answer at the start of each chapter. These are used exclusively to generate your personalised meditation and evening seeds.</p>
          <p><strong style={{ color: "hsl(var(--foreground))" }}>Daily mood check-ins</strong> — the mood score (1–5) you log through the Reflect section, plus any optional notes you add.</p>
          <p><strong style={{ color: "hsl(var(--foreground))" }}>Journal entries</strong> — text you write in the Reflect section. These are stored privately and are never shared.</p>
          <p><strong style={{ color: "hsl(var(--foreground))" }}>Usage data</strong> — basic session information (when you open the app, which features you use) to help us improve the experience.</p>
        </Section>

        <Section title="Your voice — what we don't collect">
          <p
            className="rounded-xl px-4 py-4"
            style={{
              background: "rgba(107, 158, 143, 0.10)",
              border: "1px solid rgba(107, 158, 143, 0.30)",
              color: "#4E8C7A",
              lineHeight: 1.8,
            }}
          >
            <strong>We never record, store, or process your voice.</strong> The narration you hear in your meditations is an AI-synthesised voice — it is not your voice and has nothing to do with your voice. YOUtopia has no microphone access and no voice-recording feature. Your own voice never touches our systems.
          </p>
          <p>
            The meditation audio is generated fresh for each session using a third-party text-to-speech service (ElevenLabs). The audio files are stored securely so you can replay your meditation, but they contain only the AI narration — never anything you said or recorded.
          </p>
        </Section>

        <Section title="How we use your information">
          <p>Your intake answers, name, and theme are passed to an AI language model (Claude by Anthropic) to generate a meditation script written specifically for you. This script is then converted to audio by ElevenLabs.</p>
          <p>Your mood data and journal entries are used only to show you your own history in the app. We do not analyse or profile you with this data for advertising or any purpose other than your personal reflection.</p>
          <p>We do not sell your data. We do not use your data for advertising. We do not share your personal information with third parties except as described below.</p>
        </Section>

        <Section title="Third-party services">
          <p>To deliver the YOUtopia experience, we work with the following services. Each has its own privacy policy that governs how they handle data passed to them.</p>
          <ul className="space-y-2 pl-4">
            <li><strong style={{ color: "hsl(var(--foreground))" }}>Supabase</strong> — database and file storage. Your account data, intake answers, mood scores, journal entries, and generated audio files are stored on Supabase servers. <span style={{ color: "#4E8C7A" }}>supabase.com/privacy</span></li>
            <li><strong style={{ color: "hsl(var(--foreground))" }}>Anthropic (Claude)</strong> — AI model used to write your personalised meditation script. Your intake answers and first name are included in the prompt. Anthropic does not use API data to train models. <span style={{ color: "#4E8C7A" }}>anthropic.com/privacy</span></li>
            <li><strong style={{ color: "hsl(var(--foreground))" }}>ElevenLabs</strong> — text-to-speech service that converts your meditation script to audio. The script text is sent to ElevenLabs to generate the narration. No personal identifiers are included. <span style={{ color: "#4E8C7A" }}>elevenlabs.io/privacy</span></li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>Your data is kept as long as your account is active. If you delete your account, we will delete your personal data within 30 days, including intake answers, mood entries, journal entries, and generated audio files.</p>
          <p>To request account deletion, contact us at <strong style={{ color: "hsl(var(--foreground))" }}>hello@youtopiawithin.com</strong>.</p>
        </Section>

        <Section title="Your rights">
          <p>You have the right to access, correct, or delete your personal data at any time. You also have the right to export your data or object to how we process it.</p>
          <p>To exercise any of these rights, email us at <strong style={{ color: "hsl(var(--foreground))" }}>hello@youtopiawithin.com</strong> and we will respond within 30 days.</p>
        </Section>

        <Section title="Security">
          <p>All data is transmitted over HTTPS and stored with encryption at rest through Supabase. We follow industry-standard practices to protect your information. No system is perfectly secure, but we take your privacy seriously and act quickly if anything changes.</p>
        </Section>

        <Section title="Children">
          <p>YOUtopia is intended for adults aged 18 and over. We do not knowingly collect personal information from anyone under 18. If you believe a minor has created an account, contact us and we will delete it promptly.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy as the app evolves. We will notify you of significant changes via the app or email. Continued use after changes means you accept the updated policy.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Reach us at <strong style={{ color: "hsl(var(--foreground))" }}>hello@youtopiawithin.com</strong></p>
        </Section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
