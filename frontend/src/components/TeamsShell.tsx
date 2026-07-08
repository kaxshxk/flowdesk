"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/utils/api";

interface TeamsShellProps {
  title: string;
  children: ReactNode;
}

const employeeNav = [
  {
    label: "Dashboard",
    path: "/employee/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Task Ledger",
    path: "/employee/tasks",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    label: "File Vault",
    path: "/employee/files",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Request Center",
    path: "/employee/requests",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    ),
  },
  {
    label: "Space Chat",
    path: "/employee/chat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Google Meet",
    path: "/employee/meet",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
];

const hrNav = [
  {
    label: "Dashboard",
    path: "/hr/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Whitelist Roster",
    path: "/hr/roster",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Operations",
    path: "/hr/operations",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
  {
    label: "Team Chat",
    path: "/hr/chat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Audit Reports",
    path: "/hr/reports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: "Alerts Feed",
    path: "/hr/alerts",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

export default function TeamsShell({ title, children }: TeamsShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<{ avatar_url?: string | null; full_name?: string | null }>("/me")
      .then((data) => {
        setProfileAvatar(data.avatar_url ?? null);
        setFullName(data.full_name ?? null);
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const activeNav = user.role === "hr" ? hrNav : employeeNav;
  const initial = user.email.charAt(0).toUpperCase();
  const username = user.email.split("@")[0];

  return (
    <div className="flex min-h-screen bg-canvasBg text-contrastText overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-300 ease-in-out shrink-0 z-30 ${
          collapsed ? "w-[60px]" : "w-[220px]"
        }`}
        style={{ boxShadow: "1px 0 0 #F3F4F6" }}
      >
        {/* Brand header */}
        <div className={`flex items-center h-[60px] border-b border-gray-100 shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-primaryAccent text-white font-bold text-[11px] shrink-0 shadow-sm">
              FD
            </div>
            {!collapsed && (
              <span className="font-semibold text-[13px] tracking-tight text-contrastText truncate">
                FlowDesk
              </span>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
              title="Collapse sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute top-[18px] left-[14px] p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
              title="Expand sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          )}
        </div>

        {/* Role label */}
        {!collapsed && (
          <div className="px-4 pt-5 pb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              {user.role === "hr" ? "Administration" : "Employee"}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto ${collapsed ? "py-4 px-2" : "pb-4 px-3"} space-y-0.5`}>
          {activeNav.map((item, i) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center w-full gap-3 rounded-lg font-medium text-[13px] transition-all duration-150 group
                  ${collapsed ? "justify-center p-2.5" : "px-3 py-2"}
                  ${isActive
                    ? "bg-softHighlight text-primaryAccent"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-primaryAccent rounded-r-full" />
                )}
                <span className={`shrink-0 ${isActive ? "text-primaryAccent" : "text-gray-400 group-hover:text-gray-600"}`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer profile */}
        <div className={`border-t border-gray-100 shrink-0 ${collapsed ? "p-2" : "p-3"}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(user.role === "hr" ? "/hr/profile" : "/employee/profile")}
              className={`flex items-center gap-2.5 flex-1 min-w-0 text-left hover:bg-gray-50 p-1.5 rounded-xl transition-all ${collapsed ? "justify-center" : ""}`}
              title="View Profile"
            >
              {profileAvatar ? (
                <img 
                  src={`${profileAvatar}?t=${new Date().getTime()}`}
                  alt={username} 
                  className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm border border-gray-100" 
                />
              ) : (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primaryAccent to-indigo-400 text-white font-semibold text-[12px] shrink-0 shadow-sm">
                  {initial}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-contrastText truncate">{fullName || username}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{user.role}</p>
                </div>
              )}
            </button>
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-md text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-150 shrink-0"
                title="Sign out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main workspace ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top navbar */}
        <header className="flex items-center justify-between h-[60px] px-6 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[13px] font-semibold text-gray-700">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              user.role === "hr"
                ? "bg-primaryAccent/8 text-primaryAccent border border-primaryAccent/15"
                : "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user.role === "hr" ? "bg-primaryAccent" : "bg-emerald-500"}`} />
              {user.role === "hr" ? "HR Admin" : "Employee"}
            </span>
            {profileAvatar ? (
              <img 
                src={`${profileAvatar}?t=${new Date().getTime()}`}
                alt={username} 
                className="w-7 h-7 rounded-full object-cover shadow-sm border border-gray-100 cursor-pointer"
                onClick={() => router.push(user.role === "hr" ? "/hr/profile" : "/employee/profile")}
                title="View Profile"
              />
            ) : (
              <div 
                className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primaryAccent to-indigo-400 text-white font-semibold text-[11px] cursor-pointer"
                onClick={() => router.push(user.role === "hr" ? "/hr/profile" : "/employee/profile")}
                title="View Profile"
              >
                {initial}
              </div>
            )}
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
