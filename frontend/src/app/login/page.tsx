"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { loginWithMock } = useAuth();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"hr" | "employee">("employee");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);

    try {
      await loginWithMock(email, role);
    } catch (err: any) {
      setError(err.message || "Could not connect to backend. Is it running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── LEFT BRANDING PANEL ── */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex-col justify-between p-12">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
            FD
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">FlowDesk</h1>
            <p className="text-sm text-indigo-200 font-medium">HR & Productivity Hub</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            Your unified workspace for HR management & employee productivity
          </h2>
          <p className="text-lg text-indigo-100 leading-relaxed">
            Attendance tracking, task auditing, activity verification, and real-time collaboration - all in one secure platform.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {["Attendance Tracking", "Task Ledger", "File Vault", "Real-time Chat", "Audit Reports"].map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white backdrop-blur-sm border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-indigo-200/70">
          Secured with enterprise-grade authentication and role-based access control.
        </p>
      </aside>

      {/* ── RIGHT AUTH PANEL ── */}
      <main className="flex flex-1 items-center justify-center bg-slate-950 px-6 py-12 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/[0.06] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[400px] h-[400px] bg-purple-600/[0.05] rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-indigo-600/20">
              FD
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">FlowDesk</h1>
              <p className="text-xs text-slate-500 font-medium">HR & Productivity Hub</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Welcome to FlowDesk</h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                Sign in to your workspace below.
              </p>
            </div>

            {/* Dev mode banner */}
            <div className="flex items-center gap-2 p-3 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
              <span>🔧</span>
              <span><strong>Dev Mode</strong> - Google OAuth is not configured. Enter any email to access the platform.</span>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border bg-red-500/10 border-red-500/20 text-sm text-red-400">
                <span className="mt-0.5 shrink-0">⚠️</span>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="mockEmail" className="text-xs font-semibold text-slate-400">
                  Email Address
                </label>
                <input
                  id="mockEmail"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">Sign in as</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("employee")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-medium text-sm transition-all ${
                      role === "employee"
                        ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xl">👤</span>
                    <span className="text-xs font-semibold">Employee</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("hr")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-medium text-sm transition-all ${
                      role === "hr"
                        ? "bg-purple-600/10 border-purple-500/40 text-purple-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xl">🛡️</span>
                    <span className="text-xs font-semibold">HR Admin</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl disabled:opacity-50"
              >
                {busy ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  "Enter Workspace"
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-8">
            © 2026 FlowDesk · HR & Productivity Hub
          </p>
        </div>
      </main>
    </div>
  );
}
