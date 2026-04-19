"use client";
import PublicTopbar from "../../components/public/PublicTopbar";
import BackButton from "../../components/navigation/BackButton";
import LegalContent from "../../components/public/LegalContent";
import { getLegalText } from "../../lib/legal-text";
import { useLanguage } from "../../context/LanguageContext";

export default function CookiesPage() {
  const { language } = useLanguage();
  const legal = getLegalText(language);

  return (
    <div className="min-h-screen bg-brand-gradient text-[var(--foreground)]">
      <PublicTopbar />
      <main className="mx-auto max-w-4xl px-4 pt-24 pb-16">
        <div className="mb-6">
          <BackButton fallback="/" />
        </div>
        <div className="legal-card">
          <LegalContent content={legal.COOKIES} />
        </div>
      </main>
    </div>
  );
}
