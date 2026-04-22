"use client";
import "../lib/i18n";
import { AuthProvider } from "../lib/auth";
import { LanguageProvider } from "../context/LanguageContext";
import { TitleManager } from "../components/TitleManager";
import CookieConsent from "../components/consent/CookieConsent";

export function AuthProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TitleManager />
        {children}
        <CookieConsent />
      </AuthProvider>
    </LanguageProvider>
  );
}
