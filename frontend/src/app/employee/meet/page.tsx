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
    { id: "", label: " Do Not Broadcast (Private)" },
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
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText font-sans">Video Conferencing</h1>
        <p className="text-sm text-contrastText/60 mt-1">Spin up video meeting links dynamically via Google Calendar and broadcast them to space rooms.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creator panel */}
        <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 h-fit flex flex-col gap-4">
          <h3 className="text-md font-bold text-contrastText"> Spin Up Meeting Room</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/60" htmlFor="meetTopic">Meeting Topic / Title</label>
              <input
                id="meetTopic"
                type="text"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-4 py-3 text-sm text-contrastText outline-none"
                placeholder="e.g. Emergency Standup, Sync meeting"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={btnLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/60" htmlFor="meetSpace">Broadcast Chat Space</label>
              <select
                id="meetSpace"
                className="w-full bg-canvasBg/35 border border-secondaryElement/20 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/30/20 rounded-xl px-3 py-2.5 text-sm text-contrastText outline-none"
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
              <span className="text-[10px] text-contrastText/40">
                Will auto-post the meeting invite link into the chosen space.
              </span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-primaryAccent hover:bg-primaryAccent/95 hover:shadow-lg hover:shadow-primaryAccent/20 transition-all text-canvasBg font-semibold text-sm rounded-xl"
              disabled={btnLoading}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-canvasBg"></div>
              ) : (
                "Create & Broadcast Instant Meet"
              )}
            </button>
          </form>

          {newMeetUrl && (
            <div className="mt-4 p-4 bg-successBadge/15 border border-successBadge/25 rounded-2xl flex flex-col gap-3">
              <div className="text-xs font-bold text-contrastText text-center">Room Created Successfully!</div>
              
              <div className="flex gap-2">
                <a
                  href={newMeetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center py-2 bg-successBadge hover:bg-successBadge text-canvasBg font-semibold text-xs rounded-xl transition-all"
                >
                   Join Meeting Now
                </a>
                
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-canvasBg/35 border border-secondaryElement/20 text-contrastText/80 hover:text-contrastText text-xs font-semibold rounded-xl transition-all"
                >
                  {copied ? " Copied!" : " Copy Link"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* History panel */}
        <div className="lg:col-span-2 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 shadow-md">
          <h3 className="text-md font-bold text-contrastText mb-4"> Active & Past Meetings</h3>
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-canvasBg/25 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-canvasBg/25 rounded animate-pulse"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-contrastText/40 space-y-2">
              <span className="text-3xl block"></span>
              <p className="text-sm">No meeting rooms generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-secondaryElement/20 text-contrastText/60 text-xs font-semibold uppercase bg-canvasBg/15">
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Broadcast Space</th>
                    <th className="py-3 px-4 text-right">Meeting Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondaryElement/20 text-contrastText/80">
                  {history.map((meet) => (
                    <tr key={meet.id} className="hover:bg-canvasBg/20 transition-colors odd:bg-canvasBg/10">
                      <td className="py-4 px-4 font-semibold text-contrastText">{meet.topic}</td>
                      <td className="py-4 px-4 text-xs text-contrastText/60">{new Date(meet.timestamp).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        {meet.target_space_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primaryAccent/10 text-primaryAccent border border-primaryAccent/20">{meet.target_space_id.split("/")[1] || meet.target_space_id}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-canvasBg/25 text-contrastText/60">Private</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <a
                          href={meet.meet_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 bg-canvasBg/35 border border-secondaryElement/20 hover:bg-canvasBg/30 border-secondaryElement/20 hover:border-secondaryElement/45 text-xs font-semibold rounded-xl text-contrastText/80 transition-colors"
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
