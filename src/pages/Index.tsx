import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";
import SplashScreen from "@/components/SplashScreen";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center text-center max-w-sm mx-auto"
      >
        <img src={logo} alt="YOUTOPIA" className="w-64 mb-8" />

        <div className="bg-teal-light/50 rounded-2xl px-4 py-2 mb-8">
          <p className="text-sm font-body text-teal-dark">
            ✨ Welcome to our free beta — full access while we're getting started
          </p>
        </div>

        <h1 className="font-heading text-3xl text-secondary mb-3">
          Creating Your<br />Everyday Utopia
        </h1>
        <p className="font-body text-accent mb-10 leading-relaxed">
          A personalized monthly inner transformation experience combining morning meditation and nightly seeds.
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate("/auth?mode=login")}
            className="w-full py-4 rounded-2xl bg-transparent border-2 border-primary text-primary font-body font-semibold text-base transition-all hover:bg-teal-light/30 active:scale-[0.98]"
          >
            I already have an account
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
