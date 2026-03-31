import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Pause, Download, Bell, Library, Settings, LogOut } from "lucide-react";
import logo from "@/assets/youtopia-logo.png";

const Home = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <img src={logo} alt="YOUTOPIA" className="h-8" />
        <button className="text-accent">
          <Settings size={20} />
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

      {/* Monthly theme */}
      <div className="px-6 mb-6">
        <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {currentMonth} Theme
        </p>
        <h2 className="font-heading text-xl text-secondary">Embracing Stillness</h2>
      </div>

      {/* Player card */}
      <div className="px-6 mb-8">
        <div className="bg-cream-light rounded-3xl p-6 border border-border">
          {/* Album art - spiral animation */}
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
            <h3 className="font-heading text-lg text-secondary mb-1">Your March Meditation</h3>
            <p className="font-body text-sm text-muted-foreground">15 min • Deep Sleep</p>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs font-body text-muted-foreground">0:00</span>
              <span className="text-xs font-body text-muted-foreground">15:00</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8">
            <button className="text-accent">
              <Download size={20} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all active:scale-95"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button className="text-accent">
              <Bell size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Library section */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg text-secondary">Your Library</h3>
          <button className="text-xs font-body text-primary font-medium">View all</button>
        </div>

        <div className="space-y-3">
          {["February", "January"].map((month) => (
            <div
              key={month}
              className="flex items-center gap-4 p-3 rounded-2xl bg-cream-light border border-border"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-light to-coral-light/40 flex items-center justify-center">
                <Play size={16} className="text-foreground/60 ml-0.5" />
              </div>
              <div className="flex-1">
                <p className="font-body font-medium text-sm text-foreground">{month} Meditation</p>
                <p className="font-body text-xs text-muted-foreground">15 min • Calm Mind</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream-light/90 backdrop-blur-lg border-t border-border px-6 py-3">
        <div className="flex justify-around max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Play size={20} />
            <span className="text-[10px] font-body font-medium">Now</span>
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
