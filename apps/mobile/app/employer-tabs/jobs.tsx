import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { TouchableButton } from "../../components/TouchableButton";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiBase } from "../../lib/api";
import * as SecureStore from "expo-secure-store";

const decodeJwtPayload = (
  token: string
): {
  sub?: string;
  id?: string;
  userId?: string;
  [key: string]: any;
} | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
};

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  city: string;
  country: string;
  type: string;
  workMode: string;
  status: string;
  createdAt: string;
  employerId?: string;
  category?: {
    id: string;
    name: string;
  };
}

type JobTab = "ACTIVE" | "IN_PROGRESS" | "COMPLETED";

export default function EmployerJobs() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<JobTab>("ACTIVE");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);

  useEffect(() => {
    // Get user ID from token
    const getUserId = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (token) {
          const decoded = decodeJwtPayload(token);
          setUserId(decoded?.id || decoded?.userId || decoded?.sub || null);
        }
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    };
    getUserId();
    fetchEmployerVerification();
  }, []);

  const fetchEmployerVerification = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/profiles/employer/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        const profile = data.profile;
        // Check email verification
        setEmailVerified(!!u?.emailVerifiedAt);
        // Check phone verification
        setPhoneVerified(!!u?.phoneVerifiedAt);
        // Check address verification (must have addressLine1 or city and country)
        // Check both EmployerProfile and UserProfile (fallback)
        // Handle both null/undefined and empty strings
        const hasAddressLine1 =
          profile?.addressLine1 && profile.addressLine1.trim().length > 0;
        const hasCity = profile?.city && profile.city.trim().length > 0;
        const hasCountry =
          profile?.country && profile.country.trim().length > 0;
        let addressVerified = hasAddressLine1 || (hasCity && hasCountry);

        // If employer profile doesn't have address, check user profile as fallback
        if (!addressVerified && data.userProfile) {
          const userProfile = data.userProfile;
          const userHasAddressLine1 =
            userProfile?.addressLine1 &&
            userProfile.addressLine1.trim().length > 0;
          const userHasCity =
            userProfile?.city && userProfile.city.trim().length > 0;
          const userHasCountry =
            userProfile?.country && userProfile.country.trim().length > 0;
          addressVerified =
            userHasAddressLine1 || (userHasCity && userHasCountry);
        }
        setHasAddress(addressVerified);
      }
    } catch (err) {
      console.log("Error fetching employer verification:", err);
    }
  };

  const isFetchingRef = useRef(false);

  const fetchJobs = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      // Use the new my-jobs endpoint that returns all jobs for the employer
      const res = await fetch(`${base}/jobs/my-jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const allJobs = await res.json();
        // allJobs is already an array of the employer's jobs
        let myJobs = Array.isArray(allJobs) ? allJobs : [];

        // Filter by active tab
        if (activeTab === "ACTIVE") {
          myJobs = myJobs.filter((job: Job) => job.status === "ACTIVE");
        } else if (activeTab === "IN_PROGRESS") {
          // IN_PROGRESS = jobs with status ASSIGNED (when application is accepted)
          myJobs = myJobs.filter((job: Job) => job.status === "ASSIGNED");
        } else if (activeTab === "COMPLETED") {
          // COMPLETED = jobs with status COMPLETED or CLOSED
          myJobs = myJobs.filter(
            (job: Job) => job.status === "COMPLETED" || job.status === "CLOSED"
          );
        }

        setJobs(myJobs);
      } else {
        console.error("Failed to fetch jobs:", res.status, res.statusText);
        setJobs([]);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchJobs();
      }
    }, [userId, activeTab])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === "pt" ? "pt-PT" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "#22c55e";
      case "ASSIGNED":
        return "#3b82f6";
      case "COMPLETED":
        return "#10b981";
      case "CLOSED":
        return "#6b7280";
      case "DRAFT":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return t("jobs.statusLabels.active");
      case "ASSIGNED":
        return t("jobs.statusLabels.inProgress");
      case "COMPLETED":
        return t("jobs.statusLabels.completed");
      case "CLOSED":
        return t("jobs.statusLabels.closed");
      case "DRAFT":
        return t("jobs.statusLabels.draft");
      default:
        return status;
    }
  };

  if (loading && !refreshing) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t("jobs.loadingJobs")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("navigation.myJobs")}
          </Text>
          <TouchableButton
            onPress={() => {
              if (!emailVerified || !phoneVerified || !hasAddress) {
                const missing = [];
                if (!emailVerified) missing.push(t("profile.email"));
                if (!phoneVerified) missing.push(t("profile.phone"));
                if (!hasAddress) missing.push(t("profile.address"));
                Alert.alert(
                  t("home.verificationRequired"),
                  t("jobs.completeVerificationBeforePosting", {
                    missing: missing.join(", "),
                  }),
                  [
                    { text: t("common.ok") },
                    {
                      text: t("jobs.goToSettings"),
                      onPress: () => router.push("/settings" as any),
                    },
                  ]
                );
                return;
              }
              router.push("/post-job" as never);
            }}
            style={[
              styles.addButton,
              {
                backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                borderWidth: 1,
                borderColor: isDark ? "#6366f1" : "#4f46e5",
                opacity:
                  !emailVerified || !phoneVerified || !hasAddress ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.addButtonText}>{t("jobs.postJob")}</Text>
          </TouchableButton>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "ACTIVE" && styles.activeTab,
              {
                backgroundColor:
                  activeTab === "ACTIVE"
                    ? isDark
                      ? "#4f46e5"
                      : "#6366f1"
                    : isDark
                      ? "rgba(30, 41, 59, 0.5)"
                      : "rgba(0,0,0,0.05)",
                borderColor:
                  activeTab === "ACTIVE"
                    ? isDark
                      ? "#6366f1"
                      : "#4f46e5"
                    : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => setActiveTab("ACTIVE")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "ACTIVE"
                      ? "#fff"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b",
                  fontWeight: activeTab === "ACTIVE" ? "600" : "500",
                },
              ]}
            >
              {t("jobs.tabs.active")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "IN_PROGRESS" && styles.activeTab,
              {
                backgroundColor:
                  activeTab === "IN_PROGRESS"
                    ? isDark
                      ? "#4f46e5"
                      : "#6366f1"
                    : isDark
                      ? "rgba(30, 41, 59, 0.5)"
                      : "rgba(0,0,0,0.05)",
                borderColor:
                  activeTab === "IN_PROGRESS"
                    ? isDark
                      ? "#6366f1"
                      : "#4f46e5"
                    : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => setActiveTab("IN_PROGRESS")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "IN_PROGRESS"
                      ? "#fff"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b",
                  fontWeight: activeTab === "IN_PROGRESS" ? "600" : "500",
                },
              ]}
            >
              {t("jobs.tabs.inProgress")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "COMPLETED" && styles.activeTab,
              {
                backgroundColor:
                  activeTab === "COMPLETED"
                    ? isDark
                      ? "#4f46e5"
                      : "#6366f1"
                    : isDark
                      ? "rgba(30, 41, 59, 0.5)"
                      : "rgba(0,0,0,0.05)",
                borderColor:
                  activeTab === "COMPLETED"
                    ? isDark
                      ? "#6366f1"
                      : "#4f46e5"
                    : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => setActiveTab("COMPLETED")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "COMPLETED"
                      ? "#fff"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b",
                  fontWeight: activeTab === "COMPLETED" ? "600" : "500",
                },
              ]}
            >
              {t("jobs.tabs.completed")}
            </Text>
          </TouchableOpacity>
        </View>

        {jobs.length === 0 ? (
          <View style={styles.center}>
            <Feather
              name="briefcase"
              size={64}
              color={isDark ? "#475569" : "#cbd5e1"}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeTab === "ACTIVE" && t("jobs.empty.activeTitle")}
              {activeTab === "IN_PROGRESS" && t("jobs.empty.inProgressTitle")}
              {activeTab === "COMPLETED" && t("jobs.empty.completedTitle")}
            </Text>
            <Text
              style={[
                styles.emptySub,
                { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {activeTab === "ACTIVE" && t("jobs.empty.activeMessage")}
              {activeTab === "IN_PROGRESS" && t("jobs.empty.inProgressMessage")}
              {activeTab === "COMPLETED" && t("jobs.empty.completedMessage")}
            </Text>
            <TouchableButton
              onPress={() => {
                if (!emailVerified || !phoneVerified || !hasAddress) {
                  const missing = [];
                  if (!emailVerified) missing.push(t("profile.email"));
                  if (!phoneVerified) missing.push(t("profile.phone"));
                  if (!hasAddress) missing.push(t("profile.address"));
                  Alert.alert(
                    t("home.verificationRequired"),
                    t("jobs.completeVerificationBeforePosting", {
                      missing: missing.join(", "),
                    }),
                    [
                      { text: t("common.ok") },
                      {
                        text: t("jobs.goToSettings"),
                        onPress: () => router.push("/(tabs)/settings" as any),
                      },
                    ]
                  );
                  return;
                }
                router.push("/post-job" as never);
              }}
              style={[
                styles.postJobButton,
                {
                  backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                  borderWidth: 1,
                  borderColor: isDark ? "#6366f1" : "#4f46e5",
                  opacity:
                    !emailVerified || !phoneVerified || !hasAddress ? 0.5 : 1,
                },
              ]}
            >
              <Text style={styles.postJobButtonText}>
                {t("jobs.postYourFirstJob")}
              </Text>
            </TouchableButton>
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <TouchableButton
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.7)"
                      : "#ffffff",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  },
                ]}
                onPress={() => {
                  router.push(`/jobs/${item.id}` as never);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.jobTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Feather
                        name="map-pin"
                        size={12}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                      <Text
                        style={[
                          styles.location,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {[item.location, item.city, item.country]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(item.status) + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.description,
                    { color: isDark ? "#cbd5e1" : "#475569" },
                  ]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={styles.typeRow}>
                    <Feather
                      name="briefcase"
                      size={12}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                    <Text
                      style={[
                        styles.typeText,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {item.type?.replace("_", " ")} •{" "}
                      {item.workMode?.replace("_", " ")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.dateText,
                      { color: isDark ? "#64748b" : "#94a3b8" },
                    ]}
                  >
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              </TouchableButton>
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
    ...(Platform.OS === "android" && {
      elevation: 0,
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typeText: {
    fontSize: 12,
  },
  dateText: {
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  postJobButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  postJobButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    // Active styling is handled inline
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
