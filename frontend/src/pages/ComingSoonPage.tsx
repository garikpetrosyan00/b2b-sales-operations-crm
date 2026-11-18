import { Blocks, Sparkles } from "lucide-react";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-4xl items-center justify-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/[0.025] sm:px-16">
        <div className="relative mx-auto mb-7 grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Blocks size={29} strokeWidth={1.7} />
          <Sparkles size={17} className="absolute -right-1 -top-1 text-amber-500" />
        </div>
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Next phase
        </span>
        <h2 className="mb-0 mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title} is coming next</h2>
        <p className="mx-auto mb-0 mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
          This workspace is intentionally reserved for the next implementation phase. The secure
          application foundation and access controls are ready for it.
        </p>
      </div>
    </div>
  );
}

