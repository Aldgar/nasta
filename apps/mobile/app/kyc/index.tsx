import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc } from "../../context/KycContext";
import GradientBackground from "../../components/GradientBackground";

export default function KycWelcome() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { dispatch } = useKyc();
  const params = useLocalSearchParams();

  useEffect(() => {
    const vid = params.verificationId;
    if (vid && typeof vid === "string") {
      dispatch({ type: "SET_VERIFICATION_ID", id: vid });
    }
  }, [params.verificationId]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            router.replace("/user-home" as any);
          }}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Shield icon */}
          <View
            style={[styles.iconCircle, { backgroundColor: `${colors.gold}20` }]}
          >
            <Feather name="shield" size={48} color={colors.gold} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.verifyYourIdentity") || "Verify Your Identity"}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.welcomeSubtitle") ||
              "To start working, we need to verify your identity. This takes about 3 minutes."}
          </Text>

          {/* Requirements list */}
          <View style={styles.requirements}>
            <RequirementRow
              icon="credit-card"
              text={t("kyc.reqValidId") || "A valid ID document"}
              colors={colors}
            />
            <RequirementRow
              icon="sun"
              text={t("kyc.reqLighting") || "Good lighting"}
              colors={colors}
            />
            <RequirementRow
              icon="maximize"
              text={t("kyc.reqBackground") || "A clear background"}
              colors={colors}
            />
          </View>
        </View>

        {/* CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/kyc/document-type" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {t("kyc.getStarted") || "Get Started"}
            </Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

function RequirementRow({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  colors: any;
}) {
  return (
    <View style={styles.reqRow}>
      <View
        style={[styles.reqIcon, { backgroundColor: `${colors.emerald}20` }]}
      >
        <Feather name={icon} size={18} color={colors.emerald} />
      </View>
      <Text style={[styles.reqText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  backButton: {
    padding: 16,
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  requirements: {
    alignSelf: "stretch",
    gap: 16,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  reqIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reqText: {
    fontSize: 16,
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
