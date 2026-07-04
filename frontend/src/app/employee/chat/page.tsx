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
}

export default function SpaceChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState("spaces/general_sync");
  const [inputMessage, setInputMessage] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);

  const availableSpaces: ChatSpace[] = [
    { id: "spaces/general_sync", label: "💬 #general-sync" },
    { id: "spaces/hr_room", label: "🛡️ #hr-announcements" },
    { id: "spaces/engineering_sync", label: "⚙️ #engineering-sync" },
  ];

  const fetchHistory = async (space: string, silent = false) => {
    if (!space.trim()) return;
    try {
      if (!silent) setLoading(true);
      const res = await api.get<{ messages: ChatMessage[] }>(
        `/chat/history/${encodeURIComponent(space.trim())}`
      );
      setMessages(res.messages || []);
    } catch (err: any) {
      if (!silent) setError(err?.message || "Failed to load space conversations.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 1. Initial Room history compilation on active room change
  useEffect(() => {
    fetchHistory(activeSpaceId);
  }, [activeSpaceId]);

  // 2. Real-time synchronization polling hook (every 4 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      // Sync history silently if tab is active
      if (document.visibilityState === "visible") {
        fetchHistory(activeSpaceId, true);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [activeSpaceId]);

  // 3. Auto-scroll utility
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

      const payload = {
        space_id: activeSpaceId.trim(),
        message_text: text,
      };

      const newMsg = await api.post<ChatMessage>("/chat/send", payload);

      // Prepend or Append: Append to timeline
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

  return (
    <TeamsShell title="Shared Workspace Chat Hub">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">Workspace Chat</h1>
        <p className="text-sm text-slate-400 mt-1">
          Post announcements and messages. Synced in real-time with Google Chat webhook relays.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Two-column layout config */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        
        {/* Left Sidebar Panel - Chat spaces list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 h-full">
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider px-2">Rooms & Spaces</h3>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {availableSpaces.map((space) => {
              const isActive = activeSpaceId === space.id;
              return (
                <button
                  key={space.id}
                  onClick={() => setActiveSpaceId(space.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/15"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  {space.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Window - Active conversation */}
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-lg">
          
          {/* Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
            <div>
              <h4 className="font-bold text-slate-200 text-sm tracking-tight">
                {availableSpaces.find((s) => s.id === activeSpaceId)?.label || activeSpaceId}
              </h4>
              <span className="text-[10px] text-slate-500 font-medium">Automatic Polling Active (4s interval)</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
              Live Webhook Sync
            </span>
          </div>

          {/* Scrollable Viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <div className="text-xs text-slate-500 animate-pulse">Retrieving conversation logs...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <span className="text-4xl block">💬</span>
                <p className="text-sm font-semibold text-slate-400">Welcome to the channel</p>
                <p className="text-xs text-slate-500">Type a message below to start the conversation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[75%] ${isOutbound ? "ml-auto items-end" : "mr-auto items-start"}`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
                          isOutbound 
                            ? "bg-indigo-600 text-white shadow-indigo-600/5 rounded-tr-none" 
                            : "bg-slate-800 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        {msg.message_text}
                      </div>
                      
                      <span className="text-[9px] text-slate-500 mt-1 px-1">
                        {isOutbound ? `Me (${user?.email.split("@")[0]})` : `User #${msg.user_id}`} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Sticky Message Input Dock */}
          <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/20 flex gap-3 items-center">
            
            {/* Decorative Paperclip */}
            <button
              type="button"
              className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors shrink-0"
              title="Attach File (Not supported in this version)"
              onClick={() => alert("File attachments can be directly uploaded to the Drive Vault segment.")}
            >
              📎
            </button>

            <input
              type="text"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none"
              placeholder={`Send message to ${availableSpaces.find((s) => s.id === activeSpaceId)?.label.split(" ")[1] || "room"}...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendLoading}
              required
            />

            <button
              type="submit"
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl shrink-0"
              disabled={sendLoading || !inputMessage.trim()}
            >
              {sendLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
