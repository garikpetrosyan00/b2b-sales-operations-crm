import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, apiFetch } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { User } from "../types/auth";
import type {
  CrmTask,
  Deal,
  Lead,
  Paginated,
  TaskPage,
  TaskPriority,
  TaskStatus,
} from "../types/crm";

const emptyForm = {
  title: "",
  description: "",
  priority: "medium" as TaskPriority,
  due_at: "",
  assignee_id: "",
  related: "",
};

export function TasksPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("task_status", statusFilter);
  if (priorityFilter !== "all") params.set("priority", priorityFilter);
  const tasks = useQuery({
    queryKey: ["tasks", statusFilter, priorityFilter],
    queryFn: () => apiFetch<TaskPage>(`/tasks?${params.toString()}`),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<User[]>("/users") });
  const deals = useQuery({ queryKey: ["deals", "task-options"], queryFn: () => apiFetch<Paginated<Deal>>("/deals?page_size=100") });
  const leads = useQuery({ queryKey: ["leads", "task-options"], queryFn: () => apiFetch<Paginated<Lead>>("/leads?page_size=100") });

  const createTask = useMutation({
    mutationFn: () => {
      const [kind, id] = form.related.split(":");
      return apiFetch<CrmTask>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          due_at: new Date(form.due_at).toISOString(),
          assignee_id: form.assignee_id,
          related_deal_id: kind === "deal" ? id : null,
          related_lead_id: kind === "lead" ? id : null,
        }),
      });
    },
    onSuccess: async () => {
      setShowCreate(false);
      setForm(emptyForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] }),
      ]);
    },
  });
  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch<CrmTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] }),
      ]);
    },
  });

  const grouped = useMemo(() => {
    const items = tasks.data?.items ?? [];
    return {
      overdue: items.filter((task) => task.is_overdue),
      upcoming: items.filter((task) => !task.is_overdue && task.status !== "done"),
      completed: items.filter((task) => task.status === "done"),
    };
  }, [tasks.data]);

  const validForm = Boolean(form.title.trim() && form.due_at && form.assignee_id && form.related);

  if (tasks.isPending) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-indigo-500" /><p className="mt-3 text-sm text-slate-500">Loading your action plan...</p></div></div>;
  if (tasks.isError) return <div className="grid min-h-[55vh] place-items-center text-center"><div><ClipboardCheck className="mx-auto text-slate-300" size={38} /><h2 className="mt-4 text-xl font-semibold text-slate-800">Tasks unavailable</h2><button onClick={() => tasks.refetch()} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div></div>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Execution workspace</p><h2 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-slate-900">Sales tasks</h2><p className="mb-0 mt-2 text-sm text-slate-500">Keep every follow-up connected to a lead or opportunity.</p></div>
        <button onClick={() => { setForm({ ...emptyForm, assignee_id: users.data?.[0]?.id ?? "" }); setShowCreate(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus size={17} /> New task</button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary icon={Circle} label="Open tasks" value={(tasks.data?.todo_count ?? 0).toString()} tone="indigo" />
        <Summary icon={AlertTriangle} label="Overdue" value={(tasks.data?.overdue_count ?? 0).toString()} tone="red" />
        <Summary icon={CheckCircle2} label="Completed" value={(tasks.data?.completed_count ?? 0).toString()} tone="green" />
      </section>

      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TaskStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="all">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Completed</option></select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "all" | TaskPriority)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <TaskGroup title="Overdue" subtitle="Requires attention" tone="red" tasks={grouped.overdue} onStatus={(id, status) => updateTask.mutate({ id, status })} />
        <TaskGroup title="Upcoming" subtitle="Planned follow-ups" tone="indigo" tasks={grouped.upcoming} onStatus={(id, status) => updateTask.mutate({ id, status })} />
        <TaskGroup title="Completed" subtitle="Closed actions" tone="green" tasks={grouped.completed} onStatus={(id, status) => updateTask.mutate({ id, status })} />
      </div>

      {showCreate && <div className="fixed inset-0 z-50 grid place-items-center p-4"><button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} aria-label="Close create task" /><form onSubmit={(event) => { event.preventDefault(); if (validForm) createTask.mutate(); }} className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="m-0 text-xs font-semibold uppercase tracking-wider text-indigo-600">Connected action</p><h3 className="m-0 mt-1 text-xl font-semibold text-slate-900">Create sales task</h3></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Input label="Task title" wide><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Prepare proposal follow-up" /></Input>
        <Input label="Due date"><input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></Input>
        <Input label="Priority"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Input>
        <Input label="Assignee"><select value={form.assignee_id} onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}><option value="">Select owner</option>{users.data?.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></Input>
        <Input label="Related record" wide><select value={form.related} onChange={(event) => setForm({ ...form, related: event.target.value })}><option value="">Select a lead or opportunity</option><optgroup label="Opportunities">{deals.data?.items.map((deal) => <option key={deal.id} value={`deal:${deal.id}`}>{deal.title}</option>)}</optgroup><optgroup label="Leads">{leads.data?.items.map((lead) => <option key={lead.id} value={`lead:${lead.id}`}>{lead.company_name} · {lead.contact_name}</option>)}</optgroup></select></Input>
        <Input label="Description" wide><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add context and the desired outcome..." /></Input>
        </div>{createTask.isError && <p className="mb-0 mt-3 text-sm text-red-600">{createTask.error instanceof ApiError ? createTask.error.message : "Could not create the task."}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={!validForm || createTask.isPending} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{createTask.isPending ? "Creating..." : "Create task"}</button></div></form></div>}
    </div>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Circle; label: string; value: string; tone: "indigo" | "red" | "green" }) {
  const colors = { indigo: "bg-indigo-50 text-indigo-600", red: "bg-red-50 text-red-600", green: "bg-emerald-50 text-emerald-600" };
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon size={19} /></span><div><div className="text-xs font-medium text-slate-400">{label}</div><div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div></div></div>;
}

function TaskGroup({ title, subtitle, tone, tasks, onStatus }: { title: string; subtitle: string; tone: "red" | "indigo" | "green"; tasks: CrmTask[]; onStatus: (id: string, status: TaskStatus) => void }) {
  const colors = { red: "bg-red-500", indigo: "bg-indigo-500", green: "bg-emerald-500" };
  return <section className="rounded-3xl border border-slate-200 bg-slate-100/70 p-3"><div className="flex items-center justify-between px-2 pb-3 pt-1"><div><h3 className="m-0 text-sm font-semibold text-slate-800">{title}</h3><p className="mb-0 mt-0.5 text-[11px] text-slate-400">{subtitle}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${colors[tone]}`}>{tasks.length}</span></div><div className="space-y-3">{tasks.map((task) => <TaskCard key={task.id} task={task} onStatus={onStatus} />)}{!tasks.length && <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 text-center text-xs leading-relaxed text-slate-400">No tasks in this section.</div>}</div></section>;
}

function TaskCard({ task, onStatus }: { task: CrmTask; onStatus: (id: string, status: TaskStatus) => void }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${task.priority === "high" ? "bg-red-50 text-red-600" : task.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{task.priority}</span><h4 className="mb-0 mt-2 text-sm font-semibold leading-snug text-slate-900">{task.title}</h4></div><button onClick={() => onStatus(task.id, task.status === "done" ? "todo" : "done")} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${task.status === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-300 hover:border-emerald-300 hover:text-emerald-500"}`} aria-label={task.status === "done" ? "Reopen task" : "Complete task"}>{task.status === "done" ? <Check size={16} /> : <Circle size={15} />}</button></div>{task.description && <p className="mb-0 mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>}<div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><div className={`flex items-center gap-2 ${task.is_overdue ? "font-medium text-red-600" : ""}`}><CalendarClock size={14} /> {formatDateTime(task.due_at)}</div><div className="flex items-center gap-2"><UserRound size={14} /> {task.assignee_name}</div><div className="flex items-center gap-2"><Clock3 size={14} /> {task.related_record_name}</div></div>{task.status !== "done" && <button onClick={() => onStatus(task.id, task.status === "todo" ? "in_progress" : "todo")} className="mt-3 w-full rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">{task.status === "todo" ? "Start task" : "Move back to to-do"}</button>}</article>;
}

function Input({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span><span className="[&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-slate-200 [&>*]:bg-white [&>*]:px-3 [&>*]:py-2.5 [&>*]:text-sm">{children}</span></label>;
}
