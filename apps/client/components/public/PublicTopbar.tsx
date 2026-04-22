"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "../../context/LanguageContext";

type ThemePref = "light" | "dark" | "system";

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (pref === "dark") {
    root.classList.add("dark");
  } else if (pref === "light") {
    root.classList.add("light");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
  localStorage.setItem("pref_theme", pref);
}

/** Theme-aware navbar logo */
function NavLogo() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const check = () =>
      setDark(
        root.classList.contains("dark") ||
          (!root.classList.contains("light") && mq.matches),
      );
    check();
    const obs = new MutationObserver(check);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    mq.addEventListener("change", check);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", check);
    };
  }, []);

  return (
    <Image
      src={dark ? "/nasta-app-icon.png" : "/NastaLogoLight.png"}
      alt="Nasta"
      width={44}
      height={44}
      className="rounded-xl shadow-[0_2px_12px_rgba(184,130,42,0.3)] sm:w-[60px] sm:h-[60px]"
      priority
    />
  );
}

export default function PublicTopbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const stored = localStorage.getItem("pref_theme") as ThemePref | null;
    if (stored === "light" || stored === "dark") setThemePref(stored);
    else setThemePref("system");
  }, []);

  const cycleTheme = useCallback(() => {
    const next: ThemePref =
      themePref === "system"
        ? "light"
        : themePref === "light"
          ? "dark"
          : "system";
    setThemePref(next);
    applyTheme(next);
  }, [themePref]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || menuOpen
          ? "bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border-color)]/20 shadow-lg shadow-black/5"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3"
          aria-label="Nasta home"
        >
          <NavLogo />
          <span className="text-base font-bold text-[var(--foreground)] tracking-tight">
            Nasta
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/download/ios"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2.5 py-1.5 text-[var(--muted-text)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
            aria-label="Download on the App Store"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="text-xs font-medium">App Store</span>
          </a>
          <a
            href="/download/android"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2.5 py-1.5 text-[var(--muted-text)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
            aria-label="Get it on Google Play"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.303 2.303-8.633-8.635z" />
            </svg>
            <span className="text-xs font-medium">Google Play</span>
          </a>
          <button
            onClick={() => setLanguage(language === "en" ? "pt" : "en")}
            className="rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-text)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
          >
            {language === "en"
              ? "\uD83C\uDDF5\uD83C\uDDF9 PT"
              : "\uD83C\uDDEC\uD83C\uDDE7 EN"}
          </button>
          <button
            onClick={cycleTheme}
            title={`Theme: ${themePref}`}
            className="rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] p-1.5 text-[var(--muted-text)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
          >
            {themePref === "dark" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 006.002-2.082z"
                />
              </svg>
            ) : themePref === "light" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8m-4-4v4" />
              </svg>
            )}
          </button>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-[var(--muted-text)] transition-colors hover:text-[var(--foreground)]"
          >
            {t("landing.signIn", "Sign in")}
          </Link>
          <Link
            href="/register"
            className="btn-glow rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110 hover:shadow-[0_4px_24px_rgba(201,150,63,0.3)]"
          >
            {t("landing.getStartedFree", "Get Started")}
          </Link>
        </div>

        {/* Mobile: language toggle + theme toggle + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setLanguage(language === "en" ? "pt" : "en")}
            className="rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2 py-1.5 text-xs font-medium text-[var(--muted-text)]"
          >
            {language === "en"
              ? "\uD83C\uDDF5\uD83C\uDDF9 PT"
              : "\uD83C\uDDEC\uD83C\uDDE7 EN"}
          </button>
          <button
            onClick={cycleTheme}
            title={`Theme: ${themePref}`}
            className="rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] p-1.5 text-[var(--muted-text)]"
          >
            {themePref === "dark" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 006.002-2.082z"
                />
              </svg>
            ) : themePref === "light" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8m-4-4v4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] p-2 text-[var(--muted-text)] transition-colors hover:text-[var(--foreground)]"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border-color)]/20 bg-[var(--surface)] backdrop-blur-xl px-4 pb-5 pt-3">
          <nav className="flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--muted-text)] transition-colors hover:bg-[var(--card-hover-bg)] hover:text-[var(--foreground)]"
            >
              {t("landing.signIn", "Sign in")}
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="btn-glow rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              {t("landing.getStartedFree", "Get Started")}
            </Link>
            <div className="flex gap-2 pt-1">
              <a
                href="/download/ios"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2.5 py-2 text-[var(--muted-text)]"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <span className="text-xs font-medium">App Store</span>
              </a>
              <a
                href="/download/android"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-2.5 py-2 text-[var(--muted-text)]"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.303 2.303-8.633-8.635z" />
                </svg>
                <span className="text-xs font-medium">Google Play</span>
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
