import { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getApiBase } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";

/**
 * Email verification screen via deep linking
 * Handles: cumprido://verify-email?token=XXX and https://cumprido.com/verify-email?token=XXX
 */
export default function VerifyEmailScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      // Safety check: prevent multiple verifications
      if (hasVerified) {
        return;
      }

      const token = params.token;

      // Safety check: ensure token exists
      if (!token || typeof token !== "string" || token.trim() === "") {
        setStatus("error");
        setErrorMessage(t("auth.verification.missingToken"));
        return;
      }

      try {
        setStatus("loading");
        const base = getApiBase();

        // Call backend verification endpoint
        const response = await fetch(`${base}/auth/email/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.message ||
            errorData.error ||
            t("auth.verification.failed");
          setStatus("error");
          setErrorMessage(errorMessage);
          return;
        }

        // Success
        setHasVerified(true);
        setStatus("success");

        // Show success message and redirect after a short delay
        setTimeout(() => {
          Alert.alert(
            t("auth.verification.successTitle"),
            t("auth.verification.successMessage"),
            [
              {
                text: t("common.ok"),
                onPress: () => {
                  // Check if user is logged in, redirect accordingly
                  router.replace("/login" as never);
                },
              },
            ]
          );
        }, 500);
      } catch (error: any) {
        // Network or other errors
        setStatus("error");
        const errorMsg =
          error?.message?.includes("Network") ||
          error?.message?.includes("fetch")
            ? t("auth.verification.networkError")
            : t("auth.verification.failed");
        setErrorMessage(errorMsg);
      }
    };

    verifyEmail();
  }, [params.token, hasVerified, t]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {status === "loading" && (
            <>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.message, { color: colors.text }]}>
                {t("auth.verification.verifying")}
              </Text>
            </>
          )}

          {status === "success" && (
            <>
              <Text style={[styles.successIcon, { color: "#10b981" }]}>
                ✓
              </Text>
              <Text style={[styles.message, { color: colors.text }]}>
                {t("auth.verification.successMessage")}
              </Text>
            </>
          )}

          {status === "error" && (
            <>
              <Text style={[styles.errorIcon, { color: "#ef4444" }]}>
                ✕
              </Text>
              <Text style={[styles.message, { color: colors.text }]}>
                {errorMessage || t("auth.verification.failed")}
              </Text>
              <Text
                style={[styles.subMessage, { color: colors.icon }]}
              >
                {t("auth.verification.errorSubMessage")}
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    maxWidth: 400,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    fontWeight: "500",
  },
  subMessage: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  successIcon: {
    fontSize: 64,
    fontWeight: "bold",
  },
  errorIcon: {
    fontSize: 64,
    fontWeight: "bold",
  },
});
