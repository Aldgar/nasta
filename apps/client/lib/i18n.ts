import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import pt from "../locales/pt.json";

const STORAGE_KEY = "app_language";

function getSavedLanguage(): string {
  if (typeof window === "undefined") return "en";
  try {
    return localStorage.getItem(STORAGE_KEY) || detectBrowserLanguage();
  } catch {
    return "en";
  }
}

function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || "";
  return lang.startsWith("pt") ? "pt" : "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pt: { translation: pt } },
  lng: "en", // always start with "en" so SSR and initial client render match
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

/** Call this client-side (inside useEffect) to get the user's saved/detected language. */
export function getInitialLanguage(): string {
  return getSavedLanguage();
}

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
}

export default i18n;
