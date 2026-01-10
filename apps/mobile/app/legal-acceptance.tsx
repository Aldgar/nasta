import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getLegalDocument } from "../lib/legal-text";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";

interface LegalPage {
  title: string;
  content: string;
  key: string;
}

export default function LegalAcceptanceScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams();
  const role = (params.role as "JOB_SEEKER" | "EMPLOYER") || "JOB_SEEKER";

  const legalPages: LegalPage[] = useMemo(
    () => [
      {
        title: t("legal.pages.termsAndConditions"),
        content: getLegalDocument("TERMS_OF_SERVICE", language),
        key: "terms",
      },
      {
        title: t("legal.pages.privacyPolicy"),
        content: getLegalDocument("PRIVACY_POLICY", language),
        key: "privacy",
      },
      {
        title: t("legal.pages.cookiesSettings"),
        content: getLegalDocument("COOKIES", language),
        key: "cookies",
      },
      {
        title: t("legal.pages.platformRules"),
        content: getLegalDocument("PLATFORM_RULES", language),
        key: "platform_rules",
      },
    ],
    [t, language]
  );

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [acceptedPages, setAcceptedPages] = useState<Set<string>>(new Set());
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    // Always start from the first page when component mounts
    setCurrentPageIndex(0);
    setScrolledToBottom(false);
    loadAcceptedPages();
    loadCookiePreferences();
  }, []);

  const loadCookiePreferences = async () => {
    try {
      const analytics = await SecureStore.getItemAsync("cookie_analytics");
      const marketing = await SecureStore.getItemAsync("cookie_marketing");
      if (analytics !== null) setAnalyticsEnabled(analytics === "true");
      if (marketing !== null) setMarketingEnabled(marketing === "true");
    } catch (error) {
      console.error("Error loading cookie preferences:", error);
    }
  };

  const handleAnalyticsToggle = (value: boolean) => {
    setAnalyticsEnabled(value);
    SecureStore.setItemAsync("cookie_analytics", value.toString());
  };

  const handleMarketingToggle = (value: boolean) => {
    setMarketingEnabled(value);
    SecureStore.setItemAsync("cookie_marketing", value.toString());
  };

  const loadAcceptedPages = async () => {
    try {
      const accepted = new Set<string>();
      for (const page of legalPages) {
        const key = `legal_accepted_${page.key}`;
        const acceptedAt = await SecureStore.getItemAsync(key);
        if (acceptedAt) {
          accepted.add(page.key);
        }
      }
      setAcceptedPages(accepted);
    } catch (error) {
      console.error("Error loading accepted pages:", error);
    }
  };

  const handleAccept = async (pageKey: string) => {
    try {
      // Map page key to API endpoint
      const endpointMap: Record<string, string> = {
        terms: "accept-terms",
        privacy: "accept-privacy",
        cookies: "accept-cookies", // Note: This might not exist in backend yet
        platform_rules: "accept-platform-rules",
      };

      const endpoint = endpointMap[pageKey];
      // For cookies, we might not have a backend endpoint yet, so skip API call but continue
      if (!endpoint && pageKey !== "cookies") {
        console.error("Unknown page key:", pageKey);
        return;
      }

      // Try to save to backend if user is logged in
      // Retry getting token with small delay in case it's still being stored
      let token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        // Wait a bit and retry - token might still be storing from registration
        await new Promise((resolve) => setTimeout(resolve, 300));
        token = await SecureStore.getItemAsync("auth_token");
      }

      if (token && endpoint) {
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/users/me/legal/${endpoint}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            const errorText = await res.text();
            // Only log error if it's not a 401 (token might still be storing)
            if (res.status !== 401) {
              console.error("Backend acceptance failed:", errorText);
            }
            // Continue with local storage as fallback
          }
        } catch (apiError) {
          console.error("Error calling backend API:", apiError);
          // Continue with local storage as fallback
        }
      }

      // Also save locally for offline access
      const acceptKey = `legal_accepted_${pageKey}`;
      await SecureStore.setItemAsync(acceptKey, new Date().toISOString());
      setAcceptedPages(new Set([...acceptedPages, pageKey]));

      // Move to next page
      if (currentPageIndex < legalPages.length - 1) {
        setCurrentPageIndex(currentPageIndex + 1);
        setScrolledToBottom(false);
      } else {
        // All pages accepted, proceed to registration
        handleAllAccepted();
      }
    } catch (error) {
      console.error("Error saving acceptance:", error);
      Alert.alert(t("common.error"), t("legal.failedToSaveAcceptance"));
    }
  };

  const handleAllAccepted = () => {
    // All legal pages accepted, navigate to appropriate next step
    if (role === "JOB_SEEKER") {
      // Service providers go to KYC verification
      router.replace("/kyc-start" as never);
    } else {
      // Employers go to their home page
      router.replace("/employer-home" as never);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setScrolledToBottom(isAtBottom);
  };

  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactElement[] = [];
    let key = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<View key={key++} style={{ height: 12 }} />);
        return;
      }

      if (trimmed.startsWith("# ")) {
        elements.push(
          <Text key={key++} style={[styles.h1, { color: colors.text }]}>
            {trimmed.substring(2)}
          </Text>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <Text key={key++} style={[styles.h2, { color: colors.text }]}>
            {trimmed.substring(3)}
          </Text>
        );
      } else if (trimmed.startsWith("### ")) {
        elements.push(
          <Text key={key++} style={[styles.h3, { color: colors.text }]}>
            {trimmed.substring(4)}
          </Text>
        );
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        const boldText = trimmed.substring(2, trimmed.length - 2);
        elements.push(
          <Text key={key++} style={[styles.bold, { color: colors.text }]}>
            {boldText}
          </Text>
        );
      } else if (trimmed.startsWith("- ")) {
        const listText = trimmed.substring(2);
        elements.push(
          <View key={key++} style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.tint }]}>• </Text>
            <Text
              style={[
                styles.text,
                { color: isDark ? "rgba(255,255,255,0.8)" : "#1e293b" },
              ]}
            >
              {listText}
            </Text>
          </View>
        );
      } else {
        elements.push(
          <Text
            key={key++}
            style={[
              styles.text,
              { color: isDark ? "rgba(255,255,255,0.8)" : "#1e293b" },
            ]}
          >
            {trimmed}
          </Text>
        );
      }
    });

    return elements;
  };

  const currentPage = legalPages[currentPageIndex];
  const isAccepted = acceptedPages.has(currentPage.key);
  const canAccept = scrolledToBottom || isAccepted;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.pageIndicator, { color: colors.text }]}>
              {t("legal.pageIndicator", {
                current: currentPageIndex + 1,
                total: legalPages.length,
              })}
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {currentPage.title}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentPageIndex + 1) / legalPages.length) * 100}%`,
                  backgroundColor: colors.tint,
                },
              ]}
            />
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          {parseMarkdown(currentPage.content)}

          {/* Cookie Toggles - Only show on cookies page */}
          {currentPage.key === "cookies" && (
            <>
              <View
                style={[
                  styles.settingsCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.8)"
                      : "rgba(255, 255, 255, 0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("cookies.preferencesTitle")}
                </Text>

                {/* Essential Cookies - Always On */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                      {t("cookies.essentialTitle")}
                    </Text>
                    <Text
                      style={[
                        styles.settingDesc,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {t("cookies.essentialDescription")}
                    </Text>
                  </View>
                  <Switch
                    value={true}
                    disabled={true}
                    trackColor={{
                      false: isDark ? "#475569" : "#cbd5e1",
                      true: isDark ? "#475569" : "#cbd5e1",
                    }}
                    thumbColor={isDark ? "#6366f1" : colors.tint}
                  />
                </View>

                {/* Analytics Cookies */}
                <View style={[styles.settingRow, styles.settingRowBorder]}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                      {t("cookies.analyticsTitle")}
                    </Text>
                    <Text
                      style={[
                        styles.settingDesc,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {t("cookies.analyticsDescription")}
                    </Text>
                  </View>
                  <Switch
                    value={analyticsEnabled}
                    onValueChange={handleAnalyticsToggle}
                    trackColor={{
                      false: isDark ? "#475569" : "#cbd5e1",
                      true: isDark ? "#475569" : "#cbd5e1",
                    }}
                    thumbColor={
                      analyticsEnabled
                        ? isDark
                          ? "#6366f1"
                          : colors.tint
                        : isDark
                          ? "#64748b"
                          : "#94a3b8"
                    }
                  />
                </View>

                {/* Marketing Cookies */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                      {t("cookies.marketingTitle")}
                    </Text>
                    <Text
                      style={[
                        styles.settingDesc,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {t("cookies.marketingDescription")}
                    </Text>
                  </View>
                  <Switch
                    value={marketingEnabled}
                    onValueChange={handleMarketingToggle}
                    trackColor={{
                      false: isDark ? "#475569" : "#cbd5e1",
                      true: isDark ? "#475569" : "#cbd5e1",
                    }}
                    thumbColor={
                      marketingEnabled
                        ? isDark
                          ? "#6366f1"
                          : colors.tint
                        : isDark
                          ? "#64748b"
                          : "#94a3b8"
                    }
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Feather
                  name="info"
                  size={16}
                  color={isDark ? "#3b82f6" : "#2563eb"}
                />
                <Text
                  style={[
                    styles.infoText,
                    { color: isDark ? "#93c5fd" : "#1e40af" },
                  ]}
                >
                  {t("cookies.preferencesInfo")}
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: "transparent",
              borderTopColor: isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.1)",
            },
          ]}
        >
          {!canAccept && (
            <View
              style={[
                styles.scrollHint,
                {
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(245, 158, 11, 0.1)",
                },
              ]}
            >
              <Feather
                name="arrow-down"
                size={16}
                color="#f59e0b"
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.scrollHintText,
                  { color: isDark ? "#fbbf24" : "#d97706" },
                ]}
              >
                {t("legal.scrollToBottomToAccept")}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.acceptButton,
              {
                backgroundColor: isDark ? "#6366f1" : "#0a7ea4",
                opacity: canAccept ? 1 : 0.5,
              },
            ]}
            onPress={() => canAccept && handleAccept(currentPage.key)}
            disabled={!canAccept}
          >
            <Text style={styles.acceptButtonText}>
              {isAccepted ? `✓ ${t("legal.accepted")}` : t("legal.iAccept")}
            </Text>
            {currentPageIndex < legalPages.length - 1 && (
              <Feather name="arrow-right" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    width: 80,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 80,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  h1: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 8,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 16,
  },
  h3: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  bold: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    marginRight: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  scrollHintText: {
    fontSize: 13,
    fontWeight: "600",
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  settingsCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
