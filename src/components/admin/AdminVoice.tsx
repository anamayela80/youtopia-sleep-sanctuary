import { useEffect, useRef, useState } from "react";
import { Save, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const AdminVoice = () => {
  const [voiceId, setVoiceId] = useState("zA6D7RyKdc2EClouEMkP");
  const [model, setModel] = useState("eleven_v3");
  const [stability, setStability] = useState(0.0);
  const [style, setStyle] = useState(0.0);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const preview = async () => {
    if (!voiceId.trim()) {
      toast({ variant: "destructive", title: "Voice ID required" });
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/preview-voice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ voiceId: voiceId.trim(), model, stability, style }),
      });
      if (!res.ok) {
        let msg = `Preview failed (${res.status})`;
        try { const j = await res.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      toast({ variant: "destructive", title: "Preview error", description: e instanceof Error ? e.message : "Unknown" });
    } finally {
      setPreviewing(false);
    }
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
        <p className="text-xs text-muted-foreground mt-1 font-body">
          Use <code>eleven_v3</code> for the most natural meditation voice.
        </p>
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-2">
          Stability: <span className="font-mono">{stability.toFixed(2)}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({stability < 0.34 ? "Creative" : stability < 0.67 ? "Natural" : "Robust"})
          </span>
        </label>
        <Slider value={[stability]} min={0} max={1} step={0.05} onValueChange={(v) => setStability(v[0])} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-body">
          <span>Creative</span><span>Natural</span><span>Robust</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-body">
          For Eleven v3 with a Professional Voice Clone, <strong>Creative (0.0)</strong> sounds most natural and human.
        </p>
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-2">
          Style: <span className="font-mono">{style.toFixed(2)}</span>
        </label>
        <Slider value={[style]} min={0} max={1} step={0.05} onValueChange={(v) => setStyle(v[0])} />
        <p className="text-xs text-muted-foreground mt-2 font-body">
          Keep near 0 for calm meditation. Higher values exaggerate vocal style.
        </p>
      </div>

      <button
        onClick={preview}
        disabled={previewing}
        className="w-full py-3 rounded-2xl border-2 border-primary text-primary font-body font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary/5"
      >
        {previewing ? <><Loader2 size={18} className="animate-spin" /> Generating preview…</> : <><Play size={18} /> Preview voice (short sample)</>}
      </button>

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
