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
    { label: "Dashboard", path: "/employee/dashboard", icon: "📊" },
    { label: "Task Ledger", path: "/employee/tasks", icon: "📝" },
    { label: "File Vault", path: "/employee/files", icon: "📁" },
    { label: "Request Center", path: "/employee/requests", icon: "🗓️" },
    { label: "Space Chat", path: "/employee/chat", icon: "💬" },
    { label: "Google Meet", path: "/employee/meet", icon: "📹" },
  ];

  const hrNav = [
    { label: "Dashboard", path: "/hr/dashboard", icon: "🛡️" },
    { label: "Whitelist Roster", path: "/hr/roster", icon: "📋" },
    { label: "Operations Center", path: "/hr/operations", icon: "⚙️" },
    { label: "Audit Reports", path: "/hr/reports", icon: "📈" },
  ];

  const activeNav = user.role === "hr" ? hrNav : employeeNav;
  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F9FAFC] text-[#1E293B] overflow-hidden">
      {/* Sidebar container */}
      <aside
        className={`flex flex-col bg-white border-r border-[#F1F5F9] shadow-[0_8px_30px_rgb(0,0,0,0.015)] transition-all duration-300 ease-in-out shrink-0 z-30 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Logo header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#F1F5F9] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-extrabold text-sm shadow-md shadow-indigo-500/10 shrink-0">
              FD
            </div>
            {!collapsed && (
              <span className="font-bold text-sm tracking-tight truncate text-[#1E293B]">
                FlowDesk
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-[#EEF2FF] text-slate-400 hover:text-[#4F46E5] transition-colors shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "➡️" : "⬅️"}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {activeNav.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.97] duration-200 ease-out group ${
                  isActive
                    ? "bg-[#EEF2FF] text-[#4F46E5] shadow-sm shadow-[#EEF2FF]/50"
                    : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-800"
                }`}
              >
                <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer profile card */}
        <div className="p-3 border-t border-[#F1F5F9] shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-sm shrink-0">
              {initial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1E293B] truncate">
                  {user.email.split("@")[0]}
                </p>
                <p className="text-[10px] text-slate-400 capitalize font-medium">{user.role}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-[#FFF1F2] text-slate-400 hover:text-[#E11D48] transition-colors shrink-0"
              title="Sign out"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main workspace container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-[#F1F5F9] bg-white/80 backdrop-blur-md shrink-0 shadow-sm shadow-slate-100/50">
          <h1 className="text-base font-bold tracking-tight text-[#1E293B]">
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
              {user.role === "hr" ? "🛡️ HR Administrator" : "👤 Employee Portal"}
            </span>
          </div>
        </header>

        {/* Scrollable content panel with premium fade-in transition */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}
