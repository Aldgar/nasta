import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { useRouter, useFocusEffect } from "expo-router";

interface Action {
  id: string;
  ticketNumber?: string;
  actionType: "LEGAL_ACTION" | "WARNING" | "ACTION_FORM" | "REQUEST_INFO";
  actionData: {
    actionType?: string;
    reason?: string;
    warningType?: string;
    message?: string;
    details?: string;
  };
  status: string;
  isActive: boolean;
  createdAt: string;
}

export default function ActionBanner() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveActions = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }

      const base = getApiBase();
      const url = `${base}/users/me/actions`;

      if (__DEV__) {
        console.log(`[ActionBanner] Fetching actions from: ${url}`);
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Find the first active action
        const active = data.actions?.find((a: Action) => a.isActive);
        setActiveAction(active || null);
      } else if (res.status === 401) {
        // Token is invalid or expired - silently fail, don't show banner
        setActiveAction(null);
      } else {
        // Other errors - silently fail
        setActiveAction(null);
      }
    } catch (error: any) {
      // Only log network errors in dev mode to avoid spam
      if (__DEV__) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes("Network request failed")) {
          // Only log once per session to avoid spam
          if (!(global as any).__actionBannerNetworkErrorLogged) {
            (global as any).__actionBannerNetworkErrorLogged = true;
            console.warn(
              `[ActionBanner] Network request failed. Server may not be accessible from emulator. ` +
                `API Base: ${getApiBase()}. ` +
                `Make sure your server is running and accessible. This error will be logged once.`
            );
          }
        } else {
          console.error("[ActionBanner] Error fetching active actions:", error);
        }
      }
      // Silently fail - don't show banner if we can't fetch actions
      setActiveAction(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveActions();
    // Refresh every 60 seconds (reduced frequency)
    const interval = setInterval(fetchActiveActions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchActiveActions();
    }, [])
  );

  if (loading || !activeAction) {
    return null;
  }

  const getActionConfig = () => {
    switch (activeAction.actionType) {
      case "LEGAL_ACTION":
        return {
          icon: "briefcase",
          color: "#8b5cf6",
          bgColor: isDark
            ? "rgba(139, 92, 246, 0.2)"
            : "rgba(139, 92, 246, 0.1)",
          borderColor: isDark
            ? "rgba(139, 92, 246, 0.4)"
            : "rgba(139, 92, 246, 0.3)",
          title: `${t("actionBanner.legalAction")}: ${activeAction.actionData.actionType || t("actionBanner.actionRequired")}`,
          message:
            activeAction.actionData.reason || t("actionBanner.reviewDetails"),
        };
      case "WARNING":
        return {
          icon: "alert-triangle",
          color: "#f59e0b",
          bgColor: isDark
            ? "rgba(245, 158, 11, 0.2)"
            : "rgba(245, 158, 11, 0.1)",
          borderColor: isDark
            ? "rgba(245, 158, 11, 0.4)"
            : "rgba(245, 158, 11, 0.3)",
          title: `${t("actionBanner.warning")}: ${activeAction.actionData.warningType || t("actionBanner.actionRequired")}`,
          message:
            activeAction.actionData.message || t("actionBanner.reviewWarning"),
        };
      case "ACTION_FORM":
        return {
          icon: "file-text",
          color: "#10b981",
          bgColor: isDark
            ? "rgba(16, 185, 129, 0.2)"
            : "rgba(16, 185, 129, 0.1)",
          borderColor: isDark
            ? "rgba(16, 185, 129, 0.4)"
            : "rgba(16, 185, 129, 0.3)",
          title: `${t("actionBanner.actionForm")}: ${activeAction.actionData.actionType || t("actionBanner.reviewRequired")}`,
          message:
            activeAction.actionData.details || t("actionBanner.reviewDetails"),
        };
      case "REQUEST_INFO":
        return {
          icon: "info",
          color: "#6366f1",
          bgColor: isDark
            ? "rgba(99, 102, 241, 0.2)"
            : "rgba(99, 102, 241, 0.1)",
          borderColor: isDark
            ? "rgba(99, 102, 241, 0.4)"
            : "rgba(99, 102, 241, 0.3)",
          title: t("actionBanner.informationRequest"),
          message:
            (activeAction.actionData as any)?.request ||
            t("actionBanner.provideRequestedInformation"),
        };
      default:
        return {
          icon: "alert-circle",
          color: colors.tint,
          bgColor: isDark
            ? "rgba(99, 102, 241, 0.2)"
            : "rgba(99, 102, 241, 0.1)",
          borderColor: isDark
            ? "rgba(99, 102, 241, 0.4)"
            : "rgba(99, 102, 241, 0.3)",
          title: t("actionBanner.actionRequired"),
          message: t("actionBanner.reviewAction"),
        };
    }
  };

  const config = getActionConfig();

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          borderLeftWidth: 4,
        },
      ]}
      onPress={() => {
        // Navigate to notifications or a detail page
        router.push("/(tabs)/notifications");
      }}
      activeOpacity={0.7}
    >
      <View style={styles.bannerContent}>
        <View
          style={[styles.iconContainer, { backgroundColor: config.bgColor }]}
        >
          <Feather name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {config.title}
          </Text>
          <Text
            style={[
              styles.message,
              { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
            ]}
            numberOfLines={2}
          >
            {config.message}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={config.color} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
});
