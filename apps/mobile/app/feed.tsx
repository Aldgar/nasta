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
  TouchableOpacity,
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
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
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
              ? "rgba(201, 150, 63, 0.15)"
              : "rgba(201, 150, 63, 0.1)",
          borderColor: isUrgent
            ? isDark
              ? "rgba(239, 68, 68, 0.3)"
              : "rgba(239, 68, 68, 0.2)"
            : isDark
              ? "rgba(201, 150, 63, 0.3)"
              : "rgba(201, 150, 63, 0.2)",
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
  t: (key: string) => string,
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
          backgroundColor: isDark ? "rgba(12, 22, 42, 0.85)" : "#FFFAF0",
          borderColor: isDark
            ? "rgba(255,250,240,0.12)"
            : "rgba(184,130,42,0.2)",
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
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                ? application._bookingStatus === "IN_PROGRESS"
                  ? "rgba(20, 184, 166, 0.2)"
                  : "rgba(34, 197, 94, 0.2)"
                : application._bookingStatus === "IN_PROGRESS"
                  ? "rgba(20, 184, 166, 0.1)"
                  : "rgba(34, 197, 94, 0.1)",
            },
          ]}
        >
          <Feather
            name={
              application._bookingStatus === "IN_PROGRESS"
                ? "activity"
                : "check-circle"
            }
            size={14}
            color={
              application._bookingStatus === "IN_PROGRESS"
                ? "#14B8A6"
                : "#22c55e"
            }
          />
          <Text
            style={[
              styles.acceptedBadgeText,
              {
                color:
                  application._bookingStatus === "IN_PROGRESS"
                    ? "#14B8A6"
                    : "#22c55e",
              },
            ]}
          >
            {application._bookingStatus === "IN_PROGRESS"
              ? t("common.active")
              : application._bookingStatus === "CONFIRMED"
                ? t("common.confirmed")
                : t("applications.statusAccepted")}
          </Text>
        </View>
      </View>

      {job.description && (
        <Text
          style={[
            styles.acceptedJobDescription,
            { color: isDark ? "#B8A88A" : "#6B6355" },
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
                color={isDark ? "#9A8E7A" : "#8A7B68"}
              />
              <Text
                style={[
                  styles.acceptedJobMetaText,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                    ? "rgba(201, 150, 63, 0.2)"
                    : "rgba(201, 150, 63, 0.1)",
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
              color={isDark ? "#9A8E7A" : "#8A7B68"}
            />
            <Text
              style={[
                styles.acceptedJobDateText,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                color={isDark ? "#9A8E7A" : "#8A7B68"}
              />
              <Text
                style={[
                  styles.acceptedJobDateText,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
  const [paidToBank, setPaidToBank] = useState<number>(0);
  const [hasConnectedAccount, setHasConnectedAccount] = useState<boolean>(true);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [emailVerified, setEmailVerified] = useState<boolean>(true);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [idVerified, setIdVerified] = useState<boolean>(false);
  const [backgroundVerified, setBackgroundVerified] = useState<boolean>(false);
  const [hasProfilePhoto, setHasProfilePhoto] = useState<boolean>(false);
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
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    fetchJobs();
    fetchActiveBooking();
    fetchBalance();
    fetchProfile();
    fetchAppliedJobs();
    fetchAcceptedJobs();
    fetchUnreadMessages();
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
            .filter(Boolean) as string[],
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
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const jobIdsSeen = new Set<string>();
      const results: any[] = [];

      // 1. Fetch accepted applications
      const appRes = await fetch(
        `${base}/applications/me?status=ACCEPTED&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (appRes.ok) {
        const data = await appRes.json();
        const applications = Array.isArray(data)
          ? data
          : data.applications || [];
        for (const app of applications) {
          if (!app.job) continue;
          if (
            app.completedAt &&
            new Date(app.completedAt).getTime() < oneDayAgo
          )
            continue;
          results.push({ ...app, _source: "application" });
          if (app.job?.id) jobIdsSeen.add(app.job.id);
        }
      }

      // 2. Fetch active bookings (CONFIRMED + IN_PROGRESS) to cover direct bookings
      for (const status of ["IN_PROGRESS", "CONFIRMED"]) {
        try {
          const bookingRes = await fetch(
            `${base}/bookings/seeker/me?status=${status}&pageSize=10`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (bookingRes.ok) {
            const bookings = await bookingRes.json();
            const bookingList = Array.isArray(bookings) ? bookings : [];
            for (const booking of bookingList) {
              // Skip if we already have this job from applications
              if (booking.jobId && jobIdsSeen.has(booking.jobId)) continue;
              if (booking.jobId) jobIdsSeen.add(booking.jobId);
              // Normalize booking to look like an application for the card
              results.push({
                id: booking.applicationId || booking.id,
                status: booking.status,
                job: booking.job || {
                  title: booking.title || "Direct Booking",
                },
                completedAt: booking.completedAt,
                _source: "booking",
                _bookingId: booking.id,
                _bookingStatus: booking.status,
              });
            }
          }
        } catch {}
      }

      setAcceptedJobs(results);
    } catch (err) {
      console.log("Error fetching accepted jobs:", err);
    } finally {
      setLoadingAcceptedJobs(false);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      // Decode current user ID from token
      let myUserId: string | null = null;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        myUserId = payload.sub || payload.id;
      } catch {}
      if (!myUserId) return;

      const base = getApiBase();
      const res = await fetch(`${base}/chat/conversations?pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const conversations = Array.isArray(data)
          ? data
          : data.conversations || [];
        let count = 0;
        for (const conv of conversations) {
          const lastMsg = conv.lastMessage;
          if (
            lastMsg &&
            lastMsg.senderUserId &&
            lastMsg.senderUserId !== myUserId
          ) {
            count++;
          }
        }
        setUnreadMessageCount(count);
      }
    } catch (err) {
      console.log("Error fetching unread messages:", err);
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
      !backgroundVerified ||
      !hasProfilePhoto
    ) {
      const missingVerifications = [];
      if (!emailVerified) missingVerifications.push(t("settings.email"));
      if (!phoneVerified) missingVerifications.push(t("settings.phone"));
      if (!idVerified) missingVerifications.push(t("kyc.idType"));
      if (!backgroundVerified)
        missingVerifications.push(t("kyc.criminalRecordCertificate"));
      if (!hasProfilePhoto)
        missingVerifications.push(t("settings.profilePhoto"));

      Alert.alert(
        t("home.verificationRequired"),
        t("applications.completeVerificationsBeforeApplying", {
          missing: missingVerifications.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("applications.goToSettings"),
            onPress: () => router.push("/(tabs)/menu" as any),
          },
        ],
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
      !backgroundVerified ||
      !hasProfilePhoto
    ) {
      const missingVerifications = [];
      if (!emailVerified) missingVerifications.push(t("settings.email"));
      if (!phoneVerified) missingVerifications.push(t("settings.phone"));
      if (!idVerified) missingVerifications.push(t("kyc.idType"));
      if (!backgroundVerified)
        missingVerifications.push(t("kyc.criminalRecordCertificate"));
      if (!hasProfilePhoto)
        missingVerifications.push(t("settings.profilePhoto"));

      Alert.alert(
        t("home.verificationRequired"),
        t("applications.completeVerificationsBeforeApplying", {
          missing: missingVerifications.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("applications.goToSettings"),
            onPress: () => router.push("/(tabs)/menu" as any),
          },
        ],
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
        body: JSON.stringify({}),
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
            t("jobs.alreadyAppliedMessage"),
          );
        } else {
          Alert.alert(
            t("common.error"),
            error.message || t("jobs.failedToSubmit"),
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
          !!(u?.isIdVerified || u?.idVerificationStatus === "VERIFIED"),
        );
        setBackgroundVerified(
          !!(
            u?.isBackgroundVerified || u?.backgroundCheckStatus === "APPROVED"
          ),
        );
        const p = data.profile;
        setHasProfilePhoto(!!(p?.avatarUrl || u?.avatar));
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
      fetchUnreadMessages();
    }, []),
  );

  const fetchBalance = async () => {
    try {
      setLoadingBalance(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setBalance(0);
        setPaidToBank(0);
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
        const paidInEuros = (data.paidToBank || 0) / 100;
        setPaidToBank(paidInEuros);
        setHasConnectedAccount(data.hasConnectedAccount !== false);
      } else {
        setBalance(0);
        setPaidToBank(0);
      }
    } catch (err: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (err?.message && !err.message.includes("Network request failed")) {
        console.log("Error fetching balance", err);
      }
      setBalance(0);
      setPaidToBank(0);
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
    textSecondary: { color: isDark ? "rgba(240,232,213,0.5)" : "#6B6355" },
    iconColor: isDark ? "#E8B86D" : "#B8822A",
    cardBg: {
      backgroundColor: isDark
        ? "rgba(12, 22, 42, 0.85)"
        : "rgba(255, 250, 240, 0.92)",
      borderColor: isDark ? "rgba(201,150,63,0.2)" : "rgba(184,130,42,0.15)",
    },
    actionBtn: {
      backgroundColor: isDark
        ? "rgba(12, 22, 42, 0.85)"
        : "rgba(255, 250, 240, 0.92)",
      borderColor: isDark ? "rgba(201,150,63,0.3)" : "#D4A24E",
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
            backgroundColor: isDark ? "rgba(12, 22, 42, 0.75)" : "#FFFAF0",
            borderColor: isDark
              ? "rgba(201,150,63,0.12)"
              : "rgba(184,130,42,0.2)",
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
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                  { backgroundColor: isDark ? "#22D3EE" : "#06B6D4" },
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
                { color: isDark ? "#B8A88A" : "#6B6355" },
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
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                        ? "rgba(201, 150, 63, 0.2)"
                        : "rgba(201, 150, 63, 0.1)",
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
                backgroundColor: isDark ? "#22D3EE" : "#06B6D4",
                opacity: isApplying ? 0.6 : 1,
              },
            ]}
            onPress={() => handleQuickApply(item.id)}
            disabled={isApplying}
          >
            {isApplying ? (
              <ActivityIndicator color="#FFFAF0" size="small" />
            ) : (
              <>
                <Feather name="send" size={14} color="#FFFAF0" />
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
          {...(Platform.OS === "android"
            ? {
                removeClippedSubviews: true,
                overScrollMode: "never" as const,
                nestedScrollEnabled: true,
              }
            : {})}
        >
          <EmailVerificationBanner
            emailVerified={emailVerified}
            onVerify={() => fetchProfile()}
          />
          {hasTemporaryPassword && <TemporaryPasswordBanner />}
          <ActionBanner />

          <View style={styles.headerSummary}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 3,
                color: isDark ? "rgba(201,150,63,0.6)" : "rgba(184,130,42,0.5)",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              MISSION CONTROL
            </Text>
            <Text style={[styles.greeting, themeStyles.textPrimary]}>
              {t("home.greeting", { name: userName || "" })}
            </Text>
            <Text style={[styles.balanceLabel, themeStyles.textSecondary]}>
              {t("home.yourAvailableBalance")}
            </Text>
            <Text style={[styles.balanceValue, themeStyles.textPrimary]}>
              €{(balance ?? 0).toFixed(2)}
            </Text>

            <View style={styles.paidToBankRow}>
              <Feather
                name="check-circle"
                size={13}
                color={isDark ? "rgba(76,175,80,0.7)" : "rgba(56,142,60,0.7)"}
              />
              <Text
                style={[
                  styles.paidToBankLabel,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.45)",
                  },
                ]}
              >
                {t("home.paidToBank")}
              </Text>
              <Text
                style={[
                  styles.paidToBankValue,
                  {
                    color: isDark
                      ? "rgba(76,175,80,0.8)"
                      : "rgba(56,142,60,0.8)",
                  },
                ]}
              >
                €{(paidToBank ?? 0).toFixed(2)}
              </Text>
            </View>

            {!hasConnectedAccount && (
              <TouchableOpacity
                style={styles.bankWarningRow}
                onPress={() => router.push("/kyc-start" as any)}
                activeOpacity={0.7}
              >
                <Feather name="alert-circle" size={12} color="#E6A817" />
                <Text style={styles.bankWarningText}>
                  {t("home.addBankDetails")}
                </Text>
              </TouchableOpacity>
            )}
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
                <View>
                  <Feather
                    name="message-square"
                    size={22}
                    color={themeStyles.iconColor}
                    style={{ marginBottom: 6 }}
                  />
                  {unreadMessageCount > 0 && (
                    <View style={styles.messageBadge}>
                      <Text style={styles.messageBadgeText}>
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </Text>
                    </View>
                  )}
                </View>
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
                if (!job) return null;

                return (
                  <AcceptedJobCard
                    key={app.id}
                    application={app}
                    job={job}
                    colors={colors}
                    isDark={isDark}
                    t={t}
                    onPress={() => {
                      if (app._source === "booking" && app._bookingId) {
                        router.push(
                          `/tracking?bookingId=${app._bookingId}&role=JOB_SEEKER` as any,
                        );
                      } else {
                        router.push(`/my-application/${app.id}` as any);
                      }
                    }}
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
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
              style={{ width: "100%" }}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "#FFFAF0",
                    maxHeight: "85%",
                  },
                ]}
              >
                <View
                  style={[
                    styles.modalHeader,
                    {
                      borderBottomColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#E8D8B8",
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
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
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
                      color={isDark ? "#9A8E7A" : "#8A7B68"}
                    />
                  </TouchableButton>
                </View>

                <View
                  style={[
                    styles.modalButtons,
                    {
                      borderTopColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#E8D8B8",
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.90)"
                        : "#FFFAF0",
                    },
                  ]}
                >
                  <TouchableButton
                    style={[
                      styles.modalButton,
                      styles.modalButtonCancel,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.10)"
                          : "#F0E8D5",
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#B8A88A",
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
                        backgroundColor: isDark ? "#22D3EE" : "#06B6D4",
                        borderColor: isDark ? "#22D3EE" : "#06B6D4",
                        shadowColor: isDark ? "#22D3EE" : "#06B6D4",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 0,
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
                      <ActivityIndicator color="#FFFAF0" size="small" />
                    ) : (
                      <View style={styles.submitButtonContent}>
                        <Feather name="send" size={18} color="#FFFAF0" />
                        <Text style={styles.modalButtonTextSubmit}>
                          {t("jobs.submitApplication")}
                        </Text>
                      </View>
                    )}
                  </TouchableButton>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
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
  screenTitle: { fontSize: 16, fontWeight: "700" },
  cardTitle: {},
  loading: { padding: 16 },
  greeting: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  balanceLabel: { fontSize: 13, marginTop: 4 },
  balanceValue: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  paidToBankRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 8,
    gap: 6,
  },
  paidToBankLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  paidToBankValue: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  bankWarningRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 6,
    gap: 5,
  },
  bankWarningText: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: "#E6A817",
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
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 0,
    overflow: "hidden",
    minHeight: 48,
  },
  qaIcon: { marginRight: 6 },
  euroIcon: { fontSize: 18, fontWeight: "700", marginRight: 6 },
  qaText: {
    fontWeight: "700",
    fontSize: 12,
    flexShrink: 1,
    textAlign: "center",
    flexWrap: "wrap",
  },
  section: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: {
    fontWeight: "800",
    marginBottom: 12,
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  iconRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  iconBox: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 0,
    overflow: "hidden",
    minHeight: 100,
  },
  iconText: {
    fontWeight: "500",
    fontSize: 10,
    textAlign: "center",
    flexWrap: "wrap",
    lineHeight: 14,
    paddingHorizontal: 2,
    flexShrink: 1,
    width: "100%",
  },
  messageBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "rgba(12, 22, 42, 0.9)",
  },
  messageBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },
  availabilityRow: { marginTop: 0 },
  availabilityBox: {
    width: "100%",
    borderRadius: 4,
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
    elevation: 0,
    overflow: "hidden",
    minHeight: 52,
  },
  availabilityText: {
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1,
    flexWrap: "wrap",
    textAlign: "center",
    lineHeight: 18,
  },
  cardLarge: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 0,
  },
  cardSub: { marginTop: 4, fontSize: 13 },
  buttonPrimary: {
    borderRadius: 4,
    backgroundColor: "#06B6D4",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonLabel: { fontWeight: "700", fontSize: 13 },
  empty: { fontSize: 14 },
  jobCard: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 0,
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
  instantText: { color: "#FFFAF0", fontSize: 10, fontWeight: "700" },
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
  tagText: { fontSize: 12, fontWeight: "700" },
  cta: { color: "#22D3EE", marginTop: 10, fontWeight: "700", fontSize: 13 },
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
    color: "#FFFAF0",
    fontSize: 14,
    fontWeight: "700",
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
    fontWeight: "700",
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
    elevation: 0,
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
    backgroundColor: "rgba(184,130,42,0.06)",
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
    fontWeight: "700",
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
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalTextArea: {
    borderRadius: 4,
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
    borderRadius: 4,
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
    fontWeight: "700",
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
    borderRadius: 4,
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
    fontWeight: "700",
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
    borderRadius: 4,
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
    fontWeight: "700",
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFAF0",
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
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 0,
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
    borderRadius: 4,
    gap: 6,
  },
  acceptedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
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
  acceptedJobTagText: { fontSize: 12, fontWeight: "700" },
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
    fontWeight: "700",
  },
});
