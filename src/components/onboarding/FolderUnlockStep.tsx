import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface FolderUnlockStepProps {
  userFirstName: string;
  themeName: string;
  artworkUrl?: string | null;
}

const FolderUnlockStep = ({ userFirstName, themeName, artworkUrl }: FolderUnlockStepProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between px-6 pt-12 pb-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col items-center justify-center max-w-md w-full"
      >
        <h1 className="font-heading text-3xl md:text-4xl text-secondary mb-2 leading-tight">
          Your {themeName} practice is ready,
        </h1>
        <h2 className="font-heading text-3xl md:text-4xl text-coral-dark mb-8">
          {userFirstName || "friend"}.
        </h2>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="w-64 h-64 rounded-3xl overflow-hidden mb-8 shadow-xl"
        >
          {artworkUrl ? (
            <img src={artworkUrl} alt={themeName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cream via-coral-light to-coral/40 flex items-center justify-center">
              <motion.div
                className="w-32 h-32 rounded-full bg-gradient-to-br from-cream-light/60 to-coral/30 blur-xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          )}
        </motion.div>

        <p className="font-body text-accent leading-relaxed max-w-sm">
          Inside you'll find your morning meditation and tonight's Seeds, both built from
          what you shared. Open it when you're ready.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        onClick={() => navigate("/home")}
        className="w-full max-w-md py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Open my {themeName} practice →
      </motion.button>
    </div>
  );
};

export default FolderUnlockStep;
