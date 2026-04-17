import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import * as SecureStore from "expo-secure-store";

// Simple markdown parser for legal text
const parseMarkdown = (text: string, isDark: boolean, colors: any) => {
  const lines = text.split("\n");
  const elements: React.ReactElement[] = [];
  let key = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<View key={key++} style={{ height: 12 }} />);
      return;
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      elements.push(
        <Text key={key++} style={[styles.h1, { color: colors.text }]}>
          {trimmed.substring(2)}
        </Text>,
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <Text key={key++} style={[styles.h2, { color: colors.text }]}>
          {trimmed.substring(3)}
        </Text>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={key++} style={[styles.h3, { color: colors.text }]}>
          {trimmed.substring(4)}
        </Text>,
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      // Bold text
      const boldText = trimmed.substring(2, trimmed.length - 2);
      elements.push(
        <Text key={key++} style={[styles.bold, { color: colors.text }]}>
          {boldText}
        </Text>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      // List items
      const listText = trimmed.substring(2);
      elements.push(
        <View key={key++} style={styles.listItem}>
          <Text style={[styles.bullet, { color: colors.text }]}>• </Text>
          <Text
            style={[
              styles.text,
              { color: isDark ? "rgba(240,232,213,0.8)" : "#0A1628" },
            ]}
          >
            {listText}
          </Text>
        </View>,
      );
    } else {
      // Regular text
      elements.push(
        <Text
          key={key++}
          style={[
            styles.text,
            { color: isDark ? "rgba(240,232,213,0.8)" : "#0A1628" },
          ]}
        >
          {trimmed}
        </Text>,
      );
    }
  });

  return elements;
};

export default function ContentPage() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const router = useRouter();
  const titleParam = params.title;
  const contentParam = params.content;
  const pageKeyParamRaw = params.pageKey;

  const title = Array.isArray(titleParam)
    ? titleParam[0]
    : titleParam || "Page";
  const content = Array.isArray(contentParam)
    ? contentParam[0]
    : contentParam || "Content goes here...";
  const pageKeyParam = Array.isArray(pageKeyParamRaw)
    ? pageKeyParamRaw[0]
    : pageKeyParamRaw;

  const showAccept = params.showAccept === "true";
  const [accepted, setAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);

  const checkIfContentFits = useCallback(() => {
    if (
      contentHeightRef.current > 0 &&
      layoutHeightRef.current > 0 &&
      contentHeightRef.current <= layoutHeightRef.current + 20
    ) {
      setScrolledToBottom(true);
    }
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 80;
      const isAtBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;
      if (isAtBottom) {
        setScrolledToBottom(true);
      }
    },
    [],
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentHeightRef.current = h;
      checkIfContentFits();
    },
    [checkIfContentFits],
  );

  const handleLayout = useCallback(
    (event: any) => {
      layoutHeightRef.current = event.nativeEvent.layout.height;
      checkIfContentFits();
    },
    [checkIfContentFits],
  );

  // Check acceptance status on mount (non-blocking)
  useEffect(() => {
    checkAcceptanceStatus();
  }, []);

  const checkAcceptanceStatus = async () => {
    try {
      // Map title to page key
      const titleToKey: Record<string, string> = {
        "Terms and conditions": "terms",
        "Privacy policy": "privacy",
        "Platform rules": "platform_rules",
      };

      const pageKey =
        typeof pageKeyParam === "string" && pageKeyParam
          ? pageKeyParam
          : titleToKey[title];
      if (!pageKey) {
        return; // Not a legal page, no need to check
      }

      // Check local storage first (fast, always works)
      const acceptKey = `legal_accepted_${pageKey}`;
      const localAccepted = await SecureStore.getItemAsync(acceptKey);

      // If we have local acceptance, use it immediately
      if (localAccepted) {
        setAccepted(true);
        return;
      }

      // Check backend if user is logged in (non-blocking, with timeout)
      const token = await SecureStore.getItemAsync("auth_token");
      if (token) {
        // Don't block - check in background
        Promise.race([
          (async () => {
            try {
              const { getApiBase } = await import("../lib/api");
              const base = getApiBase();

              const res = await fetch(`${base}/users/me/legal/status`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (res.ok) {
                const status = await res.json();
                const fieldMap: Record<string, keyof typeof status> = {
                  terms: "termsAccepted",
                  privacy: "privacyAccepted",
                  platform_rules: "platformRulesAccepted",
                };

                const isAccepted = status[fieldMap[pageKey] || "termsAccepted"];
                if (isAccepted) {
                  setAccepted(true);
                }
              }
            } catch (apiError: any) {
              console.error("Error checking backend status:", apiError);
              // Silently fail - use local storage result
            }
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 2000),
          ),
        ]).catch(() => {
          // Timeout or error - just use local storage
        });
      }
    } catch (error) {
      console.error("Error checking acceptance status:", error);
    }
  };

  const handleAccept = async () => {
    console.log("handleAccept called for title:", title);
    try {
      const resolveMappingFromPageKey = (pk: string) => {
        if (pk === "terms") return { key: "terms", endpoint: "accept-terms" };
        if (pk === "privacy")
          return { key: "privacy", endpoint: "accept-privacy" };
        if (pk === "platform_rules")
          return { key: "platform_rules", endpoint: "accept-platform-rules" };
        return null;
      };

      // Map title to page key and API endpoint (case-insensitive matching)
      const titleToKey: Record<string, { key: string; endpoint: string }> = {
        "Terms and conditions": { key: "terms", endpoint: "accept-terms" },
        "Terms and Conditions": { key: "terms", endpoint: "accept-terms" },
        "Privacy policy": { key: "privacy", endpoint: "accept-privacy" },
        "Privacy Policy": { key: "privacy", endpoint: "accept-privacy" },
        "Platform rules": {
          key: "platform_rules",
          endpoint: "accept-platform-rules",
        },
        "Platform Rules": {
          key: "platform_rules",
          endpoint: "accept-platform-rules",
        },
      };

      // Prefer explicit pageKey param (works across languages)
      let mapping =
        typeof pageKeyParam === "string" && pageKeyParam
          ? resolveMappingFromPageKey(pageKeyParam)
          : null;

      // Try exact match first, then try case-insensitive
      if (!mapping) mapping = titleToKey[title];
      if (!mapping) {
        // Try case-insensitive match
        const titleLower = title.toLowerCase();
        for (const [key, value] of Object.entries(titleToKey)) {
          if (key.toLowerCase() === titleLower) {
            mapping = value;
            break;
          }
        }
      }

      console.log("Mapping found:", mapping, "for title:", title);

      if (!mapping) {
        // Fallback for other titles
        console.log("No mapping found, using fallback");
        const rawKeySource =
          (typeof pageKeyParam === "string" && pageKeyParam) || String(title);
        const safeKey = rawKeySource
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "_")
          .slice(0, 64);
        const acceptKey = `legal_accepted_${safeKey}`;
        await SecureStore.setItemAsync(acceptKey, new Date().toISOString());
        setAccepted(true);
        Alert.alert(t("legal.accepted"), t("legal.youHaveAcceptedTerms"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
        return;
      }

      // Save locally first (immediate, always works)
      const acceptKey = `legal_accepted_${mapping.key}`;
      console.log("Saving to local storage with key:", acceptKey);
      await SecureStore.setItemAsync(acceptKey, new Date().toISOString());
      setAccepted(true);
      console.log("Acceptance saved locally, showing alert");
      Alert.alert(t("legal.accepted"), t("legal.youHaveAcceptedTerms"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);

      // Try to save to backend in background (non-blocking)
      const token = await SecureStore.getItemAsync("auth_token");
      console.log("Token exists:", !!token);

      if (token) {
        // Don't await - do this in background
        (async () => {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const { getApiBase } = await import("../lib/api");
            const base = getApiBase();
            console.log(
              "Calling backend:",
              `${base}/users/me/legal/${mapping.endpoint}`,
            );

            // Add timeout to prevent hanging
            const controller = new AbortController();
            timeoutId = setTimeout(() => {
              console.log("Request timeout, aborting...");
              controller.abort();
            }, 5000); // 5 second timeout

            const res = await fetch(
              `${base}/users/me/legal/${mapping.endpoint}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                signal: controller.signal,
              },
            );

            if (timeoutId) clearTimeout(timeoutId);
            console.log("Backend response status:", res.status);

            if (!res.ok) {
              const errorText = await res.text();
              console.error("Backend acceptance failed:", errorText);
            } else {
              console.log("Backend acceptance successful");
            }
          } catch (apiError: any) {
            if (timeoutId) clearTimeout(timeoutId);
            console.error(
              "Error calling backend API:",
              apiError?.message || apiError,
            );
            if (apiError?.name === "AbortError") {
              console.log("Request was aborted due to timeout");
            }
          }
        })();
      }
    } catch (error) {
      console.error("Error saving acceptance:", error);
      Alert.alert(t("common.error"), t("legal.failedToSaveAcceptance"));
    }
  };

  const parsedContent = parseMarkdown(content, isDark, colors);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {title}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={true}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          scrollEventThrottle={16}
        >
          <View style={styles.contentContainer}>{parsedContent}</View>
          {showAccept && (
            <View style={styles.acceptContainer}>
              {!scrolledToBottom && !accepted && (
                <View style={styles.scrollHint}>
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
                    backgroundColor: accepted
                      ? isDark
                        ? "#22c55e"
                        : "#16a34a"
                      : isDark
                        ? "#C9963F"
                        : "#B8822A",
                    opacity: accepted ? 0.7 : scrolledToBottom ? 1 : 0.5,
                  },
                ]}
                onPress={handleAccept}
                disabled={accepted || !scrolledToBottom}
              >
                <Text style={styles.acceptButtonText}>
                  {accepted ? `✓ ${t("legal.accepted")}` : t("legal.iAccept")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: 1.5 },
  scroll: { padding: 20, paddingBottom: 100 },
  contentContainer: {
    marginBottom: 20,
    backgroundColor: "transparent",
  },
  h1: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 16,
    lineHeight: 36,
  },
  h2: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 30,
  },
  h3: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 26,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  bold: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
  },
  acceptContainer: {
    marginTop: 32,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(184,130,42,0.2)",
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  scrollHintText: {
    fontSize: 13,
    fontWeight: "700",
  },
  acceptButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
});
