"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: "Attendance Tracking",
    desc: "Real-time clock-in / out with session timers",
    accent: "bg-indigo-50 text-indigo-500",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    label: "Task Ledger",
    desc: "HMAC-signed task entries for tamper-proof audits",
    accent: "bg-emerald-50 text-emerald-500",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    label: "File Vault",
    desc: "Date-partitioned Google Drive archiving",
    accent: "bg-violet-50 text-violet-500",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    label: "Team Chat",
    desc: "Live workspace messaging across all spaces",
    accent: "bg-sky-50 text-sky-500",
  },
];

export default function LoginPage() {
  const { loginWithMock } = useAuth();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"hr" | "employee">("employee");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="flex min-h-screen bg-white overflow-hidden">

      {/* LEFT — Branding Panel */}
      <aside className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-14 bg-[#FAFBFF] border-r border-gray-100 overflow-hidden">

        {/* Ambient background blobs */}
        <div className="absolute top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full bg-indigo-100/70 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[380px] h-[380px] rounded-full bg-violet-100/50 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-blue-50/80 blur-[60px] pointer-events-none" />

        {/* Logo */}
        <div className={`relative z-10 flex items-center gap-3 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
          <div className="w-9 h-9 bg-primaryAccent rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200">
            FD
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-contrastText tracking-tight">FlowDesk</h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">HR & Productivity Hub</p>
          </div>
        </div>

        {/* Hero */}
        <div className={`relative z-10 space-y-10 ${mounted ? "animate-fade-in-up delay-100" : "opacity-0"}`}>
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-[11px] font-semibold text-primaryAccent">
              <span className="w-1.5 h-1.5 rounded-full bg-primaryAccent animate-pulse" />
              Workspace productivity, unified
            </div>
            <h2 className="text-[36px] font-bold text-contrastText leading-[1.18] tracking-tight">
              Everything your team needs,{" "}
              <span className="text-primaryAccent">in one place.</span>
            </h2>
            <p className="text-[14px] text-gray-500 leading-relaxed max-w-[380px]">
              Attendance, tasks, files, requests and team chat — managed from a single clean interface built for modern HR teams.
            </p>
          </div>

          {/* Feature tiles */}
          <div className="grid grid-cols-2 gap-3 max-w-[400px]">
            {features.map((f, i) => (
              <div
                key={f.label}
                className={`bg-white/70 border border-gray-100 rounded-2xl p-4 backdrop-blur-sm card-lift ${mounted ? `animate-fade-in-up` : "opacity-0"}`}
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${f.accent}`}>
                  {f.icon}
                </div>
                <p className="text-[12px] font-semibold text-contrastText">{f.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Social proof strip */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {["A", "M", "S", "R"].map((l, i) => (
                <div key={i} className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${["bg-indigo-400","bg-violet-400","bg-blue-400","bg-teal-400"][i]}`}>{l}</div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">Used by teams every day</p>
          </div>
        </div>

        {/* Footer */}
        <p className={`relative z-10 text-[11px] text-gray-400 font-medium ${mounted ? "animate-fade-in delay-500" : "opacity-0"}`}>
          Secured with RBAC & HMAC-SHA256 signature audits.
        </p>
      </aside>

      {/* RIGHT — Auth Panel */}
      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12 relative overflow-hidden">

        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #6366F1 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />

        <div className={`relative z-10 w-full max-w-[380px] ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-primaryAccent rounded-xl flex items-center justify-center text-white font-bold text-sm">FD</div>
            <div>
              <h1 className="text-[15px] font-bold text-contrastText">FlowDesk</h1>
              <p className="text-[10px] text-gray-400">HR & Productivity Hub</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-[26px] font-bold text-contrastText tracking-tight">Welcome back</h2>
            <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
              Sign in to your workspace to continue.
            </p>
          </div>

          {/* Dev mode notice */}
          <div className="flex items-center gap-2.5 px-4 py-3 mb-6 bg-amber-50 border border-amber-200/80 rounded-xl text-[12px] text-amber-700 font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span><strong>Dev Mode:</strong> Enter any whitelisted email to authenticate.</span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 mb-5 bg-rose-50 border border-rose-200 rounded-xl text-[12px] text-rose-700 font-medium animate-scale-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="mockEmail" className="text-[12px] font-semibold text-gray-700">
                Work email address
              </label>
              <input
                id="mockEmail"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="input-premium"
              />
            </div>

            {/* Role selector */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-gray-700">Access portal</label>
              <div className="grid grid-cols-2 gap-2">
                {(["employee", "hr"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-[12px] font-semibold transition-all duration-200
                      ${role === r
                        ? "bg-primaryAccent text-white border-primaryAccent shadow-md shadow-indigo-200/60"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-white"
                      }`}
                  >
                    {r === "employee" ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    )}
                    {r === "employee" ? "Employee" : "HR Admin"}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="loginSubmitBtn"
              disabled={busy || !email.trim()}
              className="btn-primary w-full py-3 mt-2 text-[13px]"
            >
              {busy ? (
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <>
                  Enter Workspace
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 mt-8">
            © 2026 FlowDesk · HR & Productivity Hub
          </p>
        </div>
      </main>
    </div>
  );
}
