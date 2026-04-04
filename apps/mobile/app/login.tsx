import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { getApiBase } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ActivityIndicator, TouchableWithoutFeedback } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animation values for logo
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  useEffect(() => {
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    logoScale.value = withSequence(
      withTiming(1.05, { duration: 400, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) }),
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // Use shared base URL helper for consistent platform behavior

  const loginWith = async (role: "user" | "employer" | "admin") => {
    if (!email || !password) {
      Alert.alert(t("auth.missingFields"), t("auth.enterEmailPassword"));
      return;
    }
    try {
      setLoading(true);
      const base = getApiBase();

      // Test server connectivity (non-blocking - just log, don't block login)
      const healthCheckPromise = (async () => {
        try {
          const healthController = new AbortController();
          const healthTimeout = setTimeout(
            () => healthController.abort(),
            3000,
          ); // Reduced to 3s for faster feedback
          const healthRes = await fetch(`${base}/health`, {
            method: "GET",
            signal: healthController.signal,
          });
          clearTimeout(healthTimeout);
        } catch (healthErr: any) {
          // Don't block login, just log the issue
        }
      })();
      // Don't await - let it run in background, proceed with login

      const path =
        role === "user"
          ? "/auth/user/login"
          : role === "employer"
            ? "/auth/employer/login"
            : "/auth/admin/login";
      const url = `${base}${path}`;

      console.log("Attempting login to:", url);

      // Add timeout to prevent hanging (increased to 30s for slow networks)
      const controller = new AbortController();
      const timeoutDuration = 30000; // 30 seconds for login
      const fetchStartTime = Date.now();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);

      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-language": language,
            "Accept-Language": language,
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (
          fetchErr.name === "AbortError" ||
          fetchErr.message?.includes("timeout")
        ) {
          throw new Error("Network request timed out");
        }
        throw fetchErr;
      }

      if (!res.ok) {
        let errorText = `Login failed with status ${res.status}`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              errorText = json.message || json.error || text;
            } catch {
              errorText = text;
            }
          }
        } catch (readErr) {
          // If reading response fails, use default error
          console.warn("Failed to read error response:", readErr);
        }
        throw new Error(errorText);
      }

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error("Invalid response from server");
      }
      const token =
        data?.accessToken || data?.access_token || data?.token || "";
      if (!token) throw new Error("No token returned");
      await SecureStore.setItemAsync("auth_token", token);
      // Store password temporarily for password change form (will be cleared after password change)
      await SecureStore.setItemAsync("last_login_password", password);
      if (role === "user") {
        router.push("/user-home" as never);
      } else if (role === "employer") {
        router.push("/employer-home" as never);
      } else {
        router.push("/admin-home" as never);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error";
      console.error("Login error:", errorMessage);

      // Handle timeout errors
      if (
        err.name === "AbortError" ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("timed out")
      ) {
        const base = getApiBase();
        Alert.alert(
          "Connection Timeout",
          `The login request timed out. The server at ${base} may be slow or unreachable.\n\n` +
            `Please check:\n` +
            `1. Backend server is running\n` +
            `2. Both devices are on the same WiFi\n` +
            `3. IP address is correct (${base})\n` +
            `4. Server is not overloaded`,
          [
            { text: "OK" },
            {
              text: "Test Connection",
              onPress: async () => {
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 5000);
                  const testRes = await fetch(`${base}/health`, {
                    method: "GET",
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);
                  if (testRes.ok) {
                    Alert.alert(
                      "Success",
                      "Server is reachable! Try logging in again.",
                    );
                  } else {
                    Alert.alert(
                      "Server Error",
                      `Server returned status ${testRes.status}`,
                    );
                  }
                } catch (testErr: any) {
                  Alert.alert(
                    "Connection Failed",
                    `Cannot reach ${base}/health\n\n${testErr.message}`,
                  );
                }
              },
            },
          ],
        );
        return;
      }

      // Provide more helpful error messages
      if (
        errorMessage.includes("Network request failed") ||
        errorMessage.includes("fetch") ||
        errorMessage.includes("Failed to connect")
      ) {
        const base = getApiBase();
        const isLocalBase = base.startsWith("http://");
        let baseHost = base;
        try {
          baseHost = new URL(base).host;
        } catch {
          // ignore
        }

        const troubleshootingSteps = isLocalBase
          ? `Troubleshooting steps:\n` +
            `1. Verify server is running on:\n   ${base}\n\n` +
            `2. Check network:\n   - Device and server on same network\n   - Host: ${baseHost}\n\n` +
            `3. Server must be reachable from your device`
          : `Troubleshooting steps:\n` +
            `1. Check your internet connection\n\n` +
            `2. Verify the API is reachable:\n   ${base}/health\n\n` +
            `3. If you intended to use a local backend, set EXPO_PUBLIC_API_URL (or EXPO_PUBLIC_API_BASE_URL)\n   to your server URL.`;
        Alert.alert(
          "Connection Error",
          `Cannot connect to server at ${base}.\n\n` +
            `The server appears to be offline or unreachable.\n\n` +
            troubleshootingSteps,
          [
            { text: "OK" },
            {
              text: "Test Connection",
              onPress: async () => {
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 5000);
                  const testRes = await fetch(`${base}/health`, {
                    method: "GET",
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);
                  if (testRes.ok) {
                    Alert.alert(
                      "Success",
                      "Server is reachable! Try logging in again.",
                    );
                  } else {
                    Alert.alert(
                      "Server Error",
                      `Server returned status ${testRes.status}`,
                    );
                  }
                } catch (testErr: any) {
                  const isTimeout =
                    testErr.name === "AbortError" ||
                    testErr.message?.includes("timeout");
                  Alert.alert(
                    isTimeout ? "Connection Timeout" : "Connection Failed",
                    `Cannot reach ${base}/health\n\n` +
                      (isTimeout
                        ? "Server did not respond within 5 seconds. Make sure the server is running."
                        : testErr.message || "Unknown error"),
                  );
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(t("auth.loginError"), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // No test-account autofill; users must exist in the database

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <TouchableWithoutFeedback onPress={() => router.replace("/" as never)}>
          <View
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(10,22,40,0.6)"
                  : "rgba(255,255,255,0.85)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.2)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <Feather
              name="chevron-left"
              size={20}
              color={isDark ? "rgba(240,232,213,0.8)" : "#1A1207"}
            />
          </View>
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === "android"
              ? {
                  overScrollMode: "never" as const,
                  nestedScrollEnabled: true,
                  bounces: false,
                  keyboardDismissMode: "on-drag" as const,
                }
              : {})}
          >
            <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
              <View
                style={[
                  styles.emblemFrame,
                  {
                    borderColor: isDark
                      ? "rgba(201,150,63,0.5)"
                      : "rgba(29,24,17,0.5)",
                  },
                ]}
              >
                {Platform.OS !== "android" && (
                  <Text
                    style={[
                      styles.emblemMeroitic,
                      { color: isDark ? "#C9963F" : "#1A1207" },
                    ]}
                  >
                    {"\u200A𐦠𐦴𐦯𐦡\u200A"}
                  </Text>
                )}
                <View
                  style={[
                    styles.emblemDivider,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.35)"
                        : "rgba(29,24,17,0.3)",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.emblemText,
                    { color: isDark ? "#F0E8D5" : "#1A1207" },
                  ]}
                >
                  NASTA
                </Text>
              </View>
            </Animated.View>
            <View style={styles.form}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("auth.login")}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                ]}
              >
                {t("auth.signInToContinue")}
              </Text>

              <Text
                style={[
                  styles.label,
                  { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                ]}
              >
                {t("auth.emailLabel")}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMargin,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                underlineColorAndroid="transparent"
              />

              <Text
                style={[
                  styles.label,
                  { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                ]}
              >
                {t("auth.passwordLabel")}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputMarginLarge,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#FFFAF0",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={showPassword ? "password" : "******"}
                  placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  underlineColorAndroid="transparent"
                />
                <TouchableWithoutFeedback
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <View style={styles.eyeButton}>
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={isDark ? "rgba(240,232,213,0.6)" : "#8A7B68"}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>

              <View style={styles.roleButtonsRow}>
                <TouchableWithoutFeedback
                  onPress={() => !loading && loginWith("user")}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.button,
                      styles.buttonSmall,
                      {
                        backgroundColor: isDark ? "#C9963F" : colors.tint,
                        borderColor: isDark ? "#C9963F" : colors.tint,
                      },
                      loading && styles.buttonLoading,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFAF0" />
                    ) : (
                      <Text style={styles.buttonLabel}>Service Provider</Text>
                    )}
                  </View>
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback
                  onPress={() => !loading && loginWith("employer")}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.button,
                      styles.buttonSmall,
                      {
                        backgroundColor: isDark ? "#C9963F" : colors.tint,
                        borderColor: isDark ? "#C9963F" : colors.tint,
                      },
                      loading && styles.buttonLoading,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFAF0" />
                    ) : (
                      <Text style={styles.buttonLabel}>Employer</Text>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </View>

              <TouchableWithoutFeedback
                onPress={() => !loading && loginWith("admin")}
                disabled={loading}
              >
                <View
                  style={[
                    styles.button,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(184,130,42,0.06)",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.3)"
                        : "rgba(184,130,42,0.3)",
                      borderStyle: "dashed",
                    },
                    loading && styles.buttonLoading,
                    styles.adminButton,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={[styles.buttonLabel, { color: colors.text }]}>
                      {t("auth.admin")}
                    </Text>
                  )}
                </View>
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPress={() => router.push("/forgot-password" as never)}
              >
                <View style={styles.secondaryAction}>
                  <Text
                    style={[
                      styles.secondaryText,
                      { color: isDark ? "rgba(240,232,213,0.8)" : "#8A7B68" },
                    ]}
                  >
                    {t("auth.forgotPassword")}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPress={() =>
                  router.push("/register?role=JOB_SEEKER" as never)
                }
              >
                <View style={styles.secondaryAction}>
                  <Text
                    style={[
                      styles.secondaryText,
                      { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                    ]}
                  >
                    {t("auth.dontHaveAccount")}{" "}
                    <Text
                      style={{
                        color: isDark ? "#C9963F" : "#96782A",
                        fontWeight: "600",
                      }}
                    >
                      {t("auth.createOne")}
                    </Text>
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoContainer: {
    alignSelf: "center",
    marginBottom: 32,
  },
  emblemFrame: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emblemMeroitic: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 2,
    textAlign: "center",
  },
  emblemDivider: {
    width: 36,
    height: 1,
    marginVertical: 6,
  },
  emblemText: {
    fontFamily: Platform.OS === "ios" ? "Arial" : "sans-serif",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 7,
    textTransform: "uppercase",
  },
  form: {
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
    fontSize: 16,
  },
  label: {
    marginBottom: 8,
    letterSpacing: 1.5,
    fontSize: 11,
    fontWeight: "700",
  },
  input: {
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 0,
    overflow: "hidden",
  },
  inputWrapper: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 4,
    borderRadius: 4,
    // backgroundColor: "rgba(184,130,42,0.3)", // optional, clear looks better if icon is good
  },

  inputMargin: {
    marginBottom: 24,
  },
  inputMarginLarge: {
    marginBottom: 32,
  },
  button: {
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minHeight: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 0,
    overflow: "hidden",
  },
  buttonSmall: {
    flex: 1,
  },
  roleButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  adminButton: {
    marginTop: 0,
  },
  secondaryAction: {
    marginTop: 32,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 14,
  },
  backButton: {
    position: "absolute",
    top: 54,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 10,
  },
});
