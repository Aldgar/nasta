import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import GradientBackground from "../components/GradientBackground";
import { TouchableButton } from "../components/TouchableButton";

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t("common.error"), t("auth.pleaseEnterEmail"));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t("common.error"), t("auth.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/auth/password/request-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert(
          t("auth.temporaryPasswordSent"),
          t("auth.temporaryPasswordSentMessage"),
          [
            {
              text: t("common.ok"),
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        // Still show success message to avoid account enumeration
        Alert.alert(
          t("auth.temporaryPasswordSent"),
          t("auth.temporaryPasswordSentMessage"),
          [
            {
              text: t("common.ok"),
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error requesting password reset:", error);
      Alert.alert(
        t("common.error"),
        t("auth.failedToSendTemporaryPassword")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("auth.forgotPassword")}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                ]}
              >
                {t("auth.forgotPasswordDescription")}
              </Text>

              <View style={styles.form}>
                <Text
                  style={[
                    styles.label,
                    { color: isDark ? "rgba(255,255,255,0.8)" : "#475569" },
                  ]}
                >
                  {t("auth.emailLabel")}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#ffffff",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
                  underlineColorAndroid="transparent"
                  editable={!loading}
                />

                <TouchableButton
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: isDark ? "#4f46e5" : colors.tint,
                      opacity: loading ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleRequestPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {t("auth.sendTemporaryPassword")}
                    </Text>
                  )}
                </TouchableButton>

                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backToLogin}
                >
                  <Text
                    style={[
                      styles.backToLoginText,
                      { color: isDark ? "rgba(255,255,255,0.8)" : "#64748b" },
                    ]}
                  >
                    {t("auth.backToLogin")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backToLogin: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backToLoginText: {
    fontSize: 14,
  },
});

