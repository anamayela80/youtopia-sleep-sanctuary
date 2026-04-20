import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AdminOnboarding = () => {
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").maybeSingle();
      if (data) {
        setQ1(data.onboarding_question_1);
        setQ2(data.onboarding_question_2);
        setQ3(data.onboarding_question_3);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        onboarding_question_1: q1,
        onboarding_question_2: q2,
        onboarding_question_3: q3,
      })
      .eq("singleton", true);
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Onboarding questions saved ✨" });
  };

  const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block font-body text-sm text-accent mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-cream-light border border-border font-body text-foreground"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <Field label="Question 1" value={q1} onChange={setQ1} />
      <Field label="Question 2" value={q2} onChange={setQ2} />
      <Field label="Question 3" value={q3} onChange={setQ3} />
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
