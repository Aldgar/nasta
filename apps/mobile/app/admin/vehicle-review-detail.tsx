import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface VehicleDetail {
  id: string;
  vehicleType: string;
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
  status: string;
  adminNotes?: string;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
}

const PHOTO_LABELS = [
  { key: "photoFrontUrl", label: "Front" },
  { key: "photoBackUrl", label: "Back" },
  { key: "photoLeftUrl", label: "Left Side" },
  { key: "photoRightUrl", label: "Right Side" },
  { key: "vehicleLicenseUrl", label: "Registration Doc" },
] as const;

export default function VehicleReviewDetailScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicle();
  }, [vehicleId]);

  const fetchVehicle = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token || !vehicleId) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/dashboard/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVehicle(data);
        setAdminNotes(data.adminNotes || "");
      }
    } catch {
      Alert.alert(t("common.error"), t("admin.failedToLoadVehicleDetails"));
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: "VERIFIED" | "REJECTED") => {
    if (status === "REJECTED" && !adminNotes.trim()) {
      Alert.alert(
        t("common.error"),
        t("admin.pleaseProvideReasonForRejection"),
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token || !vehicleId) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/admin/dashboard/vehicles/${vehicleId}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            adminNotes: adminNotes.trim() || undefined,
          }),
        },
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          status === "VERIFIED"
            ? t("admin.vehicleApproved")
            : t("admin.vehicleRejected"),
          [{ text: t("common.ok"), onPress: () => router.back() }],
        );
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          err.message || t("admin.failedToSubmitReview"),
        );
      }
    } catch {
      Alert.alert(t("common.error"), t("admin.failedToSubmitReview"));
    } finally {
      setSubmitting(false);
    }
  };

  const buildPhotoUrl = (path?: string) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const base = getApiBase();
    return `${base}/${path}`;
  };

  if (loading) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!vehicle) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.center}>
          <Text style={{ color: colors.text }}>Vehicle not found</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const vehicleTypeLabel =
    vehicle.vehicleType === "OTHER" && vehicle.otherTypeSpecification
      ? vehicle.otherTypeSpecification
      : t(`vehicles.type.${vehicle.vehicleType}`);

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Vehicle Review
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Provider info */}
          {vehicle.user && (
            <View
              style={[
                styles.section,
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Provider
              </Text>
              <Text style={[styles.detail, { color: colors.text }]}>
                {vehicle.user.firstName} {vehicle.user.lastName}
              </Text>
              <Text
                style={[
                  styles.detailSub,
                  { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                ]}
              >
                {vehicle.user.email}
                {vehicle.user.phone ? ` · ${vehicle.user.phone}` : ""}
              </Text>
            </View>
          )}

          {/* Vehicle info */}
          <View
            style={[
              styles.section,
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Vehicle Details
            </Text>
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                ]}
              >
                Type
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {vehicleTypeLabel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                ]}
              >
                Make / Model
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {vehicle.make} {vehicle.model}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                ]}
              >
                Year
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {vehicle.year}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                ]}
              >
                License Plate
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {vehicle.licensePlate}
              </Text>
            </View>
            {vehicle.color && (
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                  ]}
                >
                  Color
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {vehicle.color}
                </Text>
              </View>
            )}
            {vehicle.capacity && (
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68" },
                  ]}
                >
                  Capacity
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {vehicle.capacity}
                </Text>
              </View>
            )}
          </View>

          {/* Photos */}
          <View
            style={[
              styles.section,
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Photos & Documents
            </Text>
            <View style={styles.photoGrid}>
              {PHOTO_LABELS.map((pl) => {
                const url = buildPhotoUrl(
                  vehicle[pl.key as keyof VehicleDetail] as string | undefined,
                );
                return (
                  <View key={pl.key} style={styles.photoItem}>
                    <Text
                      style={[
                        styles.photoLabel,
                        {
                          color: isDark ? "rgba(255,250,240,0.5)" : "#8A7B68",
                        },
                      ]}
                    >
                      {pl.label}
                    </Text>
                    {url ? (
                      <Image
                        source={{ uri: url }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.photoPlaceholder,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,250,240,0.06)"
                              : "rgba(0,0,0,0.04)",
                          },
                        ]}
                      >
                        <Feather
                          name="image"
                          size={24}
                          color={
                            isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(0,0,0,0.1)"
                          }
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            color: isDark
                              ? "rgba(255,250,240,0.2)"
                              : "rgba(0,0,0,0.15)",
                            marginTop: 4,
                          }}
                        >
                          Not uploaded
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Admin notes */}
          <View
            style={[
              styles.section,
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Admin Notes
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.2)"
                    : "rgba(184,130,42,0.2)",
                  backgroundColor: isDark ? "rgba(255,250,240,0.04)" : "#fff",
                },
              ]}
              placeholder="Add notes (required for rejection)..."
              placeholderTextColor={isDark ? "rgba(255,250,240,0.3)" : "#999"}
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
              onPress={() => handleReview("VERIFIED")}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFAF0" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#FFFAF0" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
              onPress={() => handleReview("REJECTED")}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFAF0" />
              ) : (
                <>
                  <Feather name="x-circle" size={20} color="#FFFAF0" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  detail: {
    fontSize: 15,
    fontWeight: "600",
  },
  detailSub: {
    fontSize: 13,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  photoItem: {
    width: "47%",
    marginBottom: 8,
  },
  photoLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  photoImage: {
    width: "100%",
    height: 140,
    borderRadius: 8,
  },
  photoPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#FFFAF0",
    fontWeight: "700",
    fontSize: 15,
  },
});
