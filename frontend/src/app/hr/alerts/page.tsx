"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface AlertLog {
  id: number;
  user_id: number;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  description: string;
  resolved: boolean;
  timestamp: string;
}

export default function HRAlerts() {
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ total: number; alerts: AlertLog[] }>("/hr/alerts");
      setAlerts(res.alerts);
    } catch (err: any) {
      setError(err?.message || "Failed to load alerts feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleResolve = async (alertId: number) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.post(`/hr/alerts/${alertId}/resolve`);
      
      setSuccess("Alert marked as resolved.");
      await fetchAlerts();
    } catch (err: any) {
      setError(err?.message || "Failed to resolve alert.");
    } finally {
      setActionLoading(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Critical</span>;
      case "warning":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Warning</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Info</span>;
    }
  };

  return (
    <TeamsShell title="System Audit Logs & Alerts">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Real-Time Security Auditing</h1>
        <p className="text-sm text-slate-400 mt-1">Monitor activity audits and cryptographic integrity warnings. Resolve alerts as they are investigated.</p>
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

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-md font-bold text-slate-100 mb-4">🚨 Operations Log Feed</h3>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-3/4"></div>
            <div className="h-4 bg-slate-800 rounded"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <span className="text-3xl block mb-2">🛡️</span>
            <p className="text-sm font-semibold text-slate-400">System clean.</p>
            <p className="text-xs text-slate-500">No security alerts or warnings logged.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {alerts.map((alert) => (
                  <tr key={alert.id} className={`hover:bg-slate-800/40 transition-colors ${alert.resolved ? "opacity-50" : "opacity-100"}`}>
                    <td className="py-3.5 px-4">{getSeverityBadge(alert.severity)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">{new Date(alert.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-semibold">User #{alert.user_id}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                        {alert.alert_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[280px] truncate text-xs text-slate-300" title={alert.description}>
                      {alert.description}
                    </td>
                    <td className="py-3.5 px-4">
                      {alert.resolved ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-500">Resolved</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Active Warning</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                          disabled={actionLoading}
                        >
                          Resolve
                        </button>
                      )}
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
