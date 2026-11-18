import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Save,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { ApiError, apiFetch } from "../lib/api";
import { formatDate, formatDateTime, formatMoney, titleCase } from "../lib/format";
import type {
  ActivityType,
  Deal,
  DealActivity,
  DealTimeline,
  StageHistory,
} from "../types/crm";

interface DealDrawerProps {
  deal: Deal | null;
  onClose: () => void;
  onUpdated: (deal: Deal) => void;
}

const activityIcons = {
  note: MessageSquareText,
  call: Phone,
  email: Mail,
  meeting: Video,
  stage_change: Activity,
};

type TimelineItem =
  | { kind: "activity"; date: string; item: DealActivity }
  | { kind: "history"; date: string; item: StageHistory };

export function DealDrawer({ deal, onClose, onUpdated }: DealDrawerProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(deal?.value ?? "");
  const [probability, setProbability] = useState(deal ? String(deal.probability) : "");
  const [closeDate, setCloseDate] = useState(deal?.expected_close_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [activityType, setActivityType] = useState<ActivityType>("note");
  const [activitySummary, setActivitySummary] = useState("");

  const timeline = useQuery({
    queryKey: ["deal-timeline", deal?.id],
    queryFn: () => apiFetch<DealTimeline>(`/deals/${deal!.id}/timeline`),
    enabled: Boolean(deal),
  });

  const updateDeal = useMutation({
    mutationFn: () =>
      apiFetch<Deal>(`/deals/${deal!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          value: Number(value),
          probability: Number(probability),
          expected_close_date: closeDate ? new Date(`${closeDate}T12:00:00Z`).toISOString() : null,
          notes: notes || null,
        }),
      }),
    onSuccess: async (updated) => {
      onUpdated(updated);
      setEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] }),
      ]);
    },
  });

  const addActivity = useMutation({
    mutationFn: () =>
      apiFetch<DealActivity>(`/deals/${deal!.id}/activities`, {
        method: "POST",
        body: JSON.stringify({ activity_type: activityType, summary: activitySummary }),
      }),
    onSuccess: async () => {
      setActivitySummary("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deal-timeline", deal?.id] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
      ]);
    },
  });

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!timeline.data) return [];
    return [
      ...timeline.data.activities.map(
        (item): TimelineItem => ({ kind: "activity", date: item.occurred_at, item }),
      ),
      ...timeline.data.stage_history.map(
        (item): TimelineItem => ({ kind: "history", date: item.changed_at, item }),
      ),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [timeline.data]);

  if (!deal) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close deal details" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#f7f8fc] shadow-2xl">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: deal.stage_color }} />
                {deal.stage_name}
              </div>
              <h2 className="m-0 truncate text-2xl font-semibold tracking-tight text-slate-900">{deal.title}</h2>
              <p className="mb-0 mt-2 flex items-center gap-2 text-sm text-slate-500"><Building2 size={15} /> {deal.company_name}</p>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={22} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Deal value" value={formatMoney(deal.value, deal.currency)} />
            <Metric label="Probability" value={`${deal.probability}%`} />
            <Metric label="Expected close" value={formatDate(deal.expected_close_date)} />
            <Metric label="Last activity" value={formatDate(deal.last_activity_at, "No activity")} />
          </section>

          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-base font-semibold text-slate-900">Opportunity details</h3>
              <button onClick={() => setEditing((current) => !current)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{editing ? "Cancel" : "Edit deal"}</button>
            </div>
            {editing ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Value"><input type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
                <Field label="Probability"><input type="number" min="0" max="100" value={probability} onChange={(event) => setProbability(event.target.value)} /></Field>
                <Field label="Expected close"><input type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} /></Field>
                <Field label="Notes" wide><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <button disabled={updateDeal.isPending} onClick={() => updateDeal.mutate()} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} /> {updateDeal.isPending ? "Saving..." : "Save changes"}</button>
                  {updateDeal.isError && <p className="mb-0 mt-2 text-xs text-red-600">{updateDeal.error instanceof ApiError ? updateDeal.error.message : "Could not save the deal."}</p>}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <Detail icon={UserRound} label="Owner" value={deal.owner_name} />
                <Detail icon={UsersRound} label="Primary contact" value={deal.contact_name} />
                <Detail icon={CalendarDays} label="Entered stage" value={formatDate(deal.stage_entered_at)} />
                <Detail icon={Clock3} label="SLA status" value={deal.sla_breached ? "Attention required" : "On track"} warning={deal.sla_breached} />
                <div className="sm:col-span-2"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</div><p className="mb-0 mt-1 leading-relaxed text-slate-600">{deal.notes || "No notes have been added yet."}</p></div>
              </div>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><h3 className="m-0 text-base font-semibold text-slate-900">Activity timeline</h3><p className="mb-0 mt-1 text-xs text-slate-500">Calls, meetings, notes, emails, and stage changes.</p></div><Activity size={20} className="text-indigo-500" /></div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <select value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                {(["note", "call", "email", "meeting"] as ActivityType[]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
              </select>
              <input value={activitySummary} onChange={(event) => setActivitySummary(event.target.value)} placeholder="Add a concise activity update..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              <button disabled={!activitySummary.trim() || addActivity.isPending} onClick={() => addActivity.mutate()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
            </div>
            {addActivity.isError && <p className="mb-0 mt-2 text-xs text-red-600">{addActivity.error instanceof ApiError ? addActivity.error.message : "Could not add the activity."}</p>}
            <div className="mt-5 space-y-4">
              {timeline.isPending && <div className="flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={15} className="animate-spin" /> Loading timeline...</div>}
              {!timeline.isPending && !timelineItems.length && <p className="m-0 rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">No activity yet. Add the first client touchpoint above.</p>}
              {timelineItems.map((entry) => entry.kind === "activity" ? <ActivityRow key={`a-${entry.item.id}`} item={entry.item} /> : <HistoryRow key={`h-${entry.item.id}`} item={entry.item} />)}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1.5 truncate text-sm font-semibold text-slate-900">{value}</div></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactElement<{ className?: string }> }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span><span className="[&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-slate-200 [&>*]:px-3 [&>*]:py-2.5 [&>*]:text-sm">{children}</span></label>;
}

function Detail({ icon: Icon, label, value, warning = false }: { icon: typeof UserRound; label: string; value: string; warning?: boolean }) {
  return <div className="flex gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${warning ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}><Icon size={17} /></span><div><div className="text-xs font-medium text-slate-400">{label}</div><div className={`mt-0.5 font-medium ${warning ? "text-red-700" : "text-slate-700"}`}>{value}</div></div></div>;
}

function ActivityRow({ item }: { item: DealActivity }) {
  const Icon = activityIcons[item.activity_type];
  return <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={16} /></span><div className="min-w-0"><div className="text-sm font-semibold text-slate-800">{item.summary}</div><div className="mt-0.5 text-xs text-slate-400">{titleCase(item.activity_type)} · {item.actor_name} · {formatDateTime(item.occurred_at)}</div>{item.details && <p className="mb-0 mt-1 text-xs leading-relaxed text-slate-500">{item.details}</p>}</div></div>;
}

function HistoryRow({ item }: { item: StageHistory }) {
  return <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Check size={16} /></span><div><div className="text-sm font-semibold text-slate-800">Moved to {item.new_stage_name}</div><div className="mt-0.5 text-xs text-slate-400">{item.previous_stage_name ? `${item.previous_stage_name} → ` : ""}{item.new_stage_name} · {item.changed_by_name} · {formatDateTime(item.changed_at)}</div></div></div>;
}
