import {
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import GradientBackground from "../components/GradientBackground";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import { TouchableButton } from "../components/TouchableButton";

export default function UserHome() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<
    | "PENDING"
    | "IN_PROGRESS"
    | "MANUAL_REVIEW"
    | "VERIFIED"
    | "FAILED"
    | "UNKNOWN"
  >("UNKNOWN");
  // Keep for future conditional UI (apply restrictions)
  // const isVerified = kycStatus === "VERIFIED";

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;
        const base = getApiBase();
        // Load KYC status
        const res = await fetch(`${base}/kyc/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const status = json?.status || json?.kycStatus || "UNKNOWN";
        setKycStatus(status);

        // Load user profile for greeting
        try {
          const meRes = await fetch(`${base}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const me = await meRes.json();
            const name =
              me?.name ||
              me?.fullName ||
              [me?.firstName, me?.lastName].filter(Boolean).join(" ");
            if (name) setDisplayName(name);
          } else {
            // Fallback endpoint
            const altRes = await fetch(`${base}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (altRes.ok) {
              const me = await altRes.json();
              const name =
                me?.name ||
                me?.fullName ||
                [me?.firstName, me?.lastName].filter(Boolean).join(" ");
              if (name) setDisplayName(name);
            }
          }
        } catch {
          // ignore profile errors
        }
      } catch {
        // Best-effort only; keep UNKNOWN
      }
    };
    loadStatus();
  }, []);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableButton
            style={[
              styles.topButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => {
              SecureStore.deleteItemAsync("auth_token");
              router.replace("/");
            }}
          >
            <Text style={[styles.topButtonText, { color: colors.text }]}>{t("settings.signOut")}</Text>
          </TouchableButton>
        </View>

        <View style={styles.centeredContent}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("home.welcome")}{displayName ? `, ${displayName}` : ""}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" }]}>
            {t("home.hereQuickStart")}
            {kycStatus !== "UNKNOWN" ? ` • ${t("home.kyc")}: ${kycStatus}` : ""}:
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#ffffff",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                shadowColor: isDark ? "#000" : "#000",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t("kyc.verifyIdentity")}</Text>
            <Text style={[styles.cardText, { color: isDark ? "rgba(255,255,255,0.8)" : "#475569" }]}>
              {t("kyc.verifyIdentitySubtitle")}
            </Text>
            <TouchableButton
              style={[
                styles.button,
                {
                  backgroundColor: isDark ? "#4f46e5" : colors.tint,
                  borderColor: isDark ? "#6366f1" : colors.tint,
                },
              ]}
              onPress={() => router.replace("/kyc-start" as never)}
            >
              <Text style={[styles.buttonLabel, { color: isDark ? "#e0e7ff" : "#ffffff" }]}>{t("kyc.startVerification")}</Text>
            </TouchableButton>
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#ffffff",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                shadowColor: isDark ? "#000" : "#000",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {(() => {
                const key = "jobs.searchJobs";
                const translated = t(key);
                return translated === key ? "Search Jobs" : translated;
              })()}
            </Text>
            <Text style={[styles.cardText, { color: isDark ? "rgba(255,255,255,0.8)" : "#475569" }]}>
              {(() => {
                const key = "landing.findJobsDescription";
                const translated = t(key);
                return translated === key ? "Discover opportunities that match your skills" : translated;
              })()}
            </Text>
            <TouchableButton
              style={[
                styles.button,
                {
                  backgroundColor: isDark ? "#4f46e5" : colors.tint,
                  borderColor: isDark ? "#6366f1" : colors.tint,
                },
              ]}
              onPress={() => router.push("/(tabs)/feed" as never)}
            >
              <Text style={[styles.buttonLabel, { color: isDark ? "#f8fafc" : "#ffffff" }]}>
                {(() => {
                  const key = "jobs.searchJobs";
                  const translated = t(key);
                  return translated === key ? "Search Jobs" : translated;
                })()}
              </Text>
            </TouchableButton>
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 20 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 12,
  },
  topButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topButtonText: { fontSize: 12, fontWeight: "600" },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { marginBottom: 24, fontSize: 16 },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardText: { marginBottom: 16, fontSize: 14, lineHeight: 20 },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 2,
  },
  buttonLabel: { fontWeight: "700", fontSize: 16 },
});
