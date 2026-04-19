"use client";
import { useState, type FormEvent } from "react";
import PublicTopbar from "../../components/public/PublicTopbar";
import BackButton from "../../components/navigation/BackButton";
import { useLanguage } from "../../context/LanguageContext";
import { API_BASE } from "../../lib/api";

export default function FeatureRequestPage() {
  const { t, language } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/support/feature-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, title, description, language }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? res.statusText);
      }

      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-gradient text-[var(--foreground)]">
      <PublicTopbar />
      <main className="mx-auto max-w-2xl px-4 pt-24 pb-16">
        <div className="mb-6">
          <BackButton fallback="/" />
        </div>

        <div className="legal-card">
          {submitted ? (
            /* ── Thank-you state ── */
            <div className="text-center py-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="mb-3 text-2xl font-bold">
                {t(
                  "featureRequest.thankYouTitle",
                  "Thank You for Your Request!",
                )}
              </h1>
              <p className="mx-auto max-w-md text-[var(--muted-text)] leading-relaxed">
                {t(
                  "featureRequest.thankYouMessage",
                  "We truly appreciate you taking the time to suggest improvements. Your ideas help us build a better platform for everyone.",
                )}
              </p>
              <p className="mt-4 text-sm text-[var(--muted-text)]">
                {t(
                  "featureRequest.confirmationSent",
                  "A confirmation has been sent to",
                )}{" "}
                <span className="font-medium text-[var(--primary)]">
                  {email}
                </span>
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              {/* Header */}
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
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
                      d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    {t("featureRequest.title", "Feature Request")}
                  </h1>
                  <p className="text-sm text-[var(--muted-text)]">
                    {t(
                      "featureRequest.subtitle",
                      "Suggest a new feature or improvement for the platform",
                    )}
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fr-name"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {t("supportPage.name", "Name")}
                    </label>
                    <input
                      id="fr-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t(
                        "supportPage.namePlaceholder",
                        "Your full name",
                      )}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fr-email"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      {t("supportPage.email", "Email")}
                    </label>
                    <input
                      id="fr-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t(
                        "supportPage.emailPlaceholder",
                        "you@example.com",
                      )}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="fr-title"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    {t("supportPage.featureTitle", "Feature Title")}
                  </label>
                  <input
                    id="fr-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t(
                      "supportPage.featureTitlePlaceholder",
                      "e.g. Add scheduling for recurring jobs",
                    )}
                    className="input-field"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fr-desc"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    {t("supportPage.description", "Description")}
                  </label>
                  <textarea
                    id="fr-desc"
                    required
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t(
                      "supportPage.descriptionPlaceholder",
                      "Describe the feature, why it would be useful, and any details that help us understand your idea...",
                    )}
                    className="input-field resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-glow inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110 hover:shadow-[0_4px_24px_rgba(201,150,63,0.3)] disabled:opacity-60"
                >
                  {submitting
                    ? t("featureRequest.submitting", "Submitting...")
                    : t("supportPage.submitRequest", "Submit Request")}
                  {!submitting && (
                    <svg
                      className="ml-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
