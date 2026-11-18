import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  ListTodo,
  Menu,
  Settings,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import type { UserRole } from "../types/auth";
import { Logo } from "./Logo";

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const navigation: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Leads", path: "/leads", icon: Target },
  { label: "Pipeline", path: "/pipeline", icon: CircleDollarSign },
  { label: "Tasks", path: "/tasks", icon: ListTodo },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Team", path: "/team", icon: Users, roles: ["admin", "manager"] },
  { label: "Settings", path: "/settings", icon: Settings, roles: ["admin"] },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/tasks": "Tasks",
  "/reports": "Reports",
  "/team": "Team",
  "/settings": "Settings",
};

function roleLabel(role: UserRole) {
  return role.replace("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const pageTitle = pageTitles[location.pathname] ?? "Workspace";
    document.title = `${pageTitle} | Northstar CRM`;
  }, [location.pathname]);

  if (!user) return null;
  const visibleNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );
  const initials = user.full_name
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center px-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary navigation">
        {visibleNavigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon size={19} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="m-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Phase 1
        </div>
        <p className="m-0 text-xs leading-relaxed text-slate-400">
          Secure workspace foundation is ready. CRM modules arrive next.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy-950 lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 bg-navy-950 shadow-2xl">
            <button
              className="absolute right-4 top-6 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-4">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="m-0 text-xs font-medium text-slate-400">Workspace</p>
              <h1 className="m-0 text-lg font-semibold text-slate-800">
                {pageTitles[location.pathname] ?? "Workspace"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-indigo-500" />
            </button>
            <div className="relative">
              <button
                className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-slate-50"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                  {initials}
                </span>
                <span className="hidden sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold text-slate-700">
                    {user.full_name}
                  </span>
                  <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    {roleLabel(user.role)}
                  </span>
                </span>
                <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="m-0 truncate text-sm font-medium text-slate-800">{user.email}</p>
                    <p className="mb-0 mt-1 text-xs text-slate-400">Signed in securely</p>
                  </div>
                  <button
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    onClick={() => void logout()}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
