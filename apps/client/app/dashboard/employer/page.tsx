"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth";
import { api, resolveAvatarUrl } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";
import Avatar from "../../../components/Avatar";

interface VerifiedProvider {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  headline?: string;
  city?: string;
  country?: string;
  rating: number;
  ratingCount: number;
  skills: { id: string; name: string }[];
  skillsSummary?: string[];
  hourlyRate?: number;
  rates?: { rate: number; paymentType: string }[];
}

interface ActiveBooking {
  id: string;
  status: string;
  completedAt?: string | null;
  verificationCodeVerifiedAt?: string | null;
  appliedAt?: string;
  job?: {
    id: string;
    title?: string;
    startDate?: string;
    location?: string;
    city?: string;
    country?: string;
    type?: string;
    workMode?: string;
    rateAmount?: number;
    currency?: string;
    paymentType?: string;
    category?: { id: string; name: string };
  };
  applicant?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    city?: string;
    country?: string;
  };
}

interface Stats {
  activeJobs: number;
  pendingApplications: number;
  completedJobs: number;
}

interface RecentApplication {
  id: string;
  jobTitle?: string;
  applicantName?: string;
  status: string;
  createdAt?: string;
}

export default function EmployerFeed() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [recentApps, setRecentApps] = useState<RecentApplication[]>([]);
  const [stats, setStats] = useState<Stats>({
    activeJobs: 0,
    pendingApplications: 0,
    completedJobs: 0,
  });
  const [verifiedProviders, setVerifiedProviders] = useState<
    VerifiedProvider[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    async function fetchData() {
      const [activeAppsRes, jobsRes, appsRes, recentAppsRes, providersRes] =
        await Promise.all([
          api<any>("/applications/employer?status=ACCEPTED&limit=10"),
          api<{ active?: number; completed?: number; total?: number }>(
            "/jobs/employer/stats",
          ),
          api<{ pending?: number; total?: number }>(
            "/applications/employer/stats",
          ),
          api<RecentApplication[]>("/applications/employer/recent?limit=5"),
          api<{ candidates: VerifiedProvider[] }>("/users/candidates?limit=6"),
        ]);

      if (activeAppsRes.data) {
        const raw = activeAppsRes.data as any;
        const items: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
            ? raw.data
            : Array.isArray(raw.applications)
              ? raw.applications
              : [];
        const active: ActiveBooking[] = items
          .filter((a: any) => !a.completedAt)
          .map((a: any) => ({
            id: a.id as string,
            status: a.status as string,
            completedAt: a.completedAt,
            verificationCodeVerifiedAt: a.verificationCodeVerifiedAt,
            appliedAt: a.appliedAt,
            job: a.job,
            applicant: a.applicant,
          }));
        setBookings(active);
      }
      if (jobsRes.data) {
        const d = jobsRes.data as Record<string, unknown>;
        setStats((prev) => ({
          ...prev,
          activeJobs: (d.active as number) ?? 0,
          completedJobs: (d.completed as number) ?? 0,
        }));
      }
      if (appsRes.data) {
        const d = appsRes.data as Record<string, unknown>;
        setStats((prev) => ({
          ...prev,
          pendingApplications: (d.pending as number) ?? 0,
        }));
      }
      if (recentAppsRes.data && Array.isArray(recentAppsRes.data)) {
        setRecentApps(
          (recentAppsRes.data as unknown as Record<string, unknown>[]).map(
            (a) => ({
              id: a.id as string,
              jobTitle:
                (a.jobTitle as string) ??
                ((a.job as Record<string, unknown> | undefined)
                  ?.title as string),
              applicantName:
                (a.applicantName as string) ??
                ([
                  (a.applicant as Record<string, unknown> | undefined)
                    ?.firstName,
                  (a.applicant as Record<string, unknown> | undefined)
                    ?.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                  undefined),
              status: a.status as string,
              createdAt: (a.createdAt ?? a.appliedAt) as string | undefined,
            }),
          ),
        );
      }
      if (
        providersRes.data?.candidates &&
        Array.isArray(providersRes.data.candidates)
      )
        setVerifiedProviders(providersRes.data.candidates);
      setLoading(false);
    }
    fetchData();
  }, []);

  const verified = {
    email: user?.emailVerified ?? false,
    phone: user?.phoneVerified ?? false,
    address: user?.addressVerified ?? false,
  };
  const canPostJobs = verified.email && verified.phone;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("employerDashboard.goodMorning", "Good morning");
    if (h < 18) return t("employerDashboard.goodAfternoon", "Good afternoon");
    return t("employerDashboard.goodEvening", "Good evening");
  })();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column ───────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Header */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
              {t("employerDashboard.commandCenter", "Command Center")}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              {greeting}, {user?.displayName || user?.firstName || "there"} 👋
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              {t(
                "employerDashboard.manageWorkforce",
                "Manage your workforce and track your jobs.",
              )}
            </p>
          </div>

          {/* Verification banner - only when email or phone are unverified */}
          {!canPostJobs && (
            <div className="rounded-2xl border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/10 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fulfillment-gold)]/20 text-[var(--fulfillment-gold)]">
                  <svg
                    className="h-5 w-5"
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
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--fulfillment-gold)]">
                    {t(
                      "employerDashboard.completeVerification",
                      "Complete your verification",
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    {!verified.email && !verified.phone
                      ? t(
                          "employerDashboard.verifyEmailAndPhone",
                          "Verify your email and phone number to start posting jobs and requesting instant workers.",
                        )
                      : !verified.email
                        ? t(
                            "employerDashboard.verifyEmail",
                            "Verify your email address to start posting jobs and requesting instant workers.",
                          )
                        : t(
                            "employerDashboard.verifyPhone",
                            "Verify your phone number to start posting jobs and requesting instant workers.",
                          )}
                  </p>
                  <Link
                    href="/dashboard/settings"
                    className="mt-3 inline-flex rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--soft-blue)]"
                  >
                    {t("employerDashboard.goToSettings", "Go to Settings")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Stats row */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--primary)]">
                  {stats.activeJobs}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                  {t("employerDashboard.activeJobs", "Active Jobs")}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--fulfillment-gold)]">
                  {stats.pendingApplications}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                  {t("employerDashboard.pendingApps", "Pending Apps")}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--achievement-green)]">
                  {stats.completedJobs}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                  {t("employerDashboard.completed", "Completed")}
                </p>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-3">
            <Link
              href={
                canPostJobs
                  ? "/dashboard/employer/post-job"
                  : "/dashboard/settings"
              }
              className={`flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] ${!canPostJobs ? "opacity-60" : ""}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              {t("employerDashboard.postAJob", "Post a Job")}
            </Link>
            <Link
              href="/dashboard/employer/my-jobs"
              className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-all hover:border-[var(--soft-blue)]/40 hover:bg-[var(--soft-blue)]/10 hover:text-[var(--soft-blue)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
              {t("employerDashboard.myJobs", "My Jobs")}
            </Link>
          </div>

          {/* Active bookings */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
              {t("employerDashboard.activeBookings", "Active Bookings")}
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]"
                  />
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-8 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-[var(--muted-text)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                  />
                </svg>
                <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                  {t(
                    "employerDashboard.noActiveBookings",
                    "No active bookings",
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  {t(
                    "employerDashboard.bookingsWillAppear",
                    "When you hire a service provider, active bookings will appear here.",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const started = !!b.verificationCodeVerifiedAt;
                  const jobTitle = b.job?.title || "Active Job";
                  const providerName =
                    [b.applicant?.firstName, b.applicant?.lastName]
                      .filter(Boolean)
                      .join(" ") || "Service Provider";
                  const categoryName =
                    typeof b.job?.category === "object"
                      ? b.job.category?.name
                      : undefined;
                  const jobType = b.job?.type?.replace(/_/g, " ");
                  const workMode = b.job?.workMode?.replace(/_/g, " ");
                  const locationStr = [b.job?.city, b.job?.country]
                    .filter(Boolean)
                    .join(", ");
                  const rate =
                    b.job?.rateAmount != null
                      ? (b.job.rateAmount / 100).toFixed(2)
                      : null;
                  const currency = b.job?.currency || "EUR";
                  const payUnit = b.job?.paymentType || "";
                  const startDate = b.job?.startDate;

                  // Employer reminders
                  const reminders: {
                    icon: string;
                    text: string;
                    color: string;
                  }[] = [];
                  if (!started) {
                    reminders.push({
                      icon: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
                      text: t(
                        "employerDashboard.shareVerificationCode",
                        "Share verification code with the service provider to start the job",
                      ),
                      color: "var(--fulfillment-gold)",
                    });
                  }
                  if (started) {
                    reminders.push({
                      icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                      text: t(
                        "employerDashboard.serviceInProgress",
                        "Service in progress — mark as complete when finished",
                      ),
                      color: "var(--achievement-green)",
                    });
                  }

                  return (
                    <Link
                      key={b.id}
                      href={`/dashboard/employer/applications/${b.id}`}
                      className="group block"
                    >
                      <div
                        className={`relative overflow-hidden rounded-2xl border transition-all hover:shadow-xl ${
                          started
                            ? "border-[var(--achievement-green)]/20 hover:border-[var(--achievement-green)]/40 hover:shadow-[var(--achievement-green)]/10"
                            : "border-[var(--fulfillment-gold)]/20 hover:border-[var(--fulfillment-gold)]/40 hover:shadow-[var(--fulfillment-gold)]/10"
                        }`}
                      >
                        {/* Background accents */}
                        <div
                          className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full ${started ? "bg-[var(--achievement-green)]/5" : "bg-[var(--fulfillment-gold)]/5"}`}
                        />
                        <div
                          className={`pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full ${started ? "bg-[var(--achievement-green)]/8" : "bg-[var(--fulfillment-gold)]/8"}`}
                        />

                        {/* Main content */}
                        <div className="relative p-5">
                          <div className="flex items-start gap-4">
                            {/* Provider avatar */}
                            <div className="relative shrink-0">
                              <Avatar
                                src={resolveAvatarUrl(b.applicant?.avatar)}
                                alt={providerName}
                                imgClassName={`h-12 w-12 rounded-xl object-cover ring-2 ${started ? "ring-[var(--achievement-green)]/20" : "ring-[var(--fulfillment-gold)]/20"}`}
                                fallback={
                                  <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold ${started ? "bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]" : "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"}`}
                                  >
                                    {(
                                      b.applicant?.firstName?.[0] || "S"
                                    ).toUpperCase()}
                                  </div>
                                }
                              />
                              {started && (
                                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)] bg-[var(--achievement-green)]">
                                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--achievement-green)]/60" />
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              {/* Top row: badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    started
                                      ? "bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]"
                                      : "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${started ? "animate-pulse bg-[var(--achievement-green)]" : "bg-[var(--fulfillment-gold)]"}`}
                                  />
                                  {started
                                    ? t(
                                        "employerDashboard.inProgress",
                                        "In Progress",
                                      )
                                    : t(
                                        "employerDashboard.awaitingStart",
                                        "Awaiting Start",
                                      )}
                                </span>
                                {categoryName && (
                                  <span className="rounded-full bg-[var(--primary)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                                    {categoryName}
                                  </span>
                                )}
                                {jobType && (
                                  <span className="rounded-full bg-[var(--muted-text)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-text)] capitalize">
                                    {jobType.toLowerCase()}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <h3 className="mt-1.5 text-base font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">
                                {jobTitle}
                              </h3>

                              {/* Details */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-text)]">
                                <span className="flex items-center gap-1.5">
                                  <svg
                                    className="h-3.5 w-3.5 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                                    />
                                  </svg>
                                  {providerName}
                                </span>
                                {locationStr && (
                                  <span className="flex items-center gap-1.5">
                                    <svg
                                      className="h-3.5 w-3.5 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={1.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                                      />
                                    </svg>
                                    {locationStr}
                                  </span>
                                )}
                                {rate && (
                                  <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                                    <svg
                                      className="h-3.5 w-3.5 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={1.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                                      />
                                    </svg>
                                    €{rate}
                                    {payUnit
                                      ? ` / ${payUnit.toLowerCase().replace("ly", "").replace("month", "mo")}`
                                      : ""}
                                  </span>
                                )}
                                {workMode && (
                                  <span className="flex items-center gap-1.5 capitalize">
                                    <svg
                                      className="h-3.5 w-3.5 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={1.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
                                      />
                                    </svg>
                                    {workMode.toLowerCase()}
                                  </span>
                                )}
                              </div>

                              {/* Date chip */}
                              {startDate && (
                                <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg bg-[var(--surface-alt,var(--border-color))]/30 px-3 py-1.5">
                                  <svg
                                    className="h-3.5 w-3.5 text-[var(--primary)]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                                    />
                                  </svg>
                                  <span className="text-[11px] font-medium text-[var(--foreground)]">
                                    {new Date(startDate).toLocaleDateString(
                                      undefined,
                                      {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Right: arrow */}
                            <div className="flex shrink-0 items-center self-center">
                              <svg
                                className="h-5 w-5 text-[var(--muted-text)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Reminders strip */}
                        {reminders.length > 0 && (
                          <div className="border-t border-[var(--border-color)]/50 bg-[var(--surface-alt,var(--surface))]/50 px-5 py-2.5">
                            {reminders.map((r, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-2 text-[11px] text-[var(--muted-text)]"
                              >
                                <svg
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: r.color }}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d={r.icon}
                                  />
                                </svg>
                                {r.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent applications feed */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {t(
                  "employerDashboard.recentApplications",
                  "Recent Applications",
                )}
              </h2>
              <Link
                href="/dashboard/employer/applications"
                className="text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
              >
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-[var(--surface)]"
                  />
                ))}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-6 text-center">
                <p className="text-sm text-[var(--muted-text)]">
                  {t(
                    "employerDashboard.noRecentApplications",
                    "No recent applications. Post a job to start receiving applicants!",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentApps.map((app) => {
                  const statusColor: Record<string, string> = {
                    PENDING:
                      "text-[var(--fulfillment-gold)] bg-[var(--fulfillment-gold)]/15",
                    REVIEWING:
                      "text-[var(--soft-blue)] bg-[var(--soft-blue)]/15",
                    SHORTLISTED: "text-[var(--primary)] bg-[var(--primary)]/15",
                    ACCEPTED:
                      "text-[var(--achievement-green)] bg-[var(--achievement-green)]/15",
                    REJECTED:
                      "text-[var(--alert-red)] bg-[var(--alert-red)]/15",
                  };
                  const color =
                    statusColor[app.status] ??
                    "text-[var(--muted-text)] bg-[var(--surface-alt)]";
                  return (
                    <Link
                      key={app.id}
                      href={`/dashboard/employer/applications/${app.id}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {app.jobTitle || "Job Application"}
                        </p>
                        {app.applicantName && (
                          <p className="truncate text-xs text-[var(--muted-text)]">
                            {t("employerDashboard.from", "From:")}{" "}
                            {app.applicantName}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${color}`}
                      >
                        {app.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Verified Service Providers */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {t(
                  "employerDashboard.verifiedServiceProviders",
                  "Verified Service Providers",
                )}
              </h2>
              <Link
                href="/dashboard/employer/service-providers"
                className="text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
              >
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-xl bg-[var(--surface)]"
                  />
                ))}
              </div>
            ) : verifiedProviders.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-6 text-center">
                <p className="text-sm text-[var(--muted-text)]">
                  {t(
                    "employerDashboard.noVerifiedProviders",
                    "No verified service providers yet.",
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {verifiedProviders.map((prov) => {
                  const loc = [prov.city, prov.country]
                    .filter(Boolean)
                    .join(", ");
                  const rate = prov.hourlyRate
                    ? `€${(prov.hourlyRate / 100).toFixed(0)}/hr`
                    : prov.rates?.[0]
                      ? `€${(prov.rates[0].rate / 100).toFixed(0)}/${prov.rates[0].paymentType === "HOUR" ? "hr" : prov.rates[0].paymentType === "DAY" ? "day" : prov.rates[0].paymentType.toLowerCase()}`
                      : null;
                  const topSkills = (
                    prov.skillsSummary ??
                    prov.skills?.map((s) => s.name) ??
                    []
                  ).slice(0, 2);
                  return (
                    <Link
                      key={prov.id}
                      href={`/dashboard/employer/service-providers/${prov.id}`}
                      className="group rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
                    >
                      <div className="flex flex-col items-center text-center">
                        <Avatar
                          src={resolveAvatarUrl(prov.avatar)}
                          imgClassName="h-12 w-12 rounded-full object-cover"
                          fallback={
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/15 text-sm font-bold text-[var(--primary)]">
                              {prov.firstName?.[0]}
                              {prov.lastName?.[0]}
                            </div>
                          }
                        />
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                          {prov.firstName} {prov.lastName}
                        </p>
                        {prov.headline && (
                          <p className="mt-0.5 text-[10px] text-[var(--muted-text)] line-clamp-1">
                            {prov.headline}
                          </p>
                        )}
                        {loc && (
                          <p className="mt-0.5 text-[10px] text-[var(--muted-text)]">
                            {loc}
                          </p>
                        )}
                        {prov.rating > 0 && (
                          <div className="mt-1.5 flex items-center gap-0.5">
                            <svg
                              className="h-3 w-3 text-[var(--fulfillment-gold)]"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-[10px] font-medium text-[var(--foreground)]">
                              {prov.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        {rate && (
                          <p className="mt-1 text-xs font-semibold text-[var(--primary)]">
                            {rate}
                          </p>
                        )}
                        {topSkills.length > 0 && (
                          <div className="mt-2 flex flex-wrap justify-center gap-1">
                            {topSkills.map((s, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--primary)]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ──────────────────────────────────── */}
        <div className="hidden lg:block space-y-6">
          {/* Verification status */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              {t("employerDashboard.verificationStatus", "Verification Status")}
            </h3>
            <div className="space-y-2.5">
              {[
                {
                  label: t("employerDashboard.email", "Email"),
                  ok: verified.email,
                  required: true,
                },
                {
                  label: t("employerDashboard.phone", "Phone"),
                  ok: verified.phone,
                  required: true,
                },
                {
                  label: t("employerDashboard.address", "Address"),
                  ok: verified.address,
                  required: false,
                },
              ].map((v) => (
                <div
                  key={v.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-[var(--muted-text)]">
                    {v.label}
                  </span>
                  {v.ok ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--achievement-green)]">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("employerDashboard.verified", "Verified")}
                    </span>
                  ) : v.required ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--alert-red)]">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("employerDashboard.required", "Required")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted-text)]">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {t("employerDashboard.optional", "Optional")}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {canPostJobs && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--achievement-green)]/10 px-3 py-2">
                <svg
                  className="h-4 w-4 text-[var(--achievement-green)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs font-medium text-[var(--achievement-green)]">
                  {t("employerDashboard.readyToPostJobs", "Ready to post jobs")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
