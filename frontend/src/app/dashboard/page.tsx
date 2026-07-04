"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface TimeLog {
  id: number;
  clock_in: string;
  clock_out: string | null;
}

export default function EmployeeDashboard() {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ total: number; logs: TimeLog[] }>("/time");
      setLogs(res.logs);
      
      const active = res.logs.find((log) => !log.clock_out);
      setActiveLog(active || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load time logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeLogs();
  }, []);

  const handleClockAction = async () => {
    try {
      setActionLoading(true);
      setError(null);
      
      if (activeLog) {
        await api.post(`/time/clock-out`);
      } else {
        await api.post("/time/clock-in");
      }
      
      await fetchTimeLogs();
    } catch (err: any) {
      setError(err?.message || "Time log update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const calculateDuration = (inStr: string, outStr: string) => {
    const start = new Date(inStr).getTime();
    const end = new Date(outStr).getTime();
    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHrs}h ${diffMins}m`;
  };

  return (
    <TeamsShell title="Employee Productivity Dashboard">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Welcome Back</h1>
        <p className="text-sm text-slate-400 mt-1">Monitor your shift status, clock hours, and track logged productivity history.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Clocking Interface */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 mb-8 bg-slate-900 border border-slate-800 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            Shift Status: {activeLog ? <span className="text-emerald-400">Clocked In</span> : <span className="text-slate-400">Clocked Out</span>}
          </h2>
          <p className="text-xs text-slate-400">
            {activeLog 
              ? `Shift started at ${formatDateTime(activeLog.clock_in)}` 
              : "Ready to start your work segment. Please clock in to start."}
          </p>
        </div>

        <button
          onClick={handleClockAction}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
            activeLog 
              ? "bg-red-600 hover:bg-red-500 shadow-red-600/10 text-white" 
              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/15 text-white"
          }`}
          disabled={actionLoading || loading}
        >
          {actionLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : activeLog ? (
            "Clock Out Shift"
          ) : (
            "Clock In Shift"
          )}
        </button>
      </div>

      {/* History Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-md font-bold text-slate-100 mb-4">🕒 Time Logs History</h3>
        {loading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded"></div>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <span className="text-3xl block mb-2">📅</span>
            <p className="text-sm">No logged sessions found. Clock in to begin recording productivity segments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Clock In</th>
                  <th className="py-3 px-4">Clock Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold">{formatDateTime(log.clock_in)}</td>
                    <td className="py-3.5 px-4">{log.clock_out ? formatDateTime(log.clock_out) : "—"}</td>
                    <td className="py-3.5 px-4">
                      {log.clock_out ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">Completed</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active Shift</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{log.clock_out ? calculateDuration(log.clock_in, log.clock_out) : "—"}</td>
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
