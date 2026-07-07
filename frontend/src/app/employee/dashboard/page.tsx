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
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText font-sans">Productivity Time Terminal</h1>
        <p className="text-sm text-contrastText/60 mt-1">Clock in for your shifts and monitor hourly accomplishments.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-primaryAccent rounded-2xl text-sm text-canvasBg font-medium">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="h-80 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl animate-pulse"></div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-36 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl animate-pulse"></div>
            <div className="h-36 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Time Clock Interface Card */}
          <div className="bg-sidebarBacking rounded-3xl p-8 flex flex-col justify-between items-center text-center relative overflow-hidden min-h-[360px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-primaryAccent" />
            
            <div className="space-y-3 w-full">
              <h3 className="text-lg font-extrabold text-canvasBg tracking-tight">Time Clock Terminal</h3>
              <p className="text-xs text-canvasBg/50 leading-relaxed px-4">
                Verify your parameters and record shift timings. Double punches are automatically prevented.
              </p>
            </div>

            {/* Pulsing timer indicator */}
            {isClockedIn && lastClockIn && (
              <div className="my-6 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-primaryAccent text-canvasBg animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-canvasBg" />
                  Active Shift · In since {getStartDateString()}
                </div>
                <div className="text-2xl font-extrabold text-softHighlight font-mono tracking-tight">
                  {elapsedTime || "Calculating..."}
                </div>
              </div>
            )}

            {!isClockedIn && (
              <div className="my-6">
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-canvasBg/10 text-canvasBg">
                  <span className="w-2 h-2 rounded-full bg-successBadge" />
                  Ready to punch in
                </div>
              </div>
            )}

            <button
              onClick={handleClockToggle}
              disabled={btnLoading}
              className={`w-full flex items-center justify-center gap-2 py-4 font-bold text-sm rounded-2xl transition-all duration-150 active:scale-[0.96] ${
                isClockedIn
                  ? "bg-primaryAccent text-canvasBg hover:bg-primaryAccent/90"
                  : "bg-successBadge text-contrastText hover:bg-successBadge/90"
              } disabled:opacity-50`}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : isClockedIn ? (
                <span>Clock Out of Shift</span>
              ) : (
                <span>Clock In for Shift</span>
              )}
            </button>
          </div>

          {/* Aggregated Statistics Panels */}
          <div className="lg:col-span-2 flex flex-col gap-5 justify-between">
            {/* Card 1: Weekly metrics */}
            <div className="bg-successBadge rounded-3xl p-6 md:p-8 flex flex-col justify-between flex-1 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-contrastText/5 rounded-full -mb-8 -mr-8" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase text-contrastText/70 tracking-wider">Weekly Shift Summary</h4>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-contrastText/10 text-contrastText font-semibold">Goal: 40 hrs</span>
                </div>
                <div className="text-3xl font-extrabold text-contrastText tracking-tight mb-2">
                  {stats.weekly_hours} <span className="text-xs text-contrastText/60 font-normal">hours logged</span>
                </div>
                <p className="text-xs text-contrastText/50 mb-6">Calculated for the current active workweek window (Mon - Sun).</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-semibold text-contrastText/60">
                  <span>Weekly Goal Completion</span>
                  <span>{Math.round(weeklyProgressPercent)}%</span>
                </div>
                <div className="w-full h-3 bg-contrastText/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primaryAccent rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${weeklyProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Monthly hours */}
            <div className="bg-softHighlight rounded-3xl p-6 md:p-8 flex items-center justify-between flex-1 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-contrastText/5 rounded-full -mb-8 -mr-8" />
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase text-contrastText/70 tracking-wider">Monthly Shift Summary</h4>
                <div className="text-3xl font-extrabold text-contrastText tracking-tight">
                  {stats.monthly_hours} <span className="text-xs text-contrastText/60 font-normal">hours logged</span>
                </div>
                <p className="text-xs text-contrastText/50">Accumulated metrics computed across the current calendar month.</p>
              </div>
              <div className="w-14 h-14 bg-primaryAccent rounded-2xl flex items-center justify-center text-canvasBg shrink-0 shadow-md">
                ◑
              </div>
            </div>
          </div>

        </div>
      )}
    </TeamsShell>
  );
}
