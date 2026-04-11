import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import { useFocusEffect } from "expo-router";

interface Admin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  adminCapabilities: string[];
  createdAt: string;
}

const ADMIN_CAPABILITIES = [
  "SUPER_ADMIN",
  "BACKGROUND_CHECK_REVIEWER",
  "DELETION_REQUEST_REVIEWER",
  "SUPPORT",
];

export default function ManageAdminsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    adminCapabilities: [] as string[],
  });

  // Check if current user is SUPER_ADMIN by fetching admin profile
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          setIsSuperAdmin(false);
          return;
        }

        const base = getApiBase();
        // Fetch admin profile to get capabilities
        const res = await fetch(`${base}/auth/admin/whoami`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const admin = data.admin || data;
          const capabilities = admin.adminCapabilities || [];
          const isSuper =
            Array.isArray(capabilities) && capabilities.includes("SUPER_ADMIN");
          console.log("SUPER_ADMIN check:", { capabilities, isSuper, admin });
          setIsSuperAdmin(isSuper);
        } else {
          console.error("Failed to fetch admin profile:", res.status);
          setIsSuperAdmin(false);
        }
      } catch (e) {
        console.error("Error checking SUPER_ADMIN:", e);
        setIsSuperAdmin(false);
      }
    };
    checkSuperAdmin();
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/auth/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      } else {
        const errorData = await res
          .json()
          .catch(() => ({ message: t("admin.failedToLoadAdmins") }));
        Alert.alert(
          t("common.error"),
          errorData.message || t("admin.failedToLoadAdmins"),
        );
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchAdmins();
    }, [fetchAdmins]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdmins();
  };

  const handleCreateAdmin = async () => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.firstName ||
      !formData.lastName
    ) {
      Alert.alert(t("common.error"), t("common.fillAllRequiredFields"));
      return;
    }

    if (formData.adminCapabilities.length === 0) {
      Alert.alert(t("common.error"), t("admin.selectAtLeastOneCapability"));
      return;
    }

    // Remove SUPER_ADMIN from capabilities if user is not SUPER_ADMIN
    let capabilitiesToSubmit = formData.adminCapabilities;
    if (!isSuperAdmin) {
      capabilitiesToSubmit = formData.adminCapabilities.filter(
        (cap) => cap !== "SUPER_ADMIN",
      );
      if (capabilitiesToSubmit.length === 0) {
        Alert.alert(t("common.error"), t("admin.selectAtLeastOneCapability"));
        return;
      }
    }

    try {
      setIsCreating(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/auth/admin/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          adminCapabilities: capabilitiesToSubmit,
        }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.adminCreatedSuccessfully"));
        setShowAddModal(false);
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          adminCapabilities: [],
        });
        fetchAdmins();
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToCreateAdmin"),
        );
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setIsCreating(false);
    }
  };

  const toggleCapability = (capability: string) => {
    setFormData((prev) => ({
      ...prev,
      adminCapabilities: prev.adminCapabilities.includes(capability)
        ? prev.adminCapabilities.filter((c) => c !== capability)
        : [...prev.adminCapabilities, capability],
    }));
  };

  const handleDeleteAdmin = async (
    adminId: string,
    adminName: string,
    targetAdminCapabilities: string[],
  ) => {
    console.log("handleDeleteAdmin called:", {
      adminId,
      adminName,
      isSuperAdmin,
      targetAdminCapabilities,
    });

    // Check if target admin is SUPER_ADMIN and current user is not SUPER_ADMIN
    const targetIsSuperAdmin =
      Array.isArray(targetAdminCapabilities) &&
      targetAdminCapabilities.includes("SUPER_ADMIN");
    if (targetIsSuperAdmin && !isSuperAdmin) {
      Alert.alert(t("admin.cannotDelete"), t("admin.cannotDeleteSuperAdmin"), [
        { text: t("common.ok") },
      ]);
      return;
    }

    Alert.alert(
      t("admin.deleteAdmin"),
      t("admin.deleteAdminConfirm", { adminName }),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAdminId(adminId);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) {
                Alert.alert(t("common.error"), t("auth.tokenNotFound"));
                setDeletingAdminId(null);
                return;
              }

              const base = getApiBase();
              console.log(
                "Deleting admin:",
                `${base}/auth/admin/${adminId}/delete`,
              );

              const res = await fetch(`${base}/auth/admin/${adminId}/delete`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              });

              if (res.ok) {
                const result = await res.json();
                console.log("Delete successful:", result);
                Alert.alert(
                  t("common.success"),
                  t("admin.adminDeletedSuccessfully"),
                );
                fetchAdmins();
              } else {
                const error = await res
                  .json()
                  .catch(() => ({ message: "Unknown error" }));
                console.error("Delete failed:", error);
                Alert.alert(
                  t("common.error"),
                  error.message || t("admin.failedToDeleteAdmin"),
                );
              }
            } catch (error) {
              console.error("Error deleting admin:", error);
              Alert.alert(t("common.error"), t("common.failedToConnect"));
            } finally {
              setDeletingAdminId(null);
            }
          },
        },
      ],
    );
  };

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
            Manage Admins
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
            ]}
            onPress={() => {
              // Clear form and remove SUPER_ADMIN if user is not SUPER_ADMIN
              setFormData({
                email: "",
                password: "",
                firstName: "",
                lastName: "",
                adminCapabilities: [],
              });
              setShowAddModal(true);
            }}
          >
            <Feather name="plus" size={18} color="#FFFAF0" />
            <Text style={[styles.addButtonText, { color: "#FFFAF0" }]}>
              Add Admin
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {admins.length === 0 ? (
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No admins found
                </Text>
              </View>
            ) : (
              admins.map((admin) => (
                <View
                  key={admin.id}
                  style={[
                    styles.adminCard,
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
                  <View style={styles.adminCardHeader}>
                    <View style={styles.adminInfo}>
                      <Text style={[styles.adminName, { color: colors.text }]}>
                        {admin.firstName} {admin.lastName}
                      </Text>
                      <Text
                        style={[
                          styles.adminEmail,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        {admin.email}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: admin.isActive
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: admin.isActive ? "#22c55e" : "#ef4444" },
                        ]}
                      >
                        {admin.isActive ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.capabilitiesContainer}>
                    <Text
                      style={[
                        styles.capabilitiesLabel,
                        { color: isDark ? "#B8A88A" : "#8A7B68" },
                      ]}
                    >
                      Capabilities:
                    </Text>
                    <View style={styles.capabilitiesList}>
                      {admin.adminCapabilities.map((cap) => (
                        <View
                          key={cap}
                          style={[
                            styles.capabilityBadge,
                            { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                          ]}
                        >
                          <Text style={styles.capabilityText}>{cap}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Delete Button - Visible for all admins, but SUPER_ADMIN cannot be deleted by non-SUPER_ADMIN */}
                  <View style={{ marginTop: 16 }}>
                    {!isSuperAdmin &&
                    admin.adminCapabilities.includes("SUPER_ADMIN") ? (
                      <View
                        style={[
                          styles.deleteButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(100, 100, 100, 0.2)"
                              : "rgba(184, 130, 42, 0.06)",
                            borderColor: isDark
                              ? "rgba(255, 250, 240, 0.15)"
                              : "rgba(184, 130, 42, 0.2)",
                          },
                        ]}
                      >
                        <Feather
                          name="lock"
                          size={18}
                          color={isDark ? "#9A8E7A" : "#8A7B68"}
                        />
                        <Text
                          style={[
                            styles.deleteButtonText,
                            { color: isDark ? "#9A8E7A" : "#8A7B68" },
                          ]}
                        >
                          Cannot Delete SUPER_ADMIN
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.deleteButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(239, 68, 68, 0.3)"
                              : "rgba(239, 68, 68, 0.15)",
                            borderColor: isDark
                              ? "rgba(239, 68, 68, 0.6)"
                              : "rgba(239, 68, 68, 0.5)",
                          },
                        ]}
                        onPress={() => {
                          console.log(
                            "Delete button pressed for admin:",
                            admin.id,
                          );
                          handleDeleteAdmin(
                            admin.id,
                            `${admin.firstName} ${admin.lastName}`,
                            admin.adminCapabilities,
                          );
                        }}
                        disabled={deletingAdminId === admin.id}
                        activeOpacity={0.7}
                      >
                        {deletingAdminId === admin.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <>
                            <Feather name="trash-2" size={18} color="#ef4444" />
                            <Text
                              style={[
                                styles.deleteButtonText,
                                { color: "#ef4444" },
                              ]}
                            >
                              Delete Admin
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Add Admin Modal */}
        <Modal
          visible={showAddModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)",
              },
            ]}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "#FFFAF0",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Add New Admin
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddModal(false);
                    setFormData({
                      email: "",
                      password: "",
                      firstName: "",
                      lastName: "",
                      adminCapabilities: [],
                    });
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 20 }}
                nestedScrollEnabled={true}
              >
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  First Name *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#f9fafb",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : "#E8D8B8",
                    },
                  ]}
                  placeholder={t("admin.firstNamePlaceholder")}
                  placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                  value={formData.firstName}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, firstName: text }))
                  }
                />

                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Last Name *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#f9fafb",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : "#E8D8B8",
                    },
                  ]}
                  placeholder={t("admin.lastNamePlaceholder")}
                  placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                  value={formData.lastName}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, lastName: text }))
                  }
                />

                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Email *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#f9fafb",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : "#E8D8B8",
                    },
                  ]}
                  placeholder="admin@example.com"
                  placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, email: text }))
                  }
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Password *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#f9fafb",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : "#E8D8B8",
                    },
                  ]}
                  placeholder={t("admin.passwordMinLength")}
                  placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, password: text }))
                  }
                  secureTextEntry
                />

                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Admin Capabilities *
                </Text>
                <View style={styles.capabilitiesGrid}>
                  {ADMIN_CAPABILITIES.filter((cap) => {
                    // Hide SUPER_ADMIN option if current user is not SUPER_ADMIN
                    if (cap === "SUPER_ADMIN" && !isSuperAdmin) {
                      return false;
                    }
                    return true;
                  }).map((cap) => (
                    <TouchableOpacity
                      key={cap}
                      style={[
                        styles.capabilityOption,
                        formData.adminCapabilities.includes(cap) && {
                          backgroundColor: isDark ? "#A78BFA" : "#7C3AED",
                        },
                        !formData.adminCapabilities.includes(cap) && {
                          backgroundColor: isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.06)",
                        },
                      ]}
                      onPress={() => toggleCapability(cap)}
                    >
                      <Text
                        style={[
                          styles.capabilityOptionText,
                          {
                            color: formData.adminCapabilities.includes(cap)
                              ? "#FFFAF0"
                              : colors.text,
                          },
                        ]}
                      >
                        {cap.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#F5ECD8",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.25)"
                        : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setShowAddModal(false);
                    setFormData({
                      email: "",
                      password: "",
                      firstName: "",
                      lastName: "",
                      adminCapabilities: [],
                    });
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonSave,
                    {
                      backgroundColor: isDark ? "#A78BFA" : "#7C3AED",
                      borderColor: isDark ? "#A78BFA" : "#7C3AED",
                    },
                  ]}
                  onPress={handleCreateAdmin}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text
                      style={[styles.modalButtonText, { color: "#FFFAF0" }]}
                    >
                      Create Admin
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  placeholder: { width: 36 },
  headerActions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  list: { flex: 1, padding: 16 },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  adminCard: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  adminCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  adminEmail: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  capabilitiesContainer: {
    marginTop: 8,
  },
  capabilitiesLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  capabilitiesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  capabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  capabilityText: {
    color: "#FFFAF0",
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "android" ? 80 : 40,
    maxHeight: "85%",
    minHeight: "70%",
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalForm: {
    flex: 1,
    marginBottom: 20,
    minHeight: 300,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  capabilitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  capabilityOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,250,240,0.15)",
  },
  capabilityOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: "center",
    borderWidth: 1,
  },
  modalButtonCancel: {},
  modalButtonSave: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 10,
    minHeight: 44,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
