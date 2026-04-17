import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc } from "../../context/KycContext";
import GradientBackground from "../../components/GradientBackground";
import StepIndicator from "../../components/kyc/StepIndicator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMB_W = (SCREEN_WIDTH - 24 * 2 - 12) / 2;

export default function ReviewScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, requiresBack, totalSteps } = useKyc();

  const stepNumber = requiresBack ? 5 : 4;

  const items: {
    label: string;
    uri: string | undefined;
    retakePath: string;
    isOval?: boolean;
  }[] = [
    {
      label: t("kyc.frontOfId") || "Front of ID",
      uri: state.idFront?.uri,
      retakePath: "/kyc/capture-front",
    },
  ];

  if (requiresBack) {
    items.push({
      label: t("kyc.backOfId") || "Back of ID",
      uri: state.idBack?.uri,
      retakePath: "/kyc/capture-back",
    });
  }

  items.push({
    label: t("kyc.selfie") || "Selfie",
    uri: state.selfie?.uri,
    retakePath: "/kyc/capture-selfie",
    isOval: true,
  });

  const allCaptured = items.every((i) => !!i.uri);

  const handleSubmit = () => {
    router.push("/kyc/criminal-record" as any);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            {`Step ${stepNumber} of ${totalSteps}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <StepIndicator currentStep={stepNumber} totalSteps={totalSteps} />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.reviewYourDocuments") || "Review your documents"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.reviewSubtitle") ||
              "Make sure everything looks clear before continuing."}
          </Text>

          {/* Thumbnail grid */}
          <View style={styles.grid}>
            {items.map((item) => (
              <View key={item.retakePath} style={styles.thumbContainer}>
                <View
                  style={[
                    styles.thumbWrap,
                    {
                      borderColor: item.uri ? colors.emerald : colors.border,
                      borderRadius: item.isOval ? THUMB_W / 2 : 12,
                      overflow: "hidden",
                      height: item.isOval ? THUMB_W * 1.2 : THUMB_W * 0.65,
                    },
                  ]}
                >
                  {item.uri ? (
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.thumbPlaceholder,
                        { backgroundColor: colors.input },
                      ]}
                    >
                      <Feather
                        name="camera"
                        size={24}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                </View>

                <Text style={[styles.thumbLabel, { color: colors.text }]}>
                  {item.label}
                </Text>

                <TouchableOpacity
                  style={styles.retakeLink}
                  onPress={() => router.push(item.retakePath as any)}
                >
                  <Feather name="refresh-cw" size={14} color={colors.gold} />
                  <Text style={[styles.retakeText, { color: colors.gold }]}>
                    {t("kyc.retake") || "Retake"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Status chips */}
          <View style={styles.statusContainer}>
            {items.map((item) => (
              <View
                key={item.retakePath + "-status"}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: item.uri
                      ? `${colors.emerald}15`
                      : `${colors.danger || "#EF4444"}15`,
                    borderColor: item.uri
                      ? colors.emerald
                      : colors.danger || "#EF4444",
                  },
                ]}
              >
                <Feather
                  name={item.uri ? "check-circle" : "alert-circle"}
                  size={14}
                  color={item.uri ? colors.emerald : colors.danger || "#EF4444"}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: item.uri
                        ? colors.emerald
                        : colors.danger || "#EF4444",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: allCaptured ? colors.gold : colors.input,
                opacity: allCaptured ? 1 : 0.5,
              },
            ]}
            onPress={handleSubmit}
            disabled={!allCaptured}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueText,
                { color: allCaptured ? "#fff" : colors.textMuted },
              ]}
            >
              {t("kyc.continueToBackgroundCheck") ||
                "Continue to Background Check"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBtn: { padding: 8 },
  stepLabel: { fontSize: 14, fontWeight: "500" },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 24,
  },
  thumbContainer: {
    width: THUMB_W,
    alignItems: "center",
    gap: 8,
  },
  thumbWrap: {
    width: "100%",
    borderWidth: 2,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  retakeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  retakeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  continueText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
