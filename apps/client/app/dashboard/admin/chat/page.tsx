"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api, resolveAvatarUrl } from "../../../../lib/api";

interface Participant {
  userId: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface Message {
  id: string;
  body: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  senderUserId: string;
  senderRole: string;
}

interface Conversation {
  id: string;
  type: string;
  title: string | null;
  jobId: string | null;
  locked: boolean;
  paused: boolean;
  updatedAt: string;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderUserId: string;
  } | null;
  participants: Participant[];
}

interface EmailThread {
  email: string;
  count: number;
  lastEmailAt: string;
  lastSubject: string;
  lastBody: string;
  context: string | null;
  userId: string | null;
}

interface AdminEmailRecord {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  direction: string;
  context: string | null;
  createdAt: string;
}

type Tab = "SUPPORT" | "JOB" | "EMAIL";

export default function AdminChatPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("SUPPORT");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatMode, setNewChatMode] = useState<"ticket" | "email" | null>(
    null,
  );
  const [newChatInput, setNewChatInput] = useState("");
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatError, setNewChatError] = useState("");

  const [closingChat, setClosingChat] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const isFirstMsgLoad = useRef(true);
  const lastMsgCountRef = useRef(0);

  // ─── Email State ───
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [emailThreadsTotal, setEmailThreadsTotal] = useState(0);
  const [emailPage, setEmailPage] = useState(1);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [activeEmailThread, setActiveEmailThread] = useState<string | null>(
    null,
  ); // recipient email
  const [emailMessages, setEmailMessages] = useState<AdminEmailRecord[]>([]);
  const [loadingEmailThread, setLoadingEmailThread] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailContext, setEmailContext] = useState("");
  const [emailUserId, setEmailUserId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showComposeEmail, setShowComposeEmail] = useState(false);

  const fetchConversations = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      type: activeTab,
    });
    const res = await api<{
      conversations: Conversation[];
      total: number;
    }>(`/chat/admin/conversations?${params}`);
    if (res.data) {
      setConversations(res.data.conversations || []);
      setTotal(res.data.total || 0);
    } else {
      setConversations([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, activeTab]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle deep-link from users page: ?startChat=userId
  useEffect(() => {
    const startChatUserId = searchParams.get("startChat");
    if (startChatUserId) {
      handleStartByUser(startChatUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setActiveConv(conv);
    setMessages([]);
    isFirstMsgLoad.current = true;
    lastMsgCountRef.current = 0;
    fetchMessages(conv.id);
  };

  const openConversationById = async (convId: string) => {
    const params = new URLSearchParams({
      page: "1",
      pageSize: "100",
      type: "SUPPORT",
    });
    const res = await api<{
      conversations: Conversation[];
      total: number;
    }>(`/chat/admin/conversations?${params}`);
    const conv = res.data?.conversations?.find((c) => c.id === convId);
    if (conv) {
      setActiveTab("SUPPORT");
      openConversation(conv);
    } else {
      setActiveConvId(convId);
      setActiveConv({
        id: convId,
        type: "SUPPORT",
        title: "Support Chat",
        jobId: null,
        locked: false,
        paused: false,
        updatedAt: new Date().toISOString(),
        lastMessage: null,
        participants: [],
      });
      fetchMessages(convId);
    }
  };

  const fetchMessages = async (convId: string) => {
    if (isFirstMsgLoad.current) setLoadingMessages(true);
    const res = await api<Message[]>(
      `/chat/admin/conversations/${convId}/messages?pageSize=100`,
    );
    if (res.data) {
      const newCount = res.data.length;
      if (newCount !== lastMsgCountRef.current || isFirstMsgLoad.current) {
        setMessages(res.data);
        lastMsgCountRef.current = newCount;
      }
    }
    isFirstMsgLoad.current = false;
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => fetchMessages(activeConvId), 8000);
    return () => clearInterval(interval);
  }, [activeConvId]);

  const handleSend = async () => {
    if (!activeConvId || !msgText.trim()) return;
    setSending(true);
    await api(`/chat/admin/conversations/${activeConvId}/messages`, {
      method: "POST",
      body: { body: msgText.trim() },
    });
    setMsgText("");
    setSending(false);
    fetchMessages(activeConvId);
    fetchConversations();
  };

  const closeDetail = () => {
    setActiveConvId(null);
    setActiveConv(null);
    setMessages([]);
    isFirstMsgLoad.current = true;
    lastMsgCountRef.current = 0;
  };

  const participantName = (p: Participant) => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    return name || p.email || p.userId.slice(-6);
  };

  const convDisplayName = (conv: Conversation) => {
    if (conv.title) return conv.title;
    const nonAdmin = conv.participants.filter((p) => p.role !== "ADMIN");
    if (nonAdmin.length > 0) return nonAdmin.map(participantName).join(", ");
    return conv.participants.map(participantName).join(", ") || "Conversation";
  };

  const totalPages = Math.ceil(total / 20);

  const resetNewChatModal = () => {
    setShowNewChat(false);
    setNewChatMode(null);
    setNewChatInput("");
    setNewChatError("");
    setNewChatLoading(false);
  };

  const handleStartByTicket = async () => {
    if (!newChatInput.trim()) return;
    setNewChatLoading(true);
    setNewChatError("");
    const res = await api<{ id: string; existing: boolean }>(
      "/chat/admin/conversations/start-by-ticket",
      { method: "POST", body: { ticketNumber: newChatInput.trim() } },
    );
    setNewChatLoading(false);
    if (res.error) {
      setNewChatError(
        typeof res.error === "string"
          ? res.error
          : (res.error as { message?: string })?.message ||
              "Failed to start chat",
      );
      return;
    }
    if (res.data?.id) {
      resetNewChatModal();
      await fetchConversations();
      openConversationById(res.data.id);
    }
  };

  const handleStartByEmail = async () => {
    if (!newChatInput.trim()) return;
    setNewChatLoading(true);
    setNewChatError("");
    const res = await api<{ id: string; existing: boolean }>(
      "/chat/admin/conversations/start-by-email",
      { method: "POST", body: { email: newChatInput.trim().toLowerCase() } },
    );
    setNewChatLoading(false);
    if (res.error) {
      setNewChatError(
        typeof res.error === "string"
          ? res.error
          : (res.error as { message?: string })?.message ||
              "Failed to start chat",
      );
      return;
    }
    if (res.data?.id) {
      resetNewChatModal();
      await fetchConversations();
      openConversationById(res.data.id);
    }
  };

  const handleStartByUser = async (userId: string) => {
    const res = await api<{ id: string; existing: boolean }>(
      "/chat/admin/conversations/start-by-user",
      { method: "POST", body: { userId } },
    );
    if (res.data?.id) {
      setActiveTab("SUPPORT");
      await fetchConversations();
      openConversationById(res.data.id);
    }
  };

  const handleCloseChat = async () => {
    if (!activeConvId) return;
    setClosingChat(true);
    await api(`/chat/admin/conversations/${activeConvId}/close`, {
      method: "POST",
    });
    setClosingChat(false);
    if (activeConv) {
      setActiveConv({ ...activeConv, locked: true, paused: false });
    }
    fetchConversations();
  };

  const handlePauseChat = async () => {
    if (!activeConvId) return;
    setActionLoading(true);
    await api(`/chat/admin/conversations/${activeConvId}/pause`, {
      method: "POST",
    });
    setActionLoading(false);
    if (activeConv) {
      setActiveConv({ ...activeConv, paused: true });
    }
    fetchConversations();
  };

  const handleReopenChat = async () => {
    if (!activeConvId) return;
    setActionLoading(true);
    await api(`/chat/admin/conversations/${activeConvId}/reopen`, {
      method: "POST",
    });
    setActionLoading(false);
    if (activeConv) {
      setActiveConv({ ...activeConv, locked: false, paused: false });
    }
    fetchConversations();
  };

  // ─── Email Functions ───
  const fetchEmailThreads = useCallback(async () => {
    setLoadingEmails(true);
    const res = await api<{
      threads: EmailThread[];
      total: number;
    }>(`/email/admin/threads?page=${emailPage}&pageSize=20`);
    if (res.data) {
      setEmailThreads(res.data.threads || []);
      setEmailThreadsTotal(res.data.total || 0);
    }
    setLoadingEmails(false);
  }, [emailPage]);

  useEffect(() => {
    if (activeTab === "EMAIL") fetchEmailThreads();
  }, [activeTab, fetchEmailThreads]);

  const openEmailThread = async (email: string) => {
    setActiveEmailThread(email);
    setEmailTo(email);
    setLoadingEmailThread(true);
    const res = await api<AdminEmailRecord[]>(
      `/email/admin/threads/${encodeURIComponent(email)}`,
    );
    if (res.data) setEmailMessages(res.data);
    setLoadingEmailThread(false);
  };

  const closeEmailThread = () => {
    setActiveEmailThread(null);
    setEmailMessages([]);
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
    setEmailContext("");
    setEmailUserId(null);
    setShowComposeEmail(false);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    setEmailSent(false);
    const res = await api<{ id: string; sent: boolean }>("/email/admin/send", {
      method: "POST",
      body: {
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: emailBody.trim(),
        userId: emailUserId || undefined,
        context: emailContext || undefined,
      },
    });
    setSendingEmail(false);
    if (res.data) {
      setEmailSent(true);
      setEmailBody("");
      setEmailSubject("");
      // Refresh thread
      if (activeEmailThread) {
        openEmailThread(activeEmailThread);
      } else {
        // New compose — open the thread for this recipient
        setActiveEmailThread(emailTo.trim());
        openEmailThread(emailTo.trim());
        setShowComposeEmail(false);
      }
      fetchEmailThreads();
      setTimeout(() => setEmailSent(false), 3000);
    }
  };

  // Handle deep-link: ?startEmail=userId
  useEffect(() => {
    const startEmailUserId = searchParams.get("startEmail");
    const emailCtx = searchParams.get("emailContext");
    const emailAddr = searchParams.get("emailTo");
    const emailSubj = searchParams.get("emailSubject");
    if (startEmailUserId || emailAddr) {
      setActiveTab("EMAIL");
      if (emailCtx) setEmailContext(emailCtx);
      if (emailSubj) setEmailSubject(emailSubj);
      if (startEmailUserId) {
        setEmailUserId(startEmailUserId);
        // Fetch user's email thread
        (async () => {
          const res = await api<{
            messages: AdminEmailRecord[];
            user: { email: string; firstName: string; lastName: string } | null;
          }>(`/email/admin/threads/by-user/${startEmailUserId}`);
          if (res.data?.user) {
            setEmailTo(res.data.user.email);
            setActiveEmailThread(res.data.user.email);
            setEmailMessages(res.data.messages || []);
            if (!emailSubj)
              setEmailSubject(
                `KYC Verification — ${res.data.user.firstName || ""} ${res.data.user.lastName || ""}`.trim(),
              );
          }
          setShowComposeEmail(true);
        })();
      } else if (emailAddr) {
        setEmailTo(emailAddr);
        setActiveEmailThread(emailAddr);
        openEmailThread(emailAddr);
        setShowComposeEmail(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailTotalPages = Math.ceil(emailThreadsTotal / 20);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {(activeConvId || activeEmailThread) && (
            <button
              onClick={() => {
                activeEmailThread ? closeEmailThread() : closeDetail();
              }}
              className="mb-2 flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              {"← Back"}
            </button>
          )}
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {activeConvId
              ? "Chat"
              : activeEmailThread
                ? "Email"
                : "Communication"}
          </h1>
          {!activeConvId && !activeEmailThread && (
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              View and manage all user conversations and emails.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!activeConvId && !activeEmailThread && activeTab === "EMAIL" && (
            <button
              onClick={() => {
                setShowComposeEmail(true);
                setEmailTo("");
                setEmailSubject("");
                setEmailBody("");
              }}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              + New Email
            </button>
          )}
          {!activeConvId && !activeEmailThread && activeTab !== "EMAIL" && (
            <>
              <button
                onClick={() => setShowNewChat(true)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                + New Support Chat
              </button>
              <span className="rounded-full bg-[var(--soft-blue)]/20 px-3 py-1 text-xs font-semibold text-[var(--soft-blue)]">
                {total} conversation{total !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      </div>

      {/* =================== LIST VIEW =================== */}
      {!activeConvId && !activeEmailThread && (
        <>
          {/* Tabs */}
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
              {[
                { value: "SUPPORT" as Tab, label: "Support Chats" },
                { value: "JOB" as Tab, label: "User Chats" },
                { value: "EMAIL" as Tab, label: "Emails" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveTab(tab.value);
                    setPage(1);
                  }}
                  className={`px-5 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.value
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List (Support / Job tabs) */}
          {activeTab !== "EMAIL" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
                  <p className="text-[var(--muted-text)]">
                    {activeTab === "SUPPORT"
                      ? 'No support conversations yet. Click "+ New Support Chat" to start one.'
                      : "No user conversations found."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => openConversation(conv)}
                        className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]/30"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  conv.type === "SUPPORT"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {conv.type === "SUPPORT"
                                  ? "Support"
                                  : "User Chat"}
                              </span>
                              {conv.locked && (
                                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                                  Closed
                                </span>
                              )}
                              {!conv.locked && conv.paused && (
                                <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                                  Paused
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1.5 text-sm font-semibold text-[var(--foreground)] truncate">
                              {convDisplayName(conv)}
                            </h3>
                            {conv.lastMessage && (
                              <p className="mt-1 text-xs text-[var(--muted-text)] truncate">
                                {conv.lastMessage.body}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--muted-text)]">
                              <span>
                                {conv.participants.length} participant
                                {conv.participants.length !== 1 ? "s" : ""}
                              </span>
                              <span>
                                {"Updated: "}
                                {new Date(conv.updatedAt).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                          <span className="flex-shrink-0 text-xs text-[var(--muted-text)]">
                            {"Open →"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[var(--muted-text)]">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* =================== EMAIL LIST VIEW =================== */}
          {activeTab === "EMAIL" && (
            <>
              {loadingEmails ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                </div>
              ) : emailThreads.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
                  <p className="text-[var(--muted-text)]">
                    {'No emails sent yet. Click "+ New Email" to compose one.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {emailThreads.map((thread) => (
                      <div
                        key={thread.email}
                        onClick={() => openEmailThread(thread.email)}
                        className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]/30"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                Email
                              </span>
                              {thread.context && (
                                <span className="rounded-full bg-blue-200 text-blue-900 border border-blue-400 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                                  {thread.context}
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--muted-text)]">
                                {thread.count} email
                                {thread.count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <h3 className="mt-1.5 text-sm font-semibold text-[var(--foreground)] truncate">
                              {thread.email}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--muted-text)] truncate">
                              <span className="font-medium">
                                {thread.lastSubject}
                              </span>
                              {" — "}
                              {thread.lastBody.slice(0, 80)}
                              {thread.lastBody.length > 80 ? "…" : ""}
                            </p>
                            <div className="mt-1.5 text-[10px] text-[var(--muted-text)]">
                              Last email:{" "}
                              {new Date(thread.lastEmailAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          </div>
                          <span className="flex-shrink-0 text-xs text-[var(--muted-text)]">
                            {"Open →"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {emailTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEmailPage((p) => Math.max(1, p - 1))}
                        disabled={emailPage === 1}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[var(--muted-text)]">
                        Page {emailPage} of {emailTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          setEmailPage((p) => Math.min(emailTotalPages, p + 1))
                        }
                        disabled={emailPage === emailTotalPages}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* =================== EMAIL THREAD VIEW =================== */}
      {activeEmailThread && (
        <div
          className="flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden"
          style={{ height: "calc(100vh - 220px)" }}
        >
          {/* Email Thread Header */}
          <div className="border-b border-[var(--border-color)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                  Email
                </span>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {activeEmailThread}
                </h3>
              </div>
              <button
                onClick={() => setShowComposeEmail(!showComposeEmail)}
                className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                {showComposeEmail ? "Hide Compose" : "Compose Email"}
              </button>
            </div>
          </div>

          {/* Compose Section */}
          {showComposeEmail && (
            <div className="border-b border-[var(--border-color)] bg-[var(--background)] p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                    To
                  </label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                    placeholder="recipient@example.com"
                  />
                </div>
                <div className="w-32">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                    Context
                  </label>
                  <select
                    value={emailContext}
                    onChange={(e) => setEmailContext(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none"
                  >
                    <option value="">General</option>
                    <option value="KYC">KYC</option>
                    <option value="SUPPORT">Support</option>
                    <option value="BILLING">Billing</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  placeholder="Email subject..."
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                  placeholder="Type your email message..."
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[var(--muted-text)]">
                  From: support@nasta.app
                </p>
                <div className="flex items-center gap-2">
                  {emailSent && (
                    <span className="text-xs font-medium text-green-600">
                      ✓ Sent
                    </span>
                  )}
                  <button
                    onClick={handleSendEmail}
                    disabled={
                      !emailTo.trim() ||
                      !emailSubject.trim() ||
                      !emailBody.trim() ||
                      sendingEmail
                    }
                    className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingEmailThread ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </div>
            ) : emailMessages.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-[var(--muted-text)]">
                  No emails yet. Compose your first email above.
                </p>
              </div>
            ) : (
              emailMessages.map((em) => {
                const isOutbound = em.direction === "OUTBOUND";
                return (
                  <div
                    key={em.id}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        isOutbound
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-medium ${isOutbound ? "text-white/70" : "text-[var(--muted-text)]"}`}
                        >
                          {isOutbound ? "ADMIN → " + em.to : em.from}
                        </span>
                        <span
                          className={`text-[9px] ${isOutbound ? "text-white/50" : "text-[var(--muted-text)]"}`}
                        >
                          {new Date(em.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-xs font-semibold mb-1 ${isOutbound ? "text-white/90" : "text-[var(--foreground)]"}`}
                      >
                        {em.subject}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{em.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================== CHAT VIEW =================== */}
      {activeConvId && activeConv && (
        <div
          className="flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden"
          style={{ height: "calc(100vh - 220px)" }}
        >
          <div className="border-b border-[var(--border-color)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    activeConv.type === "SUPPORT"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-blue-500/20 text-blue-300"
                  }`}
                >
                  {activeConv.type === "SUPPORT" ? "Support" : "User Chat"}
                </span>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {convDisplayName(activeConv)}
                </h3>
                {activeConv.locked && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                    Closed
                  </span>
                )}
                {!activeConv.locked && activeConv.paused && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                    Paused
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(activeConv.locked || activeConv.paused) && (
                  <button
                    onClick={handleReopenChat}
                    disabled={actionLoading}
                    className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "..." : "Reopen Chat"}
                  </button>
                )}
                {!activeConv.locked && !activeConv.paused && (
                  <button
                    onClick={handlePauseChat}
                    disabled={actionLoading}
                    className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "..." : "Pause Chat"}
                  </button>
                )}
                {!activeConv.locked && (
                  <button
                    onClick={handleCloseChat}
                    disabled={closingChat}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    {closingChat ? "..." : "End Chat"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {activeConv.participants.map((p) => (
                <span
                  key={p.userId}
                  className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] text-[var(--muted-text)]"
                >
                  {participantName(p)}{" "}
                  <span className="opacity-60">({p.role})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-[var(--muted-text)]">
                  No messages yet. Send the first message to start the
                  conversation.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAdmin = msg.senderRole === "ADMIN";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isAdmin
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-medium ${
                            isAdmin
                              ? "text-white/70"
                              : "text-[var(--muted-text)]"
                          }`}
                        >
                          {msg.senderRole}
                        </span>
                        <span
                          className={`text-[9px] ${
                            isAdmin
                              ? "text-white/50"
                              : "text-[var(--muted-text)]"
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      {msg.payload &&
                        typeof msg.payload === "object" &&
                        "fileUrl" in msg.payload && (
                          <div className="mt-2">
                            {(String(
                              (msg.payload as Record<string, unknown>).type,
                            ) === "image" ||
                              /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(
                                String(
                                  (msg.payload as Record<string, unknown>)
                                    .fileName || "",
                                ),
                              )) && (
                              <a
                                href={resolveAvatarUrl(
                                  String(msg.payload.fileUrl),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={resolveAvatarUrl(
                                    String(
                                      (msg.payload as Record<string, unknown>)
                                        .imageUrl || msg.payload.fileUrl,
                                    ),
                                  )}
                                  alt={String(
                                    (msg.payload as Record<string, unknown>)
                                      .fileName || "Image",
                                  )}
                                  className="max-w-[280px] max-h-[280px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                />
                              </a>
                            )}
                            <a
                              href={resolveAvatarUrl(
                                String(msg.payload.fileUrl),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-1 inline-block text-xs underline ${
                                isAdmin
                                  ? "text-white/80"
                                  : "text-[var(--primary)]"
                              }`}
                            >
                              {String(
                                (msg.payload as Record<string, unknown>)
                                  .fileName || "Attachment",
                              )}
                            </a>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!activeConv.locked && !activeConv.paused && (
            <div className="border-t border-[var(--border-color)] bg-[var(--surface)] p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                <button
                  onClick={handleSend}
                  disabled={!msgText.trim() || sending}
                  className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          )}
          {activeConv.paused && !activeConv.locked && (
            <div className="border-t border-[var(--border-color)] bg-yellow-500/5 p-4 text-center">
              <p className="text-xs text-yellow-400">
                This conversation is paused. Users cannot send messages. Click
                &quot;Reopen Chat&quot; to resume.
              </p>
            </div>
          )}
          {activeConv.locked && (
            <div className="border-t border-[var(--border-color)] bg-[var(--surface-alt)] p-4 text-center">
              <p className="text-xs text-[var(--muted-text)]">
                This conversation has been closed. No new messages can be sent.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================== NEW SUPPORT CHAT MODAL =================== */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                {newChatMode ? (
                  <button
                    onClick={() => {
                      setNewChatMode(null);
                      setNewChatInput("");
                      setNewChatError("");
                    }}
                    className="mr-2 text-sm text-[var(--primary)] hover:underline"
                  >
                    {"←"}
                  </button>
                ) : null}
                Start Support Chat
              </h2>
              <button
                onClick={resetNewChatModal}
                className="text-[var(--muted-text)] hover:text-[var(--foreground)] text-lg"
              >
                {"✕"}
              </button>
            </div>

            {!newChatMode && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-text)] mb-4">
                  Choose how to find the user:
                </p>
                <button
                  onClick={() => setNewChatMode("ticket")}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-4 text-left transition-colors hover:border-[var(--primary)]/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-lg">
                      {"🎫"}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        By Ticket Number
                      </h3>
                      <p className="text-xs text-[var(--muted-text)]">
                        Enter a support ticket number (e.g. TKT-2025-001234)
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setNewChatMode("email")}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-4 text-left transition-colors hover:border-[var(--primary)]/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-lg">
                      {"✉️"}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        By Email
                      </h3>
                      <p className="text-xs text-[var(--muted-text)]">
                        {"Enter the user's email address"}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {newChatMode === "ticket" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-text)] block mb-1.5">
                    Ticket Number
                  </label>
                  <input
                    type="text"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartByTicket();
                    }}
                    placeholder="TKT-2025-001234"
                    autoFocus
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                </div>
                {newChatError && (
                  <p className="text-xs text-red-400">{newChatError}</p>
                )}
                <button
                  onClick={handleStartByTicket}
                  disabled={!newChatInput.trim() || newChatLoading}
                  className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {newChatLoading ? "Finding user..." : "Start Chat"}
                </button>
              </div>
            )}

            {newChatMode === "email" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-text)] block mb-1.5">
                    User Email
                  </label>
                  <input
                    type="email"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartByEmail();
                    }}
                    placeholder="user@example.com"
                    autoFocus
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                </div>
                {newChatError && (
                  <p className="text-xs text-red-400">{newChatError}</p>
                )}
                <button
                  onClick={handleStartByEmail}
                  disabled={!newChatInput.trim() || newChatLoading}
                  className="w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {newChatLoading ? "Finding user..." : "Start Chat"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== COMPOSE EMAIL MODAL (from list view) =================== */}
      {showComposeEmail && !activeEmailThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Compose Email
              </h2>
              <button
                onClick={() => {
                  setShowComposeEmail(false);
                  setEmailTo("");
                  setEmailSubject("");
                  setEmailBody("");
                  setEmailContext("");
                }}
                className="text-[var(--muted-text)] hover:text-[var(--foreground)] text-lg"
              >
                {"✕"}
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                    To
                  </label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                    placeholder="recipient@example.com"
                  />
                </div>
                <div className="w-32">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                    Context
                  </label>
                  <select
                    value={emailContext}
                    onChange={(e) => setEmailContext(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none"
                  >
                    <option value="">General</option>
                    <option value="KYC">KYC</option>
                    <option value="SUPPORT">Support</option>
                    <option value="BILLING">Billing</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  placeholder="Email subject..."
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--muted-text)] block mb-1">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                  placeholder="Type your email message..."
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] text-[var(--muted-text)]">
                  From: support@nasta.app
                </p>
                <div className="flex items-center gap-2">
                  {emailSent && (
                    <span className="text-xs font-medium text-green-600">
                      ✓ Sent
                    </span>
                  )}
                  <button
                    onClick={handleSendEmail}
                    disabled={
                      !emailTo.trim() ||
                      !emailSubject.trim() ||
                      !emailBody.trim() ||
                      sendingEmail
                    }
                    className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
