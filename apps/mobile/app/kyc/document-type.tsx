import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc, IdDocumentType } from "../../context/KycContext";
import GradientBackground from "../../components/GradientBackground";
import StepIndicator from "../../components/kyc/StepIndicator";

const DOC_OPTIONS: {
  type: IdDocumentType;
  icon: keyof typeof Feather.glyphMap;
  labelKey: string;
  fallback: string;
}[] = [
  {
    type: "PASSPORT",
    icon: "book-open",
    labelKey: "kyc.idTypeOptions.passport",
    fallback: "Passport",
  },
  {
    type: "NATIONAL_ID",
    icon: "credit-card",
    labelKey: "kyc.idTypeOptions.nationalId",
    fallback: "National ID Card",
  },
  {
    type: "RESIDENCE_PERMIT",
    icon: "file-text",
    labelKey: "kyc.idTypeOptions.residencePermit",
    fallback: "Residence Permit",
  },
];

export default function DocumentTypeScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, totalSteps } = useKyc();
  const [selected, setSelected] = useState<IdDocumentType | null>(
    state.documentType,
  );

  const handleContinue = () => {
    if (!selected) return;
    dispatch({ type: "SET_DOCUMENT_TYPE", docType: selected });
    router.push("/kyc/capture-front" as any);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            {t("kyc.stepOf", { current: 1, total: totalSteps }) ||
              `Step 1 of ${totalSteps}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <StepIndicator currentStep={1} totalSteps={totalSteps} />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.selectYourDocument") || "Select your document"}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.chooseDocType") ||
              "Choose the type of ID document you'd like to use for verification."}
          </Text>

          {/* Document cards */}
          <View style={styles.cards}>
            {DOC_OPTIONS.map((opt) => {
              const isSelected = selected === opt.type;
              return (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.cardBg,
                      borderColor: isSelected ? colors.gold : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelected(opt.type)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.cardIcon,
                      {
                        backgroundColor: isSelected
                          ? `${colors.gold}20`
                          : colors.input,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={24}
                      color={isSelected ? colors.gold : colors.icon}
                    />
                  </View>
                  <Text
                    style={[
                      styles.cardLabel,
                      {
                        color: isSelected ? colors.gold : colors.text,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {t(opt.labelKey) || opt.fallback}
                  </Text>
                  {isSelected && (
                    <View
                      style={[
                        styles.checkCircle,
                        { backgroundColor: colors.gold },
                      ]}
                    >
                      <Feather name="check" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: selected ? colors.gold : colors.input,
                opacity: selected ? 1 : 0.5,
              },
            ]}
            onPress={handleContinue}
            disabled={!selected}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueText,
                { color: selected ? "#fff" : colors.textMuted },
              ]}
            >
              {t("kyc.continue") || "Continue"}
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
  backButton: { padding: 8 },
  stepLabel: { fontSize: 14, fontWeight: "500" },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  cards: { gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 16,
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
