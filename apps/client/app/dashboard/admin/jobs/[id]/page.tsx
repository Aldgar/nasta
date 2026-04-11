"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../../lib/api";

/* ─── Type Definitions ─── */
interface PersonInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  isIdVerified?: boolean;
  isBackgroundVerified?: boolean;
  noShowCount?: number;
  city?: string;
  country?: string;
}

interface CompletionRating {
  id: string;
  platformRating: number;
  easeOfServiceRating?: number;
  otherPartyRating: number;
  platformComment?: string;
  otherPartyComment?: string;
  raterId: string;
  createdAt: string;
}

interface ApplicationPayment {
  id: string;
  type: string;
  status: string;
  amount?: number;
  currency?: string;
  stripePaymentIntentId?: string;
  createdAt: string;
}

interface Application {
  id: string;
  status: string;
  coverLetter?: string;
  proposedRate?: number;
  currency?: string;
  verificationCode?: string;
  verificationCodeVerifiedAt?: string;
  serviceProviderMarkedDoneAt?: string;
  rejectionReason?: string;
  withdrawalReason?: string;
  appliedAt: string;
  updatedAt: string;
  completedAt?: string;
  payment?: ApplicationPayment;
  applicant: PersonInfo;
  completionRatings?: CompletionRating[];
}

interface TimesheetEntry {
  id: string;
  clockIn: string;
  clockOut?: string;
  approvedByEmployer: boolean;
  createdAt: string;
}

interface Booking {
  id: string;
  status: string;
  title?: string;
  bookedAt: string;
  updatedAt: string;
  completedAt?: string;
  startTime?: string;
  endTime?: string;
  actualRate?: number;
  currency?: string;
  agreedPayUnit?: string;
  agreedRateAmount?: number;
  agreedCurrency?: string;
  holdAmount?: number;
  holdIntentId?: string;
  capturedAmount?: number;
  capturedAt?: string;
  approvedUnits?: number;
  finalAmount?: number;
  stripeTransferId?: string;
  payoutStatus?: string;
  payoutDate?: string;
  notes?: string;
  jobSeeker: PersonInfo;
  employer?: { id: string; email: string; firstName: string; lastName: string };
  timesheetEntries?: TimesheetEntry[];
}

interface Referral {
  id: string;
  createdAt: string;
  candidate: { id: string; firstName: string; lastName: string; email: string };
}

interface JobDetail {
  id: string;
  title: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  type?: string;
  workMode?: string;
  urgency?: string;
  status: string;
  location?: string;
  city?: string;
  country?: string;
  coordinates?: number[];
  isRemote?: boolean;
  isInstantBook: boolean;
  paymentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  rateAmount?: number;
  duration?: string;
  maxApplicants?: number;
  requiresVehicle?: boolean;
  requiresDriverLicense?: boolean;
  deletionReason?: string;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
  expiresAt?: string;
  employer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    avatar?: string;
    location?: string;
    city?: string;
    country?: string;
    createdAt: string;
  };
  company?: { id: string; name: string };
  category?: { id: string; name: string };
  skills?: { id: string; skill: { id: string; name: string } }[];
  applications: Application[];
  bookings: Booking[];
  referrals?: Referral[];
}

/* ─── Badge Color Helpers ─── */
const JOB_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-gray-300 text-gray-800",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED_NO_SHOW: "bg-red-200 text-red-800",
};

const APP_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-gray-200 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  SHORTLISTED: "bg-indigo-100 text-indigo-800",
  INTERVIEW: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-gray-300 text-gray-800",
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const PAYOUT_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-gray-200 text-gray-700",
  REQUIRES_ACTION: "bg-yellow-100 text-yellow-800",
  SUCCEEDED: "bg-green-100 text-green-800",
  CANCELED: "bg-gray-300 text-gray-800",
  FAILED: "bg-red-100 text-red-700",
};

const ADMIN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "EXPIRED"];

/* ─── Formatting Helpers ─── */
function fmt(date?: string | null) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleString();
}
function fmtDate(date?: string | null) {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString();
}
function money(amount?: number | null, cur?: string) {
  if (amount == null) return "N/A";
  return `${cur ?? "EUR"} ${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function moneyRaw(amount?: number | null, cur?: string) {
  if (amount == null) return "N/A";
  return `${cur ?? "EUR"} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Badge({
  label,
  colors,
}: {
  label: string;
  colors: Record<string, string>;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[label] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function VerificationDot({
  verified,
  label,
}: {
  verified?: boolean;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${verified ? "bg-green-500" : "bg-red-400"}`}
      />
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-[var(--muted-text)] text-xs">{label}</span>
      <p className="font-medium text-[var(--foreground)] text-sm">{value}</p>
    </div>
  );
}

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="text-sm">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < rating ? "text-yellow-500" : "text-gray-300"}
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-[var(--muted-text)]">
        {rating}/{max}
      </span>
    </span>
  );
}

/* ─── Main Component ─── */
export default function AdminJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState<"overview" | "applications" | "bookings">(
    "overview",
  );

  const fetchJob = useCallback(async () => {
    const res = await api<JobDetail>(`/admin/jobs/${id}`);
    if (res.data) {
      setJob({
        ...res.data,
        applications: res.data.applications ?? [],
        bookings: res.data.bookings ?? [],
        referrals: res.data.referrals ?? [],
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    if (
      !window.confirm(`Change job status from ${job.status} to ${newStatus}?`)
    )
      return;
    setUpdating(true);
    const res = await api<{ job: { id: string; status: string } }>(
      `/admin/jobs/${id}/status`,
      { method: "PATCH", body: { status: newStatus } },
    );
    if (res.data)
      setJob((prev) =>
        prev ? { ...prev, status: res.data!.job.status } : prev,
      );
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--muted-text)]">Loading job details…</p>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-[var(--muted-text)]">Job not found.</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--primary)] hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const acceptedApps = job.applications.filter(
    (a) => a.status === "ACCEPTED",
  ).length;
  const completedBookings = job.bookings.filter(
    (b) => b.status === "COMPLETED",
  ).length;
  const allRatings = job.applications.flatMap((a) => a.completionRatings ?? []);
  const avgPlatformRating =
    allRatings.length > 0
      ? (
          allRatings.reduce((s, r) => s + r.platformRating, 0) /
          allRatings.length
        ).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted-text)]">
        <Link
          href="/dashboard/admin/jobs"
          className="hover:text-[var(--primary)] transition-colors"
        >
          Jobs
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)] font-medium truncate">
          {job.title}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {job.title}
            {job.isInstantBook && (
              <span className="ml-2 text-base text-[var(--fulfillment-gold)]">
                ⚡ Instant Book
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {job.category?.name ?? "Uncategorised"} · {job.city ?? "No city"},{" "}
            {job.country ?? "No country"} · Created {fmtDate(job.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge label={job.status} colors={JOB_STATUS_COLORS} />
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleStatusChange(e.target.value);
            }}
            disabled={updating}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">Change status…</option>
            {ADMIN_STATUSES.filter((s) => s !== job.status).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {(
          [
            ["overview", "Overview"],
            ["applications", `Applications (${job.applications.length})`],
            ["bookings", `Bookings (${job.bookings.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-text)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW TAB ═══════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              {
                label: "Applications",
                value: job.applications.length,
                color: "var(--primary)",
              },
              {
                label: "Accepted",
                value: acceptedApps,
                color: "var(--achievement-green)",
              },
              {
                label: "Bookings",
                value: job.bookings.length,
                color: "var(--soft-blue)",
              },
              {
                label: "Completed",
                value: completedBookings,
                color: "var(--fulfillment-gold)",
              },
              {
                label: "Referrals",
                value: job.referrals?.length ?? 0,
                color: "var(--warm-coral)",
              },
              {
                label: "Avg Rating",
                value: avgPlatformRating ?? "N/A",
                color: "var(--primary)",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 text-center"
              >
                <p className="text-2xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-xs text-[var(--muted-text)]">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Job Details Card */}
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                Job Details
              </h2>
              {job.description && (
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap border-b border-[var(--border-color)] pb-3">
                  {job.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow
                  label="Job Type"
                  value={job.type?.replace(/_/g, " ") ?? "Not specified"}
                />
                <InfoRow
                  label="Work Mode"
                  value={job.workMode?.replace(/_/g, " ") ?? "Not specified"}
                />
                <InfoRow label="Urgency" value={job.urgency ?? "Normal"} />
                <InfoRow
                  label="Payment Type"
                  value={job.paymentType ?? "Not specified"}
                />
                <InfoRow
                  label="Salary Range"
                  value={
                    job.salaryMin != null
                      ? `${job.currency ?? "EUR"} ${job.salaryMin}${job.salaryMax ? ` – ${job.salaryMax}` : ""}`
                      : "Negotiable"
                  }
                />
                <InfoRow
                  label="Rate Amount"
                  value={
                    job.rateAmount != null
                      ? `${job.currency ?? "EUR"} ${job.rateAmount}`
                      : "See salary"
                  }
                />
                <InfoRow label="Start Date" value={fmtDate(job.startDate)} />
                <InfoRow label="End Date" value={fmtDate(job.endDate)} />
                <InfoRow label="Duration" value={job.duration ?? "Flexible"} />
                <InfoRow label="Expires At" value={fmtDate(job.expiresAt)} />
                <InfoRow
                  label="Location"
                  value={
                    [job.location, job.city, job.country]
                      .filter(Boolean)
                      .join(", ") || "Not specified"
                  }
                />
                <InfoRow label="Remote" value={job.isRemote ? "Yes" : "No"} />
                <InfoRow
                  label="Max Applicants"
                  value={job.maxApplicants ?? "Unlimited"}
                />
                <InfoRow
                  label="Instant Book"
                  value={job.isInstantBook ? "Yes ⚡" : "No"}
                />
                <InfoRow
                  label="Requires Vehicle"
                  value={job.requiresVehicle ? "Yes 🚗" : "No"}
                />
                <InfoRow
                  label="Requires License"
                  value={job.requiresDriverLicense ? "Yes" : "No"}
                />
                <InfoRow label="Created" value={fmt(job.createdAt)} />
                <InfoRow label="Last Updated" value={fmt(job.updatedAt)} />
              </div>
              {job.deletionReason && (
                <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <strong>Deletion Reason:</strong> {job.deletionReason}
                </div>
              )}
            </div>

            {/* Employer Card */}
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                  Employer
                </h2>
                <div className="flex items-center gap-3">
                  {job.employer.avatar ? (
                    <img
                      src={resolveAvatarUrl(job.employer.avatar)}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/20 text-lg font-bold text-[var(--primary)]">
                      {job.employer.firstName?.[0]}
                      {job.employer.lastName?.[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {job.employer.firstName} {job.employer.lastName}
                      <span className="ml-2 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs text-[var(--primary)]">
                        {job.employer.role}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--muted-text)]">
                      {job.employer.email}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-[var(--border-color)]">
                  <InfoRow
                    label="Phone"
                    value={job.employer.phone ?? "Not provided"}
                  />
                  <InfoRow
                    label="Address"
                    value={job.employer.location ?? "Not provided"}
                  />
                  <InfoRow
                    label="City / Country"
                    value={
                      [job.employer.city, job.employer.country]
                        .filter(Boolean)
                        .join(", ") || "Not provided"
                    }
                  />
                  <InfoRow
                    label="Joined"
                    value={fmtDate(job.employer.createdAt)}
                  />
                </div>
              </div>

              {/* Company */}
              {job.company && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-1">
                    Company
                  </h3>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {job.company.name}
                  </p>
                </div>
              )}

              {/* Skills & Requirements */}
              {(job.skills?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                    Required Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills!.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs text-[var(--primary)]"
                      >
                        {s.skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(job.requirements?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                    Requirements
                  </h3>
                  <ul className="list-disc pl-4 text-sm text-[var(--foreground)] space-y-1">
                    {job.requirements!.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(job.responsibilities?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                    Responsibilities
                  </h3>
                  <ul className="list-disc pl-4 text-sm text-[var(--foreground)] space-y-1">
                    {job.responsibilities!.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Referrals */}
          {(job.referrals?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-3">
                Referrals
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {job.referrals!.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-color)] p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {ref.candidate.firstName} {ref.candidate.lastName}
                      </p>
                      <p className="text-xs text-[var(--muted-text)]">
                        {ref.candidate.email}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--muted-text)]">
                      {fmtDate(ref.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ APPLICATIONS TAB ═══════════ */}
      {tab === "applications" && (
        <div className="space-y-4">
          {job.applications.length === 0 ? (
            <p className="py-12 text-center text-[var(--muted-text)]">
              No applications yet.
            </p>
          ) : (
            job.applications.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 space-y-4"
              >
                {/* Applicant header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {app.applicant.avatar ? (
                      <img
                        src={resolveAvatarUrl(app.applicant.avatar)}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--soft-blue)]/20 text-sm font-bold text-[var(--soft-blue)]">
                        {app.applicant.firstName?.[0]}
                        {app.applicant.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {app.applicant.firstName} {app.applicant.lastName}
                      </p>
                      <p className="text-xs text-[var(--muted-text)]">
                        {app.applicant.email}
                        {app.applicant.phone && ` · ${app.applicant.phone}`}
                        {app.applicant.city &&
                          ` · ${app.applicant.city}, ${app.applicant.country ?? ""}`}
                      </p>
                    </div>
                  </div>
                  <Badge label={app.status} colors={APP_STATUS_COLORS} />
                </div>

                {/* Verification dots for applicant */}
                <div className="flex flex-wrap gap-3">
                  <VerificationDot
                    verified={app.applicant.isIdVerified}
                    label="ID Verified"
                  />
                  <VerificationDot
                    verified={app.applicant.isBackgroundVerified}
                    label="BG Check"
                  />
                  {(app.applicant.noShowCount ?? 0) > 0 && (
                    <span className="text-xs text-red-500">
                      ⚠ {app.applicant.noShowCount} no-shows
                    </span>
                  )}
                </div>

                {/* Application details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-color)] pt-3">
                  <InfoRow label="Applied" value={fmt(app.appliedAt)} />
                  <InfoRow label="Last Updated" value={fmt(app.updatedAt)} />
                  <InfoRow label="Completed" value={fmt(app.completedAt)} />
                  <InfoRow
                    label="Proposed Rate"
                    value={
                      app.proposedRate != null
                        ? `${app.currency ?? "EUR"} ${app.proposedRate}`
                        : "Not proposed"
                    }
                  />
                </div>

                {/* Verification code */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-color)] pt-3">
                  <InfoRow
                    label="Verification Code"
                    value={
                      app.verificationCode ? (
                        <span className="font-mono text-[var(--primary)]">
                          {app.verificationCode}
                        </span>
                      ) : (
                        "Not generated"
                      )
                    }
                  />
                  <InfoRow
                    label="Code Verified At"
                    value={fmt(app.verificationCodeVerifiedAt)}
                  />
                  <InfoRow
                    label="SP Marked Done"
                    value={fmt(app.serviceProviderMarkedDoneAt)}
                  />
                  <InfoRow label="" value="" />
                </div>

                {/* Rejection / Withdrawal */}
                {(app.rejectionReason || app.withdrawalReason) && (
                  <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-color)] pt-3">
                    {app.rejectionReason && (
                      <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                        <strong>Rejection:</strong> {app.rejectionReason}
                      </div>
                    )}
                    {app.withdrawalReason && (
                      <div className="rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
                        <strong>Withdrawal:</strong> {app.withdrawalReason}
                      </div>
                    )}
                  </div>
                )}

                {/* Cover letter */}
                {app.coverLetter && (
                  <div className="border-t border-[var(--border-color)] pt-3">
                    <p className="text-xs text-[var(--muted-text)] mb-1">
                      Cover Letter
                    </p>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {app.coverLetter}
                    </p>
                  </div>
                )}

                {/* Payment */}
                {app.payment && (
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                      Payment
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <InfoRow
                        label="Status"
                        value={
                          <Badge
                            label={app.payment.status}
                            colors={PAYMENT_STATUS_COLORS}
                          />
                        }
                      />
                      <InfoRow
                        label="Amount"
                        value={money(app.payment.amount, app.payment.currency)}
                      />
                      <InfoRow label="Type" value={app.payment.type} />
                      <InfoRow
                        label="Stripe ID"
                        value={
                          <span className="text-xs font-mono truncate block">
                            {app.payment.stripePaymentIntentId ?? "Pending"}
                          </span>
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Completion Ratings */}
                {(app.completionRatings?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                      Completion Ratings
                    </h4>
                    <div className="space-y-2">
                      {app.completionRatings!.map((r) => (
                        <div
                          key={r.id}
                          className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm rounded-lg border border-[var(--border-color)] p-2"
                        >
                          <div>
                            <span className="text-[var(--muted-text)] text-xs">
                              Platform
                            </span>
                            <br />
                            <Stars rating={r.platformRating} />
                          </div>
                          {r.easeOfServiceRating != null && (
                            <div>
                              <span className="text-[var(--muted-text)] text-xs">
                                Ease of Service
                              </span>
                              <br />
                              <Stars rating={r.easeOfServiceRating} />
                            </div>
                          )}
                          <div>
                            <span className="text-[var(--muted-text)] text-xs">
                              Other Party
                            </span>
                            <br />
                            <Stars rating={r.otherPartyRating} />
                          </div>
                          {r.platformComment && (
                            <div className="col-span-full text-xs text-[var(--muted-text)]">
                              Platform: {r.platformComment}
                            </div>
                          )}
                          {r.otherPartyComment && (
                            <div className="col-span-full text-xs text-[var(--muted-text)]">
                              Other Party: {r.otherPartyComment}
                            </div>
                          )}
                          <div className="col-span-full text-xs text-[var(--muted-text)]">
                            Rated on {fmtDate(r.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════ BOOKINGS TAB ═══════════ */}
      {tab === "bookings" && (
        <div className="space-y-4">
          {job.bookings.length === 0 ? (
            <p className="py-12 text-center text-[var(--muted-text)]">
              No bookings yet.
            </p>
          ) : (
            job.bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-5 space-y-4"
              >
                {/* Booking header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {booking.jobSeeker.avatar ? (
                      <img
                        src={resolveAvatarUrl(booking.jobSeeker.avatar)}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--achievement-green)]/20 text-sm font-bold text-[var(--achievement-green)]">
                        {booking.jobSeeker.firstName?.[0]}
                        {booking.jobSeeker.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {booking.jobSeeker.firstName}{" "}
                        {booking.jobSeeker.lastName}
                        <span className="ml-2 text-xs text-[var(--muted-text)]">
                          Service Provider
                        </span>
                      </p>
                      <p className="text-xs text-[var(--muted-text)]">
                        {booking.jobSeeker.email}
                        {booking.jobSeeker.phone &&
                          ` · ${booking.jobSeeker.phone}`}
                        {booking.jobSeeker.city &&
                          ` · ${booking.jobSeeker.city}`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    label={booking.status}
                    colors={BOOKING_STATUS_COLORS}
                  />
                </div>

                {/* SP Verification */}
                <div className="flex flex-wrap gap-3">
                  <VerificationDot
                    verified={booking.jobSeeker.isIdVerified}
                    label="ID Verified"
                  />
                  <VerificationDot
                    verified={booking.jobSeeker.isBackgroundVerified}
                    label="BG Check"
                  />
                  {(booking.jobSeeker.noShowCount ?? 0) > 0 && (
                    <span className="text-xs text-red-500">
                      ⚠ {booking.jobSeeker.noShowCount} no-shows
                    </span>
                  )}
                </div>

                {/* Timeline */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-color)] pt-3">
                  <InfoRow label="Booked At" value={fmt(booking.bookedAt)} />
                  <InfoRow label="Start Time" value={fmt(booking.startTime)} />
                  <InfoRow label="End Time" value={fmt(booking.endTime)} />
                  <InfoRow
                    label="Completed At"
                    value={fmt(booking.completedAt)}
                  />
                </div>

                {/* Agreed Terms */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-color)] pt-3">
                  <InfoRow
                    label="Agreed Rate"
                    value={
                      booking.agreedRateAmount != null
                        ? `${booking.agreedCurrency ?? "EUR"} ${booking.agreedRateAmount} / ${booking.agreedPayUnit ?? "hr"}`
                        : "Not agreed yet"
                    }
                  />
                  <InfoRow
                    label="Actual Rate"
                    value={
                      booking.actualRate != null
                        ? moneyRaw(booking.actualRate, booking.currency)
                        : "Pending calculation"
                    }
                  />
                  <InfoRow
                    label="Approved Units"
                    value={booking.approvedUnits ?? "Pending approval"}
                  />
                  <InfoRow
                    label="Last Updated"
                    value={fmt(booking.updatedAt)}
                  />
                </div>

                {/* Payment Details */}
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                    Payment Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoRow
                      label="Hold Amount"
                      value={money(booking.holdAmount, booking.currency)}
                    />
                    <InfoRow
                      label="Captured Amount"
                      value={money(booking.capturedAmount, booking.currency)}
                    />
                    <InfoRow
                      label="Final Amount"
                      value={
                        <span className="font-semibold text-[var(--achievement-green)]">
                          {money(booking.finalAmount, booking.currency)}
                        </span>
                      }
                    />
                    <InfoRow
                      label="Captured At"
                      value={fmt(booking.capturedAt)}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoRow
                      label="Payout Status"
                      value={
                        booking.payoutStatus ? (
                          <Badge
                            label={booking.payoutStatus}
                            colors={PAYOUT_COLORS}
                          />
                        ) : (
                          "Awaiting payout"
                        )
                      }
                    />
                    <InfoRow
                      label="Payout Date"
                      value={fmt(booking.payoutDate)}
                    />
                    <InfoRow
                      label="Hold Intent ID"
                      value={
                        <span className="text-xs font-mono truncate block">
                          {booking.holdIntentId ?? "Not created"}
                        </span>
                      }
                    />
                    <InfoRow
                      label="Stripe Transfer"
                      value={
                        <span className="text-xs font-mono truncate block">
                          {booking.stripeTransferId ?? "Not transferred"}
                        </span>
                      }
                    />
                  </div>
                </div>

                {/* Timesheet Entries */}
                {(booking.timesheetEntries?.length ?? 0) > 0 && (
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--background)] p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] mb-2">
                      Timesheet Entries
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted-text)] border-b border-[var(--border-color)]">
                            <th className="py-2 pr-3">Clock In</th>
                            <th className="py-2 pr-3">Clock Out</th>
                            <th className="py-2 pr-3">Approved</th>
                            <th className="py-2">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.timesheetEntries!.map((ts) => (
                            <tr
                              key={ts.id}
                              className="border-b border-[var(--border-color)] last:border-0"
                            >
                              <td className="py-2 pr-3 text-[var(--foreground)]">
                                {fmt(ts.clockIn)}
                              </td>
                              <td className="py-2 pr-3 text-[var(--foreground)]">
                                {fmt(ts.clockOut)}
                              </td>
                              <td className="py-2 pr-3">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ts.approvedByEmployer ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                                >
                                  {ts.approvedByEmployer
                                    ? "Approved"
                                    : "Pending"}
                                </span>
                              </td>
                              <td className="py-2 text-[var(--muted-text)]">
                                {fmtDate(ts.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {booking.notes && (
                  <div className="border-t border-[var(--border-color)] pt-3">
                    <p className="text-xs text-[var(--muted-text)] mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {booking.notes}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
