import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ThemeRow = {
  id: string;
  month_key: string;
  month: string;
  morning_music_url: string | null;
  evening_music_url: string | null;
};

const ORDER = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

const MusicSlot = ({
  label, monthKey, slot, url, onChange,
}: {
  label: string;
  monthKey: string;
  slot: "morning" | "evening";
  url: string | null;
  onChange: (url: string | null) => void;
}) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `theme-music/${monthKey}_${slot}.mp3`;
      const { error } = await supabase.storage.from("meditations").upload(path, file, {
        contentType: "audio/mpeg",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("meditations").getPublicUrl(path);
      const finalUrl = `${data.publicUrl}?t=${Date.now()}`;
      onChange(finalUrl);
      toast({ title: `${label} uploaded ✨` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const path = `theme-music/${monthKey}_${slot}.mp3`;
      await supabase.storage.from("meditations").remove([path]);
      onChange(null);
      toast({ title: "Removed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = () => {
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const filename = url ? `${monthKey}_${slot}.mp3` : "No file";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-body text-xs text-muted-foreground mb-1">{label}</p>
        <p className="font-mono text-xs text-foreground truncate">{filename}</p>
      </div>
      {url && (
        <button onClick={togglePlay} className="p-2 rounded-lg bg-primary/10 text-primary">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}
      <label className="p-2 rounded-lg bg-primary/10 text-primary cursor-pointer">
        <Upload size={14} />
        <input
          type="file"
          accept="audio/mpeg,audio/mp3"
          className="hidden"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      {url && (
        <button onClick={remove} disabled={busy} className="p-2 rounded-lg bg-destructive/10 text-destructive">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

export const AdminMusic = () => {
  const [themes, setThemes] = useState<ThemeRow[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("monthly_themes")
      .select("id, month_key, month, morning_music_url, evening_music_url")
      .not("month_key", "is", null);
    if (data) {
      const sorted = [...data].sort((a, b) => ORDER.indexOf(a.month_key!) - ORDER.indexOf(b.month_key!));
      setThemes(sorted as ThemeRow[]);
    }
  };

  const updateSlot = async (id: string, field: "morning_music_url" | "evening_music_url", url: string | null) => {
    setThemes((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: url } : t)));
    const patch = field === "morning_music_url" ? { morning_music_url: url } : { evening_music_url: url };
    await supabase.from("monthly_themes").update(patch).eq("id", id);
  };

  return (
    <div className="space-y-3">
      {themes.map((t) => (
        <div key={t.id} className="bg-cream-light rounded-2xl p-4 border border-border space-y-3">
          <h3 className="font-heading text-lg text-secondary">{t.month}</h3>
          <MusicSlot
            label="Morning music"
            monthKey={t.month_key}
            slot="morning"
            url={t.morning_music_url}
            onChange={(url) => updateSlot(t.id, "morning_music_url", url)}
          />
          <MusicSlot
            label="Evening music"
            monthKey={t.month_key}
            slot="evening"
            url={t.evening_music_url}
            onChange={(url) => updateSlot(t.id, "evening_music_url", url)}
          />
        </div>
      ))}
    </div>
  );
};
