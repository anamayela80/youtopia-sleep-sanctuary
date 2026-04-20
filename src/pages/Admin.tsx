import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminThemes } from "@/components/admin/AdminThemes";
import { AdminMusic } from "@/components/admin/AdminMusic";
import { AdminVoice } from "@/components/admin/AdminVoice";
import { AdminCheckins } from "@/components/admin/AdminCheckins";

type Tab = "dashboard" | "themes" | "music" | "voice" | "checkins";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "themes", label: "Themes" },
  { id: "music", label: "Music" },
  { id: "voice", label: "Voice" },
  { id: "checkins", label: "Check-ins" },
];

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth?mode=login"); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) { navigate("/home"); return; }
      setIsAdmin(true);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-10 h-10 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-12 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/home")} className="text-accent">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-heading text-2xl text-secondary">Admin Panel</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl font-body text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "themes" && <AdminThemes />}
      {tab === "music" && <AdminMusic />}
      {tab === "voice" && <AdminVoice />}
      {tab === "checkins" && <AdminCheckins />}
    </div>
  );
};

export default Admin;
