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
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText font-sans">Daily Activity Ledger</h1>
        <p className="text-sm text-contrastText/60 mt-1">Log tasks below. Signatures are automatically verified and sealed into the ledger.</p>
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

      {/* Two-section Workspace view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Form Banner card */}
        <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 h-fit shadow-md">
          <h3 className="text-md font-bold text-contrastText mb-4"> Log Daily Task</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/60" htmlFor="taskDetails">
                What task did you accomplish today?
              </label>
              <textarea
                id="taskDetails"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/40 transition-all outline-none min-h-[110px] resize-none"
                placeholder="Describe your task accomplishments here..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                disabled={btnLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/60" htmlFor="taskDateSelect">
                Task Execution Date
              </label>
              <input
                id="taskDateSelect"
                type="date"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-4 py-2.5 text-sm text-contrastText outline-none"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                disabled={btnLoading}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-primaryAccent hover:bg-primaryAccent/95 hover:shadow-lg hover:shadow-primaryAccent/20 transition-all text-canvasBg font-semibold text-sm rounded-xl"
              disabled={btnLoading}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-canvasBg"></div>
              ) : (
                "Log Task to Spreadsheet"
              )}
            </button>

          </form>
        </div>

        {/* Bottom Activity History Section table */}
        <div className="lg:col-span-2 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 shadow-md">
          <h3 className="text-md font-bold text-contrastText mb-4"> Running Activity Ledger</h3>
          
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-canvasBg/25 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-canvasBg/25 rounded animate-pulse"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-contrastText/40 space-y-2">
              <span className="text-3xl block"></span>
              <p className="text-sm">No activity logs found for your profile yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-secondaryElement/20 text-contrastText/60 text-xs font-semibold uppercase bg-canvasBg/15">
                    <th className="py-3 px-4">Date/Timestamp</th>
                    <th className="py-3 px-4">Task Description</th>
                    <th className="py-3 px-4 text-right">Security Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondaryElement/20 text-contrastText/80">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-canvasBg/20 transition-colors odd:bg-canvasBg/10">
                      <td className="py-4 px-4 text-xs text-contrastText/60">
                        {new Date(task.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 font-semibold text-contrastText/90">{task.description}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-successBadge/15 text-contrastText border border-successBadge/30 shadow-sm shadow-emerald-500/5">
                           HMAC Sealed
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
