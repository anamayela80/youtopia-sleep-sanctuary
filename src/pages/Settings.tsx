import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Clock, ChevronRight, LogOut, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deleteUserVoiceClone, getUserVoiceClone, getAllMeditations } from "@/services/meditationService";

type SeedPref = "clone" | "preset";

const SettingsPage = () => {
  const [hasVoiceClone, setHasVoiceClone] = useState(false);
  const [seedPref, setSeedPref] = useState<SeedPref>("clone");
  const [updatingPref, setUpdatingPref] = useState(false);
  const [meditations, setMeditations] = useState<any[]>([]);
  const [morningTime, setMorningTime] = useState("07:00");
  const [nightTime, setNightTime] = useState("22:00");
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    const [voiceId, meds, profile] = await Promise.all([
      getUserVoiceClone(user.id),
      getAllMeditations(user.id),
      supabase.from("profiles").select("morning_reminder_time, night_reminder_time, seed_voice_preference").eq("user_id", user.id).maybeSingle(),
    ]);

    setHasVoiceClone(!!voiceId);
    setMeditations(meds);
    if (profile.data?.morning_reminder_time) setMorningTime(profile.data.morning_reminder_time);
    if (profile.data?.night_reminder_time) setNightTime(profile.data.night_reminder_time);
    if (profile.data?.seed_voice_preference === "preset" || profile.data?.seed_voice_preference === "clone") {
      setSeedPref(profile.data.seed_voice_preference as SeedPref);
    }
    setLoading(false);
  };

  const handleSeedPrefChange = async (next: SeedPref) => {
    if (next === seedPref || updatingPref) return;
    setUpdatingPref(true);
    try {
      const { data, error } = await supabase.functions.invoke("renarrate-seeds", {
        body: { preference: next },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSeedPref(next);
      toast({
        title: "Seeds re-narrated",
        description: next === "preset" ? "Now using the Youtopia voice." : "Now using your voice.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't switch voice", description: e.message || "Please try again." });
    } finally {
      setUpdatingPref(false);
    }
  };

  const handleDeleteVoice = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await deleteUserVoiceClone(user.id);
      setHasVoiceClone(false);
      // Force preset preference, since clone is gone
      await supabase.from("profiles").update({ seed_voice_preference: "preset" }).eq("user_id", user.id);
      setSeedPref("preset");
      setShowDeleteConfirm(false);
      toast({ title: "Voice clone deleted", description: "Seeds will use the preset voice." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleUpdateTimes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({
      morning_reminder_time: morningTime,
      night_reminder_time: nightTime,
    }).eq("user_id", user.id);

    toast({ title: "Reminder times updated" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-10 h-10 rounded-full bg-primary/20" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/home")} className="text-accent">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-heading text-2xl text-secondary">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Voice Clone */}
        <div className="bg-cream-light rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <Mic size={20} className="text-primary" />
            <h3 className="font-body font-semibold text-foreground">Your Voice Clone</h3>
          </div>
          {hasVoiceClone ? (
            <>
              <p className="font-body text-sm text-muted-foreground mb-3">
                Your voice clone is active. You can also use the Youtopia voice if you prefer.
              </p>
              {showDeleteConfirm ? (
                <div className="bg-destructive/10 rounded-xl p-4">
                  <p className="font-body text-sm text-foreground mb-3">
                    Deleting your voice clone will switch your seeds to the preset Youtopia voice. Are you sure?
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-xl bg-muted font-body text-sm">Cancel</button>
                    <button onClick={handleDeleteVoice} className="flex-1 py-2 rounded-xl bg-destructive text-white font-body text-sm">Delete</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 font-body text-sm"
                  style={{ color: "#8B6914", background: "transparent", padding: 0 }}
                >
                  <Trash2 size={16} /> Delete voice clone
                </button>
              )}
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">
              No voice clone on file. Your seeds use the Youtopia voice.
            </p>
          )}
        </div>

        {/* Seed Voice Preference — only when a clone exists */}
        {hasVoiceClone && (
          <div className="bg-cream-light rounded-2xl p-5 border border-border">
            <h3 className="font-body font-semibold text-foreground mb-1">Seeds Voice</h3>
            <p className="font-body text-xs text-muted-foreground mb-4">
              Choose which voice narrates your nightly seeds. Switching will re-narrate them now.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "clone" as SeedPref, label: "Your voice", sub: "Personal clone" },
                { key: "preset" as SeedPref, label: "Youtopia voice", sub: "Preset guide" },
              ]).map((opt) => {
                const active = seedPref === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSeedPrefChange(opt.key)}
                    disabled={updatingPref}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted/40"
                    } disabled:opacity-60`}
                  >
                    <p className={`font-body text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>
                      {opt.label}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
            {updatingPref && (
              <p className="font-body text-xs text-muted-foreground mt-3 italic">
                Re-narrating your seeds… this can take a moment.
              </p>
            )}
          </div>
        )}

        {/* Reminder Times */}
        <div className="bg-cream-light rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={20} className="text-primary" />
            <h3 className="font-body font-semibold text-foreground">Reminder Times</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-accent">Morning meditation</span>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="font-body text-sm bg-background rounded-lg px-3 py-1.5 border border-border"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-accent">Night seeds</span>
              <input
                type="time"
                value={nightTime}
                onChange={(e) => setNightTime(e.target.value)}
                className="font-body text-sm bg-background rounded-lg px-3 py-1.5 border border-border"
              />
            </div>
            <button
              onClick={handleUpdateTimes}
              className="w-full font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "#4A9A88",
                color: "#FFFFFF",
                borderRadius: "50px",
                padding: "14px",
                fontSize: "15px",
              }}
            >
              Save Times
            </button>
          </div>
        </div>

        {/* Meditation Library */}
        {meditations.length > 0 && (
          <div className="bg-cream-light rounded-2xl p-5 border border-border">
            <h3 className="font-body font-semibold text-foreground mb-4">Meditation Library</h3>
            <div className="space-y-2">
              {meditations.map((med) => (
                <div key={med.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-body text-sm text-foreground">{med.title}</p>
                    <p className="font-body text-xs text-muted-foreground">{med.month}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 font-body"
          style={{
            color: "#8B6914",
            background: "transparent",
            padding: "14px",
            fontSize: "14px",
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
