import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveTheme, getUserProfile } from "@/services/meditationService";
import logo from "@/assets/youtopia-logo.png";

const replaceName = (text: string | null | undefined, name: string) =>
  (text || "").replace(/\{name\}/gi, name || "friend");

const Practice = () => {
  const [theme, setTheme] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth?mode=login"); return; }
      const [t, p] = await Promise.all([getActiveTheme(), getUserProfile(user.id)]);
      setTheme(t);
      setFirstName((p?.full_name || "").split(" ")[0] || "");
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-10 h-10 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  const about = replaceName(theme?.about, firstName);
  const science = replaceName(theme?.science, firstName);
  const practice = replaceName(theme?.practice, firstName);

  const Section = ({ label, body }: { label: string; body: string }) =>
    body ? (
      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage mb-3">
          {label}
        </p>
        <div className="bg-card rounded-3xl p-6 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]">
          <div className="font-body text-[15px] text-accent/85 leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
        </div>
      </section>
    ) : null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/home")} className="text-accent" aria-label="Back">
            <ArrowLeft size={24} />
          </button>
          <img src={logo} alt="YOUTOPIA" className="h-5 opacity-80" />
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage mb-3">
          This Month's Practice
        </p>
        <h1 className="font-heading text-4xl md:text-5xl text-coral-dark leading-[1.05] tracking-tight mb-10">
          {theme?.theme || "Your Practice"}
        </h1>

        <Section label="What this month is about" body={about} />
        <Section label="Why it works: the science" body={science} />
        <Section label="Your practice this month" body={practice} />

        {!about && !science && !practice && (
          <p className="font-body text-sm text-muted-foreground italic">
            Your practice details will appear here once added in the admin panel.
          </p>
        )}
      </div>
    </div>
  );
};

export default Practice;
