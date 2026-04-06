"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "../../../../lib/api";

interface DeletionRequest {
  id: string;
  ticketNumber?: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  reason?: string;
  createdAt: string;
  reviewedAt?: string;
  adminNotes?: string;
  assignedTo?: string;
  assignedAt?: string;
  user: {
    id: string;
    publicId?: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
}

export default function AdminDeletionsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Detail view
  const [selectedRequest, setSelectedRequest] =
    useState<DeletionRequest | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "deny">(
    "approve",
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams({ scope });
    if (statusFilter) params.set("status", statusFilter);
    const res = await api<DeletionRequest[]>(
      `/admin/users/deletion-requests?${params}`,
    );
    if (res.data) {
      setRequests(res.data);
      if (selectedRequest) {
        const updated = res.data.find((r) => r.id === selectedRequest.id);
        if (updated) setSelectedRequest(updated);
        else setSelectedRequest(null);
      }
    } else if (res.error) {
      setFetchError(res.error);
      setRequests([]);
    }
    setLoading(false);
  }, [scope, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openDetail = (req: DeletionRequest) => {
    setSelectedRequest(req);
  };

  const closeDetail = () => {
    setSelectedRequest(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setAdminNotes("");
  };

  const handleAssign = async (id: string) => {
    setActionLoading(id);
    await api(`/admin/users/deletion-requests/${id}/assign`, {
      method: "POST",
    });
    setActionLoading(null);
    fetchRequests();
  };

  const handleUnassign = async (id: string) => {
    setActionLoading(id);
    await api(`/admin/users/deletion-requests/${id}/unassign`, {
      method: "POST",
    });
    setActionLoading(null);
    fetchRequests();
  };

  const handleReview = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    await api(
      `/admin/users/deletion-requests/${selectedRequest.id}/${reviewAction}`,
      {
        method: "POST",
        body: { notes: adminNotes || undefined },
      },
    );
    setSubmitting(false);
    closeModal();
    fetchRequests();
  };

  const statusColor = (s: string) => {
    if (s === "PENDING") return "bg-yellow-500/20 text-yellow-300";
    if (s === "APPROVED") return "bg-red-500/20 text-red-300";
    if (s === "DENIED") return "bg-green-500/20 text-green-300";
    return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      PENDING: "Pending",
      APPROVED: "Approved",
      DENIED: "Denied",
    };
    return labels[s] || s.replace(/_/g, " ");
  };

  const roleLabel = (role: string) => {
    if (role === "JOB_SEEKER") return "Service Provider";
    if (role === "EMPLOYER") return "Employer";
    return role;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {selectedRequest && (
            <button
              onClick={closeDetail}
              className="mb-2 flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              ← Back to Requests
            </button>
          )}
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {selectedRequest ? "Request Details" : "Deletion Requests"}
          </h1>
          {!selectedRequest && (
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              Review and manage account deletion requests (GDPR)
            </p>
          )}
        </div>
        {!selectedRequest && (
          <span className="rounded-full bg-[var(--primary)]/20 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* =================== LIST VIEW =================== */}
      {!selectedRequest && (
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
            <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
              {[
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "DENIED", label: "Denied" },
                { value: "", label: "All" },
              ].map((s) => (
                <button
                  key={s.value || "all-status"}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${statusFilter === s.value ? "bg-[var(--primary)] text-white" : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
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
          ) : fetchError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-12 text-center">
              <p className="text-red-300 font-medium">
                Failed to load deletion requests
              </p>
              <p className="text-red-400/70 text-sm mt-1">{fetchError}</p>
              <button
                onClick={fetchRequests}
                className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
              <p className="text-[var(--muted-text)]">
                No deletion requests found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => openDetail(req)}
                  className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        {req.ticketNumber && (
                          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[var(--muted-text)]">
                            {req.ticketNumber}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(req.status)}`}
                        >
                          {req.status}
                        </span>
                        <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted-text)]">
                          {roleLabel(req.user.role)}
                        </span>
                        {!req.user.isActive && (
                          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-300">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                        {req.user.firstName} {req.user.lastName}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted-text)]">
                        {req.user.email}
                      </p>
                      {req.reason && (
                        <p className="mt-2 text-sm text-[var(--foreground)]/70 line-clamp-2">
                          {req.reason}
                        </p>
                      )}
                      <div className="mt-2 text-[10px] text-[var(--muted-text)]">
                        Created:{" "}
                        {new Date(req.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {req.assignedTo && (
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
      {selectedRequest &&
        (() => {
          const req = selectedRequest;
          return (
            <div className="space-y-5">
              {/* Ticket Number */}
              {req.ticketNumber && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 text-center">
                  <p className="text-[10px] uppercase text-[var(--muted-text)]">
                    Ticket Number
                  </p>
                  <p className="mt-1 text-lg font-bold text-purple-400 font-mono">
                    {req.ticketNumber}
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
                      {req.user.firstName} {req.user.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    ✉️{" "}
                    <span className="text-[var(--foreground)]">
                      {req.user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    🏷️{" "}
                    <span className="text-[var(--foreground)]">
                      {roleLabel(req.user.role)}
                    </span>
                  </div>
                  {req.user.publicId && (
                    <div className="flex items-center gap-2 text-[var(--muted-text)]">
                      🆔{" "}
                      <span className="text-[var(--foreground)] font-mono text-xs">
                        {req.user.publicId}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    {req.user.isActive ? (
                      <>
                        🟢{" "}
                        <span className="text-green-400">Active Account</span>
                      </>
                    ) : (
                      <>
                        🔴{" "}
                        <span className="text-red-400">Inactive Account</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                  REQUEST DETAILS
                </h3>
                <h4 className="text-base font-semibold text-[var(--foreground)]">
                  Account Deletion Request
                </h4>
                {req.reason ? (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-[var(--muted-text)] mb-1">
                      Reason provided:
                    </p>
                    <p className="text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                      {req.reason}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted-text)] italic">
                    No reason provided
                  </p>
                )}

                {/* Badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(req.status)}`}
                  >
                    {statusLabel(req.status)}
                  </span>
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-300">
                    GDPR
                  </span>
                </div>

                <p className="mt-3 text-[10px] text-[var(--muted-text)]">
                  Created:{" "}
                  {new Date(req.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {req.assignedTo && <span className="ml-3">· Assigned</span>}
                  {req.assignedAt && (
                    <span className="ml-3">
                      · Assigned at:{" "}
                      {new Date(req.assignedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
              </div>

              {/* Review Decision (if reviewed) */}
              {req.status === "APPROVED" && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                  <h3 className="text-sm font-bold text-red-400 mb-2">
                    APPROVED — ACCOUNT DELETED
                  </h3>
                  <p className="text-sm text-[var(--foreground)]/80">
                    This deletion request was approved.
                    {req.reviewedAt && (
                      <span className="text-[var(--muted-text)]">
                        {" "}
                        Reviewed on{" "}
                        {new Date(req.reviewedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {req.status === "DENIED" && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5">
                  <h3 className="text-sm font-bold text-green-400 mb-2">
                    DENIED — ACCOUNT RETAINED
                  </h3>
                  <p className="text-sm text-[var(--foreground)]/80">
                    This deletion request was denied. The user&apos;s account
                    remains active.
                    {req.reviewedAt && (
                      <span className="text-[var(--muted-text)]">
                        {" "}
                        Reviewed on{" "}
                        {new Date(req.reviewedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Admin Notes */}
              {req.adminNotes && (
                <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-5">
                  <h3 className="text-sm font-bold text-[var(--primary)] mb-2">
                    ADMIN NOTES
                  </h3>
                  <p className="text-sm text-[var(--foreground)]/80 whitespace-pre-wrap">
                    {req.adminNotes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                  ACTIONS
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {!req.assignedTo && req.status === "PENDING" && (
                    <button
                      onClick={() => handleAssign(req.id)}
                      disabled={actionLoading === req.id}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50"
                    >
                      📌 Assign to Me
                    </button>
                  )}
                  {req.assignedTo && req.status === "PENDING" && (
                    <button
                      onClick={() => handleUnassign(req.id)}
                      disabled={actionLoading === req.id}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2.5 text-xs font-medium text-[var(--muted-text)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                    >
                      🔓 Unassign
                    </button>
                  )}
                  {req.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => {
                          setAdminNotes("");
                          setReviewAction("approve");
                          setActiveModal("review");
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-red-500/20 px-3 py-2.5 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
                      >
                        ✅ Approve Deletion
                      </button>
                      <button
                        onClick={() => {
                          setAdminNotes("");
                          setReviewAction("deny");
                          setActiveModal("review");
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-green-500/20 px-3 py-2.5 text-xs font-medium text-green-300 hover:bg-green-500/30 transition-colors"
                      >
                        ❌ Deny Deletion
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Review Modal (Approve / Deny) */}
      {activeModal === "review" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              {reviewAction === "approve"
                ? "Approve Deletion"
                : "Deny Deletion"}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-text)]">
              {reviewAction === "approve"
                ? "This will permanently deactivate the user's account."
                : "This will keep the user's account active and deny their request."}
            </p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes (optional)..."
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
                onClick={handleReview}
                disabled={submitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                  reviewAction === "approve"
                    ? "bg-[var(--alert-red)]"
                    : "bg-[var(--achievement-green)]"
                }`}
              >
                {submitting
                  ? "Processing..."
                  : reviewAction === "approve"
                    ? "Confirm Approve"
                    : "Confirm Deny"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
