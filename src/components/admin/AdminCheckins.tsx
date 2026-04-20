import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AdminCheckins = () => {
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").maybeSingle();
      if (data) {
        setQ1(data.checkin_question_1);
        setQ2(data.checkin_question_2);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ checkin_question_1: q1, checkin_question_2: q2 })
      .eq("singleton", true);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Check-in questions saved ✨" });
  };

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        These two check-ins trigger dynamic regeneration of Seed 5 based on user responses.
      </p>
      <div>
        <label className="block font-body text-sm text-accent mb-1.5">Check-in 1</label>
        <input value={q1} onChange={(e) => setQ1(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" />
      </div>
      <div>
        <label className="block font-body text-sm text-accent mb-1.5">Check-in 2</label>
        <input value={q2} onChange={(e) => setQ2(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground" />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={18} /> {saving ? "Saving..." : "Save & Publish"}
      </button>
    </div>
  );
};
