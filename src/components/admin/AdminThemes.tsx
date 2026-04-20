import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

type Theme = {
  id: string;
  month_key: string;
  month: string;
  theme: string;
  description: string | null;
  status: string;
  intro_orienting: string | null;
  intro_settling: string | null;
  intro_established: string | null;
  about: string | null;
  science: string | null;
  practice: string | null;
  questions: string[];
};

const parseQuestions = (q: any): string[] => {
  let arr: any = q;
  if (typeof q === "string") {
    try { arr = JSON.parse(q); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) arr = [];
  const out = arr.map((x: any) => (typeof x === "string" ? x : ""));
  while (out.length < 5) out.push("");
  return out.slice(0, 5);
};

const ORDER = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export const AdminThemes = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("monthly_themes")
      .select("id, month_key, month, theme, description, status, intro_orienting, intro_settling, intro_established, about, science, practice, questions")
      .not("month_key", "is", null);
    if (data) {
      const sorted = [...data].sort((a, b) => ORDER.indexOf(a.month_key!) - ORDER.indexOf(b.month_key!));
      setThemes(sorted.map((t) => ({ ...t, questions: parseQuestions((t as any).questions) })) as Theme[]);
    }
  };

  const update = (id: string, patch: Partial<Theme>) => {
    setThemes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const updateQuestion = (id: string, idx: number, value: string) => {
    setThemes((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const qs = [...t.questions];
        qs[idx] = value;
        return { ...t, questions: qs };
      })
    );
  };

  const save = async (t: Theme) => {
    setSavingId(t.id);
    const { error } = await supabase
      .from("monthly_themes")
      .update({
        theme: t.theme,
        description: t.description,
        status: t.status,
        intro_orienting: t.intro_orienting,
        intro_settling: t.intro_settling,
        intro_established: t.intro_established,
        about: t.about,
        science: t.science,
        practice: t.practice,
        questions: t.questions,
      })
      .eq("id", t.id);
    setSavingId(null);
    if (error) toast({ variant: "destructive", title: "Save failed", description: error.message });
    else toast({ title: `${t.month} saved ✨` });
  };

  const togglePublish = async (t: Theme, published: boolean) => {
    const status = published ? "published" : "draft";
    update(t.id, { status });
    const { error } = await supabase.from("monthly_themes").update({ status }).eq("id", t.id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
  };

  return (
    <div className="space-y-3">
      {themes.map((t) => (
        <div key={t.id} className="bg-cream-light rounded-2xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg text-secondary">{t.month}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-body ${t.status === "published" ? "text-primary" : "text-muted-foreground"}`}>
                {t.status === "published" ? "Published" : "Draft"}
              </span>
              <Switch
                checked={t.status === "published"}
                onCheckedChange={(v) => togglePublish(t, v)}
              />
            </div>
          </div>
          <input
            value={t.theme || ""}
            onChange={(e) => update(t.id, { theme: e.target.value })}
            placeholder="Theme title"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground"
          />
          <textarea
            value={t.description || ""}
            onChange={(e) => update(t.id, { description: e.target.value })}
            placeholder="Theme intro / tagline (passed to Claude as context)"
            className="w-full h-20 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
          />

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-[11px] uppercase tracking-wider font-body text-accent">This month's practice — by tenure</p>
            <textarea
              value={t.intro_orienting || ""}
              onChange={(e) => update(t.id, { intro_orienting: e.target.value })}
              placeholder="Months 1–2 (orienting): for someone new"
              className="w-full h-20 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
            <textarea
              value={t.intro_settling || ""}
              onChange={(e) => update(t.id, { intro_settling: e.target.value })}
              placeholder="Months 3–5 (settling): for someone finding their rhythm"
              className="w-full h-20 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
            <textarea
              value={t.intro_established || ""}
              onChange={(e) => update(t.id, { intro_established: e.target.value })}
              placeholder="Months 6+ (established): for someone deeply in the practice"
              className="w-full h-20 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-[11px] uppercase tracking-wider font-body text-accent">This Month's Practice page</p>
            <p className="text-[11px] font-body text-muted-foreground -mt-1">Shown in full on the dedicated practice page. Use {"{name}"} to insert the user's first name.</p>
            <textarea
              value={t.about || ""}
              onChange={(e) => update(t.id, { about: e.target.value })}
              placeholder="What this month is about"
              className="w-full h-28 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
            <textarea
              value={t.science || ""}
              onChange={(e) => update(t.id, { science: e.target.value })}
              placeholder="Why it works — the science"
              className="w-full h-28 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
            <textarea
              value={t.practice || ""}
              onChange={(e) => update(t.id, { practice: e.target.value })}
              placeholder="Your practice this month"
              className="w-full h-28 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-[11px] uppercase tracking-wider font-body text-accent">Onboarding questions (5)</p>
            <p className="text-[11px] font-body text-muted-foreground -mt-1">Shown to users during onboarding for this month. Use {"{name}"} to insert the user's first name.</p>
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs font-body text-muted-foreground pt-2 w-6 shrink-0">Q{i+1}</span>
                <textarea
                  value={t.questions[i] || ""}
                  onChange={(e) => updateQuestion(t.id, i, e.target.value)}
                  placeholder={`Question ${i+1}`}
                  className="w-full h-16 px-3 py-2 rounded-lg bg-background border border-border font-body text-sm text-foreground resize-none"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => save(t)}
            disabled={savingId === t.id}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {savingId === t.id ? "Saving..." : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
};
