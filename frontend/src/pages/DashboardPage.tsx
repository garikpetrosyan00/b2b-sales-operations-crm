import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { apiFetch } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { DashboardSummary } from "../types/crm";

interface HealthResponse { status: "ok" }

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name.split(" ")[0] ?? "there";
  const health = useQuery({ queryKey: ["api-health"], queryFn: () => apiFetch<HealthResponse>("/health", {}, false), refetchInterval: 30_000 });
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"), refetchInterval: 60_000 });
  const healthLabel = health.isPending ? "Checking API" : health.isError ? "API unavailable" : "API operational";
  const healthClass = health.isPending ? "border-slate-200 bg-slate-50 text-slate-600" : health.isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const healthDot = health.isPending ? "bg-slate-400" : health.isError ? "bg-red-500" : "bg-emerald-500";
  const metrics = summary.data ? [
    { label: "Active pipeline", value: formatMoney(summary.data.active_pipeline_value), note: "Open opportunity value", icon: CircleDollarSign, style: "bg-indigo-50 text-indigo-600" },
    { label: "Weighted forecast", value: formatMoney(summary.data.weighted_pipeline_value), note: "Probability-adjusted", icon: TrendingUp, style: "bg-emerald-50 text-emerald-600" },
    { label: "Closing this month", value: formatMoney(summary.data.closing_this_month), note: `${summary.data.open_deal_count} open deals`, icon: CalendarClock, style: "bg-blue-50 text-blue-600" },
    { label: "Needs attention", value: String(summary.data.deals_requiring_attention), note: `${summary.data.overdue_follow_up_count} overdue follow-ups`, icon: AlertTriangle, style: "bg-amber-50 text-amber-600" },
  ] : [];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="m-0 text-sm font-medium text-indigo-600">Good to see you, {firstName}</p><h2 className="m-0 mt-1 text-3xl font-semibold tracking-tight text-slate-900">Revenue command center</h2><p className="mb-0 mt-2 text-sm text-slate-500">A live view of pipeline health and the work that needs attention.</p></div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${healthClass}`}><span className={`h-2 w-2 rounded-full ${healthDot}`} />{healthLabel}</div>
      </div>

      {summary.isPending ? <div className="grid h-40 place-items-center rounded-2xl border border-slate-200 bg-white"><RefreshCw className="animate-spin text-indigo-500" /></div> : summary.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Dashboard metrics are temporarily unavailable. <button onClick={() => summary.refetch()} className="ml-2 font-semibold underline">Try again</button></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, note, icon: Icon, style }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025]"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${style}`}><Icon size={18} /></span></div><div className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-400">{note}</div></div>)}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm"><div className="relative p-7"><div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" /><p className="relative m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Pipeline focus</p><h3 className="relative mb-0 mt-3 max-w-lg text-2xl font-semibold leading-tight">Turn qualified demand into predictable revenue.</h3><p className="relative mb-0 mt-3 max-w-xl text-sm leading-relaxed text-slate-400">Review opportunities by stage, move deals with drag and drop, and surface accounts that have exceeded their stage SLA.</p><Link to="/pipeline" className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-indigo-50">Open pipeline <ArrowUpRight size={17} /></Link></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Target size={19} /></span><div><h3 className="m-0 text-base font-semibold text-slate-800">Workspace readiness</h3><p className="m-0 mt-1 text-xs text-slate-400">Phase 2 operating capabilities</p></div></div><div className="mt-6 space-y-4">{["Lead qualification and conversion", "Kanban pipeline with SLA signals", "Live revenue forecasting", "Role-based record ownership"].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700"><CheckCircle2 size={17} className="text-emerald-500" />{item}</div>)}</div><Link to="/leads" className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Review leads <ArrowUpRight size={16} /></Link></div>
      </div>
    </div>
  );
}
