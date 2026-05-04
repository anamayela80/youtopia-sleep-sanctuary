import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, ChevronRight, LogOut, Mic, Square, RotateCcw, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deleteUserVoiceClone, getUserVoiceClone, getAllMeditations, cloneVoice, saveVoiceClone } from "@/services/meditationService";
import { getCurrentIntake } from "@/services/intakeService";

type SeedPref = "clone" | "preset";

const MIN_RECORD_SECONDS = 60;
const MAX_RECORD_SECONDS = 90;

const SettingsPage = () => {
  const [hasVoiceClone, setHasVoiceClone] = useState(false);
  const [seedPref, setSeedPref] = useState<SeedPref>("preset");
  const [switchAvailable, setSwitchAvailable] = useState(true);
  const [intakeStartDate, setIntakeStartDate] = useState<string | null>(null);
  const [updatingPref, setUpdatingPref] = useState(false);
  const [meditations, setMeditations] = useState<any[]>([]);
  const [morningTime, setMorningTime] = useState("07:00");
  const [nightTime, setNightTime] = useState("22:00");
  const [loading, setLoading] = useState(true);

  // Inline voice recording
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    const [voiceId, meds, profileRes, intake] = await Promise.all([
      getUserVoiceClone(user.id),
      getAllMeditations(user.id),
      supabase.from("profiles").select("morning_reminder_time, night_reminder_time, seed_voice_preference, voice_switch_used_at").eq("user_id", user.id).maybeSingle(),
      getCurrentIntake(user.id),
    ]);

    if (!intake) { navigate("/onboarding"); return; }

    setHasVoiceClone(!!voiceId);
    setMeditations(meds);

    const p = profileRes.data;
    if (p?.morning_reminder_time) setMorningTime(p.morning_reminder_time);
    if (p?.night_reminder_time) setNightTime(p.night_reminder_time);
    if (p?.seed_voice_preference === "preset" || p?.seed_voice_preference === "clone") {
      setSeedPref(p.seed_voice_preference as SeedPref);
    }

    // Determine if the voice switch is still available this chapter.
    // voice_switch_used_at is reset implicitly each chapter: if the switch happened
    // before the current intake started, the chapter is fresh and the switch is available again.
    if (intake) {
      setIntakeStartDate(intake.intake_start_date);
      if (p?.voice_switch_used_at) {
        const switchedAt = new Date(p.voice_switch_used_at);
        const chapterStart = new Date(intake.intake_start_date);
        setSwitchAvailable(switchedAt < chapterStart);
      } else {
        setSwitchAvailable(true);
      }
    } else {
      setSwitchAvailable(true);
    }

    setLoading(false);
  };

  // Mark the switch as used for this chapter
  const markSwitchUsed = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ voice_switch_used_at: new Date().toISOString() }).eq("user_id", user.id);
    setSwitchAvailable(false);
  };

  // Switch to preset (Serena) — only for users who already have a clone
  const switchToPreset = async () => {
    if (updatingPref || !switchAvailable) return;
    setUpdatingPref(true);
    try {
      const { data, error } = await supabase.functions.invoke("renarrate-seeds", { body: { preference: "preset" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSeedPref("preset");
      await markSwitchUsed();
      toast({ title: "Voice switched", description: "Your seeds are now narrated by Serena." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't switch voice", description: e.message || "Please try again." });
    } finally {
      setUpdatingPref(false);
    }
  };

  // Switch to clone — only for users who already have a clone
  const switchToClone = async () => {
    if (updatingPref || !switchAvailable) return;
    setUpdatingPref(true);
    try {
      const { data, error } = await supabase.functions.invoke("renarrate-seeds", { body: { preference: "clone" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSeedPref("clone");
      await markSwitchUsed();
      toast({ title: "Voice switched", description: "Your seeds are now narrated in your own voice." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't switch voice", description: e.message || "Please try again." });
    } finally {
      setUpdatingPref(false);
    }
  };

  // ── Recording flow (for users without a clone) ──────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setRecordingState("done");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_RECORD_SECONDS) {
            mediaRecorderRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_RECORD_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast({ variant: "destructive", title: "Microphone access required", description: "Please allow microphone access to record your voice." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetRecording = () => {
    setRecordingState("idle");
    setElapsed(0);
    setAudioBlob(null);
  };

  // After confirming the recording: clone voice → renarrate seeds → mark switch used
  const confirmRecording = async () => {
    if (!audioBlob || isProcessingVoice) return;
    setIsProcessingVoice(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const clonedId = await cloneVoice(audioBlob);
      await saveVoiceClone(user.id, clonedId);
      setHasVoiceClone(true);

      const { data, error } = await supabase.functions.invoke("renarrate-seeds", { body: { preference: "clone" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSeedPref("clone");
      await markSwitchUsed();
      setRecordingState("idle");
      setAudioBlob(null);
      toast({ title: "Voice recorded", description: "Your seeds are now narrated in your own voice." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Something went wrong", description: e.message || "Please try again." });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleUpdateTimes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ morning_reminder_time: morningTime, night_reminder_time: nightTime }).eq("user_id", user.id);
    toast({ title: "Reminder times updated" });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-10 h-10 rounded-full bg-primary/20" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  // ── Voice section rendering helpers ─────────────────────────────────────

  const voiceOptionButton = (
    key: "clone" | "preset",
    label: string,
    sub: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
    disabled: boolean,
  ) => (
    <button
      key={key}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl p-4 text-left border transition-all disabled:opacity-50 ${
        active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        <p className={`font-body text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{label}</p>
      </div>
      <p className="font-body text-[11px] text-muted-foreground leading-relaxed">{sub}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/home")} className="text-accent">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-heading text-2xl text-secondary">Settings</h1>
      </div>

      <div className="space-y-6">

        {/* ── Seeds Voice ─────────────────────────────────────────────────── */}
        <div className="bg-cream-light rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-1">
            <Mic size={20} className="text-primary" />
            <h3 className="font-body font-semibold text-foreground">Seeds Voice</h3>
          </div>

          {switchAvailable ? (
            <>
              <p className="font-body text-xs text-muted-foreground mb-4 leading-relaxed">
                Choose the voice for your nightly seeds. You can switch once per chapter — your seeds will be re-narrated immediately.
              </p>

              {/* Case 1: Has a voice clone — show both options as a toggle */}
              {hasVoiceClone && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {voiceOptionButton(
                      "clone", "Your voice", "Your personal recording",
                      <Mic size={14} />, seedPref === "clone",
                      switchToClone, updatingPref || seedPref === "clone",
                    )}
                    {voiceOptionButton(
                      "preset", "Serena", "The Youtopia voice",
                      <Sparkles size={14} />, seedPref === "preset",
                      switchToPreset, updatingPref || seedPref === "preset",
                    )}
                  </div>
                  {updatingPref && (
                    <p className="font-body text-xs text-muted-foreground italic">Re-narrating your seeds… this takes a moment.</p>
                  )}
                </>
              )}

              {/* Case 2: No voice clone — Serena is active, offer to record */}
              {!hasVoiceClone && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {voiceOptionButton(
                      "preset", "Serena", "Currently active",
                      <Sparkles size={14} />, true,
                      () => {}, true,
                    )}
                    <button
                      onClick={() => setRecordingState("recording")}
                      disabled={recordingState !== "idle" || isProcessingVoice}
                      className="rounded-xl p-4 text-left border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Mic size={14} className="text-primary" />
                        <p className="font-body text-sm font-semibold text-primary">Your voice</p>
                      </div>
                      <p className="font-body text-[11px] text-muted-foreground">Record 60 seconds to switch</p>
                    </button>
                  </div>

                  {/* Recording UI */}
                  {recordingState !== "idle" && (
                    <div className="rounded-2xl border border-border bg-background p-4 mt-2">
                      {recordingState === "recording" && (
                        <>
                          <p className="font-body text-xs text-muted-foreground mb-3 italic text-center">
                            Speak naturally — talk about something you're looking forward to this month.
                          </p>
                          <div className="flex flex-col items-center gap-4">
                            <span className="font-heading text-3xl text-foreground">{formatTime(elapsed)}</span>
                            {elapsed === 0 ? (
                              <button
                                onClick={startRecording}
                                className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white active:scale-95 transition-all"
                              >
                                <Mic size={26} />
                              </button>
                            ) : (
                              <button
                                onClick={stopRecording}
                                disabled={elapsed < MIN_RECORD_SECONDS}
                                className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-white active:scale-95 transition-all disabled:opacity-40"
                              >
                                <Square size={22} />
                              </button>
                            )}
                            {elapsed < MIN_RECORD_SECONDS && elapsed > 0 && (
                              <p className="font-body text-xs text-primary">{MIN_RECORD_SECONDS - elapsed}s more needed</p>
                            )}
                          </div>
                        </>
                      )}

                      {recordingState === "done" && (
                        <div className="flex flex-col items-center gap-4">
                          {isProcessingVoice ? (
                            <>
                              <motion.div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                              <p className="font-body text-xs text-muted-foreground italic">Cloning your voice and re-narrating seeds…</p>
                            </>
                          ) : (
                            <>
                              <p className="font-body text-sm text-foreground">Recording ready. Use this voice?</p>
                              <div className="flex gap-4">
                                <button onClick={resetRecording} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center active:scale-95">
                                  <RotateCcw size={18} className="text-muted-foreground" />
                                </button>
                                <button onClick={confirmRecording} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white active:scale-95 transition-all">
                                  <Check size={24} />
                                </button>
                              </div>
                              <p className="font-body text-[10px] text-muted-foreground text-center">
                                Re-record or confirm — this uses your one switch for this chapter.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Switch already used this chapter */
            <>
              <div className="flex items-center gap-3 mt-2 mb-3">
                {seedPref === "clone"
                  ? <><Mic size={16} className="text-primary" /><p className="font-body text-sm text-foreground">Currently using <strong>your voice</strong></p></>
                  : <><Sparkles size={16} className="text-primary" /><p className="font-body text-sm text-foreground">Currently using <strong>Serena</strong></p></>
                }
              </div>
              <p className="font-body text-xs text-muted-foreground italic leading-relaxed">
                You've already switched your voice this chapter. Your next switch will be available when your next chapter begins.
              </p>
            </>
          )}
        </div>

        {/* ── Reminder Times ───────────────────────────────────────────────── */}
        <div className="bg-cream-light rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={20} className="text-primary" />
            <h3 className="font-body font-semibold text-foreground">Reminder Times</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-accent">Morning meditation</span>
              <input type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} className="font-body text-sm bg-background rounded-lg px-3 py-1.5 border border-border" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-accent">Night seeds</span>
              <input type="time" value={nightTime} onChange={(e) => setNightTime(e.target.value)} className="font-body text-sm bg-background rounded-lg px-3 py-1.5 border border-border" />
            </div>
            <button
              onClick={handleUpdateTimes}
              className="w-full font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#4A9A88", color: "#FFFFFF", borderRadius: "50px", padding: "14px", fontSize: "15px" }}
            >
              Save Times
            </button>
          </div>
        </div>

        {/* ── Meditation Library ───────────────────────────────────────────── */}
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

        {/* ── Sign Out ─────────────────────────────────────────────────────── */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 font-body"
          style={{ color: "#8B6914", background: "transparent", padding: "14px", fontSize: "14px" }}
        >
          <LogOut size={18} /> Sign Out
        </button>

        {/* ── Legal ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <button onClick={() => navigate("/privacy")} className="font-body hover:opacity-80" style={{ fontSize: "11px", color: "#A08060", textDecoration: "underline", textUnderlineOffset: "3px" }}>Privacy Policy</button>
          <span style={{ color: "#C8B090", fontSize: "11px" }}>·</span>
          <button onClick={() => navigate("/terms")} className="font-body hover:opacity-80" style={{ fontSize: "11px", color: "#A08060", textDecoration: "underline", textUnderlineOffset: "3px" }}>Terms of Service</button>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
