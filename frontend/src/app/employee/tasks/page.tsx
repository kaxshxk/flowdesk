"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface Task {
  id: number;
  description: string;
  timestamp: string;
  hmac_hash: string;
  google_sheet_id: string | null;
}

export default function EmployeeTaskTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [desc, setDesc] = useState("");
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ total: number; tasks: Task[] }>("/tasks");
      setTasks(res.tasks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load task ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskDetails = desc.trim();
    if (!taskDetails) return;

    try {
      setBtnLoading(true);
      setError(null);
      setSuccess(null);

      // Backend expects description string.
      // Append date information to description if customized from today, or keep clean.
      const dateText = taskDate !== new Date().toISOString().split("T")[0] ? ` [Date: ${taskDate}]` : "";
      const payload = `${taskDetails}${dateText}`;

      const res = await api.post<Task>("/tasks", {
        description: payload,
      });

      // Reset text inputs and prepend newly created task
      setDesc("");
      setSuccess("Task successfully signed, logged, and appended to your Google Sheets ledger!");
      setTasks((prev) => [res, ...prev]);
    } catch (err: any) {
      setError(err?.message || "Failed to submit task. Please check sheets connection.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <TeamsShell title="Task Tracker Terminal">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">Daily Activity Ledger</h1>
        <p className="text-sm text-slate-400 mt-1">Log tasks below. Signatures are automatically verified and sealed into the ledger.</p>
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

      {/* Two-section Workspace view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Form Banner card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit shadow-md">
          <h3 className="text-md font-bold text-slate-100 mb-4">✍️ Log Daily Task</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="taskDetails">
                What task did you accomplish today?
              </label>
              <textarea
                id="taskDetails"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none min-h-[110px] resize-none"
                placeholder="Describe your task accomplishments here..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                disabled={btnLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="taskDateSelect">
                Task Execution Date
              </label>
              <input
                id="taskDateSelect"
                type="date"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                disabled={btnLoading}
                required
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
                "Log Task to Spreadsheet"
              )}
            </button>

          </form>
        </div>

        {/* Bottom Activity History Section table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-md font-bold text-slate-100 mb-4">📋 Running Activity Ledger</h3>
          
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-slate-800 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-slate-800 rounded animate-pulse"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <span className="text-3xl block">📋</span>
              <p className="text-sm">No activity logs found for your profile yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/20">
                    <th className="py-3 px-4">Date/Timestamp</th>
                    <th className="py-3 px-4">Task Description</th>
                    <th className="py-3 px-4 text-right">Security Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-800/40 transition-colors odd:bg-slate-950/10">
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {new Date(task.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-200">{task.description}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                          🔒 HMAC Sealed
                        </span>
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
