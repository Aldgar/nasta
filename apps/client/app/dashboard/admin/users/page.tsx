"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, API_BASE } from "../../../../lib/api";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: string;
  isActive?: boolean;
  city?: string;
  country?: string;
  createdAt: string;
}

interface UserDetails {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    role: string;
    bio?: string;
    city?: string;
    country?: string;
    isActive: boolean;
    isVerified: boolean;
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
    isIdVerified: boolean;
    idVerificationStatus: string;
    isBackgroundVerified: boolean;
    backgroundCheckStatus: string;
    createdAt: string;
  };
  stats: {
    rating: number;
    ratingCount: number;
    activeBookings: number;
    totalJobs: number;
    reportedIssues: number;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    reviewer: { id: string; firstName: string; lastName: string };
    createdAt: string;
  }>;
  bookings: Array<{
    id: string;
    status: string;
    job: { id: string; title: string };
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  reportedIssues: Array<{
    id: string;
    ticketNumber?: string;
    subject: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  kycVerifications?: Array<{
    id: string;
    status: string;
    verificationType: string;
    documentType?: string;
    documentNumber?: string;
    documentCountry?: string;
    documentExpiry?: string;
    documentFrontUrl?: string;
    documentBackUrl?: string;
    selfieUrl?: string;
    confidence?: number;
    faceMatch?: number;
    livenessCheck?: boolean;
    extractedData?: Record<string, unknown>;
    extractedBy?: string;
    extractedAt?: string;
    certifications?: Array<{
      url: string;
      status: string;
      uploadedAt: string;
    }>;
    cvDocuments?: Array<{ url: string; status: string; uploadedAt: string }>;
    createdAt: string;
    updatedAt: string;
  }>;
  vehicles?: Array<{
    id: string;
    vehicleType: string;
    otherTypeSpecification?: string;
    make: string;
    model: string;
    year: number;
    color?: string;
    licensePlate: string;
    capacity?: number;
    photoFrontUrl?: string;
    photoBackUrl?: string;
    photoLeftUrl?: string;
    photoRightUrl?: string;
    vehicleLicenseUrl?: string;
    status: string;
    adminNotes?: string;
    reviewedAt?: string;
    createdAt: string;
  }>;
  supportTickets?: Array<{
    id: string;
    ticketNumber?: string;
    subject: string;
    message: string;
    category: string;
    status: string;
    priority: string;
    assignedTo?: string;
    assignedAt?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    resolution?: string;
    adminNotes?: string;
    conversationId?: string;
    createdAt: string;
    updatedAt: string;
    responses?: Array<{
      id: string;
      message: string;
      channel: string;
      createdAt: string;
      adminId: string;
    }>;
  }>;
  accountStats?: {
    totalServiceProviders: number;
    totalThisMonth: number;
  };
}

interface UserAction {
  id: string;
  actionType: string;
  isActive: boolean;
  ticketNumber?: string;
  actionData?: {
    actionType?: string;
    reason?: string;
    warningType?: string;
    message?: string;
    details?: string;
    request?: string;
  };
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"providers" | "employers">(
    "providers",
  );
  const [providers, setProviders] = useState<User[]>([]);
  const [employers, setEmployers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Detail view state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Action modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [requestInfoText, setRequestInfoText] = useState("");
  const [legalActionType, setLegalActionType] = useState("");
  const [legalActionReason, setLegalActionReason] = useState("");
  const [warningType, setWarningType] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [actionFormType, setActionFormType] = useState("");
  const [actionFormDetails, setActionFormDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api<{
        admin?: { adminCapabilities?: string[] };
        adminCapabilities?: string[];
      }>("/auth/admin/whoami");
      if (res.data) {
        const caps =
          (res.data.admin || (res.data as { adminCapabilities?: string[] }))
            .adminCapabilities || [];
        setIsSuperAdmin(Array.isArray(caps) && caps.includes("SUPER_ADMIN"));
      }
    })();
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const role = activeTab === "providers" ? "JOB_SEEKER" : "EMPLOYER";
    const params = new URLSearchParams({ role, limit: "100" });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    const res = await api<{ users: User[] }>(`/admin/users?${params}`);
    if (res.data) {
      const users = res.data.users || [];
      if (activeTab === "providers") setProviders(users);
      else setEmployers(users);
    }
    setLoading(false);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setLoadingDetail(true);
    setLoadingActions(true);
    const [detailRes, actionsRes] = await Promise.all([
      api<UserDetails>(`/admin/users/${userId}`),
      api<{ actions: UserAction[] }>(`/admin/users/${userId}/actions`),
    ]);
    if (detailRes.data) {
      console.log(
        "[USER-DETAIL] Full API response keys:",
        Object.keys(detailRes.data),
      );
      console.log(
        "[USER-DETAIL] kycVerifications:",
        detailRes.data.kycVerifications?.length,
        detailRes.data.kycVerifications,
      );
      console.log(
        "[USER-DETAIL] vehicles:",
        detailRes.data.vehicles?.length,
        detailRes.data.vehicles,
      );
      console.log(
        "[USER-DETAIL] supportTickets:",
        detailRes.data.supportTickets?.length,
        detailRes.data.supportTickets,
      );
      setUserDetails(detailRes.data);
    } else {
      console.log(
        "[USER-DETAIL] API error:",
        detailRes.error,
        "status:",
        detailRes.status,
      );
    }
    if (actionsRes.data) setUserActions(actionsRes.data.actions || []);
    setLoadingDetail(false);
    setLoadingActions(false);
  }, []);

  const openUserDetail = (user: User) => {
    setSelectedUserId(user.id);
    setUserDetails(null);
    setUserActions([]);
    fetchUserDetail(user.id);
  };

  const closeDetail = () => {
    setSelectedUserId(null);
    setUserDetails(null);
    setUserActions([]);
  };

  const closeModal = () => {
    setActiveModal(null);
    setRequestInfoText("");
    setLegalActionType("");
    setLegalActionReason("");
    setWarningType("");
    setWarningMessage("");
    setActionFormType("");
    setActionFormDetails("");
  };

  const handleRequestInfo = async () => {
    if (!requestInfoText.trim() || !selectedUserId) return;
    setSubmitting(true);
    await api(`/admin/users/${selectedUserId}/request-info`, {
      method: "POST",
      body: { request: requestInfoText.trim() },
    });
    setSubmitting(false);
    closeModal();
    fetchUserDetail(selectedUserId);
  };

  const handleLegalAction = async () => {
    if (!legalActionType || !legalActionReason.trim() || !selectedUserId)
      return;
    setSubmitting(true);
    await api(`/admin/users/${selectedUserId}/legal-action`, {
      method: "POST",
      body: { actionType: legalActionType, reason: legalActionReason },
    });
    setSubmitting(false);
    closeModal();
    fetchUserDetail(selectedUserId);
  };

  const handleWarning = async () => {
    if (!warningType || !warningMessage.trim() || !selectedUserId) return;
    setSubmitting(true);
    await api(`/admin/users/${selectedUserId}/warnings`, {
      method: "POST",
      body: { warningType, message: warningMessage },
    });
    setSubmitting(false);
    closeModal();
    fetchUserDetail(selectedUserId);
  };

  const handleActionForm = async () => {
    if (!actionFormType || !actionFormDetails.trim() || !selectedUserId) return;
    setSubmitting(true);
    await api(`/admin/users/${selectedUserId}/action-form`, {
      method: "POST",
      body: { actionType: actionFormType, details: actionFormDetails },
    });
    setSubmitting(false);
    closeModal();
    fetchUserDetail(selectedUserId);
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    const res = await api(`/admin/users/${selectedUserId}`, {
      method: "DELETE",
    });
    setSubmitting(false);
    if (!res.error) {
      closeModal();
      closeDetail();
      fetchUsers();
    }
  };

  const handleRevokeAction = async (actionId: string) => {
    if (!selectedUserId) return;
    await api(`/admin/users/${selectedUserId}/actions/${actionId}`, {
      method: "DELETE",
    });
    fetchUserDetail(selectedUserId);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const resolveUrl = (raw?: string | null): string => {
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    const base = API_BASE.replace(/\/+$/, "");
    const p = raw.startsWith("/") ? raw.slice(1) : raw;
    return `${base}/${p}`;
  };
  const currentUsers = activeTab === "providers" ? providers : employers;

  // Expanded section states
  const [expandedKycId, setExpandedKycId] = useState<string | null>(null);
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(
    null,
  );
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);

  // Support ticket action states
  const [ticketResponseText, setTicketResponseText] = useState("");
  const [ticketResolveText, setTicketResolveText] = useState("");
  const [ticketActionLoading, setTicketActionLoading] = useState(false);
  const [ticketStatusSelect, setTicketStatusSelect] = useState("");

  const handleAssignTicket = async (ticketId: string) => {
    setTicketActionLoading(true);
    await api(`/support/admin/tickets/${ticketId}/assign`, { method: "POST" });
    setTicketActionLoading(false);
    if (selectedUserId) fetchUserDetail(selectedUserId);
  };

  const handleRespondTicket = async (ticketId: string) => {
    if (!ticketResponseText.trim()) return;
    setTicketActionLoading(true);
    await api(`/support/admin/tickets/${ticketId}/respond`, {
      method: "POST",
      body: { response: ticketResponseText.trim(), channel: "EMAIL" },
    });
    setTicketResponseText("");
    setTicketActionLoading(false);
    if (selectedUserId) fetchUserDetail(selectedUserId);
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!ticketResolveText.trim()) return;
    setTicketActionLoading(true);
    await api(`/support/admin/tickets/${ticketId}/resolve`, {
      method: "POST",
      body: { resolution: ticketResolveText.trim() },
    });
    setTicketResolveText("");
    setTicketActionLoading(false);
    if (selectedUserId) fetchUserDetail(selectedUserId);
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    setTicketActionLoading(true);
    await api(`/support/admin/tickets/${ticketId}/status`, {
      method: "POST",
      body: { status },
    });
    setTicketStatusSelect("");
    setTicketActionLoading(false);
    if (selectedUserId) fetchUserDetail(selectedUserId);
  };

  const VerificationBadge = ({
    verified,
    label,
  }: {
    verified: boolean;
    label: string;
  }) => (
    <div className="flex flex-col items-start gap-1">
      <span className="text-xs text-[var(--muted-text)]">{label}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${verified ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
      >
        {verified ? "Verified" : "Not Verified"}
      </span>
    </div>
  );

  // Action config for history
  const getActionConfig = (action: UserAction) => {
    switch (action.actionType) {
      case "LEGAL_ACTION":
        return {
          icon: "⚖️",
          color: "border-amber-500",
          label: `Legal: ${action.actionData?.actionType || "Unknown"}`,
          details: action.actionData?.reason || "No reason",
        };
      case "WARNING":
        return {
          icon: "⚠️",
          color: "border-yellow-500",
          label: `Warning: ${action.actionData?.warningType || "Unknown"}`,
          details: action.actionData?.message || "No message",
        };
      case "ACTION_FORM":
        return {
          icon: "📋",
          color: "border-emerald-500",
          label: `Action: ${action.actionData?.actionType || "Unknown"}`,
          details: action.actionData?.details || "No details",
        };
      case "REQUEST_INFO":
        return {
          icon: "ℹ️",
          color: "border-blue-500",
          label: "Information Request",
          details: action.actionData?.request || "No request details",
        };
      default:
        return {
          icon: "📌",
          color: "border-[var(--primary)]",
          label: "Unknown Action",
          details: "No details",
        };
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {selectedUserId && (
            <button
              onClick={closeDetail}
              className="mb-2 flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              ← Back to Users
            </button>
          )}
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {selectedUserId ? "User Details" : "Manage Users"}
          </h1>
          {!selectedUserId && (
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              View and manage platform user accounts.
            </p>
          )}
        </div>
        {!selectedUserId && (
          <span className="rounded-full bg-[var(--achievement-green)]/20 px-3 py-1 text-xs font-semibold text-[var(--achievement-green)]">
            {currentUsers.length} user{currentUsers.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* =================== USER LIST VIEW =================== */}
      {!selectedUserId && (
        <>
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-4 py-2.5 pl-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-text)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" strokeWidth="2" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-text)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden w-fit">
            <button
              onClick={() => setActiveTab("providers")}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${activeTab === "providers" ? "bg-[var(--primary)] text-white" : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
            >
              Service Providers ({providers.length})
            </button>
            <button
              onClick={() => setActiveTab("employers")}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${activeTab === "employers" ? "bg-[var(--primary)] text-white" : "text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
            >
              Employers ({employers.length})
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : currentUsers.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-[var(--muted-text)]">
                No{" "}
                {activeTab === "providers" ? "service providers" : "employers"}{" "}
                found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentUsers.map((user) => {
                const location =
                  [user.city, user.country].filter(Boolean).join(", ") ||
                  "No location";
                return (
                  <div
                    key={user.id}
                    onClick={() => openUserDetail(user)}
                    className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)]">
                          {user.firstName?.[0]}
                          {user.lastName?.[0]}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            {user.firstName} {user.lastName}
                          </h3>
                          <p className="text-xs text-[var(--muted-text)]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-[var(--muted-text)]">
                        View →
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-text)]">
                      {user.phone && <span>📱 {user.phone}</span>}
                      <span>📍 {location}</span>
                      <span>📅 Joined {formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =================== USER DETAIL VIEW =================== */}
      {selectedUserId && (
        <>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : userDetails ? (
            <div className="space-y-5">
              {/* User Info Card */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
                    {userDetails.user.firstName?.[0]}
                    {userDetails.user.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--foreground)]">
                      {userDetails.user.firstName} {userDetails.user.lastName}
                    </h2>
                    <p className="text-sm text-[var(--muted-text)]">
                      {userDetails.user.role === "JOB_SEEKER"
                        ? "Service Provider"
                        : "Employer"}
                    </p>
                  </div>
                  <span
                    className={`ml-auto rounded-full px-3 py-1 text-[10px] font-bold ${userDetails.user.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {userDetails.user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    ✉️{" "}
                    <span className="text-[var(--foreground)]">
                      {userDetails.user.email}
                    </span>
                  </div>
                  {userDetails.user.phone && (
                    <div className="flex items-center gap-2 text-[var(--muted-text)]">
                      📱{" "}
                      <span className="text-[var(--foreground)]">
                        {userDetails.user.phone}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    📍{" "}
                    <span className="text-[var(--foreground)]">
                      {[userDetails.user.city, userDetails.user.country]
                        .filter(Boolean)
                        .join(", ") || "No location"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--muted-text)]">
                    📅{" "}
                    <span className="text-[var(--foreground)]">
                      Joined {formatDate(userDetails.user.createdAt)}
                    </span>
                  </div>
                </div>
                {userDetails.user.bio && (
                  <div className="mt-3 rounded-lg bg-[var(--background)] p-3">
                    <p className="text-[10px] uppercase text-[var(--muted-text)] mb-1">
                      Bio
                    </p>
                    <p className="text-sm text-[var(--foreground)]">
                      {userDetails.user.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Verification Status */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                  VERIFICATION STATUS
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <VerificationBadge
                    label="Email"
                    verified={!!userDetails.user.emailVerifiedAt}
                  />
                  <VerificationBadge
                    label="Phone"
                    verified={!!userDetails.user.phoneVerifiedAt}
                  />
                  {userDetails.user.role === "JOB_SEEKER" && (
                    <>
                      <VerificationBadge
                        label="ID"
                        verified={userDetails.user.isIdVerified}
                      />
                      <VerificationBadge
                        label="Background"
                        verified={userDetails.user.isBackgroundVerified}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* === KYC VERIFICATIONS (Service Providers only) === */}
              {userDetails.user.role === "JOB_SEEKER" && (
                <div
                  style={{
                    border: "3px solid #a855f7",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 12,
                    background: "rgba(168,85,247,0.08)",
                  }}
                >
                  <h3
                    style={{
                      color: "#a855f7",
                      fontWeight: "bold",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    KYC VERIFICATIONS (
                    {userDetails.kycVerifications?.length ?? 0})
                  </h3>
                  {(userDetails.kycVerifications ?? []).length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {(userDetails.kycVerifications ?? []).map((v: any) => {
                        const isExpanded = expandedKycId === v.id;
                        const ext = v.extractedData || {};
                        return (
                          <div
                            key={v.id}
                            style={{
                              background: "rgba(0,0,0,0.2)",
                              borderRadius: 8,
                              overflow: "hidden",
                            }}
                          >
                            {/* Header row - clickable */}
                            <div
                              onClick={() =>
                                setExpandedKycId(isExpanded ? null : v.id)
                              }
                              style={{
                                padding: 12,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--foreground)",
                                  }}
                                >
                                  {v.verificationType?.replace(/_/g, " ") ||
                                    "ID Verification"}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color:
                                      v.status === "VERIFIED"
                                        ? "#4ade80"
                                        : v.status === "PENDING" ||
                                            v.status === "MANUAL_REVIEW"
                                          ? "#facc15"
                                          : "#f87171",
                                  }}
                                >
                                  {v.status?.replace(/_/g, " ")}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--muted-text)",
                                }}
                              >
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>

                            {/* Summary row */}
                            <div
                              style={{
                                padding: "0 12px 8px",
                                fontSize: 10,
                                color: "var(--muted-text)",
                                display: "flex",
                                gap: 12,
                              }}
                            >
                              {v.documentCountry && (
                                <span>🌍 {v.documentCountry}</span>
                              )}
                              {v.documentNumber && (
                                <span>📄 {v.documentNumber}</span>
                              )}
                              {v.documentExpiry && (
                                <span>
                                  📅 Expires{" "}
                                  {new Date(
                                    v.documentExpiry,
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              <span>Submitted {formatDate(v.createdAt)}</span>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div
                                style={{
                                  padding: "0 12px 16px",
                                  borderTop: "1px solid rgba(255,255,255,0.05)",
                                }}
                              >
                                {/* Document Images */}
                                {(v.documentFrontUrl ||
                                  v.documentBackUrl ||
                                  v.selfieUrl) && (
                                  <div style={{ marginTop: 12 }}>
                                    <p
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#a855f7",
                                        marginBottom: 8,
                                      }}
                                    >
                                      Document Images
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {[
                                        {
                                          url: v.documentFrontUrl,
                                          label: "Front",
                                        },
                                        {
                                          url: v.documentBackUrl,
                                          label: "Back",
                                        },
                                        { url: v.selfieUrl, label: "Selfie" },
                                      ]
                                        .filter((d) => d.url)
                                        .map((d) => (
                                          <div
                                            key={d.label}
                                            onClick={() =>
                                              setImageModal(resolveUrl(d.url))
                                            }
                                            style={{
                                              cursor: "pointer",
                                              textAlign: "center",
                                            }}
                                          >
                                            <img
                                              src={resolveUrl(d.url)}
                                              alt={d.label}
                                              style={{
                                                width: 120,
                                                height: 80,
                                                objectFit: "cover",
                                                borderRadius: 6,
                                                border:
                                                  "1px solid rgba(255,255,255,0.1)",
                                              }}
                                            />
                                            <span
                                              style={{
                                                fontSize: 9,
                                                color: "var(--muted-text)",
                                              }}
                                            >
                                              {d.label}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Verification Metrics */}
                                <div
                                  style={{
                                    marginTop: 12,
                                    display: "flex",
                                    gap: 16,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {v.confidence != null && (
                                    <div>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--muted-text)",
                                          display: "block",
                                        }}
                                      >
                                        Confidence
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color:
                                            v.confidence > 0.8
                                              ? "#4ade80"
                                              : "#facc15",
                                        }}
                                      >
                                        {(v.confidence * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                  {v.faceMatch != null && (
                                    <div>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--muted-text)",
                                          display: "block",
                                        }}
                                      >
                                        Face Match
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color:
                                            v.faceMatch > 0.8
                                              ? "#4ade80"
                                              : "#facc15",
                                        }}
                                      >
                                        {(v.faceMatch * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                  {v.livenessCheck != null && (
                                    <div>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--muted-text)",
                                          display: "block",
                                        }}
                                      >
                                        Liveness
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color: v.livenessCheck
                                            ? "#4ade80"
                                            : "#f87171",
                                        }}
                                      >
                                        {v.livenessCheck ? "Pass" : "Fail"}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Extracted Data */}
                                {Object.keys(ext).length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <p
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#a855f7",
                                        marginBottom: 8,
                                      }}
                                    >
                                      Extracted / Scanned Data
                                    </p>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "6px 16px",
                                      }}
                                    >
                                      {[
                                        {
                                          label: "Legal Name",
                                          val: [
                                            ext.legalFirstName,
                                            ext.legalLastName,
                                          ]
                                            .filter(Boolean)
                                            .join(" "),
                                        },
                                        {
                                          label: "Date of Birth",
                                          val: ext.dateOfBirth,
                                        },
                                        { label: "Gender", val: ext.gender },
                                        {
                                          label: "Nationality",
                                          val: ext.nationality,
                                        },
                                        {
                                          label: "Place of Birth",
                                          val: ext.placeOfBirth,
                                        },
                                        {
                                          label: "Document Type",
                                          val:
                                            v.documentType || ext.documentType,
                                        },
                                        {
                                          label: "Document Number",
                                          val:
                                            v.documentNumber ||
                                            ext.documentNumber,
                                        },
                                        {
                                          label: "Issue Date",
                                          val: ext.issueDate,
                                        },
                                        {
                                          label: "Expiry Date",
                                          val: ext.expiryDate,
                                        },
                                        {
                                          label: "Issuing Country",
                                          val: ext.issuingCountry,
                                        },
                                        {
                                          label: "Issuing Authority",
                                          val: ext.issuingAuthority,
                                        },
                                        {
                                          label: "Citizenship",
                                          val: ext.citizenshipCountry,
                                        },
                                        {
                                          label: "EU Citizen",
                                          val:
                                            ext.isEuCitizen != null
                                              ? ext.isEuCitizen
                                                ? "Yes"
                                                : "No"
                                              : undefined,
                                        },
                                        {
                                          label: "Work Authorization",
                                          val: ext.workAuthorization,
                                        },
                                        {
                                          label: "BSN / Tax Number",
                                          val: ext.bsnNumber,
                                        },
                                        { label: "Address", val: ext.address },
                                      ]
                                        .filter((f) => f.val)
                                        .map((f) => (
                                          <div key={f.label}>
                                            <span
                                              style={{
                                                fontSize: 9,
                                                color: "var(--muted-text)",
                                              }}
                                            >
                                              {f.label}
                                            </span>
                                            <p
                                              style={{
                                                fontSize: 11,
                                                color: "var(--foreground)",
                                                fontWeight: 500,
                                              }}
                                            >
                                              {String(f.val)}
                                            </p>
                                          </div>
                                        ))}
                                    </div>
                                    {ext.adminNotes && (
                                      <p
                                        style={{
                                          marginTop: 8,
                                          fontSize: 10,
                                          color: "#fbbf24",
                                        }}
                                      >
                                        Admin Notes: {String(ext.adminNotes)}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Certifications */}
                                {v.certifications &&
                                  (v.certifications as any[]).length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                      <p
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: "#a855f7",
                                          marginBottom: 6,
                                        }}
                                      >
                                        Certifications (
                                        {(v.certifications as any[]).length})
                                      </p>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 6,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        {(v.certifications as any[]).map(
                                          (c: any, i: number) => (
                                            <a
                                              key={i}
                                              href={resolveUrl(c.url)}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{
                                                fontSize: 10,
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                background:
                                                  "rgba(168,85,247,0.15)",
                                                color: "#c084fc",
                                                textDecoration: "none",
                                              }}
                                            >
                                              📎 Cert #{i + 1} ({c.status})
                                            </a>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {/* CV Documents */}
                                {v.cvDocuments &&
                                  (v.cvDocuments as any[]).length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                      <p
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: "#a855f7",
                                          marginBottom: 6,
                                        }}
                                      >
                                        CV Documents (
                                        {(v.cvDocuments as any[]).length})
                                      </p>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 6,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        {(v.cvDocuments as any[]).map(
                                          (c: any, i: number) => (
                                            <a
                                              key={i}
                                              href={resolveUrl(c.url)}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{
                                                fontSize: 10,
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                background:
                                                  "rgba(168,85,247,0.15)",
                                                color: "#c084fc",
                                                textDecoration: "none",
                                              }}
                                            >
                                              📄 CV #{i + 1} ({c.status})
                                            </a>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {/* Link to full review */}
                                <a
                                  href={`/dashboard/admin/kyc/${v.id}`}
                                  style={{
                                    display: "inline-block",
                                    marginTop: 14,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#a855f7",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Open Full KYC Review →
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "var(--muted-text)" }}>
                      No KYC verifications found
                    </p>
                  )}
                </div>
              )}

              {/* === VEHICLES === */}
              <div
                style={{
                  border: "3px solid #3b82f6",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                  background: "rgba(59,130,246,0.08)",
                }}
              >
                <h3
                  style={{
                    color: "#3b82f6",
                    fontWeight: "bold",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  VEHICLES ({userDetails.vehicles?.length ?? 0})
                </h3>
                {(userDetails.vehicles ?? []).length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {(userDetails.vehicles ?? []).map((v: any) => {
                      const isExpanded = expandedVehicleId === v.id;
                      const photos = [
                        { url: v.photoFrontUrl, label: "Front" },
                        { url: v.photoBackUrl, label: "Back" },
                        { url: v.photoLeftUrl, label: "Left" },
                        { url: v.photoRightUrl, label: "Right" },
                        { url: v.vehicleLicenseUrl, label: "License" },
                      ].filter((p) => p.url);
                      return (
                        <div
                          key={v.id}
                          style={{
                            background: "rgba(0,0,0,0.2)",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          {/* Header row - clickable */}
                          <div
                            onClick={() =>
                              setExpandedVehicleId(isExpanded ? null : v.id)
                            }
                            style={{
                              padding: 12,
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--foreground)",
                                }}
                              >
                                {v.year} {v.make} {v.model}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color:
                                    v.status === "VERIFIED"
                                      ? "#4ade80"
                                      : v.status === "PENDING"
                                        ? "#facc15"
                                        : "#f87171",
                                }}
                              >
                                {v.status}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--muted-text)",
                              }}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>

                          {/* Summary row */}
                          <div
                            style={{
                              padding: "0 12px 8px",
                              fontSize: 10,
                              color: "var(--muted-text)",
                              display: "flex",
                              gap: 12,
                            }}
                          >
                            <span>🚗 {v.vehicleType}</span>
                            <span>🔢 {v.licensePlate}</span>
                            {v.color && <span>🎨 {v.color}</span>}
                            <span>Added {formatDate(v.createdAt)}</span>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div
                              style={{
                                padding: "0 12px 16px",
                                borderTop: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              {/* Vehicle Details Grid */}
                              <div
                                style={{
                                  marginTop: 12,
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr 1fr",
                                  gap: "8px 16px",
                                }}
                              >
                                {[
                                  {
                                    label: "Type",
                                    val:
                                      v.vehicleType === "OTHER"
                                        ? v.otherTypeSpecification || "Other"
                                        : v.vehicleType,
                                  },
                                  {
                                    label: "Make",
                                    val: v.make,
                                  },
                                  {
                                    label: "Model",
                                    val: v.model,
                                  },
                                  {
                                    label: "Year",
                                    val: v.year,
                                  },
                                  {
                                    label: "Color",
                                    val: v.color,
                                  },
                                  {
                                    label: "License Plate",
                                    val: v.licensePlate,
                                  },
                                  {
                                    label: "Capacity",
                                    val: v.capacity,
                                  },
                                  {
                                    label: "Status",
                                    val: v.status,
                                  },
                                  {
                                    label: "Reviewed",
                                    val: v.reviewedAt
                                      ? formatDate(v.reviewedAt)
                                      : "Not yet",
                                  },
                                ]
                                  .filter((f) => f.val != null)
                                  .map((f) => (
                                    <div key={f.label}>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--muted-text)",
                                        }}
                                      >
                                        {f.label}
                                      </span>
                                      <p
                                        style={{
                                          fontSize: 11,
                                          color: "var(--foreground)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {String(f.val)}
                                      </p>
                                    </div>
                                  ))}
                              </div>

                              {v.adminNotes && (
                                <p
                                  style={{
                                    marginTop: 10,
                                    fontSize: 10,
                                    color: "#fbbf24",
                                  }}
                                >
                                  Admin Notes: {v.adminNotes}
                                </p>
                              )}

                              {/* Photo Gallery */}
                              {photos.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#3b82f6",
                                      marginBottom: 8,
                                    }}
                                  >
                                    Photos ({photos.length})
                                  </p>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {photos.map((p) => (
                                      <div
                                        key={p.label}
                                        onClick={() =>
                                          setImageModal(resolveUrl(p.url))
                                        }
                                        style={{
                                          cursor: "pointer",
                                          textAlign: "center",
                                        }}
                                      >
                                        <img
                                          src={resolveUrl(p.url)}
                                          alt={p.label}
                                          style={{
                                            width: 140,
                                            height: 100,
                                            objectFit: "cover",
                                            borderRadius: 6,
                                            border:
                                              "1px solid rgba(255,255,255,0.1)",
                                          }}
                                        />
                                        <span
                                          style={{
                                            fontSize: 9,
                                            color: "var(--muted-text)",
                                          }}
                                        >
                                          {p.label}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted-text)" }}>
                    No vehicles found
                  </p>
                )}
              </div>

              {/* === SUPPORT TICKETS === */}
              <div
                style={{
                  border: "3px solid #10b981",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                  background: "rgba(16,185,129,0.08)",
                }}
              >
                <h3
                  style={{
                    color: "#10b981",
                    fontWeight: "bold",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  SUPPORT TICKETS ({userDetails.supportTickets?.length ?? 0})
                </h3>
                {(userDetails.supportTickets ?? []).length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {(userDetails.supportTickets ?? []).map((t: any) => {
                      const isExpanded = expandedTicketId === t.id;
                      const isAssigned = !!t.assignedTo;
                      const statusColor =
                        t.status === "RESOLVED" || t.status === "CLOSED"
                          ? "#4ade80"
                          : t.status === "IN_PROGRESS"
                            ? "#93c5fd"
                            : t.status === "WAITING_USER_RESPONSE"
                              ? "#c084fc"
                              : "#facc15";
                      return (
                        <div
                          key={t.id}
                          style={{
                            background: "rgba(0,0,0,0.2)",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          {/* Header row - clickable */}
                          <div
                            onClick={() =>
                              setExpandedTicketId(isExpanded ? null : t.id)
                            }
                            style={{
                              padding: 12,
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--foreground)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {t.subject}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: statusColor,
                                  flexShrink: 0,
                                }}
                              >
                                {t.status?.replace(/_/g, " ")}
                              </span>
                              {isAssigned && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "rgba(59,130,246,0.2)",
                                    color: "#93c5fd",
                                    flexShrink: 0,
                                  }}
                                >
                                  Assigned
                                </span>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--muted-text)",
                                marginLeft: 8,
                              }}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>

                          {/* Summary row */}
                          <div
                            style={{
                              padding: "0 12px 8px",
                              fontSize: 10,
                              color: "var(--muted-text)",
                              display: "flex",
                              gap: 12,
                            }}
                          >
                            {t.ticketNumber && <span>#{t.ticketNumber}</span>}
                            <span>{t.category}</span>
                            <span>Priority: {t.priority}</span>
                            <span>{formatDate(t.createdAt)}</span>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div
                              style={{
                                padding: "0 12px 16px",
                                borderTop: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              {/* Ticket Details */}
                              <div
                                style={{
                                  marginTop: 12,
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr 1fr",
                                  gap: "8px 16px",
                                }}
                              >
                                {[
                                  {
                                    label: "Ticket #",
                                    val: t.ticketNumber,
                                  },
                                  { label: "Category", val: t.category },
                                  { label: "Priority", val: t.priority },
                                  {
                                    label: "Status",
                                    val: t.status?.replace(/_/g, " "),
                                  },
                                  {
                                    label: "Assigned",
                                    val: t.assignedTo
                                      ? `Yes (${t.assignedAt ? formatDate(t.assignedAt) : ""})`
                                      : "No",
                                  },
                                  {
                                    label: "Created",
                                    val: formatDate(t.createdAt),
                                  },
                                ]
                                  .filter((f) => f.val)
                                  .map((f) => (
                                    <div key={f.label}>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--muted-text)",
                                        }}
                                      >
                                        {f.label}
                                      </span>
                                      <p
                                        style={{
                                          fontSize: 11,
                                          color: "var(--foreground)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {String(f.val)}
                                      </p>
                                    </div>
                                  ))}
                              </div>

                              {/* User Message */}
                              <div
                                style={{
                                  marginTop: 12,
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: 6,
                                  padding: 10,
                                }}
                              >
                                <p
                                  style={{
                                    fontSize: 9,
                                    color: "var(--muted-text)",
                                    marginBottom: 4,
                                  }}
                                >
                                  User Message
                                </p>
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: "var(--foreground)",
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {t.message}
                                </p>
                              </div>

                              {/* Resolution */}
                              {t.resolution && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    background: "rgba(74,222,128,0.08)",
                                    borderRadius: 6,
                                    padding: 10,
                                    borderLeft: "3px solid #4ade80",
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: 9,
                                      color: "#4ade80",
                                      marginBottom: 4,
                                    }}
                                  >
                                    Resolution
                                    {t.resolvedAt
                                      ? ` — ${formatDate(t.resolvedAt)}`
                                      : ""}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      color: "var(--foreground)",
                                    }}
                                  >
                                    {t.resolution}
                                  </p>
                                </div>
                              )}

                              {t.adminNotes && (
                                <p
                                  style={{
                                    marginTop: 8,
                                    fontSize: 10,
                                    color: "#fbbf24",
                                  }}
                                >
                                  Admin Notes: {t.adminNotes}
                                </p>
                              )}

                              {/* Response History */}
                              {t.responses && t.responses.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#10b981",
                                      marginBottom: 8,
                                    }}
                                  >
                                    Responses ({t.responses.length})
                                  </p>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 6,
                                    }}
                                  >
                                    {t.responses.map((r: any) => (
                                      <div
                                        key={r.id}
                                        style={{
                                          background: "rgba(255,255,255,0.03)",
                                          borderRadius: 6,
                                          padding: 8,
                                          borderLeft:
                                            "2px solid rgba(16,185,129,0.4)",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: 4,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: 9,
                                              color: "#10b981",
                                              fontWeight: 600,
                                            }}
                                          >
                                            Admin Response via{" "}
                                            {r.channel || "EMAIL"}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: 9,
                                              color: "var(--muted-text)",
                                            }}
                                          >
                                            {formatDate(r.createdAt)}
                                          </span>
                                        </div>
                                        <p
                                          style={{
                                            fontSize: 11,
                                            color: "var(--foreground)",
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          {r.message}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Actions — must assign first */}
                              {t.status !== "RESOLVED" &&
                                t.status !== "CLOSED" && (
                                  <div
                                    style={{
                                      marginTop: 14,
                                      borderTop:
                                        "1px solid rgba(255,255,255,0.05)",
                                      paddingTop: 14,
                                    }}
                                  >
                                    {!isAssigned ? (
                                      <div>
                                        <p
                                          style={{
                                            fontSize: 10,
                                            color: "#facc15",
                                            marginBottom: 8,
                                          }}
                                        >
                                          ⚠️ You must assign this ticket to
                                          yourself before taking any action.
                                        </p>
                                        <button
                                          onClick={() =>
                                            handleAssignTicket(t.id)
                                          }
                                          disabled={ticketActionLoading}
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: "6px 16px",
                                            borderRadius: 6,
                                            border: "none",
                                            background: "#3b82f6",
                                            color: "white",
                                            cursor: ticketActionLoading
                                              ? "not-allowed"
                                              : "pointer",
                                            opacity: ticketActionLoading
                                              ? 0.5
                                              : 1,
                                          }}
                                        >
                                          {ticketActionLoading
                                            ? "Assigning..."
                                            : "Assign to Me"}
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 10,
                                        }}
                                      >
                                        {/* Update Status */}
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "center",
                                          }}
                                        >
                                          <select
                                            value={ticketStatusSelect}
                                            onChange={(e) =>
                                              setTicketStatusSelect(
                                                e.target.value,
                                              )
                                            }
                                            style={{
                                              fontSize: 11,
                                              padding: "5px 8px",
                                              borderRadius: 6,
                                              border:
                                                "1px solid rgba(255,255,255,0.1)",
                                              background:
                                                "rgba(255,255,255,0.05)",
                                              color: "var(--foreground)",
                                              flex: 1,
                                            }}
                                          >
                                            <option value="">
                                              Change status...
                                            </option>
                                            <option value="IN_PROGRESS">
                                              In Progress
                                            </option>
                                            <option value="WAITING_USER_RESPONSE">
                                              Waiting User Response
                                            </option>
                                            <option value="ESCALATED_KYC">
                                              Escalate to KYC
                                            </option>
                                            <option value="ESCALATED_ADMIN">
                                              Escalate to Admin
                                            </option>
                                            <option value="ESCALATED_BUG_TEAM">
                                              Escalate to Bug Team
                                            </option>
                                          </select>
                                          <button
                                            onClick={() =>
                                              ticketStatusSelect &&
                                              handleUpdateTicketStatus(
                                                t.id,
                                                ticketStatusSelect,
                                              )
                                            }
                                            disabled={
                                              !ticketStatusSelect ||
                                              ticketActionLoading
                                            }
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 600,
                                              padding: "5px 12px",
                                              borderRadius: 6,
                                              border: "none",
                                              background:
                                                "rgba(59,130,246,0.2)",
                                              color: "#93c5fd",
                                              cursor:
                                                !ticketStatusSelect ||
                                                ticketActionLoading
                                                  ? "not-allowed"
                                                  : "pointer",
                                              opacity:
                                                !ticketStatusSelect ||
                                                ticketActionLoading
                                                  ? 0.5
                                                  : 1,
                                            }}
                                          >
                                            Update
                                          </button>
                                        </div>

                                        {/* Respond */}
                                        <div>
                                          <textarea
                                            value={ticketResponseText}
                                            onChange={(e) =>
                                              setTicketResponseText(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Type your response to the user..."
                                            rows={2}
                                            style={{
                                              width: "100%",
                                              fontSize: 11,
                                              padding: 8,
                                              borderRadius: 6,
                                              border:
                                                "1px solid rgba(255,255,255,0.1)",
                                              background:
                                                "rgba(255,255,255,0.05)",
                                              color: "var(--foreground)",
                                              resize: "vertical",
                                            }}
                                          />
                                          <button
                                            onClick={() =>
                                              handleRespondTicket(t.id)
                                            }
                                            disabled={
                                              !ticketResponseText.trim() ||
                                              ticketActionLoading
                                            }
                                            style={{
                                              marginTop: 6,
                                              fontSize: 10,
                                              fontWeight: 600,
                                              padding: "5px 14px",
                                              borderRadius: 6,
                                              border: "none",
                                              background:
                                                "rgba(16,185,129,0.2)",
                                              color: "#4ade80",
                                              cursor:
                                                !ticketResponseText.trim() ||
                                                ticketActionLoading
                                                  ? "not-allowed"
                                                  : "pointer",
                                              opacity:
                                                !ticketResponseText.trim() ||
                                                ticketActionLoading
                                                  ? 0.5
                                                  : 1,
                                            }}
                                          >
                                            {ticketActionLoading
                                              ? "Sending..."
                                              : "Send Response (Email)"}
                                          </button>
                                        </div>

                                        {/* Resolve */}
                                        <div
                                          style={{
                                            borderTop:
                                              "1px solid rgba(255,255,255,0.05)",
                                            paddingTop: 10,
                                          }}
                                        >
                                          <textarea
                                            value={ticketResolveText}
                                            onChange={(e) =>
                                              setTicketResolveText(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Resolution summary..."
                                            rows={2}
                                            style={{
                                              width: "100%",
                                              fontSize: 11,
                                              padding: 8,
                                              borderRadius: 6,
                                              border:
                                                "1px solid rgba(255,255,255,0.1)",
                                              background:
                                                "rgba(255,255,255,0.05)",
                                              color: "var(--foreground)",
                                              resize: "vertical",
                                            }}
                                          />
                                          <button
                                            onClick={() =>
                                              handleResolveTicket(t.id)
                                            }
                                            disabled={
                                              !ticketResolveText.trim() ||
                                              ticketActionLoading
                                            }
                                            style={{
                                              marginTop: 6,
                                              fontSize: 10,
                                              fontWeight: 700,
                                              padding: "6px 16px",
                                              borderRadius: 6,
                                              border: "none",
                                              background: "#10b981",
                                              color: "white",
                                              cursor:
                                                !ticketResolveText.trim() ||
                                                ticketActionLoading
                                                  ? "not-allowed"
                                                  : "pointer",
                                              opacity:
                                                !ticketResolveText.trim() ||
                                                ticketActionLoading
                                                  ? 0.5
                                                  : 1,
                                            }}
                                          >
                                            {ticketActionLoading
                                              ? "Resolving..."
                                              : "Resolve Ticket"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                              {/* Chat link */}
                              {t.conversationId && (
                                <a
                                  href={`/dashboard/admin/chat?conversationId=${t.conversationId}`}
                                  style={{
                                    display: "inline-block",
                                    marginTop: 10,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#10b981",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Open Linked Chat →
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted-text)" }}>
                    No support tickets found
                  </p>
                )}
              </div>

              {/* Statistics */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                  STATISTICS
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      {userDetails.stats.rating.toFixed(1)}
                    </p>
                    <p className="text-[10px] uppercase text-[var(--muted-text)]">
                      Rating ({userDetails.stats.ratingCount})
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      {userDetails.user.role === "JOB_SEEKER"
                        ? userDetails.stats.activeBookings
                        : userDetails.stats.totalJobs}
                    </p>
                    <p className="text-[10px] uppercase text-[var(--muted-text)]">
                      {userDetails.user.role === "JOB_SEEKER"
                        ? "Active Services"
                        : "Job Posts"}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                      {userDetails.stats.reportedIssues}
                    </p>
                    <p className="text-[10px] uppercase text-[var(--muted-text)]">
                      Reported Issues
                    </p>
                  </div>
                </div>
              </div>

              {/* Platform Growth */}
              {userDetails.accountStats && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                    PLATFORM GROWTH
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-[var(--foreground)]">
                        {userDetails.accountStats.totalServiceProviders}
                      </p>
                      <p className="text-[10px] uppercase text-[var(--muted-text)]">
                        Total Providers
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--foreground)]">
                        {userDetails.accountStats.totalThisMonth}
                      </p>
                      <p className="text-[10px] uppercase text-[var(--muted-text)]">
                        This Month
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                  ACTIONS
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userDetails.user.role === "JOB_SEEKER" && (
                    <a
                      href="/dashboard/admin/kyc"
                      className="flex items-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition-colors"
                    >
                      🛡️ Manage Verifications
                    </a>
                  )}
                  <button
                    onClick={() => setActiveModal("request-info")}
                    className="flex items-center gap-2 rounded-lg bg-[var(--primary)]/20 px-3 py-2.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors"
                  >
                    ℹ️ Request Info
                  </button>
                  <button
                    onClick={() => setActiveModal("legal-action")}
                    className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    ⚖️ Legal Action
                  </button>
                  <button
                    onClick={() => setActiveModal("warning")}
                    className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30 transition-colors"
                  >
                    ⚠️ Warnings
                  </button>
                  <button
                    onClick={() => setActiveModal("action-form")}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    📋 Action Form
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/admin/chat?startChat=${selectedUserId}`,
                      )
                    }
                    className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2.5 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition-colors"
                  >
                    💬 Chat with User
                  </button>
                  <button
                    onClick={() => isSuperAdmin && setActiveModal("delete")}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${isSuperAdmin ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-[var(--surface-alt)] text-[var(--muted-text)] cursor-not-allowed opacity-50"}`}
                  >
                    🗑️ Delete User
                  </button>
                </div>
                {!isSuperAdmin && (
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-[10px] text-yellow-400">
                    ⚠️ Only Super Admins can delete users.
                  </p>
                )}
              </div>

              {/* Action History */}
              {userActions.length > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[var(--foreground)]">
                      ACTION HISTORY
                    </h3>
                    <span className="rounded-full bg-[var(--primary)]/20 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                      {userActions.length}
                    </span>
                  </div>
                  {loadingActions ? (
                    <div className="py-4 text-center">
                      <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userActions.map((action) => {
                        const cfg = getActionConfig(action);
                        return (
                          <div
                            key={action.id}
                            className={`rounded-lg border-l-4 ${cfg.color} bg-[var(--background)] p-3`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{cfg.icon}</span>
                                  <span className="text-xs font-semibold text-[var(--foreground)]">
                                    {cfg.label}
                                  </span>
                                  {action.isActive && (
                                    <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-400">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />{" "}
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-[var(--muted-text)] line-clamp-2">
                                  {cfg.details}
                                </p>
                                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--muted-text)]">
                                  <span>📅 {formatDate(action.createdAt)}</span>
                                  {action.ticketNumber && (
                                    <span># {action.ticketNumber}</span>
                                  )}
                                </div>
                              </div>
                              {action.isActive && (
                                <button
                                  onClick={() => handleRevokeAction(action.id)}
                                  className="flex-shrink-0 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
                                >
                                  ↩ Revoke
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recent Reviews */}
              {userDetails.reviews.length > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                    RECENT REVIEWS ({userDetails.reviews.length})
                  </h3>
                  <div className="space-y-3">
                    {userDetails.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-lg bg-[var(--background)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--foreground)]">
                            {review.reviewer.firstName}{" "}
                            {review.reviewer.lastName}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            ⭐ {review.rating}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="mt-1 text-xs text-[var(--muted-text)]">
                            {review.comment}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                          {formatDate(review.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Services / Bookings (JOB_SEEKER) */}
              {userDetails.user.role === "JOB_SEEKER" &&
                userDetails.bookings.length > 0 && (
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                      ACTIVE SERVICES ({userDetails.bookings.length})
                    </h3>
                    <div className="space-y-2">
                      {userDetails.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                        >
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            {b.job.title}
                          </span>
                          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted-text)]">
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Job Posts (EMPLOYER) */}
              {userDetails.user.role === "EMPLOYER" &&
                userDetails.jobs.length > 0 && (
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                      JOB POSTS ({userDetails.jobs.length})
                    </h3>
                    <div className="space-y-2">
                      {userDetails.jobs.map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                        >
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            {j.title}
                          </span>
                          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted-text)]">
                            {j.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Reported Issues */}
              {userDetails.reportedIssues.length > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
                    REPORTED ISSUES ({userDetails.reportedIssues.length})
                  </h3>
                  <div className="space-y-2">
                    {userDetails.reportedIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-lg bg-[var(--background)] p-3"
                      >
                        <p className="text-xs font-medium text-[var(--foreground)]">
                          {issue.subject}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                          {issue.category} • {issue.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
              <p className="text-[var(--muted-text)]">
                Failed to load user details.
              </p>
            </div>
          )}

          {/* =================== ACTION MODALS =================== */}

          {/* Request Info Modal */}
          {activeModal === "request-info" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                  Request Information
                </h2>
                <p className="text-xs text-[var(--muted-text)] mb-4">
                  What information do you need from this user?
                </p>
                <textarea
                  value={requestInfoText}
                  onChange={(e) => setRequestInfoText(e.target.value)}
                  rows={4}
                  placeholder="Enter your request..."
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestInfo}
                    disabled={submitting || !requestInfoText.trim()}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Legal Action Modal */}
          {activeModal === "legal-action" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                  Legal Action
                </h2>
                <p className="text-xs text-[var(--muted-text)] mb-4">
                  Record a legal action against this user.
                </p>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Action Type
                </label>
                <div className="flex gap-2 mb-4">
                  {(["BAN", "SUSPEND", "RESTRICT"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setLegalActionType(t)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${legalActionType === t ? "bg-amber-500 text-white" : "border border-[var(--border-color)] bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
                    >
                      {t === "BAN"
                        ? "Ban Account"
                        : t === "SUSPEND"
                          ? "Suspend Account"
                          : "Restrict Access"}
                    </button>
                  ))}
                </div>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Reason
                </label>
                <textarea
                  value={legalActionReason}
                  onChange={(e) => setLegalActionReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason..."
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLegalAction}
                    disabled={
                      submitting ||
                      !legalActionType ||
                      !legalActionReason.trim()
                    }
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Warning Modal */}
          {activeModal === "warning" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                  Issue Warning
                </h2>
                <p className="text-xs text-[var(--muted-text)] mb-4">
                  Issue a warning to this user.
                </p>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Warning Type
                </label>
                <div className="flex gap-2 mb-4">
                  {(["MINOR", "MAJOR", "FINAL"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setWarningType(t)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${warningType === t ? "bg-yellow-500 text-white" : "border border-[var(--border-color)] bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
                    >
                      {t === "MINOR"
                        ? "Minor Violation"
                        : t === "MAJOR"
                          ? "Major Violation"
                          : "Final Warning"}
                    </button>
                  ))}
                </div>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Message
                </label>
                <textarea
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  rows={3}
                  placeholder="Enter warning message..."
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWarning}
                    disabled={
                      submitting || !warningType || !warningMessage.trim()
                    }
                    className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Issue Warning"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Form Modal */}
          {activeModal === "action-form" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
                  Action Form
                </h2>
                <p className="text-xs text-[var(--muted-text)] mb-4">
                  Submit a formal action form for this user.
                </p>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Action Type
                </label>
                <div className="flex gap-2 mb-4">
                  {(["NOTICE", "REQUIREMENT", "INVESTIGATION"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        onClick={() => setActionFormType(t)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${actionFormType === t ? "bg-emerald-500 text-white" : "border border-[var(--border-color)] bg-[var(--background)] text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"}`}
                      >
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </button>
                    ),
                  )}
                </div>
                <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                  Details
                </label>
                <textarea
                  value={actionFormDetails}
                  onChange={(e) => setActionFormDetails(e.target.value)}
                  rows={3}
                  placeholder="Enter details..."
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleActionForm}
                    disabled={
                      submitting || !actionFormType || !actionFormDetails.trim()
                    }
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete User Modal */}
          {activeModal === "delete" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  Delete User
                </h2>
                <p className="mt-2 text-sm text-[var(--muted-text)]">
                  Are you sure you want to delete{" "}
                  <strong className="text-[var(--foreground)]">
                    {userDetails?.user.firstName} {userDetails?.user.lastName}
                  </strong>
                  ? This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={submitting}
                    className="rounded-lg bg-[var(--alert-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Image Lightbox Modal */}
      {imageModal && (
        <div
          onClick={() => setImageModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            cursor: "pointer",
          }}
        >
          <img
            src={imageModal}
            alt="Document"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </div>
  );
}
