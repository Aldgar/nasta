import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface UserDetails {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    role: string;
    bio?: string;
    location?: string;
    city?: string;
    country?: string;
    isActive: boolean;
    isVerified: boolean;
    emailVerifiedAt?: string;
    phoneVerifiedAt?: string;
    isIdVerified: boolean;
    idVerificationStatus: string;
    isBackgroundVerified: boolean;
    backgroundCheckStatus: string;
    createdAt: string;
  };
  stats: {
    rating: number;
    ratingCount: number;
    activeBookings: number;
    totalJobs: number;
    reportedIssues: number;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    reviewee: { id: string; firstName: string; lastName: string };
    reviewer: { id: string; firstName: string; lastName: string };
    createdAt: string;
  }>;
  bookings: Array<{
    id: string;
    status: string;
    job: { id: string; title: string };
    jobSeeker?: { id: string; firstName: string; lastName: string };
    employer?: { id: string; firstName: string; lastName: string };
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  reportedIssues: Array<{
    id: string;
    ticketNumber?: string;
    subject: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  accountStats?: {
    totalServiceProviders: number;
    totalThisMonth: number;
  };
}

export default function UserDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.id as string;
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userActions, setUserActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New action modals
  const [showLegalActionModal, setShowLegalActionModal] = useState(false);
  const [legalActionType, setLegalActionType] = useState("");
  const [legalActionReason, setLegalActionReason] = useState("");
  const [submittingLegalAction, setSubmittingLegalAction] = useState(false);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningType, setWarningType] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [submittingWarning, setSubmittingWarning] = useState(false);

  const [showActionFormModal, setShowActionFormModal] = useState(false);
  const [actionFormType, setActionFormType] = useState("");
  const [actionFormDetails, setActionFormDetails] = useState("");
  const [submittingActionForm, setSubmittingActionForm] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
      fetchUserActions();
    }
    checkSuperAdmin();
  }, [userId]);

  const checkSuperAdmin = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setIsSuperAdmin(false);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/auth/admin/whoami`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const admin = data.admin || data.user || data;
        const capabilities = admin.adminCapabilities || [];
        const isSuper =
          Array.isArray(capabilities) && capabilities.includes("SUPER_ADMIN");
        setIsSuperAdmin(isSuper);
      } else {
        setIsSuperAdmin(false);
      }
    } catch (error) {
      console.error("Error checking SUPER_ADMIN:", error);
      setIsSuperAdmin(false);
    }
  };

  const fetchUserActions = async () => {
    try {
      setLoadingActions(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}/actions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUserActions(data.actions || []);
      }
    } catch (error) {
      console.error("Error fetching user actions:", error);
    } finally {
      setLoadingActions(false);
    }
  };

  const handleRevokeAction = async (actionId: string) => {
    Alert.alert(t("admin.revokeAction"), t("admin.areYouSureRevokeAction"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("auth_token");
            if (!token) return;

            const base = getApiBase();
            const res = await fetch(
              `${base}/admin/users/${userId}/actions/${actionId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (res.ok) {
              Alert.alert(
                t("common.success"),
                t("admin.actionRevokedSuccessfully"),
              );
              fetchUserActions();
              fetchUserDetails(); // Refresh to update user status if needed
            } else {
              const error = await res.json();
              Alert.alert(
                t("common.error"),
                error.message || t("admin.failedToRevokeAction"),
              );
            }
          } catch (error) {
            console.error("Error revoking action:", error);
            Alert.alert(t("common.error"), t("common.failedToConnect"));
          }
        },
      },
    ]);
  };

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUserDetails(data);
      } else {
        Alert.alert(t("common.error"), t("admin.failedToLoadUserDetails"));
        router.back();
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isSuperAdmin) {
      return;
    }

    try {
      setDeleting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.userDeletedSuccessfully"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        const error = await res.json();
        if (res.status === 401 || res.status === 403) {
          Alert.alert(
            t("admin.permissionDenied"),
            t("admin.onlySuperAdminsCanDeleteUsers"),
          );
        } else {
          Alert.alert(
            t("common.error"),
            error.message || t("admin.failedToDeleteUser"),
          );
        }
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeletePress = () => {
    if (!isSuperAdmin) {
      Alert.alert(
        t("admin.permissionRequired"),
        t("admin.onlySuperAdminsCanDeleteUsers"),
        [{ text: t("common.ok") }],
      );
      return;
    }
    setShowDeleteModal(true);
  };

  const handleRequestInfo = async () => {
    if (!requestInfoText.trim()) {
      Alert.alert(t("common.required"), t("admin.enterInformationNeeded"));
      return;
    }

    try {
      setSendingRequest(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}/request-info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request: requestInfoText.trim(),
        }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.informationRequestSent"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowRequestInfoModal(false);
              setRequestInfoText("");
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToSendRequest"),
        );
      }
    } catch (error) {
      console.error("Error sending request:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setSendingRequest(false);
    }
  };

  const handleLegalAction = async () => {
    if (!legalActionType.trim() || !legalActionReason.trim()) {
      Alert.alert(t("common.required"), t("admin.selectActionTypeAndReason"));
      return;
    }

    try {
      setSubmittingLegalAction(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}/legal-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actionType: legalActionType,
          reason: legalActionReason,
        }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.legalActionRecorded"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowLegalActionModal(false);
              setLegalActionType("");
              setLegalActionReason("");
              fetchUserActions();
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToRecordLegalAction"),
        );
      }
    } catch (error) {
      console.error("Error submitting legal action:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setSubmittingLegalAction(false);
    }
  };

  const handleWarning = async () => {
    if (!warningType.trim() || !warningMessage.trim()) {
      Alert.alert(t("common.required"), t("admin.selectWarningTypeAndMessage"));
      return;
    }

    try {
      setSubmittingWarning(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}/warnings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warningType: warningType,
          message: warningMessage,
        }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.warningIssuedToUser"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowWarningModal(false);
              setWarningType("");
              setWarningMessage("");
              fetchUserActions();
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToIssueWarning"),
        );
      }
    } catch (error) {
      console.error("Error issuing warning:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setSubmittingWarning(false);
    }
  };

  const handleActionForm = async () => {
    if (!actionFormType.trim() || !actionFormDetails.trim()) {
      Alert.alert(t("common.required"), t("admin.selectActionTypeAndDetails"));
      return;
    }

    try {
      setSubmittingActionForm(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/admin/users/${userId}/action-form`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actionType: actionFormType,
          details: actionFormDetails,
        }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.actionFormSubmitted"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowActionFormModal(false);
              setActionFormType("");
              setActionFormDetails("");
              fetchUserActions();
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToSubmitActionForm"),
        );
      }
    } catch (error) {
      console.error("Error submitting action form:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setSubmittingActionForm(false);
    }
  };

  const handleContactChat = () => {
    if (!userDetails?.user) return;
    const userName = `${userDetails.user.firstName} ${userDetails.user.lastName}`;
    router.push(
      `/chat/room?userId=${userDetails.user.id}&userName=${userName}` as never,
    );
  };

  const handleManageVerifications = () => {
    // Navigate to KYC reviews - the page will show all verifications
    // We can filter by userId if the backend supports it, but for now just navigate to the list
    router.push("/admin/kyc-reviews" as never);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!userDetails) {
    return null;
  }

  const { user, stats, reviews, bookings, jobs, reportedIssues, accountStats } =
    userDetails;
  const userName = `${user.firstName} ${user.lastName}`;
  const userLocation =
    [user.city, user.country].filter(Boolean).join(", ") ||
    t("admin.noLocation");

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.06)",
              },
            ]}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("admin.userDetails")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* User Info Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.80)"
                  : "rgba(255, 250, 240, 0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <View style={styles.userHeader}>
              <View
                style={[
                  styles.avatarContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.2)"
                      : "rgba(201, 150, 63, 0.1)",
                  },
                ]}
              >
                {user.avatar ? (
                  <Text
                    style={[
                      styles.avatarText,
                      { color: isDark ? "#A78BFA" : "#7C3AED" },
                    ]}
                  >
                    {user.firstName[0]}
                    {user.lastName[0]}
                  </Text>
                ) : (
                  <Feather
                    name="user"
                    size={32}
                    color={isDark ? "#A78BFA" : "#7C3AED"}
                  />
                )}
              </View>
              <View style={styles.userHeaderText}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {userName}
                </Text>
                <Text
                  style={[
                    styles.userRole,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {user.role === "JOB_SEEKER"
                    ? t("common.serviceProvider")
                    : t("common.employer")}
                </Text>
              </View>
            </View>

            <View style={styles.userInfo}>
              <View style={styles.infoRow}>
                <Feather
                  name="mail"
                  size={16}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {user.email}
                </Text>
              </View>
              {user.phone && (
                <View style={styles.infoRow}>
                  <Feather
                    name="phone"
                    size={16}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {user.phone}
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Feather
                  name="map-pin"
                  size={16}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {userLocation}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Feather
                  name="calendar"
                  size={16}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  {t("admin.joined")} {formatDate(user.createdAt)}
                </Text>
              </View>
              {user.bio && (
                <View style={styles.bioContainer}>
                  <Text
                    style={[
                      styles.bioLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.bio")}:
                  </Text>
                  <Text style={[styles.bioText, { color: colors.text }]}>
                    {user.bio}
                  </Text>
                </View>
              )}
            </View>

            {/* Verification Status */}
            <View style={styles.verificationSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("admin.verificationStatus")}
              </Text>
              <View style={styles.verificationGrid}>
                <View style={styles.verificationItem}>
                  <Text
                    style={[
                      styles.verificationLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.email")}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: user.emailVerifiedAt
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: user.emailVerifiedAt ? "#22c55e" : "#ef4444",
                        },
                      ]}
                    >
                      {user.emailVerifiedAt
                        ? t("admin.verified")
                        : t("admin.notVerified")}
                    </Text>
                  </View>
                </View>
                <View style={styles.verificationItem}>
                  <Text
                    style={[
                      styles.verificationLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.phone")}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: user.phoneVerifiedAt
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: user.phoneVerifiedAt ? "#22c55e" : "#ef4444",
                        },
                      ]}
                    >
                      {user.phoneVerifiedAt ? "Verified" : "Not Verified"}
                    </Text>
                  </View>
                </View>
                {/* ID and Background verification only for service providers (JOB_SEEKER), not for employers */}
                {user.role === "JOB_SEEKER" && (
                  <>
                    <View style={styles.verificationItem}>
                      <Text
                        style={[
                          styles.verificationLabel,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        {t("admin.id")}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: user.isIdVerified
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: user.isIdVerified ? "#22c55e" : "#ef4444",
                            },
                          ]}
                        >
                          {user.isIdVerified
                            ? "Verified"
                            : user.idVerificationStatus}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.verificationItem}>
                      <Text
                        style={[
                          styles.verificationLabel,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        {t("admin.background")}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: user.isBackgroundVerified
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: user.isBackgroundVerified
                                ? "#22c55e"
                                : "#ef4444",
                            },
                          ]}
                        >
                          {user.isBackgroundVerified
                            ? "Verified"
                            : user.backgroundCheckStatus}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Stats Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.80)"
                  : "rgba(255, 250, 240, 0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("admin.statistics")}
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stats.rating.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {t("admin.rating")} ({stats.ratingCount})
                </Text>
              </View>
              {user.role === "JOB_SEEKER" ? (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {stats.activeBookings}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.activeServices")}
                  </Text>
                </View>
              ) : (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {stats.totalJobs}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.jobPosts")}
                  </Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stats.reportedIssues}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {t("admin.reportedIssues")}
                </Text>
              </View>
            </View>
          </View>

          {/* Account Stats (for Service Providers) */}
          {accountStats && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("admin.platformGrowth")}
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {accountStats.totalServiceProviders}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.totalProviders")}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {accountStats.totalThisMonth}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("admin.thisMonth")}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.80)"
                  : "rgba(255, 250, 240, 0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("admin.actions")}
            </Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: isDark ? "#C9963F" : "#B8822A" },
                ]}
                onPress={handleContactChat}
              >
                <Feather name="message-circle" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.contactViaChat")}
                </Text>
              </TouchableOpacity>
              {/* Manage Verifications only for service providers (JOB_SEEKER), not for employers */}
              {user.role === "JOB_SEEKER" && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                  ]}
                  onPress={handleManageVerifications}
                >
                  <Feather name="shield" size={20} color="#FFFAF0" />
                  <Text style={styles.actionButtonText}>
                    {t("admin.manageVerifications")}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.8)"
                      : "rgba(201, 150, 63, 0.8)",
                  },
                ]}
                onPress={() => setShowRequestInfoModal(true)}
              >
                <Feather name="info" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.requestInfo")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#E8B86D" }]}
                onPress={() => setShowLegalActionModal(true)}
              >
                <Feather name="briefcase" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.legalAction")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#f59e0b" }]}
                onPress={() => setShowWarningModal(true)}
              >
                <Feather name="alert-triangle" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.warnings")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#10b981" }]}
                onPress={() => setShowActionFormModal(true)}
              >
                <Feather name="file-text" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.actionForm")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isSuperAdmin
                      ? "#ef4444"
                      : isDark
                        ? "#6B6355"
                        : "#9A8E7A",
                    opacity: isSuperAdmin ? 1 : 0.6,
                  },
                ]}
                onPress={handleDeletePress}
              >
                <Feather name="trash-2" size={20} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.deleteUser")}
                </Text>
              </TouchableOpacity>
              {!isSuperAdmin && (
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(245, 158, 11, 0.1)",
                      borderColor: isDark
                        ? "rgba(245, 158, 11, 0.3)"
                        : "rgba(245, 158, 11, 0.2)",
                    },
                  ]}
                >
                  <Feather name="info" size={16} color="#f59e0b" />
                  <Text
                    style={[
                      styles.infoBannerText,
                      { color: isDark ? "#fbbf24" : "#d97706" },
                    ]}
                  >
                    Only Super Admins can delete users. Contact a Super Admin
                    for this action.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action History Section */}
          {userActions.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.sectionIconContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                  >
                    <Feather name="clock" size={18} color={colors.tint} />
                  </View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text, marginLeft: 12 },
                    ]}
                  >
                    Action History
                  </Text>
                </View>
                <View
                  style={[
                    styles.actionCountBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(201, 150, 63, 0.25)"
                        : "rgba(201, 150, 63, 0.15)",
                      borderColor: isDark
                        ? "rgba(201, 150, 63, 0.4)"
                        : "rgba(201, 150, 63, 0.3)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.actionCountText, { color: colors.tint }]}
                  >
                    {userActions.length}
                  </Text>
                </View>
              </View>
              {loadingActions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.tint} />
                </View>
              ) : (
                <View style={styles.actionHistoryList}>
                  {userActions.map((action: any, index: number) => {
                    const getActionConfig = () => {
                      switch (action.actionType) {
                        case "LEGAL_ACTION":
                          return {
                            icon: "briefcase",
                            color: "#E8B86D",
                            lightColor: "#E8B86D",
                            bgColor: isDark
                              ? "rgba(232, 184, 109, 0.12)"
                              : "rgba(232, 184, 109, 0.06)",
                            borderColor: "#E8B86D",
                            label: t("admin.legalActionLabel", {
                              actionType:
                                action.actionData?.actionType ||
                                t("admin.unknownAction"),
                            }),
                            details:
                              action.actionData?.reason ||
                              t("admin.noReasonProvided"),
                          };
                        case "WARNING":
                          return {
                            icon: "alert-triangle",
                            color: "#f59e0b",
                            lightColor: "#fbbf24",
                            bgColor: isDark
                              ? "rgba(245, 158, 11, 0.12)"
                              : "rgba(245, 158, 11, 0.06)",
                            borderColor: "#f59e0b",
                            label: t("admin.warningLabel", {
                              warningType:
                                action.actionData?.warningType ||
                                t("admin.unknownAction"),
                            }),
                            details:
                              action.actionData?.message ||
                              t("admin.noMessageProvided"),
                          };
                        case "ACTION_FORM":
                          return {
                            icon: "file-text",
                            color: "#10b981",
                            lightColor: "#34d399",
                            bgColor: isDark
                              ? "rgba(16, 185, 129, 0.12)"
                              : "rgba(16, 185, 129, 0.06)",
                            borderColor: "#10b981",
                            label: t("admin.actionFormLabel", {
                              actionType:
                                action.actionData?.actionType ||
                                t("admin.unknownAction"),
                            }),
                            details:
                              action.actionData?.details ||
                              t("admin.noDetailsProvided"),
                          };
                        case "REQUEST_INFO":
                          return {
                            icon: "info",
                            color: "#C9963F",
                            lightColor: "#E8B86D",
                            bgColor: isDark
                              ? "rgba(201, 150, 63, 0.12)"
                              : "rgba(201, 150, 63, 0.06)",
                            borderColor: "#C9963F",
                            label: t("admin.informationRequest"),
                            details:
                              action.actionData?.request ||
                              t("admin.noRequestDetails"),
                          };
                        default:
                          return {
                            icon: "alert-circle",
                            color: colors.tint,
                            lightColor: colors.tint,
                            bgColor: isDark
                              ? "rgba(201, 150, 63, 0.12)"
                              : "rgba(201, 150, 63, 0.06)",
                            borderColor: colors.tint,
                            label: t("admin.unknownAction"),
                            details: t("admin.noDetailsAvailable"),
                          };
                      }
                    };

                    const config = getActionConfig();
                    const isActive = action.isActive;

                    return (
                      <View
                        key={action.id}
                        style={[
                          styles.actionHistoryCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.65)"
                              : "rgba(240, 232, 213, 0.7)",
                            borderColor: isDark
                              ? "rgba(255,250,240,0.10)"
                              : "rgba(0,0,0,0.08)",
                          },
                          index !== userActions.length - 1 &&
                            styles.actionHistoryCardNotLast,
                        ]}
                      >
                        <View
                          style={[
                            styles.actionHistoryLeftBorder,
                            { backgroundColor: config.color },
                          ]}
                        />
                        <View style={styles.actionHistoryCardContent}>
                          <View style={styles.actionHistoryTopRow}>
                            <View style={styles.actionHistoryIconWrapper}>
                              <View
                                style={[
                                  styles.actionHistoryIconCircle,
                                  {
                                    backgroundColor: config.bgColor,
                                    borderColor: isDark
                                      ? `${config.color}40`
                                      : `${config.color}30`,
                                  },
                                ]}
                              >
                                <Feather
                                  name={config.icon as any}
                                  size={18}
                                  color={config.color}
                                />
                              </View>
                            </View>
                            <View style={styles.actionHistoryMainContent}>
                              <View style={styles.actionHistoryTitleRow}>
                                <Text
                                  style={[
                                    styles.actionHistoryLabel,
                                    { color: colors.text },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {config.label}
                                </Text>
                                {isActive && (
                                  <View
                                    style={[
                                      styles.activeStatusBadge,
                                      {
                                        backgroundColor: isDark
                                          ? "rgba(239, 68, 68, 0.2)"
                                          : "rgba(239, 68, 68, 0.1)",
                                      },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.activeStatusDot,
                                        { backgroundColor: "#ef4444" },
                                      ]}
                                    />
                                    <Text
                                      style={[
                                        styles.activeStatusText,
                                        { color: "#ef4444" },
                                      ]}
                                    >
                                      Active
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.actionHistoryDetails,
                                  {
                                    color: isDark
                                      ? "rgba(240,232,213,0.7)"
                                      : "#8A7B68",
                                  },
                                ]}
                                numberOfLines={2}
                              >
                                {config.details}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.actionHistoryFooter,
                              {
                                borderTopColor: isDark
                                  ? "rgba(255,250,240,0.06)"
                                  : "rgba(184,130,42,0.06)",
                              },
                            ]}
                          >
                            <View style={styles.actionHistoryMetaRow}>
                              <View style={styles.actionHistoryMetaItem}>
                                <Feather
                                  name="calendar"
                                  size={11}
                                  color={isDark ? "#8A7B68" : "#9A8E7A"}
                                />
                                <Text
                                  style={[
                                    styles.actionHistoryMetaText,
                                    { color: isDark ? "#8A7B68" : "#9A8E7A" },
                                  ]}
                                >
                                  {formatDate(action.createdAt)}
                                </Text>
                              </View>
                              {action.ticketNumber && (
                                <>
                                  <View
                                    style={[
                                      styles.actionHistoryMetaDivider,
                                      {
                                        backgroundColor: isDark
                                          ? "rgba(201,150,63,0.12)"
                                          : "rgba(184,130,42,0.2)",
                                      },
                                    ]}
                                  />
                                  <View style={styles.actionHistoryMetaItem}>
                                    <Feather
                                      name="hash"
                                      size={11}
                                      color={isDark ? "#8A7B68" : "#9A8E7A"}
                                    />
                                    <Text
                                      style={[
                                        styles.actionHistoryTicket,
                                        {
                                          color: isDark ? "#8A7B68" : "#9A8E7A",
                                        },
                                      ]}
                                    >
                                      {action.ticketNumber}
                                    </Text>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                          {isActive && (
                            <TouchableOpacity
                              style={[
                                styles.revokeActionButton,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(201, 150, 63, 0.15)"
                                    : "rgba(201, 150, 63, 0.1)",
                                  borderColor: isDark
                                    ? "rgba(201, 150, 63, 0.3)"
                                    : "rgba(201, 150, 63, 0.25)",
                                },
                              ]}
                              onPress={() => handleRevokeAction(action.id)}
                              activeOpacity={0.7}
                            >
                              <Feather
                                name="rotate-ccw"
                                size={14}
                                color={colors.tint}
                              />
                              <Text
                                style={[
                                  styles.revokeActionText,
                                  { color: colors.tint },
                                ]}
                              >
                                Revoke
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Reviews Section */}
          {reviews.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recent Reviews ({reviews.length})
              </Text>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewerName, { color: colors.text }]}>
                      {review.reviewer.firstName} {review.reviewer.lastName}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <Feather name="star" size={14} color="#fbbf24" />
                      <Text style={[styles.ratingText, { color: colors.text }]}>
                        {review.rating}
                      </Text>
                    </View>
                  </View>
                  {review.comment && (
                    <Text
                      style={[
                        styles.reviewComment,
                        { color: isDark ? "#B8A88A" : "#6B6355" },
                      ]}
                    >
                      {review.comment}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.reviewDate,
                      { color: isDark ? "#8A7B68" : "#9A8E7A" },
                    ]}
                  >
                    {formatDate(review.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Bookings/Jobs Section */}
          {user.role === "JOB_SEEKER" && bookings.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Active Services ({bookings.length})
              </Text>
              {bookings.map((booking) => (
                <View key={booking.id} style={styles.bookingItem}>
                  <Text style={[styles.bookingTitle, { color: colors.text }]}>
                    {booking.job.title}
                  </Text>
                  <Text
                    style={[
                      styles.bookingStatus,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    Status: {booking.status}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {user.role === "EMPLOYER" && jobs.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Job Posts ({jobs.length})
              </Text>
              {jobs.map((job) => (
                <View key={job.id} style={styles.jobItem}>
                  <Text style={[styles.jobTitle, { color: colors.text }]}>
                    {job.title}
                  </Text>
                  <Text
                    style={[
                      styles.jobStatus,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    Status: {job.status}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Reported Issues */}
          {reportedIssues.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "rgba(255, 250, 240, 0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Reported Issues ({reportedIssues.length})
              </Text>
              {reportedIssues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={styles.issueItem}
                  onPress={() => {
                    if (issue.ticketNumber) {
                      router.push(
                        `/admin/support-ticket-detail?ticketId=${issue.id}` as never,
                      );
                    }
                  }}
                >
                  <Text style={[styles.issueSubject, { color: colors.text }]}>
                    {issue.subject}
                  </Text>
                  <Text
                    style={[
                      styles.issueCategory,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {issue.category} • {issue.status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Delete Modal */}
        <Modal visible={showDeleteModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("admin.deleteUser")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.areYouSureDeleteUser", { userName })}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: isDark ? "#334155" : "#F0E8D5" },
                  ]}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("common.delete")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Request Info Modal */}
        <Modal visible={showRequestInfoModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("admin.requestInformation")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.whatInformationNeeded", { userName })}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "#334155" : "#f1f5f9",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder={t("admin.enterYourRequest")}
                placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                value={requestInfoText}
                onChangeText={setRequestInfoText}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: isDark ? "#334155" : "#F0E8D5" },
                  ]}
                  onPress={() => {
                    setShowRequestInfoModal(false);
                    setRequestInfoText("");
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#C9963F" }]}
                  onPress={handleRequestInfo}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("admin.sendRequest")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Legal Action Modal */}
        <Modal visible={showLegalActionModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("admin.legalAction")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.recordLegalAction", { userName })}
              </Text>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.actionType")}
              </Text>
              <View style={styles.selectContainer}>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        legalActionType === "BAN"
                          ? "#E8B86D"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        legalActionType === "BAN"
                          ? "#E8B86D"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setLegalActionType("BAN")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.banAccount")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        legalActionType === "SUSPEND"
                          ? "#E8B86D"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        legalActionType === "SUSPEND"
                          ? "#E8B86D"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setLegalActionType("SUSPEND")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.suspendAccount")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        legalActionType === "RESTRICT"
                          ? "#E8B86D"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        legalActionType === "RESTRICT"
                          ? "#E8B86D"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setLegalActionType("RESTRICT")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.restrictAccess")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355", marginTop: 16 },
                ]}
              >
                Reason
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "#334155" : "#f1f5f9",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder={t("admin.enterReasonForLegalAction")}
                placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                value={legalActionReason}
                onChangeText={setLegalActionReason}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: isDark ? "#334155" : "#F0E8D5" },
                  ]}
                  onPress={() => {
                    setShowLegalActionModal(false);
                    setLegalActionType("");
                    setLegalActionReason("");
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#E8B86D" }]}
                  onPress={handleLegalAction}
                  disabled={submittingLegalAction}
                >
                  {submittingLegalAction ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("admin.submit")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Warning Modal */}
        <Modal visible={showWarningModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("admin.issueWarning")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.issueWarningTo", { userName })}
              </Text>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.warningType")}
              </Text>
              <View style={styles.selectContainer}>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        warningType === "MINOR"
                          ? "#f59e0b"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        warningType === "MINOR"
                          ? "#f59e0b"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setWarningType("MINOR")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.minorViolation")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        warningType === "MAJOR"
                          ? "#f59e0b"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        warningType === "MAJOR"
                          ? "#f59e0b"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setWarningType("MAJOR")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.majorViolation")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        warningType === "FINAL"
                          ? "#f59e0b"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        warningType === "FINAL"
                          ? "#f59e0b"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setWarningType("FINAL")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.finalWarning")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355", marginTop: 16 },
                ]}
              >
                {t("admin.warningMessage")}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "#334155" : "#f1f5f9",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder={t("admin.enterWarningMessage")}
                placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                value={warningMessage}
                onChangeText={setWarningMessage}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: isDark ? "#334155" : "#F0E8D5" },
                  ]}
                  onPress={() => {
                    setShowWarningModal(false);
                    setWarningType("");
                    setWarningMessage("");
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#f59e0b" }]}
                  onPress={handleWarning}
                  disabled={submittingWarning}
                >
                  {submittingWarning ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("admin.issueWarning")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Action Form Modal */}
        <Modal visible={showActionFormModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("admin.actionForm")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.submitActionFormFor", { userName })}
              </Text>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("admin.actionType")}
              </Text>
              <View style={styles.selectContainer}>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        actionFormType === "NOTICE"
                          ? "#10b981"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        actionFormType === "NOTICE"
                          ? "#10b981"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setActionFormType("NOTICE")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.notice")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        actionFormType === "REQUIREMENT"
                          ? "#10b981"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        actionFormType === "REQUIREMENT"
                          ? "#10b981"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setActionFormType("REQUIREMENT")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.requirement")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        actionFormType === "INVESTIGATION"
                          ? "#10b981"
                          : isDark
                            ? "#334155"
                            : "#f1f5f9",
                      borderColor:
                        actionFormType === "INVESTIGATION"
                          ? "#10b981"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setActionFormType("INVESTIGATION")}
                >
                  <Text
                    style={[styles.selectOptionText, { color: colors.text }]}
                  >
                    {t("admin.investigation")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.modalLabel,
                  { color: isDark ? "#B8A88A" : "#6B6355", marginTop: 16 },
                ]}
              >
                {t("admin.details")}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "#334155" : "#f1f5f9",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder={t("admin.enterActionDetails")}
                placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                value={actionFormDetails}
                onChangeText={setActionFormDetails}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: isDark ? "#334155" : "#F0E8D5" },
                  ]}
                  onPress={() => {
                    setShowActionFormModal(false);
                    setActionFormType("");
                    setActionFormDetails("");
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#10b981" }]}
                  onPress={handleActionForm}
                  disabled={submittingActionForm}
                >
                  {submittingActionForm ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("admin.submit")}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
  },
  userHeaderText: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
  },
  userInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  bioContainer: {
    marginTop: 8,
  },
  bioLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  verificationSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(201,150,63,0.12)",
  },
  sectionTitle: {
    fontSize: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionCountText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionHistoryList: {
    gap: 10,
  },
  verificationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  verificationItem: {
    flex: 1,
    minWidth: "45%",
  },
  verificationLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: "30%",
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    gap: 10,
  },
  actionButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.06)",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewComment: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  reviewDate: {
    fontSize: 11,
  },
  bookingItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.06)",
  },
  bookingTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  bookingStatus: {
    fontSize: 12,
  },
  jobItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.06)",
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  jobStatus: {
    fontSize: 12,
  },
  issueItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.06)",
  },
  issueSubject: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  issueCategory: {
    fontSize: 12,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  actionHistoryCard: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  actionHistoryCardNotLast: {
    marginBottom: 0,
  },
  actionHistoryLeftBorder: {
    width: 4,
  },
  actionHistoryCardContent: {
    flex: 1,
    padding: 16,
  },
  actionHistoryTopRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  actionHistoryIconWrapper: {
    marginRight: 12,
  },
  actionHistoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  actionHistoryMainContent: {
    flex: 1,
  },
  actionHistoryTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  actionHistoryLabel: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    letterSpacing: 0.2,
  },
  activeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  activeStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  actionHistoryFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  actionHistoryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionHistoryMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionHistoryMetaDivider: {
    width: 1,
    height: 12,
  },
  actionHistoryMetaText: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  actionHistoryTicket: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 0.2,
  },
  revokeActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  revokeActionText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 4,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
    textAlignVertical: "top",
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  selectContainer: {
    gap: 8,
    marginBottom: 16,
  },
  selectOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  actionHistoryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.06)",
  },
  actionHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  actionHistoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionHistoryText: {
    flex: 1,
  },
  actionHistoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  actionHistoryDate: {
    fontSize: 12,
  },
  revokeButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  actionHistoryContent: {
    marginLeft: 44,
  },
  actionHistoryDetails: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  actionStatusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
