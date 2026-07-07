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
    <div className="flex min-h-screen bg-canvasBg overflow-hidden">
      {/*  LEFT BRANDING PANEL  */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blush-petal/40 via-vanilla-cream to-misty-sky/30 flex-col justify-between p-16 border-r border-secondaryElement/20">
        
        {/* Ambient Glowing Blobs */}
        <div className="absolute top-10 right-10 w-96 h-96 bg-softHighlight/40 rounded-full blur-3xl animate-pulse duration-10000 pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-successBadge/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-secondaryElement/30 rounded-full blur-3xl pointer-events-none" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2D3A47" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo / Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-canvasBg/70 backdrop-blur rounded-2xl flex items-center justify-center text-primaryAccent font-extrabold text-xl shadow-sm border border-canvasBg/60">
            FD
          </div>
          <div>
            <h1 className="text-xl font-bold text-contrastText tracking-tight">FlowDesk</h1>
            <p className="text-xs text-contrastText/60 font-semibold uppercase tracking-wider">HR & Productivity Hub</p>
          </div>
        </div>

        {/* Hero Copy & Feature Pills */}
        <div className="relative z-10 space-y-8 my-auto">
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold text-contrastText leading-[1.2] tracking-tight">
              Your unified workspace for <span className="text-primaryAccent">HR operations</span> & employee productivity
            </h2>
            <p className="text-base text-contrastText/70 leading-relaxed max-w-md">
              Seamlessly manage attendance tracking, task ledger systems, activity logs, and real-time operations in one lightweight platform.
            </p>
          </div>

          {/* Color-coded Multi-color Pills */}
          <div className="flex flex-wrap gap-2.5 max-w-md">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-successBadge/15 text-contrastText border border-successBadge/35 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-successBadge" />
              Attendance Audit
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-softHighlight/25 text-primaryAccent border border-softHighlight/45 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primaryAccent" />
              Task Ledger
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-cardBacking shadow-ambient text-contrastText border border-secondaryElement/30 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-secondaryElement" />
              File Vault
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-successBadge/15 text-contrastText border border-successBadge/35 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-successBadge" />
              Live Workspace Chat
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-softHighlight/25 text-primaryAccent border border-softHighlight/45 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primaryAccent" />
              Cryptographic Signatures
            </span>
          </div>

          {/* Floating Showcase Widgets */}
          <div className="relative pt-6 flex flex-col gap-4 max-w-sm">
            {/* Widget 1 */}
            <div className="bg-canvasBg/80 border border-secondaryElement/20 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-md transform hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primaryAccent/10 flex items-center justify-center text-primaryAccent font-bold text-xs">SJ</div>
                  <div>
                    <p className="text-xs font-bold text-contrastText">Sarah Jenkins</p>
                    <p className="text-[10px] text-contrastText/50">Product Designer</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-successBadge/20 text-contrastText border border-successBadge/30">
                  Clocked In
                </span>
              </div>
              <div className="h-1.5 w-full bg-canvasBg rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-successBadge rounded-full" />
              </div>
              <div className="flex justify-between items-center mt-2 text-[9px] text-contrastText/50">
                <span>Shift progress</span>
                <span>80% completed</span>
              </div>
            </div>

            {/* Widget 2 */}
            <div className="bg-canvasBg/80 border border-secondaryElement/20 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-md self-end w-4/5 transform hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-contrastText/50 uppercase tracking-wider">Cryptographic Signature</span>
                <span className="text-[9px] font-bold text-successBadge">Verified</span>
              </div>
              <div className="text-[10px] font-mono text-contrastText/70 bg-canvasBg/50 p-2 rounded-lg border border-secondaryElement/15 truncate">
                sha256: 8f3a9e01b3c9429188a10738e
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-contrastText/50 font-medium">
          Secured with role-based access control and HMAC signature audits.
        </p>
      </aside>

      {/*  RIGHT AUTH PANEL  */}
      <main className="flex flex-1 items-center justify-center bg-canvasBg/35 px-6 py-12 relative overflow-hidden">
        {/* Mobile / background decoration */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-softHighlight/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-secondaryElement/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-11 h-11 bg-gradient-to-tr from-rosewood to-blush-petal rounded-xl flex items-center justify-center text-canvasBg font-extrabold text-lg shadow-md">
              FD
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-contrastText">FlowDesk</h1>
              <p className="text-xs text-contrastText/55 font-medium">HR & Productivity Hub</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-cardBacking shadow-ambient border border-softHighlight/40 rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-contrastText">Welcome to FlowDesk</h2>
              <p className="mt-1.5 text-sm text-contrastText/60 leading-relaxed">
                Sign in to your workspace below.
              </p>
            </div>

            {/* Dev mode banner */}
            <div className="flex items-start gap-2.5 p-3.5 mb-6 bg-canvasBg/60 border border-secondaryElement/20 rounded-2xl text-xs text-primaryAccent font-medium">
              <span></span>
              <span><strong>Dev Mode</strong>: Enter any whitelisted email to mock authenticate into your portal.</span>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl border bg-primaryAccent/15 border-primaryAccent/30 text-sm text-primaryAccent">
                <span className="mt-0.5 shrink-0"></span>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="mockEmail" className="text-xs font-semibold text-contrastText/70">
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
                  className="w-full bg-canvasBg/30 border border-secondaryElement/30 focus:border-primaryAccent focus:ring-2 focus:ring-rosewood/10 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/30 outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-contrastText/70">Sign in as</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("employee")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-medium text-sm transition-all transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95 ${
                      role === "employee"
                        ? "bg-primaryAccent text-canvasBg border-primaryAccent shadow-sm font-semibold"
                        : "bg-cardBacking/30 border-secondaryElement/20 text-contrastText/50 hover:border-secondaryElement/45"
                    }`}
                  >
                    <span className="text-xs font-semibold">Employee Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("hr")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-medium text-sm transition-all transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95 ${
                      role === "hr"
                        ? "bg-primaryAccent text-canvasBg border-primaryAccent shadow-sm font-semibold"
                        : "bg-cardBacking/30 border-secondaryElement/20 text-contrastText/50 hover:border-secondaryElement/45"
                    }`}
                  >
                    <span className="text-xs font-semibold">HR Admin Portal</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-primaryAccent hover:bg-primaryAccent/95 hover:shadow-lg hover:shadow-ambient transition-all text-canvasBg font-semibold text-sm rounded-xl transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95 disabled:bg-primaryAccent/20 disabled:text-contrastText/30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {busy ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-canvasBg" />
                ) : (
                  "Enter Workspace"
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-contrastText/40 mt-8 font-medium">
            © 2026 FlowDesk · HR & Productivity Hub
          </p>
        </div>
      </main>
    </div>
  );
}
