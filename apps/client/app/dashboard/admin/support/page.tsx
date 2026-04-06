"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, API_BASE } from "../../../../lib/api";

interface TicketAttachment {
  url: string;
  name: string;
  type?: "image" | "document";
  mimeType?: string;
}

interface TicketResponse {
  id: string;
  adminId: string;
  channel: "EMAIL" | "CHAT";
  message: string;
  emailSent: boolean;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  userId?: string;
  user?: {
    id: string;
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
  };
  name?: string;
  email?: string;
  assignedTo?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  conversationId?: string;
  resolution?: string;
  adminNotes?: string;
  attachments?: TicketAttachment[];
  responses?: TicketResponse[];
  createdAt: string;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail view
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [responseText, setResponseText] = useState("");
  const [responseChannel, setResponseChannel] = useState<
    "EMAIL" | "CHAT" | "BOTH"
  >("EMAIL");
  const [submitting, setSubmitting] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const responseEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ scope });
    if (statusFilter) params.set("status", statusFilter);
    const res = await api<{ tickets: SupportTicket[] }>(
      `/support/admin/tickets?${params}`,
    );
    if (res.data) {
      const items = res.data.tickets || [];
      const filtered = items.filter(
        (t) =>
          t.category !== "EMPLOYER_SURVEY" &&
          t.category !== "PROVIDER_SURVEY" &&
          t.category !== "ABUSE" &&
          t.category !== "SECURITY",
      );
      setTickets(filtered);
    } else {
      setTickets([]);
    }
    setLoading(false);
  }, [scope, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const fetchTicketDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    const res = await api<SupportTicket>(`/support/admin/tickets/${id}`);
    if (res.data) setTicketDetail(res.data);
    setLoadingDetail(false);
  }, []);

  const openDetail = (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id);
    setTicketDetail(null);
    fetchTicketDetail(ticket.id);
  };

  const closeDetail = () => {
    setSelectedTicketId(null);
    setTicketDetail(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setResolution("");
    setResponseText("");
    setResponseChannel("EMAIL");
    setInternalNote("");
  };

  const handleAssign = async (id: string) => {
    setActionLoading(id);
    await api(`/support/admin/tickets/${id}/assign`, { method: "POST" });
    setActionLoading(null);
    fetchTickets();
    if (selectedTicketId === id) fetchTicketDetail(id);
  };

  const handleResolve = async () => {
    if (!selectedTicketId || !resolution.trim()) return;
    setSubmitting(true);
    await api(`/support/admin/tickets/${selectedTicketId}/resolve`, {
      method: "POST",
      body: { resolution },
    });
    setSubmitting(false);
    closeModal();
    fetchTickets();
    fetchTicketDetail(selectedTicketId);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    await api(`/support/admin/tickets/${id}/status`, {
      method: "POST",
      body: { status },
    });
    setActionLoading(null);
    fetchTickets();
    if (selectedTicketId === id) fetchTicketDetail(id);
  };

  const handleRespond = async () => {
    if (!selectedTicketId || !responseText.trim()) return;
    setSubmitting(true);
    await api(`/support/admin/tickets/${selectedTicketId}/respond`, {
      method: "POST",
      body: { response: responseText.trim(), channel: responseChannel },
    });
    setSubmitting(false);
    closeModal();
    fetchTickets();
    fetchTicketDetail(selectedTicketId);
  };

  const handleAddNote = async () => {
    if (!selectedTicketId || !internalNote.trim()) return;
    setSubmitting(true);
    await api(`/support/admin/tickets/${selectedTicketId}/status`, {
      method: "POST",
      body: {
        status: ticketDetail?.status || "IN_PROGRESS",
        notes: internalNote.trim(),
      },
    });
    setSubmitting(false);
    setInternalNote("");
    setActiveModal(null);
    fetchTickets();
    fetchTicketDetail(selectedTicketId);
  };

  const priorityColor = (p: string) => {
    if (p === "URGENT") return "bg-red-500/20 text-red-300";
    if (p === "HIGH") return "bg-orange-500/20 text-orange-300";
    if (p === "NORMAL") return "bg-yellow-500/20 text-yellow-300";
    return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
  };

  const statusColorFn = (s: string) => {
    if (s === "OPEN") return "bg-yellow-500/20 text-yellow-300";
    if (s === "IN_PROGRESS") return "bg-blue-500/20 text-blue-300";
    if (s === "WAITING_USER_RESPONSE")
      return "bg-purple-500/20 text-purple-300";
    if (s === "ESCALATED_KYC") return "bg-orange-500/20 text-orange-300";
    if (s === "ESCALATED_ADMIN") return "bg-red-500/20 text-red-300";
    if (s === "ESCALATED_BUG_TEAM") return "bg-pink-500/20 text-pink-300";
    if (s === "RESOLVED") return "bg-green-500/20 text-green-300";
    if (s === "CLOSED")
      return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
    return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      OPEN: "Open",
      IN_PROGRESS: "In Progress",
      WAITING_USER_RESPONSE: "Waiting Response",
      ESCALATED_KYC: "Escalated: KYC",
      ESCALATED_ADMIN: "Escalated: Admin",
      ESCALATED_BUG_TEAM: "Escalated: Bug Team",
      RESOLVED: "Resolved",
      CLOSED: "Closed",
    };
    return labels[s] || s.replace(/_/g, " ");
  };

  const resolveAttachmentUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE.replace(/\/+$/, "")}/${url.startsWith("/") ? url.slice(1) : url}`;
  };

  /** Parse attachment paths embedded in the message text and return clean message + attachments */
  const parseMessageAttachments = (
    message: string,
    existingAttachments?: TicketAttachment[],
  ): { cleanMessage: string; attachments: TicketAttachment[] } => {
    if (existingAttachments && existingAttachments.length > 0) {
      return { cleanMessage: message, attachments: existingAttachments };
    }
    const attachmentRegex = /\n\nAttachments:\n((?:- .+\n?)+)/;
    const match = message.match(attachmentRegex);
    if (!match) return { cleanMessage: message, attachments: [] };
    const cleanMessage = message.replace(attachmentRegex, "").trimEnd();
    const lines = match[1].split("\n").filter((l) => l.startsWith("- "));
    const attachments: TicketAttachment[] = lines.map((line) => {
      const path = line.replace(/^- /, "").trim();
      const name = path.split("/").pop() || path;
      const ext = name.split(".").pop()?.toLowerCase() || "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
        ext,
      );
      return { url: path, name, type: isImage ? "image" : "document" };
    });
    return { cleanMessage, attachments };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {selectedTicketId && (
            <button
              onClick={closeDetail}
              className="mb-2 flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              ← Back to Tickets
            </button>
          )}
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {selectedTicketId ? "Ticket Details" : "Support Tickets"}
          </h1>
          {!selectedTicketId && (
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              Manage user support requests and issues.
            </p>
          )}
        </div>
        {!selectedTicketId && (
          <span className="rounded-full bg-[var(--soft-blue)]/20 px-3 py-1 text-xs font-semibold text-[var(--soft-blue)]">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* =================== LIST VIEW =================== */}
      {!selectedTicketId && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
              {(["all", "mine", "unassigned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${scope === s ? "bg-[var(--primary)] text-white" : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
              {[
                { value: "", label: "All" },
                { value: "OPEN", label: "Open" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "WAITING_USER_RESPONSE", label: "Waiting" },
                { value: "ESCALATED_KYC", label: "KYC" },
                { value: "ESCALATED_ADMIN", label: "Admin" },
                { value: "ESCALATED_BUG_TEAM", label: "Bug" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "CLOSED", label: "Closed" },
              ].map((s) => (
                <button
                  key={s.value || "all-status"}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${statusFilter === s.value ? "bg-[var(--primary)] text-white" : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
              <p className="text-[var(--muted-text)]">
                No support tickets found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => openDetail(ticket)}
                  className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        {ticket.ticketNumber && (
                          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[var(--muted-text)]">
                            {ticket.ticketNumber}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColorFn(ticket.status)}`}
                        >
                          {ticket.status}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${priorityColor(ticket.priority)}`}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                        {ticket.subject}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted-text)]">
                        {ticket.user
                          ? `${ticket.user.firstName || ""} ${ticket.user.lastName || ""}`.trim() ||
                            ticket.user.email
                          : ticket.name || "Anonymous"}
                        {(ticket.user?.email || ticket.email) &&
                          ` (${ticket.user?.email || ticket.email})`}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground)]/70 line-clamp-2">
                        {
                          parseMessageAttachments(
                            ticket.message,
                            ticket.attachments,
                          ).cleanMessage
                        }
                      </p>
                      {(() => {
                        const { attachments } = parseMessageAttachments(
                          ticket.message,
                          ticket.attachments,
                        );
                        return attachments.length > 0 ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--muted-text)]">
                            📎 {attachments.length} attachment
                            {attachments.length !== 1 ? "s" : ""}
                          </span>
                        ) : null;
                      })()}
                      <div className="mt-2 text-[10px] text-[var(--muted-text)]">
                        Created:{" "}
                        {new Date(ticket.createdAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                        {ticket.assignedTo && (
                          <span className="ml-3">Assigned</span>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-[var(--muted-text)]">
                      View →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =================== DETAIL VIEW =================== */}
      {selectedTicketId && (
        <>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : ticketDetail ? (
            (() => {
              const t = ticketDetail;
              const userName = t.user
                ? `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() ||
                  t.user.email
                : t.name || "Anonymous";
              const userEmail = t.user?.email || t.email || "No email";
              const userPhone = t.user?.phone || null;

              return (
                <div className="space-y-5">
                  {/* Ticket Number */}
                  {t.ticketNumber && (
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 text-center">
                      <p className="text-[10px] uppercase text-[var(--muted-text)]">
                        Ticket Number
                      </p>
                      <p className="mt-1 text-lg font-bold text-purple-400 font-mono">
                        {t.ticketNumber}
                      </p>
                    </div>
                  )}

                  {/* Contact Information */}
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                      CONTACT INFORMATION
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-[var(--muted-text)]">
                        👤{" "}
                        <span className="text-[var(--foreground)]">
                          {userName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--muted-text)]">
                        ✉️{" "}
                        <span className="text-[var(--foreground)]">
                          {userEmail}
                        </span>
                      </div>
                      {userPhone && (
                        <div className="flex items-center gap-2 text-[var(--muted-text)]">
                          📱{" "}
                          <span className="text-[var(--foreground)]">
                            {userPhone}
                          </span>
                        </div>
                      )}
                      {t.userId && (
                        <div className="flex items-center gap-2 text-[var(--muted-text)]">
                          🆔{" "}
                          <span className="text-[var(--foreground)] font-mono text-xs">
                            {t.userId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ticket Details */}
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                      TICKET DETAILS
                    </h3>
                    <h4 className="text-base font-semibold text-[var(--foreground)]">
                      {t.subject}
                    </h4>
                    {(() => {
                      const { cleanMessage, attachments: parsedAtts } =
                        parseMessageAttachments(t.message, t.attachments);
                      return (
                        <>
                          <p className="mt-2 text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                            {cleanMessage}
                          </p>

                          {/* Attachments */}
                          {parsedAtts.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-medium text-[var(--muted-text)] mb-2">
                                Attachments ({parsedAtts.length})
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {parsedAtts.map((att, i) => {
                                  const fullUrl = resolveAttachmentUrl(att.url);
                                  const isImage =
                                    att.type === "image" ||
                                    att.mimeType?.startsWith("image/");
                                  return (
                                    <a
                                      key={i}
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-2 transition-colors hover:border-[var(--primary)]/30 block"
                                    >
                                      {isImage ? (
                                        <img
                                          src={fullUrl}
                                          alt={att.name}
                                          className="h-24 w-full rounded object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-24 w-full items-center justify-center rounded bg-[var(--surface-alt)]">
                                          <span className="text-2xl">📄</span>
                                        </div>
                                      )}
                                      <p className="mt-1.5 truncate text-[10px] text-[var(--muted-text)] group-hover:text-[var(--foreground)]">
                                        {att.name}
                                      </p>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Badges */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${priorityColor(t.priority)}`}
                      >
                        {t.priority}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColorFn(t.status)}`}
                      >
                        {statusLabel(t.status)}
                      </span>
                      <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-300">
                        {t.category}
                      </span>
                    </div>

                    <p className="mt-3 text-[10px] text-[var(--muted-text)]">
                      Created:{" "}
                      {new Date(t.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {t.assignedTo && <span className="ml-3">· Assigned</span>}
                    </p>
                  </div>

                  {/* Resolution */}
                  {t.resolution && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5">
                      <h3 className="text-sm font-bold text-green-400 mb-2">
                        RESOLUTION
                      </h3>
                      <p className="text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                        {t.resolution}
                      </p>
                    </div>
                  )}

                  {/* Admin Notes */}
                  {t.adminNotes && (
                    <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-5">
                      <h3 className="text-sm font-bold text-[var(--primary)] mb-2">
                        ADMIN NOTES
                      </h3>
                      <p className="text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                        {t.adminNotes}
                      </p>
                    </div>
                  )}

                  {/* Escalation Info */}
                  {t.escalatedTo && (
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
                      <h3 className="text-sm font-bold text-orange-400 mb-2">
                        ESCALATION
                      </h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColorFn(t.status)}`}
                        >
                          {statusLabel(t.status)}
                        </span>
                        <span className="text-[var(--muted-text)]">
                          Escalated to{" "}
                          <strong className="text-[var(--foreground)]">
                            {t.escalatedTo}
                          </strong>
                        </span>
                        {t.escalatedAt && (
                          <span className="text-[10px] text-[var(--muted-text)]">
                            {new Date(t.escalatedAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Response History */}
                  {t.responses && t.responses.length > 0 && (
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                      <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                        RESPONSE HISTORY
                      </h3>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {t.responses.map((resp) => (
                          <div
                            key={resp.id}
                            className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  resp.channel === "EMAIL"
                                    ? "bg-blue-500/20 text-blue-300"
                                    : "bg-green-500/20 text-green-300"
                                }`}
                              >
                                {resp.channel === "EMAIL"
                                  ? "✉️ Email"
                                  : "💬 Chat"}
                              </span>
                              {resp.channel === "EMAIL" && (
                                <span
                                  className={`text-[10px] ${resp.emailSent ? "text-green-400" : "text-red-400"}`}
                                >
                                  {resp.emailSent ? "Delivered" : "Failed"}
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-[var(--muted-text)]">
                                {new Date(resp.createdAt).toLocaleDateString(
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
                            <p className="text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                              {resp.message}
                            </p>
                          </div>
                        ))}
                        <div ref={responseEndRef} />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                      ACTIONS
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {!t.assignedTo && t.status === "OPEN" && (
                        <button
                          onClick={() => handleAssign(t.id)}
                          disabled={actionLoading === t.id}
                          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50"
                        >
                          📌 Assign to Me
                        </button>
                      )}
                      {t.status === "OPEN" && (
                        <button
                          onClick={() =>
                            handleStatusChange(t.id, "IN_PROGRESS")
                          }
                          disabled={actionLoading === t.id}
                          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--soft-blue)]/20 px-3 py-2.5 text-xs font-medium text-blue-300 hover:bg-[var(--soft-blue)]/30 transition-colors disabled:opacity-50"
                        >
                          🔄 Mark In Progress
                        </button>
                      )}
                      {t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                        <button
                          onClick={() => {
                            setResolution("");
                            setActiveModal("resolve");
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg bg-green-500/20 px-3 py-2.5 text-xs font-medium text-green-300 hover:bg-green-500/30 transition-colors"
                        >
                          ✅ Resolve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setResponseText("");
                          setResponseChannel("EMAIL");
                          setActiveModal("respond");
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition-colors"
                      >
                        💬 Respond to User
                      </button>
                      <button
                        onClick={() => {
                          setInternalNote("");
                          setActiveModal("note");
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/10 transition-colors"
                      >
                        📝 Add Note
                      </button>
                    </div>

                    {/* Escalation Row */}
                    {t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                        <p className="text-[10px] font-medium text-[var(--muted-text)] mb-2 uppercase">
                          Escalate Ticket
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              handleStatusChange(t.id, "ESCALATED_KYC")
                            }
                            disabled={actionLoading === t.id}
                            className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                          >
                            🔐 KYC Team
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(t.id, "ESCALATED_ADMIN")
                            }
                            disabled={actionLoading === t.id}
                            className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            👑 Admin
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(t.id, "ESCALATED_BUG_TEAM")
                            }
                            disabled={actionLoading === t.id}
                            className="rounded-lg bg-pink-500/10 px-3 py-2 text-xs font-medium text-pink-300 hover:bg-pink-500/20 transition-colors disabled:opacity-50"
                          >
                            🐛 Bug Team
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
              <p className="text-[var(--muted-text)]">
                Failed to load ticket details.
              </p>
            </div>
          )}

          {/* Resolve Modal */}
          {activeModal === "resolve" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  Resolve Ticket
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  {ticketDetail?.subject}
                </p>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describe the resolution..."
                  rows={4}
                  className="mt-4 w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolve}
                    disabled={!resolution.trim() || submitting}
                    className="rounded-lg bg-[var(--achievement-green)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Resolve"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Respond Modal */}
          {activeModal === "respond" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  Respond to User
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  Send a response message to the user regarding this ticket.
                </p>

                {/* Channel Selector */}
                <div className="mt-4">
                  <p className="text-[10px] font-medium text-[var(--muted-text)] mb-2 uppercase">
                    Response Channel
                  </p>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--background)] overflow-hidden">
                    {[
                      {
                        value: "EMAIL" as const,
                        label: "✉️ Email",
                        desc: "Send branded email",
                      },
                      {
                        value: "CHAT" as const,
                        label: "💬 Chat",
                        desc: "In-app message",
                      },
                      {
                        value: "BOTH" as const,
                        label: "📨 Both",
                        desc: "Email + Chat",
                      },
                    ].map((ch) => (
                      <button
                        key={ch.value}
                        onClick={() => setResponseChannel(ch.value)}
                        className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                          responseChannel === ch.value
                            ? "bg-[var(--primary)] text-white"
                            : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                        }`}
                      >
                        <span className="block">{ch.label}</span>
                        <span className="block text-[9px] opacity-70 mt-0.5">
                          {ch.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response..."
                  rows={5}
                  className="mt-4 w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={!responseText.trim() || submitting}
                    className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting
                      ? "Sending..."
                      : responseChannel === "BOTH"
                        ? "Send via Email & Chat"
                        : responseChannel === "CHAT"
                          ? "Send via Chat"
                          : "Send via Email"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Internal Note Modal */}
          {activeModal === "note" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  Add Internal Note
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  This note is visible to admins only, not sent to the user.
                </p>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Write an internal note..."
                  rows={4}
                  className="mt-4 w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!internalNote.trim() || submitting}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
