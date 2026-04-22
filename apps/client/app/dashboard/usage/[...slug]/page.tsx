"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "../../../../context/LanguageContext";
import { useAuth } from "../../../../lib/auth";
import DashboardLegalContent from "../../legal/DashboardLegalContent";
import { getGuideDocument, GuideType } from "../../../../lib/guide-text";

interface SlugConfig {
  type: GuideType;
  titleKey: string;
  fallback: string;
}

// Slug arrives as string[] (catch-all). Joined with "/" gives e.g. "employer/post-job".
const SLUG_MAP: Record<string, SlugConfig> = {
  about: { type: "ABOUT", titleKey: "guide.about", fallback: "About" },
  "how-it-works": {
    type: "HOW_IT_WORKS",
    titleKey: "guide.howItWorks",
    fallback: "How It Works",
  },
  "for-clients": {
    type: "FOR_EMPLOYERS",
    titleKey: "guide.forEmployers",
    fallback: "For Clients",
  },
  "for-service-providers": {
    type: "FOR_PROVIDERS",
    titleKey: "guide.forServiceProviders",
    fallback: "For Service Providers",
  },
  "employer/post-job": {
    type: "EMPLOYER_POST_JOB",
    titleKey: "guide.employerPostJob",
    fallback: "Posting a Job",
  },
  "employer/instant-jobs": {
    type: "EMPLOYER_INSTANT_JOBS",
    titleKey: "guide.employerInstantJobs",
    fallback: "Instant Job Requests",
  },
  "employer/negotiation": {
    type: "EMPLOYER_NEGOTIATION",
    titleKey: "guide.employerNegotiation",
    fallback: "Negotiating Rates",
  },
  "employer/refund": {
    type: "EMPLOYER_REFUND",
    titleKey: "guide.employerRefund",
    fallback: "Refunds",
  },
  "employer/no-show": {
    type: "EMPLOYER_NO_SHOW",
    titleKey: "guide.employerNoShow",
    fallback: "No-Show Handling",
  },
  "sp/kyc": {
    type: "SP_KYC",
    titleKey: "guide.spKyc",
    fallback: "Identity Verification (KYC)",
  },
  "sp/apply-jobs": {
    type: "SP_APPLY_JOBS",
    titleKey: "guide.spApplyJobs",
    fallback: "Applying for Jobs",
  },
  "sp/skills": {
    type: "SP_SKILLS",
    titleKey: "guide.spSkills",
    fallback: "Skills & Profile",
  },
  "sp/availability": {
    type: "SP_AVAILABILITY",
    titleKey: "guide.spAvailability",
    fallback: "Availability",
  },
  "sp/accepting": {
    type: "SP_ACCEPTING",
    titleKey: "guide.spAccepting",
    fallback: "Accepting Work",
  },
  "sp/negotiation": {
    type: "SP_NEGOTIATION",
    titleKey: "guide.spNegotiation",
    fallback: "Negotiating Rates",
  },
  "sp/no-show": {
    type: "SP_NO_SHOW",
    titleKey: "guide.spNoShow",
    fallback: "Cancellations & No-Shows",
  },
};

export default function DashboardUsageDetailPage() {
  const params = useParams<{ slug: string | string[] }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const segments = Array.isArray(params.slug) ? params.slug : [params.slug];
  const key = segments.filter(Boolean).join("/");
  const config = SLUG_MAP[key];

  const dashboardHref =
    user?.role === "EMPLOYER"
      ? "/dashboard/employer"
      : user?.role === "ADMIN"
        ? "/dashboard/admin"
        : "/dashboard";

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/dashboard/usage"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--primary)]"
        >
          ← {t("guide.backToUsage", "Back to Usage Guide")}
        </Link>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--muted-text)]">
            {t("guide.notFound", "Guide not found.")}
          </p>
        </div>
      </div>
    );
  }

  const content = getGuideDocument(config.type, language as "en" | "pt");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3 text-xs font-medium text-[var(--muted-text)]">
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--primary)]"
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
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            {t("common.backToDashboard", "Back to Dashboard")}
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/dashboard/usage"
            className="transition-colors hover:text-[var(--primary)]"
          >
            {t("guide.backToUsage", "Back to Usage Guide")}
          </Link>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-[var(--foreground)]">
          {t(config.titleKey, config.fallback)}
        </h1>
      </div>
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 sm:p-10">
        <DashboardLegalContent content={content} />
      </div>
    </div>
  );
}
