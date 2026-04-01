import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Pause, Download, Bell, Library, Settings, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioMixer } from "@/hooks/useAudioMixer";
import logo from "@/assets/youtopia-logo.png";

interface Meditation {
  id: string;
  title: string;
  audio_url: string | null;
  music_url: string | null;
  music_mood: string;
  month: string;
  created_at: string;
}

const Home = () => {
  const [meditations, setMeditations] = useState<Meditation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const currentMeditation = meditations[0];
  const pastMeditations = meditations.slice(1);

  const {
    isPlaying,
    isLoading: audioLoading,
    progress,
    currentTime,
    duration,
    togglePlay,
  } = useAudioMixer({
    narrationUrl: currentMeditation?.audio_url || null,
    musicMood: currentMeditation?.music_mood || "deep-sleep",
    musicVolume: 0.15,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?mode=login");
        return;
      }
      fetchMeditations();
    };
    checkAuth();
  }, []);

  const fetchMeditations = async () => {
    const { data } = await supabase
      .from("meditations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMeditations(data as Meditation[]);
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <img src={logo} alt="YOUTOPIA" className="h-8" />
        <button onClick={handleSignOut} className="text-accent text-xs font-body">
          Sign out
        </button>
      </div>

      {/* Beta banner */}
      <div className="mx-6 mb-6">
        <div className="bg-teal-light/40 rounded-xl px-4 py-2.5 text-center">
          <p className="text-xs font-body text-teal-dark">
            ✨ Welcome to our free beta — full access while we're getting started
          </p>
        </div>
      </div>

      {currentMeditation ? (
        <>
          {/* Player card */}
          <div className="px-6 mb-8">
            <div className="bg-cream-light rounded-3xl p-6 border border-border">
              <div className="flex justify-center mb-6">
                <motion.div
                  className="w-40 h-40 rounded-full bg-gradient-to-br from-teal-light via-primary/30 to-coral-light flex items-center justify-center"
                  animate={isPlaying ? { rotate: 360 } : {}}
                  transition={isPlaying ? { duration: 20, repeat: Infinity, ease: "linear" } : {}}
                >
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-primary/20 to-coral-light/50 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-cream-light flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary" />
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="text-center mb-5">
                <h3 className="font-heading text-lg text-secondary mb-1">{currentMeditation.title}</h3>
                <p className="font-body text-sm text-muted-foreground capitalize">
                  {currentMeditation.music_mood.replace("-", " ")}
                </p>
              </div>

              <div className="mb-4">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-body text-muted-foreground">{formatTime(currentTime)}</span>
                  <span className="text-xs font-body text-muted-foreground">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-8">
                {currentMeditation.audio_url && (
                  <a href={currentMeditation.audio_url} download className="text-accent">
                    <Download size={20} />
                  </a>
                )}
                <button
                  onClick={togglePlay}
                  disabled={audioLoading}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  {audioLoading ? (
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  ) : isPlaying ? (
                    <Pause size={24} />
                  ) : (
                    <Play size={24} className="ml-1" />
                  )}
                </button>
                <button className="text-accent">
                  <Bell size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Library */}
          {pastMeditations.length > 0 && (
            <div className="px-6">
              <h3 className="font-heading text-lg text-secondary mb-4">Your Library</h3>
              <div className="space-y-3">
                {pastMeditations.map((med) => (
                  <div key={med.id} className="flex items-center gap-4 p-3 rounded-2xl bg-cream-light border border-border">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-light to-coral-light/40 flex items-center justify-center">
                      <Play size={16} className="text-foreground/60 ml-0.5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-body font-medium text-sm text-foreground">{med.title}</p>
                      <p className="font-body text-xs text-muted-foreground capitalize">
                        {med.music_mood.replace("-", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* No meditation yet */
        <div className="px-6 flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🧘</div>
          <h2 className="font-heading text-xl text-secondary mb-2">No meditation yet</h2>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Create your first personalized sleep meditation
          </p>
          <button
            onClick={() => navigate("/onboarding")}
            className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Create My Meditation
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream-light/90 backdrop-blur-lg border-t border-border px-6 py-3">
        <div className="flex justify-around max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Play size={20} />
            <span className="text-[10px] font-body font-medium">Now</span>
          </button>
          <button
            onClick={() => navigate("/onboarding")}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus size={20} />
            <span className="text-[10px] font-body">New</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <Library size={20} />
            <span className="text-[10px] font-body">Library</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <Settings size={20} />
            <span className="text-[10px] font-body">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
