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

export default function HRDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError("CRITICAL WARNING: Signature mismatches or manual tampering detected in Google Sheet!");
      } else {
        setSuccess("Ledger check complete: All signatures are authentic!");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to perform integrity check.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <TeamsShell title="HR Operations Control Panel">
      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* Aggregate Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        summary && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="text-2xl mb-1">👥</div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight">{summary.total_employees}</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold">Active Employees</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="text-2xl mb-1">⏱️</div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight">{summary.currently_clocked_in}</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold">Currently Clocked In</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="text-2xl mb-1">⏳</div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight">{summary.pending_leaves_count}</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold">Pending Requests</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="text-2xl mb-1">🚨</div>
              <div className="text-3xl font-extrabold text-slate-100 tracking-tight">{summary.unresolved_alerts_count}</div>
              <div className="text-xs text-slate-500 mt-1 font-semibold">Unresolved Alerts</div>
            </div>
          </div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaves Request Review List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-md font-bold text-slate-100 mb-4">🗓️ Employee Arrangements Queue</h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-3xl block mb-2">🏖️</span>
              <p className="text-sm">No requests currently registered in queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Emp ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">User #{req.user_id}</td>
                      <td className="py-3.5 px-4">{req.request_type === "leave" ? "🏖️ Leave" : "🏠 WFH"}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{req.start_date} to {req.end_date}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{req.employee_note || "-"}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : req.status === "declined"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openReviewModal(req, "approved")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openReviewModal(req, "declined")}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg transition-colors"
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

        {/* Cryptographic Ledger verification trigger */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit flex flex-col gap-4">
          <h3 className="text-md font-bold text-slate-100">🛡️ Cryptographic Integrity Auditing</h3>
          <p className="text-xs text-slate-400">
            Query the target employee's spreadsheet ledger and recalculate HMAC-SHA256 signatures for tamper checks.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400" htmlFor="scanUser">Target User ID</label>
            <input
              id="scanUser"
              type="number"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              placeholder="e.g. 1"
              value={scanUser}
              onChange={(e) => setScanUser(e.target.value)}
              disabled={actionLoading}
            />
          </div>

          <button
            onClick={handleIntegrityTrigger}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold text-sm rounded-xl"
            disabled={actionLoading || !scanUser}
          >
            {actionLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              "Trigger Verification Scan"
            )}
          </button>

          {scanResult && (
            <div className={`mt-4 p-4 border rounded-2xl text-center ${
              scanResult.tamper_detected 
                ? "bg-red-500/10 border-red-500/25 text-red-400" 
                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            }`}>
              <div className="text-sm font-bold">
                Status: {scanResult.tamper_detected ? "🚨 TAMPERED" : "✅ VERIFIED"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {scanResult.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal popup */}
      {reviewingReq && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-md font-bold text-slate-100">Review Request (User #{reviewingReq.user_id})</h4>
              <button className="text-xl text-slate-500 hover:text-slate-300" onClick={() => setReviewingReq(null)}>×</button>
            </div>
            
            <div className="mb-4 space-y-1">
              <div className="text-xs text-slate-300">
                <strong>Arrangement:</strong> {reviewingReq.request_type.toUpperCase()} ({reviewingReq.start_date} to {reviewingReq.end_date})
              </div>
              <div className="text-xs text-slate-400">
                <strong>Employee note:</strong> {reviewingReq.employee_note || "-"}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs font-semibold text-slate-400" htmlFor="hrNoteInput">HR Reviewer Comment</label>
              <textarea
                id="hrNoteInput"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none min-h-[80px]"
                placeholder="Include reviewer comments (max 300 chars)..."
                maxLength={300}
                value={hrNote}
                onChange={(e) => setHrNote(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <div className="flex justify-between gap-4">
              <button
                onClick={() => setReviewingReq(null)}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                className={`px-5 py-2.5 text-white font-semibold text-xs rounded-xl ${
                  reviewStatus === "approved" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                }`}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  `Confirm ${reviewStatus}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </TeamsShell>
  );
}
