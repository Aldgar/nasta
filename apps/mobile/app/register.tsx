import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { router, useLocalSearchParams } from "expo-router";
// Constants no longer needed here; using shared getApiBase()
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
import * as SecureStore from "expo-secure-store";

export default function RegisterScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<"JOB_SEEKER" | "EMPLOYER">(
    (params.role as "JOB_SEEKER" | "EMPLOYER") || "JOB_SEEKER",
  );
  const [loading, setLoading] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (
    pwd: string,
  ): {
    strength: "weak" | "fair" | "good" | "strong";
    score: number;
    feedback: string[];
  } => {
    if (!pwd) {
      return { strength: "weak", score: 0, feedback: [] };
    }

    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (pwd.length >= 8) {
      score += 1;
    } else {
      feedback.push("At least 8 characters");
    }

    // Uppercase check
    if (/[A-Z]/.test(pwd)) {
      score += 1;
    } else {
      feedback.push("One uppercase letter");
    }

    // Lowercase check
    if (/[a-z]/.test(pwd)) {
      score += 1;
    } else {
      feedback.push("One lowercase letter");
    }

    // Number check
    if (/\d/.test(pwd)) {
      score += 1;
    } else {
      feedback.push("One number");
    }

    // Special character check (bonus, not required)
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      score += 0.5;
    }

    // Length bonus
    if (pwd.length >= 12) {
      score += 0.5;
    }

    let strength: "weak" | "fair" | "good" | "strong";
    if (score < 2) {
      strength = "weak";
    } else if (score < 3) {
      strength = "fair";
    } else if (score < 4) {
      strength = "good";
    } else {
      strength = "strong";
    }

    return { strength, score, feedback };
  };

  const passwordStrength = calculatePasswordStrength(password);

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

  const handleBack = () => {
    const canGoBack = (router as any)?.canGoBack?.();
    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/" as never);
  };

  const onSubmit = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert(t("auth.missingFields"), t("auth.fillAllFields"));
      return;
    }

    // Validate password strength
    if (passwordStrength.strength === "weak") {
      Alert.alert(
        t("auth.weakPassword"),
        `${t("auth.improvePassword")}\n${passwordStrength.feedback.map((f) => t(`auth.passwordRequirements.${f.toLowerCase().replace(/\s+/g, "")}`) || f).join("\n")}`,
      );
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      Alert.alert(
        t("auth.passwordMismatch"),
        t("auth.passwordMismatchMessage"),
      );
      return;
    }

    try {
      setLoading(true);
      const base = getApiBase();
      const url = `${base}/auth/register`;

      // Add timeout to prevent hanging (30 seconds for registration)
      const controller = new AbortController();
      const timeoutDuration = 30000; // 30 seconds
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);

      let res;
      try {
        res = await fetch(url!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-language": language,
            "Accept-Language": language,
          },
          body: JSON.stringify({ firstName, lastName, email, password, role }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Handle network/timeout errors
        if (fetchError.name === "AbortError") {
          throw new Error(
            "Registration request timed out. Please check your internet connection and try again.",
          );
        }

        if (
          fetchError.message?.includes("Network request failed") ||
          fetchError.message?.includes("timeout")
        ) {
          throw new Error(
            "Cannot connect to server. Please ensure:\n1. Server is running\n2. You're on the same network\n3. Your internet connection is stable",
          );
        }

        throw fetchError;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Registration failed");
      }
      const data = await res.json();
      const token =
        data?.accessToken || data?.access_token || data?.token || "";

      if (!token) {
        throw new Error("No authentication token received");
      }

      // Store token, but do not block navigation on storage.
      // Some SecureStore implementations/dev modes can be slow and make the UI look stuck.
      void Promise.race([
        SecureStore.setItemAsync("auth_token", token),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Token storage timeout")), 2000),
        ),
      ]).catch((storeError) => {
        // Legal-acceptance already retries reading the token.
        console.error("Error storing token:", storeError);
      });

      // After successful registration, redirect to legal acceptance.
      router.push({
        pathname: "/legal-acceptance",
        params: { role },
      } as any);
    } catch (err) {
      console.error("Registration error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed";
      Alert.alert(t("auth.registrationError"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "android" ? "on-drag" : "interactive"
            }
            bounces={Platform.OS !== "android"}
            {...(Platform.OS === "android"
              ? {
                  overScrollMode: "never" as const,
                  nestedScrollEnabled: true,
                }
              : {})}
          >
            <Pressable
              onPress={handleBack}
              android_ripple={{ color: "transparent" }}
            >
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
            </Pressable>

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
                <Text
                  style={[
                    styles.emblemMeroitic,
                    {
                      color: isDark ? "#C9963F" : "#1A1207",
                      fontFamily:
                        Platform.OS === "android"
                          ? "NotoSansMeroitic"
                          : undefined,
                    },
                  ]}
                >
                  {"\u200A𐦠𐦴𐦯𐦡\u200A"}
                </Text>
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
                {t("auth.signUp")}
              </Text>

              <Text
                style={[
                  styles.label,
                  { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                ]}
              >
                {t("auth.firstNameLabel")}
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
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t("auth.firstNamePlaceholder")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                underlineColorAndroid="transparent"
              />

              <Text
                style={[
                  styles.label,
                  { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                ]}
              >
                {t("auth.lastNameLabel")}
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
                value={lastName}
                onChangeText={setLastName}
                placeholder={t("auth.lastNamePlaceholder")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                underlineColorAndroid="transparent"
              />

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
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#FFFAF0",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.2)",
                    },
                    password &&
                      passwordStrength.strength === "weak" && {
                        borderColor: "#ef4444",
                        borderWidth: 2,
                      },
                    password &&
                      passwordStrength.strength === "fair" && {
                        borderColor: "#f59e0b",
                        borderWidth: 2,
                      },
                    password &&
                      passwordStrength.strength === "good" && {
                        borderColor: "#C9963F",
                        borderWidth: 2,
                      },
                    password &&
                      passwordStrength.strength === "strong" && {
                        borderColor: "#22c55e",
                        borderWidth: 2,
                      },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={
                    showPassword
                      ? t("auth.passwordPlaceholder")
                      : t("auth.passwordPlaceholderHidden")
                  }
                  placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  underlineColorAndroid="transparent"
                />
                <TouchableWithoutFeedback
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                >
                  <View style={styles.eyeButton}>
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={isDark ? "#FFFAF0" : "#8A7B68"}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>

              {/* Password Strength Indicator */}
              {password && (
                <View style={styles.strengthContainer}>
                  <View
                    style={[
                      styles.strengthBarContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.strengthBar,
                        {
                          width: `${(passwordStrength.score / 4.5) * 100}%`,
                          backgroundColor:
                            passwordStrength.strength === "weak"
                              ? "#ef4444"
                              : passwordStrength.strength === "fair"
                                ? "#f59e0b"
                                : passwordStrength.strength === "good"
                                  ? "#C9963F"
                                  : "#22c55e",
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.strengthText,
                      {
                        color:
                          passwordStrength.strength === "weak"
                            ? "#ef4444"
                            : passwordStrength.strength === "fair"
                              ? "#f59e0b"
                              : passwordStrength.strength === "good"
                                ? "#C9963F"
                                : "#22c55e",
                      },
                    ]}
                  >
                    {t(`auth.passwordStrength.${passwordStrength.strength}`)}
                  </Text>
                </View>
              )}

              <Text
                style={[
                  styles.label,
                  {
                    color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355",
                    marginTop: password ? 8 : 24,
                  },
                ]}
              >
                {t("auth.confirmPasswordLabel")}
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
                      borderColor:
                        confirmPassword && password !== confirmPassword
                          ? "#ef4444"
                          : confirmPassword && password === confirmPassword
                            ? "#22c55e"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.2)",
                      borderWidth:
                        confirmPassword && password !== confirmPassword
                          ? 2
                          : confirmPassword && password === confirmPassword
                            ? 2
                            : 1,
                    },
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder={
                    showConfirmPassword
                      ? t("auth.confirmPasswordPlaceholder")
                      : t("auth.confirmPasswordPlaceholderHidden")
                  }
                  placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  underlineColorAndroid="transparent"
                />
                <TouchableWithoutFeedback
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                >
                  <View style={styles.eyeButton}>
                    <Feather
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={18}
                      color={isDark ? "#FFFAF0" : "#8A7B68"}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
              {confirmPassword && password !== confirmPassword && (
                <Text style={styles.errorText}>
                  {t("auth.passwordsDoNotMatch")}
                </Text>
              )}
              {confirmPassword && password === confirmPassword && password && (
                <Text style={styles.successText}>
                  ✓ {t("auth.passwordsMatch")}
                </Text>
              )}

              <View style={styles.roleToggleRow}>
                <TouchableWithoutFeedback
                  onPress={() => !loading && setRole("JOB_SEEKER")}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.toggle,
                      {
                        backgroundColor:
                          role === "JOB_SEEKER"
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "transparent"
                              : "rgba(184,130,42,0.06)",
                        borderColor:
                          role === "JOB_SEEKER"
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.3)"
                              : "rgba(184,130,42,0.3)",
                      },
                      role === "JOB_SEEKER" && styles.toggleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        {
                          color:
                            role === "JOB_SEEKER" ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {t("auth.serviceProvider")}
                    </Text>
                  </View>
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback
                  onPress={() => !loading && setRole("EMPLOYER")}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.toggle,
                      {
                        backgroundColor:
                          role === "EMPLOYER"
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "transparent"
                              : "rgba(184,130,42,0.06)",
                        borderColor:
                          role === "EMPLOYER"
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.3)"
                              : "rgba(184,130,42,0.3)",
                      },
                      role === "EMPLOYER" && styles.toggleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        {
                          color: role === "EMPLOYER" ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {t("auth.employer")}
                    </Text>
                  </View>
                </TouchableWithoutFeedback>
              </View>

              <TouchableWithoutFeedback
                onPress={() => !loading && onSubmit()}
                disabled={loading}
              >
                <View
                  style={[
                    styles.button,
                    {
                      backgroundColor: isDark ? "#C9963F" : colors.tint,
                      borderColor: isDark ? "#C9963F" : colors.tint,
                    },
                    loading && styles.buttonLoading,
                  ]}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator color="#FFFAF0" />
                    </>
                  ) : (
                    <Text style={styles.buttonLabel}>
                      {t("auth.signUpButton")}
                    </Text>
                  )}
                </View>
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback
                onPress={() => router.replace("/login" as never)}
              >
                <View style={styles.secondaryAction}>
                  <Text
                    style={[
                      styles.secondaryText,
                      { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                    ]}
                  >
                    {t("auth.alreadyRegistered")}{" "}
                    <Text
                      style={{
                        color: isDark ? "#C9963F" : "#96782A",
                        fontWeight: "600",
                      }}
                    >
                      {t("auth.backToLogin")}
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100, // Increased padding to ensure all content is accessible
  },
  logoContainer: {
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 24,
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
    marginTop: 0,
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
  },

  inputMargin: {
    marginBottom: 24,
  },
  inputMarginLarge: {
    marginBottom: 32,
  },
  roleToggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  toggle: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    minHeight: 56,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 0,
    overflow: "hidden",
  },
  toggleActive: {},
  toggleText: {
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
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
  buttonLoading: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  secondaryAction: {
    marginTop: 32,
    alignItems: "center",
    paddingBottom: 20, // Final padding
  },
  secondaryText: {
    fontSize: 15,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  strengthBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: -16,
    marginBottom: 8,
    marginLeft: 4,
  },
  successText: {
    color: "#22c55e",
    fontSize: 12,
    marginTop: -16,
    marginBottom: 8,
    marginLeft: 4,
  },
});
