"use client";

import React, { useState, useEffect, useRef } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface TimeStats {
  weekly_hours: number;
  monthly_hours: number;
}

interface TimeStatus {
  is_clocked_in: boolean;
  last_clock_in: string | null;
}

interface TimeLog {
  id: number;
  user_id: number;
  clock_in: string;
  clock_out: string | null;
  created_at: string;
}

export default function EmployeeDashboard() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockIn, setLastClockIn] = useState<string | null>(null);
  const [stats, setStats] = useState<TimeStats>({ weekly_hours: 0, monthly_hours: 0 });
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, statsRes] = await Promise.all([
        api.get<TimeStatus>("/time/status"),
        api.get<TimeStats>("/time/stats"),
      ]);

      setIsClockedIn(statusRes.is_clocked_in);
      setLastClockIn(statusRes.last_clock_in);
      setStats(statsRes);
    } catch (err: any) {
      setError(err?.message || "Failed to sync time clock parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Real-time elapsed session counter interval logic
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isClockedIn && lastClockIn) {
      const updateTimer = () => {
        const start = new Date(lastClockIn).getTime();
        const now = new Date().getTime();
        const diffMs = now - start;

        if (isNaN(diffMs) || diffMs < 0) {
          setElapsedTime("0 hrs 0 mins 0 secs");
          return;
        }

        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);

        setElapsedTime(`${hrs} hrs ${mins} mins ${secs} secs`);
      };

      updateTimer(); // Initial call
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime("");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isClockedIn, lastClockIn]);

  const handleClockToggle = async () => {
    try {
      setBtnLoading(true);
      setError(null);

      if (isClockedIn) {
        // Clock Out action
        await api.post("/time/clock-out");
        setIsClockedIn(false);
        setLastClockIn(null);
      } else {
        // Clock In action
        const clockRes = await api.post<TimeLog>("/time/clock-in");
        setIsClockedIn(true);
        setLastClockIn(clockRes.clock_in);
      }

      // Immediately refresh stats on status toggle
      const statsRes = await api.get<TimeStats>("/time/stats");
      setStats(statsRes);
    } catch (err: any) {
      setError(err?.message || "Failed to update clock status.");
    } finally {
      setBtnLoading(false);
    }
  };

  const getStartDateString = () => {
    if (!lastClockIn) return "";
    return new Date(lastClockIn).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const weeklyProgressPercent = Math.min((stats.weekly_hours / 40) * 100, 100);

  return (
    <TeamsShell title="Employee Terminal Dashboard">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">Productivity Time Terminal</h1>
        <p className="text-sm text-slate-400 mt-1">Clock in for your shifts and monitor hourly accomplishments.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="h-80 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-36 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
            <div className="h-36 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Time Clock Interface Card */}
          <div className="bg-white border border-[#F1F5F9] rounded-3xl p-8 flex flex-col justify-between items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden min-h-[360px]">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#4F46E5] to-[#818CF8]"></div>
            
            <div className="space-y-3 w-full">
              <span className="text-4xl block">🕒</span>
              <h3 className="text-lg font-extrabold text-[#1E293B] tracking-tight">Time Clock Terminal</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                Verify your parameters and record shift timings. Double punches are automatically prevented.
              </p>
            </div>

            {/* Pulsing timer indicator */}
            {isClockedIn && lastClockIn && (
              <div className="my-6 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-semibold bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-[#E11D48]"></span>
                  Active Shift (Punch-in: {getStartDateString()})
                </div>
                <div className="text-2xl font-extrabold text-[#E11D48] font-mono tracking-tight">
                  {elapsedTime || "Calculating..."}
                </div>
              </div>
            )}

            {!isClockedIn && (
              <div className="my-6 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                  <span className="w-2 h-2 rounded-full bg-[#047857]"></span>
                  Ready to punch in
                </div>
              </div>
            )}

            <button
              onClick={handleClockToggle}
              disabled={btnLoading}
              className={`w-full flex items-center justify-center gap-2 py-4 font-bold text-sm rounded-xl transition-all active:scale-[0.97] duration-200 ease-out shadow-sm border ${
                isClockedIn
                  ? "bg-[#FFF1F2] border-[#FECDD3] hover:bg-[#FFE4E6] text-[#E11D48]"
                  : "bg-[#ECFDF5] border-[#A7F3D0] hover:bg-[#D1FAE5] text-[#047857]"
              } disabled:opacity-50`}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : isClockedIn ? (
                <>
                  <span>🛑</span>
                  <span>Clock Out of Shift</span>
                </>
              ) : (
                <>
                  <span>▶️</span>
                  <span>Clock In for Shift</span>
                </>
              )}
            </button>
          </div>

          {/* Aggregated Statistics Panels */}
          <div className="lg:col-span-2 flex flex-col gap-6 justify-between">
            {/* Card 1: Weekly metrics with work week progress meter */}
            <div className="bg-white border border-[#F1F5F9] rounded-3xl p-6 md:p-8 flex flex-col justify-between flex-1 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Weekly Shift Summary</h4>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF] font-semibold">Goal: 40 hrs</span>
                </div>
                <div className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-2">
                  {stats.weekly_hours} <span className="text-xs text-slate-400 font-normal">hours logged</span>
                </div>
                <p className="text-xs text-slate-500 mb-6">Calculated for the current active workweek window (Mon - Sun).</p>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>Weekly Goal Completion</span>
                  <span>{Math.round(weeklyProgressPercent)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div
                    className="h-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${weeklyProgressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Card 2: Monthly Accumulated hours */}
            <div className="bg-white border border-[#F1F5F9] rounded-3xl p-6 md:p-8 flex items-center justify-between flex-1 shadow-[0_8px_30px_rgb(0,0,0,0.015)] relative overflow-hidden">
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Monthly Shift Summary</h4>
                <div className="text-3xl font-extrabold text-[#1E293B] tracking-tight">
                  {stats.monthly_hours} <span className="text-xs text-slate-400 font-normal">hours logged</span>
                </div>
                <p className="text-xs text-slate-500">Accumulated metrics computed across the current calendar month.</p>
              </div>
              <div className="w-12 h-12 bg-[#EEF2FF] border border-[#E0E7FF] rounded-xl flex items-center justify-center text-xl text-[#4F46E5] shrink-0 shadow-sm shadow-[#EEF2FF]/50">
                📅
              </div>
            </div>

          </div>

        </div>
      )}
    </TeamsShell>
  );
}
