import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, Save, Users, Send, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"theme" | "dashboard">("theme");

  // Theme form
  const [themeName, setThemeName] = useState("");
  const [themeDescription, setThemeDescription] = useState("");
  const [themeIntention, setThemeIntention] = useState("");
  const [guideVoiceId, setGuideVoiceId] = useState("9BDgg2Q7WSrW0x8naPLw");
  const [q1, setQ1] = useState("How do you want to feel every day this month?");
  const [q2, setQ2] = useState("What does your life look and feel like 90 days from now?");
  const [q3, setQ3] = useState("What is one thing you are ready to release this month?");
  const [checkinQuestion, setCheckinQuestion] = useState("");
  const [checkinCount, setCheckinCount] = useState(1);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [existingThemeId, setExistingThemeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dashboard
  const [stats, setStats] = useState({ users: 0, meditations: 0, seeds: 0, checkins: 0 });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) { navigate("/home"); return; }

    setIsAdmin(true);
    await loadTheme();
    await loadStats();
    setLoading(false);
  };

  const loadTheme = async () => {
    const { data } = await supabase.from("monthly_themes").select("*").eq("is_active", true).maybeSingle();
    if (data) {
      setExistingThemeId(data.id);
      setThemeName(data.theme || "");
      setThemeDescription(data.description || "");
      setThemeIntention(data.intention || "");
      setGuideVoiceId(data.guide_voice_id || "9BDgg2Q7WSrW0x8naPLw");
      setCheckinQuestion(data.checkin_question || "");
      setCheckinCount(data.checkin_count || 1);
      if (data.questions) {
        try {
          const qs = typeof data.questions === "string" ? JSON.parse(data.questions) : data.questions;
          if (Array.isArray(qs) && qs.length >= 3) {
            setQ1(qs[0]); setQ2(qs[1]); setQ3(qs[2]);
          }
        } catch {}
      }
    }
  };

  const loadStats = async () => {
    const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
    const [usersRes, medsRes, seedsRes, checkinsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("meditations").select("id", { count: "exact", head: true }).eq("month", currentMonth),
      supabase.from("seeds").select("id", { count: "exact", head: true }).eq("month", currentMonth),
      supabase.from("checkin_responses").select("id", { count: "exact", head: true }).eq("month", currentMonth),
    ]);
    setStats({
      users: usersRes.count || 0,
      meditations: medsRes.count || 0,
      seeds: seedsRes.count || 0,
      checkins: checkinsRes.count || 0,
    });
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    try {
      const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      let musicUrl: string | undefined;

      // Upload music if provided
      if (musicFile) {
        const fileName = `theme-music/${currentMonth.replace(/\s/g, "-")}-${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from("meditations")
          .upload(fileName, musicFile, { contentType: musicFile.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("meditations").getPublicUrl(fileName);
        musicUrl = urlData.publicUrl;
      }

      const themeData: any = {
        theme: themeName,
        month: currentMonth,
        description: themeDescription,
        intention: themeIntention,
        guide_voice_id: guideVoiceId,
        questions: JSON.stringify([q1, q2, q3]),
        checkin_question: checkinQuestion,
        checkin_count: checkinCount,
        is_active: true,
      };
      if (musicUrl) themeData.music_file_url = musicUrl;

      // Deactivate all other themes
      await supabase.from("monthly_themes").update({ is_active: false }).neq("id", existingThemeId || "");

      if (existingThemeId) {
        await supabase.from("monthly_themes").update(themeData).eq("id", existingThemeId);
      } else {
        const { data } = await supabase.from("monthly_themes").insert(themeData).select("id").single();
        if (data) setExistingThemeId(data.id);
      }

      toast({ title: "Theme saved ✨" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-10 h-10 rounded-full bg-primary/20" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/home")} className="text-accent"><ArrowLeft size={24} /></button>
        <h1 className="font-heading text-2xl text-secondary">Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("theme")}
          className={`px-4 py-2 rounded-xl font-body text-sm font-medium transition-all ${tab === "theme" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          Monthly Theme
        </button>
        <button
          onClick={() => setTab("dashboard")}
          className={`px-4 py-2 rounded-xl font-body text-sm font-medium transition-all ${tab === "dashboard" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          Dashboard
        </button>
      </div>

      {tab === "theme" && (
        <div className="space-y-5">
          {/* Theme Name */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Theme Name</label>
            <input value={themeName} onChange={(e) => setThemeName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" placeholder="The eye of the storm" />
          </div>

          {/* Description */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Description (2-3 sentences)</label>
            <textarea value={themeDescription} onChange={(e) => setThemeDescription(e.target.value)}
              className="w-full h-24 px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground resize-none" />
          </div>

          {/* Intention */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Core Intention (one line)</label>
            <input value={themeIntention} onChange={(e) => setThemeIntention(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" placeholder="Finding stillness within the chaos" />
          </div>

          {/* Questions */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Question 1</label>
            <input value={q1} onChange={(e) => setQ1(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" />
          </div>
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Question 2</label>
            <input value={q2} onChange={(e) => setQ2(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" />
          </div>
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Question 3</label>
            <input value={q3} onChange={(e) => setQ3(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" />
          </div>

          {/* Guide Voice ID */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Guide Voice ID (ElevenLabs)</label>
            <input value={guideVoiceId} onChange={(e) => setGuideVoiceId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground font-mono text-xs" />
          </div>

          {/* Music Upload */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Theme Music (ambient track)</label>
            <label className="flex items-center gap-3 p-4 rounded-xl bg-cream-light border border-border cursor-pointer hover:border-primary/40 transition-all">
              <Upload size={20} className="text-muted-foreground" />
              <span className="font-body text-sm text-muted-foreground">
                {musicFile ? musicFile.name : "Upload music file"}
              </span>
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => setMusicFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Check-in */}
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Check-in Question</label>
            <input value={checkinQuestion} onChange={(e) => setCheckinQuestion(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" placeholder="What made you feel most alive today?" />
          </div>
          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Check-ins per month</label>
            <select value={checkinCount} onChange={(e) => setCheckinCount(Number(e.target.value))}
              className="px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground">
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <button onClick={handleSaveTheme} disabled={saving || !themeName}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={18} />
            {saving ? "Saving..." : "Save & Publish Theme"}
          </button>
        </div>
      )}

      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total Users", value: stats.users, icon: Users },
              { label: "Meditations", value: stats.meditations, icon: BarChart3 },
              { label: "Seeds Sessions", value: stats.seeds, icon: BarChart3 },
              { label: "Check-in Responses", value: stats.checkins, icon: Send },
            ].map((s) => (
              <div key={s.label} className="bg-cream-light rounded-2xl p-4 border border-border">
                <s.icon size={18} className="text-primary mb-2" />
                <p className="font-heading text-2xl text-secondary">{s.value}</p>
                <p className="font-body text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
