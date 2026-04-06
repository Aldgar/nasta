"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../../lib/api";
import { useLanguage } from "../../../../../context/LanguageContext";
import Avatar from "../../../../../components/Avatar";

interface Skill {
  id: string;
  name: string;
  proficiency?: string;
  yearsExp?: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface Rate {
  rate: number;
  paymentType: string;
  otherSpecification?: string;
  description?: string;
}

interface Vehicle {
  id: string;
  vehicleType: string;
  otherTypeSpecification?: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  capacity?: number;
  photoFrontUrl?: string;
}

interface WorkExperience {
  company: string;
  fromDate: string;
  toDate: string;
  isCurrent: boolean;
  category: string;
  years: string;
  description: string;
}

interface Education {
  title: string;
  institution: string;
  graduationDate: string;
  isStillStudying: boolean;
}

interface Certification {
  title: string;
  institution: string;
  graduationDate: string;
  isStillStudying: boolean;
}

interface AvailabilitySlot {
  id: string;
  start: string;
  end: string;
  timezone?: string;
}

interface CandidateProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  city?: string;
  country?: string;
  location?: string;
  bio?: string;
  headline?: string;
  skills: Skill[];
  skillsSummary?: string[];
  languages: Array<string | { language: string; level: string }>;
  rating: number;
  ratingCount: number;
  reviews: Review[];
  cvUrl?: string;
  hourlyRate?: number;
  rates: Rate[];
  workExperience: WorkExperience[];
  certifications: Certification[];
  education: Education[];
  projects: Array<{ title: string; description: string; url?: string }>;
  isIdVerified?: boolean;
  idVerificationStatus?: string;
  isBackgroundVerified?: boolean;
  backgroundCheckStatus?: string;
  hasWorkPermit?: boolean;
  hasVerifiedVehicle?: boolean;
  hasVerifiedDriversLicense?: boolean;
  vehicles?: Vehicle[];
  availability: AvailabilitySlot[];
  applicationInfo?: {
    hasApplied: boolean;
    hasBeenReferred: boolean;
    applicationId?: string;
    jobId?: string;
  };
}

function paymentTypeLabel(t: string) {
  const map: Record<string, string> = {
    HOUR: "/hr",
    DAY: "/day",
    WEEK: "/wk",
    MONTH: "/mo",
    FIXED: "fixed",
    PROJECT: "fixed",
    HOURLY: "/hr",
    DAILY: "/day",
    OTHER: "",
  };
  return map[t] ?? `/${t.toLowerCase()}`;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= Math.round(rating) ? "text-[var(--fulfillment-gold)]" : "text-[var(--border-color)]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm text-[var(--muted-text)]">
        {rating > 0 ? rating.toFixed(1) : "—"} ({count} review
        {count !== 1 ? "s" : ""})
      </span>
    </div>
  );
}

function VerificationBadge({
  label,
  verified,
}: {
  label: string;
  verified?: boolean;
}) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--achievement-green)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--achievement-green)]">
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ServiceProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api<CandidateProfile>(`/users/candidates/${id}`);
      if (res.data) {
        setProfile(res.data);
      } else {
        setError("Provider not found or no longer available.");
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard/employer/service-providers"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
          {t(
            "employerDashboard.serviceProviders.backToProviders",
            "Back to providers",
          )}
        </Link>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t(
              "employerDashboard.serviceProviders.providerNotFound",
              "Provider Not Found",
            )}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-text)]">{error}</p>
        </div>
      </div>
    );
  }

  const avatarUrl = resolveAvatarUrl(profile.avatar);
  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/employer/service-providers"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        {t(
          "employerDashboard.serviceProviders.backToProviders",
          "Back to providers",
        )}
      </Link>

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={avatarUrl}
            alt={`${profile.firstName} ${profile.lastName}`}
            imgClassName="h-20 w-20 rounded-full object-cover ring-2 ring-[var(--border-color)]"
            fallback={
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)] ring-2 ring-[var(--border-color)]">
                {initials}
              </div>
            }
          />
          <div className="flex-1 space-y-2">
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              {profile.firstName} {profile.lastName}
            </h1>
            {profile.headline && (
              <p className="text-sm text-[var(--muted-text)]">
                {profile.headline}
              </p>
            )}
            {(profile.city || profile.country) && (
              <p className="flex items-center gap-1.5 text-sm text-[var(--muted-text)]">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                  />
                </svg>
                {[profile.city, profile.country].filter(Boolean).join(", ")}
              </p>
            )}
            <StarRating rating={profile.rating} count={profile.ratingCount} />
            <div className="flex flex-wrap gap-2">
              <VerificationBadge
                label={t(
                  "employerDashboard.serviceProviders.idVerified",
                  "ID Verified",
                )}
                verified={profile.isIdVerified}
              />
              <VerificationBadge
                label={t(
                  "employerDashboard.serviceProviders.backgroundChecked",
                  "Background Checked",
                )}
                verified={profile.isBackgroundVerified}
              />
              <VerificationBadge
                label={t(
                  "employerDashboard.serviceProviders.workPermit",
                  "Work Permit",
                )}
                verified={profile.hasWorkPermit}
              />
            </div>
          </div>
          {/* Rates */}
          {profile.rates.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface-alt)] p-4 sm:min-w-[160px]">
              {profile.rates.map((r, i) => {
                const label =
                  r.paymentType === "OTHER" && r.otherSpecification
                    ? `/${r.otherSpecification}`
                    : paymentTypeLabel(r.paymentType);
                return (
                  <div key={i} className="text-center">
                    <div>
                      <span className="text-xl font-bold text-[var(--foreground)]">
                        €{r.rate}
                      </span>
                      <span className="ml-1 text-sm text-[var(--muted-text)]">
                        {label}
                      </span>
                    </div>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                        {r.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Application CTA / status */}
        {profile.applicationInfo?.hasApplied &&
          profile.applicationInfo.applicationId && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--primary)]/5 p-3">
              <span className="text-sm text-[var(--foreground)]">
                {t(
                  "employerDashboard.serviceProviders.appliedToJob",
                  "This provider has applied to one of your jobs.",
                )}
              </span>
              <Link
                href={`/dashboard/employer/applications/${profile.applicationInfo.applicationId}`}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {t(
                  "employerDashboard.serviceProviders.viewApplication",
                  "View Application →",
                )}
              </Link>
            </div>
          )}

        {/* Request Instant Job Button */}
        <div className="mt-4">
          <Link
            href={`/dashboard/employer/instant-job-request?candidateId=${profile.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C9963F] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#B8822A] hover:shadow-md"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>
            {t(
              "employerDashboard.serviceProviders.requestInstantJob",
              "Request Instant Job",
            )}
          </Link>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — large */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bio */}
          {profile.bio && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t("employerDashboard.serviceProviders.about", "About")}
              >
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--secondary-text)]">
                  {profile.bio}
                </p>
              </Section>
            </div>
          )}

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t("employerDashboard.serviceProviders.skills", "Skills")}
              >
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]"
                    >
                      {s.name}
                      {s.proficiency && (
                        <span className="rounded bg-[var(--primary)]/20 px-1.5 py-0.5 text-[10px]">
                          {s.proficiency}
                        </span>
                      )}
                      {s.yearsExp && (
                        <span className="text-[10px] text-[var(--muted-text)]">
                          {s.yearsExp}y
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Work Experience */}
          {profile.workExperience.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.workExperience",
                  "Work Experience",
                )}
              >
                <div className="space-y-4">
                  {profile.workExperience.map((w, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-[var(--primary)]/30 pl-4"
                    >
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {w.category}
                      </p>
                      <p className="text-xs text-[var(--muted-text)]">
                        {w.company} · {w.years}
                      </p>
                      <p className="text-xs text-[var(--muted-text)]">
                        {new Date(w.fromDate).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        —{" "}
                        {w.isCurrent
                          ? t(
                              "employerDashboard.serviceProviders.present",
                              "Present",
                            )
                          : new Date(w.toDate).toLocaleDateString(undefined, {
                              month: "short",
                              year: "numeric",
                            })}
                      </p>
                      {w.description && (
                        <p className="mt-1 text-xs text-[var(--secondary-text)]">
                          {w.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Education & Certifications */}
          {(profile.education.length > 0 ||
            profile.certifications.length > 0) && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              {profile.education.length > 0 && (
                <Section
                  title={t(
                    "employerDashboard.serviceProviders.education",
                    "Education",
                  )}
                >
                  <div className="space-y-3">
                    {profile.education.map((e, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {e.title}
                        </p>
                        <p className="text-xs text-[var(--muted-text)]">
                          {e.institution} ·{" "}
                          {e.isStillStudying
                            ? t(
                                "employerDashboard.serviceProviders.inProgress",
                                "In Progress",
                              )
                            : new Date(e.graduationDate).getFullYear()}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {profile.certifications.length > 0 && (
                <div className={profile.education.length > 0 ? "mt-5" : ""}>
                  <Section
                    title={t(
                      "employerDashboard.serviceProviders.certifications",
                      "Certifications",
                    )}
                  >
                    <div className="space-y-3">
                      {profile.certifications.map((c, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {c.title}
                          </p>
                          <p className="text-xs text-[var(--muted-text)]">
                            {c.institution} ·{" "}
                            {c.isStillStudying
                              ? t(
                                  "employerDashboard.serviceProviders.inProgress",
                                  "In Progress",
                                )
                              : new Date(c.graduationDate).getFullYear()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>
              )}
            </div>
          )}

          {/* Projects */}
          {profile.projects.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.projects",
                  "Projects",
                )}
              >
                <div className="space-y-3">
                  {profile.projects.map((p, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {p.title}
                      </p>
                      <p className="text-xs text-[var(--secondary-text)]">
                        {p.description}
                      </p>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--primary)] hover:underline"
                        >
                          {p.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Verification Badges */}
          {(profile.isIdVerified ||
            profile.idVerificationStatus === "VERIFIED" ||
            profile.isBackgroundVerified ||
            profile.backgroundCheckStatus === "APPROVED" ||
            profile.hasWorkPermit ||
            profile.hasVerifiedVehicle ||
            profile.hasVerifiedDriversLicense) && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.verification",
                  "Verification",
                )}
              >
                <div className="flex flex-wrap gap-2">
                  {(profile.isIdVerified ||
                    profile.idVerificationStatus === "VERIFIED") && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                      {t(
                        "employerDashboard.serviceProviders.idVerified",
                        "ID Verified",
                      )}
                    </span>
                  )}
                  {(profile.isBackgroundVerified ||
                    profile.backgroundCheckStatus === "APPROVED") && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                        />
                      </svg>
                      {t(
                        "employerDashboard.serviceProviders.backgroundChecked",
                        "Background Checked",
                      )}
                    </span>
                  )}
                  {profile.hasWorkPermit && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      {t(
                        "employerDashboard.serviceProviders.workPermit",
                        "Work Permit",
                      )}
                    </span>
                  )}
                  {profile.hasVerifiedDriversLicense && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"
                        />
                      </svg>
                      {t(
                        "employerDashboard.serviceProviders.driversLicenseVerified",
                        "Driver's License Verified",
                      )}
                    </span>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* Vehicles */}
          {profile.vehicles && profile.vehicles.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.vehicleVerification",
                  "Vehicle Verification",
                )}
              >
                <div className="space-y-3">
                  {profile.vehicles.map((vehicle, idx) => (
                    <div
                      key={vehicle.id || idx}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className="h-5 w-5 text-[var(--primary)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                          />
                        </svg>
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-[var(--secondary-text)]">
                        <p>
                          {vehicle.vehicleType}
                          {vehicle.otherTypeSpecification
                            ? ` – ${vehicle.otherTypeSpecification}`
                            : ""}
                        </p>
                        {vehicle.color && (
                          <p>
                            {t(
                              "employerDashboard.serviceProviders.color",
                              "Color",
                            )}
                            : {vehicle.color}
                          </p>
                        )}
                        {vehicle.capacity != null && (
                          <p>
                            {t(
                              "employerDashboard.serviceProviders.capacity",
                              "Capacity",
                            )}
                            : {vehicle.capacity}
                          </p>
                        )}
                      </div>
                      {profile.hasVerifiedVehicle && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                            />
                          </svg>
                          {t(
                            "employerDashboard.serviceProviders.vehicleVerified",
                            "Verified",
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Reviews */}
          {profile.reviews.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={`${t("employerDashboard.serviceProviders.reviews", "Reviews")} (${profile.reviews.length})`}
              >
                <div className="space-y-4">
                  {profile.reviews.map((r) => {
                    const ra = resolveAvatarUrl(r.reviewer.avatar);
                    return (
                      <div key={r.id} className="flex gap-3">
                        <Avatar
                          src={ra}
                          imgClassName="h-8 w-8 rounded-full object-cover"
                          fallback={
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-alt)] text-xs font-semibold text-[var(--muted-text)]">
                              {r.reviewer.firstName[0]}
                              {r.reviewer.lastName[0]}
                            </div>
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              {r.reviewer.firstName} {r.reviewer.lastName}
                            </span>
                            <span className="text-[10px] text-[var(--muted-text)]">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <svg
                                key={s}
                                className={`h-3 w-3 ${s <= r.rating ? "text-[var(--fulfillment-gold)]" : "text-[var(--border-color)]"}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          {r.comment && (
                            <p className="mt-1 text-xs text-[var(--secondary-text)]">
                              {r.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Languages */}
          {profile.languages.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.languages",
                  "Languages",
                )}
              >
                <div className="space-y-1.5">
                  {profile.languages.map((lang, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-[var(--foreground)]">
                        {typeof lang === "string" ? lang : lang.language}
                      </span>
                      {typeof lang !== "string" && lang.level && (
                        <span className="text-xs text-[var(--muted-text)]">
                          {lang.level}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* CV */}
          {profile.cvUrl && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.cvResume",
                  "CV / Resume",
                )}
              >
                <a
                  href={profile.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {t(
                    "employerDashboard.serviceProviders.downloadCv",
                    "Download CV",
                  )}
                </a>
              </Section>
            </div>
          )}

          {/* Availability */}
          {profile.availability.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <Section
                title={t(
                  "employerDashboard.serviceProviders.availability",
                  "Availability",
                )}
              >
                <div className="space-y-2">
                  {profile.availability.slice(0, 5).map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-lg bg-[var(--surface-alt)] p-2.5 text-xs"
                    >
                      <p className="font-medium text-[var(--foreground)]">
                        {new Date(slot.start).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-[var(--muted-text)]">
                        {new Date(slot.start).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        —{" "}
                        {new Date(slot.end).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                  {profile.availability.length > 5 && (
                    <p className="text-xs text-[var(--muted-text)]">
                      +{profile.availability.length - 5}{" "}
                      {t(
                        "employerDashboard.serviceProviders.moreSlots",
                        "more slots",
                      )}
                    </p>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
