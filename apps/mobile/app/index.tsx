import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { LinearGradient } from "expo-linear-gradient";

export default function LandingPage() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // ── Scroll parallax (lightweight — only 2 effects) ─────────
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // ── Mount entrance animations (staggered fade+slide) ───────
  const logoOp = useSharedValue(0);
  const heroOp = useSharedValue(0);
  const heroSlide = useSharedValue(24);
  const metricsOp = useSharedValue(0);
  const metricsSlide = useSharedValue(20);
  const featuresOp = useSharedValue(0);
  const featuresSlide = useSharedValue(28);
  const bottomOp = useSharedValue(0);
  const bottomSlide = useSharedValue(20);

  // Logo glow + float (continuous)
  const logoTextGlow = useSharedValue(0.5);
  const logoTextFloat = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    // Staggered mount sequence
    logoOp.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });

    heroOp.value = withDelay(
      150,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
    heroSlide.value = withDelay(
      150,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    metricsOp.value = withDelay(
      300,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
    metricsSlide.value = withDelay(
      300,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    featuresOp.value = withDelay(
      450,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
    featuresSlide.value = withDelay(
      450,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    bottomOp.value = withDelay(
      600,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
    bottomSlide.value = withDelay(
      600,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    // Continuous glow
    logoTextGlow.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
    logoTextFloat.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync("auth_token");
      if (token) return;
    };
    checkAuth();
  }, []);

  // ── Animated styles ────────────────────────────────────────

  // Logo: mount fade-in + scroll parallax (shrink & lift as you scroll)
  const logoStyle = useAnimatedStyle(() => {
    const parallaxY = interpolate(
      scrollY.value,
      [0, 300],
      [0, -50],
      Extrapolation.CLAMP,
    );
    const parallaxScale = interpolate(
      scrollY.value,
      [0, 300],
      [1, 0.88],
      Extrapolation.CLAMP,
    );
    const parallaxOp = interpolate(
      scrollY.value,
      [0, 200],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: logoOp.value * parallaxOp,
      transform: [{ translateY: parallaxY }, { scale: parallaxScale }],
    };
  });

  const logoTextGlowStyle = useAnimatedStyle(() => ({
    opacity: logoTextGlow.value,
    transform: [{ translateY: logoTextFloat.value }],
  }));

  const accentStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value * pulseOpacity.value,
  }));

  // Hero: mount slide-up + subtle scroll parallax
  const heroStyle = useAnimatedStyle(() => {
    const parallaxY = interpolate(
      scrollY.value,
      [0, 400],
      [0, -30],
      Extrapolation.CLAMP,
    );
    return {
      opacity: heroOp.value,
      transform: [{ translateY: heroSlide.value + parallaxY }],
    };
  });

  // Metrics: mount slide-up
  const metricsStyle = useAnimatedStyle(() => ({
    opacity: metricsOp.value,
    transform: [{ translateY: metricsSlide.value }],
  }));

  // Features: mount slide-up
  const featuresStyle = useAnimatedStyle(() => ({
    opacity: featuresOp.value,
    transform: [{ translateY: featuresSlide.value }],
  }));

  // Bottom (trust + CTA + footer): mount slide-up
  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomOp.value,
    transform: [{ translateY: bottomSlide.value }],
  }));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Emblem / Logo Section */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.emblemOuter}>
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
                <Animated.Text
                  style={[
                    styles.emblemMeroitic,
                    {
                      color: isDark ? "#C9963F" : "#1A1207",
                      fontFamily:
                        Platform.OS === "android"
                          ? "NotoSansMeroitic"
                          : undefined,
                    },
                    logoTextGlowStyle,
                  ]}
                >
                  {"\u200A𐦠𐦴𐦯𐦡\u200A"}
                </Animated.Text>
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
                <Animated.Text
                  style={[
                    styles.emblemText,
                    { color: isDark ? "#F0E8D5" : "#1A1207" },
                    logoTextGlowStyle,
                  ]}
                >
                  NASTA
                </Animated.Text>
              </View>
            </View>
          </Animated.View>

          {/* Animated gold accent line */}
          <Animated.View style={[styles.accentLineContainer, accentStyle]}>
            <View
              style={[
                styles.accentLine,
                {
                  backgroundColor: isDark ? "#C9963F" : "rgba(184,130,42,0.4)",
                },
              ]}
            />
          </Animated.View>

          {/* Hero Section */}
          <Animated.View style={[styles.heroSection, heroStyle]}>
            <Text
              style={[
                styles.heroLabel,
                {
                  color: isDark
                    ? "rgba(201,150,63,0.8)"
                    : "rgba(184,130,42,0.6)",
                },
              ]}
            >
              {t("landing.heroLabel")}
            </Text>
            <Text
              style={[
                styles.heroTitle,
                { color: isDark ? "#F0E8D5" : "#1A1207" },
              ]}
            >
              {t("landing.heroTitle")}
            </Text>
            <Text
              style={[
                styles.heroSubtitle,
                { color: isDark ? "rgba(240,232,213,0.6)" : "#8A7B68" },
              ]}
            >
              {t("landing.heroSubtitle")}
            </Text>
          </Animated.View>

          {/* Metrics Bar */}
          <Animated.View
            style={[
              styles.metricsBar,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.7)"
                  : "rgba(240, 232, 213, 0.85)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.15)"
                  : "rgba(184,130,42,0.08)",
              },
              metricsStyle,
            ]}
          >
            <MetricItem
              value={t("landing.metricUsersValue")}
              label={t("landing.metricUsersLabel")}
              isDark={isDark}
            />
            <View
              style={[
                styles.metricDivider,
                {
                  backgroundColor: isDark
                    ? "rgba(201,150,63,0.2)"
                    : "rgba(184,130,42,0.12)",
                },
              ]}
            />
            <MetricItem
              value={t("landing.metricJobsValue")}
              label={t("landing.metricJobsLabel")}
              isDark={isDark}
            />
            <View
              style={[
                styles.metricDivider,
                {
                  backgroundColor: isDark
                    ? "rgba(201,150,63,0.2)"
                    : "rgba(184,130,42,0.12)",
                },
              ]}
            />
            <MetricItem
              value={t("landing.metricPayoutsValue")}
              label={t("landing.metricPayoutsLabel")}
              isDark={isDark}
            />
          </Animated.View>

          {/* Feature Cards */}
          <Animated.View style={[styles.featuresSection, featuresStyle]}>
            <FeatureCard
              icon="shield"
              title={t("landing.findJobs")}
              description={t("landing.findJobsDescription")}
              isDark={isDark}
              colors={colors}
              accentColor={isDark ? "#4FD1C5" : "#2B8A7E"}
            />
            <FeatureCard
              icon="eye"
              title={t("landing.trackWork")}
              description={t("landing.trackWorkDescription")}
              isDark={isDark}
              colors={colors}
              accentColor={isDark ? "#C9963F" : "#B8822A"}
            />
            <FeatureCard
              icon="lock"
              title={t("landing.getPaid")}
              description={t("landing.getPaidDescription")}
              isDark={isDark}
              colors={colors}
              accentColor={isDark ? "#D4A853" : "#C9963F"}
            />
          </Animated.View>

          {/* Trust + CTA + Footer — single animated group */}
          <Animated.View style={bottomStyle}>
            {/* Trust Badge Strip */}
            <View
              style={[
                styles.trustStrip,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.5)"
                    : "rgba(240, 232, 213, 0.7)",
                  borderColor: isDark
                    ? "rgba(79, 209, 197, 0.15)"
                    : "rgba(43, 138, 126, 0.08)",
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={14}
                color={isDark ? "#4FD1C5" : "#2B8A7E"}
              />
              <Text
                style={[
                  styles.trustStripText,
                  { color: isDark ? "rgba(240,232,213,0.5)" : "#8A7B68" },
                ]}
              >
                {t("landing.trustBadge")}
              </Text>
            </View>

            {/* CTA Buttons */}
            <View style={styles.ctaSection}>
              <TouchableWithoutFeedback
                onPress={() =>
                  router.push("/register?role=JOB_SEEKER" as never)
                }
              >
                <View style={styles.primaryButtonWrapper}>
                  <LinearGradient
                    colors={
                      isDark
                        ? ["#C9963F", "#D4A853", "#C9963F"]
                        : ["#B8822A", "#C9963F", "#B8822A"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>
                      {t("landing.createAccount")}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={18}
                      color={isDark ? "#0A1628" : "#FFFAF0"}
                    />
                  </LinearGradient>
                </View>
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback
                onPress={() => router.push("/login" as never)}
              >
                <View
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: isDark
                        ? "rgba(201,150,63,0.3)"
                        : "rgba(29,24,17,0.35)",
                      backgroundColor: isDark
                        ? "transparent"
                        : "rgba(29,24,17,0.06)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: isDark ? "#F0E8D5" : "#1A1207" },
                    ]}
                  >
                    {t("landing.login")}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider}>
                <View
                  style={[
                    styles.footerLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.08)",
                    },
                  ]}
                />
                <Feather
                  name="shield"
                  size={12}
                  color={
                    isDark ? "rgba(201,150,63,0.3)" : "rgba(184,130,42,0.2)"
                  }
                />
                <View
                  style={[
                    styles.footerLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.08)",
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.footerText,
                  { color: isDark ? "rgba(240,232,213,0.35)" : "#9A8E7A" },
                ]}
              >
                {t("landing.termsAgreement")}
              </Text>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ─── Metric Item ─────────────────────────────────────────────── */
function MetricItem({
  value,
  label,
  isDark,
}: {
  value: string;
  label: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.metricItem}>
      <Text
        style={[styles.metricValue, { color: isDark ? "#C9963F" : "#B8822A" }]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.metricLabel,
          { color: isDark ? "rgba(240,232,213,0.45)" : "#8A7B68" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ─── Feature Card ────────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
  isDark,
  colors,
  accentColor,
}: {
  icon: string;
  title: string;
  description: string;
  isDark: boolean;
  colors: any;
  accentColor: string;
}) {
  return (
    <View
      style={[
        styles.featureCard,
        {
          backgroundColor: isDark
            ? "rgba(12, 22, 42, 0.65)"
            : "rgba(240, 232, 213, 0.85)",
          borderColor: isDark
            ? "rgba(201,150,63,0.1)"
            : "rgba(184,130,42,0.06)",
        },
      ]}
    >
      {/* Left accent bar */}
      <View
        style={[styles.featureAccentBar, { backgroundColor: accentColor }]}
      />
      <View style={styles.featureContent}>
        <View style={styles.featureHeader}>
          <View
            style={[
              styles.featureIconContainer,
              {
                backgroundColor: isDark
                  ? "rgba(201, 150, 63, 0.12)"
                  : "rgba(201, 150, 63, 0.08)",
              },
            ]}
          >
            <Feather name={icon as any} size={20} color={accentColor} />
          </View>
          <Text
            style={[
              styles.featureTitle,
              { color: isDark ? "#F0E8D5" : "#1A1207" },
            ]}
          >
            {title}
          </Text>
        </View>
        <Text
          style={[
            styles.featureDescription,
            { color: isDark ? "rgba(240,232,213,0.55)" : "#8A7B68" },
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 40,
  },

  /* ── Emblem / Logo ─────────────────────────────────── */
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  emblemOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  emblemFrame: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emblemText: {
    fontFamily: Platform.OS === "ios" ? "Arial" : "sans-serif",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 8,
    textTransform: "uppercase",
  },
  emblemMeroitic: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 2,
    paddingHorizontal: 8,
    textAlign: "center",
    includeFontPadding: false,
  },
  emblemDivider: {
    width: 40,
    height: 1,
    marginVertical: 8,
  },

  /* ── Gold accent line ──────────────────────────────── */
  accentLineContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  accentLine: {
    width: 48,
    height: 2,
    borderRadius: 1,
  },

  /* ── Hero ───────────────────────────────────────────── */
  heroSection: {
    marginBottom: 36,
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.5,
    lineHeight: 46,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 16,
  },

  /* ── Metrics Bar ───────────────────────────────────── */
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 36,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  metricDivider: {
    width: 1,
    height: 28,
  },

  /* ── Feature Cards ─────────────────────────────────── */
  featuresSection: {
    marginBottom: 36,
    gap: 14,
  },
  featureCard: {
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 0,
  },
  featureAccentBar: {
    width: 3,
  },
  featureContent: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 52,
  },

  /* ── CTA ────────────────────────────────────────────── */
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  trustStripText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  ctaSection: {
    gap: 12,
    marginBottom: 28,
  },
  primaryButtonWrapper: {
    borderRadius: 4,
    overflow: "hidden",
  },
  primaryButton: {
    flexDirection: "row",
    borderRadius: 4,
    paddingVertical: 17,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  secondaryButton: {
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    elevation: 0,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* ── Footer ─────────────────────────────────────────── */
  footer: {
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  footerDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  footerLine: {
    height: 1,
    width: 48,
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 24,
  },
});
