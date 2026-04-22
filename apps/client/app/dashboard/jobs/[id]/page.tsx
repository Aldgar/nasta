"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../lib/api";
import BrandedSelect from "../../../../components/ui/BrandedSelect";
import { useLanguage } from "../../../../context/LanguageContext";
import Avatar from "../../../../components/Avatar";

interface Category {
  id: string;
  name: string;
}

interface Employer {
  id: string;
  firstName: string;
  lastName: string;
  city?: string;
  country?: string;
  avatar?: string;
  location?: string;
  isVerified?: boolean;
  company?: { name: string } | null;
}

interface NegotiationRate {
  rate: number;
  paymentType: string;
  otherSpecification?: string;
}
interface CounterOffer {
  id?: string;
  rates?: NegotiationRate[];
  totalAmount?: number;
  status?: string;
  message?: string;
  suggestedAt?: string;
  respondedAt?: string;
  responseMessage?: string;
}
interface NegotiationRequest {
  id?: string;
  status?: string;
  message?: string;
  responseMessage?: string;
  rates?: NegotiationRate[];
  totalAmount?: number;
  suggestedByRole?: string;
  suggestedAt?: string;
  respondedAt?: string;
  counterOffer?: CounterOffer;
}

interface FullApplication {
  id: string;
  status: string;
  appliedAt: string;
  negotiationRequests?: NegotiationRequest[] | null;
  selectedRates?: unknown[] | null;
  paymentStatus?: { required?: boolean; completed?: boolean } | null;
}

interface Job {
  id: string;
  title: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  type?: string;
  workMode?: string;
  urgency?: string;
  status?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  paymentType?: string;
  rateAmount?: number;
  location?: string;
  country?: string;
  city?: string;
  isRemote?: boolean;
  isInstantBook?: boolean;
  startDate?: string;
  endDate?: string;
  duration?: string;
  maxApplicants?: number;
  createdAt?: string;
  category?: Category;
  employer?: Employer;
  applicantCount?: number;
  myApplication?: { id: string; status: string; appliedAt: string };
}

function formatLabel(val: string): string {
  return val
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function appStatusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return "Under Review";
  if (s === "REVIEWING") return "Under Review";
  return formatLabel(status);
}

function urgencyColor(u: string): string {
  const v = u.toUpperCase();
  if (v === "URGENT") return "bg-red-500/15 text-red-400";
  if (v === "HIGH") return "bg-amber-500/15 text-amber-400";
  if (v === "NORMAL")
    return "bg-[var(--muted-text)]/10 text-[var(--muted-text)]";
  return "bg-[var(--muted-text)]/10 text-[var(--muted-text)]";
}

function statusColor(s: string): string {
  const v = s.toUpperCase();
  if (v === "ACTIVE" || v === "OPEN")
    return "bg-emerald-500/15 text-emerald-400";
  if (v === "COMPLETED")
    return "bg-[var(--soft-blue)]/15 text-[var(--soft-blue)]";
  if (v === "CLOSED" || v === "CANCELLED") return "bg-red-500/15 text-red-400";
  if (v === "DRAFT")
    return "bg-[var(--muted-text)]/10 text-[var(--muted-text)]";
  return "bg-[var(--muted-text)]/10 text-[var(--muted-text)]";
}

function timeAgo(
  iso?: string,
  t?: (...args: unknown[]) => string,
  locale = "en-IE",
): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)
    return t
      ? (t("jobs.minutesAgo", `${mins}m ago`, { count: mins }) as string)
      : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)
    return t
      ? (t("jobs.hoursAgo", `${hrs}h ago`, { count: hrs }) as string)
      : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)
    return t
      ? (t("jobs.daysAgo", `${days}d ago`, { count: days }) as string)
      : `${days}d ago`;
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function JobDetailPage() {
  const { t, language } = useLanguage();
  const locale = language === "pt" ? "pt-PT" : "en-IE";
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [negoRates, setNegoRates] = useState<
    { rate: string; paymentType: string }[]
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [negoMessage, setNegoMessage] = useState("");
  const [submittingNego, setSubmittingNego] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fullApp, setFullApp] = useState<FullApplication | null>(null);

  const fetchFullApp = useCallback(async (appId: string) => {
    const res = await api<FullApplication>(`/applications/${appId}`);
    if (res.data) setFullApp(res.data);
  }, []);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    const res = await api<Job>(`/jobs/${jobId}`);
    if (res.data) {
      setJob(res.data);
      if (res.data.myApplication) {
        setApplied(true);
        fetchFullApp(res.data.myApplication.id);
      }
    }
    setLoading(false);
  }, [jobId, fetchFullApp]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleApply = async () => {
    if (!jobId) return;
    setApplying(true);
    const res = await api(`/jobs/${jobId}/apply`, {
      method: "POST",
      body: { coverLetter: coverLetter.trim() || undefined },
    });
    if (res.error) {
      setToast({
        msg: typeof res.error === "string" ? res.error : "Failed to apply",
        ok: false,
      });
    } else {
      setApplied(true);
      setShowApplyForm(false);
      setToast({ msg: "Application submitted successfully!", ok: true });
    }
    setApplying(false);
  };

  const handleNegotiation = async () => {
    const appId = job?.myApplication?.id;
    if (!appId) return;
    const validRates = negoRates.filter(
      (r) => r.rate && parseFloat(r.rate) > 0,
    );
    if (validRates.length === 0 || !negoMessage.trim()) {
      setToast({
        msg: "Please enter at least one rate and a message",
        ok: false,
      });
      return;
    }
    setSubmittingNego(true);
    const rates = validRates.map((r) => ({
      rate: parseFloat(r.rate),
      paymentType: r.paymentType,
    }));
    const totalAmount = rates.reduce((sum, r) => sum + r.rate, 0);
    const res = await api(`/applications/${appId}/negotiation/request`, {
      method: "POST",
      body: { rates, totalAmount, message: negoMessage.trim() },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to submit negotiation",
        ok: false,
      });
    } else {
      setToast({ msg: "Negotiation request submitted!", ok: true });
      setShowNegotiation(false);
      setNegoRates([{ rate: "", paymentType: "HOURLY" }]);
      setNegoMessage("");
      if (job?.myApplication?.id) fetchFullApp(job.myApplication.id);
    }
    setSubmittingNego(false);
  };

  const handleRespondToCounterOffer = async (
    requestId: string,
    counterOfferId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    const appId = job?.myApplication?.id;
    if (!appId) return;
    const res = await api(
      `/applications/${appId}/negotiation/counter-offer/respond-service-provider`,
      {
        method: "POST",
        body: { requestId, counterOfferId, status },
      },
    );
    if (res.error) {
      setToast({
        msg: typeof res.error === "string" ? res.error : "Failed to respond",
        ok: false,
      });
    } else {
      setToast({
        msg:
          status === "ACCEPTED"
            ? "Counter offer accepted!"
            : "Counter offer rejected",
        ok: true,
      });
      fetchFullApp(appId);
    }
  };

  const negoList = fullApp?.negotiationRequests ?? [];

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-alt)]" />
        <div className="h-72 animate-pulse rounded-2xl bg-[var(--surface)]" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />
            <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]" />
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-[var(--muted-text)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
            {t("jobs.jobNotFound", "Job not found")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-text)]">
            {t(
              "jobs.jobNotFoundDescription",
              "This job may have been removed or is no longer available.",
            )}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--soft-blue)]"
          >
            {t("jobs.backToFeed", "Back to Feed")}
          </Link>
        </div>
      </div>
    );
  }

  const categoryName = job.category?.name || "";
  const employer = job.employer;
  const employerName = employer
    ? `${employer.firstName} ${employer.lastName}`
    : "Employer";
  const employerCompany = employer?.company?.name || "";
  const employerLocation = [employer?.city, employer?.country]
    .filter(Boolean)
    .join(", ");
  const employerAvatar = resolveAvatarUrl(employer?.avatar);
  const employerInitials = employer
    ? `${employer.firstName[0]}${employer.lastName[0]}`.toUpperCase()
    : "E";
  const jobLocation =
    [job.location, job.city, job.country].filter(Boolean).join(", ") ||
    "Remote";
  const isInstant = job.isInstantBook;
  const typeLabel = job.type
    ? t(`jobs.typeOptions.${job.type.toLowerCase()}`, formatLabel(job.type))
    : "";
  const modeLabel = job.workMode
    ? t(
        `jobs.workModeOptions.${job.workMode.toLowerCase()}`,
        formatLabel(job.workMode),
      )
    : "";
  const rate = job.rateAmount;
  const unit = job.paymentType
    ? t(
        `jobs.paymentTypeOptions.${job.paymentType.toLowerCase()}`,
        formatLabel(job.paymentType),
      )
    : "";
  const perUnit = job.paymentType
    ? t(
        `jobs.perPaymentType.${job.paymentType.toLowerCase()}`,
        `per ${formatLabel(job.paymentType).toLowerCase()}`,
      )
    : "";
  const hasSalary =
    (job.salaryMin && job.salaryMin > 0) ||
    (job.salaryMax && job.salaryMax > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--primary)]"
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
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        {t("common.back", "Back")}
      </button>

      {/* ── Header card ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--foreground)] lg:text-2xl">
                {job.title}
              </h1>
              {isInstant && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-400">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                  </svg>
                  {t("jobs.instantBookAvailable", "Instant Book")}
                </span>
              )}
              {job.status && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor(job.status)}`}
                >
                  {t(
                    `jobs.status.${job.status.toLowerCase()}`,
                    formatLabel(job.status),
                  )}
                </span>
              )}
            </div>

            {(employerCompany || employerName) && (
              <p className="mt-2 text-sm text-[var(--muted-text)]">
                {employerCompany || employerName}
              </p>
            )}

            {categoryName && (
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {categoryName}
              </p>
            )}
          </div>

          {/* Rate display */}
          {(rate || hasSalary) && (
            <div className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-3 text-center">
              {rate ? (
                <>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    €{rate}
                  </p>
                  {unit && (
                    <p className="mt-0.5 text-xs font-medium text-[var(--muted-text)]">
                      {perUnit}
                    </p>
                  )}
                </>
              ) : hasSalary ? (
                <>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    €{job.salaryMin?.toLocaleString()}
                    {job.salaryMax
                      ? ` - €${job.salaryMax.toLocaleString()}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[var(--muted-text)]">
                    {job.currency || "EUR"}
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-[var(--muted-text)]">
          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4"
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
            {jobLocation}
          </div>
          {typeLabel && (
            <div className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4"
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
              {typeLabel}
            </div>
          )}
          {modeLabel && (
            <div className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
              {modeLabel}
            </div>
          )}
          {job.urgency && job.urgency !== "NORMAL" && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${urgencyColor(job.urgency)}`}
            >
              {t(
                `jobs.urgencyOptions.${job.urgency.toLowerCase()}`,
                formatLabel(job.urgency),
              )}
            </span>
          )}
          {job.createdAt && (
            <span className="text-[var(--muted-text)]">
              {t("jobs.posted", "Posted")} {timeAgo(job.createdAt, t, locale)}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {typeLabel && (
            <span className="inline-flex items-center rounded-lg bg-[var(--fulfillment-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--fulfillment-gold)]">
              {typeLabel}
            </span>
          )}
          {modeLabel && (
            <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              {modeLabel}
            </span>
          )}
          {categoryName && (
            <span className="inline-flex items-center rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-400">
              {categoryName}
            </span>
          )}
          {job.isRemote && (
            <span className="inline-flex items-center rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400">
              {t("jobs.workModeOptions.remote", "Remote")}
            </span>
          )}
        </div>
      </div>

      {/* ── Content grid ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: details */}
        <div className="space-y-6 min-w-0">
          {job.description && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.description", "Description")}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted-text)]">
                {job.description}
              </p>
            </section>
          )}

          {job.requirements && job.requirements.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.requirements", "Requirements")}
              </h2>
              <ul className="space-y-2">
                {job.requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-[var(--muted-text)]"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
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
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {job.responsibilities && job.responsibilities.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.responsibilities", "Responsibilities")}
              </h2>
              <ul className="space-y-2">
                {job.responsibilities.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-[var(--muted-text)]"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fulfillment-gold)]"
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
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(job.startDate || job.endDate || job.duration) && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.schedule", "Schedule")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {job.startDate && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                      {t("jobs.startDate", "Start Date")}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                      {new Date(job.startDate).toLocaleDateString(locale, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {job.endDate && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                      {t("jobs.endDate", "End Date")}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                      {new Date(job.endDate).toLocaleDateString(locale, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {job.duration && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                      {t("jobs.duration", "Duration")}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                      {job.duration}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Employer card - now in left column */}
          {employer && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.aboutTheEmployer", "About the Employer")}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)]/15">
                  <Avatar
                    src={employerAvatar}
                    imgClassName="h-full w-full object-cover"
                    fallback={
                      <span className="text-sm font-bold text-[var(--primary)]">
                        {employerInitials}
                      </span>
                    }
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {employerName}
                    </p>
                    {employer.isVerified && (
                      <svg
                        className="h-4 w-4 shrink-0 text-[var(--primary)]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {employerCompany && (
                    <p className="text-xs text-[var(--muted-text)]">
                      {employerCompany}
                    </p>
                  )}
                  {employerLocation && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-text)]">
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
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        />
                      </svg>
                      {employerLocation}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Job Summary - now in left column */}
          <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
              {t("jobs.jobSummary", "Job Summary")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {typeLabel && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.jobType", "Job Type")}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {typeLabel}
                  </span>
                </div>
              )}
              {modeLabel && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.workMode", "Work Mode")}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {modeLabel}
                  </span>
                </div>
              )}
              {categoryName && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.categoryLabel", "Category")}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {categoryName}
                  </span>
                </div>
              )}
              {job.urgency && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.urgencyLabel", "Urgency")}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyColor(job.urgency)}`}
                  >
                    {t(
                      `jobs.urgencyOptions.${job.urgency.toLowerCase()}`,
                      formatLabel(job.urgency),
                    )}
                  </span>
                </div>
              )}
              {rate && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.rate", "Rate")}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    €{rate}
                    {perUnit ? ` / ${perUnit}` : ""}
                  </span>
                </div>
              )}
              {job.createdAt && (
                <div className="flex items-center justify-between rounded-lg bg-[var(--surface-alt)] px-4 py-3 text-sm">
                  <span className="text-[var(--muted-text)]">
                    {t("jobs.posted", "Posted")}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {timeAgo(job.createdAt, t, locale)}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Apply / Applied card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
            {applied ? (
              <div>
                <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg
                      className="h-5 w-5 text-emerald-400"
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
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">
                      {t("jobs.applied", "Applied")}
                    </p>
                    {job.myApplication?.appliedAt && (
                      <p className="mt-0.5 text-xs text-emerald-400/70">
                        {new Date(
                          job.myApplication.appliedAt,
                        ).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(
                          job.myApplication.appliedAt,
                        ).toLocaleTimeString(locale, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {job.myApplication?.status && (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--muted-text)]">
                      {t("common.status", "Status")}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        job.myApplication.status === "ACCEPTED"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : job.myApplication.status === "REJECTED"
                            ? "bg-red-500/15 text-red-400"
                            : job.myApplication.status === "SHORTLISTED"
                              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                              : "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"
                      }`}
                    >
                      {appStatusLabel(job.myApplication.status)}
                    </span>
                  </div>
                )}
                {/* Negotiation status summary */}
                {negoList.length > 0 &&
                  (() => {
                    const accepted = negoList.filter(
                      (n) => n.status === "ACCEPTED",
                    ).length;
                    const pending = negoList.filter(
                      (n) => n.status === "PENDING",
                    ).length;
                    const counterOffered = negoList.filter(
                      (n) => n.status === "COUNTER_OFFERED",
                    ).length;
                    return (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--muted-text)]">
                          {t("jobs.negotiation", "Negotiation")}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            accepted > 0
                              ? "bg-emerald-500/15 text-emerald-400"
                              : counterOffered > 0
                                ? "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"
                                : pending > 0
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {accepted > 0
                            ? t("jobs.negotiationAccepted", "Accepted")
                            : counterOffered > 0
                              ? t(
                                  "jobs.negotiationCounterOffered",
                                  "Counter Offered",
                                )
                              : pending > 0
                                ? t("jobs.negotiationPending", "Pending")
                                : t("jobs.negotiationRejected", "Rejected")}
                        </span>
                      </div>
                    );
                  })()}
                <Link
                  href={`/dashboard/applications/${job.myApplication?.id || ""}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  {t("jobs.trackApplication", "Track Application")}
                </Link>
              </div>
            ) : showApplyForm ? (
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {t("jobs.applyForThisJob", "Apply for this job")}
                </h3>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder={t(
                    "jobs.coverLetterPlaceholder",
                    "Write a short cover letter (optional)...",
                  )}
                  rows={5}
                  className="mt-3 w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--soft-blue)] disabled:opacity-50"
                  >
                    {applying
                      ? t("jobs.submitting", "Submitting...")
                      : t("jobs.submitApplication", "Submit Application")}
                  </button>
                  <button
                    onClick={() => setShowApplyForm(false)}
                    className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)]"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowApplyForm(true)}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)] hover:shadow-lg hover:shadow-[var(--primary)]/20"
                >
                  {isInstant
                    ? t("jobs.applyInstantly", "Apply Instantly")
                    : t("jobs.applyNow", "Apply Now")}
                </button>
                {isInstant && (
                  <p className="mt-2 text-center text-[10px] text-cyan-400">
                    {t(
                      "jobs.instantBookingAvailable",
                      "Instant booking available",
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Request Negotiation card */}
          {applied && job.myApplication && (
            <div className="rounded-2xl border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5 p-5">
              {showNegotiation ? (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {t("jobs.requestNegotiation", "Request Negotiation")}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    {t(
                      "jobs.proposeRate",
                      "Propose a different rate and explain why",
                    )}
                  </p>

                  {negoRates.map((r, i) => (
                    <div key={i} className="mt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-text)]">
                          €
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.rate}
                          onChange={(e) =>
                            setNegoRates((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, rate: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] py-2 pl-8 pr-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                        />
                      </div>
                      <BrandedSelect
                        value={r.paymentType}
                        onChange={(v) =>
                          setNegoRates((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, paymentType: v } : x,
                            ),
                          )
                        }
                        options={[
                          { value: "HOURLY", label: "Hourly" },
                          { value: "DAILY", label: "Daily" },
                          { value: "WEEKLY", label: "Weekly" },
                          { value: "MONTHLY", label: "Monthly" },
                          { value: "FIXED", label: "Fixed" },
                        ]}
                        size="sm"
                      />
                      {negoRates.length > 1 && (
                        <button
                          onClick={() =>
                            setNegoRates((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="text-[var(--muted-text)] hover:text-red-400"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      setNegoRates((prev) => [
                        ...prev,
                        { rate: "", paymentType: "HOURLY" },
                      ])
                    }
                    className="mt-2 text-xs font-medium text-[var(--primary)] hover:text-[var(--soft-blue)]"
                  >
                    + {t("jobs.addRate", "Add rate")}
                  </button>

                  <textarea
                    value={negoMessage}
                    onChange={(e) => setNegoMessage(e.target.value)}
                    placeholder={t(
                      "jobs.explainProposedRate",
                      "Explain your proposed rate...",
                    )}
                    rows={3}
                    className="mt-3 w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleNegotiation}
                      disabled={submittingNego}
                      className="flex-1 rounded-xl bg-[var(--fulfillment-gold)] py-2.5 text-sm font-semibold text-[var(--background)] transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      {submittingNego
                        ? t("jobs.submitting", "Submitting...")
                        : t("jobs.submitRequest", "Submit Request")}
                    </button>
                    <button
                      onClick={() => setShowNegotiation(false)}
                      className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNegotiation(true)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fulfillment-gold)]/20">
                    <span className="text-base font-bold text-[var(--fulfillment-gold)]">
                      €
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--fulfillment-gold)]">
                      {t("jobs.requestNegotiation", "Request negotiation")}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                      {t(
                        "jobs.proposeRate",
                        "Propose a different rate and explain why",
                      )}
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Negotiation History */}
          {negoList.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("jobs.negotiationHistory", "Negotiation History")}
              </h3>
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                {t(
                  "jobs.allNegotiationRequests",
                  "All negotiation requests for this application",
                )}
              </p>
              <div className="space-y-3">
                {negoList.map((nr, i) => {
                  const isAccepted = nr.status === "ACCEPTED";
                  const isRejected = nr.status === "REJECTED";
                  const hasCounterOffer =
                    nr.status === "COUNTER_OFFERED" && nr.counterOffer;
                  const isPending = nr.status === "PENDING";
                  const isFromMe = nr.suggestedByRole === "JOB_SEEKER";

                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 ${
                        isAccepted
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : isRejected
                            ? "border-red-500/30 bg-red-500/5"
                            : hasCounterOffer
                              ? "border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5"
                              : "border-[var(--border-color)] bg-[var(--surface-alt)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          {isFromMe
                            ? t("jobs.yourRequest", "Your request")
                            : t(
                                "jobs.employerSuggestion",
                                "Employer suggestion",
                              )}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isAccepted
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isRejected
                                ? "bg-red-500/15 text-red-400"
                                : hasCounterOffer
                                  ? "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]"
                                  : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {isAccepted
                            ? t("jobs.negotiationAccepted", "Accepted")
                            : isRejected
                              ? t("jobs.negotiationRejected", "Rejected")
                              : hasCounterOffer
                                ? t("jobs.counterOffer", "Counter Offer")
                                : t("jobs.negotiationPending", "Pending")}
                        </span>
                      </div>

                      {/* Rates */}
                      {nr.rates && nr.rates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {nr.rates.map((r, j) => (
                            <span
                              key={j}
                              className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                            >
                              €{r.rate} /{" "}
                              {t(
                                `jobs.perPaymentType.${r.paymentType.toLowerCase()}`,
                                formatLabel(r.paymentType).toLowerCase(),
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Total */}
                      {typeof nr.totalAmount === "number" && (
                        <p className="mt-1.5 text-xs font-semibold text-[var(--foreground)]">
                          Total: €{nr.totalAmount.toFixed(2)}
                        </p>
                      )}

                      {/* Message */}
                      {nr.message && (
                        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-[var(--muted-text)]">
                            {isFromMe
                              ? t("jobs.yourExplanation", "Your explanation")
                              : t("jobs.employerMessage", "Employer message")}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
                            {nr.message}
                          </p>
                        </div>
                      )}

                      {/* Employer response message (not counter offer) */}
                      {nr.responseMessage && !hasCounterOffer && (
                        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-[var(--muted-text)]">
                            {t("jobs.employerResponse", "Employer response")}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
                            {nr.responseMessage}
                          </p>
                        </div>
                      )}

                      {/* Counter Offer details */}
                      {hasCounterOffer && nr.counterOffer && (
                        <div className="mt-3 rounded-lg border-l-2 border-[var(--fulfillment-gold)] bg-[var(--fulfillment-gold)]/5 px-3 py-2.5">
                          <p className="text-[10px] font-bold text-[var(--fulfillment-gold)]">
                            {t(
                              "jobs.employerCounterOffer",
                              "Employer Counter Offer",
                            )}
                          </p>
                          {nr.counterOffer.rates &&
                            nr.counterOffer.rates.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {nr.counterOffer.rates.map((r, j) => (
                                  <span
                                    key={j}
                                    className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                                  >
                                    €{r.rate} /{" "}
                                    {t(
                                      `jobs.perPaymentType.${r.paymentType.toLowerCase()}`,
                                      formatLabel(r.paymentType).toLowerCase(),
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          {typeof nr.counterOffer.totalAmount === "number" && (
                            <p className="mt-1.5 text-xs font-semibold text-[var(--foreground)]">
                              Total: €{nr.counterOffer.totalAmount.toFixed(2)}
                            </p>
                          )}
                          {nr.counterOffer.message && (
                            <p className="mt-1.5 text-xs text-[var(--foreground)]/80">
                              {nr.counterOffer.message}
                            </p>
                          )}

                          {/* Counter offer response actions */}
                          {nr.counterOffer.status === "PENDING" && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() =>
                                  handleRespondToCounterOffer(
                                    nr.id!,
                                    nr.counterOffer!.id!,
                                    "ACCEPTED",
                                  )
                                }
                                className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                              >
                                {t("common.accept", "Accept")}
                              </button>
                              <button
                                onClick={() =>
                                  handleRespondToCounterOffer(
                                    nr.id!,
                                    nr.counterOffer!.id!,
                                    "REJECTED",
                                  )
                                }
                                className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
                              >
                                {t("common.reject", "Reject")}
                              </button>
                            </div>
                          )}
                          {nr.counterOffer.status === "ACCEPTED" && (
                            <p className="mt-2 text-xs font-bold text-emerald-400">
                              {t(
                                "jobs.counterOfferAccepted",
                                "Counter offer accepted",
                              )}
                            </p>
                          )}
                          {nr.counterOffer.status === "REJECTED" && (
                            <p className="mt-2 text-xs font-bold text-red-400">
                              {t(
                                "jobs.counterOfferRejected",
                                "Counter offer rejected",
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Date */}
                      {nr.suggestedAt && (
                        <p className="mt-2 text-[10px] text-[var(--muted-text)]">
                          {new Date(nr.suggestedAt).toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Applicant count */}
          {(job.applicantCount ?? 0) > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--soft-blue)]/15">
                  <svg
                    className="h-5 w-5 text-[var(--soft-blue)]"
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
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">
                    {job.applicantCount}
                  </p>
                  <p className="text-xs text-[var(--muted-text)]">
                    {t("jobs.applicantsSoFar", "applicants so far")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-xl ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
