"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

/* ── Types ─────────────────────────────────────────────────── */

interface BookingItem {
  id: string;
  title?: string;
  status: string;
  startTime?: string;
  endTime?: string;
  jobId?: string;
  applicationId?: string;
  job?: {
    id: string;
    title: string;
    location?: string;
    city?: string;
    country?: string;
  };
  employer?: {
    id: string;
    firstName: string;
    lastName: string;
    location?: string;
    city?: string;
    country?: string;
  };
}

interface AvailabilitySlot {
  id: string;
  start: string;
  end: string;
}

type Tab = "agenda" | "availability";

/* ── Helpers ───────────────────────────────────────────────── */

function statusColor(s: string) {
  const u = s.toUpperCase();
  if (u === "COMPLETED")
    return "bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]";
  if (u === "CONFIRMED")
    return "bg-[var(--soft-blue)]/15 text-[var(--soft-blue)]";
  if (u === "IN_PROGRESS")
    return "bg-[var(--fulfillment-gold)]/15 text-[var(--fulfillment-gold)]";
  if (u === "CANCELLED" || u === "CANCELED")
    return "bg-[var(--alert-red)]/15 text-[var(--alert-red)]";
  return "bg-[var(--muted-text)]/10 text-[var(--muted-text)]";
}

function fmtDate(iso?: string, locale = "en-IE"): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;
  const time = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  return (
    d.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " " +
    time
  );
}

function fmtDay(iso: string, locale = "en-IE"): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function location(b: BookingItem): string {
  const parts = [
    b.job?.location || b.employer?.location,
    b.job?.city || b.employer?.city,
    b.job?.country || b.employer?.country,
  ].filter(Boolean);
  return parts.join(", ") || "";
}

function daysInMonth(year: number, month: number): Date[] {
  const d = new Date(year, month, 1);
  const result: Date[] = [];
  while (d.getMonth() === month) {
    result.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mergeRanges(dates: string[]): { start: string; end: string }[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(prev);
    prevDate.setDate(prevDate.getDate() + 1);
    if (toYmd(prevDate) === sorted[i]) {
      prev = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: prev });
      rangeStart = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: prev });
  return ranges;
}

/* ── Component ─────────────────────────────────────────────── */

export default function SchedulePage() {
  const [tab, setTab] = useState<Tab>("agenda");

  /* Agenda */
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);

  /* Availability */
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [availLoading, setAvailLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const { t, language } = useLanguage();
  const locale = language === "pt" ? "pt-PT" : "en-IE";

  /* Fetch bookings */
  const fetchBookings = useCallback(async () => {
    setAgendaLoading(true);
    const res = await api<BookingItem[]>("/bookings/seeker/me?pageSize=100");
    if (res.data && Array.isArray(res.data)) {
      const sorted = [...res.data].sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : Infinity;
        const tb = b.startTime ? new Date(b.startTime).getTime() : Infinity;
        return ta - tb;
      });
      setBookings(sorted);
    }
    setAgendaLoading(false);
  }, []);

  /* Fetch availability */
  const fetchAvailability = useCallback(async () => {
    setAvailLoading(true);
    const res = await api<AvailabilitySlot[]>("/availability/me");
    if (res.data && Array.isArray(res.data)) {
      setSlots(res.data);
      const dates = new Set<string>();
      for (const slot of res.data) {
        const s = new Date(slot.start);
        const e = new Date(slot.end);
        const cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        while (cursor <= endDay) {
          dates.add(toYmd(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      setSelectedDates(dates);
    }
    setAvailLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
  }, [fetchBookings, fetchAvailability]);

  /* Save availability */
  const saveAvailability = async () => {
    setSaving(true);
    for (const slot of slots) {
      await api(`/availability/${slot.id}`, { method: "DELETE" });
    }
    const ranges = mergeRanges([...selectedDates]);
    for (const range of ranges) {
      const start = new Date(range.start + "T00:00:00").toISOString();
      const end = new Date(range.end + "T23:59:59.999").toISOString();
      await api("/availability/upsert", {
        method: "POST",
        body: { start, end },
      });
    }
    setSaving(false);
    setToast({
      msg: t("schedule.availabilitySavedSuccessfully", "Availability saved"),
      ok: true,
    });
    fetchAvailability();
    setTimeout(() => setToast(null), 3000);
  };

  const toggleDate = (ymd: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  };

  /* Calendar data */
  const calDays = useMemo(
    () => daysInMonth(calMonth.year, calMonth.month),
    [calMonth],
  );
  const firstDow = calDays[0].getDay();
  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString(
    locale,
    { month: "long", year: "numeric" },
  );
  const todayYmd = toYmd(new Date());

  const dayHeaders = useMemo(() => {
    const sunday = new Date(2023, 0, 1); // Jan 1, 2023 is a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d
        .toLocaleDateString(locale, { weekday: "short" })
        .slice(0, 3)
        .toUpperCase();
    });
  }, [locale]);

  /* Group bookings by date for agenda */
  const grouped = useMemo(() => {
    const map = new Map<string, BookingItem[]>();
    for (const b of bookings) {
      const key = b.startTime
        ? new Date(b.startTime).toLocaleDateString(locale, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "Unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [bookings, locale]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          {t("schedule.scheduleLabel", "Schedule")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
          {t("schedule.scheduleAndAvailability", "Schedule & Availability")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          {t(
            "schedule.scheduleDescription",
            "View your upcoming bookings and manage when you are available to work.",
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-alt)] p-1">
        {(["agenda", "availability"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              tab === tabKey
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-text)] hover:text-[var(--foreground)]"
            }`}
          >
            {tabKey === "agenda"
              ? t("agenda.title", "Agenda")
              : t("schedule.myAvailability", "My Availability")}
          </button>
        ))}
      </div>

      {/* ── AGENDA TAB ── */}
      {tab === "agenda" && (
        <div className="space-y-4">
          {agendaLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl bg-[var(--surface-alt)]"
                />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] px-8 py-16 text-center">
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
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
                {t("agenda.noBookings", "No bookings yet")}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-text)]">
                {t(
                  "agenda.noBookingsMessage",
                  "When you get booked for jobs, they will appear here.",
                )}
              </p>
            </div>
          ) : (
            [...grouped.entries()].map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                  {dateLabel}
                </h3>
                <div className="space-y-2">
                  {items.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-alt)]"
                    >
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
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--muted-text)]">
                            {fmtDate(b.startTime, locale)}
                          </p>
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {b.job?.title ||
                              b.title ||
                              t("agenda.booking", "Booking")}
                          </p>
                          {location(b) && (
                            <p className="truncate text-xs text-[var(--muted-text)]">
                              {location(b)}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor(b.status)}`}
                      >
                        {t(
                          `agenda.status.${b.status.toLowerCase()}`,
                          b.status.replace(/_/g, " "),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── AVAILABILITY TAB ── */}
      {tab === "availability" && (
        <div className="space-y-6">
          {availLoading ? (
            <div className="h-80 animate-pulse rounded-2xl bg-[var(--surface-alt)]" />
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                {/* Month nav */}
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setCalMonth((p) => {
                        const d = new Date(p.year, p.month - 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
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
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {monthLabel}
                  </h3>
                  <button
                    onClick={() =>
                      setCalMonth((p) => {
                        const d = new Date(p.year, p.month + 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
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
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="mb-1 grid grid-cols-7 text-center">
                  {dayHeaders.map((d) => (
                    <span
                      key={d}
                      className="py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-text)]"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {calDays.map((day) => {
                    const ymd = toYmd(day);
                    const isSelected = selectedDates.has(ymd);
                    const isToday = ymd === todayYmd;
                    return (
                      <button
                        key={ymd}
                        onClick={() => toggleDate(ymd)}
                        className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-[var(--primary)] text-white"
                            : isToday
                              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-bold"
                              : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs text-[var(--muted-text)]">
                  {t(
                    "schedule.tapDaysToToggle",
                    "Tap days to toggle availability. Selected days ({{count}}) are shown in gold.",
                    { count: selectedDates.size },
                  )}
                </p>
              </div>

              {/* Selected summary */}
              {selectedDates.size > 0 && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {t(
                      "schedule.selectedAvailability",
                      "Selected availability",
                    )}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mergeRanges([...selectedDates]).map((r) => (
                      <span
                        key={r.start}
                        className="rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--primary)]"
                      >
                        {r.start === r.end
                          ? fmtDay(r.start, locale)
                          : `${fmtDay(r.start, locale)} - ${fmtDay(r.end, locale)}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  onClick={saveAvailability}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)] disabled:opacity-50"
                >
                  {saving && (
                    <svg
                      className="h-4 w-4 animate-spin"
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
                  )}
                  {saving
                    ? t("common.saving", "Saving...")
                    : t("schedule.saveAvailability", "Save availability")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 shadow-xl text-sm font-medium ${toast.ok ? "border-[var(--achievement-green)]/30 bg-[var(--achievement-green)]/15 text-[var(--achievement-green)]" : "border-[var(--alert-red)]/30 bg-[var(--alert-red)]/15 text-[var(--alert-red)]"}`}
        >
          {toast.msg}
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
