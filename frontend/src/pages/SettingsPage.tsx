import { useQuery } from "@tanstack/react-query";
import { BellRing, Check, Database, KeyRound, RefreshCw, Save, Settings, ShieldCheck, Workflow } from "lucide-react";
import { useState } from "react";

import { apiFetch } from "../lib/api";
import type { PipelineStage } from "../types/crm";

const preferenceKey = "northstar-workspace-preferences";

function loadPreferences() {
  try {
    const stored = localStorage.getItem(preferenceKey);
    return stored ? JSON.parse(stored) as { slaAlerts: boolean; weeklyDigest: boolean; compactPipeline: boolean } : { slaAlerts: true, weeklyDigest: true, compactPipeline: false };
  } catch {
    return { slaAlerts: true, weeklyDigest: true, compactPipeline: false };
  }
}

export function SettingsPage() {
  const stages = useQuery({ queryKey: ["pipeline-stages"], queryFn: () => apiFetch<PipelineStage[]>("/pipeline-stages") });
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6"><p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Workspace control</p><h2 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-slate-900">Settings</h2><p className="mb-0 mt-2 text-sm text-slate-500">Review the governed pipeline and personalize your operations workspace.</p></div>

      <section className="grid gap-4 md:grid-cols-3">
        <SecurityCard icon={KeyRound} title="Session security" detail="Short-lived JWT access tokens with rotating, revocable refresh sessions." />
        <SecurityCard icon={ShieldCheck} title="Role-based access" detail="Admin, manager, and sales agent permissions enforced in the backend." />
        <SecurityCard icon={Database} title="Data integrity" detail="PostgreSQL constraints, migrations, and audit-ready stage history." />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Workflow size={20} /></span><div><h3 className="m-0 text-base font-semibold text-slate-900">Sales pipeline configuration</h3><p className="mb-0 mt-1 text-xs text-slate-500">Active stages, probability defaults, and SLA expectations.</p></div></div>{stages.isPending ? <div className="mt-8 flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" /> Loading stages...</div> : <div className="mt-6 space-y-3">{stages.data?.map((stage) => <div key={stage.id} className="grid items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[1fr_auto_auto]"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} /><div><div className="text-sm font-semibold text-slate-800">{stage.name}</div><div className="mt-0.5 text-[11px] text-slate-400">Stage {stage.display_order} · {stage.is_terminal ? "Terminal" : "Active opportunity"}</div></div></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">{stage.probability}% probability</span><span className="text-xs font-medium text-slate-500">{stage.sla_hours}h SLA</span></div>)}</div>}</div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><BellRing size={20} /></span><div><h3 className="m-0 text-base font-semibold text-slate-900">Workspace preferences</h3><p className="mb-0 mt-1 text-xs text-slate-500">Saved locally for this demo workspace.</p></div></div><div className="mt-6 space-y-3"><Preference label="SLA risk alerts" detail="Highlight opportunities that exceed stage expectations." checked={preferences.slaAlerts} onChange={(checked) => setPreferences({ ...preferences, slaAlerts: checked })} /><Preference label="Weekly revenue digest" detail="Prepare a concise team performance summary." checked={preferences.weeklyDigest} onChange={(checked) => setPreferences({ ...preferences, weeklyDigest: checked })} /><Preference label="Compact pipeline cards" detail="Reduce spacing for high-volume pipeline views." checked={preferences.compactPipeline} onChange={(checked) => setPreferences({ ...preferences, compactPipeline: checked })} /></div><button onClick={save} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${saved ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"}`}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "Preferences saved" : "Save preferences"}</button></div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-indigo-300"><Settings size={22} /></span><div><h3 className="m-0 text-base font-semibold">Production-ready configuration boundaries</h3><p className="mb-0 mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Secrets remain outside source control, database changes are migration-driven, and operational permissions are validated server-side. The demo preference controls intentionally stay local and do not alter governed pipeline rules.</p></div></div></section>
    </div>
  );
}

function SecurityCard({ icon: Icon, title, detail }: { icon: typeof KeyRound; title: string; detail: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon size={19} /></span><h3 className="mb-0 mt-4 text-sm font-semibold text-slate-900">{title}</h3><p className="mb-0 mt-1 text-xs leading-relaxed text-slate-500">{detail}</p><div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Check size={14} /> Enabled</div></article>;
}

function Preference({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-100 p-4 hover:bg-slate-50"><span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" /></label>;
}
