import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";

type VehicleType = "TRUCK" | "VAN" | "CAR" | "MOTORCYCLE" | "OTHER";

interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  otherTypeSpecification?: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  licensePlate: string;
  capacity?: string;
  photoFrontUrl?: string;
  photoBackUrl?: string;
  photoLeftUrl?: string;
  photoRightUrl?: string;
  vehicleLicenseUrl?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  adminNotes?: string;
}

const VEHICLE_TYPES: { key: VehicleType; icon: string }[] = [
  { key: "TRUCK", icon: "truck" },
  { key: "VAN", icon: "truck" },
  { key: "CAR", icon: "navigation" },
  { key: "MOTORCYCLE", icon: "wind" },
  { key: "OTHER", icon: "more-horizontal" },
];

const PHOTO_FIELDS = [
  { key: "photoFront", label: "vehicles.photoFront", dbField: "photoFrontUrl" },
  { key: "photoBack", label: "vehicles.photoBack", dbField: "photoBackUrl" },
  { key: "photoLeft", label: "vehicles.photoLeft", dbField: "photoLeftUrl" },
  { key: "photoRight", label: "vehicles.photoRight", dbField: "photoRightUrl" },
  {
    key: "vehicleLicense",
    label: "vehicles.vehicleLicense",
    dbField: "vehicleLicenseUrl",
  },
] as const;

export default function VehicleVerificationSection({
  colors,
  isDark,
  t,
}: {
  colors: any;
  isDark: boolean;
  t: (key: string) => string;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Form state
  const [vehicleType, setVehicleType] = useState<VehicleType>("TRUCK");
  const [otherSpec, setOtherSpec] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [capacity, setCapacity] = useState("");

  // Photo URIs for new vehicle being registered
  const [photoUris, setPhotoUris] = useState<Record<string, string | null>>({
    photoFront: null,
    photoBack: null,
    photoLeft: null,
    photoRight: null,
    vehicleLicense: null,
  });

  const fetchVehicles = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();
      const res = await fetch(`${base}/vehicles/my-vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const resetForm = () => {
    setVehicleType("TRUCK");
    setOtherSpec("");
    setMake("");
    setModel("");
    setYear("");
    setColor("");
    setLicensePlate("");
    setCapacity("");
    setPhotoUris({
      photoFront: null,
      photoBack: null,
      photoLeft: null,
      photoRight: null,
      vehicleLicense: null,
    });
    setShowAddForm(false);
  };

  const pickPhoto = async (fieldKey: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      let result: ImagePicker.ImagePickerResult;

      if (status === "granted") {
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        const libPerm =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libPerm.status !== "granted") {
          Alert.alert(
            t("kyc.permissionRequired"),
            t("kyc.pleaseAllowPhotosAccess"),
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setPhotoUris((prev) => ({ ...prev, [fieldKey]: result.assets[0].uri }));
      }
    } catch {
      Alert.alert(t("common.error"), t("kyc.unableToAccessCameraOrPhotos"));
    }
  };

  const handleSubmitVehicle = async () => {
    if (!make.trim() || !model.trim() || !year.trim() || !licensePlate.trim()) {
      Alert.alert(t("common.error"), t("vehicles.fillRequiredFields"));
      return;
    }
    if (vehicleType === "OTHER" && !otherSpec.trim()) {
      Alert.alert(t("common.error"), t("vehicles.specifyVehicleType"));
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();

      // Step 1: Create vehicle record
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
          t("common.error"),
          err.message || t("vehicles.failedToCreate"),
        );
        return;
      }

      const vehicle = await createRes.json();

      // Step 2: Upload photos
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
        const uploadRes = await fetch(
          `${base}/vehicles/${vehicle.id}/upload`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        if (!uploadRes.ok) {
          Alert.alert(t("common.error"), t("vehicles.photosUploadFailed"));
        }
      }

      Alert.alert(t("common.success"), t("vehicles.vehicleSubmitted"));
      resetForm();
      await fetchVehicles();
    } catch {
      Alert.alert(t("common.error"), t("vehicles.failedToCreate"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadPhotoForExisting = async (
    vehicleId: string,
    fieldKey: string,
  ) => {
    setUploadingField(`${vehicleId}-${fieldKey}`);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      let result: ImagePicker.ImagePickerResult;

      if (status === "granted") {
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;
        const base = getApiBase();
        const formData = new FormData();
        formData.append(fieldKey, {
          uri: result.assets[0].uri,
          name: `${fieldKey}.jpg`,
          type: "image/jpeg",
        } as any);

        const res = await fetch(`${base}/vehicles/${vehicleId}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          await fetchVehicles();
        } else {
          Alert.alert(t("common.error"), t("vehicles.photosUploadFailed"));
        }
      }
    } catch {
      Alert.alert(t("common.error"), t("kyc.unableToAccessCameraOrPhotos"));
    } finally {
      setUploadingField(null);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    Alert.alert(t("vehicles.deleteVehicle"), t("vehicles.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("auth_token");
            if (!token) return;
            const base = getApiBase();
            await fetch(`${base}/vehicles/${vehicleId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            await fetchVehicles();
          } catch {
            Alert.alert(t("common.error"), t("vehicles.deleteFailed"));
          }
        },
      },
    ]);
  };

  const statusColor = (status: string) => {
    if (status === "VERIFIED") return "#22c55e";
    if (status === "REJECTED") return "#ef4444";
    return isDark ? "#C9963F" : "#B8822A";
  };

  const statusLabel = (status: string) => {
    if (status === "VERIFIED") return t("vehicles.statusVerified");
    if (status === "REJECTED") return t("vehicles.statusRejected");
    return t("vehicles.statusPending");
  };

  const vehicleTypeLabel = (vt: VehicleType, otherSpec?: string) => {
    if (vt === "OTHER" && otherSpec) return otherSpec;
    return t(`vehicles.type.${vt}`);
  };

  if (loading) return null;

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={[
          s.sectionHeader,
          {
            backgroundColor: isDark
              ? "rgba(201,150,63,0.08)"
              : "rgba(184,130,42,0.06)",
            borderColor: isDark
              ? "rgba(201,150,63,0.2)"
              : "rgba(184,130,42,0.15)",
          },
        ]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={s.sectionHeaderLeft}>
          <Feather
            name="truck"
            size={20}
            color={isDark ? "#C9963F" : "#B8822A"}
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              {t("vehicles.sectionTitle")}
            </Text>
            <Text
              style={[
                s.sectionSubtitle,
                { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
              ]}
            >
              {t("vehicles.sectionSubtitle")}
            </Text>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.text}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            s.sectionBody,
            {
              backgroundColor: isDark
                ? "rgba(12, 22, 42, 0.85)"
                : "#FFFAF0",
              borderColor: isDark
                ? "rgba(201,150,63,0.12)"
                : "rgba(184,130,42,0.15)",
            },
          ]}
        >
          {/* Existing vehicles */}
          {vehicles.map((v) => (
            <View
              key={v.id}
              style={[
                s.vehicleCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.04)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.15)",
                },
              ]}
            >
              <View style={s.vehicleCardHeader}>
                <Feather
                  name="truck"
                  size={18}
                  color={statusColor(v.status)}
                />
                <Text style={[s.vehicleCardTitle, { color: colors.text }]}>
                  {vehicleTypeLabel(v.vehicleType, v.otherTypeSpecification)} -{" "}
                  {v.make} {v.model} ({v.year})
                </Text>
              </View>
              <View style={s.vehicleCardDetails}>
                <Text
                  style={[
                    s.vehicleCardDetail,
                    { color: isDark ? "rgba(255,250,240,0.6)" : "#6B6355" },
                  ]}
                >
                  {t("vehicles.plate")}: {v.licensePlate}
                  {v.color ? ` | ${t("vehicles.color")}: ${v.color}` : ""}
                  {v.capacity
                    ? ` | ${t("vehicles.capacity")}: ${v.capacity}`
                    : ""}
                </Text>
              </View>

              {/* Status badge */}
              <View style={s.statusRow}>
                <View
                  style={[
                    s.statusBadge,
                    { backgroundColor: statusColor(v.status) + "20" },
                  ]}
                >
                  <Feather
                    name={
                      v.status === "VERIFIED"
                        ? "check-circle"
                        : v.status === "REJECTED"
                          ? "x-circle"
                          : "clock"
                    }
                    size={14}
                    color={statusColor(v.status)}
                  />
                  <Text
                    style={[s.statusText, { color: statusColor(v.status) }]}
                  >
                    {statusLabel(v.status)}
                  </Text>
                </View>
                {v.status !== "VERIFIED" && (
                  <TouchableOpacity
                    onPress={() => handleDeleteVehicle(v.id)}
                    style={{ padding: 4 }}
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              {v.status === "REJECTED" && v.adminNotes && (
                <Text
                  style={[
                    s.rejectionNote,
                    { color: isDark ? "#fca5a5" : "#dc2626" },
                  ]}
                >
                  {t("vehicles.rejectionReason")}: {v.adminNotes}
                </Text>
              )}

              {/* Photo upload slots for pending/rejected vehicles */}
              {v.status !== "VERIFIED" && (
                <View style={s.photoGrid}>
                  {PHOTO_FIELDS.map((pf) => {
                    const url = v[pf.dbField as keyof Vehicle] as
                      | string
                      | undefined;
                    const isUploading =
                      uploadingField === `${v.id}-${pf.key}`;
                    return (
                      <TouchableOpacity
                        key={pf.key}
                        style={[
                          s.photoSlot,
                          {
                            borderColor: url
                              ? "#22c55e"
                              : isDark
                                ? "rgba(201,150,63,0.2)"
                                : "rgba(184,130,42,0.2)",
                          },
                        ]}
                        onPress={() =>
                          handleUploadPhotoForExisting(v.id, pf.key)
                        }
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.tint}
                          />
                        ) : url ? (
                          <Feather name="check" size={18} color="#22c55e" />
                        ) : (
                          <Feather
                            name="camera"
                            size={18}
                            color={isDark ? "#C9963F" : "#B8822A"}
                          />
                        )}
                        <Text
                          style={[
                            s.photoSlotLabel,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.6)"
                                : "#6B6355",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t(pf.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))}

          {/* Add vehicle form */}
          {showAddForm ? (
            <View
              style={[
                s.addForm,
                {
                  borderColor: isDark
                    ? "rgba(201,150,63,0.15)"
                    : "rgba(184,130,42,0.15)",
                },
              ]}
            >
              <Text style={[s.formTitle, { color: colors.text }]}>
                {t("vehicles.addVehicle")}
              </Text>

              {/* Vehicle type selector */}
              <Text style={[s.formLabel, { color: colors.text }]}>
                {t("vehicles.vehicleType")} *
              </Text>
              <TouchableOpacity
                style={[
                  s.typeSelector,
                  {
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.04)"
                      : "#fff",
                  },
                ]}
                onPress={() => setShowTypeModal(true)}
              >
                <Text style={{ color: colors.text }}>
                  {vehicleTypeLabel(vehicleType, otherSpec)}
                </Text>
                <Feather name="chevron-down" size={18} color={colors.text} />
              </TouchableOpacity>

              {vehicleType === "OTHER" && (
                <TextInput
                  style={[
                    s.input,
                    {
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(201,150,63,0.2)"
                        : "rgba(184,130,42,0.2)",
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.04)"
                        : "#fff",
                    },
                  ]}
                  placeholder={t("vehicles.specifyType")}
                  placeholderTextColor={
                    isDark ? "rgba(255,250,240,0.3)" : "#999"
                  }
                  value={otherSpec}
                  onChangeText={setOtherSpec}
                />
              )}

              {/* Fields */}
              <Text style={[s.formLabel, { color: colors.text }]}>
                {t("vehicles.make")} *
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.04)"
                      : "#fff",
                  },
                ]}
                placeholder="Toyota, Ford, Mercedes..."
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.3)" : "#999"
                }
                value={make}
                onChangeText={setMake}
              />

              <Text style={[s.formLabel, { color: colors.text }]}>
                {t("vehicles.model")} *
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.04)"
                      : "#fff",
                  },
                ]}
                placeholder="Hilux, Transit, Sprinter..."
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.3)" : "#999"
                }
                value={model}
                onChangeText={setModel}
              />

              <View style={s.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.formLabel, { color: colors.text }]}>
                    {t("vehicles.year")} *
                  </Text>
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(201,150,63,0.2)"
                          : "rgba(184,130,42,0.2)",
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.04)"
                          : "#fff",
                      },
                    ]}
                    placeholder="2020"
                    placeholderTextColor={
                      isDark ? "rgba(255,250,240,0.3)" : "#999"
                    }
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.formLabel, { color: colors.text }]}>
                    {t("vehicles.color")}
                  </Text>
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(201,150,63,0.2)"
                          : "rgba(184,130,42,0.2)",
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.04)"
                          : "#fff",
                      },
                    ]}
                    placeholder={t("vehicles.colorPlaceholder")}
                    placeholderTextColor={
                      isDark ? "rgba(255,250,240,0.3)" : "#999"
                    }
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
              </View>

              <Text style={[s.formLabel, { color: colors.text }]}>
                {t("vehicles.licensePlate")} *
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.04)"
                      : "#fff",
                  },
                ]}
                placeholder="AA-00-BB"
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.3)" : "#999"
                }
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />

              <Text style={[s.formLabel, { color: colors.text }]}>
                {t("vehicles.capacity")}
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.04)"
                      : "#fff",
                  },
                ]}
                placeholder={t("vehicles.capacityPlaceholder")}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.3)" : "#999"
                }
                value={capacity}
                onChangeText={setCapacity}
              />

              {/* Photo upload */}
              <Text
                style={[
                  s.formLabel,
                  { color: colors.text, marginTop: 12 },
                ]}
              >
                {t("vehicles.photos")}
              </Text>
              <View style={s.photoGrid}>
                {PHOTO_FIELDS.map((pf) => (
                  <TouchableOpacity
                    key={pf.key}
                    style={[
                      s.photoSlot,
                      {
                        borderColor: photoUris[pf.key]
                          ? "#22c55e"
                          : isDark
                            ? "rgba(201,150,63,0.2)"
                            : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => pickPhoto(pf.key)}
                  >
                    {photoUris[pf.key] ? (
                      <Image
                        source={{ uri: photoUris[pf.key]! }}
                        style={s.photoThumb}
                      />
                    ) : (
                      <Feather
                        name="camera"
                        size={18}
                        color={isDark ? "#C9963F" : "#B8822A"}
                      />
                    )}
                    <Text
                      style={[
                        s.photoSlotLabel,
                        {
                          color: isDark
                            ? "rgba(255,250,240,0.6)"
                            : "#6B6355",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {t(pf.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit / Cancel */}
              <View style={s.formActions}>
                <TouchableOpacity
                  style={[s.formBtn, { backgroundColor: "#ef4444" }]}
                  onPress={resetForm}
                >
                  <Text style={s.formBtnText}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.formBtn,
                    {
                      backgroundColor: isDark ? "#10B981" : "#059669",
                      opacity: submitting ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleSubmitVehicle}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFAF0" />
                  ) : (
                    <Text style={s.formBtnText}>{t("vehicles.submit")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                s.addButton,
                {
                  borderColor: isDark ? "#C9963F" : "#B8822A",
                  backgroundColor: isDark
                    ? "rgba(201,150,63,0.08)"
                    : "rgba(184,130,42,0.06)",
                },
              ]}
              onPress={() => setShowAddForm(true)}
            >
              <Feather
                name="plus-circle"
                size={20}
                color={isDark ? "#C9963F" : "#B8822A"}
              />
              <Text
                style={[
                  s.addButtonText,
                  { color: isDark ? "#C9963F" : "#B8822A" },
                ]}
              >
                {t("vehicles.addVehicle")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Vehicle Type Modal */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalContent,
              {
                backgroundColor: isDark ? "#0C162A" : "#FFFAF0",
              },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {t("vehicles.selectType")}
            </Text>
            {VEHICLE_TYPES.map((vt) => (
              <TouchableOpacity
                key={vt.key}
                style={[
                  s.modalOption,
                  vehicleType === vt.key && {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.15)"
                      : "rgba(184,130,42,0.1)",
                  },
                ]}
                onPress={() => {
                  setVehicleType(vt.key);
                  setShowTypeModal(false);
                }}
              >
                <Feather
                  name={vt.icon as any}
                  size={20}
                  color={colors.text}
                />
                <Text style={[s.modalOptionText, { color: colors.text }]}>
                  {t(`vehicles.type.${vt.key}`)}
                </Text>
                {vehicleType === vt.key && (
                  <Feather name="check" size={18} color={colors.tint} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.modalClose}
              onPress={() => setShowTypeModal(false)}
            >
              <Text style={{ color: colors.tint, fontWeight: "700" }}>
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionBody: {
    padding: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  vehicleCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  vehicleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  vehicleCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  vehicleCardDetails: {
    marginBottom: 8,
  },
  vehicleCardDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rejectionNote: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  photoSlot: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  photoSlotLabel: {
    fontSize: 9,
    textAlign: "center",
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  addForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  typeSelector: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  formActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  formBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  formBtnText: {
    color: "#FFFAF0",
    fontWeight: "700",
    fontSize: 14,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 15,
    flex: 1,
  },
  modalClose: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
  },
});
