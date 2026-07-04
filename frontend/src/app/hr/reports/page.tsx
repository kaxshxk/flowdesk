"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface PayrollItem {
  user_id: number;
  company_email: string;
  total_hours_worked: number;
  approved_leave_days: number;
  approved_wfh_days: number;
  tasks_logged_count: number;
}

export default function HRReports() {
  const [records, setRecords] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = "/hr/reports/payroll?format=json";
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const res = await api.get<{ records: PayrollItem[] }>(query);
      setRecords(res.records);
    } catch (err: any) {
      setError(err?.message || "Failed to compile payroll report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const triggerBlobDownload = async () => {
    try {
      let query = "/hr/reports/payroll?format=csv";
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const blob = await api.get<Blob>(query);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll_report_${startDate || "all"}_to_${endDate || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to download CSV report.");
    }
  };

  return (
    <TeamsShell title="Payroll & Compliance Reports">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Payroll & Operations Compliance Reporting</h1>
        <p className="text-sm text-slate-400 mt-1">Aggregate regular hours worked, approved vacation schedules, work-from-home sessions, and verified tasks logged.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filter panel */}
      <div className="flex flex-wrap items-end gap-4 p-6 mb-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
          <label className="text-xs font-semibold text-slate-400" htmlFor="repStart">Start Date</label>
          <input
            id="repStart"
            type="date"
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
          <label className="text-xs font-semibold text-slate-400" htmlFor="repEnd">End Date</label>
          <input
            id="repEnd"
            type="date"
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchReport}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all"
          >
            🔍 Compile Report
          </button>
          <button
            onClick={triggerBlobDownload}
            className="px-5 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-200 text-slate-300 font-semibold text-sm rounded-xl transition-all"
          >
            📥 Download CSV
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-md font-bold text-slate-100 mb-4">📊 Aggregated Employee Overview</h3>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-3/4"></div>
            <div className="h-4 bg-slate-800 rounded"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <span className="text-3xl block mb-2">📊</span>
            <p className="text-sm">No employee records found matching selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Company Email</th>
                  <th className="py-3 px-4">Hours Logged</th>
                  <th className="py-3 px-4">Approved Leaves</th>
                  <th className="py-3 px-4">Approved WFH</th>
                  <th className="py-3 px-4">Tasks Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {records.map((rec) => (
                  <tr key={rec.user_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-100">User #{rec.user_id}</td>
                    <td className="py-3.5 px-4">{rec.company_email}</td>
                    <td className="py-3.5 px-4 font-bold text-indigo-400">{rec.total_hours_worked} hrs</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{rec.approved_leave_days} days</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">{rec.approved_wfh_days} days</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{rec.tasks_logged_count} entries</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeamsShell>
  );
}
