import { RefreshCw, ServerOff } from "lucide-react";

interface SessionUnavailableProps {
  message: string;
  onRetry: () => void;
}

export function SessionUnavailable({ message, onRetry }: SessionUnavailableProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <ServerOff size={23} />
        </div>
        <h1 className="mb-0 mt-5 text-xl font-semibold text-slate-900">CRM service unavailable</h1>
        <p className="mb-0 mt-3 text-sm leading-relaxed text-slate-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}
