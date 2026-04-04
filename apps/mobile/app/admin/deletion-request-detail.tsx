import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface DeletionRequest {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  user: {
    id: string;
    publicId?: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
}

export default function DeletionRequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/admin/users/deletion-requests?scope=all`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        const found = items.find((r: DeletionRequest) => r.id === id);
        if (found) {
          setRequest(found);
          setNotes(found.adminNotes || "");
        }
      }
    } catch (err) {
      console.error("Error fetching deletion request:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/admin/users/deletion-requests/${id}/assign`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.requestAssignedToYou"));
        fetchRequest();
      } else {
        const err = await res.json();
        Alert.alert(
          t("common.error"),
          err.message || t("admin.failedToAssign"),
        );
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.networkError"));
    }
  };

  const handleReview = (decision: "approve" | "deny") => {
    const title =
      decision === "approve"
        ? t("admin.approveDeletion")
        : t("admin.denyDeletion");
    const message =
      decision === "approve"
        ? t("admin.approveDeletionConfirm")
        : t("admin.denyDeletionConfirm");

    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: decision === "approve" ? t("admin.approve") : t("admin.deny"),
        style: decision === "approve" ? "destructive" : "default",
        onPress: () => submitReview(decision),
      },
    ]);
  };

  const submitReview = async (decision: "approve" | "deny") => {
    try {
      setSubmitting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/admin/users/deletion-requests/${id}/${decision}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: notes.trim() || undefined }),
        },
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          decision === "approve"
            ? t("admin.deletionRequestApproved")
            : t("admin.deletionRequestDenied"),
          [{ text: t("common.ok"), onPress: () => router.back() }],
        );
      } else {
        const err = await res.json();
        Alert.alert(
          t("common.error"),
          err.message || t("admin.failedToReviewRequest"),
        );
      }
    } catch {
      Alert.alert(t("common.error"), t("errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!request) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name="chevron-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              Not Found
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Text style={{ color: colors.text }}>Request not found</Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const isPending = request.status === "PENDING";

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Review Request
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* User Info Section */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.90)"
                  : "rgba(255,250,240,0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.25)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#C9963F" : "#96782A" },
              ]}
            >
              USER INFORMATION
            </Text>
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.avatarLarge,
                  {
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.2)"
                      : "rgba(220,38,38,0.1)",
                  },
                ]}
              >
                <Feather
                  name="user"
                  size={28}
                  color={isDark ? "#ef4444" : "#dc2626"}
                />
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {request.user.firstName} {request.user.lastName}
                </Text>
                <Text
                  style={[
                    styles.userEmail,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {request.user.email}
                </Text>
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(167,139,250,0.2)"
                          : "rgba(124,58,237,0.1)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        { color: isDark ? "#A78BFA" : "#7C3AED" },
                      ]}
                    >
                      {request.user.role.replace("_", " ")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor: request.user.isActive
                          ? isDark
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(22,163,74,0.1)"
                          : isDark
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(220,38,38,0.1)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusIndicatorText,
                        {
                          color: request.user.isActive
                            ? isDark
                              ? "#22c55e"
                              : "#16a34a"
                            : isDark
                              ? "#ef4444"
                              : "#dc2626",
                        },
                      ]}
                    >
                      {request.user.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Request Details Section */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.90)"
                  : "rgba(255,250,240,0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.25)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? "#C9963F" : "#96782A" },
              ]}
            >
              REQUEST DETAILS
            </Text>

            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
                ]}
              >
                Status
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      request.status === "PENDING"
                        ? isDark
                          ? "rgba(245,158,11,0.2)"
                          : "rgba(217,119,6,0.1)"
                        : request.status === "APPROVED"
                          ? isDark
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(22,163,74,0.1)"
                          : isDark
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(220,38,38,0.1)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        request.status === "PENDING"
                          ? isDark
                            ? "#f59e0b"
                            : "#d97706"
                          : request.status === "APPROVED"
                            ? isDark
                              ? "#22c55e"
                              : "#16a34a"
                            : isDark
                              ? "#ef4444"
                              : "#dc2626",
                    },
                  ]}
                >
                  {request.status}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text
                style={[
                  styles.detailLabel,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
                ]}
              >
                Submitted
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {formatDate(request.createdAt)}
              </Text>
            </View>

            {request.assignedTo && (
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  Assigned
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {request.assignedAt ? formatDate(request.assignedAt) : "Yes"}
                </Text>
              </View>
            )}

            {request.reason && (
              <View style={styles.reasonSection}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  Reason
                </Text>
                <View
                  style={[
                    styles.reasonBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.05)"
                        : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      { color: isDark ? "#B8A88A" : "#6B5D4A" },
                    ]}
                  >
                    {request.reason}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Admin Review Section - Only for pending */}
          {isPending && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "rgba(255,250,240,0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.25)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#C9963F" : "#96782A" },
                ]}
              >
                REVIEW
              </Text>

              {!request.assignedTo && (
                <TouchableOpacity
                  style={[
                    styles.assignButton,
                    {
                      backgroundColor: isDark ? "#C9963F" : "#96782A",
                    },
                  ]}
                  onPress={handleAssign}
                >
                  <Feather name="user-plus" size={16} color="#FFFAF0" />
                  <Text style={styles.assignButtonText}>Assign to Me</Text>
                </TouchableOpacity>
              )}

              <Text
                style={[
                  styles.notesLabel,
                  { color: isDark ? "#B8A88A" : "#6B5D4A" },
                ]}
              >
                Admin Notes (optional)
              </Text>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.05)"
                      : "rgba(0,0,0,0.03)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder="Add notes about your decision..."
                placeholderTextColor={isDark ? "#9A8E7A" : "#8A7B68"}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.denyButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(220,38,38,0.1)",
                      borderColor: isDark ? "#ef4444" : "#dc2626",
                    },
                  ]}
                  onPress={() => handleReview("deny")}
                  disabled={submitting}
                >
                  <Feather
                    name="x-circle"
                    size={18}
                    color={isDark ? "#ef4444" : "#dc2626"}
                  />
                  <Text
                    style={[
                      styles.denyButtonText,
                      { color: isDark ? "#ef4444" : "#dc2626" },
                    ]}
                  >
                    Deny
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.approveButton,
                    { backgroundColor: isDark ? "#ef4444" : "#dc2626" },
                  ]}
                  onPress={() => handleReview("approve")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFAF0" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={18} color="#FFFAF0" />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Already reviewed info */}
          {!isPending && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "rgba(255,250,240,0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.25)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#C9963F" : "#96782A" },
                ]}
              >
                REVIEW RESULT
              </Text>
              {request.reviewedAt && (
                <View style={styles.detailRow}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    Reviewed
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(request.reviewedAt)}
                  </Text>
                </View>
              )}
              {request.adminNotes && (
                <View style={styles.reasonSection}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    Admin Notes
                  </Text>
                  <View
                    style={[
                      styles.reasonBox,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.05)"
                          : "rgba(0,0,0,0.03)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        { color: isDark ? "#B8A88A" : "#6B5D4A" },
                      ]}
                    >
                      {request.adminNotes}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusIndicatorText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.05)",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reasonSection: {
    marginTop: 12,
  },
  reasonBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 22,
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 4,
    gap: 8,
    marginBottom: 16,
  },
  assignButtonText: {
    color: "#FFFAF0",
    fontSize: 14,
    fontWeight: "700",
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  denyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
  },
  denyButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 4,
    gap: 8,
  },
  approveButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
});
