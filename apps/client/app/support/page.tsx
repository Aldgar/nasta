"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import PublicTopbar from "../../components/public/PublicTopbar";
import { useLanguage } from "../../context/LanguageContext";

type Department = "support" | "policy";

function ContactForm() {
  const { t } = useLanguage();
  const [dept, setDept] = useState<Department>("support");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const recipient =
    dept === "support" ? "support@nasta.app" : "policy@nasta.app";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Department selector */}
      <div>
        <label className="mb-2 block text-sm font-medium">{t("supportPage.department", "Department")}</label>
        <div className="flex gap-3">
          {(["support", "policy"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                dept === d
                  ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--muted-text)] hover:border-[var(--border-color)]"
              }`}
            >
              {d === "support" ? t("supportPage.generalSupport", "General Support") : t("supportPage.policyLegal", "Policy & Legal")}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted-text)]">
          {t("supportPage.sendingTo", "Sending to")} {recipient}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-2 block text-sm font-medium">
            {t("supportPage.name", "Name")}
          </label>
          <input
            id="c-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("supportPage.namePlaceholder", "Your full name")}
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="c-email" className="mb-2 block text-sm font-medium">
            {t("supportPage.email", "Email")}
          </label>
          <input
            id="c-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("supportPage.emailPlaceholder", "you@example.com")}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="c-subject" className="mb-2 block text-sm font-medium">
          {t("supportPage.subject", "Subject")}
        </label>
        <input
          id="c-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("supportPage.subjectPlaceholder", "Brief summary of your inquiry")}
          className="input-field"
        />
      </div>

      <div>
        <label htmlFor="c-message" className="mb-2 block text-sm font-medium">
          {t("supportPage.message", "Message")}
        </label>
        <textarea
          id="c-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("supportPage.messagePlaceholder", "Describe your question or issue in detail...")}
          className="input-field resize-none"
        />
      </div>

      <button
        type="submit"
        className="btn-glow inline-flex items-center rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110 hover:shadow-[0_4px_24px_rgba(201,150,63,0.3)]"
      >
        {sent ? t("supportPage.openingEmailClient", "Opening email client...") : t("supportPage.sendMessage", "Send Message")}
        {!sent && (
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
  );
}

function FeatureRequestForm() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = `Name: ${name}\nEmail: ${email}\n\nFeature: ${title}\n\n${description}`;
    window.location.href = `mailto:feature-request@nasta.app?subject=${encodeURIComponent(`Feature Request: ${title}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="f-name" className="mb-2 block text-sm font-medium">
            {t("supportPage.name", "Name")}
          </label>
          <input
            id="f-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("supportPage.namePlaceholder", "Your full name")}
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="f-email" className="mb-2 block text-sm font-medium">
            {t("supportPage.email", "Email")}
          </label>
          <input
            id="f-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("supportPage.emailPlaceholder", "you@example.com")}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="f-title" className="mb-2 block text-sm font-medium">
          {t("supportPage.featureTitle", "Feature Title")}
        </label>
        <input
          id="f-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("supportPage.featureTitlePlaceholder", "e.g. Add scheduling for recurring jobs")}
          className="input-field"
        />
      </div>

      <div>
        <label htmlFor="f-desc" className="mb-2 block text-sm font-medium">
          {t("supportPage.description", "Description")}
        </label>
        <textarea
          id="f-desc"
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("supportPage.descriptionPlaceholder", "Describe the feature, why it would be useful, and any details that help us understand your idea...")}
          className="input-field resize-none"
        />
      </div>

      <button
        type="submit"
        className="btn-glow inline-flex items-center rounded-xl bg-gradient-to-b from-[var(--primary)] to-[#96691E] border border-white/10 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110 hover:shadow-[0_4px_24px_rgba(201,150,63,0.3)]"
      >
        {sent ? t("supportPage.openingEmailClient", "Opening email client...") : t("supportPage.submitRequest", "Submit Request")}
        {!sent && (
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
              d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
        )}
      </button>
    </form>
  );
}

export default function SupportPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-brand-gradient text-[var(--foreground)]">
      <PublicTopbar />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--muted-text)] transition-colors hover:text-[var(--foreground)]"
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
          {t("common.back", "Back")}
        </Link>

        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("supportPage.title", "Support")}
        </h1>
        <p className="mb-10 text-base text-[var(--muted-text)]">
          {t("supportPage.subtitle", "Need help? We are here for you. Choose a topic below or send us a message.")}
        </p>

        {/* Quick links */}
        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <Link
            href="/faq"
            className="group flex items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-all duration-300 hover:border-[var(--primary)]/40 hover:bg-[var(--card-hover-bg)]"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/15">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t("supportPage.faqsTitle", "FAQs")}</h3>
              <p className="text-xs text-[var(--muted-text)]">
                {t("supportPage.faqsDesc", "Browse common questions")}
              </p>
            </div>
          </Link>
          <Link
            href="/delete-account"
            className="group flex items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 backdrop-blur-sm transition-all duration-300 hover:border-[var(--border-color)] hover:bg-[var(--card-hover-bg)]"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--alert-red)]/10 text-[var(--alert-red)] ring-1 ring-[var(--alert-red)]/15">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t("supportPage.deleteAccountTitle", "Delete Account")}</h3>
              <p className="text-xs text-[var(--muted-text)]">
                {t("supportPage.deleteAccountDesc", "Request permanent deletion")}
              </p>
            </div>
          </Link>
        </div>

        {/* ── Contact Us Form ── */}
        <section className="mb-16">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t("supportPage.contactUsTitle", "Contact Us")}</h2>
              <p className="text-sm text-[var(--muted-text)]">
                {t("supportPage.contactUsDesc", "For general support or policy inquiries")}
              </p>
            </div>
          </div>
          <div className="form-card">
            <ContactForm />
          </div>
        </section>

        {/* ── Feature Request Form ── */}
        <section className="mb-16">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <svg
                className="h-5 w-5"
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
              <h2 className="text-xl font-bold tracking-tight">
                {t("supportPage.featureRequestTitle", "Feature Request")}
              </h2>
              <p className="text-sm text-[var(--muted-text)]">
                {t("supportPage.featureRequestDesc", "Suggest a new feature or improvement. Sends to feature-request@nasta.app")}
              </p>
            </div>
          </div>
          <div className="form-card">
            <FeatureRequestForm />
          </div>
        </section>
      </main>
    </div>
  );
}
