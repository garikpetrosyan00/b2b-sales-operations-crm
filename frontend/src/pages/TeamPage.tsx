import { useQuery } from "@tanstack/react-query";
import { Activity, CircleDollarSign, RefreshCw, ShieldCheck, Target, Users } from "lucide-react";

import { apiFetch } from "../lib/api";
import { formatMoney, titleCase } from "../lib/format";
import type { User } from "../types/auth";
import type { ReportsSummary } from "../types/crm";

export function TeamPage() {
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<User[]>("/users") });
  const reports = useQuery({ queryKey: ["reports-summary"], queryFn: () => apiFetch<ReportsSummary>("/reports/summary") });

  if (users.isPending || reports.isPending) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-indigo-500" /><p className="mt-3 text-sm text-slate-500">Loading team workspace...</p></div></div>;
  if (!users.data || !reports.data) return <div className="grid min-h-[55vh] place-items-center text-center"><div><Users className="mx-auto text-slate-300" size={40} /><h2 className="mt-4 text-xl font-semibold text-slate-800">Team data unavailable</h2></div></div>;

  const activeUsers = users.data.filter((user) => user.is_active);
  const ownerStats = new Map(reports.data.by_owner.map((owner) => [owner.owner_id, owner]));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6"><p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Revenue organization</p><h2 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-slate-900">Sales team</h2><p className="mb-0 mt-2 text-sm text-slate-500">Role-aware visibility into ownership, workload, and performance.</p></div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Active teammates" value={String(activeUsers.length)} />
        <Stat icon={Target} label="Active opportunities" value={String(reports.data.by_owner.reduce((sum, owner) => sum + owner.active_deals, 0))} />
        <Stat icon={CircleDollarSign} label="Team pipeline" value={formatMoney(reports.data.total_pipeline)} />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeUsers.map((user) => {
          const stats = ownerStats.get(user.id);
          const initials = user.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("");
          return <article key={user.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-100 to-sky-100 text-sm font-bold text-indigo-700">{initials}</span><div><h3 className="m-0 text-base font-semibold text-slate-900">{user.full_name}</h3><p className="mb-0 mt-1 text-xs text-slate-400">{user.email}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${user.role === "admin" ? "bg-violet-50 text-violet-700" : user.role === "manager" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{titleCase(user.role)}</span></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4"><Mini label="Open deals" value={String(stats?.active_deals ?? 0)} /><Mini label="Pipeline" value={formatMoney(stats?.active_value ?? 0)} /><Mini label="Won" value={formatMoney(stats?.won_value ?? 0)} /></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><Activity size={14} /> Active workspace member</div></article>;
        })}
      </section>

      <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm"><ShieldCheck size={22} /></span><div><h3 className="m-0 text-base font-semibold text-slate-900">Role-based data protection</h3><p className="mb-0 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Administrators and managers can see the full revenue workspace. Sales agents are automatically restricted to records they own.</p></div></div><span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">Enforced by API</span></section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={19} /></span><div><div className="text-xs text-slate-400">{label}</div><div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div></div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><div className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</div></div>;
}
