"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "../../../context/LanguageContext";

type Store = "ios" | "android";

/* ─────────────────────────  Clean QR placeholder  ───────────────────────── */
function QRPlaceholder() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border border-[var(--border-color)]/40 bg-white p-3 shadow-xl shadow-black/30">
      {/* Stylised QR — three corner finders + minimal data marks */}
      <svg viewBox="0 0 100 100" className="h-full w-full text-neutral-900">
        {/* corner finders */}
        {[
          [6, 6],
          [70, 6],
          [6, 70],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`} fill="currentColor">
            <rect x={x} y={y} width="24" height="24" rx="3" />
            <rect
              x={x + 4}
              y={y + 4}
              width="16"
              height="16"
              rx="2"
              fill="white"
            />
            <rect x={x + 8} y={y + 8} width="8" height="8" rx="1" />
          </g>
        ))}
        {/* sparse decorative data marks */}
        <g fill="currentColor" opacity="0.85">
          {[
            [40, 10, 4],
            [50, 10, 4],
            [60, 18, 4],
            [40, 22, 4],
            [54, 28, 4],
            [42, 38, 4],
            [50, 38, 4],
            [58, 38, 4],
            [66, 38, 4],
            [10, 40, 4],
            [22, 42, 4],
            [34, 46, 4],
            [42, 50, 4],
            [54, 50, 4],
            [62, 54, 4],
            [74, 50, 4],
            [82, 54, 4],
            [90, 50, 4],
            [38, 62, 4],
            [50, 62, 4],
            [62, 66, 4],
            [74, 70, 4],
            [86, 70, 4],
            [42, 78, 4],
            [54, 82, 4],
            [66, 86, 4],
            [78, 82, 4],
            [90, 78, 4],
            [42, 90, 4],
            [50, 90, 4],
            [58, 86, 4],
            [70, 90, 4],
            [82, 90, 4],
          ].map(([x, y, s]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} rx="0.5" />
          ))}
        </g>
        {/* centre brand mark */}
        <g>
          <rect x="38" y="38" width="24" height="24" rx="6" fill="white" />
          <rect x="40" y="40" width="20" height="20" rx="5" fill="#B8822A" />
          <text
            x="50"
            y="55"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill="white"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            N
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────  Page  ───────────────────────── */
export default function StoreLanding({ store }: { store: Store }) {
  const { t } = useLanguage();
  const isIOS = store === "ios";

  const storeName = isIOS
    ? t("download.appStore", "App Store")
    : t("download.googlePlay", "Google Play");
  const platformName = isIOS
    ? t("download.iosPlatform", "iOS")
    : t("download.androidPlatform", "Android");
  const tagline = isIOS
    ? t("download.iosTagline", "Built for iPhone & iPad")
    : t("download.androidTagline", "Built for Android phones & tablets");
  const otherStoreHref = isIOS ? "/download/android" : "/download/ios";
  const otherStoreLabel = isIOS
    ? t("download.googlePlay", "Google Play")
    : t("download.appStore", "App Store");

  const StoreIcon = isIOS ? (
    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  ) : (
    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.303 2.303-8.633-8.635z" />
    </svg>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg-base)]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[var(--primary)]/10 blur-[140px]" />
        <div className="absolute right-0 bottom-0 h-[400px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full bg-[var(--primary)]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        {/* Top bar — logo + back */}
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image
              src="/nasta-app-icon.png"
              alt="Nasta"
              width={40}
              height={40}
              className="rounded-xl shadow-[0_2px_12px_rgba(184,130,42,0.3)]"
              priority
            />
            <span className="text-base font-bold tracking-tight text-[var(--foreground)]">
              Nasta
            </span>
          </Link>

          {/* Hard navigation back to home — avoids any client-router hang */}
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--muted-text)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("download.backToHome", "Back to Home")}
          </a>
        </header>

        {/* Hero */}
        <section className="grid flex-1 items-center gap-12 py-12 md:grid-cols-2 md:gap-16 md:py-20">
          {/* Left — copy */}
          <div className="flex flex-col">
            <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              </span>
              {t("download.comingSoonOn", "Coming soon on")} {storeName}
            </span>

            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.05] tracking-tight">
              {t("download.heroLine1", "Nasta on")}{" "}
              <span className="text-[var(--primary)]">{platformName}</span>.
              <br />
              {t("download.heroLine2", "Almost ready.")}
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--muted-text)]">
              {tagline}.{" "}
              {t(
                "download.heroSub",
                "We're putting the final polish on the experience. The app launches soon — be the first to know.",
              )}
            </p>

            {/* Primary store button (greyed, not yet live) */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div
                aria-disabled="true"
                className="inline-flex cursor-not-allowed select-none items-center gap-3 rounded-xl border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-5 py-3.5 opacity-60"
              >
                {StoreIcon}
                <div className="text-left">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                    {isIOS
                      ? t("download.downloadOnThe", "Download on the")
                      : t("download.getItOn", "Get it on")}
                  </p>
                  <p className="-mt-0.5 text-lg font-semibold leading-tight">
                    {storeName}
                  </p>
                </div>
              </div>

              <Link
                href={otherStoreHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--primary)]"
              >
                {t("download.lookingFor", "Looking for")} {otherStoreLabel}?
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right — QR card */}
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-sm rounded-3xl border border-[var(--border-color)]/30 bg-[var(--card-bg)] p-8 shadow-2xl shadow-black/40">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-text)]">
                  {t("download.scanWithCamera", "Scan with your camera")}
                </span>
                <span className="rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--primary)]">
                  {t("download.preview", "Preview")}
                </span>
              </div>

              <QRPlaceholder />

              <div className="mt-6 space-y-3 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t(
                    "download.qrReady",
                    "Your QR will appear here on launch day.",
                  )}
                </p>
                <p className="text-xs leading-relaxed text-[var(--muted-text)]">
                  {t(
                    "download.qrSub",
                    "Point your phone camera here and you'll be taken straight to",
                  )}{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {storeName}
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="border-t border-[var(--border-color)]/15 pt-6 text-center text-xs text-[var(--muted-text)]">
          © {new Date().getFullYear()} Nasta ·{" "}
          {t("download.footerNote", "Mobile app launching soon")}
        </footer>
      </div>
    </main>
  );
}
