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

export default function TaskLedger() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ total: number; tasks: Task[] }>("/tasks");
      setTasks(res.tasks);
    } catch (err: any) {
      setError(err?.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;

    try {
      setBtnLoading(true);
      setError(null);
      setSuccess(null);
      
      await api.post("/tasks", { description: desc.trim() });
      
      setDesc("");
      setSuccess("Task successfully signed, logged, and appended to your Google Sheets ledger!");
      await fetchTasks();
    } catch (err: any) {
      setError(err?.message || "Failed to submit task.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <TeamsShell title="Task Ledger & HMAC Verification">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Task Logging & HMAC Security</h1>
        <p className="text-sm text-slate-400 mt-1">Log your daily activities. Every task is cryptographically signed with SHA-256 to ensure authenticity and integrity.</p>
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
        {/* Creation Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
          <h3 className="text-md font-bold text-slate-100 mb-4">✍️ Log Daily Task</h3>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-semibold text-slate-400" htmlFor="taskDesc">Task Details</label>
              <textarea
                id="taskDesc"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none min-h-[120px]"
                placeholder="Detail what you accomplished..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
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
                "Sign & Log Task"
              )}
            </button>
          </form>
        </div>

        {/* Ledger view */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-md font-bold text-slate-100 mb-4">🗝️ Audited Ledger Activity</h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-3xl block mb-2">📂</span>
              <p className="text-sm">No logged tasks found on your ledger.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Task Description</th>
                    <th className="py-3 px-4">Sheet Sync</th>
                    <th className="py-3 px-4">HMAC (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-slate-400">{new Date(task.timestamp).toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-semibold">{task.description}</td>
                      <td className="py-3.5 px-4">
                        {task.google_sheet_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Sheet ID: ${task.google_sheet_id}`}>Synced</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Local Log</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-400" title={task.hmac_hash}>
                        {task.hmac_hash.substring(0, 16)}...
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
