import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
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

export default function CriminalRecordScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, requiresBack, totalSteps } = useKyc();

  const [fileUri, setFileUri] = useState<string | null>(
    state.criminalRecord?.uri ?? null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  const stepNumber = requiresBack ? 6 : 5;

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(null);
      setIsPdf(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setFileUri(asset.uri);
        setFileName(asset.name);
        setIsPdf(asset.mimeType?.includes("pdf") ?? false);
      }
    } catch {
      // User cancelled
    }
  };

  const handleContinue = () => {
    if (!fileUri) {
      Alert.alert(
        t("kyc.missingDocument") || "Missing Document",
        t("kyc.criminalRecordRequired") ||
          "Please upload your criminal record certificate to continue.",
      );
      return;
    }
    dispatch({
      type: "SET_CRIMINAL_RECORD",
      doc: { uri: fileUri, type: isPdf ? "pdf" : "image" },
    });
    router.push("/kyc/driver-license" as any);
  };

  const handleRemove = () => {
    setFileUri(null);
    setFileName(null);
    setIsPdf(false);
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
          <View
            style={[styles.iconCircle, { backgroundColor: `${colors.gold}20` }]}
          >
            <Feather name="file-text" size={32} color={colors.gold} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.criminalRecordTitle") || "Criminal Record Certificate"}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.criminalRecordDesc") ||
              "Upload your criminal record certificate. This can be a photo or PDF document."}
          </Text>

          {/* Upload area */}
          {fileUri ? (
            <View style={[styles.fileCard, { borderColor: colors.emerald }]}>
              {isPdf ? (
                <View
                  style={[
                    styles.pdfPreview,
                    { backgroundColor: `${colors.gold}10` },
                  ]}
                >
                  <Feather name="file-text" size={40} color={colors.gold} />
                  <Text
                    style={[styles.pdfName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {fileName || "Document.pdf"}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: fileUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: colors.cardBg }]}
                onPress={handleRemove}
              >
                <Feather
                  name="trash-2"
                  size={16}
                  color={colors.danger || "#EF4444"}
                />
                <Text
                  style={[
                    styles.removeText,
                    { color: colors.danger || "#EF4444" },
                  ]}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handlePickPhoto}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.uploadIcon, { backgroundColor: colors.input }]}
                >
                  <Feather name="image" size={24} color={colors.gold} />
                </View>
                <Text style={[styles.uploadLabel, { color: colors.text }]}>
                  {t("kyc.choosePhoto") || "Choose Photo"}
                </Text>
                <Text style={[styles.uploadHint, { color: colors.textMuted }]}>
                  From gallery
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.uploadCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handlePickDocument}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.uploadIcon, { backgroundColor: colors.input }]}
                >
                  <Feather name="file" size={24} color={colors.gold} />
                </View>
                <Text style={[styles.uploadLabel, { color: colors.text }]}>
                  {t("kyc.choosePdf") || "Choose PDF"}
                </Text>
                <Text style={[styles.uploadHint, { color: colors.textMuted }]}>
                  From files
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info banner */}
          <View
            style={[
              styles.infoBanner,
              { backgroundColor: `${colors.gold}10`, borderColor: colors.gold },
            ]}
          >
            <Feather name="info" size={16} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t("kyc.criminalRecordInfo") ||
                "This document will be verified by our team. Make sure it's recent (less than 3 months old) and clearly readable."}
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: fileUri ? colors.gold : colors.input,
                opacity: fileUri ? 1 : 0.5,
              },
            ]}
            onPress={handleContinue}
            disabled={!fileUri}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueText,
                { color: fileUri ? "#fff" : colors.textMuted },
              ]}
            >
              {t("kyc.continueToDriverVerification") ||
                "Continue to Driver Verification"}
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
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
  },
  // Upload area
  uploadOptions: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
    marginBottom: 24,
  },
  uploadCard: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadLabel: { fontSize: 15, fontWeight: "600" },
  uploadHint: { fontSize: 13 },
  // File preview
  fileCard: {
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 24,
  },
  imagePreview: {
    width: "100%",
    height: 200,
  },
  pdfPreview: {
    width: "100%",
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pdfName: { fontSize: 14, fontWeight: "500" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  removeText: { fontSize: 14, fontWeight: "600" },
  // Info banner
  infoBanner: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  // Footer
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
