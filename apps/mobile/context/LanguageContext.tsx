import React, { createContext, useContext, useState, useEffect } from "react";
import { NativeModules, Platform } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as SecureStore from "expo-secure-store";

// Try to import expo-localization, fallback to React Native if not available
let Localization: any = null;
try {
  Localization = require("expo-localization");
} catch (e) {
  // Fallback: use React Native's locale detection
  console.warn("expo-localization not available, using fallback");
}

import enTranslations from "../locales/en.json";
import ptTranslations from "../locales/pt.json";

type Language = "en" | "pt";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, options?: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Initialize i18next
i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: enTranslations },
    pt: { translation: ptTranslations },
  },
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isReady, setIsReady] = useState(false);

  // Auto-detect device language on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // First, check if user has saved a language preference
        const savedLanguage = await SecureStore.getItemAsync("app_language");

        if (
          savedLanguage &&
          (savedLanguage === "en" || savedLanguage === "pt")
        ) {
          // Use saved preference
          await changeLanguage(savedLanguage as Language, false);
        } else {
          // Auto-detect from device
          let deviceLanguage = "en";

          if (Localization && Localization.getLocales) {
            // Use expo-localization if available
            const deviceLocale = Localization.getLocales()[0];
            deviceLanguage = deviceLocale?.languageCode || "en";
          } else {
            // Fallback: use React Native's locale
            const locale =
              Platform.OS === "ios"
                ? NativeModules.SettingsManager?.settings?.AppleLocale ||
                  NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
                : NativeModules.I18nManager?.localeIdentifier;

            if (locale) {
              deviceLanguage = locale.split("_")[0].split("-")[0].toLowerCase();
            }
          }

          // If device language is Portuguese (pt), use Portuguese, otherwise default to English
          const detectedLanguage: Language = deviceLanguage.startsWith("pt")
            ? "pt"
            : "en";
          await changeLanguage(detectedLanguage, false);
        }
      } catch (error) {
        console.error("Error initializing language:", error);
        // Fallback to English
        await changeLanguage("en", false);
      } finally {
        setIsReady(true);
      }
    };

    initializeLanguage();
  }, []);

  const changeLanguage = async (lang: Language, save: boolean = true) => {
    try {
      setLanguageState(lang);
      await i18n.changeLanguage(lang);

      if (save) {
        await SecureStore.setItemAsync("app_language", lang);
      }
    } catch (error) {
      console.error("Error changing language:", error);
    }
  };

  const setLanguage = async (lang: Language) => {
    await changeLanguage(lang, true);
  };

  const t = (key: string, options?: any): string => {
    return String(i18n.t(key, options));
  };

  const value = {
    language,
    setLanguage,
    t,
  };

  // Don't render children until language is initialized
  if (!isReady) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// Export i18n instance for direct use if needed
export { i18n };
