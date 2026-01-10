import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import ActionBanner from "../components/ActionBanner";
import TemporaryPasswordBanner from "../components/TemporaryPasswordBanner";
import * as DocumentPicker from "expo-document-picker";

interface JobItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  city?: string;
  country?: string;
  coordinates?: [number, number];
  type?: string;
  workMode?: string;
  category?: { id: string; name: string };
  company?: { id: string; name: string };
  distanceKm?: number;
  isInstantBook?: boolean;
  payout?: string;
}

// Countdown timer component
const CountdownTimer = ({
  targetDate,
  colors,
  isDark,
  t,
}: {
  targetDate: string;
  colors: any;
  isDark: boolean;
  t: (key: string) => string;
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ days, hours, minutes });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <View style={styles.countdownContainer}>
        <ActivityIndicator size="small" color={colors.tint} />
      </View>
    );
  }

  const { days, hours, minutes } = timeLeft;
  const isUrgent = days === 0 && hours < 24;

  return (
    <View
      style={[
        styles.countdownContainer,
        {
          backgroundColor: isUrgent
            ? isDark
              ? "rgba(239, 68, 68, 0.15)"
              : "rgba(239, 68, 68, 0.1)"
            : isDark
              ? "rgba(99, 102, 241, 0.15)"
              : "rgba(99, 102, 241, 0.1)",
          borderColor: isUrgent
            ? isDark
              ? "rgba(239, 68, 68, 0.3)"
              : "rgba(239, 68, 68, 0.2)"
            : isDark
              ? "rgba(99, 102, 241, 0.3)"
              : "rgba(99, 102, 241, 0.2)",
        },
      ]}
    >
      <Feather
        name="clock"
        size={16}
        color={isUrgent ? "#ef4444" : colors.tint}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[
          styles.countdownText,
          {
            color: isUrgent ? "#ef4444" : colors.tint,
            fontWeight: isUrgent ? "700" : "600",
          },
        ]}
      >
        {days > 0 ? `${days}d ` : ""}
        {hours}h {minutes}m {t("jobs.timeLeft")}
      </Text>
    </View>
  );
};

// Helper function to translate category names
const translateCategoryName = (
  categoryName: string | undefined,
  t: (key: string) => string
): string => {
  if (!categoryName) return "";
  const categoryMap: Record<string, string> = {
    Cleaning: "cleaning",
    Plumbing: "plumbing",
    Gardening: "gardening",
    Electrical: "electrical",
    Carpentry: "carpentry",
    Painting: "painting",
    Moving: "moving",
    "General Labor": "generalLabor",
    Delivery: "delivery",
    Other: "other",
  };
  const key = categoryMap[categoryName];
  if (!key) return categoryName; // User-generated content, return as-is
  const translationKey = `jobs.category.${key}`;
  const translated = t(translationKey);
  // If translation returns the key itself, it means the key doesn't exist - fallback to original name
  return translated === translationKey ? categoryName : translated;
};

// Accepted Job Card Component
const AcceptedJobCard = ({
  application,
  job,
  colors,
  isDark,
  onPress,
  t,
}: {
  application: any;
  job: any;
  colors: any;
  isDark: boolean;
  onPress: () => void;
  t: (key: string) => string;
}) => {
  const startDate = job.startDate
    ? new Date(job.startDate).toLocaleDateString()
    : t("jobs.toBeDetermined");
  const endDate = job.endDate
    ? new Date(job.endDate).toLocaleDateString()
    : t("jobs.toBeDetermined");

  return (
    <TouchableButton
      style={[
        styles.acceptedJobCard,
        {
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.acceptedJobHeader}>
        <View style={styles.acceptedJobInfo}>
          <Text
            style={[styles.acceptedJobTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {job.title}
          </Text>
          {job.company?.name && (
            <Text
              style={[
                styles.acceptedJobCompany,
                { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {job.company.name}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.acceptedBadge,
            {
              backgroundColor: isDark
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(34, 197, 94, 0.1)",
            },
          ]}
        >
          <Feather name="check-circle" size={14} color="#22c55e" />
          <Text style={[styles.acceptedBadgeText, { color: "#22c55e" }]}>
            {t("applications.statusAccepted")}
          </Text>
        </View>
      </View>

      {job.description && (
        <Text
          style={[
            styles.acceptedJobDescription,
            { color: isDark ? "#cbd5e1" : "#475569" },
          ]}
          numberOfLines={3}
        >
          {job.description}
        </Text>
      )}

      <View style={styles.acceptedJobMeta}>
        <View style={styles.acceptedJobMetaRow}>
          {job.city && (
            <View style={styles.acceptedJobMetaItem}>
              <Feather
                name="map-pin"
                size={12}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text
                style={[
                  styles.acceptedJobMetaText,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {job.city}
                {job.country && `, ${job.country}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.acceptedJobTags}>
          {job.type && (
            <View
              style={[
                styles.acceptedJobTag,
                {
                  backgroundColor: isDark
                    ? "rgba(59, 130, 246, 0.2)"
                    : "rgba(59, 130, 246, 0.1)",
                },
              ]}
            >
              <Text style={[styles.acceptedJobTagText, { color: colors.tint }]}>
                {job.type
                  ? (() => {
                      const key = `jobs.type.${job.type.toLowerCase().replace(/_/g, "")}`;
                      const translated = t(key);
                      // If translation returns the key itself, it means the key doesn't exist
                      return translated === key
                        ? job.type.replace(/_/g, " ")
                        : translated;
                    })()
                  : ""}
              </Text>
            </View>
          )}
          {job.workMode && (
            <View
              style={[
                styles.acceptedJobTag,
                {
                  backgroundColor: isDark
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(34, 197, 94, 0.1)",
                },
              ]}
            >
              <Text style={[styles.acceptedJobTagText, { color: "#22c55e" }]}>
                {job.workMode
                  ? (() => {
                      const key = `jobs.workModeOptions.${job.workMode.toLowerCase().replace(/_/g, "")}`;
                      const translated = t(key);
                      // If translation returns the key itself, it means the key doesn't exist
                      return translated === key
                        ? job.workMode.replace(/_/g, " ")
                        : translated;
                    })()
                  : ""}
              </Text>
            </View>
          )}
          {job.category?.name && (
            <View
              style={[
                styles.acceptedJobTag,
                {
                  backgroundColor: isDark
                    ? "rgba(168, 85, 247, 0.2)"
                    : "rgba(168, 85, 247, 0.1)",
                },
              ]}
            >
              <Text style={[styles.acceptedJobTagText, { color: "#a855f7" }]}>
                {translateCategoryName(job.category.name, t)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.acceptedJobDates}>
          <View style={styles.acceptedJobDateRow}>
            <Feather
              name="calendar"
              size={14}
              color={isDark ? "#94a3b8" : "#64748b"}
            />
            <Text
              style={[
                styles.acceptedJobDateText,
                { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {t("jobs.start")}: {startDate}
            </Text>
          </View>
          {job.endDate && (
            <View style={styles.acceptedJobDateRow}>
              <Feather
                name="calendar"
                size={14}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text
                style={[
                  styles.acceptedJobDateText,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {t("jobs.end")}: {endDate}
              </Text>
            </View>
          )}
        </View>

        {job.startDate && (
          <CountdownTimer
            targetDate={job.startDate}
            colors={colors}
            isDark={isDark}
            t={t}
          />
        )}
      </View>
    </TouchableButton>
  );
};

export default function Feed() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [emailVerified, setEmailVerified] = useState<boolean>(true);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [idVerified, setIdVerified] = useState<boolean>(false);
  const [backgroundVerified, setBackgroundVerified] = useState<boolean>(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [jobToApplicationMap, setJobToApplicationMap] = useState<
    Map<string, string>
  >(new Map()); // Map jobId -> applicationId
  const [applying, setApplying] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [acceptedJobs, setAcceptedJobs] = useState<any[]>([]);
  const [loadingAcceptedJobs, setLoadingAcceptedJobs] = useState(false);
  const [hasTemporaryPassword, setHasTemporaryPassword] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchActiveBooking();
    fetchBalance();
    fetchProfile();
    fetchAppliedJobs();
    fetchAcceptedJobs();
  }, []);

  const fetchAppliedJobs = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/applications/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const applications = Array.isArray(data)
          ? data
          : data.applications || [];
        const appliedJobIds = new Set(
          applications
            .map((app: any) => app.job?.id || app.jobId)
            .filter(Boolean) as string[]
        );
        setAppliedJobs(appliedJobIds);

        // Create a map of jobId -> applicationId for navigation
        const jobToAppMap = new Map<string, string>();
        applications.forEach((app: any) => {
          const jobId = app.job?.id || app.jobId;
          if (jobId && app.id) {
            jobToAppMap.set(jobId, app.id);
          }
        });
        setJobToApplicationMap(jobToAppMap);
      }
    } catch (err) {
      console.log("Error fetching applied jobs:", err);
    }
  };

  const fetchAcceptedJobs = async () => {
    try {
      setLoadingAcceptedJobs(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/me?status=ACCEPTED&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const applications = Array.isArray(data)
          ? data
          : data.applications || [];
        // Filter to only include applications with jobs that have startDate
        const accepted = applications.filter(
          (app: any) => app.job && app.job.startDate
        );
        setAcceptedJobs(accepted);
      }
    } catch (err) {
      console.log("Error fetching accepted jobs:", err);
    } finally {
      setLoadingAcceptedJobs(false);
    }
  };

  const handleQuickApply = (jobId: string) => {
    if (appliedJobs.has(jobId)) {
      Alert.alert(t("jobs.alreadyApplied"), t("jobs.alreadyAppliedMessage"));
      return;
    }

    // Check if all verifications are complete
    if (
      !emailVerified ||
      !phoneVerified ||
      !idVerified ||
      !backgroundVerified
    ) {
      const missingVerifications = [];
      if (!emailVerified) missingVerifications.push(t("settings.email"));
      if (!phoneVerified) missingVerifications.push(t("settings.phone"));
      if (!idVerified) missingVerifications.push(t("kyc.idType"));
      if (!backgroundVerified)
        missingVerifications.push(t("kyc.criminalRecordCertificate"));

      Alert.alert(
        t("home.verificationRequired"),
        t("jobs.completeVerificationsBeforeApplying", {
          missing: missingVerifications.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("applications.goToSettings"),
            onPress: () => router.push("/(tabs)/settings" as any),
          },
        ]
      );
      return;
    }

    setSelectedJobId(jobId);
    setShowApplyModal(true);
  };

  const handleApply = async () => {
    if (!selectedJobId) return;

    // Check if all verifications are complete
    if (
      !emailVerified ||
      !phoneVerified ||
      !idVerified ||
      !backgroundVerified
    ) {
      const missingVerifications = [];
      if (!emailVerified) missingVerifications.push(t("settings.email"));
      if (!phoneVerified) missingVerifications.push(t("settings.phone"));
      if (!idVerified) missingVerifications.push(t("kyc.idType"));
      if (!backgroundVerified)
        missingVerifications.push(t("kyc.criminalRecordCertificate"));

      Alert.alert(
        t("home.verificationRequired"),
        t("jobs.completeVerificationsBeforeApplying", {
          missing: missingVerifications.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("applications.goToSettings"),
            onPress: () => router.push("/(tabs)/settings" as any),
          },
        ]
      );
      return;
    }

    try {
      setApplying(selectedJobId);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        return;
      }

      const base = getApiBase();

      // Submit application
      const res = await fetch(`${base}/jobs/${selectedJobId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coverLetter: coverLetter.trim() || undefined,
        }),
      });

      if (res.ok) {
        setAppliedJobs(new Set([...appliedJobs, selectedJobId]));
        setShowApplyModal(false);
        setCoverLetter("");
        setSelectedJobId(null);
        Alert.alert(t("common.success"), t("jobs.applicationSubmitted"));
      } else {
        const error = await res
          .json()
          .catch(() => ({ message: t("jobs.failedToSubmit") }));
        if (res.status === 409) {
          setAppliedJobs(new Set([...appliedJobs, selectedJobId]));
          setShowApplyModal(false);
          setCoverLetter("");
          setSelectedJobId(null);
          Alert.alert(
            t("jobs.alreadyApplied"),
            t("jobs.alreadyAppliedMessage")
          );
        } else {
          Alert.alert(
            t("common.error"),
            error.message || t("jobs.failedToSubmit")
          );
        }
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setApplying(null);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();
      const res = await fetch(`${base}/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        if (u?.firstName) {
          setUserName(u.firstName);
        }
        setEmailVerified(!!u?.emailVerifiedAt);
        setPhoneVerified(!!u?.phoneVerifiedAt);
        setIdVerified(
          !!(u?.isIdVerified || u?.idVerificationStatus === "VERIFIED")
        );
        setBackgroundVerified(
          !!(u?.isBackgroundVerified || u?.backgroundCheckStatus === "APPROVED")
        );
        // Check for temporary password flag
        setHasTemporaryPassword(!!data.hasTemporaryPassword);
      }
    } catch (err) {
      console.log("Error fetching profile", err);
    }
  };

  // Refresh balance and accepted jobs when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchBalance();
      fetchAcceptedJobs();
      fetchProfile(); // Refresh profile to update temporary password banner
    }, [])
  );

  const fetchBalance = async () => {
    try {
      setLoadingBalance(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setBalance(0);
        return;
      }
      const base = getApiBase();
      const res = await fetch(`${base}/payments/dashboard/job-seeker`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // estimatedNet is in cents (smallest currency unit), convert to euros
        const balanceInEuros = (data.estimatedNet || 0) / 100;
        setBalance(balanceInEuros);
      } else {
        setBalance(0);
      }
    } catch (err: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (err?.message && !err.message.includes("Network request failed")) {
        console.log("Error fetching balance", err);
      }
      setBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchActiveBooking = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();

      // Fetch IN_PROGRESS bookings first
      const res = await fetch(`${base}/bookings/seeker/me?status=IN_PROGRESS`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setActiveBooking(data[0]);
          return;
        }
      }

      // If no in-progress, check confirmed
      const res2 = await fetch(`${base}/bookings/seeker/me?status=CONFIRMED`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.length > 0) {
          setActiveBooking(data2[0]);
          return;
        }
      }

      setActiveBooking(null);
    } catch (err: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (err?.message && !err.message.includes("Network request failed")) {
        console.log("Error fetching active booking", err);
      }
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Backend returns an array directly, not wrapped in { jobs: [...] }
        const jobsArray = Array.isArray(data) ? data : data.jobs || [];
        setJobs(jobsArray);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.log("Error fetching jobs", err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = {
    textPrimary: { color: colors.text },
    textSecondary: { color: isDark ? "#94a3b8" : "#64748b" }, // Slate-400 vs Slate-500
    iconColor: isDark ? "#e5e7eb" : "#4b5563",
    cardBg: {
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.85)"
        : "rgba(255, 255, 255, 0.9)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
    },
    actionBtn: {
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.8)"
        : "rgba(241, 245, 249, 0.9)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
    },
  };

  const renderJobCard = (item: JobItem) => {
    const hasApplied = appliedJobs.has(item.id);
    const isApplying = applying === item.id;

    return (
      <View
        key={item.id}
        style={[
          styles.jobCard,
          {
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#ffffff",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          },
        ]}
      >
        <TouchableButton
          style={{ flex: 1 }}
          onPress={() => {
            // If service provider has an application for this job (especially instant jobs),
            // navigate to application details instead of job details
            const applicationId = jobToApplicationMap.get(item.id);
            if (applicationId) {
              router.push(`/my-application/${applicationId}` as any);
            } else {
              router.push(`/jobs/${item.id}` as any);
            }
          }}
        >
          <View style={styles.jobHeader}>
            <View style={styles.jobInfo}>
              <Text
                style={[styles.jobTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.company?.name && (
                <Text
                  style={[
                    styles.companyName,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {item.company.name}
                </Text>
              )}
            </View>
            {item.isInstantBook && (
              <View
                style={[
                  styles.instantBadge,
                  { backgroundColor: isDark ? "#6366f1" : "#4f46e5" },
                ]}
              >
                <Text style={styles.instantText}>{t("jobs.instant")}</Text>
              </View>
            )}
          </View>

          {item.description && (
            <Text
              style={[
                styles.jobDescription,
                { color: isDark ? "#cbd5e1" : "#475569" },
              ]}
              numberOfLines={3}
            >
              {item.description}
            </Text>
          )}

          <View style={styles.jobMeta}>
            <View style={styles.metaRow}>
              {item.city && (
                <View style={styles.metaItem}>
                  <Feather
                    name="map-pin"
                    size={12}
                    color={isDark ? "#94a3b8" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {item.city}
                    {item.country && `, ${item.country}`}
                  </Text>
                </View>
              )}
              {item.distanceKm !== undefined && (
                <Text
                  style={[
                    styles.metaText,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {t("jobs.kmAway", { distance: item.distanceKm.toFixed(1) })}
                </Text>
              )}
            </View>

            <View style={styles.jobTags}>
              {item.type && (
                <View
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isDark
                        ? "rgba(59, 130, 246, 0.2)"
                        : "rgba(59, 130, 246, 0.1)",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.tint }]}>
                    {item.type
                      ? (() => {
                          const key = `jobs.type.${item.type.toLowerCase().replace(/_/g, "")}`;
                          const translated = t(key);
                          // If translation returns the key itself, it means the key doesn't exist
                          return translated === key
                            ? item.type.replace(/_/g, " ")
                            : translated;
                        })()
                      : ""}
                  </Text>
                </View>
              )}
              {item.workMode && (
                <View
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isDark
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(34, 197, 94, 0.1)",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: "#22c55e" }]}>
                    {item.workMode
                      ? (() => {
                          const key = `jobs.workModeOptions.${item.workMode.toLowerCase().replace(/_/g, "")}`;
                          const translated = t(key);
                          // If translation returns the key itself, it means the key doesn't exist
                          return translated === key
                            ? item.workMode.replace(/_/g, " ")
                            : translated;
                        })()
                      : ""}
                  </Text>
                </View>
              )}
              {item.category?.name && (
                <View
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isDark
                        ? "rgba(168, 85, 247, 0.2)"
                        : "rgba(168, 85, 247, 0.1)",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: "#a855f7" }]}>
                    {translateCategoryName(item.category.name, t)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableButton>

        {hasApplied ? (
          <View style={styles.appliedBadge}>
            <Feather name="check-circle" size={16} color="#22c55e" />
            <Text style={styles.appliedBadgeText}>
              {t("applications.applied")}
            </Text>
          </View>
        ) : (
          <TouchableButton
            style={[
              styles.applyButton,
              {
                backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                opacity: isApplying ? 0.6 : 1,
              },
            ]}
            onPress={() => handleQuickApply(item.id)}
            disabled={isApplying}
          >
            {isApplying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="send" size={14} color="#fff" />
                <Text style={styles.applyButtonText}>{t("jobs.apply")}</Text>
              </>
            )}
          </TouchableButton>
        )}
      </View>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableButton
            accessibilityRole="button"
            onPress={() => router.replace("/user-home" as any)}
          >
            <Feather name="home" size={20} color={themeStyles.iconColor} />
          </TouchableButton>
          <Text style={[styles.screenTitle, themeStyles.textSecondary]}>
            {t("navigation.home")}
          </Text>
          <TouchableButton
            accessibilityRole="button"
            onPress={() => router.push("/legal-menu" as any)}
          >
            <Feather name="menu" size={20} color={themeStyles.iconColor} />
          </TouchableButton>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <EmailVerificationBanner
            emailVerified={emailVerified}
            onVerify={() => fetchProfile()}
          />
          {hasTemporaryPassword && <TemporaryPasswordBanner />}
          <ActionBanner />

          <View style={styles.headerSummary}>
            <Text style={[styles.greeting, themeStyles.textPrimary]}>
              {t("home.greeting", { name: userName || "" })}
            </Text>
            <Text style={[styles.balanceLabel, themeStyles.textSecondary]}>
              {t("home.yourAvailableBalance")}
            </Text>
            <Text style={[styles.balanceValue, themeStyles.textPrimary]}>
              €{(balance ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.quickActions}>
            <TouchableButton
              style={[styles.qaBtn, themeStyles.actionBtn]}
              onPress={() => router.push("/search-jobs" as any)}
            >
              <Feather
                name="search"
                size={18}
                color={themeStyles.iconColor}
                style={styles.qaIcon}
              />
              <Text
                style={[styles.qaText, themeStyles.textPrimary]}
                numberOfLines={2}
              >
                {t("common.search")}
              </Text>
            </TouchableButton>

            <TouchableButton
              style={[styles.qaBtn, themeStyles.actionBtn]}
              onPress={() => router.push("/payments/receipts" as any)}
            >
              <Text style={[styles.euroIcon, { color: themeStyles.iconColor }]}>
                €
              </Text>
              <Text
                style={[styles.qaText, themeStyles.textPrimary]}
                numberOfLines={2}
              >
                {t("home.earnings")}
              </Text>
            </TouchableButton>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
              {t("home.yourActivities")}
            </Text>
            <View style={styles.iconRow}>
              <TouchableButton
                style={[styles.iconBox, themeStyles.actionBtn]}
                onPress={() => router.push("/agenda" as any)}
              >
                <Feather
                  name="calendar"
                  size={22}
                  color={themeStyles.iconColor}
                  style={{ marginBottom: 6 }}
                />
                <Text
                  style={[styles.iconText, themeStyles.textPrimary]}
                  numberOfLines={2}
                >
                  {t("agenda.title")}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[styles.iconBox, themeStyles.actionBtn]}
                onPress={() => {
                  // Always navigate to the list view first, so users can start/stop tracking
                  router.push("/tracking?role=JOB_SEEKER" as any);
                }}
              >
                <Feather
                  name="navigation"
                  size={22}
                  color={themeStyles.iconColor}
                  style={{ marginBottom: 6 }}
                />
                <Text
                  style={[styles.iconText, themeStyles.textPrimary]}
                  numberOfLines={2}
                >
                  {t("tracking.activeBookings")}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[styles.iconBox, themeStyles.actionBtn]}
                onPress={() => router.push("/refer" as any)}
              >
                <Feather
                  name="users"
                  size={22}
                  color={themeStyles.iconColor}
                  style={{ marginBottom: 6 }}
                />
                <Text
                  style={[styles.iconText, themeStyles.textPrimary]}
                  numberOfLines={2}
                >
                  {t("refer.title")}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[styles.iconBox, themeStyles.actionBtn]}
                onPress={() => router.push("/chat/inbox" as any)}
              >
                <Feather
                  name="message-square"
                  size={22}
                  color={themeStyles.iconColor}
                  style={{ marginBottom: 6 }}
                />
                <Text
                  style={[styles.iconText, themeStyles.textPrimary]}
                  numberOfLines={2}
                >
                  {t("chat.messages")}
                </Text>
              </TouchableButton>
            </View>
            <View style={styles.availabilityRow}>
              <TouchableButton
                style={[styles.availabilityBox, themeStyles.actionBtn]}
                onPress={() => router.push("/schedule" as any)}
              >
                <Feather
                  name="check-circle"
                  size={20}
                  color={themeStyles.iconColor}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[styles.availabilityText, themeStyles.textPrimary]}
                  numberOfLines={2}
                >
                  {t("schedule.myAvailability")}
                </Text>
              </TouchableButton>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
              {t("home.updatesLatestJobs")}
            </Text>
            {loadingAcceptedJobs ? (
              <View
                style={[
                  styles.cardLarge,
                  themeStyles.cardBg,
                  {
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 24,
                  },
                ]}
              >
                <ActivityIndicator color={colors.tint} />
                <Text
                  style={[
                    styles.cardSub,
                    themeStyles.textSecondary,
                    { marginTop: 12 },
                  ]}
                >
                  {t("home.loadingAcceptedJobs")}
                </Text>
              </View>
            ) : acceptedJobs.length === 0 ? (
              <View style={[styles.cardLarge, themeStyles.cardBg]}>
                <View>
                  <Text style={[styles.cardTitle, themeStyles.textPrimary]}>
                    {t("home.noAcceptedJobs")}
                  </Text>
                  <Text style={[styles.cardSub, themeStyles.textSecondary]}>
                    {t("home.noAcceptedJobsMessage")}
                  </Text>
                </View>
              </View>
            ) : (
              acceptedJobs.map((app: any) => {
                const job = app.job;
                if (!job || !job.startDate) return null;

                return (
                  <AcceptedJobCard
                    key={app.id}
                    application={app}
                    job={job}
                    colors={colors}
                    isDark={isDark}
                    t={t}
                    onPress={() =>
                      router.push(`/my-application/${app.id}` as any)
                    }
                  />
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
              {t("home.availableJobs")}
            </Text>
            {loading ? (
              <Text style={[styles.loading, themeStyles.textSecondary]}>
                {t("common.loading")}
              </Text>
            ) : jobs.length === 0 ? (
              <Text style={[styles.empty, themeStyles.textSecondary]}>
                {t("home.noJobsAvailable")}
              </Text>
            ) : (
              jobs.map((job) => renderJobCard(job))
            )}
          </View>
        </ScrollView>

        {/* Apply Modal */}
        <Modal
          visible={showApplyModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowApplyModal(false);
            setCoverLetter("");
            setSelectedJobId(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "#ffffff",
                    maxHeight: "85%",
                  },
                ]}
              >
                <View
                  style={[
                    styles.modalHeader,
                    {
                      borderBottomColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "#e5e7eb",
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      {t("jobs.applyForJob")}
                    </Text>
                    <Text
                      style={[
                        styles.modalSubtitle,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                    >
                      {t("jobs.completeApplicationBelow")}
                    </Text>
                  </View>
                  <TouchableButton
                    onPress={() => {
                      setShowApplyModal(false);
                      setCoverLetter("");
                      setSelectedJobId(null);
                    }}
                    style={styles.modalCloseButton}
                  >
                    <Feather
                      name="x"
                      size={22}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  </TouchableButton>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Cover Letter Section */}
                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionHeader}>
                      <Feather name="file-text" size={18} color={colors.tint} />
                      <Text
                        style={[
                          styles.modalLabel,
                          { color: colors.text, marginLeft: 8 },
                        ]}
                      >
                        {t("jobs.moreAboutMe")}
                      </Text>
                      <View
                        style={[
                          styles.optionalBadge,
                          {
                            backgroundColor: isDark
                              ? "rgba(148, 163, 184, 0.2)"
                              : "#f1f5f9",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionalBadgeText,
                            { color: isDark ? "#94a3b8" : "#64748b" },
                          ]}
                        >
                          {t("jobs.optional")}
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={[
                        styles.modalTextArea,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "#f9fafb",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,255,255,0.12)"
                            : "#e5e7eb",
                        },
                      ]}
                      placeholder={t("jobs.moreAboutYouPlaceholder")}
                      placeholderTextColor={isDark ? "#64748b" : "#9ca3af"}
                      multiline
                      numberOfLines={6}
                      value={coverLetter}
                      onChangeText={setCoverLetter}
                      textAlignVertical="top"
                    />
                    <Text
                      style={[
                        styles.modalHint,
                        { color: isDark ? "#64748b" : "#94a3b8" },
                      ]}
                    >
                      {t("jobs.shareMoreAboutYourself")}
                    </Text>
                  </View>
                </ScrollView>

                <View
                  style={[
                    styles.modalButtons,
                    {
                      borderTopColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "#e5e7eb",
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.95)"
                        : "#ffffff",
                    },
                  ]}
                >
                  <TouchableButton
                    style={[
                      styles.modalButton,
                      styles.modalButtonCancel,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#e2e8f0",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.15)"
                          : "#cbd5e1",
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => {
                      setShowApplyModal(false);
                      setCoverLetter("");
                      setSelectedJobId(null);
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, { color: colors.text }]}
                    >
                      {t("common.cancel")}
                    </Text>
                  </TouchableButton>
                  <TouchableButton
                    style={[
                      styles.modalButton,
                      styles.modalButtonSubmit,
                      {
                        backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                        borderColor: isDark ? "#6366f1" : "#4f46e5",
                        shadowColor: isDark ? "#4f46e5" : "#6366f1",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 4,
                        borderWidth: 1,
                        minWidth: 180,
                        paddingHorizontal: 24,
                      },
                      applying && { opacity: 0.6 },
                    ]}
                    onPress={handleApply}
                    disabled={applying !== null}
                  >
                    {applying ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={styles.submitButtonContent}>
                        <Feather name="send" size={18} color="#fff" />
                        <Text style={styles.modalButtonTextSubmit}>
                          {t("jobs.submitApplication")}
                        </Text>
                      </View>
                    )}
                  </TouchableButton>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  screenTitle: { fontSize: 16, fontWeight: "600" },
  cardTitle: {},
  loading: { padding: 16 },
  greeting: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  balanceLabel: { fontSize: 13, marginTop: 4 },
  balanceValue: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  headerSummary: { paddingHorizontal: 20, paddingVertical: 20 },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  qaBtn: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
    minHeight: 48,
  },
  qaIcon: { marginRight: 6 },
  euroIcon: { fontSize: 18, fontWeight: "700", marginRight: 6 },
  qaText: {
    fontWeight: "600",
    fontSize: 12,
    flexShrink: 1,
    textAlign: "center",
    flexWrap: "wrap",
  },
  section: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    fontSize: 15,
  },
  iconRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  iconBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
    minHeight: 100,
  },
  iconText: {
    fontWeight: "500",
    fontSize: 11,
    textAlign: "center",
    flexWrap: "wrap",
    lineHeight: 15,
    paddingHorizontal: 2,
    flexShrink: 1,
    width: "100%",
  },
  availabilityRow: { marginTop: 0 },
  availabilityBox: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
    minHeight: 52,
  },
  availabilityText: {
    fontWeight: "600",
    fontSize: 13,
    flexShrink: 1,
    flexWrap: "wrap",
    textAlign: "center",
    lineHeight: 18,
  },
  cardLarge: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  cardSub: { marginTop: 4, fontSize: 13 },
  buttonPrimary: {
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonLabel: { fontWeight: "600", fontSize: 13 },
  empty: { fontSize: 14 },
  jobCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 3,
    overflow: "hidden",
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobInfo: { flex: 1, marginRight: 8 },
  jobTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  companyName: { fontSize: 14, fontWeight: "500" },
  instantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  instantText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  jobDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    flexWrap: "wrap",
  },
  jobMeta: { marginTop: 8 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  jobTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  cta: { color: "#60a5fa", marginTop: 10, fontWeight: "600", fontSize: 13 },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  appliedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#22c55e20",
    gap: 6,
    marginTop: 8,
  },
  appliedBadgeText: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    marginTop: 2,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalSection: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  optionalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalTextArea: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    fontSize: 15,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: "top",
  },
  modalHint: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 8,
  },
  cvFileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  cvFileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cvFileIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cvFileName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  cvFileSize: {
    fontSize: 12,
    fontWeight: "400",
  },
  removeCvButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    marginLeft: 12,
  },
  uploadCvButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  uploadIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCvButtonText: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  uploadCvSubtext: {
    fontSize: 12,
    fontWeight: "400",
  },
  modalButtons: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
  },
  modalButtonCancel: {},
  modalButtonSubmit: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  submitButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptedJobCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 3,
    overflow: "hidden",
  },
  acceptedJobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  acceptedJobInfo: { flex: 1, marginRight: 8 },
  acceptedJobTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  acceptedJobCompany: { fontSize: 14, fontWeight: "500" },
  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  acceptedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  acceptedJobDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    flexWrap: "wrap",
  },
  acceptedJobMeta: { marginTop: 8 },
  acceptedJobMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  acceptedJobMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  acceptedJobMetaText: { fontSize: 12 },
  acceptedJobTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  acceptedJobTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  acceptedJobTagText: { fontSize: 12, fontWeight: "600" },
  acceptedJobDates: {
    marginBottom: 12,
    gap: 6,
  },
  acceptedJobDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  acceptedJobDateText: {
    fontSize: 13,
    fontWeight: "500",
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
