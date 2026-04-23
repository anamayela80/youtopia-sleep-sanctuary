import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/youtopia-logo.png";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "signup";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Welcome to YOUTOPIA ✨" });
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/home");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#EDE3CF",
    border: "1px solid rgba(160, 120, 70, 0.18)",
    borderRadius: "12px",
    padding: "12px 16px",
    fontFamily: "var(--font-body)",
    color: "#3D2E1E",
    fontSize: "15px",
  };

  return (
    <div
      className="min-h-screen flex flex-col px-6 pt-12 pb-8"
      style={{ background: "#F2EAD8" }}
    >
      <button
        onClick={() => navigate("/")}
        className="self-start mb-6"
        style={{ color: "#8B6914" }}
      >
        <ArrowLeft size={24} />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center flex-1"
      >
        <div className="w-full flex justify-center mb-6" style={{ overflow: "visible" }}>
          <img
            src={logo}
            alt="YOUTOPIA"
            className="mix-blend-multiply"
            style={{
              maxWidth: "240px",
              width: "100%",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <h2
          className="font-heading mb-2 text-center"
          style={{ fontSize: "26px", color: "#B85C3A" }}
        >
          {mode === "signup" ? "Create your own Utopia" : "Welcome Back"}
        </h2>
        <p
          className="font-body text-center mb-8"
          style={{ color: "#9A7B5A", fontSize: "14px" }}
        >
          {mode === "signup"
            ? "Begin your inner transformation journey"
            : "Continue your journey"}
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {mode === "signup" && (
            <div>
              <label
                className="block font-body mb-1.5"
                style={{ fontSize: "13px", color: "#A08060" }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                style={inputStyle}
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div>
            <label
              className="block font-body mb-1.5"
              style={{ fontSize: "13px", color: "#A08060" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              style={inputStyle}
              placeholder="hello@example.com"
              required
            />
          </div>

          <div>
            <label
              className="block font-body mb-1.5"
              style={{ fontSize: "13px", color: "#A08060" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                style={{ ...inputStyle, paddingRight: "44px" }}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "#9A7B5A" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98] mt-2 disabled:opacity-50"
            style={{
              background: "#4A9A88",
              color: "#FFFFFF",
              borderRadius: "50px",
              padding: "14px",
              fontSize: "15px",
            }}
          >
            {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="font-body"
            style={{
              fontSize: "14px",
              color: "#9A7B5A",
              background: "transparent",
              padding: "4px 8px",
            }}
          >
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <span style={{ color: "#8B6914", fontWeight: 500 }}>Sign in</span>
              </>
            ) : (
              <>
                New here?{" "}
                <span style={{ color: "#8B6914", fontWeight: 500 }}>Create account</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
