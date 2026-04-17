import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import { getApiBase } from "../../lib/api";

type VehicleType = "TRUCK" | "VAN" | "CAR" | "MOTORCYCLE" | "OTHER";

const VEHICLE_TYPES: { key: VehicleType; icon: string; label: string }[] = [
  { key: "TRUCK", icon: "truck", label: "Truck" },
  { key: "VAN", icon: "truck", label: "Van" },
  { key: "CAR", icon: "navigation", label: "Car" },
  { key: "MOTORCYCLE", icon: "wind", label: "Motorcycle" },
  { key: "OTHER", icon: "more-horizontal", label: "Other" },
];

const PHOTO_FIELDS = [
  { key: "photoFront", label: "Front", icon: "arrow-up" },
  { key: "photoBack", label: "Back", icon: "arrow-down" },
  { key: "photoLeft", label: "Left", icon: "arrow-left" },
  { key: "photoRight", label: "Right", icon: "arrow-right" },
  { key: "vehicleLicense", label: "License", icon: "file-text" },
] as const;

export default function VehicleScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [otherSpec, setOtherSpec] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [photoUris, setPhotoUris] = useState<Record<string, string | null>>({
    photoFront: null,
    photoBack: null,
    photoLeft: null,
    photoRight: null,
    vehicleLicense: null,
  });

  const takePhoto = async (fieldKey: string) => {
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
        setPhotoUris((prev) => ({ ...prev, [fieldKey]: result.assets[0].uri }));
      }
    } catch {
      // launchCameraAsync fails on simulators — fall back to gallery picker
      pickFromGallery(fieldKey);
    }
  };

  const pickFromGallery = async (fieldKey: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUris((prev) => ({ ...prev, [fieldKey]: result.assets[0].uri }));
    }
  };

  const pickFile = async (fieldKey: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUris((prev) => ({ ...prev, [fieldKey]: result.assets[0].uri }));
      }
    } catch {
      // cancelled
    }
  };

  const showPickerOptions = (fieldKey: string) => {
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
          if (idx === 0) takePhoto(fieldKey);
          else if (idx === 1) pickFromGallery(fieldKey);
          else if (idx === 2) pickFile(fieldKey);
        },
      );
    } else {
      Alert.alert(t("kyc.selectSource") || "Select Source", undefined, [
        { text: options[0], onPress: () => takePhoto(fieldKey) },
        { text: options[1], onPress: () => pickFromGallery(fieldKey) },
        { text: options[2], onPress: () => pickFile(fieldKey) },
        { text: options[3], style: "cancel" },
      ]);
    }
  };

  const handleSubmit = async () => {
    if (!make.trim() || !model.trim() || !year.trim() || !licensePlate.trim()) {
      Alert.alert(
        t("common.error") || "Error",
        t("vehicles.fillRequiredFields") ||
          "Please fill in all required fields.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();

      const createRes = await fetch(`${base}/vehicles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicleType,
          otherTypeSpecification:
            vehicleType === "OTHER" ? otherSpec.trim() : undefined,
          make: make.trim(),
          model: model.trim(),
          year: parseInt(year, 10),
          color: color.trim() || undefined,
          licensePlate: licensePlate.trim(),
          capacity: capacity.trim() || undefined,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        Alert.alert(
          t("common.error") || "Error",
          err.message ||
            t("vehicles.failedToCreate") ||
            "Failed to register vehicle.",
        );
        setSubmitting(false);
        return;
      }

      const vehicle = await createRes.json();

      // Upload photos
      const formData = new FormData();
      let hasPhotos = false;
      for (const field of PHOTO_FIELDS) {
        const uri = photoUris[field.key];
        if (uri) {
          hasPhotos = true;
          formData.append(field.key, {
            uri,
            name: `${field.key}.jpg`,
            type: "image/jpeg",
          } as any);
        }
      }

      if (hasPhotos) {
        await fetch(`${base}/vehicles/${vehicle.id}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      router.push("/kyc/documents" as any);
    } catch {
      Alert.alert(
        t("common.error") || "Error",
        t("vehicles.failedToCreate") || "Failed to register vehicle.",
      );
    } finally {
      setSubmitting(false);
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("kyc.vehicleRegistration") || "Vehicle Registration"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Vehicle Type */}
          <Text style={[styles.label, { color: colors.text }]}>
            {t("vehicles.vehicleType") || "Vehicle Type"}
          </Text>
          <View style={styles.typeRow}>
            {VEHICLE_TYPES.map((vt) => (
              <TouchableOpacity
                key={vt.key}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor:
                      vehicleType === vt.key
                        ? `${colors.gold}20`
                        : colors.cardBg,
                    borderColor:
                      vehicleType === vt.key ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setVehicleType(vt.key)}
              >
                <Feather
                  name={vt.icon as any}
                  size={16}
                  color={
                    vehicleType === vt.key ? colors.gold : colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.typeChipText,
                    {
                      color: vehicleType === vt.key ? colors.gold : colors.text,
                    },
                  ]}
                >
                  {t(`vehicles.type.${vt.key}`) || vt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {vehicleType === "OTHER" && (
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.cardBg,
                },
              ]}
              placeholder={t("vehicles.specifyType") || "Specify vehicle type"}
              placeholderTextColor={colors.textMuted}
              value={otherSpec}
              onChangeText={setOtherSpec}
            />
          )}

          {/* Form fields */}
          <Text style={[styles.label, { color: colors.text }]}>
            {t("vehicles.make") || "Make"} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.cardBg,
              },
            ]}
            placeholder="e.g., Toyota"
            placeholderTextColor={colors.textMuted}
            value={make}
            onChangeText={setMake}
          />

          <Text style={[styles.label, { color: colors.text }]}>
            {t("vehicles.model") || "Model"} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.cardBg,
              },
            ]}
            placeholder="e.g., Hilux"
            placeholderTextColor={colors.textMuted}
            value={model}
            onChangeText={setModel}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t("vehicles.year") || "Year"} *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.cardBg,
                  },
                ]}
                placeholder="2024"
                placeholderTextColor={colors.textMuted}
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t("vehicles.color") || "Color"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.cardBg,
                  },
                ]}
                placeholder="e.g., White"
                placeholderTextColor={colors.textMuted}
                value={color}
                onChangeText={setColor}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t("vehicles.licensePlate") || "License Plate"} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.cardBg,
              },
            ]}
            placeholder="e.g., AB-12-CD"
            placeholderTextColor={colors.textMuted}
            value={licensePlate}
            onChangeText={setLicensePlate}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.text }]}>
            {t("vehicles.capacity") || "Capacity"}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.cardBg,
              },
            ]}
            placeholder="e.g., 500kg, 5 passengers"
            placeholderTextColor={colors.textMuted}
            value={capacity}
            onChangeText={setCapacity}
          />

          {/* Vehicle Photos */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t("vehicles.photos") || "Vehicle Photos"}
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
            {t("vehicles.photosDescription") ||
              "Take photos of your vehicle from all angles and upload the vehicle license."}
          </Text>

          {PHOTO_FIELDS.map((pf) => (
            <View key={pf.key} style={styles.photoSection}>
              <Text style={[styles.photoLabel, { color: colors.text }]}>
                <Feather name={pf.icon as any} size={14} color={colors.gold} />{" "}
                {t(`vehicles.${pf.key}`) || pf.label}
              </Text>
              {photoUris[pf.key] ? (
                <View
                  style={[styles.photoCard, { borderColor: colors.emerald }]}
                >
                  <Image
                    source={{ uri: photoUris[pf.key]! }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.changeBtn,
                      { backgroundColor: colors.cardBg },
                    ]}
                    onPress={() => showPickerOptions(pf.key)}
                  >
                    <Feather name="refresh-cw" size={14} color={colors.gold} />
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
                    onPress={() => takePhoto(pf.key)}
                  >
                    <Feather name="camera" size={20} color={colors.gold} />
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
                    onPress={() => pickFromGallery(pf.key)}
                  >
                    <Feather name="image" size={20} color={colors.gold} />
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
                    onPress={() => pickFile(pf.key)}
                  >
                    <Feather name="file" size={20} color={colors.gold} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                    >
                      {t("kyc.chooseFile") || "File"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: submitting ? colors.border : colors.gold },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.continueText}>
                  {t("kyc.continueToProfessionalDetails") ||
                    "Continue to Professional Details"}
                </Text>
                <Feather name="arrow-right" size={20} color="#000" />
              </>
            )}
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
  headerTitle: { fontSize: 17, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingBottom: 160 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  row: { flexDirection: "row" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 4,
  },
  sectionDesc: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  photoSection: { marginBottom: 14 },
  photoLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  photoCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 120,
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: { width: "100%", height: "100%" },
  changeBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    gap: 4,
  },
  actionBtnText: { fontSize: 11, fontWeight: "500" },
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
  skipBtn: { alignItems: "center", marginTop: 12 },
  skipText: { fontSize: 14 },
});
