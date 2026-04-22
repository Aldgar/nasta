"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

interface EarningsDashboard {
  pendingHolds: number;
  capturedTotal: number;
  estimatedNet: number;
  recent: {
    id: string;
    status: string;
    holdAmount?: number;
    capturedAmount?: number;
    createdAt?: string;
  }[];
}

interface BookingReceipt {
  id: string;
  title?: string;
  status: string;
  capturedAmount: number;
  capturedAt?: string;
  finalAmount?: number;
  currency?: string;
  agreedCurrency?: string;
  startTime?: string;
  endTime?: string;
  agreedPayUnit?: string;
  agreedRateAmount?: number;
  stripeTransferId?: string;
  payoutStatus?: string;
  payoutDate?: string;
  job?: { id: string; title: string; category?: string };
  employer?: {
    id: string;
    firstName: string;
    lastName: string;
    city?: string;
    country?: string;
  };
  applicationId?: string;
}

function formatCents(
  cents: number,
  currency = "EUR",
  locale = "en-IE",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}

function formatDate(iso?: string, locale = "en-IE"): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(
  iso?: string,
  locale = "en-IE",
  atLabel = "at",
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    ` ${atLabel} ` +
    d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
  );
}

function PayoutBadge({ status }: { status?: string }) {
  const { t } = useLanguage();
  if (!status)
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--muted-text)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-text)]">
        N/A
      </span>
    );
  const s = status.toUpperCase();
  if (s === "PAID" || s === "COMPLETED")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--achievement-green)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--achievement-green)]">
        {t("payments.status.paid", "PAID")}
      </span>
    );
  if (s === "PENDING" || s === "IN_TRANSIT")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--fulfillment-gold)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--fulfillment-gold)]">
        {t("payments.status.pending", "PENDING")}
      </span>
    );
  if (s === "FAILED")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--alert-red)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--alert-red)]">
        {t("payments.status.failed", "FAILED")}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--muted-text)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-text)]">
      {t(`payments.status.${status.toLowerCase()}`, status)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "CAPTURED")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--achievement-green)]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--achievement-green)]">
        {t("payments.status.completed", "COMPLETED")}
      </span>
    );
  if (s === "ACTIVE" || s === "IN_PROGRESS")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--soft-blue)]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--soft-blue)]">
        {t("payments.status.active", "ACTIVE")}
      </span>
    );
  if (s === "CANCELLED" || s === "CANCELED")
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--alert-red)]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--alert-red)]">
        {t("payments.status.cancelled", "CANCELLED")}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--muted-text)]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--muted-text)]">
      {t(`payments.status.${status.toLowerCase()}`, status)}
    </span>
  );
}

export default function PaymentsPage() {
  const [dashboard, setDashboard] = useState<EarningsDashboard | null>(null);
  const [receipts, setReceipts] = useState<BookingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<BookingReceipt | null>(
    null,
  );
  const { t, language } = useLanguage();
  const locale = language === "pt" ? "pt-PT" : "en-IE";
  const atLabel = t("common.at", "at");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dashRes, bookingsRes] = await Promise.all([
      api<EarningsDashboard>("/payments/dashboard/job-seeker"),
      api<BookingReceipt[]>("/bookings/seeker/me?pageSize=100"),
    ]);
    if (dashRes.data) setDashboard(dashRes.data);
    if (bookingsRes.data && Array.isArray(bookingsRes.data)) {
      const paid = bookingsRes.data
        .filter((b) => (b.capturedAmount ?? 0) > 0)
        .sort((a, b) => {
          const da = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
          const db = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
          return db - da;
        });
      setReceipts(paid);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const syncPayouts = async () => {
    setSyncing(true);
    await api("/payments/bookings/sync-my-bookings", { method: "POST" });
    await api("/payments/sync-my-payouts", { method: "POST" });
    await fetchData();
    setSyncing(false);
  };

  const totalEarnings = receipts.reduce(
    (sum, r) => sum + (r.capturedAmount || 0),
    0,
  );
  const currency =
    receipts[0]?.currency || receipts[0]?.agreedCurrency || "EUR";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-alt)]" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-[var(--surface-alt)]"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-alt)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
            {t("payments.totalEarnings", "Earnings")}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
            {t("payments.paymentsTitle", "Payments")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {t(
              "payments.trackEarnings",
              "Track your earnings and payout status.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncPayouts}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            {syncing
              ? t("payments.syncing", "Syncing...")
              : t("payments.syncPayouts", "Sync Payouts")}
          </button>
          <Link
            href="/dashboard/settings"
            onClick={() => {
              if (typeof window !== "undefined")
                setTimeout(
                  () =>
                    document
                      .querySelector<HTMLButtonElement>(
                        '[data-section="payment"]',
                      )
                      ?.click(),
                  100,
                );
            }}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)]"
          >
            {t("settings.payoutSettings", "Payout Settings")}
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-text)]">
            {t("payments.totalEarnings", "Total Earnings")}
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {formatCents(totalEarnings, currency, locale)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-text)]">
            {receipts.length}{" "}
            {receipts.length === 1
              ? t("payments.receipt", "receipt")
              : t("payments.receipts", "receipts")}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-text)]">
            {t("payments.pendingHolds", "Pending Holds")}
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--fulfillment-gold)]">
            {formatCents(dashboard?.pendingHolds ?? 0, currency, locale)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-text)]">
            {t("payments.awaitingJobCompletion", "Awaiting job completion")}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-text)]">
            {t("payments.estimatedNet", "Estimated Net")}
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--achievement-green)]">
            {formatCents(dashboard?.estimatedNet ?? 0, currency, locale)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-text)]">
            {t("payments.afterPlatformFees", "After platform fees")}
          </p>
        </div>
      </div>

      {/* Receipts list */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t("payments.receipts", "Receipts")}
          </h2>
        </div>

        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted-text)]/10">
              <svg
                className="h-7 w-7 text-[var(--muted-text)]"
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
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              {t("payments.noReceiptsYet", "No receipts yet")}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-text)]">
              {t(
                "payments.receiptsWillAppearHere",
                "Completed jobs will appear here with payment details.",
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {receipts.map((r) => {
              const receiptId = `#${r.id.slice(-6).toUpperCase()}`;
              const jobTitle =
                r.job?.title || r.title || t("payments.service", "Service");
              const employerName = r.employer
                ? `${r.employer.firstName} ${r.employer.lastName}`
                : "-";
              const employerLocation = [r.employer?.city, r.employer?.country]
                .filter(Boolean)
                .join(", ");
              const cur = r.currency || r.agreedCurrency || "EUR";

              return (
                <button
                  key={r.id}
                  onClick={() =>
                    setSelectedReceipt(selectedReceipt?.id === r.id ? null : r)
                  }
                  className="w-full px-5 py-4 text-left transition-colors hover:bg-[var(--surface-alt)]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10">
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
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--muted-text)]">
                            {t("payments.receipt", "Receipt")} {receiptId}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">
                          {jobTitle}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[var(--foreground)]">
                        {formatCents(r.capturedAmount, cur, locale)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted-text)]">
                        {formatDate(r.capturedAt, locale)}
                      </p>
                    </div>
                  </div>

                  {/* Expanded receipt detail */}
                  {selectedReceipt?.id === r.id && (
                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 text-left sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("payments.service", "Service")}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                          {jobTitle}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("common.employer", "Employer")}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
                          {employerName}
                        </p>
                        {employerLocation && (
                          <p className="text-xs text-[var(--muted-text)]">
                            {employerLocation}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("payments.amountReceived", "Amount Received")}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-[var(--foreground)]">
                          {formatCents(r.capturedAmount, cur, locale)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("payments.servicePeriod", "Service Period")}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--foreground)]">
                          {r.startTime && r.endTime
                            ? `${formatDateTime(r.startTime, locale, atLabel)} - ${formatDateTime(r.endTime, locale, atLabel)}`
                            : formatDate(r.capturedAt, locale)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("payments.paymentDate", "Payment Date")}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--foreground)]">
                          {formatDateTime(r.capturedAt, locale, atLabel)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                          {t("payments.payoutStatus", "Payout Status")}
                        </p>
                        <div className="mt-1">
                          <PayoutBadge status={r.payoutStatus} />
                        </div>
                        {r.payoutDate && (
                          <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                            {formatDate(r.payoutDate, locale)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
