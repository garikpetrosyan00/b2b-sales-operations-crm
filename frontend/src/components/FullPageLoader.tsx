export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
        <span className="text-sm font-medium text-slate-500">Preparing your workspace…</span>
      </div>
    </div>
  );
}

