import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronRight,
  Filter,
  Mail,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { forwardRef, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "../auth/useAuth";
import { ApiError, apiFetch } from "../lib/api";
import { formatDate, formatMoney, titleCase } from "../lib/format";
import type {
  Company,
  Contact,
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  Owner,
  Paginated,
} from "../types/crm";

const leadSchema = z.object({
  company_id: z.string().uuid("Choose a company"),
  primary_contact_id: z.string().uuid("Choose a contact"),
  owner_id: z.string().uuid("Choose an owner"),
  source: z.enum(["website", "referral", "outbound", "event", "partner", "other"]),
  status: z.enum(["new", "contacted", "qualified", "unqualified", "converted"]),
  estimated_value: z.coerce.number().min(0),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  next_follow_up_at: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

type LeadForm = z.input<typeof leadSchema>;

const statusClass: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 ring-blue-600/15",
  contacted: "bg-violet-50 text-violet-700 ring-violet-600/15",
  qualified: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  unqualified: "bg-slate-100 text-slate-600 ring-slate-500/15",
  converted: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
};

const priorityClass: Record<LeadPriority, string> = {
  low: "text-slate-500",
  medium: "text-blue-600",
  high: "text-amber-600",
  urgent: "text-red-600",
};

const SelectField = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }
>(function SelectField({ label, children, error, ...props }, ref) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        ref={ref}
        {...props}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

interface LeadModalProps {
  lead: Lead | null;
  companies: Company[];
  contacts: Contact[];
  owners: Owner[];
  currentOwnerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function LeadModal({
  lead,
  companies,
  contacts,
  owners,
  currentOwnerId,
  onClose,
  onSaved,
}: LeadModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeadForm>({
    defaultValues: lead
      ? {
          company_id: lead.company_id,
          primary_contact_id: lead.primary_contact_id,
          owner_id: lead.owner_id,
          source: lead.source,
          status: lead.status,
          estimated_value: Number(lead.estimated_value),
          priority: lead.priority,
          next_follow_up_at: lead.next_follow_up_at?.slice(0, 16) ?? "",
          notes: lead.notes ?? "",
        }
      : {
          company_id: companies[0]?.id ?? "",
          primary_contact_id: "",
          owner_id: currentOwnerId,
          source: "outbound",
          status: "new",
          estimated_value: 0,
          priority: "medium",
          next_follow_up_at: "",
          notes: "",
        },
  });
  const companyId = useWatch({ control, name: "company_id" });
  const availableContacts = contacts.filter((contact) => contact.company_id === companyId);

  const save = async (values: LeadForm) => {
    setSubmitError(null);
    const parsed = leadSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LeadForm;
        setError(field, { message: issue.message });
      });
      return;
    }
    try {
      await apiFetch<Lead>(lead ? `/leads/${lead.id}` : "/leads", {
        method: lead ? "PATCH" : "POST",
        body: JSON.stringify({
          ...parsed.data,
          next_follow_up_at: parsed.data.next_follow_up_at
            ? new Date(parsed.data.next_follow_up_at).toISOString()
            : null,
          notes: parsed.data.notes || null,
        }),
      });
      onSaved();
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Unable to save this lead.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Lead workspace
            </p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-slate-900">
              {lead ? "Edit lead" : "Create a new lead"}
            </h2>
          </div>
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit(save)} className="space-y-5 p-6">
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Company" error={errors.company_id?.message} {...register("company_id")}>
              <option value="">Choose company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </SelectField>
            <SelectField
              label="Primary contact"
              error={errors.primary_contact_id?.message}
              {...register("primary_contact_id")}
            >
              <option value="">Choose contact</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Owner" error={errors.owner_id?.message} {...register("owner_id")}>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.full_name}</option>
              ))}
            </SelectField>
            <SelectField label="Source" {...register("source")}>
              {(["website", "referral", "outbound", "event", "partner", "other"] as LeadSource[]).map((source) => (
                <option key={source} value={source}>{titleCase(source)}</option>
              ))}
            </SelectField>
            <SelectField label="Status" {...register("status")}>
              {(["new", "contacted", "qualified", "unqualified", "converted"] as LeadStatus[]).map((status) => (
                <option key={status} value={status}>{titleCase(status)}</option>
              ))}
            </SelectField>
            <SelectField label="Priority" {...register("priority")}>
              {(["low", "medium", "high", "urgent"] as LeadPriority[]).map((priority) => (
                <option key={priority} value={priority}>{titleCase(priority)}</option>
              ))}
            </SelectField>
            <label className="block text-sm font-medium text-slate-700">
              Estimated value
              <input
                type="number"
                min="0"
                step="100"
                {...register("estimated_value")}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Next follow-up
              <input
                type="datetime-local"
                {...register("next_follow_up_at")}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea
              rows={4}
              {...register("notes")}
              placeholder="Context, pain points, and next steps..."
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button disabled={isSubmitting} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? "Saving..." : lead ? "Save changes" : "Create lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [priority, setPriority] = useState("");
  const [owner, setOwner] = useState("");
  const [sort, setSort] = useState("created_at");
  const [page, setPage] = useState(1);
  const [modalLead, setModalLead] = useState<Lead | null | undefined>(undefined);
  const [selected, setSelected] = useState<Lead | null>(null);

  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), page_size: "10", sort });
    if (search.trim()) query.set("search", search.trim());
    if (status) query.set("lead_status", status);
    if (source) query.set("source", source);
    if (priority) query.set("priority", priority);
    if (owner) query.set("owner_id", owner);
    return query.toString();
  }, [page, priority, search, sort, source, status, owner]);

  const leads = useQuery({
    queryKey: ["leads", params],
    queryFn: () => apiFetch<Paginated<Lead>>(`/leads?${params}`),
  });
  const companies = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch<Company[]>("/companies") });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: () => apiFetch<Contact[]>("/contacts") });
  const owners = useQuery({ queryKey: ["owners"], queryFn: () => apiFetch<Owner[]>("/users") });

  const convert = useMutation({
    mutationFn: (lead: Lead) =>
      apiFetch(`/leads/${lead.id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          title: `${lead.company_name} sales opportunity`,
          value: lead.estimated_value,
          currency: "USD",
        }),
      }),
    onSuccess: async () => {
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  const finishSave = async () => {
    setModalLead(undefined);
    setSelected(null);
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const hasFilters = Boolean(search || status || source || priority || owner);
  const data = leads.data;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            <span className="h-px w-6 bg-indigo-400" /> Lead operations
          </div>
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-slate-900">Build a healthier pipeline</h2>
          <p className="mb-0 mt-2 text-sm text-slate-500">Qualify demand, protect follow-ups, and convert the right accounts.</p>
        </div>
        <button onClick={() => setModalLead(null)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700">
          <Plus size={18} /> New lead
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(5,minmax(135px,1fr))]">
          <label className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search company or email" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
          </label>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
            <option value="">All statuses</option>
            {(["new", "contacted", "qualified", "unqualified", "converted"] as LeadStatus[]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
            <option value="">All sources</option>
            {(["website", "referral", "outbound", "event", "partner", "other"] as LeadSource[]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          <select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
            <option value="">All priorities</option>
            {(["low", "medium", "high", "urgent"] as LeadPriority[]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          {user?.role !== "sales_agent" && (
            <select value={owner} onChange={(event) => { setOwner(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
              <option value="">All owners</option>
              {owners.data?.map((value) => <option key={value.id} value={value.id}>{value.full_name}</option>)}
            </select>
          )}
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
            <option value="created_at">Newest first</option>
            <option value="value">Highest value</option>
            <option value="follow_up">Follow-up date</option>
            <option value="company">Company A–Z</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {leads.isPending ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : leads.isError ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div><h3 className="m-0 text-lg font-semibold text-slate-800">Could not load leads</h3><p className="text-sm text-slate-500">Check the API connection and try again.</p><button onClick={() => leads.refetch()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>
          </div>
        ) : !data?.items.length ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div className="max-w-sm"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Filter size={22} /></div><h3 className="m-0 text-lg font-semibold text-slate-800">{hasFilters ? "No leads match these filters" : "Your lead workspace is ready"}</h3><p className="text-sm leading-6 text-slate-500">{hasFilters ? "Clear or adjust the filters to broaden the result." : "Create the first lead or run the demo-data command to populate a portfolio-ready workspace."}</p></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead><tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><th className="px-5 py-3.5">Account</th><th className="px-5 py-3.5">Contact</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Value</th><th className="px-5 py-3.5">Owner</th><th className="px-5 py-3.5">Follow-up</th><th className="px-5 py-3.5"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((lead) => {
                    const overdue = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date() && !["converted", "unqualified"].includes(lead.status);
                    return (
                      <tr key={lead.id} onClick={() => setSelected(lead)} className="cursor-pointer transition hover:bg-indigo-50/30">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><Building2 size={17} /></span><div><div className="text-sm font-semibold text-slate-800">{lead.company_name}</div><div className={`mt-1 text-[11px] font-semibold uppercase ${priorityClass[lead.priority]}`}>{lead.priority} priority</div></div></div></td>
                        <td className="px-5 py-4"><div className="text-sm font-medium text-slate-700">{lead.contact_name}</div><div className="mt-1 text-xs text-slate-400">{lead.contact_email}</div></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass[lead.status]}`}>{titleCase(lead.status)}</span><div className="mt-1.5 text-[11px] text-slate-400">via {titleCase(lead.source)}</div></td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-800">{formatMoney(lead.estimated_value)}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{lead.owner_name}</td>
                        <td className="px-5 py-4"><div className={`flex items-center gap-1.5 text-sm font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}><CalendarClock size={15} /> {formatDate(lead.next_follow_up_at)}</div>{overdue && <div className="mt-1 text-[11px] font-semibold uppercase text-red-500">Overdue</div>}</td>
                        <td className="px-5 py-4 text-slate-400"><ChevronRight size={18} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 text-xs text-slate-500">Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total} leads</p>
              <div className="flex gap-2"><button disabled={data.page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ArrowLeft size={16} /></button><span className="px-2 py-2 text-xs font-semibold text-slate-600">Page {data.page} of {data.pages || 1}</span><button disabled={data.page >= data.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ArrowRight size={16} /></button></div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="m-0 text-xs font-semibold uppercase tracking-widest text-indigo-600">Lead details</p><h2 className="m-0 mt-1 text-xl font-semibold text-slate-900">{selected.company_name}</h2></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
            <div className="space-y-6 p-6">
              <div className="rounded-2xl bg-slate-950 p-5 text-white"><div className="text-xs uppercase tracking-widest text-slate-400">Estimated value</div><div className="mt-2 text-3xl font-semibold">{formatMoney(selected.estimated_value)}</div><div className="mt-4 flex gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[selected.status]}`}>{titleCase(selected.status)}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{titleCase(selected.source)}</span></div></div>
              <div className="space-y-4 text-sm"><div className="flex gap-3"><UserRound className="mt-0.5 text-slate-400" size={18} /><div><div className="font-semibold text-slate-800">{selected.contact_name}</div><div className="text-slate-500">Primary contact</div></div></div><div className="flex gap-3"><Mail className="mt-0.5 text-slate-400" size={18} /><div><div className="font-semibold text-slate-800">{selected.contact_email}</div><div className="text-slate-500">Work email</div></div></div><div className="flex gap-3"><CalendarClock className="mt-0.5 text-slate-400" size={18} /><div><div className="font-semibold text-slate-800">{formatDate(selected.next_follow_up_at)}</div><div className="text-slate-500">Next follow-up</div></div></div></div>
              <div><h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Notes</h3><p className="text-sm leading-6 text-slate-600">{selected.notes || "No notes have been added yet."}</p></div>
              {convert.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Unable to convert this lead. It may already be converted.</div>}
              <div className="grid grid-cols-2 gap-3"><button onClick={() => setModalLead(selected)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Edit</button><button disabled={convert.isPending || selected.status === "converted" || selected.status === "unqualified"} onClick={() => { if (window.confirm(`Convert ${selected.company_name} into a pipeline deal?`)) convert.mutate(selected); }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">{convert.isPending ? "Converting..." : "Convert to deal"}</button></div>
            </div>
          </aside>
        </div>
      )}

      {modalLead !== undefined && user && companies.data && contacts.data && owners.data && (
        <LeadModal lead={modalLead} companies={companies.data} contacts={contacts.data} owners={owners.data} currentOwnerId={user.id} onClose={() => setModalLead(undefined)} onSaved={finishSave} />
      )}
    </div>
  );
}
