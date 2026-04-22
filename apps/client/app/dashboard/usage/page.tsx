"use client";
import Link from "next/link";
import { useAuth } from "../../../lib/auth";
import { useLanguage } from "../../../context/LanguageContext";

interface UsageItem {
  slug: string;
  titleKey: string;
  fallback: string;
}

interface UsageGroup {
  titleKey: string;
  fallback: string;
  items: UsageItem[];
}

const SHARED_ITEMS: UsageItem[] = [
  { slug: "about", titleKey: "guide.about", fallback: "About" },
  {
    slug: "how-it-works",
    titleKey: "guide.howItWorks",
    fallback: "How It Works",
  },
];

const EMPLOYER_ITEMS: UsageItem[] = [
  {
    slug: "for-clients",
    titleKey: "guide.forEmployers",
    fallback: "For Clients",
  },
  {
    slug: "employer/post-job",
    titleKey: "guide.employerPostJob",
    fallback: "Posting a Job",
  },
  {
    slug: "employer/instant-jobs",
    titleKey: "guide.employerInstantJobs",
    fallback: "Instant Job Requests",
  },
  {
    slug: "employer/negotiation",
    titleKey: "guide.employerNegotiation",
    fallback: "Negotiating Rates",
  },
  {
    slug: "employer/refund",
    titleKey: "guide.employerRefund",
    fallback: "Refunds",
  },
  {
    slug: "employer/no-show",
    titleKey: "guide.employerNoShow",
    fallback: "No-Show Handling",
  },
];

const PROVIDER_ITEMS: UsageItem[] = [
  {
    slug: "for-service-providers",
    titleKey: "guide.forServiceProviders",
    fallback: "For Service Providers",
  },
  {
    slug: "sp/kyc",
    titleKey: "guide.spKyc",
    fallback: "Identity Verification (KYC)",
  },
  {
    slug: "sp/apply-jobs",
    titleKey: "guide.spApplyJobs",
    fallback: "Applying for Jobs",
  },
  {
    slug: "sp/skills",
    titleKey: "guide.spSkills",
    fallback: "Skills & Profile",
  },
  {
    slug: "sp/availability",
    titleKey: "guide.spAvailability",
    fallback: "Availability",
  },
  {
    slug: "sp/accepting",
    titleKey: "guide.spAccepting",
    fallback: "Accepting Work",
  },
  {
    slug: "sp/negotiation",
    titleKey: "guide.spNegotiation",
    fallback: "Negotiating Rates",
  },
  {
    slug: "sp/no-show",
    titleKey: "guide.spNoShow",
    fallback: "Cancellations & No-Shows",
  },
];

export default function DashboardUsagePage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const role = user?.role ?? null;
  const showEmployer = role === "EMPLOYER" || role === "ADMIN" || role === null;
  const showProvider =
    role === "JOB_SEEKER" || role === "ADMIN" || role === null;

  const groups: UsageGroup[] = [
    {
      titleKey: "guide.general",
      fallback: "General",
      items: SHARED_ITEMS,
    },
  ];

  if (showEmployer) {
    groups.push({
      titleKey: "guide.forEmployers",
      fallback: "For Clients",
      items: EMPLOYER_ITEMS,
    });
  }

  if (showProvider) {
    groups.push({
      titleKey: "guide.forServiceProviders",
      fallback: "For Service Providers",
      items: PROVIDER_ITEMS,
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t("guide.usage", "Usage Guide")}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-text)]">
          {t(
            "guide.usageDescription",
            "Learn how to make the most of Nasta with these step-by-step guides.",
          )}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.titleKey} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
            {t(group.titleKey, group.fallback)}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]">
            {group.items.map((item, idx) => (
              <Link
                key={item.slug}
                href={`/dashboard/usage/${item.slug}`}
                className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--surface-alt)] ${
                  idx < group.items.length - 1
                    ? "border-b border-[var(--border-color)]"
                    : ""
                }`}
              >
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {t(item.titleKey, item.fallback)}
                </span>
                <svg
                  className="h-4 w-4 text-[var(--muted-text)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
