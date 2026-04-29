import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import VoiceCaptureStep from "@/components/onboarding/VoiceCaptureStep";

/**
 * Admin-only preview of the voice-capture step as a brand-new user would see it.
 * Does NOT touch the admin's real voice clone — purely visual.
 */
const PreviewVoiceCapture = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [hasPresetVoice, setHasPresetVoice] = useState(true);
  const [allowVoiceClone, setAllowVoiceClone] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => r.role === "admin") ?? false;
      setAllowed(isAdmin);

      // Mirror real config from the active theme so the preview matches reality.
      const { data: theme } = await supabase
        .from("monthly_themes")
        .select("guide_voice_id, allow_voice_clone")
        .eq("is_active", true)
        .maybeSingle();
      setHasPresetVoice(!!theme?.guide_voice_id);
      setAllowVoiceClone(theme?.allow_voice_clone ?? true);
    })();
  }, []);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="font-body text-sm text-muted-foreground text-center">
          Admin access required.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 pt-6 pb-8 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate("/admin")} className="text-accent">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="font-heading text-lg text-secondary">Preview · Voice capture</h1>
          <p className="font-body text-xs text-muted-foreground">
            What a brand-new user sees. Your own clone is not affected.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <VoiceCaptureStep
          hasExistingClone={false}
          hasPresetVoice={hasPresetVoice}
          allowVoiceClone={allowVoiceClone}
          onRecordingComplete={() => {
            /* preview only — no upload */
            alert("(Preview) Recording captured. In real onboarding this would clone your voice.");
          }}
          onUsePresetVoice={() => {
            alert("(Preview) Youtopia voice selected.");
          }}
        />
      </div>
    </div>
  );
};

export default PreviewVoiceCapture;
