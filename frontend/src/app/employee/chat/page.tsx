"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  id: number;
  user_id: number;
  sender_name: string;
  space_id: string;
  message_text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
}

interface ChatSpace {
  id: string;
  label: string;
}

interface FileLog {
  id: number;
  file_name: string;
  google_drive_file_id: string;
  drive_folder_path: string;
  timestamp: string;
}

// Format a timestamp into "HH:MM AM/PM" or "Yesterday HH:MM" etc.
function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Avatar colour derived from sender name for consistency
function avatarColor(name: string): string {
  const colors = [
    "bg-indigo-500", "bg-violet-500", "bg-sky-500",
    "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function SpaceChat() {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSpace, setActiveSpace] = useState<ChatSpace | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Advanced features state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // Modals state
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<FileLog[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [attachmentTab, setAttachmentTab] = useState<"upload" | "vault">("upload");
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);

  // Reactions state: messageId -> emoji -> userList
  const [reactions, setReactions] = useState<Record<number, Record<string, string[]>>>({});

  const feedEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  const myUsername = user?.email.split("@")[0] ?? "user";

  // Load available spaces on mount
  useEffect(() => {
    api.get<ChatSpace[]>("/chat/spaces")
      .then((data) => {
        setSpaces(data);
        if (data.length > 0) setActiveSpace(data[0]);
      })
      .catch(() => setError("Could not load chat spaces."));
  }, []);

  // Fetch message history
  const fetchHistory = useCallback(async (spaceId: string, silent = false) => {
    if (!spaceId) return;
    try {
      if (!silent) setLoading(true);
      const res = await api.get<{ messages: ChatMessage[] }>(`/chat/history/${encodeURIComponent(spaceId)}`);
      const msgs = res.messages || [];
      setMessages(msgs);
      if (msgs.length > 0) lastMessageIdRef.current = msgs[msgs.length - 1].id;
    } catch (err: any) {
      if (!silent) setError(err?.message || "Failed to load messages.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Switch space
  useEffect(() => {
    if (!activeSpace) return;
    lastMessageIdRef.current = 0;
    fetchHistory(activeSpace.id);
    inputRef.current?.focus();
    
    // Load local reactions
    const stored = localStorage.getItem(`fd_reactions_${activeSpace.id}`);
    if (stored) {
      try { setReactions(JSON.parse(stored)); } catch { setReactions({}); }
    } else {
      setReactions({});
    }
    
    // Reset search
    setSearchQuery("");
    setShowSearch(false);
  }, [activeSpace, fetchHistory]);

  // Polling every 3s for new messages
  useEffect(() => {
    if (!activeSpace) return;
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      setIsPolling(true);
      try {
        const res = await api.get<{ messages: ChatMessage[] }>(
          `/chat/history/${encodeURIComponent(activeSpace.id)}`
        );
        const msgs = res.messages || [];
        const lastId = lastMessageIdRef.current;
        if (msgs.length > 0 && msgs[msgs.length - 1].id !== lastId) {
          setMessages(msgs);
          lastMessageIdRef.current = msgs[msgs.length - 1].id;
        }
      } catch { /* silent */ } finally {
        setIsPolling(false);
      }
    }, 3000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeSpace]);

  // Auto-scroll on new messages
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if ((!text && !selectedLocalFile) || !activeSpace || sendLoading) return;

    setSendLoading(true);
    setError(null);
    setInputMessage("");

    // Temporary hold variables to restore on error
    const originalText = text;
    const originalFile = selectedLocalFile;

    try {
      let finalMessageText = text;

      // If a local file is staged, upload it first!
      if (selectedLocalFile) {
        const formData = new FormData();
        formData.append("file", selectedLocalFile);

        // Upload directly to local server
        const uploadRes = await api.post<{ file_name: string; url: string }>("/chat/upload-local", formData);

        // Clear staged file immediately on success
        setSelectedLocalFile(null);
        if (localFileInputRef.current) {
          localFileInputRef.current.value = "";
        }

        // Format attachment link card
        const cardText = `📎 Attached local file:\n**${uploadRes.file_name}**\n${uploadRes.url}`;
        finalMessageText = text ? `${text}\n\n${cardText}` : cardText;
      }

      const newMsg = await api.post<ChatMessage>("/chat/send", {
        space_id: activeSpace.id,
        message_text: finalMessageText,
      });
      setMessages((prev) => [...prev, newMsg]);
      lastMessageIdRef.current = newMsg.id;
    } catch (err: any) {
      setError(err?.message || "Failed to send message.");
      setInputMessage(originalText); // restore text input
      setSelectedLocalFile(originalFile); // restore staged file
    } finally {
      setSendLoading(false);
      inputRef.current?.focus();
    }
  };

  // Reactions persistent handler
  const handleReact = (messageId: number, emoji: string) => {
    if (!activeSpace) return;
    setReactions((prev) => {
      const msgReactions = prev[messageId] ? { ...prev[messageId] } : {};
      const users = msgReactions[emoji] ? [...msgReactions[emoji]] : [];
      
      if (users.includes(myUsername)) {
        const filtered = users.filter((u) => u !== myUsername);
        if (filtered.length === 0) {
          delete msgReactions[emoji];
        } else {
          msgReactions[emoji] = filtered;
        }
      } else {
        msgReactions[emoji] = [...users, myUsername];
      }
      
      const next = { ...prev, [messageId]: msgReactions };
      localStorage.setItem(`fd_reactions_${activeSpace.id}`, JSON.stringify(next));
      return next;
    });
  };

  // Trigger Google Meet provision
  const handleCreateMeet = async () => {
    if (!activeSpace) return;
    try {
      setSendLoading(true);
      setError(null);
      setShowMeetModal(false);
      
      await api.post("/meet/create", {
        topic: `Instant Sync: ${activeSpace.label}`,
        broadcast_space_id: activeSpace.id,
      });
      
      await fetchHistory(activeSpace.id, true);
    } catch (err: any) {
      setError(err?.message || "Failed to launch meeting.");
    } finally {
      setSendLoading(false);
    }
  };

  // Open Drive Vault modal
  const openFileModal = async () => {
    setShowFileModal(true);
    setAttachmentTab("upload"); // default to upload tab
    setLoadingFiles(true);
    try {
      const res = await api.get<{ total: number; files: FileLog[] }>("/files");
      setVaultFiles(res.files || []);
    } catch {
      setError("Could not load Drive Vault files.");
    } finally {
      setLoadingFiles(false);
    }
  };

  // Share Drive File directly in Chat
  const handleShareFile = async (file: FileLog) => {
    if (!activeSpace || sendLoading) return;
    setSendLoading(true);
    setShowFileModal(false);
    try {
      const shareText = `📎 Shared from Drive Vault:\n**${file.file_name}**\nPath: \`${file.drive_folder_path}\` · ID: \`${file.google_drive_file_id}\`\nhttps://drive.google.com/open?id=${file.google_drive_file_id}`;
      const newMsg = await api.post<ChatMessage>("/chat/send", {
        space_id: activeSpace.id,
        message_text: shareText,
      });
      setMessages((prev) => [...prev, newMsg]);
      lastMessageIdRef.current = newMsg.id;
    } catch (err: any) {
      setError(err?.message || "Failed to share file.");
    } finally {
      setSendLoading(false);
    }
  };

  // Stage local file for upload
  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !activeSpace) return;
    const file = e.target.files[0];
    
    // 20MB client-side boundary limit
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("File exceeds the 20MB size threshold limit.");
      return;
    }

    setSelectedLocalFile(file);
    setError(null);
    setShowFileModal(false); // Close modal so user sees the staged file in chat bar
  };

  // Match highlight utility
  const highlightText = (element: string, query: string): React.ReactNode => {
    if (!query.trim()) return element;
    
    const parts = element.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded shadow-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Markdown inline renderer
  const parseMarkdownInline = (text: string, partIndex: number, isMe: boolean): React.ReactNode => {
    const codeRegex = /(`[^`\n]+`)/g;
    const segments = text.split(codeRegex);
    
    return (
      <span key={partIndex}>
        {segments.map((seg, sIdx) => {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            return (
              <code key={sIdx} className={`px-1.5 py-0.5 font-mono text-[11px] rounded ${
                isMe ? "bg-black/25 text-white" : "bg-gray-200 text-rose-600 font-semibold"
              }`}>
                {seg.slice(1, -1)}
              </code>
            );
          }
          
          const boldRegex = /(\*\*[^*]+\*\*)/g;
          const bSegs = seg.split(boldRegex);
          
          return bSegs.map((bSeg, bIdx) => {
            if (bSeg.startsWith('**') && bSeg.endsWith('**')) {
              return (
                <strong key={bIdx} className={`font-bold ${isMe ? "text-white" : "text-gray-900"}`}>
                  {highlightText(bSeg.slice(2, -2), searchQuery)}
                </strong>
              );
            }
            
            const italicRegex = /(\*[^*]+\*|_[^_]+_)/g;
            const iSegs = bSeg.split(italicRegex);
            
            return iSegs.map((iSeg, iIdx) => {
              if ((iSeg.startsWith('*') && iSeg.endsWith('*')) || (iSeg.startsWith('_') && iSeg.endsWith('_'))) {
                return (
                  <em key={iIdx} className="italic">
                    {highlightText(iSeg.slice(1, -1), searchQuery)}
                  </em>
                );
              }
              
              const strikeRegex = /(~[^~]+~)/g;
              const sSegs = iSeg.split(strikeRegex);
              
              return sSegs.map((sSeg, sIdx2) => {
                if (sSeg.startsWith('~') && sSeg.endsWith('~')) {
                  return (
                    <span key={sIdx2} className="line-through opacity-75">
                      {highlightText(sSeg.slice(1, -1), searchQuery)}
                    </span>
                  );
                }
                return highlightText(sSeg, searchQuery);
              });
            });
          });
        })}
      </span>
    );
  };

  // Full Rich Text + URL message renderer
  const renderMessageText = (text: string, isMe: boolean): React.ReactNode => {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={isMe 
              ? "text-white underline hover:text-indigo-100 font-semibold break-all" 
              : "text-primaryAccent underline hover:text-indigo-600 font-semibold break-all"
            }
          >
            {part}
          </a>
        );
      }
      return parseMarkdownInline(part, index, isMe);
    });
  };

  // Static Details Sidebar Metadata
  const getChannelDetails = (spaceId: string) => {
    switch (spaceId) {
      case "spaces/general_sync":
        return {
          description: "Official workspace general chat for daily check-ins, company-wide announcements, and watercooler talk.",
          members: [
            { name: "sarah_hr", role: "HR Lead", status: "online" },
            { name: "alex_dev", role: "Tech Lead", status: "online" },
            { name: "emily_design", role: "UI Designer", status: "away" },
            { name: "michael_ops", role: "System Admin", status: "offline" },
          ],
        };
      case "spaces/hr_room":
        return {
          description: "Announcements, company handbooks, policy updates, benefit programs, and compliance updates managed by HR.",
          members: [
            { name: "sarah_hr", role: "HR Lead", status: "online" },
            { name: "admin", role: "Workspace Admin", status: "online" },
            { name: "jessica_recruiter", role: "HR Recruiter", status: "offline" },
          ],
        };
      case "spaces/engineering_sync":
        return {
          description: "Development discussions, code reviews, daily standups, incident reporting, and infrastructure updates.",
          members: [
            { name: "alex_dev", role: "Tech Lead", status: "online" },
            { name: "david_qa", role: "QA Engineer", status: "online" },
            { name: "tom_devops", role: "DevOps Engineer", status: "away" },
            { name: "james_fullstack", role: "Engineer", status: "online" },
          ],
        };
      default:
        return {
          description: "Collaborative project sync channel.",
          members: [],
        };
    }
  };

  // Group consecutive messages from the same sender
  const grouped = messages.reduce<Array<{ sender: string; msgs: ChatMessage[] }>>((acc, msg) => {
    const senderName = msg.sender_name || `user_${msg.user_id}`;
    const last = acc[acc.length - 1];
    if (last && last.sender === senderName) {
      last.msgs.push(msg);
    } else {
      acc.push({ sender: senderName, msgs: [msg] });
    }
    return acc;
  }, []);

  // Filter messages based on search query
  const filteredGrouped = searchQuery.trim() === "" 
    ? grouped 
    : grouped.map(group => {
        const matchingMsgs = group.msgs.filter(m => 
          m.message_text.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return { ...group, msgs: matchingMsgs };
      }).filter(group => group.msgs.length > 0);

  const activeDetails = activeSpace ? getChannelDetails(activeSpace.id) : null;
  const filteredFiles = vaultFiles.filter(f => 
    f.file_name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  return (
    <TeamsShell title="Space Chat">
      <div className="flex h-[calc(100vh-108px)] bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm relative">

        {/* ── Mobile Sidebar Drawer Backdrop ───────────────────────────── */}
        {showMobileSidebar && (
          <div 
            onClick={() => setShowMobileSidebar(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          />
        )}

        {/* ── Sidebar: Space list ──────────────────────────────────────── */}
        <div className={`w-[220px] shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/50 transition-all duration-300 md:relative md:flex
          ${showMobileSidebar 
            ? "flex absolute inset-y-0 left-0 z-50 bg-white shadow-xl" 
            : "hidden md:flex"
          }`}
        >
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Channels</p>
            {showMobileSidebar && (
              <button 
                onClick={() => setShowMobileSidebar(false)} 
                className="md:hidden p-1 text-gray-400 hover:text-gray-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {spaces.map((space) => {
              const isActive = activeSpace?.id === space.id;
              return (
                <button
                  key={space.id}
                  onClick={() => {
                    setActiveSpace(space);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 mb-0.5 text-left
                    ${isActive
                      ? "bg-primaryAccent/10 text-primaryAccent font-semibold"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                >
                  <span className={`text-[15px] font-normal ${isActive ? "text-primaryAccent" : "text-gray-400"}`}>#</span>
                  {space.label.replace("#", "")}
                </button>
              );
            })}
          </div>

          {/* Online status */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-gray-400 font-medium truncate">Online as <span className="text-gray-600 font-semibold">{myUsername}</span></span>
            </div>
          </div>
        </div>

        {/* ── Main chat area ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white h-full relative">

          {/* Channel header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white shrink-0 gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <button 
                onClick={() => setShowMobileSidebar(true)}
                className="md:hidden p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              
              <span className="text-[18px] text-gray-400 font-light hidden sm:inline">#</span>
              <span className="text-[14px] font-bold text-contrastText truncate">
                {activeSpace?.label.replace("#", "") ?? "Select a channel"}
              </span>
              <span className="text-[11px] text-gray-400 ml-1 shrink-0">· {messages.length} messages</span>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {/* Poll Sync Indicator */}
              {isPolling ? (
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider animate-pulse">
                  <svg className="animate-spin text-primaryAccent" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Syncing
                </div>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 border-l border-gray-100 pl-3">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`p-1.5 rounded-lg transition-all ${showSearch ? "bg-primaryAccent/10 text-primaryAccent" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
                  title="Search messages"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
                
                <button
                  onClick={() => setShowMeetModal(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primaryAccent hover:bg-primaryAccent/10 transition-all"
                  title="Start instant Google Meet call"
                  disabled={!activeSpace}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </button>

                <button
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  className={`p-1.5 rounded-lg transition-all ${showInfoSidebar ? "bg-primaryAccent/10 text-primaryAccent" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
                  title="Channel details"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search bar slide-down */}
          {showSearch && (
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 animate-scale-in">
              <svg className="text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-[12px] placeholder-gray-400 font-medium text-gray-700"
                placeholder="Search messages in this channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600 p-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-600 font-medium animate-scale-in z-10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span className="text-[12px]">Loading messages…</span>
              </div>
            ) : filteredGrouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-600">
                    {searchQuery ? "No matching results" : "No messages yet"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {searchQuery ? "Try searching for a different phrase" : `Be the first to say something in ${activeSpace?.label}`}
                  </p>
                </div>
              </div>
            ) : (
              filteredGrouped.map((group, gi) => {
                const isMe = group.sender === myUsername;
                const initial = group.sender.charAt(0).toUpperCase();
                const color = avatarColor(group.sender);

                return (
                  <div key={gi} className={`flex gap-3 py-1 group/row ${isMe ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5`}>
                      {initial}
                    </div>

                    {/* Bubble column */}
                    <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                      {/* Sender + timestamp */}
                      <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <span className="text-[11px] font-semibold text-gray-700">
                          {isMe ? "You" : group.sender}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatTime(group.msgs[0].timestamp)}
                        </span>
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.25 bg-indigo-50 text-primaryAccent rounded-full font-semibold border border-indigo-100">you</span>
                        )}
                      </div>

                      {/* Message bubbles */}
                      {group.msgs.map((msg, mi) => {
                        const msgReactions = reactions[msg.id] || {};
                        const hasSharedDrive = msg.message_text.includes("📎 Shared from Drive Vault");

                        return (
                          <div key={msg.id} className="relative group/bubble flex flex-col items-start">
                            {/* Hover Reaction Toolbar */}
                            <div className={`absolute -top-6 bg-white border border-gray-100 rounded-lg shadow-sm px-1.5 py-1 gap-1.5 hidden group-hover/bubble:flex z-10 transition-all animate-scale-in
                              ${isMe ? "left-0" : "right-0"}`}
                            >
                              {["👍", "❤️", "😂", "🎉", "🚀"].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReact(msg.id, emoji)}
                                  className="hover:scale-125 transition-transform px-0.5 text-[12px]"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>

                            {/* Message content box */}
                            <div
                              className={`px-3.5 py-2 text-[13px] leading-relaxed break-words whitespace-pre-wrap
                                ${hasSharedDrive 
                                  ? (isMe 
                                      ? "bg-indigo-700/80 text-white rounded-2xl rounded-tr-sm border border-indigo-500/35"
                                      : "bg-indigo-50/70 border border-indigo-100/60 text-gray-800 rounded-2xl rounded-tl-sm"
                                    )
                                  : (isMe
                                      ? "bg-primaryAccent text-white rounded-2xl rounded-tr-sm"
                                      : "bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm"
                                    )
                                }
                                ${mi > 0 ? (isMe ? "rounded-tr-2xl" : "rounded-tl-2xl") : ""}
                              `}
                            >
                              {renderMessageText(msg.message_text, isMe)}
                            </div>

                            {/* Rendered reactions beneath bubble */}
                            {Object.keys(msgReactions).length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                {Object.entries(msgReactions).map(([emoji, users]) => {
                                  const alreadyReacted = users.includes(myUsername);
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReact(msg.id, emoji)}
                                      title={`Reacted: ${users.join(", ")}`}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all
                                        ${alreadyReacted 
                                          ? "bg-primaryAccent/10 border-primaryAccent/30 text-primaryAccent" 
                                          : "bg-gray-50 border-gray-150 text-gray-500 hover:bg-gray-100"
                                        }`}
                                    >
                                      <span>{emoji}</span>
                                      <span>{users.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Message input area */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
            {selectedLocalFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-750 font-semibold max-w-max mb-2 animate-scale-in">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <span className="truncate max-w-[180px]">{selectedLocalFile.name}</span>
                <span className="text-[10px] text-indigo-400 font-medium">({(selectedLocalFile.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocalFile(null);
                    if (localFileInputRef.current) localFileInputRef.current.value = "";
                  }}
                  className="text-indigo-450 hover:text-rose-500 transition-colors p-0.5 ml-1"
                  title="Remove attachment"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-center gap-2">
              {/* Drive Vault attachment shortcut */}
              <button
                type="button"
                onClick={openFileModal}
                className="w-9 h-9 border border-gray-200 hover:border-primaryAccent hover:text-primaryAccent text-gray-400 rounded-xl flex items-center justify-center transition-all shrink-0"
                title="Attach file from Drive Vault"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-primaryAccent focus-within:ring-2 focus-within:ring-primaryAccent/10 transition-all">
                <div className={`w-6 h-6 rounded-full ${avatarColor(myUsername)} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                  {myUsername.charAt(0).toUpperCase()}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  id="chatMessageInput"
                  className="flex-1 bg-transparent outline-none text-[13px] text-contrastText placeholder-gray-400 font-medium"
                  placeholder={`Message ${activeSpace?.label ?? "channel"}…`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  disabled={sendLoading || !activeSpace}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                id="chatSendBtn"
                disabled={sendLoading || (!inputMessage.trim() && !selectedLocalFile) || !activeSpace}
                className="w-9 h-9 bg-primaryAccent hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl flex items-center justify-center transition-all duration-150 shrink-0 shadow-sm shadow-indigo-200/60"
              >
                {sendLoading ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </form>
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[9px]">Enter</kbd> to send · Supports markdown like <code className="text-primaryAccent font-bold">**bold**</code> and <code className="text-primaryAccent font-bold">`code`</code></p>
          </div>
        </div>

        {/* ── Collapsible Info Sidebar: Details & Members ──────────────── */}
        {showInfoSidebar && activeDetails && (
          <div className="w-[260px] border-l border-gray-100 bg-white flex flex-col shrink-0 animate-slide-in-right z-10 relative">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-700">Channel Details</span>
              <button 
                onClick={() => setShowInfoSidebar(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Description</span>
                <p className="text-[12px] text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {activeDetails.description}
                </p>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Members ({activeDetails.members.length})</span>
                <div className="space-y-2">
                  {activeDetails.members.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      {/* Avatar */}
                      <div className="relative">
                        <div className={`w-8 h-8 rounded-full ${avatarColor(member.name)} text-white flex items-center justify-center text-[10px] font-bold`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Status Ring */}
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white
                          ${member.status === "online" ? "bg-emerald-500" : member.status === "away" ? "bg-amber-400" : "bg-gray-300"}`} 
                        />
                      </div>
                      
                      {/* Member Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-bold text-gray-700 truncate">{member.name}</p>
                          {member.name === myUsername && (
                            <span className="text-[9px] bg-indigo-50 text-primaryAccent px-1 rounded font-semibold border border-indigo-100">you</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-none">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL: Instant Meet Confirmation ─────────────────────────── */}
      {showMeetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={() => setShowMeetModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          
          {/* Content */}
          <div className="relative bg-white border border-gray-100 rounded-2xl p-6 max-w-sm w-full shadow-xl animate-scale-in text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-primaryAccent flex items-center justify-center mx-auto shadow-inner">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-[15px] font-bold text-gray-800">Launch Google Meet?</h3>
              <p className="text-[11px] text-gray-400 leading-normal">
                This will spin up a video sync room and broadcast the join invite automatically to <span className="font-semibold text-gray-600">{activeSpace?.label}</span>.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowMeetModal(false)}
                className="flex-1 py-2 px-3 border border-gray-200 hover:bg-gray-50 text-[12px] font-semibold text-gray-500 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateMeet}
                className="flex-1 py-2 px-3 bg-primaryAccent hover:bg-indigo-600 text-[12px] font-semibold text-white rounded-xl transition-all shadow-sm shadow-indigo-200/50"
              >
                Launch & Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Unified File Selector & Uploader ──────────────────── */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={() => setShowFileModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          
          {/* Content */}
          <div className="relative bg-white border border-gray-100 rounded-2xl p-5 max-w-lg w-full shadow-xl animate-scale-in flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <h3 className="text-[14px] font-bold text-gray-800">Attach a File</h3>
              </div>
              <button 
                onClick={() => setShowFileModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Tabs selector */}
            <div className="flex border-b border-gray-100 mt-3 mb-4 shrink-0">
              <button
                onClick={() => setAttachmentTab("upload")}
                className={`flex-1 py-2 text-[12px] font-bold border-b-2 transition-all
                  ${attachmentTab === "upload" 
                    ? "border-primaryAccent text-primaryAccent" 
                    : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
              >
                Upload Local File
              </button>
              <button
                onClick={() => setAttachmentTab("vault")}
                className={`flex-1 py-2 text-[12px] font-bold border-b-2 transition-all
                  ${attachmentTab === "vault" 
                    ? "border-primaryAccent text-primaryAccent" 
                    : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
              >
                Browse Drive Vault
              </button>
            </div>

            {/* Tabs contents */}
            {attachmentTab === "upload" ? (
              <div className="flex flex-col gap-4 items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center bg-gray-50/50 min-h-[220px]">
                <input
                  type="file"
                  ref={localFileInputRef}
                  onChange={handleLocalUpload}
                  className="hidden"
                  disabled={sendLoading}
                />
                
                {selectedLocalFile ? (
                  <div className="space-y-4 w-full">
                    <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm text-left">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-primaryAccent flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-gray-700 truncate">{selectedLocalFile.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{(selectedLocalFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocalFile(null);
                          if (localFileInputRef.current) localFileInputRef.current.value = "";
                        }}
                        className="p-1 text-gray-400 hover:text-rose-500 transition-colors shrink-0"
                        title="Remove file"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocalFile(null);
                          if (localFileInputRef.current) localFileInputRef.current.value = "";
                        }}
                        className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 font-semibold text-[11px] rounded-xl transition-all"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFileModal(false)}
                        className="flex-1 py-2 bg-primaryAccent hover:bg-indigo-600 text-white font-semibold text-[11px] rounded-xl transition-all shadow-sm"
                      >
                        Confirm Attachment
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-primaryAccent flex items-center justify-center mx-auto shadow-sm">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-gray-700">Choose a file from your device</p>
                      <p className="text-[10px] text-gray-400 mt-1">File size limit: 20MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => localFileInputRef.current?.click()}
                      className="px-4 py-2 bg-primaryAccent hover:bg-indigo-600 text-white font-semibold text-[11px] rounded-xl transition-all shadow-sm"
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Search bar inside vault */}
                <div className="mb-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shrink-0">
                  <svg className="text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-[12px] placeholder-gray-400 font-medium text-gray-700"
                    placeholder="Search files by name..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                  />
                </div>

                {/* Scrollable file list */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px] max-h-[300px]">
                  {loadingFiles ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                      <svg className="animate-spin text-primaryAccent" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      <span className="text-[11px]">Syncing with Drive catalog…</span>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-[11px]">
                      No files found in the vault catalog.
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-primaryAccent/30 hover:bg-primaryAccent/5 transition-all group"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-[12px] font-bold text-gray-700 truncate">{file.file_name}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            Path: <span className="font-mono">{file.drive_folder_path}</span> · {new Date(file.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleShareFile(file)}
                          className="px-3 py-1.5 bg-primaryAccent hover:bg-indigo-600 text-white font-semibold text-[10px] rounded-lg transition-all shrink-0 shadow-sm"
                        >
                          Share Link
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
            
            <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between mt-4 shrink-0">
              <span>Files are securely synced and stored in date-partitioned folders.</span>
              <a href="/employee/files" className="text-primaryAccent hover:underline font-semibold">View File Vault →</a>
            </div>
          </div>
        </div>
      )}

    </TeamsShell>
  );
}
