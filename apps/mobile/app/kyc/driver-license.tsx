import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Switch,
  Alert,
  ActionSheetIOS,
  Platform,
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

export default function DriverLicenseScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, requiresBack, totalSteps } = useKyc();

  const stepNumber = requiresBack ? 7 : 6;

  const [dlFrontUri, setDlFrontUri] = useState<string | null>(
    state.dlFront?.uri ?? null,
  );
  const [dlBackUri, setDlBackUri] = useState<string | null>(
    state.dlBack?.uri ?? null,
  );

  const setImage = (
    side: "front" | "back",
    uri: string,
    width = 0,
    height = 0,
  ) => {
    const img = { uri, width, height };
    if (side === "front") {
      setDlFrontUri(uri);
      dispatch({ type: "SET_DL_FRONT", image: img });
    } else {
      setDlBackUri(uri);
      dispatch({ type: "SET_DL_BACK", image: img });
    }
  };

  const takePhoto = async (side: "front" | "back") => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("kyc.cameraAccess") || "Camera Access",
        t("kyc.cameraPermissionDesc") || "Please allow camera access.",
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        setImage(side, a.uri, a.width, a.height);
      }
    } catch {
      // launchCameraAsync fails on simulators — fall back to gallery picker
      pickFromGallery(side);
    }
  };

  const pickFromGallery = async (side: "front" | "back") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImage(side, a.uri, a.width, a.height);
    }
  };

  const pickFile = async (side: "front" | "back") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setImage(side, result.assets[0].uri);
      }
    } catch {
      // cancelled
    }
  };

  const showPickerOptions = (side: "front" | "back") => {
    const options = [
      t("kyc.takePhoto") || "Take Photo",
      t("kyc.chooseFromGallery") || "Choose from Gallery",
      t("kyc.chooseFile") || "Choose File",
      t("common.cancel") || "Cancel",
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3 },
        (idx) => {
          if (idx === 0) takePhoto(side);
          else if (idx === 1) pickFromGallery(side);
          else if (idx === 2) pickFile(side);
        },
      );
    } else {
      Alert.alert(t("kyc.selectSource") || "Select Source", undefined, [
        { text: options[0], onPress: () => takePhoto(side) },
        { text: options[1], onPress: () => pickFromGallery(side) },
        { text: options[2], onPress: () => pickFile(side) },
        { text: options[3], style: "cancel" },
      ]);
    }
  };

  const handleToggle = (value: boolean) => {
    dispatch({ type: "SET_INCLUDE_DRIVERS_LICENSE", include: value });
    // Vehicle registration is mandatory when driving is required
    dispatch({ type: "SET_INCLUDE_VEHICLE", include: value });
    if (!value) {
      setDlFrontUri(null);
      setDlBackUri(null);
    }
  };

  const handleContinue = () => {
    if (state.includeDriversLicense) {
      if (!dlFrontUri || !dlBackUri) {
        Alert.alert(
          t("kyc.missingDocument") || "Missing Document",
          t("kyc.pleaseUploadBothLicenseSides") ||
            "Please upload both front and back of your driver's license.",
        );
        return;
      }
      // Vehicle is mandatory when driving — always go to vehicle
      router.push("/kyc/vehicle" as any);
    } else {
      router.push("/kyc/documents" as any);
    }
  };

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
            <Feather name="credit-card" size={32} color={colors.gold} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t("kyc.driverVerification") || "Driver Verification"}
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("kyc.driverVerificationDescription") ||
              "If your job requires driving, upload your driver's license."}
          </Text>

          {/* Toggle */}
          <View style={[styles.toggleRow, { backgroundColor: colors.cardBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                {t("kyc.doesJobRequireDriving") ||
                  "Does your job require driving?"}
              </Text>
            </View>
            <Switch
              value={state.includeDriversLicense}
              onValueChange={handleToggle}
              trackColor={{ false: colors.border, true: colors.gold }}
              thumbColor="#fff"
            />
          </View>

          {state.includeDriversLicense && (
            <View style={styles.uploadSection}>
              {/* Front */}
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                {t("kyc.frontOfDriversLicense") || "Front of Driver's License"}
              </Text>
              {dlFrontUri ? (
                <View
                  style={[
                    styles.uploadCard,
                    {
                      borderColor: colors.emerald,
                      backgroundColor: `${colors.cardBg}80`,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dlFrontUri }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.changeBtn,
                      { backgroundColor: colors.cardBg },
                    ]}
                    onPress={() => showPickerOptions("front")}
                  >
                    <Feather name="refresh-cw" size={14} color={colors.gold} />
                    <Text
                      style={[styles.changeBtnText, { color: colors.gold }]}
                    >
                      {t("kyc.retake") || "Retake"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => takePhoto("front")}
                  >
                    <Feather name="camera" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.takePhoto") || "Camera"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => pickFromGallery("front")}
                  >
                    <Feather name="image" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.gallery") || "Gallery"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => pickFile("front")}
                  >
                    <Feather name="file" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.chooseFile") || "File"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Back */}
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.text, marginTop: 20 },
                ]}
              >
                {t("kyc.backOfDriversLicense") || "Back of Driver's License"}
              </Text>
              {dlBackUri ? (
                <View
                  style={[
                    styles.uploadCard,
                    {
                      borderColor: colors.emerald,
                      backgroundColor: `${colors.cardBg}80`,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: dlBackUri }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.changeBtn,
                      { backgroundColor: colors.cardBg },
                    ]}
                    onPress={() => showPickerOptions("back")}
                  >
                    <Feather name="refresh-cw" size={14} color={colors.gold} />
                    <Text
                      style={[styles.changeBtnText, { color: colors.gold }]}
                    >
                      {t("kyc.retake") || "Retake"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => takePhoto("back")}
                  >
                    <Feather name="camera" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.takePhoto") || "Camera"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => pickFromGallery("back")}
                  >
                    <Feather name="image" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.gallery") || "Gallery"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: `${colors.cardBg}80`,
                      },
                    ]}
                    onPress={() => pickFile("back")}
                  >
                    <Feather name="file" size={22} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.chooseFile") || "File"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Vehicle registration required info */}
              <View
                style={[
                  styles.vehicleConfirm,
                  {
                    backgroundColor: `${colors.emerald}15`,
                    borderColor: `${colors.emerald}40`,
                    marginTop: 20,
                  },
                ]}
              >
                <View style={styles.vehicleConfirmIcon}>
                  <Feather name="truck" size={20} color={colors.emerald} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.vehicleConfirmTitle,
                      { color: colors.emerald },
                    ]}
                  >
                    {t("kyc.vehicleStepReady") ||
                      "Vehicle registration is next"}
                  </Text>
                  <Text
                    style={[
                      styles.vehicleConfirmDesc,
                      { color: colors.textMuted },
                    ]}
                  >
                    {t("kyc.vehicleRegistrationRequired") ||
                      "Vehicle registration is required when your job involves driving."}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.gold }]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueText}>
              {state.includeDriversLicense
                ? t("kyc.continueToVehicle") || "Continue to Vehicle"
                : t("kyc.continueToDocuments") || "Continue to Documents"}
            </Text>
            <Feather name="arrow-right" size={20} color="#000" />
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
    paddingVertical: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center" },
  stepLabel: { fontSize: 14 },
  content: { paddingHorizontal: 24, paddingBottom: 120 },
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleLabel: { fontSize: 16, fontWeight: "600" },
  toggleDesc: { fontSize: 13, marginTop: 4 },
  uploadSection: { marginTop: 8 },
  sectionLabel: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  vehicleConfirm: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  vehicleConfirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  vehicleConfirmTitle: { fontSize: 14, fontWeight: "600" },
  vehicleConfirmDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  uploadCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    height: 160,
    overflow: "hidden",
    position: "relative",
  },
  preview: { width: "100%", height: "100%" },
  changeBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeBtnText: { fontSize: 13, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: { fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: Platform.OS === "android" ? 56 : 36,
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
});
