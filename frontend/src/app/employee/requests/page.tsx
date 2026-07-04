"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface LeaveWFHRequest {
  id: number;
  request_type: "leave" | "wfh";
  start_date: string;
  end_date: string;
  employee_note: string | null;
  status: "pending" | "approved" | "declined";
  hr_note: string | null;
}

export default function RequestCenter() {
  const [requests, setRequests] = useState<LeaveWFHRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<"leave" | "wfh">("leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ total: number; requests: LeaveWFHRequest[] }>("/requests");
      setRequests(res.requests);
    } catch (err: any) {
      setError(err?.message || "Failed to load requests list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    try {
      setBtnLoading(true);
      setError(null);
      setSuccess(null);

      await api.post("/requests", {
        request_type: type,
        start_date: startDate,
        end_date: endDate,
        employee_note: note.trim() || null,
      });

      setStartDate("");
      setEndDate("");
      setNote("");
      setSuccess("Your leave / WFH segment request has been submitted successfully!");
      await fetchRequests();
    } catch (err: any) {
      setError(err?.message || "Failed to submit request.");
    } finally {
      setBtnLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
      case "declined":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Declined</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
    }
  };

  return (
    <TeamsShell title="Leave & WFH Request Center">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">Time & Work Arrangement Allocations</h1>
        <p className="text-sm text-slate-400 mt-1">File a new Leave or WFH allocation slot. HR will be notified to review and sign off on your request.</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Request Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
          <h3 className="text-md font-bold text-slate-100 mb-4">🗓️ Submit New Request</h3>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-semibold text-slate-400" htmlFor="reqType">Allocation Type</label>
              <select
                id="reqType"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2.5 text-sm text-slate-100 transition-all outline-none"
                value={type}
                onChange={(e) => setType(e.target.value as "leave" | "wfh")}
                disabled={btnLoading}
              >
                <option value="leave">🏝️ Leave / Vacation</option>
                <option value="wfh">🏠 Work From Home</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400" htmlFor="startDate">Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={btnLoading}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400" htmlFor="endDate">End Date</label>
                <input
                  id="endDate"
                  type="date"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={btnLoading}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs font-semibold text-slate-400" htmlFor="note">Optional Employee Note</label>
              <textarea
                id="note"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none min-h-[80px]"
                placeholder="Reason or notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={btnLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl"
              disabled={btnLoading}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Submit Allocation"
              )}
            </button>
          </form>
        </div>

        {/* List of past requests */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-md font-bold text-slate-100 mb-4">📂 Filed Arrangement History</h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-3xl block mb-2">📂</span>
              <p className="text-sm">No filed requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/20">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Time Period</th>
                    <th className="py-3 px-4">Employee Note</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">HR Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors odd:bg-slate-950/10">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">
                        {req.request_type === "leave" ? "🏝️ Leave" : "🏠 WFH"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {req.start_date} to {req.end_date}
                      </td>
                      <td className="py-3.5 px-4 text-xs">{req.employee_note || "—"}</td>
                      <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                      <td className="py-3.5 px-4 text-xs">
                        {req.hr_note ? (
                          <div className="text-slate-300">
                            <strong className="text-slate-500 font-semibold">HR:</strong> {req.hr_note}
                          </div>
                        ) : (
                          <span className="text-slate-500">Pending Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TeamsShell>
  );
}
