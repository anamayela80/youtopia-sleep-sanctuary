import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Pause, Download, Moon, Sun, Settings, Headphones, SkipForward, SkipBack } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSegmentedMixer } from "@/hooks/useSegmentedMixer";
import { useSeedsPlayer } from "@/hooks/useSeedsPlayer";
import { getLatestMeditation, getLatestSeeds, getActiveTheme } from "@/services/meditationService";
import logo from "@/assets/youtopia-logo.png";

const Home = () => {
  const [meditation, setMeditation] = useState<any>(null);
  const [seeds, setSeeds] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<"meditation" | "seeds" | null>(null);
  const navigate = useNavigate();

  const segmentUrls = meditation?.meditation_segments
    ?.sort((a: any, b: any) => a.segment_number - b.segment_number)
    ?.map((s: any) => s.audio_url) || [];

  const seedAudioUrls = seeds
    ? [seeds.audio_url_1, seeds.audio_url_2, seeds.audio_url_3, seeds.audio_url_4, seeds.audio_url_5].filter(Boolean)
    : [];

  const meditationMixer = useSegmentedMixer({
    segmentUrls,
    musicUrl: theme?.music_file_url || null,
  });

  const seedsPlayer = useSeedsPlayer({
    seedAudioUrls,
    musicUrl: theme?.music_file_url || null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    const [med, seedData, activeTheme] = await Promise.all([
      getLatestMeditation(user.id),
      getLatestSeeds(user.id),
      getActiveTheme(),
    ]);

    setMeditation(med);
    setSeeds(seedData);
    setTheme(activeTheme);
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

  const hasMeditation = meditation && segmentUrls.length > 0;
  const hasSeeds = seedAudioUrls.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <img src={logo} alt="YOUTOPIA" className="h-8" />
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/settings")} className="text-accent">
            <Settings size={20} />
          </button>
          <button onClick={handleSignOut} className="text-accent text-xs font-body">
            Sign out
          </button>
        </div>
      </div>

      {/* Beta banner */}
      <div className="mx-6 mb-6">
        <div className="bg-teal-light/40 rounded-xl px-4 py-2.5 text-center">
          <p className="text-xs font-body text-teal-dark">
            ✨ Welcome to the YOUTOPIA beta — full experience, completely free while we grow
          </p>
        </div>
      </div>

      {/* Theme display */}
      {theme && (
        <div className="mx-6 mb-6 text-center">
          <h2 className="font-heading text-xl text-secondary mb-1">{theme.theme}</h2>
          {theme.intention && (
            <p className="font-body text-sm text-muted-foreground italic">{theme.intention}</p>
          )}
        </div>
      )}

      {hasMeditation || hasSeeds ? (
        <div className="px-6 space-y-4">
          {/* Morning Meditation Card */}
          {hasMeditation && (
            <div className="bg-cream-light rounded-3xl p-6 border border-border">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-light via-primary/30 to-coral-light flex items-center justify-center">
                  <Sun size={24} className="text-foreground/70" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-lg text-secondary">Morning Meditation</h3>
                  <p className="font-body text-xs text-muted-foreground">{meditation.title}</p>
                </div>
              </div>

              {/* Progress */}
              {(meditationMixer.isPlaying || meditationMixer.isPaused || meditationMixer.hasStarted) && (
                <div className="mb-4">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${meditationMixer.progress}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs font-body text-muted-foreground">{formatTime(meditationMixer.currentTime)}</span>
                    <span className="text-xs font-body text-muted-foreground">{formatTime(meditationMixer.duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-6">
                {/* Skip back 30s */}
                <button
                  onClick={() => meditationMixer.skipBackward()}
                  disabled={!meditationMixer.hasStarted}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-accent transition-all active:scale-90 disabled:opacity-30"
                >
                  <div className="relative">
                    <SkipBack size={18} />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                  </div>
                </button>

                {/* Play / Pause */}
                <button
                  onClick={() => {
                    if (seedsPlayer.isPlaying) seedsPlayer.stop();
                    meditationMixer.togglePlay();
                    setActivePlayer(meditationMixer.isPlaying ? null : "meditation");
                  }}
                  disabled={meditationMixer.isLoading}
                  className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  {meditationMixer.isLoading ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  ) : meditationMixer.isPlaying ? (
                    <Pause size={22} />
                  ) : (
                    <Play size={22} className="ml-1" />
                  )}
                </button>

                {/* Skip forward 30s */}
                <button
                  onClick={() => meditationMixer.skipForward()}
                  disabled={!meditationMixer.hasStarted}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-accent transition-all active:scale-90 disabled:opacity-30"
                >
                  <div className="relative">
                    <SkipForward size={18} />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                  </div>
                </button>

                {meditation.audio_url && (
                  <a href={meditation.audio_url} download className="text-accent ml-2">
                    <Download size={18} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Seeds Card */}
          {hasSeeds && (
            <div className="bg-cream-light rounded-3xl p-6 border border-border">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-coral-light via-secondary/20 to-teal-light flex items-center justify-center">
                  <Moon size={24} className="text-foreground/70" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-lg text-secondary">Tonight's Seeds</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Headphones size={12} className="text-muted-foreground" />
                    <p className="font-body text-xs text-muted-foreground">Best with headphones and eyes closed</p>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {(seedsPlayer.isPlaying || seedsPlayer.isPaused || seedsPlayer.hasStarted) && (
                <div className="mb-4">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${seedsPlayer.progress}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs font-body text-muted-foreground">{formatTime(seedsPlayer.currentTime)}</span>
                    <span className="text-xs font-body text-muted-foreground">{formatTime(seedsPlayer.duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-6">
                {/* Skip back 30s */}
                <button
                  onClick={() => seedsPlayer.skipBackward()}
                  disabled={!seedsPlayer.hasStarted}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-accent transition-all active:scale-90 disabled:opacity-30"
                >
                  <div className="relative">
                    <SkipBack size={18} />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                  </div>
                </button>

                {/* Play / Pause */}
                <button
                  onClick={() => {
                    if (meditationMixer.isPlaying) meditationMixer.stop();
                    seedsPlayer.togglePlay();
                    setActivePlayer(seedsPlayer.isPlaying ? null : "seeds");
                  }}
                  disabled={seedsPlayer.isLoading}
                  className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  {seedsPlayer.isLoading ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-secondary-foreground border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  ) : seedsPlayer.isPlaying ? (
                    <Pause size={22} />
                  ) : (
                    <Play size={22} className="ml-1" />
                  )}
                </button>

                {/* Skip forward 30s */}
                <button
                  onClick={() => seedsPlayer.skipForward()}
                  disabled={!seedsPlayer.hasStarted}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-accent transition-all active:scale-90 disabled:opacity-30"
                >
                  <div className="relative">
                    <SkipForward size={18} />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                  </div>
                </button>
              </div>

              {/* Seed phrases display */}
              <div className="mt-4 space-y-2">
                {[seeds.phrase_1, seeds.phrase_2, seeds.phrase_3, seeds.phrase_4, seeds.phrase_5]
                  .filter(Boolean)
                  .map((phrase: string, i: number) => (
                    <p key={i} className="font-body text-xs text-muted-foreground italic text-center">
                      "{phrase}"
                    </p>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-6 flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">🧘</div>
          <h2 className="font-heading text-xl text-secondary mb-2">Your journey begins</h2>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Create your first personalized morning meditation and seeds
          </p>
          <button
            onClick={() => navigate("/onboarding")}
            className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Get Started
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream-light/90 backdrop-blur-lg border-t border-border px-6 py-3">
        <div className="flex justify-around max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Sun size={20} />
            <span className="text-[10px] font-body font-medium">Home</span>
          </button>
          <button
            onClick={() => navigate("/onboarding")}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-[10px] font-body">New</span>
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings size={20} />
            <span className="text-[10px] font-body">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
