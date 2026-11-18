import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../auth/useAuth";
import { Logo } from "../components/Logo";
import { ApiError } from "../lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFields = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { user, isInitializing, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    document.title = "Sign in | Northstar CRM";
  }, []);

  if (!isInitializing && user) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname;
      navigate(destination ?? "/", { replace: true });
    } catch (error) {
      setError("root", {
        message: error instanceof ApiError ? error.message : "Unable to sign in. Please try again.",
      });
    }
  });

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-navy-950 p-12 lg:flex lg:flex-col">
        <div className="absolute -right-40 -top-48 h-[32rem] w-[32rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-56 -left-28 h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10">
          <Logo />
        </div>
        <div className="relative z-10 my-auto max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
            <ShieldCheck size={15} /> Secure sales operations workspace
          </div>
          <h1 className="m-0 text-5xl font-semibold leading-[1.12] tracking-tight text-white">
            Bring clarity to every stage of your revenue process.
          </h1>
          <p className="mb-0 mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
            One governed workspace for lead routing, pipeline accountability, and dependable
            forecasting.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              ["Controlled", "Role-based access"],
              ["Reliable", "Session security"],
              ["Ready", "Built to scale"],
            ].map(([title, subtitle]) => (
              <div key={title}>
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 m-0 text-xs text-slate-600">
          Phase 1 · Foundation and access control
        </p>
      </section>

      <section className="flex items-center justify-center bg-[#f8fafc] px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex rounded-xl bg-navy-950 p-3">
              <Logo />
            </div>
          </div>
          <div className="mb-8">
            <p className="m-0 text-sm font-semibold text-indigo-600">Welcome back</p>
            <h2 className="mb-0 mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Sign in to your workspace
            </h2>
            <p className="mb-0 mt-3 text-sm leading-relaxed text-slate-500">
              Use the credentials created by your workspace administrator.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                {...register("email")}
              />
              {errors.email && <p className="mb-0 mt-1.5 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="mb-0 mt-1.5 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
            {errors.root && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.root.message}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting || isInitializing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="mb-0 mt-8 text-center text-xs leading-relaxed text-slate-400">
            Access is restricted to authorized team members. Contact your administrator if you
            need an account.
          </p>
        </div>
      </section>
    </div>
  );
}

