"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../lib/api";
import BrandedSelect from "../../../../components/ui/BrandedSelect";
import { useLanguage } from "../../../../context/LanguageContext";
import Avatar from "../../../../components/Avatar";

interface Skill {
  id: string;
  name: string;
  proficiency?: string;
  yearsExp?: number;
}

interface ServiceProvider {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatar?: string;
  city?: string;
  country?: string;
  location?: string;
  bio?: string;
  headline?: string;
  skills: Skill[];
  skillsSummary?: string[];
  rating: number;
  ratingCount: number;
  hourlyRate?: number;
  rates?: Array<{
    rate: number;
    paymentType: string;
    otherSpecification?: string;
  }>;
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
  };
  return map[t] ?? `/${t.toLowerCase()}`;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? "text-[var(--fulfillment-gold)]" : "text-[var(--border-color)]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-[var(--muted-text)]">
        {rating > 0 ? rating.toFixed(1) : "—"} ({count})
      </span>
    </div>
  );
}

export default function ServiceProvidersPage() {
  const { t } = useLanguage();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<{ candidates: ServiceProvider[] }>(
        "/users/candidates",
      );
      if (cancelled) return;
      if (res.data?.candidates) {
        setProviders(res.data.candidates);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    providers.forEach((p) => p.skills.forEach((s) => skills.add(s.name)));
    return Array.from(skills).sort();
  }, [providers]);

  const filtered = useMemo(() => {
    let result = providers;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.headline?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.skills.some((s) => s.name.toLowerCase().includes(q)) ||
          p.city?.toLowerCase().includes(q) ||
          p.country?.toLowerCase().includes(q),
      );
    }
    if (skillFilter) {
      result = result.filter((p) =>
        p.skills.some((s) => s.name === skillFilter),
      );
    }
    return result;
  }, [search, skillFilter, providers]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t("employerDashboard.serviceProviders.title", "Service Providers")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          {t(
            "employerDashboard.serviceProviders.subtitle",
            "Browse verified service providers available for hire",
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              "employerDashboard.serviceProviders.searchPlaceholder",
              "Search by name, skill, or location...",
            )}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
        <BrandedSelect
          value={skillFilter}
          onChange={setSkillFilter}
          placeholder="All Skills"
          options={allSkills.map((s) => ({ value: s, label: s }))}
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-[var(--muted-text)]">
        {filtered.length}{" "}
        {filtered.length !== 1
          ? t("employerDashboard.serviceProviders.providersFound", "providers")
          : t(
              "employerDashboard.serviceProviders.providerFound",
              "provider",
            )}{" "}
        {t("employerDashboard.serviceProviders.found", "found")}
      </p>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-alt)]">
            <svg
              className="h-8 w-8 text-[var(--muted-text)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            {t(
              "employerDashboard.serviceProviders.noProvidersFound",
              "No service providers found",
            )}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {search || skillFilter
              ? t(
                  "employerDashboard.serviceProviders.adjustSearch",
                  "Try adjusting your search or filter criteria.",
                )
              : t(
                  "employerDashboard.serviceProviders.noProvidersAvailable",
                  "No fully verified service providers are available at the moment.",
                )}
          </p>
        </div>
      )}

      {/* Provider Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const avatarUrl = resolveAvatarUrl(p.avatar);
            const initials =
              `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
            const displayRate =
              p.rates && p.rates.length > 0 ? p.rates[0] : null;
            return (
              <Link
                key={p.id}
                href={`/dashboard/employer/service-providers/${p.id}`}
                className="group rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--primary)]/40 hover:shadow-lg"
              >
                {/* Top: Avatar + Name */}
                <div className="flex items-start gap-3.5">
                  <Avatar
                    src={avatarUrl}
                    alt={`${p.firstName} ${p.lastName}`}
                    imgClassName="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--border-color)]"
                    fallback={
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)] ring-2 ring-[var(--border-color)]">
                        {initials}
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {p.firstName} {p.lastName}
                    </h3>
                    {p.headline && (
                      <p className="truncate text-xs text-[var(--muted-text)]">
                        {p.headline}
                      </p>
                    )}
                    {(p.city || p.country) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted-text)]">
                        <svg
                          className="h-3 w-3"
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
                        {[p.city, p.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="mt-3">
                  <StarRating rating={p.rating} count={p.ratingCount} />
                </div>

                {/* Bio */}
                {p.bio && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[var(--secondary-text)]">
                    {p.bio}
                  </p>
                )}

                {/* Skills */}
                {p.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.skills.slice(0, 4).map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]"
                      >
                        {s.name}
                      </span>
                    ))}
                    {p.skills.length > 4 && (
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted-text)]">
                        +{p.skills.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Rate */}
                {displayRate && (
                  <div className="mt-3 flex items-baseline gap-1 border-t border-[var(--border-color)] pt-3">
                    <span className="text-base font-bold text-[var(--foreground)]">
                      €{displayRate.rate}
                    </span>
                    <span className="text-xs text-[var(--muted-text)]">
                      {paymentTypeLabel(displayRate.paymentType)}
                    </span>
                  </div>
                )}

                {/* Verified badge */}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-[var(--achievement-green)]">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Fully Verified
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
