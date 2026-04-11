"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "../../lib/api";
import { useAuth, type Role } from "../../lib/auth";
import { useLanguage } from "../../context/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [role, setRole] = useState<Role>("JOB_SEEKER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError(
        t(
          "web.login.missingCredentials",
          "Please enter your email and password.",
        ),
      );
      return;
    }
    setLoading(true);

    const endpoint =
      role === "ADMIN"
        ? "/auth/admin/login"
        : role === "EMPLOYER"
          ? "/auth/employer/login"
          : "/auth/user/login";

    try {
      const res = await api<Record<string, unknown>>(endpoint, {
        method: "POST",
        body: { email: trimmed, password },
      });

      if (res.error || !res.data) {
        setError(
          res.error ??
            t("web.login.invalidCredentials", "Invalid email or password."),
        );
        setLoading(false);
        return;
      }

      const data = res.data;
      const token = data.accessToken as string;
      const who = (data.user ?? data.admin) as
        | Record<string, unknown>
        | undefined;

      if (!token) {
        setError(t("web.login.noToken", "Login failed — no token received."));
        setLoading(false);
        return;
      }

      login(token, {
        id: (who?.id ?? who?._id ?? "") as string,
        email: (who?.email ?? trimmed) as string,
        role: (who?.role as Role) ?? role,
        firstName: (who?.firstName ?? "") as string,
        lastName: (who?.lastName ?? "") as string,
        displayName: (who?.displayName ?? who?.firstName ?? "") as string,
      });
    } catch {
      setError(
        t("web.login.networkError", "Network error — check your connection."),
      );
      setLoading(false);
    }
  };

  const roles: { value: Role; label: string; desc: string }[] = [
    {
      value: "JOB_SEEKER",
      label: t("web.login.serviceProvider", "Service Provider"),
      desc: t("web.login.spDesc", "Find work opportunities"),
    },
    {
      value: "EMPLOYER",
      label: t("web.login.employer", "Employer"),
      desc: t("web.login.empDesc", "Post jobs & hire talent"),
    },
    {
      value: "ADMIN",
      label: t("web.login.admin", "Admin"),
      desc: t("web.login.adminDesc", "Platform management"),
    },
  ];

  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Nasta home">
            <Image
              src="/NastaLogoLight.png"
              alt="Nasta"
              width={140}
              height={140}
              priority
              className="animate-float-slow"
            />
          </Link>
        </div>

        {/* Card */}
        <div className="glass-surface rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--gentle-peach)]">
            {t("web.login.welcomeBack", "Welcome back")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {t("web.login.signInToMission", "Sign in to your mission control.")}
          </p>

          {/* Role selector */}
          <div className="mt-6 flex gap-2">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  role === r.value
                    ? "bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20"
                    : "bg-[var(--surface-alt)] text-[var(--muted-text)] hover:bg-[var(--border-color)]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-text)]">
            {roles.find((r) => r.value === role)?.desc}
          </p>

          {/* Form */}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                {t("web.login.email", "Email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                {t("web.login.password", "Password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)] hover:text-[var(--foreground)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--soft-blue)] hover:text-[var(--warm-coral)] transition-colors"
              >
                {t("web.login.forgotPassword", "Forgot password?")}
              </Link>
            </div>

            {error && (
              <div className="rounded-lg border border-[var(--alert-red)]/30 bg-[var(--alert-red)]/10 px-3 py-2 text-sm text-[var(--alert-red)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--soft-blue)] hover:shadow-lg hover:shadow-[var(--primary)]/20 disabled:opacity-50"
            >
              {loading
                ? t("web.login.signingIn", "Signing in…")
                : t("web.login.signIn", "Sign in")}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-[var(--muted-text)]">
            {t("web.login.noAccount", "Don't have an account?")}{" "}
            <Link
              href="/register"
              className="font-semibold text-[var(--soft-blue)] hover:text-[var(--warm-coral)] transition-colors"
            >
              {t("web.login.createOne", "Create one")}
            </Link>
          </p>
        </div>

        {/* Back to landing */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-text)] transition-colors hover:text-white"
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
            {t("web.login.backToHome", "Back to Home")}
          </Link>
        </div>

        {/* Footer links */}
        <div className="mt-4 flex justify-center gap-4 text-xs text-[var(--muted-text)]">
          <Link
            href="/terms"
            className="hover:text-[var(--soft-blue)] transition-colors"
          >
            {t("web.login.terms", "Terms")}
          </Link>
          <Link
            href="/privacy"
            className="hover:text-[var(--soft-blue)] transition-colors"
          >
            {t("web.login.privacy", "Privacy")}
          </Link>
          <Link
            href="/platform-rules"
            className="hover:text-[var(--soft-blue)] transition-colors"
          >
            {t("web.login.rules", "Rules")}
          </Link>
        </div>
      </div>
    </div>
  );
}
