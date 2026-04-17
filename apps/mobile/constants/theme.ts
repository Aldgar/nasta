/**
 * Piye Mission Control — Dual-Theme Architecture
 * DARK = "Deep Navy & Gold"  |  LIGHT = "Golden Lab"
 */

import { Platform } from "react-native";

const tintColorLight = "#B8822A";
const tintColorDark = "#C9963F";

export const Colors = {
  light: {
    text: "#1A1710",
    background: "#F5E6C8",
    tint: tintColorLight,
    icon: "#6B6355",
    tabIconDefault: "#8A8278",
    tabIconSelected: tintColorLight,
    // HUD tokens — Golden Lab
    surface: "rgba(255, 250, 240, 0.92)",
    surfaceAlt: "#F0E0C0",
    gold: "#B8822A",
    goldAccent: "#C9963F",
    goldLight: "#E8B86D",
    border: "#D4A24E",
    textMuted: "#6B6355",
    cardBg: "rgba(255, 250, 240, 0.92)",
    navy: "#0A1628",
    // HUD-specific
    panel: "rgba(255, 250, 240, 0.92)",
    panelBorder: "rgba(212, 162, 78, 0.5)",
    ledGreen: "#10B981",
    ledAmber: "#F59E0B",
    ledGlow: "rgba(184, 130, 42, 0.2)",
    // Accent colors — fresh palette
    teal: "#0891B2",
    cyan: "#06B6D4",
    emerald: "#059669",
    rose: "#E11D48",
    coral: "#F43F5E",
    violet: "#7C3AED",
    lavender: "#8B5CF6",
    sky: "#0284C7",
    input: "rgba(255, 255, 255, 0.95)",
    inputBorder: "rgba(184, 130, 42, 0.3)",
    placeholder: "#94a3b8",
    subtle: "rgba(184, 130, 42, 0.06)",
    danger: "#EF4444",
  },
  dark: {
    text: "#F0E8D5",
    background: "#0A1628",
    tint: tintColorDark,
    icon: "#7A7265",
    tabIconDefault: "#5A5348",
    tabIconSelected: tintColorDark,
    // HUD tokens — Deep Navy & Gold
    surface: "rgba(12, 22, 42, 0.85)",
    surfaceAlt: "#0D1A30",
    gold: "#C9963F",
    goldAccent: "#E8B86D",
    goldLight: "#F0E8D5",
    border: "rgba(201, 150, 63, 0.3)",
    textMuted: "rgba(240, 232, 213, 0.5)",
    cardBg: "rgba(12, 22, 42, 0.85)",
    navy: "#0A1628",
    // HUD-specific
    panel: "rgba(12, 22, 42, 0.85)",
    panelBorder: "rgba(201, 150, 63, 0.3)",
    ledGreen: "#22c55e",
    ledAmber: "#F59E0B",
    ledGlow: "rgba(201, 150, 63, 0.15)",
    // Accent colors — fresh palette
    teal: "#14B8A6",
    cyan: "#22D3EE",
    emerald: "#10B981",
    rose: "#FB7185",
    coral: "#F43F5E",
    violet: "#A78BFA",
    lavender: "#C4B5FD",
    sky: "#38BDF8",
    input: "rgba(255, 255, 255, 0.12)",
    inputBorder: "rgba(201, 150, 63, 0.2)",
    placeholder: "#9ca3af",
    subtle: "rgba(201, 150, 63, 0.08)",
    danger: "#EF4444",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
