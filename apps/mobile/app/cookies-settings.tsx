import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getLegalDocument } from "../lib/legal-text";
import * as SecureStore from "expo-secure-store";

export default function CookiesSettingsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const analytics = await SecureStore.getItemAsync("cookie_analytics");
      const marketing = await SecureStore.getItemAsync("cookie_marketing");
      if (analytics !== null) setAnalyticsEnabled(analytics === "true");
      if (marketing !== null) setMarketingEnabled(marketing === "true");
    } catch (error) {
      console.error("Error loading cookie preferences:", error);
    }
  };

  const savePreferences = async () => {
    try {
      await SecureStore.setItemAsync(
        "cookie_analytics",
        analyticsEnabled.toString()
      );
      await SecureStore.setItemAsync(
        "cookie_marketing",
        marketingEnabled.toString()
      );
    } catch (error) {
      console.error("Error saving cookie preferences:", error);
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

  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactElement[] = [];
    let key = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<View key={key++} style={{ height: 8 }} />);
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
            <Text style={[styles.bullet, { color: colors.text }]}>• </Text>
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

  const content = parseMarkdown(getLegalDocument("COOKIES", language));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.contentContainer}>{content}</View>

          {/* Cookie Toggles */}
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
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { padding: 20, paddingTop: 12, paddingBottom: 100 },
  contentContainer: {
    marginBottom: 24,
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
    fontWeight: "600",
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
