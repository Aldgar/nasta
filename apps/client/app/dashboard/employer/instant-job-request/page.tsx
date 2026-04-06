"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../lib/api";
import BrandedSelect from "../../../../components/ui/BrandedSelect";
import BrandedDatePicker from "../../../../components/ui/BrandedDatePicker";
import BrandedTimePicker from "../../../../components/ui/BrandedTimePicker";
import { useLanguage } from "../../../../context/LanguageContext";

interface Category {
  id: string;
  name: string;
}

const WORK_MODES = [
  { value: "ON_SITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

const URGENCY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "URGENT", label: "Urgent" },
];

const JOB_TYPES = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "GIG", label: "Gig" },
];

const PAYMENT_TYPES = [
  { value: "HOURLY", label: "Per Hour" },
  { value: "DAILY", label: "Per Day" },
  { value: "WEEKLY", label: "Per Week" },
  { value: "MONTHLY", label: "Per Month" },
  { value: "FIXED", label: "Fixed Price" },
];

const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
];

export default function InstantJobRequestPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = searchParams.get("candidateId");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [workMode, setWorkMode] = useState("ON_SITE");
  const [urgency, setUrgency] = useState("NORMAL");
  const [jobType, setJobType] = useState("GIG");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [rateAmount, setRateAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [paymentType, setPaymentType] = useState("HOURLY");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [isRestrictedSector, setIsRestrictedSector] = useState(false);
  const [requiresVehicle, setRequiresVehicle] = useState(false);
  const [requiresDriverLicense, setRequiresDriverLicense] = useState(false);

  const fetchCategories = useCallback(async () => {
    const res = await api<Category[]>("/jobs/categories");
    if (res.data && Array.isArray(res.data)) setCategories(res.data);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) {
      setToast({ message: "Missing candidate ID", type: "error" });
      return;
    }
    if (!title.trim()) {
      setToast({ message: "Job title is required", type: "error" });
      return;
    }
    if (!description.trim()) {
      setToast({ message: "Job description is required", type: "error" });
      return;
    }
    if (!location.trim()) {
      setToast({ message: "Location is required", type: "error" });
      return;
    }
    if (!city.trim()) {
      setToast({ message: "City is required", type: "error" });
      return;
    }
    if (!country.trim()) {
      setToast({ message: "Country is required", type: "error" });
      return;
    }
    if (!startDate) {
      setToast({ message: "Start date is required", type: "error" });
      return;
    }

    setLoading(true);

    const startDateTime = `${startDate}T${startTime || "09:00"}:00.000Z`;

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      workMode,
      urgency,
      type: jobType,
      location: location.trim(),
      city: city.trim(),
      country: country.trim(),
      lat: 0,
      lng: 0,
      startDate: startDateTime,
      isInstantBook: true,
    };

    if (categoryId === "custom") {
      if (customCategory.trim()) payload.categoryName = customCategory.trim();
    } else if (categoryId) {
      payload.categoryId = categoryId;
    }

    if (endDate) payload.endDate = `${endDate}T23:59:59.000Z`;
    if (rateAmount && parseFloat(rateAmount) > 0) {
      payload.rateAmount = Math.round(parseFloat(rateAmount) * 100);
      payload.currency = currency;
      payload.paymentType = paymentType;
    }

    const filteredReqs = requirements.filter((r) => r.trim());
    if (filteredReqs.length > 0) payload.requirements = filteredReqs;

    if (requiresVehicle) payload.requiresVehicle = true;
    if (requiresDriverLicense) payload.requiresDriverLicense = true;

    // Step 1: Create the job
    const jobRes = await api<{ id: string }>("/jobs", {
      method: "POST",
      body: payload,
    });

    if (jobRes.error || !jobRes.data?.id) {
      setLoading(false);
      setToast({
        message:
          typeof jobRes.error === "string"
            ? jobRes.error
            : "Failed to create instant job",
        type: "error",
      });
      return;
    }

    // Step 2: Auto-apply the candidate
    const applyRes = await api(
      `/applications/instant/${jobRes.data.id}/${candidateId}`,
      { method: "POST" },
    );

    setLoading(false);

    if (applyRes.error) {
      setToast({
        message:
          typeof applyRes.error === "string"
            ? applyRes.error
            : "Job created but failed to send request to provider",
        type: "error",
      });
      return;
    }

    setToast({
      message: t(
        "employerDashboard.instantJob.success",
        "Instant job request sent successfully!",
      ),
      type: "success",
    });
    setTimeout(() => router.push("/dashboard/employer/my-jobs"), 1500);
  };

  const addListItem = (list: string[], setter: (v: string[]) => void) => {
    setter([...list, ""]);
  };

  const updateListItem = (
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
    val: string,
  ) => {
    const updated = [...list];
    updated[idx] = val;
    setter(updated);
  };

  const removeListItem = (
    list: string[],
    setter: (v: string[]) => void,
    idx: number,
  ) => {
    if (list.length <= 1) {
      setter([""]);
      return;
    }
    setter(list.filter((_, i) => i !== idx));
  };

  const inputCls =
    "w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30";
  const labelCls = "block text-sm font-medium text-[var(--foreground)] mb-1.5";

  if (!candidateId) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t(
              "employerDashboard.instantJob.missingCandidate",
              "No candidate specified",
            )}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-text)]">
            {t(
              "employerDashboard.instantJob.missingCandidateDesc",
              "Please select a service provider first.",
            )}
          </p>
          <Link
            href="/dashboard/employer/service-providers"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t(
              "employerDashboard.instantJob.browseProviders",
              "Browse Service Providers",
            )}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-[var(--achievement-green)] text-white"
              : "bg-[var(--alert-red)] text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] text-[var(--muted-text)] transition-colors hover:text-[var(--foreground)]"
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
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9963F]">
            {t("employerDashboard.instantJob.badge", "Instant")}
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
          {t("employerDashboard.instantJob.title", "Request Instant Job")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          {t(
            "employerDashboard.instantJob.subtitle",
            "Create an instant job request and send it directly to this service provider.",
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Basic Info ─────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.jobDetails", "Job Details")}
          </h2>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.jobTitle", "Job Title *")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(
                  "employerDashboard.postJob.jobTitlePlaceholder",
                  "e.g. House Cleaning, Garden Maintenance...",
                )}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.description", "Description *")}
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  "employerDashboard.postJob.descriptionPlaceholder",
                  "Describe the job, what needs to be done, and any specific instructions...",
                )}
                className={inputCls + " resize-none"}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>
                  {t("employerDashboard.postJob.categoryLabel", "Category")}
                </label>
                <BrandedSelect
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder={t(
                    "employerDashboard.postJob.selectCategory",
                    "Select a category",
                  )}
                  options={[
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                    { value: "custom", label: "Other (custom)" },
                  ]}
                />
              </div>
              {categoryId === "custom" && (
                <div>
                  <label className={labelCls}>
                    {t(
                      "employerDashboard.postJob.customCategory",
                      "Custom Category",
                    )}
                  </label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name..."
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>
                  {t("employerDashboard.postJob.jobType", "Job Type")}
                </label>
                <BrandedSelect
                  value={jobType}
                  onChange={setJobType}
                  options={JOB_TYPES.map((jt) => ({
                    value: jt.value,
                    label: jt.label,
                  }))}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Work Mode & Urgency ────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.workMode", "Work Mode")} &{" "}
            {t("employerDashboard.postJob.urgency", "Urgency")}
          </h2>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.workMode", "Work Mode")} *
              </label>
              <div className="flex flex-wrap gap-3">
                {WORK_MODES.map((wm) => (
                  <button
                    key={wm.value}
                    type="button"
                    onClick={() => setWorkMode(wm.value)}
                    className={`rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                      workMode === wm.value
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border-color)] bg-[var(--surface-alt)] text-[var(--muted-text)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {wm.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.urgency", "Urgency")}
              </label>
              <div className="flex flex-wrap gap-3">
                {URGENCY_OPTIONS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgency(u.value)}
                    className={`rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                      urgency === u.value
                        ? u.value === "URGENT"
                          ? "border-[var(--alert-red)] bg-[var(--alert-red)]/10 text-[var(--alert-red)]"
                          : "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border-color)] bg-[var(--surface-alt)] text-[var(--muted-text)]"
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Location ───────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.location", "Location")}
          </h2>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.location", "Address / Location")}{" "}
                *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Street address or area..."
                className={inputCls}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>
                  {t("employerDashboard.postJob.city", "City")} *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t("employerDashboard.postJob.country", "Country")} *
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Schedule ───────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.schedule", "Schedule")}
          </h2>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.startDateAndTime", "Start Date")}{" "}
                *
              </label>
              <BrandedDatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Select start date"
              />
            </div>
            <div>
              <label className={labelCls}>Start Time</label>
              <BrandedTimePicker
                value={startTime}
                onChange={setStartTime}
                placeholder="Select time"
                step={15}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.endDate", "End Date (Optional)")}
              </label>
              <BrandedDatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="Select end date"
              />
            </div>
          </div>
        </section>

        {/* ── Payment ────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.compensation", "Payment")}
          </h2>
          <p className="mb-4 text-xs text-[var(--muted-text)]">
            Optional. The provider can see your offered rate.
          </p>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.rate", "Rate Amount")}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rateAmount}
                onChange={(e) => setRateAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.currency", "Currency")}
              </label>
              <BrandedSelect
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("employerDashboard.postJob.paymentType", "Payment Type")}
              </label>
              <BrandedSelect
                value={paymentType}
                onChange={setPaymentType}
                options={PAYMENT_TYPES.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
              />
            </div>
          </div>
        </section>

        {/* ── Requirements ───────────────────────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t("employerDashboard.postJob.requirementsTitle", "Requirements")}
          </h2>

          <div className="space-y-2">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) =>
                    updateListItem(
                      requirements,
                      setRequirements,
                      i,
                      e.target.value,
                    )
                  }
                  placeholder={`Requirement ${i + 1}...`}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() =>
                    removeListItem(requirements, setRequirements, i)
                  }
                  className="shrink-0 rounded-lg p-2 text-[var(--muted-text)] transition-colors hover:bg-[var(--alert-red)]/10 hover:text-[var(--alert-red)]"
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
              </div>
            ))}
            <button
              type="button"
              onClick={() => addListItem(requirements, setRequirements)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
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
              {t("employerDashboard.postJob.addRequirement", "Add requirement")}
            </button>
          </div>
        </section>

        {/* ── Vehicle / License Requirements ─────────── */}
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <h2 className="mb-5 text-lg font-semibold text-[var(--foreground)]">
            {t(
              "employerDashboard.postJob.jobRequirementsTitle",
              "Job Requirements",
            )}
          </h2>

          <div className="space-y-5">
            {/* Restricted sector */}
            <div>
              <p className="mb-2 text-sm text-[var(--secondary-text)]">
                {t(
                  "employerDashboard.postJob.restrictedSectorQuestion",
                  "Is this job related to Healthcare, Government, Finance, or Military?",
                )}
              </p>
              <label className="relative inline-flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isRestrictedSector}
                  onChange={(e) => setIsRestrictedSector(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-[var(--border-color)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--alert-red)] peer-checked:after:translate-x-full" />
                <span
                  className={`text-sm ${
                    isRestrictedSector
                      ? "font-medium text-[var(--alert-red)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {isRestrictedSector
                    ? t(
                        "employerDashboard.postJob.restrictedSectorYes",
                        "Yes \u2014 Restricted Sector",
                      )
                    : t("employerDashboard.postJob.no", "No")}
                </span>
              </label>
            </div>

            {/* Warning banner when restricted sector is selected */}
            {isRestrictedSector && (
              <div className="flex items-start gap-3 rounded-xl border border-[var(--alert-red)]/30 bg-[var(--alert-red)]/5 p-4">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--alert-red)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
                <p className="text-sm text-[var(--alert-red)]">
                  {t(
                    "employerDashboard.postJob.restrictedSectorWarning",
                    "Jobs in Healthcare, Government, Finance, and Military sectors are not currently supported on Nasta. Please use a specialized platform for these sectors.",
                  )}
                </p>
              </div>
            )}

            {/* Vehicle & driver requirements (only if not restricted sector) */}
            {!isRestrictedSector && (
              <>
                <div>
                  <p className="mb-2 text-sm text-[var(--secondary-text)]">
                    {t(
                      "employerDashboard.postJob.vehicleQuestion",
                      "Does this job have any of these requirements?",
                    )}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                    <label className="relative inline-flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={requiresVehicle}
                        onChange={(e) => setRequiresVehicle(e.target.checked)}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-[var(--border-color)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-full" />
                      <span className="text-sm text-[var(--foreground)]">
                        {t(
                          "employerDashboard.postJob.requiresVehicle",
                          "Requires a vehicle / truck",
                        )}
                      </span>
                    </label>
                    <label className="relative inline-flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={requiresDriverLicense}
                        onChange={(e) =>
                          setRequiresDriverLicense(e.target.checked)
                        }
                      />
                      <div className="peer h-6 w-11 rounded-full bg-[var(--border-color)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-full" />
                      <span className="text-sm text-[var(--foreground)]">
                        {t(
                          "employerDashboard.postJob.requiresDriverLicense",
                          "Requires a driving license",
                        )}
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Submit ─────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || isRestrictedSector}
            className="flex items-center gap-2 rounded-xl bg-[#C9963F] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#B8822A] disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t("employerDashboard.instantJob.sending", "Sending...")}
              </>
            ) : (
              <>
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
                    d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                  />
                </svg>
                {t(
                  "employerDashboard.instantJob.sendRequest",
                  "Send Instant Request",
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
