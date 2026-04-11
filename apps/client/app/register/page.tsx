"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "../../lib/api";
import { useAuth, type Role } from "../../lib/auth";
import { useLanguage } from "../../context/LanguageContext";

export default function RegisterPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [role, setRole] = useState<Role>("JOB_SEEKER");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength
  const strength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();
  const strengthLabel =
    [
      "",
      t("web.register.passwordStrength.weak", "Weak"),
      t("web.register.passwordStrength.fair", "Fair"),
      t("web.register.passwordStrength.good", "Good"),
      t("web.register.passwordStrength.strong", "Strong"),
    ][strength] ?? "";
  const strengthColor =
    [
      "",
      "bg-[var(--alert-red)]",
      "bg-orange-500",
      "bg-[var(--soft-blue)]",
      "bg-[var(--achievement-green)]",
    ][strength] ?? "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError(t("web.register.fillAllFields", "All fields are required."));
      return;
    }
    if (password.length < 8) {
      setError(
        t(
          "web.register.passwordReqs.minLength",
          "Password must be at least 8 characters.",
        ),
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(t("web.register.passwordMismatch", "Passwords do not match."));
      return;
    }

    setLoading(true);
    try {
      const res = await api<Record<string, unknown>>("/auth/register", {
        method: "POST",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          role,
        },
      });

      if (res.error || !res.data) {
        setError(
          res.error ?? t("auth.registrationError", "Registration failed."),
        );
        setLoading(false);
        return;
      }

      const data = res.data;
      const token = data.accessToken as string;
      const who = (data.user ?? data) as Record<string, unknown>;

      if (!token) {
        setError("Registration succeeded but no token received.");
        setLoading(false);
        return;
      }

      login(token, {
        id: (who.id ?? who._id ?? "") as string,
        email: (who.email ?? email.trim()) as string,
        role: (who.role as Role) ?? role,
        firstName: (who.firstName ?? firstName.trim()) as string,
        lastName: (who.lastName ?? lastName.trim()) as string,
      });
    } catch {
      setError(
        t(
          "web.register.networkError",
          "Network error — check your connection.",
        ),
      );
      setLoading(false);
    }
  };

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
            {t("web.register.createAccount", "Create your account")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {t("web.register.startYourJourney", "Join the Nasta platform.")}
          </p>

          {/* Role selector */}
          <div className="mt-6 flex gap-2">
            {(
              [
                {
                  value: "JOB_SEEKER" as Role,
                  label: t("web.register.serviceProvider", "Service Provider"),
                },
                {
                  value: "EMPLOYER" as Role,
                  label: t("web.register.employer", "Employer"),
                },
              ] as const
            ).map((r) => (
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

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                  {t("web.register.firstName", "First Name")}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                  {t("web.register.lastName", "Last Name")}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                {t("web.register.email", "Email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                {t("web.register.password", "Password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                  placeholder="••••••••"
                  autoComplete="new-password"
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
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength
                            ? strengthColor
                            : "bg-[var(--border-color)]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    {strengthLabel}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-text)] uppercase tracking-wider">
                {t("web.register.confirmPassword", "Confirm Password")}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-text)] hover:text-[var(--foreground)] transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
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
                ? t("web.register.creating", "Creating account…")
                : t("web.register.createAccountBtn", "Create account")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted-text)]">
            {t("web.register.alreadyHaveAccount", "Already have an account?")}{" "}
            <Link
              href="/login"
              className="font-semibold text-[var(--soft-blue)] hover:text-[var(--warm-coral)] transition-colors"
            >
              {t("web.register.signIn", "Sign in")}
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-[var(--muted-text)]">
            {t(
              "web.register.byCreating",
              "By creating an account, you agree to our",
            )}{" "}
            <Link
              href="/terms"
              className="underline hover:text-[var(--soft-blue)]"
            >
              {t("web.register.termsLink", "Terms")}
            </Link>{" "}
            {t("web.register.and", "and")}{" "}
            <Link
              href="/privacy"
              className="underline hover:text-[var(--soft-blue)]"
            >
              {t("web.register.privacyLink", "Privacy Policy")}
            </Link>
            .
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
            {t("web.register.backToHome", "Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
