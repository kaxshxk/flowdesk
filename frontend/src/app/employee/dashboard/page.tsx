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

// ── Stat card component ────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  unit,
  sub,
  accent,
  icon,
  delay = 0,
}: {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={`bg-white border border-gray-100 rounded-2xl p-5 card-lift animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold text-contrastText tracking-tight animate-count-up">{value}</span>
          {unit && <span className="text-[12px] text-gray-400 font-medium">{unit}</span>}
        </div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function EmployeeDashboard() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockIn, setLastClockIn] = useState<string | null>(null);
  const [stats, setStats] = useState<TimeStats>({ weekly_hours: 0, monthly_hours: 0 });
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState("");
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (isClockedIn && lastClockIn) {
      const updateTimer = () => {
        const start = new Date(lastClockIn).getTime();
        const now = new Date().getTime();
        const diffMs = now - start;
        if (isNaN(diffMs) || diffMs < 0) { setElapsedTime("0:00:00"); return; }
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setElapsedTime(`${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime("");
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isClockedIn, lastClockIn]);

  const handleClockToggle = async () => {
    try {
      setBtnLoading(true);
      setError(null);
      if (isClockedIn) {
        await api.post("/time/clock-out");
        setIsClockedIn(false);
        setLastClockIn(null);
      } else {
        const clockRes = await api.post<TimeLog>("/time/clock-in");
        setIsClockedIn(true);
        setLastClockIn(clockRes.clock_in);
      }
      const statsRes = await api.get<TimeStats>("/time/stats");
      setStats(statsRes);
    } catch (err: any) {
      setError(err?.message || "Failed to update clock status.");
    } finally {
      setBtnLoading(false);
    }
  };

  const getStartTimeString = () => {
    if (!lastClockIn) return "";
    return new Date(lastClockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const weeklyProgressPercent = Math.min((stats.weekly_hours / 40) * 100, 100);

  const skeletonCard = (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="skeleton w-9 h-9 rounded-xl mb-4" />
      <div className="skeleton h-8 w-1/2 rounded-lg mb-2" />
      <div className="skeleton h-3 w-2/3 rounded" />
    </div>
  );

  return (
    <TeamsShell title="Dashboard">
      {/* Page header */}
      <div className={`mb-8 ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-contrastText tracking-tight">My Workspace</h1>
            <p className="text-[13px] text-gray-500 mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold ${
            isClockedIn
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-gray-50 border-gray-200 text-gray-500"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isClockedIn ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
            {isClockedIn ? `On shift · since ${getStartTimeString()}` : "Off shift"}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-[12px] text-rose-700 font-medium animate-scale-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            {skeletonCard}{skeletonCard}{skeletonCard}{skeletonCard}
          </>
        ) : (
          <>
            <StatCard
              label="Weekly Hours"
              value={stats.weekly_hours}
              unit="hrs"
              sub="Goal: 40 hrs"
              accent="bg-indigo-50 text-primaryAccent"
              delay={0}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            />
            <StatCard
              label="Monthly Hours"
              value={stats.monthly_hours}
              unit="hrs"
              sub="Current month"
              accent="bg-violet-50 text-violet-600"
              delay={80}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            />
            <StatCard
              label="Week Progress"
              value={`${Math.round(weeklyProgressPercent)}%`}
              sub="of weekly goal"
              accent="bg-teal-50 text-teal-600"
              delay={160}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
            <StatCard
              label="Shift Status"
              value={isClockedIn ? "Active" : "Idle"}
              sub={isClockedIn ? elapsedTime : "Not clocked in"}
              accent={isClockedIn ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400"}
              delay={240}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            />
          </>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Time Clock Card */}
        <div className={`bg-white border border-gray-100 rounded-2xl p-6 flex flex-col card-lift ${mounted ? "animate-fade-in-up delay-200" : "opacity-0"}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[14px] font-bold text-contrastText">Time Clock</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Record your shift sessions</p>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${isClockedIn ? "bg-emerald-500 animate-pulse-ring" : "bg-gray-200"}`} />
          </div>

          {/* Big timer display */}
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            {isClockedIn && lastClockIn ? (
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full border-4 border-indigo-100 flex items-center justify-center mx-auto">
                    <div className="w-20 h-20 rounded-full border-4 border-primaryAccent flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[32px] font-bold text-contrastText font-mono tracking-tight">
                    {elapsedTime || "0:00:00"}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">In since {getStartTimeString()}</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-full border-4 border-gray-100 flex items-center justify-center mx-auto">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-400">No active shift</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Clock in to start tracking</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleClockToggle}
            disabled={btnLoading}
            id="clockToggleBtn"
            className={`w-full flex items-center justify-center gap-2 py-3.5 font-semibold text-[13px] rounded-xl transition-all duration-200 ${
              isClockedIn
                ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                : "bg-primaryAccent text-white shadow-md shadow-indigo-200/70 hover:bg-indigo-600 hover:-translate-y-0.5"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {btnLoading ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : isClockedIn ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
                Clock Out
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="10 8 16 12 10 16 10 8"/>
                </svg>
                Clock In for Shift
              </>
            )}
          </button>
        </div>

        {/* Weekly progress + Summary */}
        <div className="lg:col-span-2 space-y-5">

          {/* Weekly Progress Bar */}
          <div className={`bg-white border border-gray-100 rounded-2xl p-6 card-lift ${mounted ? "animate-fade-in-up delay-300" : "opacity-0"}`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[14px] font-bold text-contrastText">Weekly Goal</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Mon – Sun, current work week</p>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-bold text-contrastText">{stats.weekly_hours}<span className="text-[13px] text-gray-400 font-normal"> / 40 hrs</span></div>
                <div className="text-[10px] text-gray-400">{Math.round(weeklyProgressPercent)}% complete</div>
              </div>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primaryAccent to-violet-500 rounded-full animate-progress transition-all duration-1000 ease-out"
                style={{ width: `${weeklyProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-2">
              <span>0 hrs</span>
              <span>20 hrs</span>
              <span>40 hrs</span>
            </div>
          </div>

          {/* Quick stats grid */}
          <div className={`grid grid-cols-2 gap-4 ${mounted ? "animate-fade-in-up delay-400" : "opacity-0"}`}>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-indigo-100 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Monthly</span>
              </div>
              <div className="text-[26px] font-bold text-contrastText">{stats.monthly_hours}<span className="text-[12px] text-gray-400 font-normal ml-1">hrs</span></div>
              <p className="text-[11px] text-gray-500 mt-1">This calendar month</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-emerald-100 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Remaining</span>
              </div>
              <div className="text-[26px] font-bold text-contrastText">{Math.max(0, 40 - stats.weekly_hours).toFixed(1)}<span className="text-[12px] text-gray-400 font-normal ml-1">hrs</span></div>
              <p className="text-[11px] text-gray-500 mt-1">To hit weekly goal</p>
            </div>
          </div>
        </div>
      </div>
    </TeamsShell>
  );
}
