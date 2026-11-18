import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { apiFetch } from "../lib/api";
import { formatMoney, titleCase } from "../lib/format";
import type { ReportsSummary } from "../types/crm";

export function ReportsPage() {
  const report = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => apiFetch<ReportsSummary>("/reports/summary"),
  });

  if (report.isPending) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-indigo-500" /><p className="mt-3 text-sm text-slate-500">Calculating revenue insights...</p></div></div>;
  if (report.isError || !report.data) return <div className="grid min-h-[55vh] place-items-center text-center"><div><BarChart3 className="mx-auto text-slate-300" size={40} /><h2 className="mt-4 text-xl font-semibold text-slate-800">Reports unavailable</h2><button onClick={() => report.refetch()} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div></div>;

  const data = report.data;
  const maxStageValue = Math.max(...data.by_stage.map((stage) => Number(stage.total_value)), 1);
  const maxOwnerValue = Math.max(...data.by_owner.map((owner) => Number(owner.active_value)), 1);
  const maxLeads = Math.max(...data.by_source.map((source) => source.lead_count), 1);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6"><p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Forecast intelligence</p><h2 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-slate-900">Revenue reports</h2><p className="mb-0 mt-2 text-sm text-slate-500">A live view of pipeline health, conversion, ownership, and execution risk.</p></div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={CircleDollarSign} label="Open pipeline" value={formatMoney(data.total_pipeline)} tone="indigo" />
        <Kpi icon={TrendingUp} label="Weighted forecast" value={formatMoney(data.weighted_pipeline)} tone="blue" />
        <Kpi icon={Trophy} label="Won revenue" value={formatMoney(data.won_revenue)} tone="green" />
        <Kpi icon={Target} label="Win rate" value={`${data.win_rate}%`} tone="amber" />
        <Kpi icon={AlertTriangle} label="Overdue tasks" value={String(data.overdue_tasks)} tone="red" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between"><div><h3 className="m-0 text-base font-semibold text-slate-900">Pipeline by stage</h3><p className="mb-0 mt-1 text-xs text-slate-500">Total and weighted opportunity value across the sales funnel.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Avg. {formatMoney(data.average_deal_size)}</span></div>
          <div className="mt-6 space-y-5">
            {data.by_stage.map((stage) => (
              <div key={stage.stage_name}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2 font-medium text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />{stage.stage_name}<span className="text-xs font-normal text-slate-400">{stage.deal_count} deals</span></div><span className="font-semibold text-slate-900">{formatMoney(stage.total_value)}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, Number(stage.total_value) / maxStageValue * 100)}%`, backgroundColor: stage.color }} /></div>
                <div className="mt-1 text-right text-[10px] font-medium text-slate-400">Weighted {formatMoney(stage.weighted_value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <h3 className="m-0 text-base font-semibold">Lead source quality</h3><p className="mb-0 mt-1 text-xs text-slate-400">Lead volume and successful conversions by acquisition source.</p>
          <div className="mt-6 space-y-4">
            {data.by_source.map((source) => {
              const conversion = source.lead_count ? Math.round(source.converted_count / source.lead_count * 100) : 0;
              return <div key={source.source} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{titleCase(source.source)}</span><span className="text-xs text-slate-400">{conversion}% converted</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.max(8, source.lead_count / maxLeads * 100)}%` }} /></div><div className="mt-2 text-[11px] text-slate-400">{source.lead_count} leads · {source.converted_count} converted</div></div>;
            })}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div><h3 className="m-0 text-base font-semibold text-slate-900">Owner performance</h3><p className="mb-0 mt-1 text-xs text-slate-500">Active book of business and closed-won contribution.</p></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="pb-3 font-semibold">Owner</th><th className="pb-3 font-semibold">Active deals</th><th className="pb-3 font-semibold">Active value</th><th className="pb-3 font-semibold">Won deals</th><th className="pb-3 font-semibold">Won value</th><th className="pb-3 font-semibold">Portfolio share</th></tr></thead><tbody>{data.by_owner.map((owner) => <tr key={owner.owner_id} className="border-b border-slate-100 last:border-0"><td className="py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">{owner.owner_name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><span className="text-sm font-semibold text-slate-800">{owner.owner_name}</span></div></td><td className="py-4 text-sm text-slate-600">{owner.active_deals}</td><td className="py-4 text-sm font-semibold text-slate-800">{formatMoney(owner.active_value)}</td><td className="py-4 text-sm text-slate-600">{owner.won_deals}</td><td className="py-4 text-sm font-semibold text-emerald-700">{formatMoney(owner.won_value)}</td><td className="py-4"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(5, Number(owner.active_value) / maxOwnerValue * 100)}%` }} /></div></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Target; label: string; value: string; tone: "indigo" | "blue" | "green" | "amber" | "red" }) {
  const colors = { indigo: "bg-indigo-50 text-indigo-600", blue: "bg-sky-50 text-sky-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}><Icon size={18} /></span><div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{value}</div></div>;
}
