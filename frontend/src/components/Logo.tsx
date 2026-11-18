export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-lg shadow-indigo-950/30">
        N
      </div>
      {!compact && (
        <div>
          <div className="text-sm font-semibold tracking-wide text-white">NORTHSTAR</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Sales CRM
          </div>
        </div>
      )}
    </div>
  );
}

