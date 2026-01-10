import Constants from "expo-constants";
import { Platform } from "react-native";

// Track if we've already logged which base URL is used
let hasWarnedAboutApiBase = false;

export function getApiBase(): string {
  // 1) Explicit override via env (recommended)
  // Prefer EXPO_PUBLIC_API_URL, but keep EXPO_PUBLIC_API_BASE_URL for backward compatibility.
  const envBase =
    process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBase) {
    console.log(`[API] Using env API base URL: ${envBase}`);
    return envBase.replace(/\/$/, "");
  }

  // Check if there's a configured API base URL in app.json
  const appJsonBase = (Constants.expoConfig as any)?.extra?.apiBaseURL as
    | string
    | undefined;

  // 3) Optional base from app.json
  if (appJsonBase) {
    if (!hasWarnedAboutApiBase) {
      console.log(`[API] Using configured URL from app.json: ${appJsonBase}`);
      hasWarnedAboutApiBase = true;
    }
    return appJsonBase.replace(/\/$/, "");
  }

  // 4) Production default
  const prodBase = "https://api.cumprido.com";
  if (__DEV__ && !hasWarnedAboutApiBase) {
    hasWarnedAboutApiBase = true;
    console.log(
      `[API] Using production API base by default: ${prodBase}. ` +
        `For local dev, set EXPO_PUBLIC_API_URL (or EXPO_PUBLIC_API_BASE_URL).`
    );
  }

  // Keep Platform import usage to avoid unused warnings in some TS configs.
  void Platform.OS;
  return prodBase;
}
