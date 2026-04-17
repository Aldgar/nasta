import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
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
import CaptureReview from "../../components/kyc/CaptureReview";

export default function CaptureFrontScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch, requiresBack, totalSteps } = useKyc();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(
    state.idFront?.uri ?? null,
  );
  const [taking, setTaking] = useState(false);

  const stepNumber = 2;

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
      type: "SET_ID_FRONT",
      image: { uri: capturedUri, width: 0, height: 0 },
    });
    if (requiresBack) {
      router.push("/kyc/capture-back" as any);
    } else {
      router.push("/kyc/capture-selfie" as any);
    }
  };

  const handleRetake = () => setCapturedUri(null);

  // If we have a captured image, show review
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
          <CaptureReview
            imageUri={capturedUri}
            title={t("kyc.frontOfId") || "Front of ID"}
            onAccept={handleAccept}
            onRetake={handleRetake}
          />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Permission not granted
  if (!permission?.granted) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.permissionContainer}>
            <Feather name="camera-off" size={48} color={colors.textMuted} />
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              {t("kyc.cameraAccess") || "Camera Access Required"}
            </Text>
            <Text style={[styles.permissionText, { color: colors.textMuted }]}>
              {t("kyc.cameraPermissionDesc") ||
                "We need camera access to capture your ID document."}
            </Text>
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: colors.gold }]}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>
                {t("kyc.enableCamera") || "Enable Camera"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.galleryLink}
              onPress={handleGallery}
            >
              <Text style={[styles.galleryLinkText, { color: colors.gold }]}>
                {t("kyc.orChooseFromGallery") || "Or choose from gallery"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Camera view
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Overlay */}
      <SafeAreaView style={styles.cameraOverlaySafe} edges={["top"]}>
        {/* Top bar */}
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
          {t("kyc.frontOfYourId") || "Front of your ID"}
        </Text>
      </SafeAreaView>

      {/* Document frame overlay */}
      <View style={styles.overlayCenter}>
        <CameraOverlay
          type="document"
          hint={
            t("kyc.alignDocumentHint") ||
            "Place your document on a flat surface and align it within the frame"
          }
        />
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.cameraBottom} edges={["bottom"]}>
        <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
          <Feather name="image" size={22} color="#fff" />
          <Text style={styles.galleryBtnText}>
            {t("kyc.gallery") || "Gallery"}
          </Text>
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
  // Camera styles
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
  cameraStepLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
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
    top: "18%",
    left: 0,
    right: 0,
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
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  galleryBtn: {
    alignItems: "center",
    gap: 4,
    width: 60,
  },
  galleryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  // Permission styles
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  galleryLink: {
    padding: 12,
  },
  galleryLinkText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
