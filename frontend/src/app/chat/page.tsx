"use client";

import React, { useState, useEffect, useRef } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface ChatMessage {
  id: number;
  user_id: number;
  space_id: string;
  message_text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
}

export default function SpaceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [spaceId, setSpaceId] = useState("spaces/general_sync");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async (targetSpace: string) => {
    if (!targetSpace.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ messages: ChatMessage[] }>(
        `/chat/history/${encodeURIComponent(targetSpace.trim())}`
      );
      setMessages(res.messages);
    } catch (err: any) {
      setError(err?.message || "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(spaceId);
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !spaceId.trim()) return;

    try {
      setBtnLoading(true);
      setError(null);
      
      const newMsg = await api.post<ChatMessage>("/chat/send", {
        space_id: spaceId.trim(),
        message_text: text.trim(),
      });

      setMessages((prev) => [...prev, newMsg]);
      setText("");
    } catch (err: any) {
      setError(err?.message || "Failed to send message.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <TeamsShell title="Google Chat Sync & Relay">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Google Chat Relay Room</h1>
        <p className="text-sm text-slate-400 mt-1">Post announcements or comments. Messages are relayed instantly into Google Chat rooms and mirrored in FlowDesk.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-240px)]">
        {/* Rooms panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 h-full">
          <h3 className="text-md font-bold text-slate-100">💬 Spaces & Channels</h3>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400" htmlFor="spaceInput">Google Chat Space ID</label>
            <input
              id="spaceInput"
              type="text"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              placeholder="e.g. spaces/AAAAAAA"
            />
          </div>

          <button
            onClick={() => fetchHistory(spaceId)}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-800 rounded-xl transition-all"
            disabled={loading}
          >
            🔌 Connect Space
          </button>
        </div>

        {/* Chat Feed */}
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
            <h4 className="font-bold text-slate-200">{spaceId}</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Active Channel</span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <div className="text-3xl">💬</div>
                <p className="text-sm">No messages recorded in this space yet. Say hello!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[75%] ${isOutbound ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isOutbound 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.message_text}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">
                      {isOutbound ? "Outbound" : `Inbound • User #${msg.user_id}`} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Footer Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/20 flex gap-3">
            <input
              type="text"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
              placeholder="Type message here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={btnLoading}
              required
            />
            <button
              type="submit"
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold text-sm rounded-xl"
              disabled={btnLoading || !text.trim()}
            >
              {btnLoading ? (
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
