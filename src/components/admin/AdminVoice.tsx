import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

export const AdminVoice = () => {
  const [voiceId, setVoiceId] = useState("zA6D7RyKdc2EClouEMkP");
  const [model, setModel] = useState("eleven_multilingual_v3");
  const [stability, setStability] = useState(0.5);
  const [style, setStyle] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").maybeSingle();
      if (data) {
        setVoiceId(data.default_voice_id);
        setModel(data.default_voice_model);
        setStability(Number(data.default_voice_stability));
        setStyle(Number(data.default_voice_style));
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        default_voice_id: voiceId,
        default_voice_model: model,
        default_voice_stability: stability,
        default_voice_style: style,
      })
      .eq("singleton", true);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Voice settings saved ✨" });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block font-body text-sm text-accent mb-1.5">Default ElevenLabs Voice ID</label>
        <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-mono text-xs text-foreground" />
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-1.5">Model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-mono text-xs text-foreground" />
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-2">
          Stability: <span className="font-mono">{stability.toFixed(2)}</span>
        </label>
        <Slider value={[stability]} min={0} max={1} step={0.05} onValueChange={(v) => setStability(v[0])} />
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-2">
          Style: <span className="font-mono">{style.toFixed(2)}</span>
        </label>
        <Slider value={[style]} min={0} max={1} step={0.05} onValueChange={(v) => setStyle(v[0])} />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={18} /> {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};
