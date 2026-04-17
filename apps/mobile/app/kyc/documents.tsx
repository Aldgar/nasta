import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc } from "../../context/KycContext";
import GradientBackground from "../../components/GradientBackground";
import StepIndicator from "../../components/kyc/StepIndicator";

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, requiresBack, totalSteps } = useKyc();

  const stepNumber = requiresBack ? 8 : 7;

  const pickDocument = async (target: "certification" | "cv") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const doc = {
          uri: asset.uri,
          name: asset.name || "Document",
          type: (asset.mimeType?.includes("pdf") ? "pdf" : "image") as
            | "pdf"
            | "image",
        };
        if (target === "certification") {
          dispatch({ type: "ADD_CERTIFICATION", doc });
        } else {
          dispatch({ type: "ADD_CV", doc });
        }
      }
    } catch {
      // User cancelled
    }
  };

  const pickImage = async (target: "certification" | "cv") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const doc = {
        uri: asset.uri,
        name: asset.fileName || "Photo",
        type: "image" as const,
      };
      if (target === "certification") {
        dispatch({ type: "ADD_CERTIFICATION", doc });
      } else {
        dispatch({ type: "ADD_CV", doc });
      }
    }
  };

  const handleContinue = () => {
    router.push("/kyc/processing" as any);
  };

  const renderDocList = (
    docs: { uri: string; name: string; type: "pdf" | "image" }[],
    removeAction: "REMOVE_CERTIFICATION" | "REMOVE_CV",
  ) =>
    docs.map((doc, i) => (
      <View
        key={`${doc.uri}-${i}`}
        style={[styles.fileRow, { backgroundColor: colors.cardBg }]}
      >
        <Feather
          name={doc.type === "pdf" ? "file-text" : "image"}
          size={20}
          color={colors.gold}
        />
        <Text
          style={[styles.fileName, { color: colors.text }]}
          numberOfLines={1}
        >
          {doc.name}
        </Text>
        <TouchableOpacity
          onPress={() =>
            dispatch({
              type: removeAction,
              index: i,
            } as any)
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name="trash-2"
            size={18}
            color={colors.danger || "#EF4444"}
          />
        </TouchableOpacity>
      </View>
    ));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            {t("kyc.stepOf", { current: stepNumber, total: totalSteps }) ||
              `Step ${stepNumber} of ${totalSteps}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <StepIndicator currentStep={stepNumber} totalSteps={totalSteps} />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: `${colors.gold}20` }]}
          >
            <Feather name="folder" size={32} color={colors.gold} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.professionalDocuments") || "Professional Documents"}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.professionalDocumentsDesc") ||
              "Upload any certifications, qualifications, or your CV. These help match you with relevant jobs."}
          </Text>

          {/* Certifications */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="award" size={20} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("kyc.certifications") || "Certifications & Qualifications"}
              </Text>
            </View>

            <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
              {t("kyc.certificationsDesc") ||
                "Upload professional certificates, licences, or qualifications (PDF or photo)."}
            </Text>

            {renderDocList(state.certifications, "REMOVE_CERTIFICATION")}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.border }]}
                onPress={() => pickDocument("certification")}
              >
                <Feather name="file-plus" size={18} color={colors.gold} />
                <Text style={[styles.addBtnText, { color: colors.gold }]}>
                  {t("kyc.choosePdf") || "PDF"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.border }]}
                onPress={() => pickImage("certification")}
              >
                <Feather name="camera" size={18} color={colors.gold} />
                <Text style={[styles.addBtnText, { color: colors.gold }]}>
                  {t("kyc.choosePhoto") || "Photo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CV */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file" size={20} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("kyc.cvResume") || "CV / Resume"}
              </Text>
            </View>

            <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
              {t("kyc.cvResumeDesc") ||
                "Upload your CV or resume to showcase your experience."}
            </Text>

            {renderDocList(state.cvDocuments, "REMOVE_CV")}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.border }]}
                onPress={() => pickDocument("cv")}
              >
                <Feather name="file-plus" size={18} color={colors.gold} />
                <Text style={[styles.addBtnText, { color: colors.gold }]}>
                  {t("kyc.choosePdf") || "PDF"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.border }]}
                onPress={() => pickImage("cv")}
              >
                <Feather name="camera" size={18} color={colors.gold} />
                <Text style={[styles.addBtnText, { color: colors.gold }]}>
                  {t("kyc.choosePhoto") || "Photo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info note */}
          <View
            style={[styles.infoBox, { backgroundColor: `${colors.gold}10` }]}
          >
            <Feather name="info" size={16} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t("kyc.documentsOptionalNote") ||
                "These documents are optional but recommended. You can always add them later from your profile settings."}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.gold }]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueText}>
              {t("kyc.submitVerification") || "Submit Verification"}
            </Text>
            <Feather name="arrow-right" size={20} color="#000" />
          </TouchableOpacity>

          {!state.includeVehicle && (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => router.push("/kyc/processing" as any)}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                {t("kyc.skipForNow") || "Skip for now"}
              </Text>
            </TouchableOpacity>
          )}
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
    paddingVertical: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center" },
  stepLabel: { fontSize: 14 },
  content: { paddingHorizontal: 24, paddingBottom: 140 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: "600" },
  sectionDesc: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  fileName: { flex: 1, fontSize: 14 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 36,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    gap: 8,
  },
  continueText: { fontSize: 17, fontWeight: "700", color: "#000" },
  skipBtn: { alignItems: "center", marginTop: 12 },
  skipText: { fontSize: 14 },
});
