"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useLanguage } from "../../../context/LanguageContext";
import Avatar from "../../../components/Avatar";

/* ── Types ─────────────────────────────────────────────────────── */

interface ProfileUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  avatar?: string;
  location?: string;
  city?: string;
  country?: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  isIdVerified?: boolean;
  idVerificationStatus?: string;
  isBackgroundVerified?: boolean;
  backgroundCheckStatus?: string;
  isActive?: boolean;
  skills?: Array<{
    skill?: { id?: string; name?: string };
    yearsExp?: number;
    proficiency?: string;
  }>;
}

interface UserProfile {
  bio?: string;
  headline?: string;
  avatarUrl?: string;
  links?: Record<string, unknown>;
  dateOfBirth?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  skillsSummary?: string;
}

interface CandidateData {
  rating?: number;
  ratingCount?: number;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    reviewer?: { firstName?: string; lastName?: string; avatar?: string };
  }>;
}

interface EarningsData {
  estimatedNet?: number;
  pendingHolds?: number;
  totalGross?: number;
  platformFee?: number;
  completedJobs?: number;
}

interface ApplicationSummary {
  id: string;
  status: string;
  appliedAt?: string;
  job?: { id?: string; title?: string };
  jobTitle?: string;
}

interface ConnectStatus {
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  bankAccountLast4?: string;
  country?: string;
}

interface LegalStatus {
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  platformRulesAccepted?: boolean;
  allAccepted?: boolean;
}

interface KycStatus {
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
  overall?: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

function fmt(val: string): string {
  return val
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (
    [
      "ACCEPTED",
      "COMPLETED",
      "HIRED",
      "APPROVED",
      "PASSED",
      "VERIFIED",
    ].includes(s)
  )
    return "bg-emerald-500/15 text-emerald-400";
  if (["REJECTED", "FAILED", "CANCELLED", "WITHDRAWN"].includes(s))
    return "bg-red-500/15 text-red-400";
  if (
    ["PENDING", "REVIEWING", "IN_REVIEW", "SUBMITTED", "IN_PROGRESS"].includes(
      s,
    )
  )
    return "bg-amber-500/15 text-amber-400";
  return "bg-[var(--surface-alt)] text-[var(--muted-text)]";
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`h-4 w-4 ${i <= full ? "text-amber-400" : i === full + 1 && half ? "text-amber-400" : "text-[var(--border-color)]"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-sm font-bold text-[var(--foreground)]">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-[var(--muted-text)]">
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "var(--primary)",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
        <p className="truncate text-xs text-[var(--muted-text)]">{label}</p>
        {sub && (
          <p className="truncate text-[10px] text-[var(--muted-text)]">{sub}</p>
        )}
      </div>
    </div>
  );
  if (href)
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary)]/30"
      >
        {inner}
      </Link>
    );
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
      {inner}
    </div>
  );
}

function VerifRow({
  label,
  verified,
  statusText,
  actionLabel,
  actionHref,
}: {
  label: string;
  verified: boolean;
  statusText?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-2.5">
      <span className="text-xs text-[var(--muted-text)]">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${verified ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}
        >
          {statusText ?? (verified ? "Verified" : "Not Verified")}
        </span>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="rounded-md border border-[var(--border-color)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--primary)]"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {rightAction}
      </div>
      {children}
    </section>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isServiceProvider = user?.role === "JOB_SEEKER";
  const isEmployer = user?.role === "EMPLOYER";

  const [loading, setLoading] = useState(true);
  const [pUser, setPUser] = useState<ProfileUser>({});
  const [pProfile, setPProfile] = useState<UserProfile>({});
  const [candidate, setCandidate] = useState<CandidateData>({});
  const [earnings, setEarnings] = useState<EarningsData>({});
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>({});
  const [legalStatus, setLegalStatus] = useState<LegalStatus>({});
  const [kycStatus, setKycStatus] = useState<KycStatus>({});
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [availabilitySlots, setAvailabilitySlots] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const endpoint = isEmployer ? "/profiles/employer/me" : "/profiles/me";
    const profileRes = await api<Record<string, unknown>>(endpoint);
    if (profileRes.data) {
      const d = profileRes.data;
      const u = (d.user ?? d) as Record<string, unknown>;
      const p = (d.profile ?? d.userProfile ?? {}) as Record<string, unknown>;
      const up = (d.userProfile ?? {}) as Record<string, unknown>;
      setPUser({
        id: u.id as string | undefined,
        firstName: u.firstName as string | undefined,
        lastName: u.lastName as string | undefined,
        email: u.email as string | undefined,
        phone: u.phone as string | undefined,
        role: u.role as string | undefined,
        avatar: resolveAvatarUrl(
          (p.avatarUrl ?? p.logoUrl ?? up.avatarUrl ?? u.avatar) as
            | string
            | undefined,
        ),
        location: u.location as string | undefined,
        city: (u.city ?? p.city) as string | undefined,
        country: (u.country ?? p.country) as string | undefined,
        emailVerifiedAt: u.emailVerifiedAt as string | null | undefined,
        phoneVerifiedAt: u.phoneVerifiedAt as string | null | undefined,
        isIdVerified: u.isIdVerified as boolean | undefined,
        idVerificationStatus: u.idVerificationStatus as string | undefined,
        isBackgroundVerified: u.isBackgroundVerified as boolean | undefined,
        backgroundCheckStatus: u.backgroundCheckStatus as string | undefined,
        isActive: (u.isActive ?? true) as boolean | undefined,
        skills: u.skills as ProfileUser["skills"],
      });
      setPProfile({
        bio: (p.bio ?? u.bio) as string | undefined,
        headline: p.headline as string | undefined,
        avatarUrl: resolveAvatarUrl(
          (p.avatarUrl ?? p.logoUrl ?? up.avatarUrl ?? u.avatar) as
            | string
            | undefined,
        ),
        links: p.links as Record<string, unknown> | undefined,
        dateOfBirth: p.dateOfBirth as string | undefined,
        addressLine1: p.addressLine1 as string | undefined,
        city: (p.city ?? u.city) as string | undefined,
        country: (p.country ?? u.country) as string | undefined,
        postalCode: p.postalCode as string | undefined,
        skillsSummary: p.skillsSummary as string | undefined,
      });
    }

    const promises: Promise<void>[] = [];

    if (isServiceProvider && profileRes.data) {
      const uid = (
        (profileRes.data.user ?? profileRes.data) as Record<string, unknown>
      ).id as string | undefined;
      if (uid) {
        promises.push(
          api<Record<string, unknown>>(`/users/candidates/${uid}`)
            .then((r) => {
              if (r.data)
                setCandidate({
                  rating: r.data.rating as number,
                  ratingCount: r.data.ratingCount as number,
                  reviews: r.data.reviews as CandidateData["reviews"],
                });
            })
            .catch(() => {}),
        );
      }
      promises.push(
        api<EarningsData>("/payments/dashboard/job-seeker")
          .then((r) => {
            if (r.data) {
              const d = r.data as Record<string, unknown>;
              setEarnings({
                estimatedNet: ((d.estimatedNet as number) ?? 0) / 100,
                pendingHolds: ((d.pendingHolds as number) ?? 0) / 100,
                totalGross: ((d.capturedTotal as number) ?? 0) / 100,
                completedJobs: (d.completedJobs as number) ?? 0,
              });
            }
          })
          .catch(() => {}),
      );
      promises.push(
        api<ConnectStatus>("/payments/connect/status")
          .then((r) => {
            if (r.data) setConnectStatus(r.data);
          })
          .catch(() => {}),
      );
      promises.push(
        api<unknown[]>("/availability/me")
          .then((r) => {
            if (r.data)
              setAvailabilitySlots(Array.isArray(r.data) ? r.data.length : 0);
          })
          .catch(() => {}),
      );
    }

    // Applications: seeker uses /applications/me, employer uses /applications/employer
    if (isEmployer) {
      promises.push(
        api<ApplicationSummary[]>("/applications/employer?limit=100")
          .then((r) => {
            const arr = r.data as unknown;
            if (Array.isArray(arr)) {
              setApplications(
                (arr as Record<string, unknown>[]).map((a) => ({
                  id: a.id as string,
                  status: a.status as string,
                  appliedAt: a.appliedAt as string | undefined,
                  jobTitle:
                    (a.jobTitle as string) ??
                    ((a.job as Record<string, unknown> | undefined)
                      ?.title as string),
                  job: a.job as ApplicationSummary["job"],
                })),
              );
            }
          })
          .catch(() => {}),
      );
      promises.push(
        api<unknown[]>("/bookings/employer/me")
          .then((r) => {
            const bd = r.data as Record<string, unknown> | unknown[];
            if (Array.isArray(bd)) setBookingsCount(bd.length);
            else if (bd && Array.isArray((bd as Record<string, unknown>).data))
              setBookingsCount(
                ((bd as Record<string, unknown>).data as unknown[]).length,
              );
          })
          .catch(() => {}),
      );
    } else {
      promises.push(
        api<{ applications?: ApplicationSummary[] }>(
          "/applications/me?limit=100",
        )
          .then((r) => {
            const arr = r.data as unknown;
            if (Array.isArray(arr))
              setApplications(arr as ApplicationSummary[]);
            else if (
              r.data &&
              Array.isArray((r.data as Record<string, unknown>).applications)
            )
              setApplications(
                (r.data as Record<string, unknown>)
                  .applications as ApplicationSummary[],
              );
          })
          .catch(() => {}),
      );
    }

    promises.push(
      api<LegalStatus>("/users/me/legal/status")
        .then((r) => {
          if (r.data) setLegalStatus(r.data);
        })
        .catch(() => {}),
    );

    promises.push(
      api<{ count?: number }>("/notifications/unread-count")
        .then((r) => {
          if (r.data)
            setUnreadNotifs(
              ((r.data as Record<string, unknown>).count as number) ?? 0,
            );
        })
        .catch(() => {}),
    );

    if (isServiceProvider) {
      promises.push(
        api<KycStatus>("/kyc/my-status")
          .then((r) => {
            if (r.data) setKycStatus(r.data);
          })
          .catch(() => {}),
      );
      promises.push(
        api<unknown[]>("/bookings/seeker/me")
          .then((r) => {
            if (r.data && Array.isArray(r.data))
              setBookingsCount(r.data.length);
          })
          .catch(() => {}),
      );
    }

    await Promise.all(promises);
    setLoading(false);
  }, [isEmployer, isServiceProvider]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Derived data ───────────────────────────────────────────── */

  const fullName =
    [pUser.firstName, pUser.lastName].filter(Boolean).join(" ") ||
    pUser.email ||
    "User";
  const location = [pUser.city, pUser.country].filter(Boolean).join(", ");
  const avatarUrl = pUser.avatar || pProfile.avatarUrl;
  const emailVerified = !!pUser.emailVerifiedAt;
  const phoneVerified = !!pUser.phoneVerifiedAt;
  const hasRating =
    typeof candidate.rating === "number" && candidate.rating > 0;

  const links = pProfile.links ?? {};
  const rates = (links.rates ?? []) as Array<Record<string, unknown>>;
  const languages = (links.languages ?? []) as Array<Record<string, unknown>>;
  const workExp = (links.workExperience ?? []) as Array<
    Record<string, unknown>
  >;
  const certs = (links.certifications ?? []) as Array<Record<string, unknown>>;
  const education = (links.education ?? []) as Array<Record<string, unknown>>;
  const projects = (links.projects ?? []) as Array<Record<string, unknown>>;

  const skills = (pUser.skills ?? []).map((s) => {
    const name = s.skill?.name ?? "Skill";
    const years = s.yearsExp ? `${s.yearsExp}y` : "";
    const prof = s.proficiency ?? "";
    return { name, years, proficiency: prof };
  });

  const appStats = {
    total: applications.length,
    active: applications.filter((a) =>
      [
        "PENDING",
        "REVIEWING",
        "SHORTLISTED",
        "IN_PROGRESS",
        "ACCEPTED",
      ].includes(a.status),
    ).length,
    accepted: applications.filter(
      (a) => a.status === "ACCEPTED" || a.status === "COMPLETED",
    ).length,
    rejected: applications.filter(
      (a) => a.status === "REJECTED" || a.status === "WITHDRAWN",
    ).length,
  };

  const recentApps = [...applications]
    .sort(
      (a, b) =>
        new Date(b.appliedAt ?? 0).getTime() -
        new Date(a.appliedAt ?? 0).getTime(),
    )
    .slice(0, 5);

  /* ── Attention items ────────────────────────────────────────── */

  const attentionItems: {
    label: string;
    href: string;
    severity: "warn" | "info";
  }[] = [];
  if (!emailVerified)
    attentionItems.push({
      label: t("profile.emailNotVerified", "Email not verified"),
      href: "/dashboard/settings",
      severity: "warn",
    });
  if (!phoneVerified)
    attentionItems.push({
      label: t("profile.phoneNotVerified", "Phone not verified"),
      href: "/dashboard/settings",
      severity: "warn",
    });
  if (isServiceProvider && !pUser.isIdVerified)
    attentionItems.push({
      label: t(
        "profile.idVerificationIncomplete",
        "ID verification incomplete",
      ),
      href: "/dashboard/settings",
      severity: "warn",
    });
  if (isServiceProvider && !pUser.isBackgroundVerified)
    attentionItems.push({
      label: t("profile.backgroundCheckPending", "Background check pending"),
      href: "/dashboard/settings",
      severity: "info",
    });
  if (isServiceProvider && !connectStatus.payoutsEnabled)
    attentionItems.push({
      label: t("profile.bankAccountNotSetUp", "Bank account not set up"),
      href: "/dashboard/settings",
      severity: "warn",
    });
  if (!legalStatus.allAccepted)
    attentionItems.push({
      label: t(
        "profile.legalDocumentsNeedAcceptance",
        "Legal documents need acceptance",
      ),
      href: "/dashboard/settings",
      severity: "warn",
    });
  if (isServiceProvider && skills.length === 0)
    attentionItems.push({
      label: t("profile.noSkillsAdded", "No skills added to your profile"),
      href: "/dashboard/settings",
      severity: "info",
    });
  if (isServiceProvider && rates.length === 0)
    attentionItems.push({
      label: t("profile.noServiceRatesDefined", "No service rates defined"),
      href: "/dashboard/settings",
      severity: "info",
    });
  if (unreadNotifs > 0)
    attentionItems.push({
      label: `${unreadNotifs} unread notification${unreadNotifs > 1 ? "s" : ""}`,
      href: "/dashboard/notifications",
      severity: "info",
    });

  /* ── Loading ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-alt)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          {t("profile.overview", "Overview")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
          {t("profile.myProfile", "My Profile")}
        </h1>
      </div>

      {/* ── Attention Banner ── */}
      {attentionItems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="h-5 w-5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <span className="text-sm font-semibold text-amber-400">
              {t("profile.needsYourAttention", "Needs your attention")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attentionItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors hover:opacity-80 ${item.severity === "warn" ? "bg-amber-500/15 text-amber-400" : "bg-[var(--primary)]/10 text-[var(--primary)]"}`}
              >
                {item.severity === "warn" ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m0 3.75h.008"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                )}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Profile Header Card ── */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-3xl font-bold text-[var(--primary)] overflow-hidden">
            <Avatar
              src={avatarUrl}
              imgClassName="h-full w-full object-cover"
              fallback={(pUser.firstName?.[0] ?? "?").toUpperCase()}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                {fullName}
              </h2>
              {pUser.isActive && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Active
                </span>
              )}
              {emailVerified && phoneVerified && pUser.isIdVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[var(--muted-text)]">
              {isServiceProvider
                ? t("common.serviceProvider", "Service Provider")
                : isEmployer
                  ? t("common.employer", "Employer")
                  : t("profile.user", "User")}
            </p>
            {location && (
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {location}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {pUser.email && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-text)]">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  {pUser.email}
                  {emailVerified ? (
                    <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[9px] font-bold text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-400">
                      Unverified
                    </span>
                  )}
                </span>
              )}
              {pUser.phone && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-text)]">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                    />
                  </svg>
                  {pUser.phone}
                  {phoneVerified ? (
                    <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[9px] font-bold text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-400">
                      Unverified
                    </span>
                  )}
                </span>
              )}
            </div>

            {hasRating && (
              <div className="mt-3">
                <StarRating
                  rating={candidate.rating!}
                  count={candidate.ratingCount ?? 0}
                />
              </div>
            )}
          </div>
          <Link
            href="/dashboard/settings"
            className="shrink-0 rounded-lg border border-[var(--border-color)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            {t("profile.editProfile", "Edit Profile")}
          </Link>
        </div>

        {pProfile.bio && (
          <div className="mt-5 rounded-xl bg-[var(--surface-alt)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
              {t("profile.aboutMe", "About")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)]">
              {pProfile.bio}
            </p>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isServiceProvider && (
          <StatCard
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            }
            label={t("profile.rating", "Rating")}
            value={hasRating ? candidate.rating!.toFixed(1) : "N/A"}
            sub={
              hasRating
                ? `${candidate.ratingCount} ${t("profile.reviews", "reviews")}`
                : t("profile.noReviewsYet", "No reviews yet")
            }
            color="var(--fulfillment-gold)"
          />
        )}
        <StatCard
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          }
          label={t("profile.applications", "Applications")}
          value={appStats.total}
          sub={`${appStats.active} ${t("profile.activeLower", "active")}, ${appStats.accepted} ${t("profile.completedLower", "completed")}`}
          color="var(--primary)"
          href={
            isEmployer
              ? "/dashboard/employer/applications"
              : "/dashboard/applications"
          }
        />
        {isServiceProvider && (
          <StatCard
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            label={t("profile.estimatedEarnings", "Estimated Earnings")}
            value={`€${(earnings.estimatedNet ?? 0).toFixed(2)}`}
            sub={
              earnings.pendingHolds
                ? `€${earnings.pendingHolds.toFixed(2)} ${t("profile.pendingLower", "pending")}`
                : t("profile.noPendingHolds", "No pending holds")
            }
            color="var(--achievement-green)"
            href="/dashboard/payments"
          />
        )}
        {isServiceProvider && (
          <StatCard
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            }
            label={t("profile.bookings", "Bookings")}
            value={bookingsCount}
            sub={`${availabilitySlots} ${t("profile.availabilitySlots", "availability slots")}`}
            color="var(--soft-blue)"
            href="/dashboard/schedule"
          />
        )}
        {!isServiceProvider && (
          <>
            <StatCard
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              }
              label={t("profile.bookings", "Bookings")}
              value={bookingsCount}
              color="var(--soft-blue)"
              href="/dashboard/employer"
            />
            <StatCard
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              }
              label={t("profile.notifications", "Notifications")}
              value={unreadNotifs}
              sub={t("profile.unread", "Unread")}
              color="var(--fulfillment-gold)"
              href="/dashboard/notifications"
            />
          </>
        )}
      </div>

      {/* ── Identity & Verification ── */}
      <Section
        title={t("profile.identityAndVerification", "Identity & Verification")}
        rightAction={
          <Link
            href="/dashboard/settings"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {t("profile.manage", "Manage")}
          </Link>
        }
      >
        <div className="space-y-2">
          <VerifRow
            label={t("profile.accountStatus", "Account Status")}
            verified={!!pUser.isActive}
            statusText={
              pUser.isActive
                ? t("profile.active", "Active")
                : t("profile.inactive", "Inactive")
            }
          />
          <VerifRow
            label={t("profile.emailAddress", "Email Address")}
            verified={emailVerified}
            actionLabel={
              !emailVerified ? t("profile.verify", "Verify") : undefined
            }
            actionHref="/dashboard/settings"
          />
          <VerifRow
            label={t("profile.phoneNumber", "Phone Number")}
            verified={phoneVerified}
            actionLabel={
              !phoneVerified ? t("profile.verify", "Verify") : undefined
            }
            actionHref="/dashboard/settings"
          />
          {isServiceProvider && (
            <>
              <VerifRow
                label={t("profile.idVerification", "ID Verification")}
                verified={!!pUser.isIdVerified}
                statusText={
                  pUser.idVerificationStatus
                    ? fmt(pUser.idVerificationStatus)
                    : pUser.isIdVerified
                      ? t("profile.verified", "Verified")
                      : t("profile.notStarted", "Not Started")
                }
                actionLabel={
                  !pUser.isIdVerified
                    ? t("profile.completeOnMobile", "Complete on mobile")
                    : undefined
                }
                actionHref="/dashboard/settings"
              />
              <VerifRow
                label={t("profile.backgroundCheck", "Background Check")}
                verified={!!pUser.isBackgroundVerified}
                statusText={
                  pUser.backgroundCheckStatus
                    ? fmt(pUser.backgroundCheckStatus)
                    : pUser.isBackgroundVerified
                      ? t("profile.passed", "Passed")
                      : t("profile.notStarted", "Not Started")
                }
              />
              {kycStatus.overall && (
                <VerifRow
                  label={t("profile.kycOverall", "KYC Overall")}
                  verified={
                    kycStatus.overall === "APPROVED" ||
                    kycStatus.overall === "VERIFIED"
                  }
                  statusText={fmt(kycStatus.overall)}
                />
              )}
            </>
          )}
          <VerifRow
            label={t("profile.legalDocuments", "Legal Documents")}
            verified={!!legalStatus.allAccepted}
            statusText={
              legalStatus.allAccepted
                ? t("profile.allAccepted", "All Accepted")
                : t("profile.pending", "Pending")
            }
            actionLabel={
              !legalStatus.allAccepted
                ? t("profile.review", "Review")
                : undefined
            }
            actionHref="/dashboard/settings"
          />
        </div>
      </Section>

      {/* ── Personal Information ── */}
      <Section title={t("profile.personalInformation", "Personal Information")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: t("profile.phone", "Phone"), value: pUser.phone },
            {
              label: t("profile.dateOfBirth", "Date of Birth"),
              value: pProfile.dateOfBirth
                ? new Date(pProfile.dateOfBirth).toLocaleDateString("en-IE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : undefined,
            },
            {
              label: t("profile.address", "Address"),
              value: pProfile.addressLine1,
            },
            {
              label: t("profile.city", "City"),
              value: pProfile.city || pUser.city,
            },
            {
              label: t("profile.country", "Country"),
              value: pProfile.country || pUser.country,
            },
            {
              label: t("profile.postalCode", "Postal Code"),
              value: pProfile.postalCode,
            },
          ]
            .filter((f) => f.value)
            .map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-2.5"
              >
                <span className="text-xs text-[var(--muted-text)]">
                  {f.label}
                </span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {f.value}
                </span>
              </div>
            ))}
        </div>
      </Section>

      {/* ── Earnings & Payments (Service Providers) ── */}
      {isServiceProvider && (
        <Section
          title={t("profile.earningsAndPayments", "Earnings & Payments")}
          rightAction={
            <Link
              href="/dashboard/payments"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              {t("profile.viewDetails", "View details")}
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-[var(--surface-alt)] p-4 text-center">
              <p className="text-xs text-[var(--muted-text)]">
                {t("profile.estimatedNet", "Estimated Net")}
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                €{(earnings.estimatedNet ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-alt)] p-4 text-center">
              <p className="text-xs text-[var(--muted-text)]">
                {t("profile.pendingHolds", "Pending Holds")}
              </p>
              <p className="mt-1 text-xl font-bold text-amber-400">
                €{(earnings.pendingHolds ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-alt)] p-4 text-center">
              <p className="text-xs text-[var(--muted-text)]">
                {t("profile.completedJobs", "Completed Jobs")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--primary)]">
                {earnings.completedJobs ?? 0}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${connectStatus.payoutsEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  Stripe Connect
                </p>
                <p className="text-[10px] text-[var(--muted-text)]">
                  {connectStatus.payoutsEnabled
                    ? `${t("profile.payoutsEnabled", "Payouts enabled")}${connectStatus.bankAccountLast4 ? ` · ****${connectStatus.bankAccountLast4}` : ""}`
                    : connectStatus.detailsSubmitted
                      ? t("profile.awaitingApproval", "Awaiting approval")
                      : t("profile.notSetUp", "Not set up")}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${connectStatus.payoutsEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}
            >
              {connectStatus.payoutsEnabled
                ? t("profile.active", "Active")
                : t("profile.setupNeeded", "Setup needed")}
            </span>
          </div>
        </Section>
      )}

      {/* ── Applications Overview ── */}
      <Section
        title={t("profile.applications", "Applications")}
        rightAction={
          <Link
            href={
              isEmployer
                ? "/dashboard/employer/applications"
                : "/dashboard/applications"
            }
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {t("profile.viewAll", "View all")}
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4 mb-4">
          {[
            {
              label: t("profile.total", "Total"),
              value: appStats.total,
              color: "text-[var(--foreground)]",
            },
            {
              label: t("profile.active", "Active"),
              value: appStats.active,
              color: "text-[var(--primary)]",
            },
            {
              label: t("profile.completed", "Completed"),
              value: appStats.accepted,
              color: "text-emerald-400",
            },
            {
              label: t("profile.rejected", "Rejected"),
              value: appStats.rejected,
              color: "text-red-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-[var(--surface-alt)] p-3 text-center"
            >
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[var(--muted-text)]">{s.label}</p>
            </div>
          ))}
        </div>
        {recentApps.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--muted-text)]">
              {t("profile.recentApplications", "Recent applications")}
            </p>
            {recentApps.map((app) => (
              <Link
                key={app.id}
                href={
                  isEmployer
                    ? `/dashboard/employer/applications/${app.id}`
                    : `/dashboard/applications/${app.id}`
                }
                className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-2.5 transition-colors hover:bg-[var(--primary)]/5"
              >
                <span className="text-sm font-medium text-[var(--foreground)] truncate">
                  {app.job?.title ?? app.jobTitle ?? "Job"}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(app.status)}`}
                  >
                    {app.status === "PENDING" || app.status === "REVIEWING"
                      ? t("profile.underReview", "Under Review")
                      : fmt(app.status)}
                  </span>
                  {app.appliedAt && (
                    <span className="text-[10px] text-[var(--muted-text)]">
                      {timeAgo(app.appliedAt)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-[var(--surface-alt)] p-4 text-center text-sm text-[var(--muted-text)]">
            {t("profile.noApplicationsYet", "No applications yet")}
          </p>
        )}
      </Section>

      {/* ── Skills & Languages ── */}
      {isServiceProvider && (skills.length > 0 || languages.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {skills.length > 0 && (
            <Section title={t("profile.skills", "Skills")}>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]"
                  >
                    {s.name}
                    {s.proficiency ? (
                      <span className="text-[10px] opacity-70">
                        ({String(s.proficiency)})
                      </span>
                    ) : null}
                    {s.years ? (
                      <span className="text-[10px] opacity-70">
                        {String(s.years)}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {languages.length > 0 && (
            <Section title={t("profile.languages", "Languages")}>
              <div className="flex flex-wrap gap-2">
                {languages.map((l, i) => {
                  const name = (l.language ?? l.name ?? "Language") as string;
                  const level = (l.level ?? l.proficiency ?? "") as string;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--soft-blue)]/10 px-3 py-1 text-xs font-medium text-[var(--soft-blue)]"
                    >
                      {name}
                      {level && (
                        <span className="text-[10px] opacity-70">
                          ({fmt(level)})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Service Rates ── */}
      {isServiceProvider && rates.length > 0 && (
        <Section
          title={t("profile.serviceRates", "Service Rates")}
          rightAction={
            <Link
              href="/dashboard/settings"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              {t("profile.editRates", "Edit rates")}
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rates.map((r, i) => (
              <div
                key={i}
                className="rounded-xl bg-[var(--surface-alt)] p-4 text-center"
              >
                <p className="text-xl font-bold text-[var(--foreground)]">
                  €{r.rate as number}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                  per {fmt((r.paymentType as string) ?? "HOUR").toLowerCase()}
                </p>
                {r.description ? (
                  <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                    {String(r.description)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Work Experience ── */}
      {isServiceProvider && workExp.length > 0 && (
        <Section title={t("profile.workExperience", "Work Experience")}>
          <div className="space-y-3">
            {workExp.map((w, i) => (
              <div key={i} className="rounded-xl bg-[var(--surface-alt)] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {(w.company ?? w.title ?? "Company") as string}
                    </p>
                    {w.category ? (
                      <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                        {String(w.category)}
                      </p>
                    ) : null}
                  </div>
                  {w.years ? (
                    <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                      {Number(w.years)}y
                    </span>
                  ) : null}
                </div>
                {w.fromDate || w.toDate ? (
                  <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                    {String(w.fromDate ?? "")}
                    {w.toDate
                      ? ` - ${String(w.toDate)}`
                      : w.isCurrent
                        ? " - Present"
                        : ""}
                  </p>
                ) : null}
                {w.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--foreground)]/80">
                    {String(w.description)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Education & Certifications ── */}
      {isServiceProvider && (education.length > 0 || certs.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {education.length > 0 && (
            <Section title={t("profile.education", "Education")}>
              <div className="space-y-3">
                {education.map((e, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-[var(--surface-alt)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {(e.title ?? e.degree ?? "Education") as string}
                    </p>
                    {e.institution ? (
                      <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                        {String(e.institution)}
                      </p>
                    ) : null}
                    {e.graduationDate ? (
                      <p className="text-[10px] text-[var(--muted-text)]">
                        {String(e.graduationDate)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          )}
          {certs.length > 0 && (
            <Section title={t("profile.certifications", "Certifications")}>
              <div className="space-y-3">
                {certs.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-[var(--surface-alt)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {(c.title ?? c.name ?? "Certification") as string}
                    </p>
                    {c.institution ? (
                      <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                        {String(c.institution)}
                      </p>
                    ) : null}
                    {c.graduationDate ? (
                      <p className="text-[10px] text-[var(--muted-text)]">
                        {String(c.graduationDate)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Projects ── */}
      {isServiceProvider && projects.length > 0 && (
        <Section title={t("profile.projects", "Projects")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p, i) => (
              <div key={i} className="rounded-xl bg-[var(--surface-alt)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {(p.title ?? "Project") as string}
                </p>
                {p.description ? (
                  <p className="mt-1 text-xs text-[var(--foreground)]/80">
                    {String(p.description)}
                  </p>
                ) : null}
                {p.url ? (
                  <a
                    href={String(p.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {t("profile.viewProject", "View Project")}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Reviews ── */}
      {isServiceProvider &&
        candidate.reviews &&
        candidate.reviews.length > 0 && (
          <Section
            title={t("profile.reviews", "Reviews")}
            rightAction={
              hasRating ? (
                <span className="text-xs text-[var(--muted-text)]">
                  {candidate.ratingCount} total
                </span>
              ) : undefined
            }
          >
            <div className="space-y-3">
              {candidate.reviews.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl bg-[var(--surface-alt)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">
                        {r.reviewer?.firstName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--foreground)]">
                          {[r.reviewer?.firstName, r.reviewer?.lastName]
                            .filter(Boolean)
                            .join(" ") || "User"}
                        </p>
                        <p className="text-[10px] text-[var(--muted-text)]">
                          {timeAgo(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg
                          key={s}
                          className={`h-3 w-3 ${s <= r.rating ? "text-amber-400" : "text-[var(--border-color)]"}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.comment ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--foreground)]/80">
                      {String(r.comment)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        )}

      {/* ── Preferences (Display only) ── */}
      <Section
        title={t("profile.preferences", "Preferences")}
        rightAction={
          <Link
            href="/dashboard/settings"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {t("profile.change", "Change")}
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-2.5">
            <span className="text-xs text-[var(--muted-text)]">
              {t("profile.theme", "Theme")}
            </span>
            <span className="text-sm font-medium text-[var(--foreground)] capitalize">
              {typeof window !== "undefined"
                ? localStorage.getItem("pref_theme") || "system"
                : "system"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-2.5">
            <span className="text-xs text-[var(--muted-text)]">
              {t("profile.notifications", "Notifications")}
            </span>
            <span className="text-sm font-medium text-[var(--foreground)]">
              {unreadNotifs > 0
                ? `${unreadNotifs} ${t("profile.unread", "unread")}`
                : t("profile.allCaughtUp", "All caught up")}
            </span>
          </div>
        </div>
      </Section>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/settings"
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)]"
        >
          {t("profile.editProfileAndSettings", "Edit Profile & Settings")}
        </Link>
        <Link
          href="/dashboard/support"
          className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/30"
        >
          {t("profile.support", "Support")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/30"
        >
          {t("profile.backToFeed", "Back to Feed")}
        </Link>
      </div>
    </div>
  );
}
