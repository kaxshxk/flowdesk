"use client";

import React, { useState, useEffect } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface MeetLog {
  id: number;
  meet_url: string;
  target_space_id: string | null;
  topic: string;
  timestamp: string;
}

export default function GoogleMeet() {
  const [history, setHistory] = useState<MeetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [topic, setTopic] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [newMeetUrl, setNewMeetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const availableSpaces = [
    { id: "", label: "🔒 Do Not Broadcast (Private)" },
    { id: "spaces/general_sync", label: "#general-sync" },
    { id: "spaces/hr_room", label: "#hr-announcements" },
    { id: "spaces/engineering_sync", label: "#engineering-sync" },
  ];

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ total: number; meetings: MeetLog[] }>("/meet/history");
      setHistory(res.meetings || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load video call history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBtnLoading(true);
      setError(null);
      setSuccess(null);
      setNewMeetUrl(null);
      setCopied(false);

      const res = await api.post<MeetLog>("/meet/create", {
        topic: topic.trim() || undefined,
        broadcast_space_id: spaceId.trim() || undefined,
      });

      setNewMeetUrl(res.meet_url);
      setTopic("");
      setSpaceId("");
      setSuccess("Instant meeting room generated and synced to Calendar!");
      await fetchHistory();
    } catch (err: any) {
      setError(err?.message || "Failed to generate meeting.");
    } finally {
      setBtnLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!newMeetUrl) return;
    try {
      await navigator.clipboard.writeText(newMeetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy clipboard:", err);
    }
  };

  return (
    <TeamsShell title="Google Meet Provisioner">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">Video Conferencing</h1>
        <p className="text-sm text-slate-400 mt-1">Spin up video meeting links dynamically via Google Calendar and broadcast them to space rooms.</p>
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
        {/* Creator panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit flex flex-col gap-4">
          <h3 className="text-md font-bold text-slate-100">📹 Spin Up Meeting Room</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="meetTopic">Meeting Topic / Title</label>
              <input
                id="meetTopic"
                type="text"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
                placeholder="e.g. Emergency Standup, Sync meeting"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={btnLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="meetSpace">Broadcast Chat Space</label>
              <select
                id="meetSpace"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                disabled={btnLoading}
              >
                {availableSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500">
                Will auto-post the meeting invite link into the chosen space.
              </span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl"
              disabled={btnLoading}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Create & Broadcast Instant Meet"
              )}
            </button>
          </form>

          {newMeetUrl && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex flex-col gap-3">
              <div className="text-xs font-bold text-emerald-400 text-center">Room Created Successfully!</div>
              
              <div className="flex gap-2">
                <a
                  href={newMeetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all"
                >
                  🚀 Join Meeting Now
                </a>
                
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded-xl transition-all"
                >
                  {copied ? "✓ Copied!" : "📋 Copy Link"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* History panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-md font-bold text-slate-100 mb-4">📂 Active & Past Meetings</h3>
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-slate-800 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-slate-800 rounded animate-pulse"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <span className="text-3xl block">📹</span>
              <p className="text-sm">No meeting rooms generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/20">
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Broadcast Space</th>
                    <th className="py-3 px-4 text-right">Meeting Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {history.map((meet) => (
                    <tr key={meet.id} className="hover:bg-slate-800/40 transition-colors odd:bg-slate-950/10">
                      <td className="py-4 px-4 font-semibold text-slate-100">{meet.topic}</td>
                      <td className="py-4 px-4 text-xs text-slate-400">{new Date(meet.timestamp).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        {meet.target_space_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{meet.target_space_id.split("/")[1] || meet.target_space_id}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">Private</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <a
                          href={meet.meet_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-xl text-slate-300 transition-colors"
                        >
                          Join Meet ↗
                        </a>
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
