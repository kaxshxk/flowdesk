"use client";

import React, { useState, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

interface TeamsShellProps {
  title: string;
  children: ReactNode;
}

export default function TeamsShell({ title, children }: TeamsShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const employeeNav = [
    { label: "Dashboard",      path: "/employee/dashboard", icon: "⊞" },
    { label: "Task Ledger",    path: "/employee/tasks",     icon: "✓" },
    { label: "File Vault",     path: "/employee/files",     icon: "⊡" },
    { label: "Request Center", path: "/employee/requests",  icon: "↗" },
    { label: "Space Chat",     path: "/employee/chat",      icon: "◎" },
    { label: "Google Meet",    path: "/employee/meet",      icon: "⊕" },
  ];

  const hrNav = [
    { label: "Dashboard",        path: "/hr/dashboard",   icon: "⊞" },
    { label: "Whitelist Roster", path: "/hr/roster",      icon: "≡" },
    { label: "Operations",       path: "/hr/operations",  icon: "⚙" },
    { label: "Team Chat",        path: "/hr/chat",        icon: "◎" },
    { label: "Audit Reports",    path: "/hr/reports",     icon: "↗" },
  ];

  const activeNav = user.role === "hr" ? hrNav : employeeNav;
  const initial   = user.email.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvasBg text-contrastText overflow-hidden">

      {/* ── Sidebar (Midnight Lagoon) ──────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-sidebarBacking transition-all duration-300 ease-in-out shrink-0 z-30 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-canvasBg/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primaryAccent text-canvasBg font-extrabold text-xs shadow-md shrink-0">
              FD
            </div>
            {!collapsed && (
              <span className="font-bold text-sm tracking-tight truncate text-canvasBg">
                FlowDesk
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-canvasBg/40 hover:text-canvasBg hover:bg-canvasBg/10 transition-all duration-150 active:scale-[0.96] shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {activeNav.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 active:scale-[0.96] group ${
                  isActive
                    ? "bg-primaryAccent text-canvasBg shadow-md"
                    : "text-canvasBg/60 hover:bg-canvasBg/10 hover:text-canvasBg"
                }`}
              >
                <span className="text-base shrink-0 select-none">{item.icon}</span>
                {!collapsed && <span className="truncate text-xs font-semibold tracking-wide">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer profile */}
        <div className="p-3 border-t border-canvasBg/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primaryAccent text-canvasBg font-bold text-sm shrink-0">
              {initial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-canvasBg truncate">
                  {user.email.split("@")[0]}
                </p>
                <p className="text-[10px] text-canvasBg/50 capitalize font-medium">{user.role}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-canvasBg/40 hover:text-primaryAccent hover:bg-canvasBg/10 transition-all duration-150 active:scale-[0.96] shrink-0 flex items-center justify-center"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main workspace ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top navbar */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-secondaryElement/30 bg-canvasBg shrink-0">
          <h1 className="text-sm font-bold tracking-tight text-contrastText">{title}</h1>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              user.role === "hr"
                ? "bg-primaryAccent text-canvasBg"
                : "bg-successBadge text-contrastText"
            }`}>
              {user.role === "hr" ? "HR Administrator" : "Employee Portal"}
            </span>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-canvasBg animate-fade-in-up">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
