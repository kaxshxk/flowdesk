"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface User {
  id: number;
  company_email: string;
}

interface LeaveWFHRequest {
  id: number;
  user_id: number;
  request_type: "leave" | "wfh";
  start_date: string;
  end_date: string;
  employee_note: string | null;
  status: "pending" | "approved" | "declined";
  hr_note: string | null;
  reviewed_by_hr_id: number | null;
  created_at: string;
}

interface AlertLog {
  id: number;
  user_id: number;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  description: string;
  resolved: boolean;
  timestamp: string;
}

export default function OperationsCenter() {
  const [activeTab, setActiveTab] = useState<"requests" | "alerts">("requests");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [requests, setRequests] = useState<LeaveWFHRequest[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // Review Dialog State
  const [reviewingReq, setReviewingReq] = useState<LeaveWFHRequest | null>(null);
  const [statusInput, setStatusInput] = useState<"approved" | "declined">("approved");
  const [typeInput, setTypeInput] = useState<"leave" | "wfh">("leave");
  const [endDateInput, setEndDateInput] = useState("");
  const [hrNoteInput, setHrNoteInput] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [requestsRes, alertsRes, employeesRes] = await Promise.all([
        api.get<{ requests: LeaveWFHRequest[] }>("/hr/requests"),
        api.get<{ alerts: AlertLog[] }>("/hr/alerts"),
        api.get<User[]>("/hr/employees"),
      ]);

      setRequests(requestsRes.requests || []);
      setAlerts(alertsRes.alerts || []);
      setEmployees(employeesRes || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getEmailById = (userId: number): string => {
    const emp = employees.find((e) => e.id === userId);
    return emp ? emp.company_email : `User #${userId}`;
  };

  // 1. Request Approval handlers
  const openReviewModal = (req: LeaveWFHRequest) => {
    setReviewingReq(req);
    setStatusInput("approved");
    setTypeInput(req.request_type);
    setEndDateInput(req.end_date);
    setHrNoteInput("");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReq) return;

    // Validate that update end date is not earlier than request start date
    if (endDateInput < reviewingReq.start_date) {
      setError("Override End Date cannot be earlier than the Request Start Date.");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.patch(`/hr/requests/${reviewingReq.id}/review`, {
        status: statusInput,
        hr_note: hrNoteInput.trim() || undefined,
        updated_request_type: typeInput !== reviewingReq.request_type ? typeInput : undefined,
        updated_end_date: endDateInput !== reviewingReq.end_date ? endDateInput : undefined,
      });

      setReviewingReq(null);
      setSuccess(`Request successfully reviewed and saved!`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to review request.");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Alert Resolution handlers
  const handleResolveAlert = async (alertId: number) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.post(`/hr/alerts/${alertId}/resolve`);

      setSuccess("Security alert marked resolved successfully.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to resolve alert.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filters for displaying pending requests only
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <TeamsShell title="Operations Center">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText">Operations Control</h1>
        <p className="text-sm text-contrastText/60 mt-1">Review leave/WFH requests and monitor real-time cryptographic security logs.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-primaryAccent/15 rounded-2xl text-sm text-primaryAccent">
          <span></span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-successBadge rounded-2xl text-sm text-contrastText">
          <span></span>
          <span>{success}</span>
        </div>
      )}

      {/* Tab Selector Switches */}
      <div className="flex border-b border-secondaryElement/20 bg-canvasBg/20 rounded-xl p-1 mb-8 gap-1 w-fit">
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-5 py-2 text-xs font-bold transition-all rounded-lg capitalize tracking-wide ${
            activeTab === "requests"
              ? "bg-primaryAccent text-canvasBg shadow-md shadow-primaryAccent/15"
              : "text-contrastText/60 hover:text-contrastText/90"
          }`}
        >
          Leave & WFH Requests ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          className={`px-5 py-2 text-xs font-bold transition-all rounded-lg capitalize tracking-wide ${
            activeTab === "alerts"
              ? "bg-primaryAccent text-canvasBg shadow-md shadow-primaryAccent/15"
              : "text-contrastText/60 hover:text-contrastText/90"
          }`}
        >
          Security & Activity Alerts ({alerts.filter((a) => !a.resolved).length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-44 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl animate-pulse"></div>
          <div className="h-44 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl animate-pulse"></div>
        </div>
      ) : (
        <>
          {/* TAB 1: PENDING LEAVE & WFH REQUESTS */}
          {activeTab === "requests" && (
            <div>
              {pendingRequests.length === 0 ? (
                <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-12 text-center text-contrastText/40">
                  <div className="text-4xl mb-3">️</div>
                  <h3 className="font-bold text-contrastText/80">Clean Queue</h3>
                  <p className="text-xs text-contrastText/60 mt-1">No pending leave or WFH requests to review.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-secondaryElement/20 pb-3 mb-4">
                          <div>
                            <h4 className="font-bold text-contrastText/90 text-sm truncate">{getEmailById(req.user_id)}</h4>
                            <span className="text-[10px] text-contrastText/40">Submitted User ID: #{req.user_id}</span>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            req.request_type === "leave" 
                              ? "bg-cardBacking/40 text-contrastText border border-secondaryElement/30" 
                              : "bg-successBadge/15 text-contrastText border border-successBadge/30"
                          }`}>
                            {req.request_type === "leave" ? " Leave" : " WFH"}
                          </span>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="text-xs text-contrastText/60">
                            <strong>Date Range:</strong> {req.start_date} to {req.end_date}
                          </div>
                          {req.employee_note && (
                            <div className="p-3 bg-canvasBg/35 border border-secondaryElement/20/80 rounded-xl text-xs text-contrastText/60 leading-relaxed italic">
                              "{req.employee_note}"
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => openReviewModal(req)}
                        className="w-full py-2 bg-primaryAccent hover:bg-primaryAccent/95 text-canvasBg font-semibold text-xs rounded-xl transition-all shadow-md shadow-primaryAccent/10"
                      >
                        Review & Respond
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SECURITY ALERTS FEED */}
          {activeTab === "alerts" && (
            <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl overflow-hidden">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-contrastText/40">
                  <div className="text-3xl mb-2"></div>
                  <p className="text-sm font-semibold">Security logs are completely clean.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-secondaryElement/20 text-contrastText/60 text-xs font-semibold uppercase bg-canvasBg/15">
                        <th className="py-3 px-6">Severity</th>
                        <th className="py-3 px-6">User ID</th>
                        <th className="py-3 px-6">Alert Details</th>
                        <th className="py-3 px-6">Timestamp</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondaryElement/20 text-contrastText/80">
                      {alerts.map((alert) => {
                        const isCritical = alert.severity === "critical";
                        return (
                          <tr
                            key={alert.id}
                            className={`transition-colors hover:bg-canvasBg/20 ${
                              isCritical && !alert.resolved
                                ? "bg-primaryAccent/10 text-primaryAccent"
                                : alert.resolved
                                ? "opacity-50"
                                : "odd:bg-canvasBg/10"
                            }`}
                          >
                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                alert.severity === "critical"
                                  ? "bg-primaryAccent text-canvasBg"
                                  : alert.severity === "warning"
                                  ? "bg-softHighlight text-contrastText"
                                  : "bg-cardBacking/40 text-contrastText border border-secondaryElement/30"
                              }`}>
                                {alert.severity === "critical" ? " Critical" : alert.severity === "warning" ? " Warning" : " Info"}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-semibold">User #{alert.user_id}</td>
                            <td className="py-4 px-6 max-w-md">
                              <div className={isCritical ? "font-bold text-primaryAccent" : ""}>
                                {alert.description}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-xs text-contrastText/60">
                              {new Date(alert.timestamp).toLocaleString()}
                            </td>
                            <td className="py-4 px-6 text-right">
                              {!alert.resolved ? (
                                <button
                                  onClick={() => handleResolveAlert(alert.id)}
                                  disabled={actionLoading}
                                  className="px-3 py-1.5 bg-canvasBg/35 border border-secondaryElement/20 hover:bg-canvasBg/30 text-contrastText/80 hover:text-contrastText text-xs font-semibold rounded-xl transition-all"
                                >
                                  Mark Resolved
                                </button>
                              ) : (
                                <span className="text-xs text-contrastText/40">Resolved</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* REVIEW DIALOG MODAL */}
      {reviewingReq && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <form onSubmit={handleReviewSubmit} className="w-full max-w-md bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-3xl p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-secondaryElement/20 pb-3">
              <h4 className="text-md font-bold text-contrastText">Review request (User #{reviewingReq.user_id})</h4>
              <button type="button" className="text-xl text-contrastText/40 hover:text-contrastText/80" onClick={() => setReviewingReq(null)}>×</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-contrastText/60" htmlFor="modalStatus">Final Status</label>
                <select
                  id="modalStatus"
                  className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-3 py-2.5 text-sm text-contrastText outline-none"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as "approved" | "declined")}
                  disabled={actionLoading}
                >
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-contrastText/60" htmlFor="modalType">Arrangement Type</label>
                <select
                  id="modalType"
                  className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-3 py-2.5 text-sm text-contrastText outline-none"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value as "leave" | "wfh")}
                  disabled={actionLoading}
                >
                  <option value="leave"> Leave / Vacation</option>
                  <option value="wfh"> Work From Home</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/60" htmlFor="modalEndDate">Override End Date</label>
              <input
                id="modalEndDate"
                type="date"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-4 py-2.5 text-sm text-contrastText outline-none"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                disabled={actionLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-contrastText/60" htmlFor="modalHrNote">HR Reviewer Notes</label>
                <span className="text-[10px] text-contrastText/40">{hrNoteInput.length}/300 characters</span>
              </div>
              <textarea
                id="modalHrNote"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/40 transition-all outline-none min-h-[90px]"
                placeholder="Include approval comments..."
                maxLength={300}
                value={hrNoteInput}
                onChange={(e) => setHrNoteInput(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <div className="flex justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={() => setReviewingReq(null)}
                className="px-4 py-2.5 bg-canvasBg/35 border border-secondaryElement/20 text-contrastText/60 hover:text-contrastText/90 text-xs font-semibold rounded-xl transition-all"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-primaryAccent hover:bg-primaryAccent/95 text-canvasBg font-semibold text-xs rounded-xl transition-all"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-canvasBg"></div>
                ) : (
                  "Save Decisions"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </TeamsShell>
  );
}
