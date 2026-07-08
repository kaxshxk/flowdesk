"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface Summary {
  total_employees: number;
  currently_clocked_in: number;
  pending_leaves_count: number;
  unresolved_alerts_count: number;
}

interface UserRequest {
  id: number;
  user_id: number;
  request_type: "leave" | "wfh";
  start_date: string;
  end_date: string;
  employee_note: string | null;
  status: "pending" | "approved" | "declined";
  hr_note: string | null;
}

// ── Stat card ──────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  accent,
  icon,
  trend,
  delay = 0,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ReactNode;
  trend?: string;
  delay?: number;
}) {
  return (
    <div
      className={`bg-white border border-gray-100 rounded-2xl p-5 card-lift animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] text-gray-400 font-medium">{trend}</span>
        )}
      </div>
      <div className="text-[28px] font-bold text-contrastText tracking-tight animate-count-up">{value}</div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  const map = {
    pending:  { cls: "bg-amber-50 text-amber-700 border-amber-200",  dot: "bg-amber-500",  label: "Pending"  },
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Approved" },
    declined: { cls: "bg-rose-50 text-rose-600 border-rose-200",    dot: "bg-rose-500",   label: "Declined" },
  };
  const { cls, dot, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function HRDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Review modal state
  const [reviewingReq, setReviewingReq] = useState<UserRequest | null>(null);
  const [hrNote, setHrNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"approved" | "declined">("approved");

  // Integrity scanner state
  const [scanUser, setScanUser] = useState<string>("");
  const [scanResult, setScanResult] = useState<any | null>(null);

  const fetchHRData = async () => {
    try {
      setLoading(true);
      setError(null);
      const summaryRes = await api.get<Summary>("/hr/dashboard/summary");
      setSummary(summaryRes);
      const requestsRes = await api.get<{ requests: UserRequest[] }>("/hr/requests");
      setRequests(requestsRes.requests);
    } catch (err: any) {
      setError(err?.message || "Failed to load HR data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRData();
    setMounted(true);
  }, []);

  const openReviewModal = (req: UserRequest, status: "approved" | "declined") => {
    setReviewingReq(req);
    setReviewStatus(status);
    setHrNote("");
  };

  const handleReviewSubmit = async () => {
    if (!reviewingReq) return;
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);
      await api.patch(`/hr/requests/${reviewingReq.id}/review`, {
        status: reviewStatus,
        hr_note: hrNote.trim() || undefined,
      });
      setReviewingReq(null);
      setSuccess(`Request successfully ${reviewStatus}!`);
      await fetchHRData();
    } catch (err: any) {
      setError(err?.message || "Failed to review request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleIntegrityTrigger = async () => {
    if (!scanUser) return;
    try {
      setActionLoading(true);
      setScanResult(null);
      setError(null);
      const res = await api.post<any>(`/hr/integrity/trigger/${scanUser}`);
      setScanResult(res);
      if (res.tamper_detected) {
        setError("CRITICAL: Signature mismatches detected in Google Sheet!");
      } else {
        setSuccess("Ledger check complete — all signatures are authentic.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to perform integrity check.");
    } finally {
      setActionLoading(false);
    }
  };

  const skeletonCard = (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="skeleton w-9 h-9 rounded-xl mb-4" />
      <div className="skeleton h-7 w-1/2 rounded-lg mb-2" />
      <div className="skeleton h-3 w-2/3 rounded" />
    </div>
  );

  return (
    <TeamsShell title="HR Operations">

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-[12px] text-rose-700 font-medium animate-scale-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 bg-emerald-50 border border-emerald-200 rounded-xl text-[12px] text-emerald-700 font-medium animate-scale-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Page header */}
      <div className={`mb-8 ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>
        <h1 className="text-[22px] font-bold text-contrastText tracking-tight">Operations Overview</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>{skeletonCard}{skeletonCard}{skeletonCard}{skeletonCard}</>
        ) : summary && (
          <>
            <KpiCard
              label="Total Employees"
              value={summary.total_employees}
              accent="bg-indigo-50 text-primaryAccent"
              delay={0}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            />
            <KpiCard
              label="Clocked In Now"
              value={summary.currently_clocked_in}
              accent="bg-emerald-50 text-emerald-600"
              delay={80}
              trend="Live"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            />
            <KpiCard
              label="Pending Requests"
              value={summary.pending_leaves_count}
              accent="bg-amber-50 text-amber-600"
              delay={160}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            />
            <KpiCard
              label="Unresolved Alerts"
              value={summary.unresolved_alerts_count}
              accent="bg-rose-50 text-rose-500"
              delay={240}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
            />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Request Queue */}
        <div className={`lg:col-span-2 bg-white border border-gray-100 rounded-2xl overflow-hidden card-lift ${mounted ? "animate-fade-in-up delay-300" : "opacity-0"}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-[14px] font-bold text-contrastText">Requests Queue</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Employee leave & WFH arrangements</p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-primaryAccent border border-indigo-100 rounded-full text-[10px] font-semibold">
              {requests.filter(r => r.status === "pending").length} pending
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p className="text-[13px] font-medium text-gray-400">No requests in queue</p>
              <p className="text-[11px] text-gray-300 mt-1">Employee requests will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 px-6 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                    <th className="py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dates</th>
                    <th className="py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map((req, i) => (
                    <tr key={req.id} className="hover:bg-gray-50/60 transition-colors" style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-primaryAccent">
                            {req.user_id}
                          </div>
                          <span className="text-[12px] font-semibold text-contrastText">User #{req.user_id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                          req.request_type === "leave"
                            ? "bg-violet-50 text-violet-600"
                            : "bg-blue-50 text-blue-600"
                        }`}>
                          {req.request_type === "leave" ? "Leave" : "WFH"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-gray-500">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openReviewModal(req, "approved")}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[10px] rounded-lg transition-all duration-150 border border-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openReviewModal(req, "declined")}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[10px] rounded-lg transition-all duration-150 border border-rose-200"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Integrity Scanner */}
        <div className={`bg-white border border-gray-100 rounded-2xl p-6 h-fit card-lift ${mounted ? "animate-fade-in-up delay-400" : "opacity-0"}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-primaryAccent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-contrastText">Integrity Auditor</h3>
              <p className="text-[11px] text-gray-400">HMAC-SHA256 verification</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mb-5 leading-relaxed">
            Run a cryptographic ledger check to verify tamper-free HMAC signatures for any employee's spreadsheet.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-600" htmlFor="scanUser">Target User ID</label>
              <input
                id="scanUser"
                type="number"
                className="input-premium text-[13px]"
                placeholder="Enter user ID (e.g. 1)"
                value={scanUser}
                onChange={(e) => setScanUser(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <button
              id="integrityTriggerBtn"
              onClick={handleIntegrityTrigger}
              disabled={actionLoading || !scanUser}
              className="btn-primary w-full text-[12px] py-2.5"
            >
              {actionLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Run Verification Scan
                </>
              )}
            </button>
          </div>

          {scanResult && (
            <div className={`mt-5 p-4 rounded-xl border text-center animate-scale-in ${
              scanResult.tamper_detected
                ? "bg-rose-50 border-rose-200"
                : "bg-emerald-50 border-emerald-200"
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${
                scanResult.tamper_detected ? "bg-rose-100" : "bg-emerald-100"
              }`}>
                {scanResult.tamper_detected ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div className={`text-[13px] font-bold mb-1 ${scanResult.tamper_detected ? "text-rose-700" : "text-emerald-700"}`}>
                {scanResult.tamper_detected ? "Tampering Detected" : "Verified & Clean"}
              </div>
              <p className="text-[11px] text-gray-500">{scanResult.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewingReq && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-50 p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h4 className="text-[14px] font-bold text-contrastText">Review Request</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">User #{reviewingReq.user_id} · {reviewingReq.request_type.toUpperCase()}</p>
              </div>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                onClick={() => setReviewingReq(null)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-[12px]">
                <div className="flex gap-2">
                  <span className="text-gray-400 min-w-[80px]">Period</span>
                  <span className="font-medium text-contrastText">{reviewingReq.start_date} to {reviewingReq.end_date}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-400 min-w-[80px]">Employee note</span>
                  <span className="font-medium text-contrastText">{reviewingReq.employee_note || "—"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-700" htmlFor="hrNoteInput">HR Comment (optional)</label>
                <textarea
                  id="hrNoteInput"
                  className="input-premium min-h-[80px] resize-none text-[12px]"
                  placeholder="Add a reviewer note..."
                  maxLength={300}
                  value={hrNote}
                  onChange={(e) => setHrNote(e.target.value)}
                  disabled={actionLoading}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setReviewingReq(null)}
                  className="flex-1 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 font-semibold text-[12px] rounded-xl hover:bg-gray-100 transition-all"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewSubmit}
                  className={`flex-1 py-2.5 text-white font-semibold text-[12px] rounded-xl transition-all flex items-center justify-center gap-2 ${
                    reviewStatus === "approved"
                      ? "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200"
                      : "bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200"
                  }`}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  ) : reviewStatus === "approved" ? "✓ Approve" : "✕ Decline"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TeamsShell>
  );
}
