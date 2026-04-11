import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Colors } from "@/constants/theme";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "pref_theme";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorScheme: "light" | "dark";
  colors: typeof Colors.light;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<Theme>("dark");

  // Load persisted theme on mount
  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeState(saved);
      }
    });
  }, []);

  // Persist theme when changed
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    SecureStore.setItemAsync(THEME_STORAGE_KEY, newTheme);
  };

  const colorScheme =
    theme === "system" ? (systemColorScheme ?? "dark") : theme;

  const value = {
    theme,
    setTheme,
    colorScheme,
    colors: Colors[colorScheme],
    isDark: colorScheme === "dark",
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
