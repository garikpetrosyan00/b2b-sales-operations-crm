import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Eye,
  GripVertical,
  RefreshCw,
  Target,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { DealDrawer } from "../components/DealDrawer";
import { ApiError, apiFetch } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import type { Deal, PipelineBoard, PipelineColumn } from "../types/crm";

function DealCard({ deal, columns, onMove, onOpen }: { deal: Deal; columns: PipelineColumn[]; onMove: (dealId: string, stageId: string) => void; onOpen: (deal: Deal) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stageId: deal.stage_id },
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${isDragging ? "z-50 rotate-1 border-indigo-300 opacity-80 shadow-xl" : "border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Building2 size={13} /> <span className="truncate">{deal.company_name}</span></div>
          <h3 className="mb-0 mt-2 text-sm font-semibold leading-snug text-slate-900">{deal.title}</h3>
        </div>
        <button {...listeners} {...attributes} className="cursor-grab rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing" aria-label={`Move ${deal.title}`}><GripVertical size={17} /></button>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div><div className="text-lg font-semibold tracking-tight text-slate-900">{formatMoney(deal.value, deal.currency)}</div><div className="mt-1 text-[11px] font-medium text-slate-400">{deal.probability}% probability</div></div>
        {deal.sla_breached && <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600"><AlertTriangle size={11} /> SLA risk</span>}
      </div>
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-2"><UserRound size={14} className="text-slate-400" /> {deal.owner_name}</div>
        <div className="flex items-center gap-2"><CalendarDays size={14} className="text-slate-400" /> Close {formatDate(deal.expected_close_date)}</div>
      </div>
      <button onClick={() => onOpen(deal)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><Eye size={14} /> View details</button>
      <label className="mt-3 block md:hidden">
        <span className="sr-only">Move deal to stage</span>
        <select value={deal.stage_id} onChange={(event) => onMove(deal.id, event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600">
          {columns.map((column) => <option key={column.stage.id} value={column.stage.id}>{column.stage.name}</option>)}
        </select>
      </label>
    </article>
  );
}

function StageColumn({ column, columns, onMove, onOpen }: { column: PipelineColumn; columns: PipelineColumn[]; onMove: (dealId: string, stageId: string) => void; onOpen: (deal: Deal) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  return (
    <section ref={setNodeRef} className={`flex w-[315px] shrink-0 flex-col rounded-3xl border p-3 transition ${isOver ? "border-indigo-300 bg-indigo-50/70 ring-4 ring-indigo-100" : "border-slate-200/80 bg-slate-100/65"}`}>
      <div className="px-2 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.stage.color }} /><h2 className="m-0 text-sm font-semibold text-slate-800">{column.stage.name}</h2><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm">{column.deals.length}</span></div><span className="text-xs font-semibold text-slate-500">{column.stage.probability}%</span></div>
        <div className="mt-2 text-xs font-medium text-slate-500">{formatMoney(column.total_value)} pipeline</div>
      </div>
      <div className="flex min-h-28 flex-1 flex-col gap-3">
        {column.deals.map((deal) => <DealCard key={deal.id} deal={deal} columns={columns} onMove={onMove} onOpen={onOpen} />)}
        {!column.deals.length && <div className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-5 text-center text-xs leading-relaxed text-slate-400">Drop an opportunity here</div>}
      </div>
    </section>
  );
}

export function PipelinePage() {
  const queryClient = useQueryClient();
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor),
  );
  const pipeline = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => apiFetch<PipelineBoard>("/pipeline"),
  });
  const transition = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      apiFetch<Deal>(`/deals/${dealId}/transition`, {
        method: "POST",
        body: JSON.stringify({ stage_id: stageId }),
      }),
    onMutate: async ({ dealId, stageId }) => {
      setTransitionError(null);
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const previous = queryClient.getQueryData<PipelineBoard>(["pipeline"]);
      queryClient.setQueryData<PipelineBoard>(["pipeline"], (current) => {
        if (!current) return current;
        let moving: Deal | undefined;
        const withoutDeal = current.columns.map((column) => {
          const found = column.deals.find((deal) => deal.id === dealId);
          if (found) moving = found;
          const deals = column.deals.filter((deal) => deal.id !== dealId);
          return { ...column, deals, total_value: String(deals.reduce((sum, deal) => sum + Number(deal.value), 0)) };
        });
        if (!moving) return current;
        return {
          ...current,
          columns: withoutDeal.map((column) => {
            if (column.stage.id !== stageId) return column;
            const moved: Deal = { ...moving!, stage_id: stageId, stage_name: column.stage.name, stage_color: column.stage.color, probability: column.stage.probability, stage_entered_at: new Date().toISOString(), sla_breached: false };
            const deals = [...column.deals, moved];
            return { ...column, deals, total_value: String(deals.reduce((sum, deal) => sum + Number(deal.value), 0)) };
          }),
        };
      });
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["pipeline"], context.previous);
      setTransitionError(error instanceof ApiError ? error.message : "The deal could not be moved. The board has been restored.");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  const move = (dealId: string, stageId: string) => {
    const current = pipeline.data?.columns.flatMap((column) => column.deals).find((deal) => deal.id === dealId);
    if (current && current.stage_id !== stageId) transition.mutate({ dealId, stageId });
  };

  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (over) move(String(active.id), String(over.id));
  };

  const columns = pipeline.data?.columns ?? [];
  const openColumns = columns.filter((column) => !column.stage.is_terminal);
  const total = openColumns.reduce((sum, column) => sum + Number(column.total_value), 0);
  const atRisk = columns.flatMap((column) => column.deals).filter((deal) => deal.sla_breached).length;
  const opportunities = openColumns.reduce((sum, column) => sum + column.deals.length, 0);

  if (pipeline.isPending) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-indigo-500" /><p className="mt-3 text-sm text-slate-500">Building your pipeline...</p></div></div>;
  if (pipeline.isError) return <div className="grid min-h-[55vh] place-items-center text-center"><div><Target className="mx-auto text-slate-300" size={34} /><h2 className="mt-4 text-xl font-semibold text-slate-800">Pipeline unavailable</h2><p className="text-sm text-slate-500">We could not load the board from the CRM API.</p><button onClick={() => pipeline.refetch()} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div></div>;

  return (
    <div className="mx-auto max-w-[1800px]">
      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div><p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Revenue operations</p><h2 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-slate-900">Sales pipeline</h2><p className="mb-0 mt-2 text-sm text-slate-500">Move opportunities forward, surface SLA risk, and protect forecast quality.</p></div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Open pipeline</div><div className="mt-1 text-base font-semibold text-slate-900">{formatMoney(total)}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Opportunities</div><div className="mt-1 text-base font-semibold text-slate-900">{opportunities}</div></div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">SLA risk</div><div className="mt-1 text-base font-semibold text-red-700">{atRisk}</div></div>
        </div>
      </div>
      {transitionError && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={17} /> {transitionError}</div>}
      {!columns.length ? (
        <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white text-center"><div><CircleDollarSign className="mx-auto text-slate-300" size={40} /><h3 className="mt-4 text-lg font-semibold text-slate-800">No pipeline stages yet</h3><p className="max-w-sm text-sm text-slate-500">Run the idempotent demo-data command to create a complete sales pipeline and realistic opportunities.</p></div></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-5"><span className="sr-only" aria-live="polite">{transition.isPending ? "Moving deal" : "Pipeline ready"}</span>{columns.map((column) => <StageColumn key={column.stage.id} column={column} columns={columns} onMove={move} onOpen={setSelectedDeal} />)}</div>
        </DndContext>
      )}
      <DealDrawer key={selectedDeal?.id ?? "closed"} deal={selectedDeal} onClose={() => setSelectedDeal(null)} onUpdated={setSelectedDeal} />
    </div>
  );
}
