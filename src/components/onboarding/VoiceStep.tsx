import { motion } from "framer-motion";
import { Mic, User } from "lucide-react";

const presetVoices = [
  { id: "sofia", name: "Sofia", desc: "Warm and gentle", color: "bg-coral-light" },
  { id: "james", name: "James", desc: "Deep and calming", color: "bg-teal-light" },
  { id: "aria", name: "Aria", desc: "Soft and soothing", color: "bg-coral-light" },
  { id: "marco", name: "Marco", desc: "Smooth and grounding", color: "bg-teal-light" },
];

interface VoiceStepProps {
  selectedVoice: string | null;
  onSelect: (voice: string) => void;
}

const VoiceStep = ({ selectedVoice, onSelect }: VoiceStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col"
    >
      <div className="text-4xl mb-4">🎙️</div>
      <h2 className="font-heading text-2xl text-secondary mb-2">Choose your voice</h2>
      <p className="font-body text-sm text-muted-foreground mb-6">
        Your meditation will be narrated in this voice.
      </p>

      {/* Own voice option */}
      <button
        onClick={() => onSelect("own")}
        className={`w-full p-4 rounded-2xl border-2 transition-all mb-4 flex items-center gap-4 ${
          selectedVoice === "own"
            ? "border-primary bg-teal-light/30"
            : "border-border bg-cream-light hover:border-primary/40"
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Mic className="text-primary" size={22} />
        </div>
        <div className="text-left">
          <p className="font-body font-semibold text-foreground">Use my own voice</p>
          <p className="font-body text-xs text-muted-foreground">Record 2 minutes and we'll create your personal narrator</p>
        </div>
      </button>

      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-body text-muted-foreground">or choose a voice</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Preset voices */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {presetVoices.map((voice) => (
          <button
            key={voice.id}
            onClick={() => onSelect(voice.id)}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              selectedVoice === voice.id
                ? "border-primary bg-teal-light/30"
                : "border-border bg-cream-light hover:border-primary/40"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl ${voice.color} flex items-center justify-center mb-3`}>
              <User size={18} className="text-foreground/60" />
            </div>
            <p className="font-body font-semibold text-sm text-foreground">{voice.name}</p>
            <p className="font-body text-xs text-muted-foreground">{voice.desc}</p>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="mt-2 text-xs font-body text-primary font-medium"
            >
              ▶ Preview
            </button>
          </button>
        ))}
      </div>

      {selectedVoice === "own" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 p-4 rounded-2xl bg-teal-light/20 border border-primary/20"
        >
          <p className="font-body text-xs text-accent leading-relaxed">
            🔒 <strong>Privacy promise:</strong> Your voice is used only to create your meditation.
            It is never stored, sold, or shared. Once your meditation is ready, your recording is permanently deleted.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default VoiceStep;
