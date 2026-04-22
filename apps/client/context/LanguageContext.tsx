"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  setLanguage as setI18nLanguage,
  getInitialLanguage,
} from "../lib/i18n";

interface LanguageContextValue {
  language: string;
  setLanguage: (lng: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  // Start with "en" to match SSR, then switch to saved language after hydration
  const [language, setLang] = useState("en");

  const setLanguage = useCallback((lng: string) => {
    setI18nLanguage(lng);
    setLang(lng);
  }, []);

  // Apply saved/detected language after hydration to avoid SSR mismatch
  useEffect(() => {
    const saved = getInitialLanguage();
    if (saved !== "en") {
      setI18nLanguage(saved);
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    const handler = (lng: string) => setLang(lng);
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, [i18n]);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: t as LanguageContextValue["t"] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
