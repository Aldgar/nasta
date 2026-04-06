"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../../lib/api";
import BrandedSelect from "../../../../../components/ui/BrandedSelect";
import { useLanguage } from "../../../../../context/LanguageContext";
import Avatar from "../../../../../components/Avatar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppJob {
  id: string;
  title: string;
  description?: string;
  city?: string;
  country?: string;
  location?: string;
  rateAmount?: number;
  currency?: string;
  paymentType?: string;
  startDate?: string;
  company?: { id: string; name: string } | null;
  employerId?: string;
}

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  city?: string;
  country?: string;
  location?: string;
  isIdVerified?: boolean;
  isBackgroundVerified?: boolean;
  idVerificationStatus?: string;
  backgroundCheckStatus?: string;
  userProfile?: {
    bio?: string;
    headline?: string;
    avatarUrl?: string;
    city?: string;
    country?: string;
    skillsSummary?: string;
  } | null;
}

interface PaymentStatus {
  required?: boolean;
  completed?: boolean;
  paidAmount?: number;
  unpaidAmount?: number;
  paymentId?: string;
  paymentIntentId?: string;
  clientSecret?: string;
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
  createdAt?: string;
  counterOffer?: CounterOffer;
}

interface CandidateRate {
  rate: number;
  paymentType: string;
  otherSpecification?: string;
}
interface CandidateData {
  rates?: CandidateRate[];
  rating?: number;
  ratingCount?: number;
  skills?: { name: string; yearsExp?: number }[];
}

interface AdditionalRateRequest {
  id: string;
  rates: { rate: number; paymentType: string; otherSpecification?: string }[];
  totalAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  message?: string;
  responseMessage?: string;
}

interface AdditionalTimeRequest {
  id: string;
  requestedBy: "EMPLOYER" | "JOB_SEEKER";
  message: string;
  status: "PENDING" | "PENDING_EMPLOYER_APPROVAL" | "ACCEPTED" | "REJECTED";
  requestedAt: string;
  additionalDays?: number;
  explanation?: string;
  respondedAt?: string;
  employerResponseAt?: string;
  employerResponseMessage?: string;
}

interface ApplicationDetail {
  id: string;
  status: string;
  appliedAt: string;
  completedAt?: string | null;
  coverLetter?: string;
  proposedRate?: number;
  currency?: string;
  verificationCode?: string | null;
  verificationCodeVisible?: boolean;
  verificationCodeMessage?: string | null;
  verificationCodeVerifiedAt?: string | null;
  verificationCodeLastVerifiedAt?: string | null;
  verificationCodeVersion?: number;
  verificationCodeVerifiedVersion?: number | null;
  serviceProviderMarkedDoneAt?: string | null;
  applicantId?: string;
  job?: AppJob;
  applicant?: Applicant;
  payment?: {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
  } | null;
  paymentStatus?: PaymentStatus | null;
  selectedRates?: CandidateRate[] | null;
  negotiationRequests?: NegotiationRequest[] | null;
  additionalRateRequests?: AdditionalRateRequest[] | null;
  additionalTimeRequests?: AdditionalTimeRequest[] | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLabel(val: string): string {
  return val
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IE", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit" })}`;
}

/* ------------------------------------------------------------------ */
/*  Timeline                                                           */
/* ------------------------------------------------------------------ */

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  timestamp?: string | null;
  state: "complete" | "current" | "pending" | "failed";
}

function buildEmployerTimeline(app: ApplicationDetail): TimelineStep[] {
  const status = app.status.toUpperCase();
  const isRejected = status === "REJECTED";
  const isWithdrawn = status === "WITHDRAWN";
  const isAccepted = status === "ACCEPTED";

  const negoList = Array.isArray(app.negotiationRequests)
    ? app.negotiationRequests
    : [];
  const hasNegotiation = negoList.length > 0;
  const negotiationAccepted = negoList.some(
    (r: any) => r.status === "ACCEPTED",
  );
  const negotiationPending =
    hasNegotiation &&
    !negotiationAccepted &&
    negoList.some((r: any) => r.status === "PENDING");
  const hasAdditionalNego =
    Array.isArray(app.additionalRateRequests) &&
    app.additionalRateRequests.length > 0;
  const paymentMade = app.paymentStatus?.completed === true;
  const serviceStarted = !!app.verificationCodeVerifiedAt;
  const markedDone = !!app.serviceProviderMarkedDoneAt;
  const completed = !!app.completedAt;

  const steps: TimelineStep[] = [];

  // 1. Application Received
  steps.push({
    key: "received",
    label: "Application Received",
    description: "A service provider applied for this position",
    timestamp: app.appliedAt,
    state: "complete",
  });

  // 2. Under Review
  const reviewPassed =
    ["REVIEWING", "ACCEPTED"].includes(status) || isRejected || isWithdrawn;
  steps.push({
    key: "review",
    label: "Under Review",
    description: "Application is being reviewed",
    state:
      isRejected || isWithdrawn
        ? "complete"
        : reviewPassed
          ? "complete"
          : status === "PENDING"
            ? "current"
            : "pending",
  });

  // Terminal states
  if (isRejected) {
    steps.push({
      key: "rejected",
      label: "Rejected",
      description: "Application was declined",
      state: "failed",
    });
    return steps;
  }
  if (isWithdrawn) {
    steps.push({
      key: "withdrawn",
      label: "Withdrawn",
      description: "Applicant withdrew their application",
      state: "failed",
    });
    return steps;
  }

  // 3. Negotiation
  const negoEmpDesc = negotiationAccepted
    ? "Negotiation accepted"
    : negotiationPending
      ? "Rate negotiation in progress"
      : hasNegotiation
        ? "Rate negotiation in progress"
        : "No negotiation requested";
  steps.push({
    key: "negotiation",
    label: "Negotiation",
    description: negoEmpDesc,
    state:
      isAccepted || negotiationAccepted
        ? "complete"
        : negotiationPending
          ? "current"
          : "pending",
  });

  // 4. Payment Made
  steps.push({
    key: "payment",
    label: "Payment Made",
    description:
      isAccepted || paymentMade ? "Payment has been made" : "Payment pending",
    state:
      isAccepted || paymentMade
        ? "complete"
        : negotiationAccepted
          ? "current"
          : "pending",
  });

  // 5. Hired
  steps.push({
    key: "accepted",
    label: "Hired",
    description: "You accepted this service provider",
    state: isAccepted ? "complete" : "pending",
  });

  // 6. Service Started
  steps.push({
    key: "started",
    label: "Service Started",
    description: "Service provider verified the code and started working",
    timestamp: app.verificationCodeVerifiedAt,
    state: isAccepted ? (serviceStarted ? "complete" : "current") : "pending",
  });

  // 7. Additional Negotiation (conditional)
  if (hasAdditionalNego) {
    steps.push({
      key: "additionalNego",
      label: "Additional Negotiation",
      description: "Additional amounts were requested during the job",
      state: isAccepted && serviceStarted ? "complete" : "pending",
    });
  }

  // 8. Provider Marked Done
  steps.push({
    key: "done",
    label: "Provider Marked Done",
    description: "Service provider marked the work as complete",
    timestamp: app.serviceProviderMarkedDoneAt,
    state: isAccepted
      ? markedDone
        ? "complete"
        : serviceStarted
          ? "current"
          : "pending"
      : "pending",
  });

  // 9. Completed
  steps.push({
    key: "completed",
    label: "Completed",
    description: "Job is complete",
    timestamp: app.completedAt,
    state: isAccepted
      ? completed
        ? "complete"
        : markedDone
          ? "current"
          : "pending"
      : "pending",
  });

  return steps;
}

function TrackingTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative pl-8">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dotSize = step.state === "current" ? "h-5 w-5" : "h-4 w-4";
        const dotColor =
          step.state === "complete"
            ? "bg-emerald-500 border-emerald-500"
            : step.state === "current"
              ? "bg-[var(--primary)] border-[var(--primary)] ring-4 ring-[var(--primary)]/20"
              : step.state === "failed"
                ? "bg-red-500 border-red-500"
                : "bg-[var(--surface-alt)] border-[var(--border-color)]";

        return (
          <div key={step.key} className="relative pb-8 last:pb-0">
            {!isLast && (
              <div
                className={`absolute left-0 top-5 w-0.5 ${step.state === "complete" ? "bg-emerald-500/40" : step.state === "failed" ? "bg-red-500/40" : "bg-[var(--border-color)]"}`}
                style={{
                  height: "calc(100% - 4px)",
                  transform: "translateX(-50%)",
                }}
              />
            )}
            <div
              className={`absolute left-0 top-0.5 flex items-center justify-center rounded-full border-2 ${dotSize} ${dotColor}`}
              style={{ transform: "translateX(-50%)" }}
            >
              {step.state === "complete" && (
                <svg
                  className="h-2.5 w-2.5 text-white"
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
              )}
              {step.state === "failed" && (
                <svg
                  className="h-2.5 w-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              {step.state === "current" && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              )}
            </div>
            <div className="ml-4">
              <h4
                className={`text-sm font-semibold ${
                  step.state === "complete"
                    ? "text-emerald-400"
                    : step.state === "current"
                      ? "text-[var(--primary)]"
                      : step.state === "failed"
                        ? "text-red-400"
                        : "text-[var(--muted-text)]"
                }`}
              >
                {step.label}
              </h4>
              <p
                className={`mt-0.5 text-xs ${step.state === "pending" ? "text-[var(--muted-text)]/50" : "text-[var(--muted-text)]"}`}
              >
                {step.description}
              </p>
              {step.timestamp && (
                <p className="mt-1 text-[10px] font-medium text-[var(--muted-text)]">
                  {fmtDateTime(step.timestamp)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Employer Negotiation Card                                          */
/* ------------------------------------------------------------------ */

function EmployerNegotiationCard({
  nr,
  isAccepted,
  isRejected,
  hasCounterOffer,
  isPending,
  isFromProvider,
  onRespond,
  onCounterOffer,
  onRespondToCounter,
}: {
  nr: NegotiationRequest;
  isAccepted: boolean;
  isRejected: boolean;
  hasCounterOffer: boolean;
  isPending: boolean;
  isFromProvider: boolean;
  onRespond: (
    requestId: string,
    status: "ACCEPTED" | "REJECTED",
    message?: string,
  ) => void;
  onCounterOffer: (
    requestId: string,
    rates: { rate: number; paymentType: string }[],
    totalAmount: number,
    message: string,
  ) => void;
  onRespondToCounter: (
    requestId: string,
    counterOfferId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => void;
}) {
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterRates, setCounterRates] = useState<
    { rate: string; paymentType: string }[]
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [counterMsg, setCounterMsg] = useState("");

  const submitCounter = () => {
    const valid = counterRates.filter((r) => r.rate && parseFloat(r.rate) > 0);
    if (valid.length === 0) return;
    const rates = valid.map((r) => ({
      rate: parseFloat(r.rate),
      paymentType: r.paymentType,
    }));
    const total = rates.reduce((s, r) => s + r.rate, 0);
    onCounterOffer(nr.id!, rates, total, counterMsg);
    setShowCounterForm(false);
    setCounterRates([{ rate: "", paymentType: "HOURLY" }]);
    setCounterMsg("");
  };

  return (
    <div
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
          {isFromProvider ? "Provider request" : "Your suggestion"}
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
            ? "Accepted"
            : isRejected
              ? "Rejected"
              : hasCounterOffer
                ? "Counter Offer"
                : "Pending"}
        </span>
      </div>

      {nr.rates && nr.rates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {nr.rates.map((r, j) => (
            <span
              key={j}
              className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
            >
              €{r.rate} / {formatLabel(r.paymentType).toLowerCase()}
            </span>
          ))}
        </div>
      )}
      {typeof nr.totalAmount === "number" && (
        <p className="mt-1.5 text-xs font-semibold text-[var(--foreground)]">
          Total: €{nr.totalAmount.toFixed(2)}
        </p>
      )}

      {nr.message && (
        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
          <p className="text-[10px] font-medium text-[var(--muted-text)]">
            {isFromProvider ? "Provider explanation" : "Your message"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
            {nr.message}
          </p>
        </div>
      )}

      {nr.responseMessage && !hasCounterOffer && (
        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
          <p className="text-[10px] font-medium text-[var(--muted-text)]">
            {isFromProvider ? "Your response" : "Provider response"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
            {nr.responseMessage}
          </p>
        </div>
      )}

      {/* Employer action: Accept/Reject/Counter for pending provider requests */}
      {isPending && isFromProvider && nr.id && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => onRespond(nr.id!, "ACCEPTED")}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              onClick={() => onRespond(nr.id!, "REJECTED")}
              className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
            >
              Reject
            </button>
          </div>
          {!showCounterForm ? (
            <button
              onClick={() => setShowCounterForm(true)}
              className="w-full rounded-lg border border-[var(--fulfillment-gold)]/30 py-2 text-xs font-semibold text-[var(--fulfillment-gold)] transition-colors hover:bg-[var(--fulfillment-gold)]/10"
            >
              Counter Offer
            </button>
          ) : (
            <div className="rounded-lg border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5 p-3">
              <p className="mb-2 text-[10px] font-bold text-[var(--fulfillment-gold)]">
                Your Counter Offer
              </p>
              {counterRates.map((r, i) => (
                <div key={i} className="mt-1.5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-text)]">
                      €
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.rate}
                      onChange={(e) =>
                        setCounterRates((p) =>
                          p.map((x, j) =>
                            j === i ? { ...x, rate: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="0.00"
                      className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>
                  <BrandedSelect
                    value={r.paymentType}
                    onChange={(v) =>
                      setCounterRates((p) =>
                        p.map((x, j) =>
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
                  {counterRates.length > 1 && (
                    <button
                      onClick={() =>
                        setCounterRates((p) => p.filter((_, j) => j !== i))
                      }
                      className="text-[var(--muted-text)] hover:text-red-400"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setCounterRates((p) => [
                    ...p,
                    { rate: "", paymentType: "HOURLY" },
                  ])
                }
                className="mt-1 text-[10px] font-medium text-[var(--primary)]"
              >
                + Add rate
              </button>
              <textarea
                value={counterMsg}
                onChange={(e) => setCounterMsg(e.target.value)}
                placeholder="Message (optional)..."
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={submitCounter}
                  className="flex-1 rounded-lg bg-[var(--fulfillment-gold)] py-1.5 text-xs font-semibold text-[var(--background)] hover:opacity-90"
                >
                  Send Counter
                </button>
                <button
                  onClick={() => setShowCounterForm(false)}
                  className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--muted-text)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Counter Offer details (when employer counter-offered) */}
      {hasCounterOffer && nr.counterOffer && (
        <div className="mt-3 rounded-lg border-l-2 border-[var(--fulfillment-gold)] bg-[var(--fulfillment-gold)]/5 px-3 py-2.5">
          <p className="text-[10px] font-bold text-[var(--fulfillment-gold)]">
            {nr.counterOffer.status === "PENDING" && isFromProvider
              ? "Your Counter Offer (awaiting response)"
              : nr.counterOffer.status === "PENDING" && !isFromProvider
                ? "Provider Counter Offer (awaiting response)"
                : "Counter Offer"}
          </p>
          {nr.counterOffer.rates && nr.counterOffer.rates.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {nr.counterOffer.rates.map((r, j) => (
                <span
                  key={j}
                  className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                >
                  €{r.rate} / {formatLabel(r.paymentType).toLowerCase()}
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

          {/* Employer respond to provider counter offer */}
          {nr.counterOffer.status === "PENDING" &&
            !isFromProvider &&
            nr.id &&
            nr.counterOffer.id && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() =>
                    onRespondToCounter(nr.id!, nr.counterOffer!.id!, "ACCEPTED")
                  }
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  Accept
                </button>
                <button
                  onClick={() =>
                    onRespondToCounter(nr.id!, nr.counterOffer!.id!, "REJECTED")
                  }
                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
                >
                  Reject
                </button>
              </div>
            )}
          {nr.counterOffer.status === "ACCEPTED" && (
            <p className="mt-2 text-xs font-bold text-emerald-400">
              Counter offer accepted
            </p>
          )}
          {nr.counterOffer.status === "REJECTED" && (
            <p className="mt-2 text-xs font-bold text-red-400">
              Counter offer rejected
            </p>
          )}
        </div>
      )}

      {(nr.suggestedAt || nr.createdAt) && (
        <p className="mt-2 text-[10px] text-[var(--muted-text)]">
          {fmtDateTime(nr.suggestedAt || nr.createdAt || "")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const STATUS_ACTIONS: {
  status: string;
  label: string;
  color: string;
  next: string;
}[] = [
  {
    status: "PENDING",
    label: "Start Review",
    color: "bg-[var(--fulfillment-gold)] text-[var(--background)]",
    next: "REVIEWING",
  },
  {
    status: "REVIEWING",
    label: "Shortlist",
    color: "bg-[var(--primary)] text-white",
    next: "SHORTLISTED",
  },
  {
    status: "SHORTLISTED",
    label: "Accept & Hire",
    color: "bg-emerald-600 text-white",
    next: "ACCEPTED",
  },
];

export default function EmployerApplicationDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = params?.id as string;

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rejectMsg, setRejectMsg] = useState("");
  const [showReject, setShowReject] = useState(false);

  // Service selection
  const [candidateData, setCandidateData] = useState<CandidateData | null>(
    null,
  );
  const [selectedRateIndices, setSelectedRateIndices] = useState<Set<number>>(
    new Set(),
  );
  const [savingRates, setSavingRates] = useState(false);

  // Employer negotiation suggestion
  const [showSuggestNego, setShowSuggestNego] = useState(false);
  const [negoRates, setNegoRates] = useState<
    { rate: string; paymentType: string }[]
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [negoMsg, setNegoMsg] = useState("");
  const [suggestingNego, setSuggestingNego] = useState(false);

  // Additional rate response
  const [respondingRateId, setRespondingRateId] = useState<string | null>(null);
  const [rateRespondMsg, setRateRespondMsg] = useState("");

  // Additional time request
  const [showTimeReqForm, setShowTimeReqForm] = useState(false);
  const [timeReqMsg, setTimeReqMsg] = useState("");
  const [requestingTime, setRequestingTime] = useState(false);
  const [respondingTimeId, setRespondingTimeId] = useState<string | null>(null);
  const [timeRespondMsg, setTimeRespondMsg] = useState("");

  // No-show
  const [reportingNoShow, setReportingNoShow] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);

  // Payment
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const fetchApp = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    const res = await api<ApplicationDetail>(`/applications/${appId}`);
    if (res.data) {
      setApp(res.data);
      // Fetch candidate data for service rates
      if (res.data.applicant?.id) {
        const cRes = await api<any>(
          `/users/candidates/${res.data.applicant.id}`,
        );
        if (cRes.data) {
          setCandidateData({
            rates: cRes.data.rates,
            rating: cRes.data.rating,
            ratingCount: cRes.data.ratingCount,
            skills: cRes.data.skills,
          });
          // Initialize selected rate indices from backend
          if (
            res.data.selectedRates &&
            Array.isArray(res.data.selectedRates) &&
            cRes.data.rates
          ) {
            const indices = new Set<number>();
            res.data.selectedRates.forEach((sr: CandidateRate) => {
              const idx = cRes.data.rates.findIndex(
                (r: CandidateRate) =>
                  r.rate === sr.rate && r.paymentType === sr.paymentType,
              );
              if (idx !== -1) indices.add(idx);
            });
            setSelectedRateIndices(indices);
          }
        }
      }
    }
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      setToast({ msg: "Payment completed successfully!", ok: true });
      fetchApp();
      router.replace(`/dashboard/employer/applications/${appId}`);
    } else if (paymentStatus === "cancelled") {
      setToast({ msg: "Payment was cancelled.", ok: false });
      router.replace(`/dashboard/employer/applications/${appId}`);
    }
  }, [searchParams, appId, router, fetchApp]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleStatusUpdate = async (newStatus: string, message?: string) => {
    setUpdatingStatus(true);
    const res = await api(`/applications/${appId}/status`, {
      method: "POST",
      body: { status: newStatus, message: message || undefined },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string" ? res.error : "Failed to update status",
        ok: false,
      });
    } else {
      setToast({
        msg: `Status updated to ${formatLabel(newStatus)}`,
        ok: true,
      });
      setShowReject(false);
      fetchApp();
    }
    setUpdatingStatus(false);
  };

  const handleComplete = async () => {
    setCompleting(true);
    const res = await api(`/payments/applications/${appId}/complete`, {
      method: "POST",
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string" ? res.error : "Failed to complete job",
        ok: false,
      });
    } else {
      setToast({ msg: "Job marked as complete!", ok: true });
      fetchApp();
    }
    setCompleting(false);
  };

  const handleNoShowReport = async () => {
    setReportingNoShow(true);
    const res = await api(`/no-show/report`, {
      method: "POST",
      body: { applicationId: appId },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to report no-show",
        ok: false,
      });
    } else {
      setToast({ msg: "No-show reported successfully", ok: true });
      setShowNoShowConfirm(false);
      fetchApp();
    }
    setReportingNoShow(false);
  };

  const handleRespondToNegotiation = async (
    requestId: string,
    status: "ACCEPTED" | "REJECTED",
    message?: string,
  ) => {
    const res = await api(
      `/applications/${appId}/negotiation/respond-employer`,
      {
        method: "POST",
        body: { requestId, status, message: message || undefined },
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
            ? "Negotiation accepted!"
            : "Negotiation rejected",
        ok: true,
      });
      fetchApp();
    }
  };

  const handleCounterOffer = async (
    requestId: string,
    rates: { rate: number; paymentType: string }[],
    totalAmount: number,
    message: string,
  ) => {
    const res = await api(`/applications/${appId}/negotiation/counter-offer`, {
      method: "POST",
      body: {
        requestId,
        rates,
        totalAmount,
        message: message.trim() || undefined,
      },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to send counter offer",
        ok: false,
      });
    } else {
      setToast({ msg: "Counter offer sent!", ok: true });
      fetchApp();
    }
  };

  const handleRespondToCounterOffer = async (
    requestId: string,
    counterOfferId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    const res = await api(
      `/applications/${appId}/negotiation/counter-offer/respond`,
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
      fetchApp();
    }
  };

  // ── Service rate selection ──────────────────────────────────
  const toggleRate = async (idx: number) => {
    const next = new Set(selectedRateIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedRateIndices(next);
    // Save to backend
    if (!candidateData?.rates) return;
    setSavingRates(true);
    const selectedRatesData = Array.from(next).map((i) => ({
      rate: candidateData.rates![i].rate,
      paymentType: candidateData.rates![i].paymentType,
      otherSpecification:
        candidateData.rates![i].otherSpecification || undefined,
    }));
    await api(`/applications/${appId}/selected-rates`, {
      method: "POST",
      body: { selectedRates: selectedRatesData },
    });
    setSavingRates(false);
  };

  const getSelectedTotal = (): number => {
    let total = 0;
    if (candidateData?.rates && selectedRateIndices.size > 0) {
      total = Array.from(selectedRateIndices).reduce(
        (s, i) => s + (candidateData.rates![i]?.rate || 0),
        0,
      );
    }
    if (app?.additionalRateRequests) {
      total += app.additionalRateRequests
        .filter((r) => r.status === "APPROVED")
        .reduce((s, r) => s + (r.totalAmount || 0), 0);
    }
    if (app?.negotiationRequests) {
      total += app.negotiationRequests
        .filter((r) => r.status === "ACCEPTED")
        .reduce((s, r) => {
          return (
            s +
            (r.counterOffer?.status === "ACCEPTED"
              ? r.counterOffer.totalAmount || 0
              : r.totalAmount || 0)
          );
        }, 0);
    }
    return total;
  };

  // ── Suggest negotiation ────────────────────────────────────
  const handleSuggestNegotiation = async () => {
    const valid = negoRates.filter((r) => r.rate && parseFloat(r.rate) > 0);
    if (valid.length === 0) return;
    if (!negoMsg.trim()) {
      setToast({ msg: "Please provide an explanation", ok: false });
      return;
    }
    setSuggestingNego(true);
    const rates = valid.map((r) => ({
      rate: parseFloat(r.rate),
      paymentType: r.paymentType,
    }));
    const totalAmount = rates.reduce((s, r) => s + r.rate, 0);
    const res = await api(`/applications/${appId}/negotiation`, {
      method: "POST",
      body: { rates, totalAmount, message: negoMsg.trim() },
    });
    if (res.error)
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to suggest negotiation",
        ok: false,
      });
    else {
      setToast({ msg: "Negotiation suggestion sent!", ok: true });
      setShowSuggestNego(false);
      setNegoRates([{ rate: "", paymentType: "HOURLY" }]);
      setNegoMsg("");
      fetchApp();
    }
    setSuggestingNego(false);
  };

  // ── Additional rate respond ────────────────────────────────
  const handleRespondAdditionalRate = async (
    requestId: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    const res = await api(`/applications/${appId}/additional-rates/respond`, {
      method: "POST",
      body: { requestId, status, message: rateRespondMsg.trim() || undefined },
    });
    if (res.error)
      setToast({
        msg: typeof res.error === "string" ? res.error : "Failed to respond",
        ok: false,
      });
    else {
      setToast({
        msg: `Additional rate ${status === "APPROVED" ? "approved" : "rejected"}`,
        ok: true,
      });
      setRespondingRateId(null);
      setRateRespondMsg("");
      fetchApp();
    }
  };

  // ── Additional time request ────────────────────────────────
  const handleRequestAdditionalTime = async () => {
    if (!timeReqMsg.trim()) return;
    setRequestingTime(true);
    const res = await api(`/applications/${appId}/additional-time/request`, {
      method: "POST",
      body: { message: timeReqMsg.trim() },
    });
    if (res.error)
      setToast({
        msg: typeof res.error === "string" ? res.error : "Failed to request",
        ok: false,
      });
    else {
      setToast({ msg: "Additional time request sent!", ok: true });
      setShowTimeReqForm(false);
      setTimeReqMsg("");
      fetchApp();
    }
    setRequestingTime(false);
  };

  const handleRespondAdditionalTime = async (
    requestId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    const res = await api(
      `/applications/${appId}/additional-time/respond-employer`,
      {
        method: "POST",
        body: {
          requestId,
          status,
          message: timeRespondMsg.trim() || undefined,
        },
      },
    );
    if (res.error)
      setToast({
        msg: typeof res.error === "string" ? res.error : "Failed to respond",
        ok: false,
      });
    else {
      setToast({
        msg: `Additional time ${status === "ACCEPTED" ? "accepted" : "rejected"}`,
        ok: true,
      });
      setRespondingTimeId(null);
      setTimeRespondMsg("");
      fetchApp();
    }
  };

  // ── Payment ────────────────────────────────────────────────
  const handleProceedToPayment = async () => {
    if (!app) return;
    setPaymentProcessing(true);
    const currentTotal = getSelectedTotal();
    const paidAmount = app.paymentStatus?.paidAmount ?? 0;
    const unpaidAmount = app.paymentStatus?.unpaidAmount ?? 0;
    const additionalNeeded =
      unpaidAmount > 0.01
        ? unpaidAmount
        : Math.max(0, currentTotal - paidAmount);
    if (additionalNeeded === 0 && paidAmount > 0) {
      setToast({ msg: "All services are already paid for", ok: true });
      setPaymentProcessing(false);
      return;
    }
    const selectedRatesData = candidateData?.rates
      ? Array.from(selectedRateIndices).map((i) => candidateData.rates![i])
      : [];
    // Add approved additional rates
    if (app.additionalRateRequests) {
      app.additionalRateRequests
        .filter((r) => r.status === "APPROVED")
        .forEach((r) => {
          r.rates.forEach((rate) => selectedRatesData.push(rate));
        });
    }
    const res = await api<any>(`/payments/applications/${app.id}/payment`, {
      method: "POST",
      body: {
        selectedRates: selectedRatesData,
        totalAmount: additionalNeeded > 0 ? additionalNeeded : currentTotal,
        platform: "web",
        clientOrigin: window.location.origin,
      },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to create payment",
        ok: false,
      });
    } else if (res.data) {
      // Web Checkout Session — redirect to Stripe hosted payment page
      if (res.data.checkoutUrl) {
        setToast({ msg: "Redirecting to payment...", ok: true });
        window.location.href = res.data.checkoutUrl;
        return;
      }

      const piStatus = res.data.status;
      // If payment was auto-confirmed (succeeded or processing), just refresh
      if (piStatus === "succeeded" || piStatus === "processing") {
        setToast({ msg: "Payment confirmed!", ok: true });
        fetchApp();
      } else if (
        piStatus === "requires_action" &&
        res.data.nextAction?.redirect_to_url?.url
      ) {
        // 3DS authentication required — redirect user
        setToast({
          msg: "Redirecting for payment authentication...",
          ok: true,
        });
        window.location.href = res.data.nextAction.redirect_to_url.url;
      } else if (res.data.clientSecret) {
        setToast({ msg: "Payment is being processed...", ok: true });
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const sRes = await api<any>(
            `/payments/applications/${app.id}/payment-status`,
          );
          if (sRes.data?.paymentCompleted) {
            clearInterval(poll);
            setToast({ msg: "Payment confirmed!", ok: true });
            fetchApp();
          }
          if (attempts > 15) {
            clearInterval(poll);
            setToast({
              msg: "Payment is still processing. Please refresh the page.",
              ok: false,
            });
          }
        }, 3000);
      }
    }
    setPaymentProcessing(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface-alt)]" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="h-80 animate-pulse rounded-2xl bg-[var(--surface)]" />
            <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" />
          </div>
          <div className="space-y-4">
            <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t(
              "employerDashboard.applications.applicationNotFound",
              "Application not found",
            )}
          </h2>
          <Link
            href="/dashboard/employer/applications"
            className="mt-6 inline-block rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white"
          >
            {t(
              "employerDashboard.applications.backToApplications",
              "Back to Applications",
            )}
          </Link>
        </div>
      </div>
    );
  }

  const job = app.job;
  const applicant = app.applicant;
  const status = app.status.toUpperCase();
  const isAccepted = status === "ACCEPTED";
  const isTerminal = status === "REJECTED" || status === "WITHDRAWN";
  const serviceStarted = !!app.verificationCodeVerifiedAt;
  const markedDone = !!app.serviceProviderMarkedDoneAt;
  const completed = !!app.completedAt;
  const applicantName = applicant
    ? `${applicant.firstName} ${applicant.lastName}`
    : "Applicant";
  const applicantAvatar = resolveAvatarUrl(
    applicant?.avatar || applicant?.userProfile?.avatarUrl,
  );
  const applicantInitials = applicant
    ? `${applicant.firstName[0]}${applicant.lastName[0]}`.toUpperCase()
    : "?";
  const applicantLocation = [
    applicant?.city || applicant?.userProfile?.city,
    applicant?.country || applicant?.userProfile?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const steps = buildEmployerTimeline(app);
  const nextAction = STATUS_ACTIONS.find((a) => a.status === status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
        {t(
          "employerDashboard.applications.backToApplications",
          "Back to Applications",
        )}
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)]/15">
              <Avatar
                src={applicantAvatar}
                imgClassName="h-full w-full object-cover"
                fallback={
                  <span className="text-lg font-bold text-[var(--primary)]">
                    {applicantInitials}
                  </span>
                }
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
                {t(
                  "employerDashboard.applications.applicationTracker",
                  "Application Tracker",
                )}
              </p>
              <h1 className="mt-0.5 text-xl font-bold text-[var(--foreground)]">
                {applicantName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-text)]">
                <span>
                  {t(
                    "employerDashboard.applications.appliedFor",
                    "Applied for",
                  )}{" "}
                  {job?.title || "a job"}
                </span>
                {applicantLocation && (
                  <span className="flex items-center gap-1">
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
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                    {applicantLocation}
                  </span>
                )}
                <span>{fmtDateTime(app.appliedAt)}</span>
              </div>
            </div>
          </div>
          {/* Verification badges */}
          <div className="flex gap-2">
            {applicant?.isIdVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
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
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                ID Verified
              </span>
            )}
            {applicant?.isBackgroundVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/15 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
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
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Background Checked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Tracking Timeline */}
          <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/15">
                <svg
                  className="h-5 w-5 text-[var(--primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">
                  Tracking Timeline
                </h2>
                <p className="text-xs text-[var(--muted-text)]">
                  Follow the progress of this application
                </p>
              </div>
            </div>
            <TrackingTimeline steps={steps} />
          </section>

          {/* Applicant profile */}
          {applicant && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                Applicant Profile
              </h2>
              {(applicant.bio || applicant.userProfile?.bio) && (
                <p className="mb-4 text-sm leading-relaxed text-[var(--muted-text)]">
                  {applicant.userProfile?.bio || applicant.bio}
                </p>
              )}
              {applicant.userProfile?.headline && (
                <p className="mb-3 text-xs font-medium text-[var(--primary)]">
                  {applicant.userProfile.headline}
                </p>
              )}
              {applicant.userProfile?.skillsSummary && (
                <div className="rounded-xl bg-[var(--surface-alt)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                    Skills
                  </p>
                  <p className="mt-1 text-sm text-[var(--foreground)]">
                    {applicant.userProfile.skillsSummary}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Cover letter */}
          {app.coverLetter && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                Cover Letter
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted-text)]">
                {app.coverLetter}
              </p>
            </section>
          )}

          {/* Negotiation history */}
          {app.negotiationRequests && app.negotiationRequests.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                Negotiation History
              </h2>
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                All negotiation requests for this application
              </p>
              <div className="space-y-3">
                {app.negotiationRequests.map((nr, i) => {
                  const isAccepted = nr.status === "ACCEPTED";
                  const isRejected = nr.status === "REJECTED";
                  const hasCounterOffer =
                    nr.status === "COUNTER_OFFERED" && nr.counterOffer;
                  const isPending = nr.status === "PENDING";
                  const isFromProvider = nr.suggestedByRole === "JOB_SEEKER";

                  return (
                    <EmployerNegotiationCard
                      key={i}
                      nr={nr}
                      isAccepted={isAccepted}
                      isRejected={isRejected}
                      hasCounterOffer={!!hasCounterOffer}
                      isPending={isPending}
                      isFromProvider={isFromProvider}
                      onRespond={handleRespondToNegotiation}
                      onCounterOffer={handleCounterOffer}
                      onRespondToCounter={handleRespondToCounterOffer}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Select Services ───────────────────────────── */}
          {candidateData?.rates &&
            candidateData.rates.length > 0 &&
            !isTerminal && (
              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
                <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                  Select Services
                </h2>
                <p className="mb-4 text-xs text-[var(--muted-text)]">
                  Choose the services you want from this provider
                </p>
                <div className="space-y-2">
                  {candidateData.rates.map((rate, i) => {
                    const checked = selectedRateIndices.has(i);
                    const isPaid =
                      app?.paymentStatus?.completed &&
                      app.selectedRates?.some(
                        (sr) =>
                          sr.rate === rate.rate &&
                          sr.paymentType === rate.paymentType,
                      );
                    return (
                      <label
                        key={i}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
                          checked
                            ? "border-[var(--primary)]/40 bg-[var(--primary)]/5"
                            : "border-[var(--border-color)] bg-[var(--surface-alt)] hover:border-[var(--primary)]/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRate(i)}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            €{rate.rate.toFixed(2)} /{" "}
                            {formatLabel(rate.paymentType).toLowerCase()}
                          </span>
                          {rate.otherSpecification && (
                            <span className="ml-2 text-xs text-[var(--muted-text)]">
                              ({rate.otherSpecification})
                            </span>
                          )}
                        </div>
                        {isPaid && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            Paid
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {savingRates && (
                  <p className="mt-2 text-[10px] text-[var(--muted-text)]">
                    Saving...
                  </p>
                )}

                {/* Selected Services Summary */}
                {(() => {
                  const total = getSelectedTotal();
                  const paid = app?.paymentStatus?.paidAmount ?? 0;
                  const unpaid = app?.paymentStatus?.unpaidAmount ?? 0;
                  const additionalNeeded =
                    unpaid > 0.01 ? unpaid : Math.max(0, total - paid);
                  if (total === 0 && paid === 0) return null;
                  return (
                    <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] p-4">
                      <h3 className="text-xs font-bold text-[var(--foreground)]">
                        Selected Services
                      </h3>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-[var(--muted-text)]">
                          Total Amount:
                        </span>
                        <span className="text-sm font-bold text-[var(--foreground)]">
                          EUR {total.toFixed(2)}
                        </span>
                      </div>
                      {paid > 0 && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-emerald-400">
                            Already Paid:
                          </span>
                          <span className="text-sm font-semibold text-emerald-400">
                            EUR {paid.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {additionalNeeded > 0 && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--alert-red)]">
                            Payment Required:
                          </span>
                          <span className="text-base font-bold text-[var(--alert-red)]">
                            EUR {additionalNeeded.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {additionalNeeded > 0 && (
                        <button
                          onClick={handleProceedToPayment}
                          disabled={paymentProcessing}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
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
                              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                            />
                          </svg>
                          {paymentProcessing
                            ? "Processing..."
                            : "Proceed to Payment"}
                        </button>
                      )}
                      {app?.paymentStatus?.completed &&
                        additionalNeeded === 0 && (
                          <p className="mt-2 text-center text-xs font-semibold text-emerald-400">
                            Payment Complete
                          </p>
                        )}
                    </div>
                  );
                })()}
              </section>
            )}

          {/* ── Suggest Negotiation (employer-initiated) ───── */}
          {!isTerminal && !completed && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Suggest Negotiation
                </h2>
                {!showSuggestNego && (
                  <button
                    onClick={() => setShowSuggestNego(true)}
                    className="rounded-lg bg-[var(--fulfillment-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--fulfillment-gold)] transition-colors hover:bg-[var(--fulfillment-gold)]/20"
                  >
                    Propose a rate
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-[var(--muted-text)]">
                Propose a different rate and explain why
              </p>
              {showSuggestNego && (
                <div className="space-y-3 rounded-xl border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5 p-4">
                  {negoRates.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-text)]">
                          €
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={r.rate}
                          onChange={(e) =>
                            setNegoRates((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, rate: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="0.00"
                          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] py-2 pl-7 pr-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                        />
                      </div>
                      <BrandedSelect
                        value={r.paymentType}
                        onChange={(v) =>
                          setNegoRates((p) =>
                            p.map((x, j) =>
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
                            setNegoRates((p) => p.filter((_, j) => j !== i))
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
                      setNegoRates((p) => [
                        ...p,
                        { rate: "", paymentType: "HOURLY" },
                      ])
                    }
                    className="text-xs font-medium text-[var(--primary)]"
                  >
                    + Add rate
                  </button>
                  <textarea
                    value={negoMsg}
                    onChange={(e) => setNegoMsg(e.target.value)}
                    placeholder="Explain your proposed rate..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSuggestNegotiation}
                      disabled={suggestingNego}
                      className="flex-1 rounded-lg bg-[var(--fulfillment-gold)] py-2 text-xs font-semibold text-[var(--background)] hover:opacity-90 disabled:opacity-50"
                    >
                      {suggestingNego ? "Sending..." : "Send Suggestion"}
                    </button>
                    <button
                      onClick={() => {
                        setShowSuggestNego(false);
                        setNegoRates([{ rate: "", paymentType: "HOURLY" }]);
                        setNegoMsg("");
                      }}
                      className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-xs text-[var(--muted-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Additional Rate Requests ──────────────────── */}
          {app.additionalRateRequests &&
            app.additionalRateRequests.length > 0 && (
              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
                <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                  Additional Rate Requests
                </h2>
                <p className="mb-4 text-xs text-[var(--muted-text)]">
                  Service provider requested additional services during the job
                </p>
                <div className="space-y-3">
                  {app.additionalRateRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`rounded-xl border p-4 ${
                        req.status === "APPROVED"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : req.status === "REJECTED"
                            ? "border-red-500/30 bg-red-500/5"
                            : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[var(--muted-text)]">
                          {fmtDateTime(req.requestedAt)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            req.status === "APPROVED"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : req.status === "REJECTED"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {req.status === "APPROVED"
                            ? "Approved"
                            : req.status === "REJECTED"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {req.rates.map((r, j) => (
                          <span
                            key={j}
                            className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                          >
                            €{r.rate.toFixed(2)} /{" "}
                            {formatLabel(r.paymentType).toLowerCase()}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">
                        Total: €{req.totalAmount.toFixed(2)}
                      </p>
                      {req.message && (
                        <p className="mt-2 text-xs text-[var(--muted-text)] italic">
                          "{req.message}"
                        </p>
                      )}
                      {req.responseMessage && (
                        <p className="mt-1 text-xs text-[var(--foreground)]/70">
                          Response: {req.responseMessage}
                        </p>
                      )}

                      {req.status === "PENDING" && (
                        <div className="mt-3">
                          {respondingRateId === req.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={rateRespondMsg}
                                onChange={(e) =>
                                  setRateRespondMsg(e.target.value)
                                }
                                placeholder="Response message (optional)..."
                                rows={2}
                                className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleRespondAdditionalRate(
                                      req.id,
                                      "APPROVED",
                                    )
                                  }
                                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    handleRespondAdditionalRate(
                                      req.id,
                                      "REJECTED",
                                    )
                                  }
                                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => {
                                    setRespondingRateId(null);
                                    setRateRespondMsg("");
                                  }}
                                  className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--muted-text)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRespondingRateId(req.id)}
                              className="w-full rounded-lg border border-[var(--primary)]/30 py-2 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                            >
                              Respond
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* ── Additional Time Requests ──────────────────── */}
          {isAccepted && !completed && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Additional Time
                  </h2>
                  <p className="text-xs text-[var(--muted-text)]">
                    Request or respond to additional time requests
                  </p>
                </div>
                {!showTimeReqForm && (
                  <button
                    onClick={() => setShowTimeReqForm(true)}
                    className="rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
                  >
                    Request Time
                  </button>
                )}
              </div>

              {showTimeReqForm && (
                <div className="mb-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4">
                  <textarea
                    value={timeReqMsg}
                    onChange={(e) => setTimeReqMsg(e.target.value)}
                    placeholder="Explain why additional time is needed..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleRequestAdditionalTime}
                      disabled={requestingTime}
                      className="flex-1 rounded-lg bg-[var(--primary)] py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {requestingTime ? "Sending..." : "Send Request"}
                    </button>
                    <button
                      onClick={() => {
                        setShowTimeReqForm(false);
                        setTimeReqMsg("");
                      }}
                      className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-xs text-[var(--muted-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {app.additionalTimeRequests &&
                app.additionalTimeRequests.length > 0 && (
                  <div className="space-y-3">
                    {app.additionalTimeRequests.map((req) => (
                      <div
                        key={req.id}
                        className={`rounded-xl border p-4 ${
                          req.status === "ACCEPTED"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : req.status === "REJECTED"
                              ? "border-red-500/30 bg-red-500/5"
                              : "border-amber-500/30 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[var(--foreground)]">
                            {req.requestedBy === "EMPLOYER"
                              ? "You requested"
                              : "Provider requested"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              req.status === "ACCEPTED"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : req.status === "REJECTED"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {req.status === "ACCEPTED"
                              ? "Accepted"
                              : req.status === "REJECTED"
                                ? "Rejected"
                                : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-text)]">
                          {req.message}
                        </p>
                        {req.additionalDays && (
                          <p className="mt-1 text-xs font-medium text-[var(--foreground)]">
                            +{req.additionalDays} days
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                          {fmtDateTime(req.requestedAt)}
                        </p>
                        {req.employerResponseMessage && (
                          <p className="mt-1 text-xs text-[var(--foreground)]/70">
                            Your response: {req.employerResponseMessage}
                          </p>
                        )}

                        {(req.status === "PENDING" ||
                          req.status === "PENDING_EMPLOYER_APPROVAL") &&
                          req.requestedBy === "JOB_SEEKER" && (
                            <div className="mt-3">
                              {respondingTimeId === req.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={timeRespondMsg}
                                    onChange={(e) =>
                                      setTimeRespondMsg(e.target.value)
                                    }
                                    placeholder="Response message (optional)..."
                                    rows={2}
                                    className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleRespondAdditionalTime(
                                          req.id,
                                          "ACCEPTED",
                                        )
                                      }
                                      className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRespondAdditionalTime(
                                          req.id,
                                          "REJECTED",
                                        )
                                      }
                                      className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRespondingTimeId(null);
                                        setTimeRespondMsg("");
                                      }}
                                      className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--muted-text)]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRespondingTimeId(req.id)}
                                  className="w-full rounded-lg border border-[var(--primary)]/30 py-2 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                                >
                                  Respond
                                </button>
                              )}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
            </section>
          )}

          {/* ── Payment Summary ───────────────────────────── */}
          {app.paymentStatus &&
            (typeof app.paymentStatus.paidAmount === "number" ||
              typeof app.paymentStatus.unpaidAmount === "number") && (
              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                  Payment Summary
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {typeof app.paymentStatus.paidAmount === "number" && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                      <p className="text-xs text-emerald-400/80">Paid</p>
                      <p className="mt-1 text-xl font-bold text-emerald-400">
                        €{app.paymentStatus.paidAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {typeof app.paymentStatus.unpaidAmount === "number" &&
                    app.paymentStatus.unpaidAmount > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                        <p className="text-xs text-amber-400/80">Unpaid</p>
                        <p className="mt-1 text-xl font-bold text-amber-400">
                          €{app.paymentStatus.unpaidAmount.toFixed(2)}
                        </p>
                      </div>
                    )}
                </div>
              </section>
            )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Status management */}
          {!isTerminal && !completed && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Manage Application
              </h3>

              {nextAction && (
                <button
                  onClick={() => handleStatusUpdate(nextAction.next)}
                  disabled={updatingStatus}
                  className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50 ${nextAction.color}`}
                >
                  {updatingStatus ? "Updating..." : nextAction.label}
                </button>
              )}

              {!isAccepted && !showReject && (
                <button
                  onClick={() => setShowReject(true)}
                  className="mt-2 w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Reject Application
                </button>
              )}

              {showReject && (
                <div className="mt-3">
                  <textarea
                    value={rejectMsg}
                    onChange={(e) => setRejectMsg(e.target.value)}
                    placeholder="Reason for rejection (optional)..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-red-500 focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() =>
                        handleStatusUpdate("REJECTED", rejectMsg.trim())
                      }
                      disabled={updatingStatus}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {updatingStatus ? "..." : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => setShowReject(false)}
                      className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification code */}
          {isAccepted &&
            app.verificationCode &&
            app.verificationCodeVisible !== false && (
              <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Verification Code
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  Share this code with the service provider to start the service
                </p>
                <div className="mt-3 rounded-xl bg-[var(--surface)] p-4 text-center">
                  <p className="text-3xl font-bold tracking-[0.3em] text-[var(--primary)]">
                    {app.verificationCode}
                  </p>
                </div>
                {app.verificationCodeMessage && (
                  <p className="mt-2 text-xs text-amber-400">
                    {app.verificationCodeMessage}
                  </p>
                )}
                {serviceStarted && (
                  <p className="mt-2 text-xs text-emerald-400">
                    Code verified on{" "}
                    {fmtDateTime(app.verificationCodeVerifiedAt)}
                  </p>
                )}
              </div>
            )}

          {/* Provider marked done banner */}
          {markedDone && !completed && (
            <div className="rounded-2xl border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5 p-5">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[var(--fulfillment-gold)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <p className="text-sm font-semibold text-[var(--fulfillment-gold)]">
                  Provider marked done
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                The service provider marked this job as done on{" "}
                {fmtDateTime(app.serviceProviderMarkedDoneAt)}. Review the work
                and mark as complete.
              </p>
            </div>
          )}

          {/* Mark as complete */}
          {isAccepted && !completed && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Complete Job
              </h3>
              {serviceStarted ? (
                <>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    Confirm the work is complete to process payment
                  </p>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {completing ? "Processing..." : "Mark as Complete & Pay"}
                  </button>
                </>
              ) : (
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  The service provider must verify the start code before you can
                  mark the job as complete.
                </p>
              )}
            </div>
          )}

          {/* Report No-Show */}
          {isAccepted &&
            !serviceStarted &&
            !completed &&
            job?.startDate &&
            new Date(job.startDate) < new Date() && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Report No-Show
                </h3>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  The service provider did not show up for the scheduled job
                  start date. Reporting a no-show will cancel the job.
                </p>
                {!showNoShowConfirm ? (
                  <button
                    onClick={() => setShowNoShowConfirm(true)}
                    className="mt-3 w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    Report No-Show
                  </button>
                ) : (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-red-400">
                      Are you sure? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleNoShowReport}
                        disabled={reportingNoShow}
                        className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                      >
                        {reportingNoShow ? "Reporting..." : "Confirm No-Show"}
                      </button>
                      <button
                        onClick={() => setShowNoShowConfirm(false)}
                        className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Completed badge */}
          {completed && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2">
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
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-emerald-400">
                  Job Completed
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                Completed on {fmtDateTime(app.completedAt)}
              </p>
            </div>
          )}

          {/* Candidate rating & skills */}
          {candidateData &&
            (candidateData.rating || candidateData.skills?.length) && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                  Provider Info
                </h3>
                {typeof candidateData.rating === "number" && (
                  <div className="mb-3 flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {candidateData.rating.toFixed(1)}
                    </span>
                    {candidateData.ratingCount && (
                      <span className="text-xs text-[var(--muted-text)]">
                        ({candidateData.ratingCount} reviews)
                      </span>
                    )}
                  </div>
                )}
                {candidateData.skills && candidateData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {candidateData.skills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-[var(--primary)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--primary)]"
                      >
                        {s.name}
                        {s.yearsExp ? ` (${s.yearsExp}y)` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* View Full Profile */}
          {applicant?.id && (
            <Link
              href={`/dashboard/employer/service-providers/${applicant.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 py-3 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
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
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              View Full Profile
            </Link>
          )}

          {/* View job link */}
          {job?.id && (
            <Link
              href={`/dashboard/employer/my-jobs`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
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
                  d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                />
              </svg>
              View My Jobs
            </Link>
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
