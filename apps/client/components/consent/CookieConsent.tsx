"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "../../context/LanguageContext";

const STORAGE_KEY = "nasta_cookie_consent_v1";

type Categories = {
  necessary: true; // always on
  analytics: boolean;
  marketing: boolean;
};

type ConsentRecord = {
  version: 1;
  acceptedAt: string; // ISO
  categories: Categories;
};

function readStoredConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed && parsed.version === 1) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeStoredConsent(categories: Categories) {
  const record: ConsentRecord = {
    version: 1,
    acceptedAt: new Date().toISOString(),
    categories,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    // Allow analytics / marketing scripts to listen for this and load conditionally.
    window.dispatchEvent(
      new CustomEvent("nasta:consent-updated", { detail: record }),
    );
  } catch {
    /* localStorage disabled — silently ignore */
  }
}

/** Public helper — used by analytics loaders elsewhere. */
export function getConsent(): ConsentRecord | null {
  return readStoredConsent();
}

export default function CookieConsent() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Decide whether to display the banner
  useEffect(() => {
    const existing = readStoredConsent();
    if (!existing) {
      setOpen(true);
      return;
    }
    setAnalytics(existing.categories.analytics);
    setMarketing(existing.categories.marketing);
  }, []);

  // Allow other parts of the site (e.g. footer link) to re-open preferences
  useEffect(() => {
    const handler = () => {
      const existing = readStoredConsent();
      if (existing) {
        setAnalytics(existing.categories.analytics);
        setMarketing(existing.categories.marketing);
      }
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener("nasta:open-consent", handler);
    return () => window.removeEventListener("nasta:open-consent", handler);
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    writeStoredConsent({ necessary: true, analytics: true, marketing: true });
    setOpen(false);
  };
  const rejectAll = () => {
    writeStoredConsent({ necessary: true, analytics: false, marketing: false });
    setOpen(false);
  };
  const savePrefs = () => {
    writeStoredConsent({ necessary: true, analytics, marketing });
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="nasta-consent-title"
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-color)]/40 bg-[var(--card-bg)]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--primary)]/30 bg-[var(--bg-base)]">
            <Image
              src="/nasta-app-icon.png"
              alt="Nasta"
              width={28}
              height={28}
              className="rounded-md"
            />
          </div>
          <div className="flex-1">
            <h2
              id="nasta-consent-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {t("consent.title", "We value your privacy")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-text)]">
              {t(
                "consent.body",
                "We use cookies to keep Nasta secure, understand how the site is used, and improve your experience. You can accept all, reject non-essential, or choose what you allow.",
              )}{" "}
              <Link
                href="/cookies"
                className="font-medium text-[var(--primary)] hover:underline"
              >
                {t("consent.learnMore", "Learn more")}
              </Link>
            </p>
          </div>
        </div>

        {/* Detailed toggles */}
        {showDetails && (
          <div className="mt-5 space-y-3 rounded-xl border border-[var(--border-color)]/30 bg-[var(--bg-base)]/40 p-4">
            <CategoryRow
              title={t("consent.cat.necessary.title", "Strictly Necessary")}
              desc={t(
                "consent.cat.necessary.desc",
                "Required for the site to work — authentication, security, language and theme preferences. Always on.",
              )}
              checked
              disabled
            />
            <CategoryRow
              title={t("consent.cat.analytics.title", "Analytics")}
              desc={t(
                "consent.cat.analytics.desc",
                "Anonymous usage statistics that help us improve performance and the experience.",
              )}
              checked={analytics}
              onChange={setAnalytics}
            />
            <CategoryRow
              title={t("consent.cat.marketing.title", "Marketing")}
              desc={t(
                "consent.cat.marketing.desc",
                "Used to measure marketing campaigns and show relevant content. Off by default.",
              )}
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        )}

        {/* Action bar */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs font-medium text-[var(--muted-text)] hover:text-[var(--primary)]"
          >
            {showDetails
              ? t("consent.hideDetails", "Hide details")
              : t("consent.customize", "Customize")}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={rejectAll}
              className="rounded-lg border border-[var(--border-color)]/40 bg-transparent px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
            >
              {t("consent.rejectAll", "Reject non-essential")}
            </button>
            {showDetails && (
              <button
                type="button"
                onClick={savePrefs}
                className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
              >
                {t("consent.saveChoices", "Save choices")}
              </button>
            )}
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-lg border border-white/10 bg-gradient-to-b from-[var(--primary)] to-[#96691E] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--primary)]/20 transition-transform hover:scale-[1.02]"
            >
              {t("consent.acceptAll", "Accept all")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-text)]">
          {desc}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange && onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--border-color)]/40"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
