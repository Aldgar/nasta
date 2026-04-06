"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { api, resolveAvatarUrl } from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";
import Avatar from "../../components/Avatar";

interface JobListing {
  id: string;
  title: string;
  description?: string;
  company?: string | { id: string; name: string };
  employerName?: string;
  location?: string;
  city?: string;
  country?: string;
  category?: string | { id: string; name: string };
  type?: string;
  workMode?: string;
  urgency?: string;
  payRate?: number;
  payUnit?: string;
  paymentType?: string;
  rateAmount?: number;
  currency?: string;
  salaryMin?: number;
  salaryMax?: number;
  startDate?: string;
  isInstantBook?: boolean;
  instantBook?: boolean;
  applicantCount?: number;
  employer?: {
    id: string;
    firstName: string;
    lastName: string;
    city?: string;
    country?: string;
    isVerified?: boolean;
    company?: { name: string } | null;
  };
}

interface MyApp {
  id: string;
  jobId: string;
  status: string;
  appliedAt?: string;
}

interface Application {
  id: string;
  jobTitle?: string;
  jobId?: string;
  job?: { id: string; title?: string };
  status: string;
  createdAt?: string;
  appliedAt?: string;
}

interface BalanceData {
  available?: number;
  pending?: number;
  currency?: string;
}

interface EarningsDashboard {
  pendingHolds: number;
  capturedTotal: number;
  estimatedNet: number;
}

interface UpcomingBooking {
  id: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  agreedRateAmount?: number;
  agreedPayUnit?: string;
  agreedCurrency?: string;
  bookedAt?: string;
  completedAt?: string;
  applicationId?: string;
  job?: {
    id: string;
    title?: string;
    location?: string;
    city?: string;
    country?: string;
    type?: string;
    workMode?: string;
    startDate?: string;
    rateAmount?: number;
    currency?: string;
    paymentType?: string;
    category?: { id: string; name: string };
  };
  employer?: {
    id: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    city?: string;
    country?: string;
  };
}

interface UserSkill {
  skill: { id: string; name: string };
  yearsExp?: number;
  proficiency?: string;
}

/* ── Countdown Timer ─────────────────────────────────────────── */
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
      });
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!timeLeft) return null;
  const urgent = timeLeft.days === 0 && timeLeft.hours < 24;
  const past =
    timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0;

  if (past) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{" "}
        {t("dashboard.startingNow", "Starting now")}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl px-4 py-2.5 ${urgent ? "bg-[var(--alert-red)]/10" : "bg-[var(--fulfillment-gold)]/10"}`}
    >
      <svg
        className={`h-4 w-4 ${urgent ? "text-[var(--alert-red)]" : "text-[var(--fulfillment-gold)]"}`}
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
      <div className="flex items-baseline gap-1">
        {timeLeft.days > 0 && (
          <>
            <span
              className={`text-lg font-bold ${urgent ? "text-[var(--alert-red)]" : "text-[var(--fulfillment-gold)]"}`}
            >
              {timeLeft.days}
            </span>
            <span
              className={`text-xs font-medium ${urgent ? "text-[var(--alert-red)]/70" : "text-[var(--fulfillment-gold)]/70"}`}
            >
              d
            </span>
          </>
        )}
        <span
          className={`text-lg font-bold ${urgent ? "text-[var(--alert-red)]" : "text-[var(--fulfillment-gold)]"}`}
        >
          {timeLeft.hours}
        </span>
        <span
          className={`text-xs font-medium ${urgent ? "text-[var(--alert-red)]/70" : "text-[var(--fulfillment-gold)]/70"}`}
        >
          h
        </span>
        <span
          className={`text-lg font-bold ${urgent ? "text-[var(--alert-red)]" : "text-[var(--fulfillment-gold)]"}`}
        >
          {timeLeft.minutes}
        </span>
        <span
          className={`text-xs font-medium ${urgent ? "text-[var(--alert-red)]/70" : "text-[var(--fulfillment-gold)]/70"}`}
        >
          {t("dashboard.minutesLeft", "m left")}
        </span>
      </div>
    </div>
  );
}

export default function ServiceProviderFeed() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [recentJobs, setRecentJobs] = useState<JobListing[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [appliedJobMap, setAppliedJobMap] = useState<Map<string, MyApp>>(
    new Map(),
  );
  const [balance, setBalance] = useState<BalanceData>({
    available: 0,
    pending: 0,
    currency: "EUR",
  });
  const [upcoming, setUpcoming] = useState<UpcomingBooking | null>(null);
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const fetchData = useCallback(async () => {
    const [jobsRes, appsRes, earningsRes, bookingRes, profileRes] =
      await Promise.all([
        api<JobListing[]>("/jobs?limit=8"),
        api<Application[]>("/applications/me?limit=50"),
        api<EarningsDashboard>("/payments/dashboard/job-seeker"),
        api<UpcomingBooking[]>("/bookings/seeker/me?limit=10"),
        api<{ user?: { skills?: UserSkill[] } }>("/profiles/me"),
      ]);
    if (jobsRes.data)
      setRecentJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
    if (appsRes.data && Array.isArray(appsRes.data)) {
      setMyApplications(appsRes.data);
      const map = new Map<string, MyApp>();
      for (const a of appsRes.data) {
        const jid = a.jobId || a.job?.id;
        if (jid)
          map.set(jid, {
            id: a.id,
            jobId: jid,
            status: a.status,
            appliedAt: a.appliedAt || a.createdAt,
          });
      }
      setAppliedJobMap(map);
    }
    if (earningsRes.data && typeof earningsRes.data === "object") {
      const e = earningsRes.data as EarningsDashboard;
      setBalance({
        available: (e.estimatedNet ?? 0) / 100,
        pending: (e.pendingHolds ?? 0) / 100,
        currency: "EUR",
      });
    }
    if (
      bookingRes.data &&
      Array.isArray(bookingRes.data) &&
      bookingRes.data.length > 0
    ) {
      // Find first active (non-completed, non-cancelled) booking as upcoming
      const activeBooking = bookingRes.data.find(
        (b) => b.status && !["COMPLETED", "CANCELLED"].includes(b.status),
      );
      setUpcoming(activeBooking || null);
    }
    if (profileRes.data?.user?.skills) {
      setSkills(profileRes.data.user.skills);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const quickApply = async (jobId: string) => {
    setApplyingId(jobId);
    const res = await api(`/jobs/${jobId}/apply`, { method: "POST", body: {} });
    if (!res.error) {
      setAppliedJobMap((prev) => {
        const next = new Map(prev);
        next.set(jobId, {
          id: "",
          jobId,
          status: "PENDING",
          appliedAt: new Date().toISOString(),
        });
        return next;
      });
    }
    setApplyingId(null);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.goodMorning", "Good morning");
    if (h < 18) return t("dashboard.goodAfternoon", "Good afternoon");
    return t("dashboard.goodEvening", "Good evening");
  })();

  const kycVerified =
    user?.kycStatus === "VERIFIED" || user?.kycStatus === "APPROVED";
  const kycPending =
    user?.kycStatus === "PENDING" || user?.kycStatus === "IN_REVIEW";

  const statusColors = kycVerified
    ? "bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]"
    : kycPending
      ? "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"
      : "bg-[var(--muted-text)]/15 text-[var(--muted-text)]";

  const statusLabel = kycVerified
    ? t("profile.verified", "Verified")
    : user?.kycStatus
      ? user.kycStatus.replace(/_/g, " ").toLowerCase()
      : t("dashboard.standby", "Standby");

  const appStatusColors: Record<string, string> = {
    PENDING: "text-[var(--fulfillment-gold)] bg-[var(--fulfillment-gold)]/15",
    REVIEWING: "text-[var(--soft-blue)] bg-[var(--soft-blue)]/15",
    SHORTLISTED: "text-[var(--primary)] bg-[var(--primary)]/15",
    ACCEPTED:
      "text-[var(--achievement-green)] bg-[var(--achievement-green)]/15",
    REJECTED: "text-[var(--alert-red)] bg-[var(--alert-red)]/15",
  };

  const appStatusIcons: Record<string, string> = {
    PENDING: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    REVIEWING:
      "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    SHORTLISTED:
      "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
    ACCEPTED: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    REJECTED:
      "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const proficiencyColors: Record<string, string> = {
    BEGINNER: "bg-[var(--soft-blue)]/15 text-[var(--soft-blue)]",
    INTERMEDIATE:
      "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]",
    ADVANCED: "bg-[var(--primary)]/15 text-[var(--primary)]",
    EXPERT: "bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header + greeting ────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
            {t("dashboard.missionControl", "Mission Control")}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {greeting}, {user?.displayName || user?.firstName || "there"} 👋
          </h1>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusColors}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${kycVerified ? "bg-[var(--achievement-green)]" : kycPending ? "bg-[var(--fulfillment-gold)]" : "bg-[var(--muted-text)]"}`}
          />
          {statusLabel}
        </div>
      </div>

      {/* ── Upcoming Scheduled Job (PROMINENT CENTER) ────────── */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />
      ) : upcoming ? (
        (() => {
          const jobTitle =
            upcoming.job?.title || t("dashboard.scheduledJob", "Scheduled Job");
          const employerName = upcoming.employer
            ? `${upcoming.employer.firstName ?? ""} ${upcoming.employer.lastName ?? ""}`.trim()
            : t("common.employer", "Employer");
          const jobCity = upcoming.job?.city || upcoming.employer?.city;
          const jobCountry =
            upcoming.job?.country || upcoming.employer?.country;
          const locationStr = [jobCity, jobCountry].filter(Boolean).join(", ");
          const categoryName =
            typeof upcoming.job?.category === "object"
              ? upcoming.job.category?.name
              : undefined;
          const jobType = upcoming.job?.type?.replace(/_/g, " ");
          const workMode = upcoming.job?.workMode?.replace(/_/g, " ");
          const startTime = upcoming.startTime || upcoming.job?.startDate;
          const endTime = upcoming.endTime;
          const rate =
            upcoming.agreedRateAmount != null
              ? (upcoming.agreedRateAmount / 100).toFixed(2)
              : upcoming.job?.rateAmount != null
                ? (upcoming.job.rateAmount / 100).toFixed(2)
                : null;
          const currency =
            upcoming.agreedCurrency || upcoming.job?.currency || "EUR";
          const payUnit =
            upcoming.agreedPayUnit || upcoming.job?.paymentType || "";
          const isCompleted = upcoming.status === "COMPLETED";
          const isInProgress = upcoming.status === "IN_PROGRESS";
          const isFuture = startTime ? new Date(startTime) > new Date() : false;
          const linkHref = upcoming.applicationId
            ? `/dashboard/applications/${upcoming.applicationId}`
            : "/dashboard/schedule";

          const statusConfig: Record<
            string,
            { bg: string; text: string; dot: string }
          > = {
            PENDING: {
              bg: "bg-[var(--fulfillment-gold)]/15",
              text: "text-[var(--fulfillment-gold)]",
              dot: "bg-[var(--fulfillment-gold)]",
            },
            CONFIRMED: {
              bg: "bg-[var(--soft-blue)]/15",
              text: "text-[var(--soft-blue)]",
              dot: "bg-[var(--soft-blue)]",
            },
            IN_PROGRESS: {
              bg: "bg-[var(--primary)]/15",
              text: "text-[var(--primary)]",
              dot: "bg-[var(--primary)]",
            },
            COMPLETED: {
              bg: "bg-[var(--achievement-green)]/15",
              text: "text-[var(--achievement-green)]",
              dot: "bg-[var(--achievement-green)]",
            },
            CANCELLED: {
              bg: "bg-[var(--alert-red)]/15",
              text: "text-[var(--alert-red)]",
              dot: "bg-[var(--alert-red)]",
            },
          };
          const sc =
            statusConfig[upcoming.status || ""] || statusConfig.PENDING;

          // Reminders based on state
          const reminders: { icon: string; text: string; color: string }[] = [];
          if (isFuture && !isCompleted) {
            reminders.push({
              icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
              text: t(
                "dashboard.reminderArriveOnTime",
                "Arrive on time — the employer will share a verification code",
              ),
              color: "var(--soft-blue)",
            });
            reminders.push({
              icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              text: t(
                "dashboard.reminderEnterCode",
                "Enter the code to confirm your arrival and start the job",
              ),
              color: "var(--achievement-green)",
            });
          }
          if (isInProgress) {
            reminders.push({
              icon: "M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5",
              text: t(
                "dashboard.reminderJobInProgress",
                "Job is in progress — mark as done when completed",
              ),
              color: "var(--primary)",
            });
          }

          return (
            <Link href={linkHref} className="group block">
              <div className="relative overflow-hidden rounded-2xl border border-[var(--primary)]/20 bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--primary)]/5 transition-all hover:border-[var(--primary)]/40 hover:shadow-xl hover:shadow-[var(--primary)]/10">
                {/* Background accents */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[var(--primary)]/5" />
                <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-[var(--primary)]/8" />
                <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-[var(--fulfillment-gold)]/5" />

                {/* Main content */}
                <div className="relative p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left: Job info */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Employer avatar or icon */}
                      <div className="relative shrink-0">
                        <Avatar
                          src={resolveAvatarUrl(upcoming.employer?.avatar)}
                          alt={employerName}
                          imgClassName="h-14 w-14 rounded-2xl object-cover ring-2 ring-[var(--primary)]/20"
                          fallback={
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-lg font-bold text-[var(--primary)]">
                              {(
                                upcoming.employer?.firstName?.[0] || "E"
                              ).toUpperCase()}
                            </div>
                          }
                        />
                        {(isFuture || isInProgress) && !isCompleted && (
                          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--surface)] bg-[var(--achievement-green)]">
                            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--achievement-green)]/60" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Status badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc.bg} ${sc.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${!isCompleted ? "animate-pulse" : ""}`}
                            />
                            {isInProgress
                              ? t("agenda.inProgress", "In Progress")
                              : isFuture
                                ? t("dashboard.upcoming", "Upcoming")
                                : upcoming.status?.replace(/_/g, " ") ||
                                  t("dashboard.booked", "Booked")}
                          </span>
                          {categoryName && (
                            <span className="rounded-full bg-[var(--fulfillment-gold)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--fulfillment-gold)]">
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
                        <h2 className="mt-2 text-xl font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">
                          {jobTitle}
                        </h2>

                        {/* Details row */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-text)]">
                          {/* Employer */}
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
                            {employerName}
                          </span>
                          {/* Location */}
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
                          {/* Rate */}
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
                          {/* Work mode */}
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

                        {/* Time details */}
                        {startTime && (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-alt,var(--border-color))]/30 px-3 py-1.5">
                              <svg
                                className="h-4 w-4 text-[var(--primary)]"
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
                              <span className="text-xs font-medium text-[var(--foreground)]">
                                {new Date(startTime).toLocaleDateString(
                                  undefined,
                                  {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-alt,var(--border-color))]/30 px-3 py-1.5">
                              <svg
                                className="h-4 w-4 text-[var(--primary)]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-xs font-medium text-[var(--foreground)]">
                                {new Date(startTime).toLocaleTimeString(
                                  undefined,
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                                {endTime &&
                                  ` — ${new Date(endTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Countdown + CTA */}
                    <div className="flex items-center gap-4 lg:flex-col lg:items-end lg:gap-3">
                      {startTime && isFuture && (
                        <CountdownTimer targetDate={startTime} />
                      )}
                      {isInProgress && (
                        <div className="flex items-center gap-2 rounded-xl bg-[var(--primary)]/15 px-4 py-2">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
                          <span className="text-sm font-semibold text-[var(--primary)]">
                            {t("dashboard.liveNow", "Live Now")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
                        {t("dashboard.openDetails", "Open details")}
                        <svg
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
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
                </div>

                {/* Reminders strip */}
                {reminders.length > 0 && (
                  <div className="border-t border-[var(--border-color)]/50 bg-[var(--surface-alt,var(--surface))]/50 px-6 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-1.5">
                      {reminders.map((r, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-2 text-xs text-[var(--muted-text)]"
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
                  </div>
                )}
              </div>
            </Link>
          );
        })()
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--surface)] p-6 text-center">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--primary)]/3" />
          <svg
            className="mx-auto h-10 w-10 text-[var(--muted-text)]/50"
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
          <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
            {t("agenda.noBookings", "No upcoming bookings")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-text)]">
            {t(
              "dashboard.setAvailabilityAndApply",
              "Set your availability and apply for jobs to get scheduled",
            )}
          </p>
          <Link
            href="/dashboard/schedule"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)]"
          >
            {t("dashboard.setAvailability", "Set Availability")}
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Left column: Feed ──────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Balance + Quick Actions row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <p className="text-xs font-medium text-[var(--muted-text)]">
                {t("home.yourAvailableBalance", "Available balance")}
              </p>
              <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">
                {loading ? (
                  <span className="inline-block h-9 w-28 animate-pulse rounded-lg bg-[var(--surface-alt)]" />
                ) : (
                  <>€{(balance.available ?? 0).toFixed(2)}</>
                )}
              </p>
              {!loading && (balance.pending ?? 0) > 0 && (
                <p className="mt-1 text-xs text-[var(--fulfillment-gold)]">
                  €{(balance.pending ?? 0).toFixed(2)}{" "}
                  {t("dashboard.pending", "pending")}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Link
                  href="/dashboard/jobs"
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  {t("jobs.title", "Jobs")}
                </Link>
                <Link
                  href="/dashboard/payments"
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all hover:border-[var(--achievement-green)]/40 hover:text-[var(--achievement-green)]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t("home.earnings", "Earnings")}
                </Link>
              </div>
            </div>

            {/* Availability card */}
            <Link
              href="/dashboard/schedule"
              className="group flex flex-col justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--primary)]/30 hover:shadow-md hover:shadow-[var(--primary)]/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]">
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
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {t("schedule.myAvailability", "My Availability")}
                  </p>
                  <p className="text-xs text-[var(--muted-text)]">
                    {t("dashboard.setYourSchedule", "Set your schedule")}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
                {t("dashboard.manageSchedule", "Manage schedule")}
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
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
            </Link>
          </div>

          {/* Job feed */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {t("home.availableJobs", "Available Jobs")}
              </h2>
              <Link
                href="/dashboard/jobs"
                className="text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
              >
                {t("common.viewMore", "View all")} →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-[var(--surface)]"
                  />
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
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
                  {t("jobs.noJobsFound", "No jobs available yet")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  {t(
                    "dashboard.newOpportunitiesWillAppear",
                    "New opportunities will appear here as they are posted.",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentJobs.map((job) => {
                  const categoryName =
                    typeof job.category === "object" && job.category !== null
                      ? job.category.name
                      : (job.category as string) || "";
                  const companyName =
                    typeof job.company === "object" && job.company !== null
                      ? job.company.name
                      : (job.company as string) || "";
                  const employerLabel = job.employer
                    ? `${job.employer.firstName} ${job.employer.lastName}`
                    : job.employerName ||
                      companyName ||
                      t("common.employer", "Employer");
                  const locationLabel =
                    [job.city, job.country].filter(Boolean).join(", ") ||
                    job.location ||
                    t("dashboard.remote", "Remote");
                  const isInstant = job.isInstantBook || job.instantBook;
                  const typeLabel = job.type ? job.type.replace(/_/g, " ") : "";
                  const modeLabel = job.workMode
                    ? job.workMode.replace(/_/g, " ")
                    : "";
                  const rate = job.rateAmount || job.payRate;
                  const unit = job.paymentType || job.payUnit || "HOUR";
                  const myApp = appliedJobMap.get(job.id);
                  const hasApplied = !!myApp;
                  const isApplying = applyingId === job.id;
                  const count = job.applicantCount ?? 0;

                  return (
                    <div
                      key={job.id}
                      className="group rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5"
                    >
                      <Link href={`/dashboard/jobs/${job.id}`}>
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="text-base font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                                {job.title}
                              </h3>
                              {isInstant && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-400">
                                  <svg
                                    className="h-3 w-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                                  </svg>
                                  {t("dashboard.instant", "Instant")}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-[var(--muted-text)]">
                              {employerLabel}
                            </p>
                          </div>
                          {rate ? (
                            <div className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-center">
                              <p className="text-lg font-bold text-[var(--primary)]">
                                €{rate}
                              </p>
                              <p className="text-[10px] font-medium text-[var(--muted-text)]">
                                /{unit.toLowerCase().replace("_", " ")}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        {/* Description */}
                        {job.description && (
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--muted-text)]">
                            {job.description}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--muted-text)]">
                          <div className="flex items-center gap-1.5">
                            <svg
                              className="h-4 w-4 shrink-0"
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
                            <span>{locationLabel}</span>
                          </div>
                          {count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="h-4 w-4 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                                />
                              </svg>
                              <span>
                                {count}{" "}
                                {count !== 1
                                  ? t("jobs.applicants", "applicants")
                                  : t("dashboard.applicant", "applicant")}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Tags row */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {typeLabel && (
                            <span className="inline-flex items-center rounded-lg bg-[var(--fulfillment-gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--fulfillment-gold)]">
                              {typeLabel.charAt(0) +
                                typeLabel.slice(1).toLowerCase()}
                            </span>
                          )}
                          {modeLabel && (
                            <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                              {modeLabel.charAt(0) +
                                modeLabel.slice(1).toLowerCase()}
                            </span>
                          )}
                          {categoryName && (
                            <span className="inline-flex items-center rounded-lg bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                              {categoryName}
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Action row */}
                      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-4">
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="text-sm font-medium text-[var(--primary)] hover:text-[var(--soft-blue)] transition-colors"
                        >
                          {t("jobs.jobDetails", "View Details")} →
                        </Link>
                        {hasApplied ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400">
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
                              {t("dashboard.applied", "Applied")}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              quickApply(job.id);
                            }}
                            disabled={isApplying}
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)] hover:shadow-lg hover:shadow-[var(--primary)]/20 disabled:opacity-50"
                          >
                            {isApplying ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
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
                                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                                />
                              </svg>
                            )}
                            {isInstant
                              ? t("dashboard.applyInstantly", "Apply Instantly")
                              : t("dashboard.quickApply", "Quick Apply")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column: Applications + Skills ────────────── */}
        <div className="hidden lg:block space-y-6">
          {/* Applications card — rich cards */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/15">
                  <svg
                    className="h-4 w-4 text-[var(--primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  {t("navigation.myApplications", "My Applications")}
                </h3>
              </div>
              <Link
                href="/dashboard/applications"
                className="text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
              >
                {t("common.viewMore", "View all")} →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-[var(--surface-alt)]"
                  />
                ))}
              </div>
            ) : myApplications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-alt)] p-6 text-center">
                <svg
                  className="mx-auto h-8 w-8 text-[var(--muted-text)]/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0V18m0-3v3"
                  />
                </svg>
                <p className="mt-2 text-xs font-medium text-[var(--foreground)]">
                  {t(
                    "manageApplications.noApplicationsYet",
                    "No applications yet",
                  )}
                </p>
                <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                  {t(
                    "dashboard.browseJobsAndApply",
                    "Browse jobs and apply to get started",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myApplications.slice(0, 6).map((app) => {
                  const color =
                    appStatusColors[app.status] ??
                    "text-[var(--muted-text)] bg-[var(--surface-alt)]";
                  const iconPaths =
                    appStatusIcons[app.status] ?? appStatusIcons.PENDING;
                  const displayStatus =
                    app.status === "PENDING" || app.status === "REVIEWING"
                      ? "UNDER REVIEW"
                      : app.status;
                  const borderAccent =
                    app.status === "ACCEPTED"
                      ? "border-l-[var(--achievement-green)]"
                      : app.status === "SHORTLISTED"
                        ? "border-l-[var(--primary)]"
                        : app.status === "REJECTED"
                          ? "border-l-[var(--alert-red)]"
                          : app.status === "REVIEWING"
                            ? "border-l-[var(--soft-blue)]"
                            : "border-l-[var(--fulfillment-gold)]";

                  return (
                    <Link
                      key={app.id}
                      href={`/dashboard/applications/${app.id}`}
                      className={`group/app block rounded-xl border border-[var(--border-color)] border-l-[3px] ${borderAccent} bg-[var(--surface-alt)] p-3.5 transition-all hover:border-[var(--primary)]/30 hover:shadow-md hover:shadow-[var(--primary)]/5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)] group-hover/app:text-[var(--primary)] transition-colors">
                            {app.jobTitle ||
                              app.job?.title ||
                              t("dashboard.jobApplication", "Job Application")}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                {iconPaths.split(" M").map((d, i) => (
                                  <path
                                    key={i}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d={i === 0 ? d : `M${d}`}
                                  />
                                ))}
                              </svg>
                              {displayStatus}
                            </span>
                          </div>
                        </div>
                        <svg
                          className="mt-1 h-4 w-4 shrink-0 text-[var(--muted-text)] opacity-0 transition-all group-hover/app:opacity-100 group-hover/app:translate-x-0.5 group-hover/app:text-[var(--primary)]"
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
                      {(app.appliedAt || app.createdAt) && (
                        <p className="mt-2 text-[10px] text-[var(--muted-text)]">
                          {t("dashboard.applied", "Applied")}{" "}
                          {new Date(
                            app.appliedAt || app.createdAt!,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </Link>
                  );
                })}
                {myApplications.length > 6 && (
                  <Link
                    href="/dashboard/applications"
                    className="block rounded-xl border border-dashed border-[var(--border-color)] p-3 text-center text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/5"
                  >
                    +{myApplications.length - 6}{" "}
                    {t("dashboard.moreApplications", "more applications")}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Professional Skills card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fulfillment-gold)]/15">
                  <svg
                    className="h-4 w-4 text-[var(--fulfillment-gold)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  {t("dashboard.professionalSkills", "Professional Skills")}
                </h3>
              </div>
              <Link
                href="/dashboard/settings"
                className="text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
              >
                {t("common.edit", "Edit")} →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded-lg bg-[var(--surface-alt)]"
                  />
                ))}
              </div>
            ) : skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-alt)] p-5 text-center">
                <svg
                  className="mx-auto h-8 w-8 text-[var(--fulfillment-gold)]/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                <p className="mt-2 text-xs font-medium text-[var(--foreground)]">
                  {t("dashboard.addYourSkills", "Add your skills")}
                </p>
                <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                  {t(
                    "dashboard.skillsHelpEmployers",
                    "Skills help employers find you for the right jobs",
                  )}
                </p>
                <Link
                  href="/dashboard/settings"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--fulfillment-gold)] px-4 py-1.5 text-xs font-semibold text-[var(--background)] transition-all hover:opacity-90"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
                  {t("dashboard.addSkills", "Add Skills")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => {
                    const profColor =
                      proficiencyColors[s.proficiency ?? "BEGINNER"] ??
                      proficiencyColors.BEGINNER;
                    return (
                      <div
                        key={s.skill.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${profColor}`}
                      >
                        {s.skill.name}
                        {s.yearsExp != null && s.yearsExp > 0 && (
                          <span className="opacity-60">· {s.yearsExp}y</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--muted-text)] transition-all hover:border-[var(--primary)]/30 hover:text-[var(--primary)]"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
                  {t(
                    "dashboard.addMoreSkills",
                    "Add more skills to improve hiring chances",
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
