"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, API_BASE } from "../../../../lib/api";

interface KYCVerification {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  verificationType: string;
  status: string;
  assignedTo?: string;
  documentNumber?: string;
  documentCountry?: string;
  documentExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

interface VehicleReview {
  id: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  licensePlate: string;
  capacity?: string;
  status: string;
  photoFrontUrl?: string;
  photoBackUrl?: string;
  photoLeftUrl?: string;
  photoRightUrl?: string;
  vehicleLicenseUrl?: string;
  adminNotes?: string;
  createdAt: string;
}

export default function AdminKYCPage() {
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [vehicles, setVehicles] = useState<VehicleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [tab, setTab] = useState<"identity" | "vehicles">("identity");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "manual_review"
  >("all");

  // Vehicle detail modal
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleReview | null>(
    null,
  );
  const [reviewAction, setReviewAction] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    const statuses =
      scope === "unassigned"
        ? "MANUAL_REVIEW"
        : "PENDING,IN_PROGRESS,MANUAL_REVIEW";
    const [idRes, vehRes] = await Promise.all([
      api<KYCVerification[]>(`/kyc/admin/list?statuses=${statuses}`),
      api<{ vehicles: VehicleReview[]; total: number }>(
        `/admin/dashboard/vehicles/pending`,
      ),
    ]);
    if (idRes.data) {
      let items = Array.isArray(idRes.data) ? idRes.data : [];
      if (scope === "unassigned") {
        items = items.filter((item) => !item.assignedTo);
      }
      setVerifications(items);
    } else {
      setVerifications([]);
    }
    if (vehRes.data && vehRes.data.vehicles) {
      setVehicles(vehRes.data.vehicles);
    } else {
      setVehicles([]);
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleVehicleReview = async (decision: "VERIFIED" | "REJECTED") => {
    if (!selectedVehicle) return;
    setSubmitting(true);
    await api(`/admin/dashboard/vehicles/${selectedVehicle.id}/review`, {
      method: "PATCH",
      body: { status: decision, adminNotes: reviewNotes.trim() || undefined },
    });
    setSubmitting(false);
    setSelectedVehicle(null);
    setReviewAction(null);
    setReviewNotes("");
    fetchVerifications();
  };

  const resolveUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE.replace(/\/+$/, "")}/${url.startsWith("/") ? url.slice(1) : url}`;
  };

  const statusColor = (s: string) => {
    if (s === "PENDING")
      return "bg-yellow-200 text-yellow-900 font-semibold border border-yellow-400";
    if (s === "IN_PROGRESS")
      return "bg-blue-200 text-blue-900 font-semibold border border-blue-400";
    if (s === "MANUAL_REVIEW")
      return "bg-orange-200 text-orange-900 font-semibold border border-orange-400";
    if (s === "APPROVED" || s === "VERIFIED")
      return "bg-green-200 text-green-900 font-semibold border border-green-400";
    if (s === "REJECTED" || s === "FAILED")
      return "bg-red-200 text-red-900 font-semibold border border-red-400";
    return "bg-[var(--surface-alt)] text-[var(--foreground)]";
  };

  const filteredVerifications = verifications.filter((v) => {
    if (statusFilter === "pending") return v.status === "PENDING";
    if (statusFilter === "manual_review") return v.status === "MANUAL_REVIEW";
    return true;
  });

  const pendingCount = verifications.filter(
    (v) => v.status === "PENDING",
  ).length;
  const manualReviewCount = verifications.filter(
    (v) => v.status === "MANUAL_REVIEW",
  ).length;

  const totalCount = verifications.length + vehicles.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            KYC Reviews
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            Review and approve identity verification submissions.
          </p>
        </div>
        <span className="rounded-full bg-[var(--primary)]/20 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
          {totalCount} item{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Tab filter */}
        <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
          <button
            onClick={() => setTab("identity")}
            className={`px-4 py-2 text-xs font-medium transition-colors ${tab === "identity" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
          >
            Identity ({verifications.length})
          </button>
          <button
            onClick={() => setTab("vehicles")}
            className={`px-4 py-2 text-xs font-medium transition-colors ${tab === "vehicles" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
          >
            Vehicles ({vehicles.length})
          </button>
        </div>

        {/* Scope filter — only for identity tab */}
        {tab === "identity" && (
          <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
            {(["all", "mine", "unassigned"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${scope === s ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Status filter — only for identity tab */}
        {tab === "identity" && (
          <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 text-xs font-medium transition-colors ${statusFilter === "all" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
            >
              All ({verifications.length})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2 text-xs font-medium transition-colors ${statusFilter === "pending" ? "bg-yellow-600 text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("manual_review")}
              className={`px-4 py-2 text-xs font-medium transition-colors ${statusFilter === "manual_review" ? "bg-orange-600 text-white" : "text-[var(--foreground)]/70 hover:bg-[var(--surface-alt)]"}`}
            >
              Manual Review ({manualReviewCount})
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : tab === "identity" ? (
        filteredVerifications.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
            <p className="text-[var(--muted-text)]">No verifications found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVerifications.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard/admin/kyc/${v.id}`}
                className="block cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {v.user
                          ? `${v.user.firstName || ""} ${v.user.lastName || ""}`.trim() ||
                            "Unknown User"
                          : "Unknown User"}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(v.status)}`}
                      >
                        {v.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-text)]">
                      {v.user?.email || "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--foreground)]/80">
                      Type: {v.verificationType?.replace("_", " ") || "N/A"}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--foreground)]/60">
                      <span>
                        Submitted:{" "}
                        {new Date(v.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {v.documentCountry && (
                        <span>Country: {v.documentCountry}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--muted-text)]">
                    View details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <p className="text-[var(--muted-text)]">No vehicle reviews pending</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => setSelectedVehicle(v)}
              className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--primary)]/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {v.user
                        ? `${v.user.firstName || ""} ${v.user.lastName || ""}`.trim() ||
                          "Unknown User"
                        : "Unknown User"}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor(v.status)}`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    {v.user?.email || "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--foreground)]/70">
                    🚗 {v.vehicleType} — {v.make} {v.model} ({v.year})
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-[10px] text-[var(--muted-text)]">
                    <span>Plate: {v.licensePlate}</span>
                    {v.color && <span>Color: {v.color}</span>}
                    {v.capacity && <span>Capacity: {v.capacity}</span>}
                  </div>
                  <div className="mt-2 text-[10px] text-[var(--muted-text)]">
                    Submitted:{" "}
                    {new Date(v.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <span className="text-xs text-[var(--muted-text)]">
                  Review →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vehicle Detail/Review Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Vehicle Review
              </h2>
              <button
                onClick={() => {
                  setSelectedVehicle(null);
                  setReviewAction(null);
                  setReviewNotes("");
                }}
                className="rounded-lg p-1 text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
              >
                ✕
              </button>
            </div>

            {/* Owner Info */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-4 mb-4">
              <p className="text-xs font-medium text-[var(--muted-text)] mb-1">
                OWNER
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {selectedVehicle.user
                  ? `${selectedVehicle.user.firstName || ""} ${selectedVehicle.user.lastName || ""}`.trim()
                  : "Unknown"}
              </p>
              <p className="text-xs text-[var(--muted-text)]">
                {selectedVehicle.user?.email}
              </p>
            </div>

            {/* Vehicle Details */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-4 mb-4">
              <p className="text-xs font-medium text-[var(--muted-text)] mb-2">
                VEHICLE DETAILS
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--muted-text)]">Type: </span>
                  <span className="text-[var(--foreground)]">
                    {selectedVehicle.vehicleType}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-text)]">Make: </span>
                  <span className="text-[var(--foreground)]">
                    {selectedVehicle.make}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-text)]">Model: </span>
                  <span className="text-[var(--foreground)]">
                    {selectedVehicle.model}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-text)]">Year: </span>
                  <span className="text-[var(--foreground)]">
                    {selectedVehicle.year}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-text)]">Plate: </span>
                  <span className="text-[var(--foreground)]">
                    {selectedVehicle.licensePlate}
                  </span>
                </div>
                {selectedVehicle.color && (
                  <div>
                    <span className="text-[var(--muted-text)]">Color: </span>
                    <span className="text-[var(--foreground)]">
                      {selectedVehicle.color}
                    </span>
                  </div>
                )}
                {selectedVehicle.capacity && (
                  <div>
                    <span className="text-[var(--muted-text)]">Capacity: </span>
                    <span className="text-[var(--foreground)]">
                      {selectedVehicle.capacity}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Photos */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-4 mb-4">
              <p className="text-xs font-medium text-[var(--muted-text)] mb-2">
                PHOTOS & DOCUMENTS
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Front",
                    url: selectedVehicle.photoFrontUrl,
                  },
                  {
                    label: "Back",
                    url: selectedVehicle.photoBackUrl,
                  },
                  {
                    label: "Left Side",
                    url: selectedVehicle.photoLeftUrl,
                  },
                  {
                    label: "Right Side",
                    url: selectedVehicle.photoRightUrl,
                  },
                  {
                    label: "Registration",
                    url: selectedVehicle.vehicleLicenseUrl,
                  },
                ].map((photo) => (
                  <div key={photo.label} className="text-center">
                    {photo.url ? (
                      <a
                        href={resolveUrl(photo.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={resolveUrl(photo.url)}
                          alt={photo.label}
                          className="h-24 w-full rounded-lg object-cover border border-[var(--border-color)] hover:border-[var(--primary)]/50 transition-colors"
                        />
                      </a>
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-alt)]">
                        <span className="text-[10px] text-[var(--muted-text)]">
                          No photo
                        </span>
                      </div>
                    )}
                    <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                      {photo.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Actions */}
            {!reviewAction ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewAction("VERIFIED")}
                  className="flex-1 rounded-lg bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/30 transition-colors"
                >
                  ✅ Approve Vehicle
                </button>
                <button
                  onClick={() => setReviewAction("REJECTED")}
                  className="flex-1 rounded-lg bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  ❌ Reject Vehicle
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {reviewAction === "VERIFIED"
                    ? "Approve this vehicle?"
                    : "Reject this vehicle?"}
                </p>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Admin notes (optional)..."
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setReviewAction(null);
                      setReviewNotes("");
                    }}
                    className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleVehicleReview(
                        reviewAction as "VERIFIED" | "REJECTED",
                      )
                    }
                    disabled={submitting}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                      reviewAction === "VERIFIED"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {submitting
                      ? "Processing..."
                      : reviewAction === "VERIFIED"
                        ? "Confirm Approve"
                        : "Confirm Reject"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
