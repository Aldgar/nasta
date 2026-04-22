"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth, roleHome } from "../lib/auth";
import { useLanguage } from "../context/LanguageContext";
import PublicTopbar from "../components/public/PublicTopbar";

/* ── Scroll-triggered visibility ── */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(32px)",
        transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Animated counter ── */

function Counter({
  end,
  suffix = "",
  duration = 900,
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  const { ref, visible } = useInView();
  // Start from 60% of the end value so small numbers (2, 5) don't linger on wrong digits
  const startFraction = end <= 5 ? 0.6 : 0;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t0 = performance.now();
    function tick(now: number) {
      const t = Math.min((now - t0) / duration, 1);
      // Ease out quart: fast start, smooth finish
      const eased = 1 - Math.pow(1 - t, 4);
      const value = startFraction * end + eased * end * (1 - startFraction);
      setCount(Math.round(value));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [visible, end, duration, startFraction]);
  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ── Feature data ── */

const features = [
  {
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
    title: "Instant Matching",
    titleKey: "landing.featInstantMatchingTitle",
    desc: "Need help now? Request instantly available, verified service providers near you. Matched in seconds, not days.",
    descKey: "landing.featInstantMatchingDesc",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    title: "ID-Verified Profiles",
    titleKey: "landing.featIdVerifiedTitle",
    desc: "Every client and service provider is identity-verified with government-issued documents before accepting any assignment.",
    descKey: "landing.featIdVerifiedDesc",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
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
    ),
    title: "Secure Payments",
    titleKey: "landing.featSecurePayTitle",
    desc: "Stripe-powered escrow holds funds safely until the job is complete. No disputes, no surprises.",
    descKey: "landing.featSecurePayDesc",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
    title: "Unlimited Categories",
    titleKey: "landing.featCategoriesTitle",
    desc: "From cleaning and childcare to construction and events. No limits on the types of jobs you can post or find.",
    descKey: "landing.featCategoriesDesc",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "On-Demand Booking",
    titleKey: "landing.featOnDemandTitle",
    desc: "Request instant help or schedule ahead. One-off tasks or long-term contracts, with fair no-show protection and full flexibility.",
    descKey: "landing.featOnDemandDesc",
  },
  {
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
        />
      </svg>
    ),
    title: "Mobile First",
    titleKey: "landing.featMobileFirstTitle",
    desc: "Full-featured iOS and Android apps. Apply, manage bookings, and get paid, all from your pocket.",
    descKey: "landing.featMobileFirstDesc",
  },
];

/* ── Page ── */

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  /* Detect active color scheme for theme-aware logo */
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const check = () =>
      setIsDark(
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

  useEffect(() => {
    if (!loading && user) router.replace(roleHome(user.role));
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-gradient">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--border-color)]">
          <div className="h-full w-1/3 rounded-full bg-[var(--primary)] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gradient text-[var(--foreground)] overflow-x-hidden">
      <PublicTopbar />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)] opacity-[0.05] blur-[160px]" />
          <div className="absolute right-1/4 bottom-1/3 h-[400px] w-[400px] rounded-full bg-[var(--soft-blue)] opacity-[0.03] blur-[120px]" />
        </div>

        <Reveal>
          <Image
            src={isDark ? "/nasta-app-icon.png" : "/NastaLogoLight.png"}
            alt="Nasta"
            width={140}
            height={140}
            priority
            className="mx-auto mb-12 rounded-3xl shadow-[0_8px_40px_rgba(184,130,42,0.35)]"
          />
        </Reveal>

        <Reveal delay={0.1}>
          <h1 className="mx-auto max-w-5xl text-[clamp(2.5rem,6vw,5.5rem)] font-bold leading-[1.05] tracking-tight">
            {t("landing.heroTitleMain", "Instant Work.")}{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] via-[var(--warm-coral)] to-[var(--soft-blue)] bg-clip-text text-transparent">
              {t("landing.heroTitleHighlight", "Verified")}
            </span>{" "}
            {t("landing.heroTitleEnd", "Talent.")}
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mx-auto mt-8 max-w-2xl text-[clamp(1.05rem,2vw,1.35rem)] leading-relaxed text-[var(--muted-text)]">
            {t(
              "landing.heroDescription",
              "Request verified service providers on demand, or pick up jobs instantly as a side gig. Every identity is verified, every payment is protected. Built for the instant workforce.",
            )}
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="btn-glow group inline-flex items-center rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-8 py-4 text-base font-semibold text-white shadow-[0_4px_24px_rgba(201,150,63,0.25)] transition-all duration-300 hover:shadow-[0_4px_36px_rgba(201,150,63,0.45)] hover:brightness-110"
            >
              {t("landing.getStartedFree", "Get Started, It's Free")}
              <svg
                className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[var(--border-color)]/40 px-8 py-4 text-base font-semibold backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-[0_0_24px_rgba(201,150,63,0.12)] hover:bg-[var(--card-hover-bg)]"
            >
              {t("landing.signIn", "Sign In")}
            </Link>
          </div>
        </Reveal>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 text-[var(--muted-text)]">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] opacity-50">
              {t("landing.scroll", "Scroll")}
            </span>
            <svg
              className="h-4 w-4 animate-bounce opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ═══════════ STATS ═══════════ */}
      <section className="border-y border-[var(--border-color)]/20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-[var(--border-color)]/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              prefix: "",
              end: 5,
              suffix: "K+",
              label: t("landing.verifiedUsers", "Verified Users"),
            },
            {
              prefix: "",
              end: 12,
              suffix: "K+",
              label: t("landing.jobsCompleted", "Jobs Completed"),
            },
            {
              prefix: "\u20AC",
              end: 2,
              suffix: "M+",
              label: t("landing.paymentsSecured", "Payments Secured"),
            },
          ].map((stat, i) => (
            <Reveal
              key={stat.label}
              delay={i * 0.12}
              className="px-6 py-14 text-center sm:py-16"
            >
              <p className="text-[clamp(2.5rem,4vw,3.5rem)] font-bold tracking-tight">
                <span className="text-[var(--primary)]">{stat.prefix}</span>
                <Counter end={stat.end} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--muted-text)]">
                {stat.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ STATEMENT ═══════════ */}
      <section className="py-36 sm:py-44">
        <Reveal>
          <h2 className="mx-auto max-w-4xl px-6 text-center text-[clamp(1.75rem,4vw,3.25rem)] font-bold leading-snug tracking-tight">
            {t("landing.statementPart1", "Built for the")}{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--warm-coral)] bg-clip-text text-transparent">
              {t("landing.statementHighlight", "on-demand")}
            </span>{" "}
            {t("landing.statementPart2", "workforce.")}{" "}
            <span className="text-[var(--muted-text)]">
              {t(
                "landing.statementSub",
                "Hire instantly or earn on your own schedule.",
              )}
            </span>
          </h2>
        </Reveal>
      </section>

      {/* ═══════════ DUAL VALUE PROP ═══════════ */}
      <section className="mx-auto max-w-6xl px-6 pb-36">
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-[var(--border-color)]/20 bg-[var(--card-bg)] p-10 backdrop-blur-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
                {t("landing.forEmployers", "For Employers")}
              </p>
              <h3 className="mb-4 text-2xl font-bold tracking-tight">
                {t("landing.employerTitle", "Need help right now?")}
              </h3>
              <p className="mb-6 text-[15px] leading-relaxed text-[var(--muted-text)]">
                {t(
                  "landing.employerDesc",
                  "Post a job and get matched with verified, instantly available service providers near you. No waiting, no searching through profiles for days.",
                )}
              </p>
              <ul className="space-y-3 text-sm text-[var(--muted-text)]">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.employerBullet1",
                    "Request on-demand workers in seconds",
                  )}
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.employerBullet2",
                    "Every provider is ID-verified",
                  )}
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.employerBullet3",
                    "Pay only when the job is done",
                  )}
                </li>
              </ul>
              <Link
                href="/for-employers"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:text-[var(--foreground)]"
              >
                {t("landing.learnMore", "Learn more")}
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-3xl border border-[var(--border-color)]/20 bg-[var(--card-bg)] p-10 backdrop-blur-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
                {t("landing.forServiceProviders", "For Service Providers")}
              </p>
              <h3 className="mb-4 text-2xl font-bold tracking-tight">
                {t("landing.providerTitle", "Your next gig is one tap away")}
              </h3>
              <p className="mb-6 text-[15px] leading-relaxed text-[var(--muted-text)]">
                {t(
                  "landing.providerDesc",
                  "Whether it is your main hustle or a side gig, get instant job requests from verified clients and start earning immediately. No applications, no waiting.",
                )}
              </p>
              <ul className="space-y-3 text-sm text-[var(--muted-text)]">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.providerBullet1",
                    "Receive instant job alerts near you",
                  )}
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.providerBullet2",
                    "Payment is guaranteed before you start",
                  )}
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
                  {t(
                    "landing.providerBullet3",
                    "Earn on your schedule, cash out fast",
                  )}
                </li>
              </ul>
              <Link
                href="/for-service-providers"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:text-[var(--foreground)]"
              >
                {t("landing.learnMore", "Learn more")}
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="mx-auto max-w-7xl px-6 pb-36">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.07}>
              <div className="group relative h-full overflow-hidden rounded-3xl border border-[var(--border-color)]/20 bg-[var(--card-bg)] p-8 backdrop-blur-sm transition-all duration-500 hover:border-[var(--primary)]/30 hover:bg-[var(--card-hover-bg)] sm:p-10">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[var(--primary)] opacity-0 blur-[60px] transition-opacity duration-700 group-hover:opacity-[0.07]" />
                <div className="relative">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/15 transition-all duration-500 group-hover:bg-[var(--primary)]/15 group-hover:ring-[var(--primary)]/25">
                    {f.icon}
                  </div>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight">
                    {f.titleKey ? t(f.titleKey, f.title) : f.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[var(--muted-text)]">
                    {f.descKey ? t(f.descKey, f.desc) : f.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="border-t border-[var(--border-color)]/20 py-36 sm:py-44">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
              {t("landing.howItWorks", "How it works")}
            </p>
            <h2 className="mx-auto mb-6 max-w-3xl text-center text-[clamp(1.75rem,3.5vw,3rem)] font-bold tracking-tight">
              {t(
                "landing.howItWorksTitle",
                "Verified before the first job. Trusted from day one.",
              )}
            </h2>
            <p className="mx-auto mb-20 max-w-2xl text-center text-base leading-relaxed text-[var(--muted-text)]">
              {t(
                "landing.howItWorksDesc",
                "We take trust seriously. Every user completes a verification process before they can post or accept a single job. Here is exactly what is required.",
              )}
            </p>
          </Reveal>

          {/* Verification cards */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Service Providers */}
            <Reveal>
              <div className="relative h-full overflow-hidden rounded-3xl border border-[var(--border-color)]/20 bg-[var(--card-bg)] backdrop-blur-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--warm-coral)] to-[var(--primary)]" />
                <div className="p-8 sm:p-10">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
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
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                      />
                    </svg>
                    {t("landing.spBadge", "Service Providers")}
                  </div>
                  <h3 className="mb-2 text-2xl font-bold tracking-tight">
                    {t("landing.spTitle", "Get verified once, earn forever")}
                  </h3>
                  <p className="mb-8 text-sm leading-relaxed text-[var(--muted-text)]">
                    {t(
                      "landing.spDesc",
                      "Complete your verification to unlock instant job requests and start earning. Every step builds your trust score.",
                    )}
                  </p>
                  <div className="space-y-0.5">
                    {[
                      {
                        icon: (
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
                              d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-3.375 3.375h3.75"
                            />
                          </svg>
                        ),
                        title: t("landing.spIdentity", "Identity Verification"),
                        desc: t(
                          "landing.spIdentityDesc",
                          "Government-issued photo ID to confirm your real identity",
                        ),
                      },
                      {
                        icon: (
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
                              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                            />
                          </svg>
                        ),
                        title: t("landing.spDrivers", "Driver's License"),
                        desc: t(
                          "landing.spDriversDesc",
                          "Required for driving jobs, issued at least 3 years ago",
                        ),
                      },
                      {
                        icon: (
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
                              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                            />
                          </svg>
                        ),
                        title: t(
                          "landing.spBackground",
                          "Background & Criminal Record Check",
                        ),
                        desc: t(
                          "landing.spBackgroundDesc",
                          "Comprehensive screening for your safety and client trust",
                        ),
                      },
                      {
                        icon: (
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
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                        ),
                        title: t("landing.spCV", "Professional CV"),
                        desc: t(
                          "landing.spCVDesc",
                          "Your work experience and qualifications on file",
                        ),
                      },
                      {
                        icon: (
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
                              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                            />
                          </svg>
                        ),
                        title: t("landing.spSkills", "Skills & Service Rates"),
                        desc: t(
                          "landing.spSkillsDesc",
                          "List your professional skills with your rates in EUR",
                        ),
                      },
                      {
                        icon: (
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
                        ),
                        title: t(
                          "landing.spBank",
                          "Bank Account & Payout Setup",
                        ),
                        desc: t(
                          "landing.spBankDesc",
                          "Date of birth, address, verified phone and email required for payouts",
                        ),
                      },
                      {
                        icon: (
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
                              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                            />
                          </svg>
                        ),
                        title: t(
                          "landing.spPhoneEmail",
                          "Phone & Email Verification",
                        ),
                        desc: t(
                          "landing.spPhoneEmailDesc",
                          "SMS and email confirmation to secure your account",
                        ),
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex items-start gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-[var(--card-hover-bg)]"
                      >
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-text)]">
                            {item.desc}
                          </p>
                        </div>
                        <div className="ml-auto flex-shrink-0">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                            {t("landing.required", "Required")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Employers */}
            <Reveal delay={0.1}>
              <div className="relative h-full overflow-hidden rounded-3xl border border-[var(--border-color)]/20 bg-[var(--card-bg)] backdrop-blur-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--soft-blue)] via-[var(--primary)] to-[var(--soft-blue)]" />
                <div className="p-8 sm:p-10">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--soft-blue)]/10 px-3 py-1 text-xs font-semibold text-[var(--soft-blue)] ring-1 ring-[var(--soft-blue)]/20">
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
                        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    {t("landing.empBadge", "Employers")}
                  </div>
                  <h3 className="mb-2 text-2xl font-bold tracking-tight">
                    {t("landing.empTitle", "Post your first job in minutes")}
                  </h3>
                  <p className="mb-8 text-sm leading-relaxed text-[var(--muted-text)]">
                    {t(
                      "landing.empDesc",
                      "A lighter setup so you can start hiring fast. Add the essentials and request your first service provider today.",
                    )}
                  </p>
                  <div className="space-y-0.5">
                    {[
                      {
                        icon: (
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
                              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                            />
                          </svg>
                        ),
                        title: t("landing.empAddress", "Physical Address"),
                        desc: t(
                          "landing.empAddressDesc",
                          "Your business or residential address for job location accuracy",
                        ),
                        required: true,
                      },
                      {
                        icon: (
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
                              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                            />
                          </svg>
                        ),
                        title: t("landing.empPhone", "Phone Number"),
                        desc: t(
                          "landing.empPhoneDesc",
                          "For direct communication and account security",
                        ),
                        required: true,
                      },
                      {
                        icon: (
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
                              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ),
                        title: t(
                          "landing.empVerify",
                          "Email & Phone Verification",
                        ),
                        desc: t(
                          "landing.empVerifyDesc",
                          "SMS and email confirmation to verify your account",
                        ),
                        required: true,
                      },
                      {
                        icon: (
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
                        ),
                        title: t("landing.empPayment", "Payment Method"),
                        desc: t(
                          "landing.empPaymentDesc",
                          "Add a card to book service providers and secure payment in escrow",
                        ),
                        required: false,
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex items-start gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-[var(--card-hover-bg)]"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${
                            item.required
                              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                              : "bg-[var(--soft-blue)]/10 text-[var(--soft-blue)] ring-[var(--soft-blue)]/20"
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-text)]">
                            {item.desc}
                          </p>
                        </div>
                        <div className="ml-auto flex-shrink-0">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                              item.required
                                ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                                : "bg-[var(--soft-blue)]/10 text-[var(--soft-blue)] ring-[var(--soft-blue)]/20"
                            }`}
                          >
                            {item.required
                              ? t("landing.required", "Required")
                              : t("landing.optional", "Optional")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-xl border border-[var(--border-color)]/10 bg-[var(--card-bg)] p-5">
                    <p className="text-xs leading-relaxed text-[var(--muted-text)]">
                      <strong className="text-[var(--foreground)]">
                        {t("landing.quickStart", "Quick start:")}
                      </strong>{" "}
                      {t(
                        "landing.quickStartDesc",
                        "You can browse verified service providers immediately after creating your account. Add your address and verify your phone to post your first job or send an instant request.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Trust statement */}
          <Reveal>
            <div className="mt-16 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/20">
                <svg
                  className="h-7 w-7 text-[var(--primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-bold tracking-tight">
                {t("landing.trustTitle", "Every verification builds trust")}
              </h3>
              <p className="mx-auto max-w-lg text-sm leading-relaxed text-[var(--muted-text)]">
                {t(
                  "landing.trustDesc",
                  "These steps exist to protect everyone on the platform. Verified service providers get more job requests. Verified clients attract better talent. The result is a marketplace where both sides can work with confidence.",
                )}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MONITORING BANNER ═══════════ */}
      <section className="px-6 pb-36">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--border-color)]/20 bg-[var(--card-bg)] px-8 py-20 text-center backdrop-blur-sm sm:px-16 sm:py-28">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)] opacity-[0.04] blur-[140px]" />
            <div className="relative">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
                {t("landing.monitoredTransparent", "Monitored & transparent")}
              </p>
              <h2 className="mx-auto max-w-3xl text-[clamp(1.75rem,3.5vw,3rem)] font-bold tracking-tight">
                {t(
                  "landing.monitoringTitle",
                  "Live GPS tracking, digital check-in/out, and real-time monitoring for full accountability.",
                )}
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--muted-text)]">
                {t(
                  "landing.monitoringDesc",
                  "Every assignment is tracked from start to finish. Both parties have full visibility, so there are never any surprises.",
                )}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ DOWNLOAD ═══════════ */}
      <section className="px-6 pb-36">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
              {t("landing.availableNow", "Available now")}
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-bold tracking-tight">
              {t("landing.takeNastaWithYou", "Take Nasta with you")}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[var(--muted-text)]">
              {t(
                "landing.downloadDesc",
                "Download the app for iOS or Android. Find work, post jobs, and manage everything from your phone.",
              )}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/download/ios"
                className="inline-flex items-center gap-3 rounded-xl border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-6 py-4 backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
              >
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                    {t("landing.downloadOnThe", "Download on the")}
                  </p>
                  <p className="-mt-0.5 text-lg font-semibold leading-tight">
                    {t("landing.appStore", "App Store")}
                  </p>
                </div>
              </a>
              <a
                href="/download/android"
                className="inline-flex items-center gap-3 rounded-xl border border-[var(--border-color)]/30 bg-[var(--card-bg)] px-6 py-4 backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
              >
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.303 2.303-8.633-8.635z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                    {t("landing.getItOn", "Get it on")}
                  </p>
                  <p className="-mt-0.5 text-lg font-semibold leading-tight">
                    {t("landing.googlePlay", "Google Play")}
                  </p>
                </div>
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="px-6 pb-36">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-tight">
              {t("landing.readyToStart", "Ready to get started?")}
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[var(--muted-text)]">
              {t(
                "landing.ctaDesc",
                "Join thousands already using Nasta. Create your profile in minutes.",
              )}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="btn-glow group inline-flex items-center rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-8 py-4 text-base font-semibold text-white shadow-[0_4px_24px_rgba(201,150,63,0.25)] transition-all duration-300 hover:shadow-[0_4px_36px_rgba(201,150,63,0.45)] hover:brightness-110"
              >
                {t("landing.createFreeAccount", "Create Free Account")}
                <svg
                  className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-[var(--border-color)]/40 px-8 py-4 text-base font-semibold transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-[0_0_24px_rgba(201,150,63,0.12)] hover:bg-[var(--card-hover-bg)]"
              >
                {t("landing.signIn", "Sign In")}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="px-6 pb-8 pt-16">
        <div
          className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[var(--primary)]/20 bg-[var(--card-bg)] backdrop-blur-sm"
          style={{ borderTop: "2px solid var(--primary)" }}
        >
          <div className="p-8 sm:p-12">
            {/* Logo + tagline */}
            <div className="mb-10 flex items-start gap-4">
              <Image
                src={isDark ? "/nasta-app-icon.png" : "/NastaLogoLight.png"}
                alt="Nasta"
                width={48}
                height={48}
                className="flex-shrink-0 rounded-xl shadow-[0_2px_12px_rgba(184,130,42,0.25)]"
              />
              <p className="max-w-xs text-sm leading-relaxed text-[var(--muted-text)]">
                {t(
                  "landing.tagline",
                  "On-demand workforce marketplace. Instant jobs, verified talent, secure payments.",
                )}
              </p>
            </div>

            {/* Link columns */}
            <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h4 className="mb-4 border-b border-[var(--primary)]/25 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
                  {t("landing.platform", "Platform")}
                </h4>
                <ul className="space-y-2.5 text-sm text-[var(--muted-text)]">
                  <li>
                    <Link
                      href="/about"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.about", "About")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/how-it-works"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.howItWorksLink", "How it Works")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/for-employers"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.forEmployersLink", "For Employers")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/for-service-providers"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t(
                        "landing.forServiceProvidersLink",
                        "For Service Providers",
                      )}
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 border-b border-[var(--primary)]/25 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
                  {t("landing.supportSection", "Support")}
                </h4>
                <ul className="space-y-2.5 text-sm text-[var(--muted-text)]">
                  <li>
                    <Link
                      href="/faq"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.faqs", "FAQs")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/support"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.contactUs", "Contact Us")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/feature-request"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.featureRequest", "Feature Request")}
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 border-b border-[var(--primary)]/25 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
                  {t("landing.legalSection", "Legal")}
                </h4>
                <ul className="space-y-2.5 text-sm text-[var(--muted-text)]">
                  <li>
                    <Link
                      href="/privacy"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.privacyPolicy", "Privacy Policy")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.termsOfService", "Terms of Service")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cookies"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.cookiePolicy", "Cookie Policy")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/platform-rules"
                      className="transition-colors hover:text-[var(--primary)]"
                    >
                      {t("landing.platformRules", "Platform Rules")}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[var(--primary)]/20 px-8 py-5 sm:px-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[13px] text-[var(--muted-text)]">
                <p>
                  &copy; {new Date().getFullYear()}{" "}
                  {t("landing.copyright", "Nasta · Trusted by both sides")}
                </p>
                <p className="mt-1">
                  {t("landing.contact", "Contact:")}{" "}
                  <a
                    href="mailto:support@nasta.app"
                    className="transition-colors hover:text-[var(--primary)]"
                  >
                    support@nasta.app
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-4 text-[13px] text-[var(--muted-text)] sm:flex">
                  <Link
                    href="/privacy"
                    className="transition-colors hover:text-[var(--primary)]"
                  >
                    {t("landing.privacy", "Privacy")}
                  </Link>
                  <Link
                    href="/terms"
                    className="transition-colors hover:text-[var(--primary)]"
                  >
                    {t("landing.terms", "Terms")}
                  </Link>
                  <Link
                    href="/cookies"
                    className="transition-colors hover:text-[var(--primary)]"
                  >
                    {t("landing.cookies", "Cookies")}
                  </Link>
                </div>
                <div className="flex items-center gap-3.5 text-[var(--muted-text)]">
                  <a
                    href="https://x.com/NastaJobs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--primary)]"
                    aria-label="X"
                  >
                    <svg
                      className="h-[18px] w-[18px]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.linkedin.com/company/112877399/admin/dashboard/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--primary)]"
                    aria-label="LinkedIn"
                  >
                    <svg
                      className="h-[18px] w-[18px]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/nastajobs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--primary)]"
                    aria-label="Instagram"
                  >
                    <svg
                      className="h-[18px] w-[18px]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.facebook.com/profile.php?id=61576433085774"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-[var(--primary)]"
                    aria-label="Facebook"
                  >
                    <svg
                      className="h-[18px] w-[18px]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
