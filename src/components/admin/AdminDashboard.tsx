import { useEffect, useState } from "react";
import { Users, Activity, Sparkles, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) => (
  <div className="bg-cream-light rounded-2xl p-4 border border-border">
    <Icon size={18} className="text-primary mb-2" />
    <p className="font-heading text-2xl text-secondary">{value}</p>
    <p className="font-body text-xs text-muted-foreground">{label}</p>
  </div>
);

export const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, active: 0, meditations: 0, seeds: 0 });

  useEffect(() => {
    (async () => {
      const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [u, m, s, am, as] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("meditations").select("id", { count: "exact", head: true }).eq("month", currentMonth),
        supabase.from("seeds").select("id", { count: "exact", head: true }).eq("month", currentMonth),
        supabase.from("meditations").select("user_id").gte("created_at", since),
        supabase.from("seeds").select("user_id").gte("created_at", since),
      ]);

      const activeIds = new Set<string>();
      (am.data || []).forEach((r: any) => activeIds.add(r.user_id));
      (as.data || []).forEach((r: any) => activeIds.add(r.user_id));

      setStats({
        users: u.count || 0,
        active: activeIds.size,
        meditations: m.count || 0,
        seeds: s.count || 0,
      });
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard icon={Users} label="Total users" value={stats.users} />
      <StatCard icon={Activity} label="Active users (30d)" value={stats.active} />
      <StatCard icon={Sparkles} label="Meditations this month" value={stats.meditations} />
      <StatCard icon={Sprout} label="Seeds this month" value={stats.seeds} />
    </div>
  );
};
