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
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]">Critical</span>;
      case "warning":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">Warning</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">Info</span>;
    }
  };

  return (
    <TeamsShell title="System Audit Logs & Alerts">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1E293B]">Real-Time Security Auditing</h1>
        <p className="text-sm text-slate-500 mt-1">Monitor activity audits and cryptographic integrity warnings. Resolve alerts as they are investigated.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl text-sm text-[#E11D48]">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-sm text-[#047857]">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="bg-white border border-[#F1F5F9] rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        <h3 className="text-base font-bold text-[#1E293B] mb-6 flex items-center gap-2">
          <span>🚨</span> Operations Log Feed
        </h3>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
            <div className="h-4 bg-slate-100 rounded"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <span className="text-3xl block mb-2">🛡️</span>
            <p className="text-sm font-semibold text-slate-700">System clean.</p>
            <p className="text-xs text-slate-400">No security alerts or warnings logged.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-slate-600">
                {alerts.map((alert) => (
                  <tr key={alert.id} className={`hover:bg-slate-50/50 transition-colors duration-200 ${alert.resolved ? "opacity-50" : "opacity-100"}`}>
                    <td className="py-3.5 px-4">{getSeverityBadge(alert.severity)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">{new Date(alert.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#1E293B]">User #{alert.user_id}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF] capitalize">
                        {alert.alert_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[280px] truncate text-xs text-slate-600 font-medium" title={alert.description}>
                      {alert.description}
                    </td>
                    <td className="py-3.5 px-4">
                      {alert.resolved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200/50">Resolved</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] animate-pulse">Active Warning</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3 py-1.5 bg-[#EEF2FF] border border-[#E0E7FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-xs font-semibold rounded-lg transition-all active:scale-[0.97] duration-200"
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
