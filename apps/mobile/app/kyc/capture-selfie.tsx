import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc } from "../../context/KycContext";
import GradientBackground from "../../components/GradientBackground";
import StepIndicator from "../../components/kyc/StepIndicator";
import CameraOverlay from "../../components/kyc/CameraOverlay";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CaptureSelfieScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, requiresBack, totalSteps } = useKyc();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(
    state.selfie?.uri ?? null,
  );
  const [taking, setTaking] = useState(false);

  const stepNumber = requiresBack ? 4 : 3;

  const handleCapture = async () => {
    if (!cameraRef.current || taking) return;
    setTaking(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) setCapturedUri(photo.uri);
    } catch (e) {
      console.warn("Camera capture error:", e);
    } finally {
      setTaking(false);
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri);
    }
  };

  const handleAccept = () => {
    if (!capturedUri) return;
    dispatch({
      type: "SET_SELFIE",
      image: { uri: capturedUri, width: 0, height: 0 },
    });
    router.push("/kyc/review" as any);
  };

  const handleRetake = () => setCapturedUri(null);

  // Review mode for selfie
  if (capturedUri) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleRetake}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
              {`Step ${stepNumber} of ${totalSteps}`}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <StepIndicator currentStep={stepNumber} totalSteps={totalSteps} />

          <View style={styles.reviewContainer}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              {t("kyc.doesThisLookGood") || "Does this look good?"}
            </Text>

            <View style={styles.selfiePreviewWrap}>
              <Image
                source={{ uri: capturedUri }}
                style={styles.selfiePreview}
                resizeMode="cover"
              />
            </View>

            <View style={styles.checks}>
              <CheckRow
                text={t("kyc.faceFullyVisible") || "Face is fully visible"}
                color={colors.emerald}
              />
              <CheckRow
                text={t("kyc.goodLighting") || "Good, even lighting"}
                color={colors.emerald}
              />
              <CheckRow
                text={t("kyc.noGlasses") || "No sunglasses or hat"}
                color={colors.emerald}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.retakeButton,
                  { borderColor: colors.border },
                ]}
                onPress={handleRetake}
              >
                <Feather name="refresh-cw" size={18} color={colors.text} />
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  Retake
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.emerald }]}
                onPress={handleAccept}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={[styles.buttonText, { color: "#fff" }]}>
                  Use this
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Permission
  if (!permission?.granted) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.permissionContainer}>
            <Feather name="camera-off" size={48} color={colors.textMuted} />
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              Camera Access Required
            </Text>
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: colors.gold }]}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>Enable Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.galleryLink}
              onPress={handleGallery}
            >
              <Text style={[styles.galleryLinkText, { color: colors.gold }]}>
                Or choose from gallery
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Camera with face oval
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mirror={true}
      />

      <SafeAreaView style={styles.cameraOverlaySafe} edges={["top"]}>
        <View style={styles.cameraTopBar}>
          <TouchableOpacity
            style={styles.cameraCloseBtn}
            onPress={() => router.back()}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.cameraStepLabel}>
            {`Step ${stepNumber} of ${totalSteps}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.cameraTitle}>
          {t("kyc.takeASelfie") || "Take a selfie"}
        </Text>
      </SafeAreaView>

      {/* Face oval overlay */}
      <View style={styles.overlayCenter}>
        <CameraOverlay
          type="face"
          hint={
            t("kyc.selfieHint") ||
            "Position your face in the oval. Look straight ahead."
          }
        />
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <View style={styles.tipRow}>
          <Feather name="sun" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.tipText}>Good lighting</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="eye" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.tipText}>Look straight</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="x-circle" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.tipText}>No glasses</Text>
        </View>
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.cameraBottom} edges={["bottom"]}>
        <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
          <Feather name="image" size={22} color="#fff" />
          <Text style={styles.galleryBtnText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutterBtn, { borderColor: colors.gold }]}
          onPress={handleCapture}
          disabled={taking}
          activeOpacity={0.7}
        >
          <View style={[styles.shutterInner, { backgroundColor: "#fff" }]} />
        </TouchableOpacity>

        <View style={{ width: 60 }} />
      </SafeAreaView>
    </View>
  );
}

function CheckRow({ text, color }: { text: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.checkRow}>
      <Feather name="check-circle" size={18} color={color} />
      <Text style={[styles.checkText, { color: colors.text }]}>{text}</Text>
    </View>
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
  // Review
  reviewContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  selfiePreviewWrap: {
    alignSelf: "center",
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55 * 1.3,
    borderRadius: SCREEN_WIDTH * 0.275,
    overflow: "hidden",
    marginBottom: 24,
  },
  selfiePreview: {
    width: "100%",
    height: "100%",
  },
  checks: { gap: 12, marginBottom: 32, paddingHorizontal: 20 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { fontSize: 15, fontWeight: "500" },
  buttons: { flexDirection: "row", gap: 12, paddingHorizontal: 4 },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retakeButton: { borderWidth: 1.5 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlaySafe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 0 : 16,
    paddingBottom: 8,
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraStepLabel: { color: "#fff", fontSize: 14, fontWeight: "500" },
  cameraTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayCenter: {
    position: "absolute",
    top: "14%",
    left: 0,
    right: 0,
  },
  tipsContainer: {
    position: "absolute",
    bottom: "18%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  cameraBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29 },
  galleryBtn: { alignItems: "center", gap: 4, width: 60 },
  galleryBtnText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  permissionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  galleryLink: { padding: 12 },
  galleryLinkText: { fontSize: 15, fontWeight: "600" },
});
