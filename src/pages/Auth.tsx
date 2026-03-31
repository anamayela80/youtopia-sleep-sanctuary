import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import logo from "@/assets/youtopia-logo.png";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "signup";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Will connect to Supabase auth later
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-12 pb-8">
      <button onClick={() => navigate("/")} className="self-start mb-8 text-accent">
        <ArrowLeft size={24} />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center flex-1"
      >
        <img src={logo} alt="YOUTOPIA" className="w-40 mb-8" />

        <h2 className="font-heading text-2xl text-secondary mb-2">
          {mode === "signup" ? "Create Your Space" : "Welcome Back"}
        </h2>
        <p className="font-body text-muted-foreground mb-8 text-center">
          {mode === "signup"
            ? "Begin your journey to better sleep"
            : "Continue your meditation journey"}
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block font-body text-sm text-accent mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              placeholder="hello@example.com"
              required
            />
          </div>

          <div>
            <label className="block font-body text-sm text-accent mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all pr-12"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] mt-2"
          >
            {mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="font-body text-sm text-muted-foreground"
          >
            {mode === "signup" ? (
              <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
            ) : (
              <>New here? <span className="text-primary font-medium">Create account</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
