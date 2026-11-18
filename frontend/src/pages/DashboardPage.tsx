import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { useAuth } from "../auth/useAuth";
import { apiFetch } from "../lib/api";

interface HealthResponse {
  status: "ok";
}

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name.split(" ")[0] ?? "there";
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: () => apiFetch<HealthResponse>("/health", {}, false),
    refetchInterval: 30_000,
  });
  const healthLabel = health.isPending
    ? "Checking API"
    : health.isError
      ? "API unavailable"
      : "API operational";
  const healthClass = health.isPending
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : health.isError
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const healthDotClass = health.isPending
    ? "bg-slate-400"
    : health.isError
      ? "bg-red-500"
      : "bg-emerald-500";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="m-0 text-sm font-medium text-indigo-600">Good to see you, {firstName}</p>
          <h2 className="mb-0 mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Your sales workspace is ready
          </h2>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            The secure foundation is in place. Operational modules will be enabled in the next
            phase.
          </p>
        </div>
        <span
          aria-live="polite"
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${healthClass}`}
        >
          <span className={`h-2 w-2 rounded-full ${healthDotClass}`} /> {healthLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Secure access", text: "JWT sessions with refresh rotation", iconClass: "bg-indigo-50 text-indigo-600" },
          { icon: CheckCircle2, title: "Role configured", text: user ? user.role.replace("_", " ") : "—", iconClass: "bg-emerald-50 text-emerald-600" },
          { icon: Clock3, title: "Next milestone", text: "Lead routing and pipeline SLA", iconClass: "bg-amber-50 text-amber-600" },
        ].map(({ icon: Icon, title, text, iconClass }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025]">
            <div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl ${iconClass}`}>
              <Icon size={20} />
            </div>
            <div className="text-sm font-medium text-slate-500">{title}</div>
            <div className="mt-1 text-base font-semibold capitalize text-slate-800">{text}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="m-0 text-base font-semibold text-slate-800">Workspace readiness</h3>
            <p className="mb-0 mt-1 text-xs text-slate-500">Phase 1 technical capabilities</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Foundation</span>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ["Identity and session management", "Ready"],
            ["Role-based navigation and API guards", "Ready"],
            ["Responsive CRM workspace", "Ready"],
            ["Lead and pipeline operations", "Next phase"],
          ].map(([capability, status]) => (
            <div key={capability} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-slate-700">{capability}</span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${status === "Ready" ? "text-emerald-600" : "text-slate-400"}`}>
                {status}
                {status === "Ready" ? <CheckCircle2 size={15} /> : <ArrowUpRight size={15} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
