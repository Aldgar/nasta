import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { useState } from "react";

interface EmailVerificationBannerProps {
  emailVerified: boolean;
  onVerify?: () => void;
}

export default function EmailVerificationBanner({
  emailVerified,
  onVerify,
}: EmailVerificationBannerProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  if (emailVerified) {
    return null;
  }

  const handleRequestVerification = async () => {
    try {
      setRequesting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("emailVerification.pleaseLogInToVerify"));
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/auth/email/request-verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        Alert.alert(
          t("emailVerification.verificationEmailSent"),
          t("emailVerification.checkEmailForLink"),
          [{ text: t("common.ok") }]
        );
        onVerify?.();
      } else {
        const error = await res.json();
        const errorMessage = Array.isArray(error.message)
          ? error.message.join(", ")
          : error.message || t("emailVerification.failedToSendVerificationEmail");
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (err) {
      console.error("Error requesting email verification:", err);
      Alert.alert(t("common.error"), t("emailVerification.failedToSendVerificationEmail"));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isDark
            ? "rgba(251, 191, 36, 0.15)"
            : "rgba(251, 191, 36, 0.1)",
          borderColor: isDark
            ? "rgba(251, 191, 36, 0.3)"
            : "rgba(251, 191, 36, 0.4)",
        },
      ]}
    >
      <View style={styles.content}>
        <Feather
          name="mail"
          size={20}
          color={isDark ? "#fbbf24" : "#f59e0b"}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: isDark ? "#fbbf24" : "#d97706" },
            ]}
          >
            {t("emailVerification.verifyYourEmail")}
          </Text>
          <Text
            style={[
              styles.message,
              { color: isDark ? "#fde68a" : "#92400e" },
            ]}
          >
            {t("emailVerification.verifyEmailToAccess")}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isDark ? "#6366f1" : colors.tint,
          },
        ]}
        onPress={() => {
          // Navigate to settings where user can enter verification code
          router.push("/settings" as never);
        }}
        disabled={requesting}
      >
        <Text style={styles.buttonText}>
          {t("emailVerification.verifyNow")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});

