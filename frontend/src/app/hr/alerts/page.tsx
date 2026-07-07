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
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-canvasBg text-primaryAccent border border-primaryAccent/30">Critical</span>;
      case "warning":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-softHighlight/40 text-contrastText border border-softHighlight">Warning</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-canvasBg text-primaryAccent border border-secondaryElement/30">Info</span>;
    }
  };

  return (
    <TeamsShell title="System Audit Logs & Alerts">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText">Real-Time Security Auditing</h1>
        <p className="text-sm text-contrastText/40 mt-1">Monitor activity audits and cryptographic integrity warnings. Resolve alerts as they are investigated.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-primaryAccent/15 rounded-2xl text-sm text-primaryAccent">
          <span></span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-successBadge/20 rounded-2xl text-sm text-successBadge">
          <span></span>
          <span>{success}</span>
        </div>
      )}

      <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 border-secondaryElement/20 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        <h3 className="text-base font-bold text-contrastText mb-6 flex items-center gap-2">
          <span></span> Operations Log Feed
        </h3>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-canvasBg rounded w-3/4"></div>
            <div className="h-4 bg-canvasBg rounded"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-contrastText/40">
            <span className="text-3xl block mb-2"></span>
            <p className="text-sm font-semibold text-contrastText">System clean.</p>
            <p className="text-xs text-contrastText/60">No security alerts or warnings logged.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-secondaryElement/20 text-contrastText/60 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondaryElement/15 text-contrastText/60">
                {alerts.map((alert) => (
                  <tr key={alert.id} className={`hover:bg-canvasBg/50 transition-colors duration-200 ${alert.resolved ? "opacity-50" : "opacity-100"}`}>
                    <td className="py-3.5 px-4">{getSeverityBadge(alert.severity)}</td>
                    <td className="py-3.5 px-4 text-xs text-contrastText/60">{new Date(alert.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-semibold text-contrastText">User #{alert.user_id}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-canvasBg text-primaryAccent border border-secondaryElement/30 capitalize">
                        {alert.alert_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[280px] truncate text-xs text-contrastText/60 font-medium" title={alert.description}>
                      {alert.description}
                    </td>
                    <td className="py-3.5 px-4">
                      {alert.resolved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-canvasBg text-contrastText/40 border border-secondaryElement/40/50">Resolved</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-softHighlight/40 text-contrastText border border-softHighlight animate-pulse">Active Warning</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {!alert.resolved && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3 py-1.5 bg-canvasBg border border-secondaryElement/30 hover:bg-secondaryElement/20 text-primaryAccent text-xs font-semibold rounded-lg transition-all transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95 duration-200"
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
