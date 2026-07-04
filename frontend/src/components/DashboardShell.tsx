"use client";

import React, { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";

interface DashboardShellProps {
  title: string;
  children: ReactNode;
}

export default function DashboardShell({ title, children }: DashboardShellProps) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh", background: "#07090f" }}>
        <span className="spinner" style={{ width: "32px", height: "32px", borderThickness: "3px" }}></span>
      </div>
    );
  }

  if (!user) {
    return null; // Will trigger redirect in AuthContext hook
  }

  const employeeNav = [
    { label: "Dashboard", path: "/dashboard", icon: "📊" },
    { label: "Task Ledger", path: "/tasks", icon: "📝" },
    { label: "File Vault", path: "/files", icon: "📁" },
    { label: "Request Center", path: "/requests", icon: "🗓️" },
    { label: "Space Chat", path: "/chat", icon: "💬" },
    { label: "Google Meet", path: "/meet", icon: "📹" },
  ];

  const hrNav = [
    { label: "Dashboard", path: "/hr", icon: "🛡️" },
    { label: "System Alerts", path: "/hr/alerts", icon: "🚨" },
    { label: "Audit Reports", path: "/hr/reports", icon: "📈" },
  ];

  const activeNav = user.role === "hr" ? hrNav : employeeNav;
  const initial = user.company_email.charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="logo-icon">FD</div>
            <div>
              <h2 className="logo-text">FlowDesk</h2>
              <div className="logo-sub">HR-Productivity Hub</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {activeNav.map((item) => {
            const isActive = pathname === item.path;
            return (
              <div
                key={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => router.push(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar">{initial}</div>
            <div className="user-info">
              <div className="user-name truncate">{user.company_email.split("@")[0]}</div>
              <div className="user-role">{user.role}</div>
            </div>
            <button
              onClick={logout}
              style={{ background: "none", fontSize: "16px", padding: "4px" }}
              title="Sign out"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            <span className="badge badge-accent">
              {user.role === "hr" ? "🛡️ HR Administrator" : "👤 Employee Portal"}
            </span>
          </div>
        </header>

        {/* Page Inner Content */}
        <div className="page-inner">
          {children}
        </div>
      </main>
    </div>
  );
}
