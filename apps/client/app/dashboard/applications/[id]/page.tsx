"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, resolveAvatarUrl } from "../../../../lib/api";
import { useLanguage } from "../../../../context/LanguageContext";
import BrandedSelect from "../../../../components/ui/BrandedSelect";

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
  avatar?: string;
  city?: string;
  country?: string;
}

interface PaymentInfo {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

interface SelectedRate {
  rate: number;
  paymentType: string;
  description?: string;
  otherSpecification?: string;
  isCustom?: boolean;
}

interface PaymentStatus {
  required?: boolean;
  completed?: boolean;
  paidAmount?: number;
  unpaidAmount?: number;
  paidServices?: SelectedRate[];
  unpaidServices?: SelectedRate[];
  paidNegotiations?: Array<{ id?: string; rate: number; paymentType: string }>;
  unpaidNegotiations?: Array<{
    id?: string;
    rate: number;
    paymentType: string;
  }>;
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

interface AdditionalRateRequest {
  id: string;
  rates?: SelectedRate[];
  totalAmount?: number;
  status?: string;
  message?: string;
  requestedAt?: string;
  respondedAt?: string;
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
  verificationCodeVerifiedAt?: string | null;
  verificationCodeLastVerifiedAt?: string | null;
  verificationCodeVersion?: number;
  verificationCodeVerifiedVersion?: number | null;
  pendingVerificationCodeVersion?: number | null;
  serviceProviderMarkedDoneAt?: string | null;
  job?: AppJob;
  applicant?: Applicant;
  payment?: PaymentInfo | null;
  paymentStatus?: PaymentStatus | null;
  paymentAmount?: number | null;
  selectedRates?: SelectedRate[] | null;
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
/*  Timeline step builder                                              */
/* ------------------------------------------------------------------ */

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  timestamp?: string | null;
  state: "complete" | "current" | "pending" | "failed";
}

function buildTimeline(
  app: ApplicationDetail,
  t: (key: string, fallback: string) => string,
): TimelineStep[] {
  const status = app.status.toUpperCase();
  const isRequested = status === "REQUESTED";
  const isRejected = status === "REJECTED";
  const isWithdrawn = status === "WITHDRAWN";
  const isAccepted = status === "ACCEPTED";
  const isPending = status === "PENDING";

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

  // 1. Applied
  steps.push({
    key: "applied",
    label: t("applications.applied", "Applied"),
    description: isRequested
      ? t(
          "applications.instantJobRequestReceived",
          "Instant job request received from employer",
        )
      : t(
          "applications.applicationSubmitted",
          "Your application has been submitted",
        ),
    timestamp: app.appliedAt,
    state: "complete",
  });

  // 1b. Instant Job Response (only for REQUESTED flow)
  if (isRequested || isPending || isAccepted || isRejected) {
    const responded = !isRequested;
    steps.push({
      key: "response",
      label: t("applications.yourResponse", "Your Response"),
      description: isRequested
        ? t(
            "applications.waitingForYourResponse",
            "Waiting for you to accept or reject this request",
          )
        : isRejected
          ? t("applications.youRejectedRequest", "You rejected this request")
          : t("applications.youAcceptedRequest", "You accepted this request"),
      state: isRequested
        ? "current"
        : responded
          ? isRejected
            ? "failed"
            : "complete"
          : "pending",
    });
  }

  // 2. Under Review
  const reviewPassed =
    ["REVIEWING", "ACCEPTED"].includes(status) || isRejected || isWithdrawn;
  steps.push({
    key: "review",
    label: t("applications.statusReviewing", "Under Review"),
    description: t(
      "applications.beingReviewed",
      "Your application is being reviewed by the employer",
    ),
    state:
      isRejected || isWithdrawn
        ? "complete"
        : reviewPassed
          ? "complete"
          : status === "PENDING"
            ? "current"
            : "pending",
  });

  // Terminal: Rejected / Withdrawn
  if (isRejected) {
    steps.push({
      key: "rejected",
      label: t("applications.statusRejected", "Rejected"),
      description: t(
        "applications.notSelected",
        "Your application was not selected",
      ),
      state: "failed",
    });
    return steps;
  }
  if (isWithdrawn) {
    steps.push({
      key: "withdrawn",
      label: t("applications.statusWithdrawn", "Withdrawn"),
      description: t(
        "applications.youWithdrew",
        "You withdrew your application",
      ),
      state: "failed",
    });
    return steps;
  }

  // 3. Negotiation (pre-acceptance)
  const negoDesc = negotiationAccepted
    ? t("applications.negotiationAccepted", "Negotiation accepted")
    : negotiationPending
      ? t(
          "applications.rateNegotiationInProgress",
          "Rate negotiation in progress",
        )
      : hasNegotiation
        ? t(
            "applications.rateNegotiationInProgress",
            "Rate negotiation in progress",
          )
        : t("applications.noNegotiationRequested", "No negotiation requested");
  steps.push({
    key: "negotiation",
    label: t("applications.negotiation", "Negotiation"),
    description: negoDesc,
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
    label: t("applications.paymentMade", "Payment Made"),
    description:
      isAccepted || paymentMade
        ? t(
            "applications.employerCompletedPayment",
            "Employer has completed the payment",
          )
        : t("applications.waitingForPayment", "Waiting for employer payment"),
    state:
      isAccepted || paymentMade
        ? "complete"
        : negotiationAccepted
          ? "current"
          : "pending",
  });

  // 5. Accepted
  steps.push({
    key: "accepted",
    label: t("applications.statusAccepted", "Accepted"),
    description: t(
      "applications.employerAccepted",
      "The employer has accepted your application",
    ),
    state: isAccepted ? "complete" : "pending",
  });

  // 6. Service Started
  steps.push({
    key: "started",
    label: t("applications.serviceStarted", "Service Started"),
    description: t(
      "applications.verificationConfirmed",
      "Verification code confirmed, service has begun",
    ),
    timestamp: app.verificationCodeVerifiedAt,
    state: isAccepted ? (serviceStarted ? "complete" : "current") : "pending",
  });

  // 7. Additional Negotiation (conditional)
  if (hasAdditionalNego) {
    steps.push({
      key: "additionalNego",
      label: t("applications.additionalNegotiation", "Additional Negotiation"),
      description: t(
        "applications.additionalAmountsRequested",
        "Additional amounts were requested during the job",
      ),
      state: isAccepted && serviceStarted ? "complete" : "pending",
    });
  }

  // 8. Marked as Done (by the service provider)
  steps.push({
    key: "done",
    label: t("applications.markedAsDone", "Marked as Done"),
    description: t("applications.youMarkedDone", "You marked this job as done"),
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
    label: t("applications.completed", "Completed"),
    description: t(
      "applications.employerConfirmedComplete",
      "The employer has confirmed the job is complete",
    ),
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

/* ------------------------------------------------------------------ */
/*  Timeline component                                                 */
/* ------------------------------------------------------------------ */

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
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`absolute left-0 top-5 w-0.5 ${
                  step.state === "complete"
                    ? "bg-emerald-500/40"
                    : step.state === "failed"
                      ? "bg-red-500/40"
                      : "bg-[var(--border-color)]"
                }`}
                style={{
                  height: "calc(100% - 4px)",
                  transform: "translateX(-50%)",
                }}
              />
            )}

            {/* Dot */}
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

            {/* Content */}
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const appId = params?.id as string;

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Negotiation
  const [showNego, setShowNego] = useState(false);
  const [negoRates, setNegoRates] = useState<
    { rate: string; paymentType: string }[]
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [negoMsg, setNegoMsg] = useState("");
  const [submittingNego, setSubmittingNego] = useState(false);

  // Additional time request
  const [showTimeReqForm, setShowTimeReqForm] = useState(false);
  const [timeReqMsg, setTimeReqMsg] = useState("");
  const [requestingTime, setRequestingTime] = useState(false);
  const [respondingTimeId, setRespondingTimeId] = useState<string | null>(null);
  const [additionalDays, setAdditionalDays] = useState("");
  const [additionalTimeExplanation, setAdditionalTimeExplanation] =
    useState("");
  const [respondingTime, setRespondingTime] = useState(false);

  // Accept/Reject instant job
  const [respondingToRequest, setRespondingToRequest] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Respond to employer negotiation
  const [respondingNegoId, setRespondingNegoId] = useState<string | null>(null);
  const [negoResponseMsg, setNegoResponseMsg] = useState("");
  const [submittingNegoResponse, setSubmittingNegoResponse] = useState(false);

  // Counter-offer to employer negotiation
  const [counterOfferNegoId, setCounterOfferNegoId] = useState<string | null>(
    null,
  );
  const [counterOfferRates, setCounterOfferRates] = useState<
    { rate: string; paymentType: string }[]
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [counterOfferMsg, setCounterOfferMsg] = useState("");
  const [submittingCounterOffer, setSubmittingCounterOffer] = useState(false);

  const fetchApp = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    const res = await api<ApplicationDetail>(`/applications/${appId}`);
    if (res.data) setApp(res.data);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleVerifyCode = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    const res = await api(`/applications/${appId}/verify-code`, {
      method: "POST",
      body: { code: verifyCode.trim() },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Invalid verification code",
        ok: false,
      });
    } else {
      setToast({ msg: "Service started successfully!", ok: true });
      setVerifyCode("");
      fetchApp();
    }
    setVerifying(false);
  };

  const handleMarkDone = async () => {
    setMarkingDone(true);
    const res = await api(`/applications/${appId}/mark-done`, {
      method: "POST",
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string" ? res.error : "Failed to mark as done",
        ok: false,
      });
    } else {
      setToast({ msg: "Job marked as done!", ok: true });
      fetchApp();
    }
    setMarkingDone(false);
  };

  const handleNegotiation = async () => {
    const validRates = negoRates.filter(
      (r) => r.rate && parseFloat(r.rate) > 0,
    );
    if (validRates.length === 0 || !negoMsg.trim()) {
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
      body: { rates, totalAmount, message: negoMsg.trim() },
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
      setShowNego(false);
      setNegoRates([{ rate: "", paymentType: "HOURLY" }]);
      setNegoMsg("");
      fetchApp();
    }
    setSubmittingNego(false);
  };

  const handleRequestAdditionalTime = async () => {
    if (!timeReqMsg.trim()) {
      setToast({ msg: "Please enter a message", ok: false });
      return;
    }
    setRequestingTime(true);
    const res = await api(`/applications/${appId}/additional-time/request`, {
      method: "POST",
      body: { message: timeReqMsg.trim() },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to request additional time",
        ok: false,
      });
    } else {
      setToast({ msg: "Additional time requested!", ok: true });
      setShowTimeReqForm(false);
      setTimeReqMsg("");
      fetchApp();
    }
    setRequestingTime(false);
  };

  const handleRespondToTimeRequest = async (requestId: string) => {
    const days = parseInt(additionalDays, 10);
    if (!days || days < 1) {
      setToast({
        msg: "Please enter the number of additional days",
        ok: false,
      });
      return;
    }
    if (!additionalTimeExplanation.trim()) {
      setToast({ msg: "Please enter an explanation", ok: false });
      return;
    }
    setRespondingTime(true);
    const res = await api(`/applications/${appId}/additional-time/respond`, {
      method: "POST",
      body: {
        requestId,
        additionalDays: days,
        explanation: additionalTimeExplanation.trim(),
      },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to respond to time request",
        ok: false,
      });
    } else {
      setToast({ msg: "Response submitted!", ok: true });
      setRespondingTimeId(null);
      setAdditionalDays("");
      setAdditionalTimeExplanation("");
      fetchApp();
    }
    setRespondingTime(false);
  };

  const handleRespondToCounterOffer = async (
    requestId: string,
    counterOfferId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
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
      fetchApp();
    }
  };

  const handleRespondToInstantJob = async (accept: boolean) => {
    setRespondingToRequest(true);
    const body: Record<string, unknown> = { accept };
    if (!accept && rejectReason.trim()) {
      body.rejectionReason = rejectReason.trim();
    }
    const res = await api(`/applications/${appId}/respond-to-request`, {
      method: "POST",
      body,
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to respond to request",
        ok: false,
      });
    } else {
      setToast({
        msg: accept ? "Job request accepted!" : "Job request rejected",
        ok: true,
      });
      setShowRejectModal(false);
      setRejectReason("");
      fetchApp();
    }
    setRespondingToRequest(false);
  };

  const handleRespondToEmployerNegotiation = async (
    requestId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    setSubmittingNegoResponse(true);
    const res = await api(`/applications/${appId}/negotiation/respond`, {
      method: "POST",
      body: { requestId, status, message: negoResponseMsg.trim() || undefined },
    });
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
      setRespondingNegoId(null);
      setNegoResponseMsg("");
      fetchApp();
    }
    setSubmittingNegoResponse(false);
  };

  const handleSubmitCounterOffer = async (requestId: string) => {
    const validRates = counterOfferRates.filter(
      (r) => r.rate && parseFloat(r.rate) > 0,
    );
    if (validRates.length === 0) {
      setToast({ msg: "Please enter at least one rate", ok: false });
      return;
    }
    setSubmittingCounterOffer(true);
    const rates = validRates.map((r) => ({
      rate: parseFloat(r.rate),
      paymentType: r.paymentType,
    }));
    const totalAmount = rates.reduce((sum, r) => sum + r.rate, 0);
    const res = await api(`/applications/${appId}/negotiation/counter-offer`, {
      method: "POST",
      body: {
        requestId,
        rates,
        totalAmount,
        message: counterOfferMsg.trim() || undefined,
      },
    });
    if (res.error) {
      setToast({
        msg:
          typeof res.error === "string"
            ? res.error
            : "Failed to submit counter offer",
        ok: false,
      });
    } else {
      setToast({ msg: "Counter offer submitted!", ok: true });
      setCounterOfferNegoId(null);
      setCounterOfferRates([{ rate: "", paymentType: "HOURLY" }]);
      setCounterOfferMsg("");
      fetchApp();
    }
    setSubmittingCounterOffer(false);
  };

  /* Loading state */
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
            <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />
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
            {t("applications.applicationNotFound", "Application not found")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-text)]">
            {t(
              "applications.applicationMayHaveBeenRemoved",
              "This application may have been removed.",
            )}
          </p>
          <Link
            href="/dashboard/applications"
            className="mt-6 inline-block rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white"
          >
            {t("applications.backToApplications", "Back to Applications")}
          </Link>
        </div>
      </div>
    );
  }

  const job = app.job;
  const status = app.status.toUpperCase();
  const isRequested = status === "REQUESTED";
  const isAccepted = status === "ACCEPTED";
  const serviceStarted = !!app.verificationCodeVerifiedAt;
  const markedDone = !!app.serviceProviderMarkedDoneAt;
  const completed = !!app.completedAt;
  const jobLocation =
    [job?.location, job?.city, job?.country].filter(Boolean).join(", ") ||
    "Remote";
  const steps = buildTimeline(app, t);

  // Version-based verification for additional services
  const currentCodeVersion = app.verificationCodeVersion ?? 1;
  const verifiedCodeVersion = app.verificationCodeVerifiedVersion ?? 0;
  const hasPendingCodeVersion = !!app.pendingVerificationCodeVersion;
  const hasNewVersionToVerify =
    !hasPendingCodeVersion && currentCodeVersion > verifiedCodeVersion;
  const additionalServicesVerified =
    currentCodeVersion > 1 &&
    verifiedCodeVersion >= currentCodeVersion &&
    app.verificationCodeLastVerifiedAt !== app.verificationCodeVerifiedAt;

  // Payment info helpers
  const selectedRates = Array.isArray(app.selectedRates)
    ? app.selectedRates
    : [];
  const approvedAdditionalRates = Array.isArray(app.additionalRateRequests)
    ? app.additionalRateRequests.filter((r) => r.status === "APPROVED")
    : [];
  const acceptedNegotiations = Array.isArray(app.negotiationRequests)
    ? app.negotiationRequests.filter((r) => r.status === "ACCEPTED")
    : [];
  const paidServices = app.paymentStatus?.paidServices || [];
  const unpaidServices = app.paymentStatus?.unpaidServices || [];
  const paidNegotiations = app.paymentStatus?.paidNegotiations || [];
  const unpaidNegotiations = app.paymentStatus?.unpaidNegotiations || [];
  const paidAmount = app.paymentStatus?.paidAmount || 0;
  const unpaidAmount = app.paymentStatus?.unpaidAmount || 0;
  const hasPaymentInfo =
    selectedRates.length > 0 ||
    approvedAdditionalRates.length > 0 ||
    acceptedNegotiations.length > 0;
  const hasUnpaid =
    unpaidAmount > 0.01 ||
    unpaidServices.length > 0 ||
    unpaidNegotiations.length > 0;

  const rateMatch = (
    s1: { rate: number; paymentType: string; otherSpecification?: string },
    s2: { rate: number; paymentType: string; otherSpecification?: string },
  ) =>
    Math.abs(s1.rate - s2.rate) < 0.01 &&
    s1.paymentType === s2.paymentType &&
    (s1.otherSpecification || "") === (s2.otherSpecification || "");

  // Employer negotiation requests (that the SP can respond to)
  const employerNegotiations = Array.isArray(app.negotiationRequests)
    ? app.negotiationRequests.filter((r) => r.suggestedByRole === "EMPLOYER")
    : [];

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
        {t("applications.backToApplications", "Back to Applications")}
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
              {t("applications.applicationTracker", "Application Tracker")}
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--foreground)] lg:text-2xl">
              {job?.title || t("applications.untitledJob", "Untitled Job")}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-text)]">
              {job?.company?.name && <span>{job.company.name}</span>}
              {jobLocation && (
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
                  {jobLocation}
                </span>
              )}
              <span>
                {t("applications.applied", "Applied")}{" "}
                {fmtDateTime(app.appliedAt)}
              </span>
            </div>
          </div>
          {job?.rateAmount && (
            <div className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] px-5 py-3 text-center">
              <p className="text-2xl font-bold text-[var(--primary)]">
                €{job.rateAmount}
              </p>
              {job.paymentType && (
                <p className="mt-0.5 text-xs font-medium text-[var(--muted-text)]">
                  {t(`jobs.perPaymentType.${job.paymentType.toLowerCase()}`, `per ${formatLabel(job.paymentType).toLowerCase()}`)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Accept/Reject Instant Job Request */}
      {isRequested && (
        <div className="rounded-2xl border-2 border-blue-500/40 bg-blue-500/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
              <svg
                className="h-5 w-5 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                {t("applications.newJobRequest", "New Job Request")}
              </h2>
              <p className="text-xs text-[var(--muted-text)]">
                {t(
                  "applications.instantJobRequestDesc",
                  "An employer has sent you an instant job request. Review the details and accept or reject.",
                )}
              </p>
            </div>
          </div>

          {/* What happens after accepting */}
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {t(
                "applications.acceptInfo",
                "After accepting, the employer will select services and make payment. You'll receive a verification code to start the job.",
              )}
            </p>
          </div>

          {/* Proposed rates */}
          {selectedRates.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                {t("applications.proposedPayment", "Proposed Payment")}
              </p>
              <div className="space-y-2">
                {selectedRates.map((rate, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        €{rate.rate.toFixed(2)} /{" "}
                        {t(`jobs.perPaymentType.${rate.paymentType.toLowerCase()}`, formatLabel(rate.paymentType).toLowerCase())}
                      </p>
                      {rate.description && (
                        <p className="text-xs text-[var(--muted-text)]">
                          {rate.description}
                        </p>
                      )}
                    </div>
                    {rate.isCustom && (
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-500">
                        {t("applications.custom", "Custom")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={respondingToRequest}
              className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {t("applications.reject", "Reject")}
            </button>
            <button
              onClick={() => handleRespondToInstantJob(true)}
              disabled={respondingToRequest}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {respondingToRequest
                ? t("common.submitting", "Submitting...")
                : t("common.accept", "Accept")}
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {t("applications.rejectRequest", "Reject Request")}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              {t(
                "applications.rejectReasonPrompt",
                "Please provide a reason for rejecting this job request.",
              )}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t(
                "applications.enterRejectReason",
                "Enter your reason...",
              )}
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1 rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--muted-text)]"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                onClick={() => handleRespondToInstantJob(false)}
                disabled={respondingToRequest || !rejectReason.trim()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {respondingToRequest
                  ? t("common.submitting", "Submitting...")
                  : t("applications.confirmReject", "Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {t("applications.trackingTimeline", "Tracking Timeline")}
                </h2>
                <p className="text-xs text-[var(--muted-text)]">
                  {t(
                    "applications.followProgress",
                    "Follow your application progress step by step",
                  )}
                </p>
              </div>
            </div>
            <TrackingTimeline steps={steps} />
          </section>

          {/* Job details */}
          {job?.description && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("applications.jobDescription", "Job Description")}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted-text)]">
                {job.description}
              </p>
            </section>
          )}

          {/* Schedule info */}
          {job?.startDate && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                {t("applications.schedule", "Schedule")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                    {t("applications.startDate", "Start Date")}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                    {fmtDate(job.startDate)}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Negotiation history */}
          {app.negotiationRequests && app.negotiationRequests.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {t("applications.negotiationHistory", "Negotiation History")}
              </h2>
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.allNegotiationRequests",
                  "All negotiation requests for this application",
                )}
              </p>
              <div className="space-y-3">
                {app.negotiationRequests.map((nr, i) => {
                  const isAccepted = nr.status === "ACCEPTED";
                  const isRejected = nr.status === "REJECTED";
                  const hasCounterOffer =
                    nr.status === "COUNTER_OFFERED" && nr.counterOffer;
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
                            ? t("applications.yourRequest", "Your request")
                            : t(
                                "applications.employerSuggestion",
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
                            ? t("applications.accepted", "Accepted")
                            : isRejected
                              ? t("applications.rejected", "Rejected")
                              : hasCounterOffer
                                ? t(
                                    "applications.counterOffer",
                                    "Counter Offer",
                                  )
                                : t("applications.pending", "Pending")}
                        </span>
                      </div>

                      {nr.rates && nr.rates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {nr.rates.map((r, j) => (
                            <span
                              key={j}
                              className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                            >
                              €{r.rate} /{" "}
                              {t(`jobs.perPaymentType.${r.paymentType.toLowerCase()}`, formatLabel(r.paymentType).toLowerCase())}
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
                            {isFromMe
                              ? t(
                                  "applications.yourExplanation",
                                  "Your explanation",
                                )
                              : t(
                                  "applications.employerMessage",
                                  "Employer message",
                                )}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
                            {nr.message}
                          </p>
                        </div>
                      )}

                      {nr.responseMessage && !hasCounterOffer && (
                        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-[var(--muted-text)]">
                            {t(
                              "applications.employersResponse",
                              "Employer response",
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
                            {nr.responseMessage}
                          </p>
                        </div>
                      )}

                      {hasCounterOffer && nr.counterOffer && (
                        <div className="mt-3 rounded-lg border-l-2 border-[var(--fulfillment-gold)] bg-[var(--fulfillment-gold)]/5 px-3 py-2.5">
                          <p className="text-[10px] font-bold text-[var(--fulfillment-gold)]">
                            {t(
                              "applications.employersCounterOffer",
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
                                    {t(`jobs.perPaymentType.${r.paymentType.toLowerCase()}`, formatLabel(r.paymentType).toLowerCase())}
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
                                {t("applications.reject", "Reject")}
                              </button>
                            </div>
                          )}
                          {nr.counterOffer.status === "ACCEPTED" && (
                            <p className="mt-2 text-xs font-bold text-emerald-400">
                              {t(
                                "applications.counterOfferAccepted",
                                "Counter offer accepted",
                              )}
                            </p>
                          )}
                          {nr.counterOffer.status === "REJECTED" && (
                            <p className="mt-2 text-xs font-bold text-red-400">
                              {t(
                                "applications.counterOfferRejectedTitle",
                                "Counter offer rejected",
                              )}
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
                })}
              </div>
            </section>
          )}

          {/* Payment info — detailed per-service coloring */}
          {hasPaymentInfo && status !== "REQUESTED" && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {t("applications.paymentInformation", "Payment Information")}
              </h2>
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.servicesSelectedByEmployer",
                  "Services selected by employer",
                )}
              </p>

              {/* Unpaid warning banner */}
              {hasUnpaid && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t(
                      "applications.unpaidServicesWarning",
                      "Some services have not been paid for yet. The employer needs to complete payment for all selected services.",
                    )}
                  </p>
                </div>
              )}

              {/* Selected services */}
              {selectedRates.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                    {t("applications.selectedServices", "Selected Services")}
                  </p>
                  <div className="space-y-1.5">
                    {selectedRates.map((rate, idx) => {
                      const isPaid = paidServices.some((s: any) =>
                        rateMatch(s, rate),
                      );
                      const isUnpaid = unpaidServices.some((s: any) =>
                        rateMatch(s, rate),
                      );
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 ${isPaid ? "bg-emerald-500/5 border border-emerald-500/20" : isUnpaid ? "bg-amber-500/5 border border-amber-500/20" : "bg-[var(--surface-alt)] border border-[var(--border-color)]"}`}
                        >
                          <div>
                            <p
                              className={`text-sm font-medium ${isPaid ? "text-emerald-500" : isUnpaid ? "text-amber-500" : "text-[var(--foreground)]"}`}
                            >
                              €{rate.rate.toFixed(2)} /{" "}
                              {t(`jobs.perPaymentType.${rate.paymentType.toLowerCase()}`, formatLabel(rate.paymentType).toLowerCase())}
                            </p>
                            {(rate.description || rate.otherSpecification) && (
                              <p className="text-[10px] text-[var(--muted-text)]">
                                {rate.description || rate.otherSpecification}
                              </p>
                            )}
                          </div>
                          {isPaid && (
                            <span className="text-[10px] font-bold text-emerald-500">
                              ✓ {t("applications.paid", "Paid")}
                            </span>
                          )}
                          {isUnpaid && (
                            <span className="text-[10px] font-bold text-amber-500">
                              ({t("applications.unpaid", "Unpaid")})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Approved additional rates */}
              {approvedAdditionalRates.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                    {t(
                      "applications.approvedAdditionalRates",
                      "Approved Additional Rates",
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {approvedAdditionalRates.flatMap((ar) =>
                      (ar.rates || []).map((rate, idx) => {
                        const isPaid = paidServices.some((s: any) =>
                          rateMatch(s, rate),
                        );
                        const isUnpaid = unpaidServices.some((s: any) =>
                          rateMatch(s, rate),
                        );
                        return (
                          <div
                            key={`ar-${ar.id}-${idx}`}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 ${isPaid ? "bg-emerald-500/5 border border-emerald-500/20" : isUnpaid ? "bg-amber-500/5 border border-amber-500/20" : "bg-[var(--surface-alt)] border border-[var(--border-color)]"}`}
                          >
                            <p
                              className={`text-sm font-medium ${isPaid ? "text-emerald-500" : isUnpaid ? "text-amber-500" : "text-[var(--foreground)]"}`}
                            >
                              €{rate.rate.toFixed(2)} /{" "}
                              {t(`jobs.perPaymentType.${rate.paymentType.toLowerCase()}`, formatLabel(rate.paymentType).toLowerCase())}{" "}
                              <span className="text-[10px]">
                                ({t("applications.approved", "Approved")})
                              </span>
                            </p>
                            {isPaid && (
                              <span className="text-[10px] font-bold text-emerald-500">
                                ✓ {t("applications.paid", "Paid")}
                              </span>
                            )}
                            {isUnpaid && (
                              <span className="text-[10px] font-bold text-amber-500">
                                ({t("applications.unpaid", "Unpaid")})
                              </span>
                            )}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              )}

              {/* Accepted negotiation rates */}
              {acceptedNegotiations.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                    {t(
                      "applications.acceptedNegotiations",
                      "Accepted Negotiations",
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {acceptedNegotiations.flatMap((nego) =>
                      (nego.rates || []).map((rate, idx) => {
                        const isPaid = paidNegotiations.some(
                          (s: any) => s.id === nego.id || rateMatch(s, rate),
                        );
                        const isUnpaid = unpaidNegotiations.some(
                          (s: any) => s.id === nego.id || rateMatch(s, rate),
                        );
                        return (
                          <div
                            key={`nego-${nego.id}-${idx}`}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 ${isPaid ? "bg-emerald-500/5 border border-emerald-500/20" : isUnpaid ? "bg-amber-500/5 border border-amber-500/20" : "bg-[var(--surface-alt)] border border-[var(--border-color)]"}`}
                          >
                            <p
                              className={`text-sm font-medium ${isPaid ? "text-emerald-500" : isUnpaid ? "text-amber-500" : "text-[var(--foreground)]"}`}
                            >
                              €{rate.rate.toFixed(2)} /{" "}
                              {t(`jobs.perPaymentType.${rate.paymentType.toLowerCase()}`, formatLabel(rate.paymentType).toLowerCase())}{" "}
                              <span className="text-[10px]">
                                (
                                {t(
                                  "applications.negotiationAccepted",
                                  "Negotiation Accepted",
                                )}
                                )
                              </span>
                            </p>
                            {isPaid && (
                              <span className="text-[10px] font-bold text-emerald-500">
                                ✓ {t("applications.paid", "Paid")}
                              </span>
                            )}
                            {isUnpaid && (
                              <span className="text-[10px] font-bold text-amber-500">
                                ({t("applications.unpaid", "Unpaid")})
                              </span>
                            )}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              )}

              {/* Total amounts */}
              <div className="mt-4 space-y-2 border-t border-[var(--border-color)] pt-3">
                {paidAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-500">
                      {t("applications.paidAmount", "Paid Amount")}
                    </span>
                    <span className="text-sm font-bold text-emerald-500">
                      €{paidAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {unpaidAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-500">
                      {t("applications.unpaidAmount", "Unpaid Amount")}
                    </span>
                    <span className="text-sm font-bold text-amber-500">
                      €{unpaidAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    {t("applications.total", "Total")}
                  </span>
                  <span className="text-sm font-bold text-emerald-500">
                    €{(paidAmount + unpaidAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Employer Negotiation Suggestions — SP can respond */}
          {employerNegotiations.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {t(
                  "applications.employerNegotiations",
                  "Employer Negotiation Suggestions",
                )}
              </h2>
              <p className="mb-4 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.employerNegotiationsDesc",
                  "The employer has proposed rate changes for your review",
                )}
              </p>
              <div className="space-y-3">
                {employerNegotiations.map((nr, i) => {
                  const nrAccepted = nr.status === "ACCEPTED";
                  const nrRejected = nr.status === "REJECTED";
                  const nrPending = nr.status === "PENDING";
                  const hasCounterOffer =
                    nr.status === "COUNTER_OFFERED" && nr.counterOffer;

                  return (
                    <div
                      key={`emp-nego-${i}`}
                      className={`rounded-xl border p-4 ${nrAccepted ? "border-emerald-500/30 bg-emerald-500/5" : nrRejected ? "border-red-500/30 bg-red-500/5" : hasCounterOffer ? "border-[#C9963F]/30 bg-[#C9963F]/5" : "border-blue-500/30 bg-blue-500/5"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          {t(
                            "applications.employerSuggestion",
                            "Employer suggestion",
                          )}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${nrAccepted ? "bg-emerald-500/15 text-emerald-400" : nrRejected ? "bg-red-500/15 text-red-400" : hasCounterOffer ? "bg-[#C9963F]/15 text-[#C9963F]" : "bg-blue-500/15 text-blue-400"}`}
                        >
                          {nrAccepted
                            ? t("applications.accepted", "Accepted")
                            : nrRejected
                              ? t("applications.rejected", "Rejected")
                              : hasCounterOffer
                                ? t(
                                    "applications.counterOffer",
                                    "Counter Offer",
                                  )
                                : t("applications.pending", "Pending")}
                        </span>
                      </div>

                      {nr.rates && nr.rates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {nr.rates.map((r, j) => (
                            <span
                              key={j}
                              className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                            >
                              €{r.rate} /{" "}
                              {t(`jobs.perPaymentType.${r.paymentType.toLowerCase()}`, formatLabel(r.paymentType).toLowerCase())}
                            </span>
                          ))}
                        </div>
                      )}
                      {typeof nr.totalAmount === "number" && (
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          Total: €{nr.totalAmount.toFixed(2)}
                        </p>
                      )}
                      {nr.message && (
                        <div className="mt-2 rounded-lg bg-[var(--surface)]/60 px-3 py-2">
                          <p className="text-[10px] font-medium text-[var(--muted-text)]">
                            {t(
                              "applications.employerMessage",
                              "Employer message",
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--foreground)]/80">
                            {nr.message}
                          </p>
                        </div>
                      )}

                      {/* Pending — Accept/Reject/Counter buttons */}
                      {nrPending && (
                        <div className="mt-3">
                          {respondingNegoId === nr.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={negoResponseMsg}
                                onChange={(e) =>
                                  setNegoResponseMsg(e.target.value)
                                }
                                placeholder={t(
                                  "applications.optionalResponseMessage",
                                  "Optional response message...",
                                )}
                                rows={2}
                                className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleRespondToEmployerNegotiation(
                                      nr.id!,
                                      "ACCEPTED",
                                    )
                                  }
                                  disabled={submittingNegoResponse}
                                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {t("common.accept", "Accept")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRespondToEmployerNegotiation(
                                      nr.id!,
                                      "REJECTED",
                                    )
                                  }
                                  disabled={submittingNegoResponse}
                                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                                >
                                  {t("applications.reject", "Reject")}
                                </button>
                                <button
                                  onClick={() => {
                                    setRespondingNegoId(null);
                                    setNegoResponseMsg("");
                                  }}
                                  className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--muted-text)]"
                                >
                                  {t("common.cancel", "Cancel")}
                                </button>
                              </div>
                            </div>
                          ) : counterOfferNegoId === nr.id ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#C9963F]">
                                {t(
                                  "applications.yourCounterOffer",
                                  "Your Counter Offer",
                                )}
                              </p>
                              {counterOfferRates.map((r, ri) => (
                                <div
                                  key={ri}
                                  className="flex items-center gap-2"
                                >
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
                                        setCounterOfferRates((prev) =>
                                          prev.map((x, j) =>
                                            j === ri
                                              ? { ...x, rate: e.target.value }
                                              : x,
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
                                      setCounterOfferRates((prev) =>
                                        prev.map((x, j) =>
                                          j === ri
                                            ? { ...x, paymentType: v }
                                            : x,
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
                                  {counterOfferRates.length > 1 && (
                                    <button
                                      onClick={() =>
                                        setCounterOfferRates((prev) =>
                                          prev.filter((_, j) => j !== ri),
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
                                  setCounterOfferRates((prev) => [
                                    ...prev,
                                    { rate: "", paymentType: "HOURLY" },
                                  ])
                                }
                                className="text-xs font-medium text-[var(--primary)]"
                              >
                                + {t("applications.addRate", "Add rate")}
                              </button>
                              <textarea
                                value={counterOfferMsg}
                                onChange={(e) =>
                                  setCounterOfferMsg(e.target.value)
                                }
                                placeholder={t(
                                  "applications.explainCounterOffer",
                                  "Explain your counter offer...",
                                )}
                                rows={2}
                                className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleSubmitCounterOffer(nr.id!)
                                  }
                                  disabled={submittingCounterOffer}
                                  className="flex-1 rounded-lg bg-[#C9963F] py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  {submittingCounterOffer
                                    ? t("common.submitting", "Submitting...")
                                    : t(
                                        "applications.submitCounterOffer",
                                        "Submit Counter Offer",
                                      )}
                                </button>
                                <button
                                  onClick={() => {
                                    setCounterOfferNegoId(null);
                                    setCounterOfferRates([
                                      { rate: "", paymentType: "HOURLY" },
                                    ]);
                                    setCounterOfferMsg("");
                                  }}
                                  className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--muted-text)]"
                                >
                                  {t("common.cancel", "Cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setRespondingNegoId(nr.id!)}
                                className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                              >
                                {t(
                                  "applications.respondAcceptReject",
                                  "Accept / Reject",
                                )}
                              </button>
                              <button
                                onClick={() => setCounterOfferNegoId(nr.id!)}
                                className="flex-1 rounded-lg bg-[#C9963F] py-2 text-xs font-semibold text-white hover:opacity-90"
                              >
                                {t(
                                  "applications.proposeCounterOffer",
                                  "Counter Offer",
                                )}
                              </button>
                            </div>
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
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Pending status info — SP accepted instant request, waiting for employer */}
          {status === "PENDING" && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="h-5 w-5 text-blue-500"
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
                <p className="text-sm font-semibold text-blue-500">
                  {t(
                    "applications.awaitingEmployerDecision",
                    "Awaiting Employer Decision",
                  )}
                </p>
              </div>
              <p className="text-xs text-[var(--muted-text)]">
                {t(
                  "applications.pendingStatusDescription",
                  "Your application is under review. You can request a rate negotiation while waiting for the employer to select services and make payment.",
                )}
              </p>
            </div>
          )}

          {/* Quick actions — Start Service (initial verification) */}
          {isAccepted && !serviceStarted && (
            <div className="rounded-2xl border border-[#C9963F]/30 bg-[#C9963F]/5 p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t("applications.startService", "Start Service")}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.enterVerificationCodeDescription",
                  "Enter the verification code provided by the employer to start working",
                )}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder={t("applications.enterCode", "Enter code")}
                  maxLength={6}
                  className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] text-[var(--foreground)] placeholder:text-[var(--muted-text)]/40 focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying || !verifyCode.trim()}
                  className="rounded-lg bg-[#C9963F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {verifying ? "..." : t("common.verify", "Verify")}
                </button>
              </div>
            </div>
          )}

          {/* Service Started confirmation */}
          {isAccepted &&
            serviceStarted &&
            !hasPendingCodeVersion &&
            !hasNewVersionToVerify &&
            !additionalServicesVerified && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-emerald-400"
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
                  <p className="text-sm font-semibold text-emerald-400">
                    {t("applications.serviceStarted", "Service Started")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  {t("applications.serviceStartedOn", "Service started on")}{" "}
                  {fmtDateTime(app.verificationCodeVerifiedAt)}
                </p>
              </div>
            )}

          {/* Additional Services — Pending (employer has pending verification) */}
          {isAccepted && serviceStarted && hasPendingCodeVersion && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-amber-500"
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
                <p className="text-sm font-semibold text-amber-500">
                  {t(
                    "applications.additionalServicesPending",
                    "Additional Services Pending",
                  )}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.additionalServicesPendingDesc",
                  "The employer has pending verification for additional services. Please wait for them to confirm.",
                )}
              </p>
            </div>
          )}

          {/* Additional Services — New code to verify */}
          {isAccepted && serviceStarted && hasNewVersionToVerify && (
            <div className="rounded-2xl border border-[#C9963F]/30 bg-[#C9963F]/5 p-5">
              <h3 className="text-sm font-semibold text-[#C9963F]">
                {t(
                  "applications.startAdditionalServices",
                  "Start Additional Services",
                )}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.enterNewVerificationCode",
                  "The employer has added new services. Enter the new verification code to start additional work.",
                )}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder={t("applications.enterCode", "Enter code")}
                  maxLength={6}
                  className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] text-[var(--foreground)] placeholder:text-[var(--muted-text)]/40 focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying || !verifyCode.trim()}
                  className="rounded-lg bg-[#C9963F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {verifying ? "..." : t("common.verify", "Verify")}
                </button>
              </div>
            </div>
          )}

          {/* Additional Services — Verified */}
          {isAccepted && serviceStarted && additionalServicesVerified && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-emerald-400"
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
                <p className="text-sm font-semibold text-emerald-400">
                  {t(
                    "applications.additionalServicesStarted",
                    "Additional Services Started",
                  )}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.additionalServicesConfirmed",
                  "Additional services verified on",
                )}{" "}
                {fmtDateTime(app.verificationCodeLastVerifiedAt)}
              </p>
            </div>
          )}

          {/* Mark as done */}
          {isAccepted && serviceStarted && !markedDone && !completed && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t("applications.markAsDone", "Mark as Done")}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.markAsDoneDescription",
                  "Once you have completed the work, mark this job as done",
                )}
              </p>
              <button
                onClick={handleMarkDone}
                disabled={markingDone}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {markingDone
                  ? t("common.submitting", "Submitting...")
                  : t("applications.markJobAsDone", "Mark Job as Done")}
              </button>
            </div>
          )}

          {/* Marked done confirmation */}
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
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-[var(--fulfillment-gold)]">
                  {t("applications.waitingForEmployer", "Waiting for employer")}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "applications.markedAsDoneOn",
                  "You marked this job as done on",
                )}{" "}
                {fmtDateTime(app.serviceProviderMarkedDoneAt)}
                {". "}
                {t(
                  "applications.waitingForEmployerToConfirm",
                  "Waiting for the employer to confirm completion.",
                )}
              </p>
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
                  {t("applications.jobCompleted", "Job Completed")}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t("applications.completedOn", "Completed on")}{" "}
                {fmtDateTime(app.completedAt)}
              </p>
            </div>
          )}

          {/* Additional Time Requests */}
          {isAccepted &&
            serviceStarted &&
            !completed &&
            (() => {
              const timeReqs = Array.isArray(app.additionalTimeRequests)
                ? app.additionalTimeRequests
                : [];
              return (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {t("applications.additionalTime", "Additional Time")}
                  </h3>

                  {/* Existing requests */}
                  {timeReqs.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {timeReqs.map((tr) => (
                        <div
                          key={tr.id}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                              {tr.requestedBy === "EMPLOYER"
                                ? t(
                                    "applications.employerRequest",
                                    "Employer request",
                                  )
                                : t("applications.yourRequest", "Your request")}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                tr.status === "ACCEPTED"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : tr.status === "REJECTED"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {t(`applications.extensionStatus.${tr.status.toLowerCase()}`, formatLabel(tr.status))}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--foreground)]">
                            {tr.message}
                          </p>
                          {tr.additionalDays && (
                            <p className="mt-1 text-xs text-[var(--primary)]">
                              +{tr.additionalDays} day
                              {tr.additionalDays > 1 ? "s" : ""}
                            </p>
                          )}
                          {tr.explanation && (
                            <p className="mt-1 text-xs text-[var(--muted-text)]">
                              {tr.explanation}
                            </p>
                          )}
                          {tr.employerResponseMessage && (
                            <p className="mt-1 text-xs italic text-[var(--muted-text)]">
                              Employer: {tr.employerResponseMessage}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-[var(--muted-text)]">
                            {fmtDateTime(tr.requestedAt)}
                          </p>

                          {/* SP respond to employer's PENDING request */}
                          {tr.requestedBy === "EMPLOYER" &&
                            tr.status === "PENDING" &&
                            (respondingTimeId === tr.id ? (
                              <div className="mt-3 space-y-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={additionalDays}
                                  onChange={(e) =>
                                    setAdditionalDays(e.target.value)
                                  }
                                  placeholder={t(
                                    "applications.additionalDays",
                                    "Additional days",
                                  )}
                                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                                />
                                <textarea
                                  value={additionalTimeExplanation}
                                  onChange={(e) =>
                                    setAdditionalTimeExplanation(e.target.value)
                                  }
                                  placeholder={t(
                                    "applications.explainTimeEstimate",
                                    "Explain your time estimate...",
                                  )}
                                  rows={2}
                                  className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleRespondToTimeRequest(tr.id)
                                    }
                                    disabled={respondingTime}
                                    className="flex-1 rounded-lg bg-[var(--primary)] py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--soft-blue)] disabled:opacity-50"
                                  >
                                    {respondingTime
                                      ? t("common.submitting", "Submitting...")
                                      : t(
                                          "applications.submitResponse",
                                          "Submit Response",
                                        )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRespondingTimeId(null);
                                      setAdditionalDays("");
                                      setAdditionalTimeExplanation("");
                                    }}
                                    className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--muted-text)]"
                                  >
                                    {t("common.cancel", "Cancel")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRespondingTimeId(tr.id)}
                                className="mt-2 w-full rounded-lg bg-[var(--primary)] py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--soft-blue)]"
                              >
                                {t(
                                  "applications.respondWithTimeEstimate",
                                  "Respond with Time Estimate",
                                )}
                              </button>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Request additional time form */}
                  {showTimeReqForm ? (
                    <div className="mt-3">
                      <textarea
                        value={timeReqMsg}
                        onChange={(e) => setTimeReqMsg(e.target.value)}
                        placeholder={t(
                          "applications.whyNeedAdditionalTime",
                          "Why do you need additional time?",
                        )}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:border-[var(--primary)] focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleRequestAdditionalTime}
                          disabled={requestingTime}
                          className="flex-1 rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--soft-blue)] disabled:opacity-50"
                        >
                          {requestingTime
                            ? t("common.requesting", "Requesting...")
                            : t("applications.submitRequest", "Submit Request")}
                        </button>
                        <button
                          onClick={() => {
                            setShowTimeReqForm(false);
                            setTimeReqMsg("");
                          }}
                          className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)]"
                        >
                          {t("common.cancel", "Cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowTimeReqForm(true)}
                      className="mt-3 w-full rounded-xl border border-[var(--primary)]/30 py-2.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/5"
                    >
                      {t(
                        "applications.requestAdditionalTime",
                        "Request Additional Time",
                      )}
                    </button>
                  )}
                </div>
              );
            })()}

          {/* Request Negotiation */}
          {(isAccepted || status === "PENDING" || isRequested) &&
            !completed && (
              <div className="rounded-2xl border border-[var(--fulfillment-gold)]/30 bg-[var(--fulfillment-gold)]/5 p-5">
                {showNego ? (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {t(
                        "applications.requestNegotiation",
                        "Request Negotiation",
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted-text)]">
                      {t(
                        "applications.proposeDifferentRate",
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
                            {
                              value: "HOURLY",
                              label: t("applications.hourly", "Hourly"),
                            },
                            {
                              value: "DAILY",
                              label: t("applications.daily", "Daily"),
                            },
                            {
                              value: "WEEKLY",
                              label: t("applications.weekly", "Weekly"),
                            },
                            {
                              value: "MONTHLY",
                              label: t("applications.monthly", "Monthly"),
                            },
                            {
                              value: "FIXED",
                              label: t("applications.fixed", "Fixed"),
                            },
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
                      {t("applications.addRate", "+ Add rate")}
                    </button>
                    <textarea
                      value={negoMsg}
                      onChange={(e) => setNegoMsg(e.target.value)}
                      placeholder={t(
                        "applications.explainProposedRate",
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
                          ? t("common.submitting", "Submitting...")
                          : t("applications.submitRequest", "Submit Request")}
                      </button>
                      <button
                        onClick={() => setShowNego(false)}
                        className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--muted-text)] hover:bg-[var(--surface-alt)]"
                      >
                        {t("common.cancel", "Cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNego(true)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fulfillment-gold)]/20">
                      <span className="text-base font-bold text-[var(--fulfillment-gold)]">
                        €
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--fulfillment-gold)]">
                        {t(
                          "applications.requestNegotiation",
                          "Request negotiation",
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                        {t(
                          "applications.proposeDifferentRateShort",
                          "Propose a different rate",
                        )}
                      </p>
                    </div>
                  </button>
                )}
              </div>
            )}

          {/* View job link */}
          {job?.id && (
            <Link
              href={`/dashboard/jobs/${job.id}`}
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
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              {t("applications.viewJobPosting", "View Job Posting")}
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
