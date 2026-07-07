"use client";

import React, { useState, useEffect, useRef } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  id: number;
  user_id: number;
  space_id: string;
  message_text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
}

interface ChatSpace {
  id: string;
  label: string;
  description: string;
}

export default function HRSpaceChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState("spaces/hr_room");
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);

  const availableSpaces: ChatSpace[] = [
    { id: "spaces/hr_room",          label: "#hr-announcements",  description: "Internal HR broadcasts" },
    { id: "spaces/general_sync",     label: "#general-sync",      description: "Company-wide channel" },
    { id: "spaces/engineering_sync", label: "#engineering-sync",  description: "Engineering team" },
  ];

  const fetchHistory = async (space: string, silent = false) => {
    if (!space.trim()) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.get<{ messages: ChatMessage[] }>(
        `/chat/history/${encodeURIComponent(space.trim())}`
      );
      setMessages(res.messages || []);
    } catch (err: any) {
      if (!silent) setError(err?.message || "Failed to load conversation history.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(activeSpaceId);
  }, [activeSpaceId]);

  // Real-time polling every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchHistory(activeSpaceId, true);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [activeSpaceId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if (!text || !activeSpaceId.trim()) return;

    try {
      setSendLoading(true);
      setError(null);
      const newMsg = await api.post<ChatMessage>("/chat/send", {
        space_id: activeSpaceId.trim(),
        message_text: text,
      });
      setMessages((prev) => [...prev, newMsg]);
      setInputMessage("");
    } catch (err: any) {
      setError(err?.message || "Failed to deliver message.");
    } finally {
      setSendLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSpace = availableSpaces.find((s) => s.id === activeSpaceId);

  return (
    <TeamsShell title="HR Communication Hub">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText font-sans">
          Team Communication Hub
        </h1>
        <p className="text-sm text-contrastText/50 mt-1">
          Send announcements and messages across workspace channels. Synced via Google Chat webhooks.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-5 bg-primaryAccent/15 rounded-2xl text-sm text-primaryAccent font-medium">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 h-[calc(100vh-260px)]">

        {/* ── Left: Channel list ──────────────────────────────────────── */}
        <div className="bg-sidebarBacking rounded-3xl p-5 flex flex-col gap-3 h-full overflow-hidden">
          <div className="px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-canvasBg/40 mb-3">
              Channels
            </p>
            <div className="space-y-1">
              {availableSpaces.map((space) => {
                const isActive = activeSpaceId === space.id;
                return (
                  <button
                    key={space.id}
                    onClick={() => setActiveSpaceId(space.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.97] ${
                      isActive
                        ? "bg-primaryAccent text-canvasBg shadow-md"
                        : "text-canvasBg/50 hover:bg-canvasBg/10 hover:text-canvasBg"
                    }`}
                  >
                    <span className="block truncate">{space.label}</span>
                    {isActive && (
                      <span className="block text-[9px] text-canvasBg/60 font-normal mt-0.5 truncate">
                        {space.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* HR badge */}
          <div className="mt-auto">
            <div className="px-3 py-2.5 rounded-xl bg-canvasBg/10">
              <p className="text-[10px] text-canvasBg/40 font-semibold uppercase tracking-wide mb-0.5">Logged in as</p>
              <p className="text-xs text-canvasBg font-bold truncate">{user?.email.split("@")[0]}</p>
              <p className="text-[9px] text-canvasBg/40 capitalize">HR Administrator</p>
            </div>
          </div>
        </div>

        {/* ── Right: Chat window ──────────────────────────────────────── */}
        <div className="md:col-span-3 bg-cardBacking rounded-3xl flex flex-col h-full overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-contrastText/10 shrink-0">
            <div>
              <h4 className="font-bold text-contrastText text-sm tracking-tight">
                {activeSpace?.label}
              </h4>
              <span className="text-[10px] text-contrastText/50 font-medium">
                {activeSpace?.description} · polling every 4s
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-successBadge text-contrastText">
              <span className="w-1.5 h-1.5 rounded-full bg-contrastText/60 animate-pulse" />
              Live
            </span>
          </div>

          {/* Messages viewport */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-canvasBg">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primaryAccent" />
                <p className="text-xs text-contrastText/50 animate-pulse">Loading conversation…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-contrastText/40">
                <div className="w-12 h-12 rounded-2xl bg-secondaryElement/30 flex items-center justify-center text-xl">◎</div>
                <p className="text-sm font-semibold text-contrastText/60">Channel is quiet</p>
                <p className="text-xs">Be the first to post a message.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[72%] ${isOutbound ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
                          isOutbound
                            ? "bg-primaryAccent text-canvasBg rounded-tr-none"
                            : "bg-cardBacking text-contrastText rounded-tl-none border border-secondaryElement/30"
                        }`}
                      >
                        {msg.message_text}
                      </div>
                      <span className="text-[9px] text-contrastText/40 mt-1 px-1">
                        {isOutbound ? `You (${user?.email.split("@")[0]})` : `User #${msg.user_id}`}
                        {" · "}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Message input */}
          <form
            onSubmit={handleSend}
            className="p-4 border-t border-secondaryElement/20 bg-cardBacking flex gap-3 items-center shrink-0"
          >
            <input
              type="text"
              className="flex-1 bg-canvasBg border border-secondaryElement/40 focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/20 rounded-2xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/30 transition-all outline-none"
              placeholder={`Message ${activeSpace?.label ?? "channel"}…`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendLoading}
            />
            <button
              type="submit"
              disabled={sendLoading || !inputMessage.trim()}
              className="px-5 py-3 bg-primaryAccent hover:bg-primaryAccent/90 disabled:opacity-40 transition-all duration-150 active:scale-[0.96] text-canvasBg font-bold text-sm rounded-2xl shrink-0 shadow-md"
            >
              {sendLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-canvasBg" />
              ) : (
                "Send"
              )}
            </button>
          </form>
        </div>
      </div>
    </TeamsShell>
  );
}
