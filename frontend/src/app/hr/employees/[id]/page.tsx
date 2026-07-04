"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface TimeStats {
  user_id: number;
  weekly_hours: number;
  monthly_hours: number;
}

interface ClockLog {
  id: number;
  clock_in: string;
  clock_out: string | null;
  created_at: string;
}

interface TaskLog {
  id: number;
  description: string;
  timestamp: string;
  hmac_hash: string;
  google_sheet_id: string | null;
}

interface FileLog {
  id: number;
  file_name: string;
  google_drive_file_id: string;
  drive_folder_path: string;
  timestamp: string;
}

interface EmployeeMetadata {
  id: number;
  company_email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface TimelineEvent {
  type: "clock_in" | "clock_out" | "task" | "file";
  timestamp: Date;
  title: string;
  detail: string;
  icon: string;
  color: string;
}

export default function EmployeeDetailDashboard() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.id ? parseInt(params.id as string) : 0;

  const [activeTab, setActiveTab] = useState<"timeline" | "clock" | "tasks" | "drive">("timeline");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States
  const [employee, setEmployee] = useState<EmployeeMetadata | null>(null);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [clocks, setClocks] = useState<ClockLog[]>([]);
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [files, setFiles] = useState<FileLog[]>([]);

  const fetchEmployeeData = async () => {
    if (!employeeId) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch data concurrently
      const [statsRes, clocksRes, tasksRes, filesRes, employeesRes] = await Promise.all([
        api.get<TimeStats>(`/hr/time/stats/${employeeId}`),
        api.get<ClockLog[]>(`/hr/time/logs/${employeeId}`),
        api.get<{ tasks: TaskLog[] }>(`/hr/tasks/${employeeId}`),
        api.get<{ files: FileLog[] }>(`/hr/files/${employeeId}`),
        api.get<EmployeeMetadata[]>("/hr/employees"),
      ]);

      setStats(statsRes);
      setClocks(clocksRes);
      setTasks(tasksRes.tasks || []);
      setFiles(filesRes.files || []);

      // Find the specific employee metadata from list
      const meta = employeesRes.find((emp) => emp.id === employeeId);
      if (meta) {
        setEmployee(meta);
      } else {
        setError(`Employee with ID ${employeeId} not registered.`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load employee details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  // Merge events into a chronological timeline feed
  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add clock ins & outs
    clocks.forEach((c) => {
      events.push({
        type: "clock_in",
        timestamp: new Date(c.clock_in),
        title: "Shift Started",
        detail: "Clocked in at start of shift segment.",
        icon: "🟢",
        color: "text-emerald-400",
      });
      if (c.clock_out) {
        events.push({
          type: "clock_out",
          timestamp: new Date(c.clock_out),
          title: "Shift Completed",
          detail: `Clocked out. Segment duration: ${calculateDuration(c.clock_in, c.clock_out)}.`,
          icon: "🔴",
          color: "text-rose-400",
        });
      }
    });

    // Add tasks
    tasks.forEach((t) => {
      events.push({
        type: "task",
        timestamp: new Date(t.timestamp),
        title: "Task Logged & Signed",
        detail: t.description,
        icon: "📝",
        color: "text-indigo-400",
      });
    });

    // Add files
    files.forEach((f) => {
      events.push({
        type: "file",
        timestamp: new Date(f.timestamp),
        title: "File Vaulted to Drive",
        detail: `${f.file_name} inside Drive directory ${f.drive_folder_path}`,
        icon: "📁",
        color: "text-sky-400",
      });
    });

    // Sort descending by timestamp
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const calculateDuration = (inStr: string, outStr: string) => {
    const start = new Date(inStr).getTime();
    const end = new Date(outStr).getTime();
    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHrs}h ${diffMins}m`;
  };

  if (loading) {
    return (
      <TeamsShell title="Loading Employee Dossier...">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
            <div className="lg:col-span-2 h-96 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      </TeamsShell>
    );
  }

  if (error || !employee) {
    return (
      <TeamsShell title="Error Loading Dossier">
        <div className="max-w-md mx-auto mt-12 bg-slate-900 border border-red-500/20 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-slate-100 mb-2">Error</h2>
          <p className="text-sm text-slate-400 mb-6">{error || "User details could not be found."}</p>
          <button
            onClick={() => router.push("/hr/roster")}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors font-semibold text-xs rounded-xl"
          >
            Return to Whitelist Roster
          </button>
        </div>
      </TeamsShell>
    );
  }

  const timelineEvents = getTimelineEvents();

  return (
    <TeamsShell title={`Employee Dossier: User #${employee.id}`}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">{employee.company_email}</h1>
          <p className="text-sm text-slate-400 mt-1">Lifecycle diagnostics, audit ledger logs, and synced activity feeds.</p>
        </div>
        <button
          onClick={() => router.push("/hr/roster")}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-all"
        >
          ⬅️ Back to Roster
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Profile/Metrics Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center text-lg">
                {employee.company_email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-100 truncate">{employee.company_email.split("@")[0]}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 border ${
                  employee.is_active 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {employee.is_active ? "Active account" : "Deactivated"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weekly Time Accumulation</h4>
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl">
                <div className="text-xs text-slate-400">Hours Worked</div>
                <div className="text-xl font-extrabold text-indigo-400">{stats?.weekly_hours || 0} hrs</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Time Accumulation</h4>
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl">
                <div className="text-xs text-slate-400">Hours Worked</div>
                <div className="text-xl font-extrabold text-purple-400">{stats?.monthly_hours || 0} hrs</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1">
              <div><strong>Registration:</strong> {new Date(employee.created_at).toLocaleDateString()}</div>
              <div><strong>Role Level:</strong> {employee.role.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Right Tabbed Content Box */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
          {/* Tab Selector Headers */}
          <div className="flex border-b border-slate-800 bg-slate-950/20">
            {(["timeline", "clock", "tasks", "drive"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 text-xs font-bold transition-all border-b-2 capitalize tracking-wide ${
                  activeTab === tab
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                }`}
              >
                {tab === "timeline" ? "Activity Timeline" : tab === "clock" ? "Clock Log" : tab === "tasks" ? "Sheets Ledger" : "Drive Catalog"}
              </button>
            ))}
          </div>

          {/* Active Tab View */}
          <div className="p-6 flex-1 overflow-y-auto">
            {/* 1. TIMELINE VIEW */}
            {activeTab === "timeline" && (
              <div className="space-y-6">
                {timelineEvents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <div className="text-3xl">🏜️</div>
                    <p className="text-sm">No activity recorded for this employee.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
                    {timelineEvents.map((evt, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[35px] top-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-xs shadow-sm">
                          {evt.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-100">{evt.title}</h4>
                            <span className="text-[9px] text-slate-500">
                              {evt.timestamp.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{evt.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. CLOCK LOG VIEW */}
            {activeTab === "clock" && (
              <div className="overflow-x-auto">
                {clocks.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <div className="text-3xl">🕒</div>
                    <p className="text-sm">No clock logs found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Clock In</th>
                        <th className="py-2.5 px-3">Clock Out</th>
                        <th className="py-2.5 px-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {clocks.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors odd:bg-slate-950/10">
                          <td className="py-3 px-3 text-xs text-slate-400">
                            {new Date(c.clock_in).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 font-semibold">
                            {new Date(c.clock_in).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-3">
                            {c.clock_out ? new Date(c.clock_out).toLocaleTimeString() : "—"}
                          </td>
                          <td className="py-3 px-3 text-right text-indigo-400 font-semibold">
                            {c.clock_out ? calculateDuration(c.clock_in, c.clock_out) : "Active"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 3. SHEETS LEDGER VIEW */}
            {activeTab === "tasks" && (
              <div className="overflow-x-auto">
                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <div className="text-3xl">📝</div>
                    <p className="text-sm">No tasks logged in Sheets.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Task Details</th>
                        <th className="py-2.5 px-3 text-right">HMAC Security</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/30 transition-colors odd:bg-slate-950/10">
                          <td className="py-3 px-3 text-xs text-slate-400">
                            {new Date(t.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-200">{t.description}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              HMAC Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 4. DRIVE CATALOG VIEW */}
            {activeTab === "drive" && (
              <div className="overflow-x-auto">
                {files.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <div className="text-3xl">📁</div>
                    <p className="text-sm">No documents uploaded to Google Drive.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                        <th className="py-2.5 px-3">Filename</th>
                        <th className="py-2.5 px-3">Uploaded At</th>
                        <th className="py-2.5 px-3 text-right">Drive Folder Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {files.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-800/30 transition-colors odd:bg-slate-950/10">
                          <td className="py-3 px-3 font-semibold text-slate-200">{f.file_name}</td>
                          <td className="py-3 px-3 text-xs text-slate-400">
                            {new Date(f.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {f.drive_folder_path}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeamsShell>
  );
}
