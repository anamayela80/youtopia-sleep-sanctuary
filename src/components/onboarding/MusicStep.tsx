import { motion } from "framer-motion";
import { Moon, Cloud, TreePine, Sun } from "lucide-react";

const musicOptions = [
  {
    id: "deep-sleep",
    name: "Deep Sleep",
    desc: "Slow, very soft ambient tones",
    icon: Moon,
    gradient: "from-primary/20 to-teal-light",
  },
  {
    id: "calm-mind",
    name: "Calm Mind",
    desc: "Gentle ambient soundscapes",
    icon: Cloud,
    gradient: "from-coral-light to-cream-light",
  },
  {
    id: "inner-peace",
    name: "Inner Peace",
    desc: "Soft nature sounds & gentle rain",
    icon: TreePine,
    gradient: "from-teal-light to-cream-light",
  },
  {
    id: "confidence",
    name: "Confidence",
    desc: "Warm, uplifting harmonic tones",
    icon: Sun,
    gradient: "from-coral-light/60 to-teal-light/40",
  },
];

interface MusicStepProps {
  selectedMusic: string | null;
  onSelect: (music: string) => void;
}

const MusicStep = ({ selectedMusic, onSelect }: MusicStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col"
    >
      <div className="text-4xl mb-4">🎵</div>
      <h2 className="font-heading text-2xl text-secondary mb-2">Pick your music mood</h2>
      <p className="font-body text-sm text-muted-foreground mb-6">
        This will play softly behind your meditation.
      </p>

      <div className="space-y-3">
        {musicOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                selectedMusic === option.id
                  ? "border-primary bg-teal-light/30"
                  : "border-border bg-cream-light hover:border-primary/40"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className="text-foreground/70" />
              </div>
              <div className="text-left flex-1">
                <p className="font-body font-semibold text-foreground">{option.name}</p>
                <p className="font-body text-xs text-muted-foreground">{option.desc}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); }}
                className="text-xs font-body text-primary font-medium flex-shrink-0"
              >
                ▶ Preview
              </button>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MusicStep;
