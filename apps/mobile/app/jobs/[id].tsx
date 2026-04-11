import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiBase } from "../../lib/api";
import * as SecureStore from "expo-secure-store";
import { TouchableButton } from "../../components/TouchableButton";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";

// Date and Time Picker Components (from post-job.tsx)
const DatePickerModal = ({
  visible,
  onClose,
  onSelect,
  value,
  colors,
  isDark,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  value: Date | null;
  colors: any;
  isDark: boolean;
  t: (key: string) => string;
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  useEffect(() => {
    if (value) {
      setSelectedYear(value.getFullYear());
      setSelectedMonth(value.getMonth() + 1);
      setSelectedDay(value.getDate());
    } else {
      const now = new Date();
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
      setSelectedDay(now.getDate());
    }
  }, [value, visible]);

  const handleConfirm = () => {
    const date = new Date(selectedYear, selectedMonth - 1, selectedDay);
    // Set time to start of day for comparison
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Block past dates, but allow today and future dates
    if (date < today) {
      Alert.alert(t("jobs.invalidDate"), t("jobs.dateCannotBePast"));
      return;
    }

    onSelect(date);
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("jobs.selectDate")}
            </Text>
            <TouchableButton onPress={onClose}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableButton>
          </View>

          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {t("jobs.year")}
              </Text>
              <ScrollView style={styles.datePickerScroll}>
                {years.map((year) => (
                  <TouchableButton
                    key={year}
                    style={[
                      styles.datePickerOption,
                      {
                        backgroundColor:
                          selectedYear === year
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: selectedYear === year ? 0 : 1,
                        borderColor:
                          selectedYear === year
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color:
                            selectedYear === year ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {year}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {t("jobs.month")}
              </Text>
              <ScrollView style={styles.datePickerScroll}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <TouchableButton
                    key={month}
                    style={[
                      styles.datePickerOption,
                      {
                        backgroundColor:
                          selectedMonth === month
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: selectedMonth === month ? 0 : 1,
                        borderColor:
                          selectedMonth === month
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setSelectedMonth(month)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color:
                            selectedMonth === month ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {new Date(2000, month - 1).toLocaleString("default", {
                        month: "short",
                      })}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {t("jobs.day")}
              </Text>
              <ScrollView style={styles.datePickerScroll}>
                {days.map((day) => (
                  <TouchableButton
                    key={day}
                    style={[
                      styles.datePickerOption,
                      {
                        backgroundColor:
                          selectedDay === day
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: selectedDay === day ? 0 : 1,
                        borderColor:
                          selectedDay === day
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color: selectedDay === day ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableButton
              style={[
                styles.modalButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "#F0E8D5",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(201,150,63,0.2)" : "#B8A88A",
                },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: colors.text, fontWeight: "700" },
                ]}
              >
                {t("common.cancel")}
              </Text>
            </TouchableButton>
            <TouchableButton
              style={[
                styles.modalButton,
                styles.modalButtonPrimary,
                {
                  backgroundColor: isDark ? "#C9963F" : "#B8822A",
                  borderWidth: 1,
                  borderColor: isDark ? "#E8B86D" : "#C9963F",
                  shadowColor: isDark ? "#C9963F" : "#B8822A",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 0,
                },
              ]}
              onPress={handleConfirm}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: "#FFFAF0", fontWeight: "700" },
                ]}
              >
                {t("common.confirm")}
              </Text>
            </TouchableButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const TimePickerModal = ({
  visible,
  onClose,
  onSelect,
  value,
  selectedDate,
  colors,
  isDark,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: Date) => void;
  value: Date | null;
  selectedDate: Date | null;
  colors: any;
  isDark: boolean;
  t: (key: string) => string;
}) => {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  useEffect(() => {
    if (value) {
      setSelectedHour(value.getHours());
      setSelectedMinute(value.getMinutes());
    } else {
      // Default to current time if no value
      const now = new Date();
      setSelectedHour(now.getHours());
      setSelectedMinute(now.getMinutes());
    }
  }, [value, visible]);

  const handleConfirm = () => {
    const time = new Date();
    time.setHours(selectedHour);
    time.setMinutes(selectedMinute);
    time.setSeconds(0);
    time.setMilliseconds(0);

    // If selected date is today, ensure time is in the future
    if (selectedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateOnly = new Date(selectedDate);
      selectedDateOnly.setHours(0, 0, 0, 0);

      // Check if selected date is today
      if (selectedDateOnly.getTime() === today.getTime()) {
        const now = new Date();
        const selectedDateTime = new Date(selectedDate);
        selectedDateTime.setHours(selectedHour, selectedMinute, 0, 0);

        if (selectedDateTime <= now) {
          Alert.alert(t("jobs.invalidTime"), t("jobs.timeMustBeFuture"));
          return;
        }
      }
    }

    onSelect(time);
    onClose();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("jobs.selectTime")}
            </Text>
            <TouchableButton onPress={onClose}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableButton>
          </View>

          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {t("jobs.hour")}
              </Text>
              <ScrollView style={styles.datePickerScroll}>
                {hours.map((hour) => (
                  <TouchableButton
                    key={hour}
                    style={[
                      styles.datePickerOption,
                      {
                        backgroundColor:
                          selectedHour === hour
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: selectedHour === hour ? 0 : 1,
                        borderColor:
                          selectedHour === hour
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color:
                            selectedHour === hour ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {hour.toString().padStart(2, "0")}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>

            <View style={styles.timePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {t("jobs.minute")}
              </Text>
              <ScrollView style={styles.datePickerScroll}>
                {minutes.map((minute) => (
                  <TouchableButton
                    key={minute}
                    style={[
                      styles.datePickerOption,
                      {
                        backgroundColor:
                          selectedMinute === minute
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: selectedMinute === minute ? 0 : 1,
                        borderColor:
                          selectedMinute === minute
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.15)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color:
                            selectedMinute === minute ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableButton
              style={[
                styles.modalButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "#F0E8D5",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(201,150,63,0.2)" : "#B8A88A",
                },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: colors.text, fontWeight: "700" },
                ]}
              >
                {t("common.cancel")}
              </Text>
            </TouchableButton>
            <TouchableButton
              style={[
                styles.modalButton,
                styles.modalButtonPrimary,
                {
                  backgroundColor: isDark ? "#C9963F" : "#B8822A",
                  borderWidth: 1,
                  borderColor: isDark ? "#E8B86D" : "#C9963F",
                  shadowColor: isDark ? "#C9963F" : "#B8822A",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 0,
                },
              ]}
              onPress={handleConfirm}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: "#FFFAF0", fontWeight: "700" },
                ]}
              >
                {t("common.confirm")}
              </Text>
            </TouchableButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Lightweight JWT payload decode
function decodeJwtPayload(
  token: string,
): { sub?: string; email?: string; role?: string; userId?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
  urgency: string;
  isInstantBook: boolean;
  createdAt: string;
  employerId?: string;
  // Payment information
  salaryMin?: number;
  salaryMax?: number;
  paymentType?: string;
  rateAmount?: number;
  currency?: string;
  category?: {
    id: string;
    name: string;
  };
  company?: {
    id: string;
    name: string;
  };
  requirements?: string[];
  responsibilities?: string[];
  startDate?: string;
}

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
  return key ? t(`jobs.category.${key}`) : categoryName;
};

export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const jobId = params.id as string;
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isEmployer, setIsEmployer] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job>>({});
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [otherReasonText, setOtherReasonText] = useState("");

  // Edit form states
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editWorkMode, setEditWorkMode] = useState<
    "ON_SITE" | "REMOTE" | "HYBRID"
  >("ON_SITE");
  const [editUrgency, setEditUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [editRequirements, setEditRequirements] = useState<string[]>([]);
  const [editResponsibilities, setEditResponsibilities] = useState<string[]>(
    [],
  );
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editStartTime, setEditStartTime] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Verification states for service providers
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [idVerified, setIdVerified] = useState<boolean>(false);
  const [backgroundVerified, setBackgroundVerified] = useState<boolean>(false);
  const [hasProfilePhoto, setHasProfilePhoto] = useState<boolean>(false);

  const JOB_CATEGORIES = [
    t("jobs.categories.cleaning"),
    t("jobs.categories.plumbing"),
    t("jobs.categories.gardening"),
    t("jobs.categories.electrical"),
    t("jobs.categories.carpentry"),
    t("jobs.categories.painting"),
    t("jobs.categories.moving"),
    t("jobs.categories.generalLabor"),
    t("jobs.categories.delivery"),
    t("jobs.categories.other"),
  ];

  useEffect(() => {
    if (jobId) {
      fetchJob();
      fetchUserVerification();
    }
  }, [jobId]);

  const fetchUserVerification = async () => {
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
      }
    } catch (err) {
      console.log("Error fetching verification status:", err);
    }
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      // Decode token to get user role
      const payload = decodeJwtPayload(token);
      if (payload) {
        const role = String(payload?.role || "").toUpperCase();
        setUserRole(role);
        setIsEmployer(role === "EMPLOYER");
        setIsServiceProvider(role === "JOB_SEEKER" || role === "USER");
        const userId = payload.sub || payload.userId || (payload as any).id;
        if (userId) setCurrentUserId(userId);
      }

      const base = getApiBase();
      const res = await fetch(`${base}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setJob(data);

        // Initialize edit form with job data
        setEditTitle(data.title || "");
        setEditDescription(data.description || "");
        setEditCategory(data.category?.name || "");
        setEditLocation(data.location || "");
        setEditCity(data.city || "");
        setEditCountry(data.country || "");
        setEditWorkMode(data.workMode || "ON_SITE");
        setEditUrgency(data.urgency || "NORMAL");
        setEditRequirements(data.requirements || []);
        setEditResponsibilities(data.responsibilities || []);
        // Initialize start date and time
        if (data.startDate) {
          const startDateObj = new Date(data.startDate);
          setEditStartDate(startDateObj);
          setEditStartTime(startDateObj);
        }
      } else if (res.status === 404) {
        // Job not found - check if user has an application for this job
        try {
          const appRes = await fetch(`${base}/applications/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (appRes.ok) {
            const appData = await appRes.json();
            const applications = Array.isArray(appData)
              ? appData
              : appData.applications || [];
            const application = applications.find(
              (app: any) => app.job?.id === jobId || app.jobId === jobId,
            );

            if (application?.id) {
              // User has an application for this job, redirect to application details
              router.replace(`/my-application/${application.id}` as any);
              return;
            }
          }
        } catch (err) {
          console.log("Error checking for application:", err);
        }

        // No application found, show error
        Alert.alert(t("common.error"), t("jobs.jobNotFound"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t("common.error"), t("jobs.failedToLoadDetails"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToLoadDetails"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Check application status when job is loaded and user is service provider
  useEffect(() => {
    if (!isServiceProvider || !jobId) {
      setHasApplied(false);
      return;
    }

    let cancelled = false;
    const checkApplicationStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token || cancelled) {
          if (!cancelled) setHasApplied(false);
          return;
        }

        const base = getApiBase();
        const res = await fetch(`${base}/applications/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          // Handle different response formats
          const applications = Array.isArray(data)
            ? data
            : data.applications || data.items || data.data || [];

          // Check if any application matches this job
          // Try multiple ways to match the job ID
          const matchingApp = applications.find((app: any) => {
            const appJobId =
              app.job?.id || app.jobId || app.job?._id || app.jobId;
            // Compare as strings to handle ObjectId vs string mismatches
            return String(appJobId) === String(jobId);
          });

          if (!cancelled) {
            setHasApplied(!!matchingApp);
            setApplicationId(matchingApp?.id || null);
            console.log(
              `Application status checked for job ${jobId}: ${matchingApp ? "Applied" : "Not Applied"}`,
            );
          }
        } else {
          // If request fails, don't assume applied status
          if (!cancelled) {
            console.log(`Failed to check application status: ${res.status}`);
            setHasApplied(false);
          }
        }
      } catch (err) {
        // Silently fail - not critical, but log for debugging
        if (!cancelled) {
          console.log("Error checking application status:", err);
          setHasApplied(false);
        }
      }
    };

    // Check immediately
    checkApplicationStatus();

    return () => {
      cancelled = true;
    };
  }, [jobId, isServiceProvider, job?.id]);

  const handleUpdateStatus = async (status: string) => {
    try {
      setProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("jobs.statusUpdatedSuccessfully"), [
          { text: t("common.ok"), onPress: () => fetchJob() },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("jobs.failedToUpdateStatus"),
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveJob = async () => {
    if (!editTitle.trim() || !editDescription.trim()) {
      Alert.alert(t("common.required"), t("jobs.titleDescriptionRequired"));
      return;
    }

    if (!editCategory) {
      Alert.alert(t("common.required"), t("jobs.selectCategory"));
      return;
    }

    if (editCategory === "Other" && !editCustomCategory.trim()) {
      Alert.alert(t("common.required"), t("jobs.specifyCustomCategory"));
      return;
    }

    if (!editLocation || !editCity || !editCountry) {
      Alert.alert(t("common.required"), t("jobs.provideLocationInfo"));
      return;
    }

    try {
      setProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      // Get coordinates
      let lat = 0;
      let lng = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const locationData = await Location.geocodeAsync(
            `${editLocation}, ${editCity}, ${editCountry}`,
          );
          if (locationData && locationData.length > 0) {
            lat = locationData[0].latitude;
            lng = locationData[0].longitude;
          }
        }
      } catch (err) {
        console.log("Error getting coordinates:", err);
      }

      const base = getApiBase();

      const updateData: any = {
        title: editTitle,
        description: editDescription,
        categoryName:
          editCategory === "Other" ? editCustomCategory : editCategory,
        workMode: editWorkMode,
        urgency: editUrgency,
        location: editLocation,
        city: editCity,
        country: editCountry,
        lat,
        lng,
        requirements: editRequirements.filter((r) => r.trim()),
        responsibilities: editResponsibilities.filter((r) => r.trim()),
      };

      // Combine date and time for startDate
      if (editStartDate && editStartTime) {
        const combinedDate = new Date(editStartDate);
        combinedDate.setHours(editStartTime.getHours());
        combinedDate.setMinutes(editStartTime.getMinutes());
        combinedDate.setSeconds(0);
        combinedDate.setMilliseconds(0);
        updateData.startDate = combinedDate.toISOString();
      } else if (editStartDate) {
        updateData.startDate = editStartDate.toISOString();
      }

      const res = await fetch(`${base}/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("jobs.jobUpdatedSuccessfully"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setIsEditing(false);
              fetchJob();
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("jobs.failedToUpdateJob"),
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setProcessing(false);
    }
  };

  const addRequirement = () => {
    setEditRequirements([...editRequirements, ""]);
  };

  const removeRequirement = (index: number) => {
    setEditRequirements(editRequirements.filter((_, i) => i !== index));
  };

  const updateRequirement = (index: number, value: string) => {
    const newRequirements = [...editRequirements];
    newRequirements[index] = value;
    setEditRequirements(newRequirements);
  };

  const addResponsibility = () => {
    setEditResponsibilities([...editResponsibilities, ""]);
  };

  const removeResponsibility = (index: number) => {
    setEditResponsibilities(editResponsibilities.filter((_, i) => i !== index));
  };

  const updateResponsibility = (index: number, value: string) => {
    const newResponsibilities = [...editResponsibilities];
    newResponsibilities[index] = value;
    setEditResponsibilities(newResponsibilities);
  };

  const handleApply = async () => {
    if (!jobId) return;

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
      setApplying(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Submit application
      const res = await fetch(`${base}/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        setHasApplied(true);
        setShowApplyModal(false);
        setCoverLetter("");
        Alert.alert(t("common.success"), t("jobs.applicationSubmitted"));
      } else {
        const error = await res
          .json()
          .catch(() => ({ message: t("jobs.failedToSubmit") }));
        if (res.status === 409) {
          // Already applied
          setHasApplied(true);
          setShowApplyModal(false);
          setCoverLetter("");
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
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!applicationId || !withdrawReason.trim()) {
      Alert.alert(t("common.error"), t("jobs.provideWithdrawalReason"));
      return;
    }

    try {
      setWithdrawing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: withdrawReason.trim() }),
        },
      );

      if (res.ok) {
        setHasApplied(false);
        setApplicationId(null);
        setShowWithdrawModal(false);
        setWithdrawReason("");
        Alert.alert(t("common.success"), t("jobs.applicationWithdrawn"));
        // Refresh application status
        const checkRes = await fetch(`${base}/applications/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (checkRes.ok) {
          const data = await checkRes.json();
          const applications = Array.isArray(data)
            ? data
            : data.applications || [];
          const matchingApp = applications.find((app: any) => {
            const appJobId = app.job?.id || app.jobId;
            return String(appJobId) === String(jobId);
          });
          setHasApplied(!!matchingApp);
          setApplicationId(matchingApp?.id || null);
        }
      } else {
        const error = await res
          .json()
          .catch(() => ({ message: t("jobs.failedToWithdraw") }));
        Alert.alert(
          t("common.error"),
          error.message || t("jobs.failedToWithdraw"),
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobId || !deleteReason.trim()) {
      Alert.alert(t("common.error"), t("jobs.selectDeleteReason"));
      return;
    }

    // If "Other" is selected, require the reason text
    if (deleteReason === "Other" && !otherReasonText.trim()) {
      Alert.alert(t("common.error"), t("jobs.specifyDeleteReason"));
      return;
    }

    try {
      setDeleting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      // Include other reason text if "Other" is selected
      let reasonText: string;
      if (deleteReason === "Other") {
        reasonText = `Other: ${otherReasonText.trim()}`;
      } else {
        // Map the constant values back to translated labels for the backend
        const reasonMap: Record<string, string> = {
          NO_LONGER_NEEDED: t("jobs.deleteReasonNoLongerNeeded"),
          FOUND_CANDIDATE: t("jobs.deleteReasonFoundCandidate"),
          FULFILLED: t("jobs.deleteReasonFulfilled"),
          REQUIREMENTS_CHANGED: t("jobs.deleteReasonRequirementsChanged"),
        };
        reasonText = reasonMap[deleteReason] || deleteReason;
      }

      const res = await fetch(`${base}/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reasonText }),
      });

      if (res.ok) {
        const data = await res.json();
        Alert.alert(
          t("common.success"),
          t("jobs.jobDeletedSuccessfully", {
            count: data.notifiedApplicants || 0,
          }),
          [
            {
              text: t("common.ok"),
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        const error = await res
          .json()
          .catch(() => ({ message: t("jobs.failedToDeleteJob") }));
        Alert.alert(
          t("common.error"),
          error.message || t("jobs.failedToDeleteJob"),
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setDeleting(false);
    }
  };

  // Show edit form if editing
  if (isEditing && job) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableButton
              style={[
                styles.backBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.06)",
                },
              ]}
              onPress={() => setIsEditing(false)}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableButton>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("jobs.editJobPost")}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          >
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Job Title */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.jobTitle")} <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                placeholder={t("jobs.jobTitlePlaceholder")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                value={editTitle}
                onChangeText={setEditTitle}
              />

              {/* Category */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.categoryLabel")}{" "}
                <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <TouchableButton
                style={[
                  styles.input,
                  styles.categoryInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#FFFAF0",
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: editCategory
                        ? colors.text
                        : isDark
                          ? "#9A8E7A"
                          : "#9A8E7A",
                    },
                  ]}
                >
                  {editCategory || t("jobs.selectCategory")}
                </Text>
                <Feather
                  name="chevron-down"
                  size={20}
                  color={isDark ? "#9A8E7A" : "#9A8E7A"}
                />
              </TouchableButton>

              {editCategory === "Other" && (
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#FFFAF0",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#E8D8B8",
                    },
                  ]}
                  placeholder={t("jobs.enterCustomCategory")}
                  placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  value={editCustomCategory}
                  onChangeText={setEditCustomCategory}
                />
              )}

              {/* Description */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.description")}{" "}
                <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.65)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                placeholder={t("jobs.describeTaskDetail")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                multiline
                numberOfLines={5}
                value={editDescription}
                onChangeText={setEditDescription}
                textAlignVertical="top"
              />

              {/* Work Mode */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.workMode")}
              </Text>
              <View style={styles.optionRow}>
                {(["ON_SITE", "REMOTE", "HYBRID"] as const).map((mode) => (
                  <TouchableButton
                    key={mode}
                    style={[
                      styles.optionButton,
                      editWorkMode === mode && styles.optionButtonActive,
                      {
                        backgroundColor:
                          editWorkMode === mode
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "transparent"
                              : "rgba(184,130,42,0.06)",
                        borderColor:
                          editWorkMode === mode
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.25)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setEditWorkMode(mode)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color:
                            editWorkMode === mode ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {mode === "ON_SITE"
                        ? t("jobs.onSite")
                        : mode === "REMOTE"
                          ? t("jobs.remote")
                          : t("jobs.hybrid")}
                    </Text>
                  </TouchableButton>
                ))}
              </View>

              {/* Priority */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.priority")}
              </Text>
              <View style={styles.optionRow}>
                {(["NORMAL", "URGENT"] as const).map((urg) => (
                  <TouchableButton
                    key={urg}
                    style={[
                      styles.optionButton,
                      editUrgency === urg && styles.optionButtonActive,
                      {
                        backgroundColor:
                          editUrgency === urg
                            ? urg === "URGENT"
                              ? "#dc2626"
                              : isDark
                                ? "#C9963F"
                                : colors.tint
                            : isDark
                              ? "transparent"
                              : "rgba(184,130,42,0.06)",
                        borderColor:
                          editUrgency === urg
                            ? urg === "URGENT"
                              ? "#ef4444"
                              : isDark
                                ? "#C9963F"
                                : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.25)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => setEditUrgency(urg)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: editUrgency === urg ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {urg === "NORMAL" ? t("jobs.normal") : t("jobs.urgent")}
                    </Text>
                  </TouchableButton>
                ))}
              </View>

              {/* Location */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.location")} <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                placeholder={t("jobs.streetAddress")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                value={editLocation}
                onChangeText={setEditLocation}
              />

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                placeholder={t("jobs.city")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                value={editCity}
                onChangeText={setEditCity}
              />

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#FFFAF0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#E8D8B8",
                  },
                ]}
                placeholder={t("jobs.country")}
                placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                value={editCountry}
                onChangeText={setEditCountry}
              />

              {/* Requirements */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.requirements")}
              </Text>
              {editRequirements.map((req, index) => (
                <View key={index} style={styles.listItemInput}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#E8D8B8",
                      },
                    ]}
                    value={req}
                    onChangeText={(text) => updateRequirement(index, text)}
                    placeholder={t("jobs.requirementPlaceholder", {
                      number: index + 1,
                    })}
                    placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  />
                  <TouchableOpacity
                    onPress={() => removeRequirement(index)}
                    style={styles.removeButton}
                  >
                    <Feather name="trash-2" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableButton
                onPress={addRequirement}
                style={[
                  styles.addButton,
                  {
                    borderColor: colors.tint,
                    backgroundColor: colors.tint + "20",
                  },
                ]}
              >
                <Feather name="plus" size={16} color={colors.tint} />
                <Text style={[styles.addButtonText, { color: colors.tint }]}>
                  {t("jobs.addRequirement")}
                </Text>
              </TouchableButton>

              {/* Responsibilities */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.responsibilities")}
              </Text>
              {editResponsibilities.map((resp, index) => (
                <View key={index} style={styles.listItemInput}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#E8D8B8",
                      },
                    ]}
                    value={resp}
                    onChangeText={(text) => updateResponsibility(index, text)}
                    placeholder={t("jobs.responsibilityPlaceholder", {
                      number: index + 1,
                    })}
                    placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  />
                  <TouchableOpacity
                    onPress={() => removeResponsibility(index)}
                    style={styles.removeButton}
                  >
                    <Feather name="trash-2" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableButton
                onPress={addResponsibility}
                style={[
                  styles.addButton,
                  {
                    borderColor: colors.tint,
                    backgroundColor: colors.tint + "20",
                  },
                ]}
              >
                <Feather name="plus" size={16} color={colors.tint} />
                <Text style={[styles.addButtonText, { color: colors.tint }]}>
                  {t("jobs.addResponsibility")}
                </Text>
              </TouchableButton>

              {/* Start Date & Time */}
              <Text style={[styles.label, { color: colors.text }]}>
                {t("jobs.startDateAndTime")}
              </Text>
              <View style={styles.paymentRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={[
                      styles.modalSubLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("jobs.date")}
                  </Text>
                  <TouchableButton
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#FFFAF0",
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#E8D8B8",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      },
                    ]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="calendar" size={16} color={colors.tint} />
                      <Text
                        style={{
                          color: editStartDate
                            ? colors.text
                            : isDark
                              ? "#9A8E7A"
                              : "#9A8E7A",
                        }}
                      >
                        {editStartDate
                          ? editStartDate.toLocaleDateString()
                          : t("jobs.selectDate")}
                      </Text>
                    </View>
                  </TouchableButton>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.modalSubLabel,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("jobs.time")}
                  </Text>
                  <TouchableButton
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#FFFAF0",
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#E8D8B8",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      },
                    ]}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="clock" size={16} color={colors.tint} />
                      <Text
                        style={{
                          color: editStartTime
                            ? colors.text
                            : isDark
                              ? "#9A8E7A"
                              : "#9A8E7A",
                        }}
                      >
                        {editStartTime
                          ? editStartTime.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : t("jobs.selectTime")}
                      </Text>
                    </View>
                  </TouchableButton>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableButton
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: isDark ? "#C9963F" : colors.tint,
                    borderColor: isDark ? "#C9963F" : colors.tint,
                    shadowColor: isDark ? "#C9963F" : colors.tint,
                  },
                  processing && styles.submitBtnDisabled,
                ]}
                onPress={handleSaveJob}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFFAF0" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {t("jobs.saveChanges")}
                  </Text>
                )}
              </TouchableButton>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Date Picker Modal */}
        <DatePickerModal
          visible={showStartDatePicker}
          onClose={() => setShowStartDatePicker(false)}
          onSelect={(date) => setEditStartDate(date)}
          value={editStartDate}
          colors={colors}
          isDark={isDark}
          t={t}
        />

        {/* Time Picker Modal */}
        <TimePickerModal
          visible={showStartTimePicker}
          onClose={() => setShowStartTimePicker(false)}
          onSelect={(time) => setEditStartTime(time)}
          value={editStartTime}
          selectedDate={editStartDate}
          colors={colors}
          isDark={isDark}
          t={t}
        />

        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalOverlay}>
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
                  {t("jobs.selectCategory")}
                </Text>
                <TouchableButton onPress={() => setShowCategoryModal(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>
              <ScrollView>
                {JOB_CATEGORIES.map((cat) => (
                  <TouchableButton
                    key={cat}
                    style={[
                      styles.categoryOption,
                      editCategory === cat && styles.categoryOptionSelected,
                      {
                        backgroundColor:
                          editCategory === cat
                            ? colors.tint
                            : isDark
                              ? "rgba(255,250,240,0.06)"
                              : "rgba(184,130,42,0.06)",
                      },
                    ]}
                    onPress={() => {
                      setEditCategory(cat);
                      setShowCategoryModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color: editCategory === cat ? "#FFFAF0" : colors.text,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableButton>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </GradientBackground>
    );
  }

  if (loading) {
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
              Job Details
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading job details...
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!job) {
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
              Job Details
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Job not found
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "#22c55e";
      case "CLOSED":
        return "#8A7B68";
      case "DRAFT":
        return "#f59e0b";
      default:
        return "#8A7B68";
    }
  };

  const getStatusLabel = (status: string) => {
    if (!status) return "";
    const statusKey = status.toLowerCase();
    return t(`jobs.status.${statusKey}`) || status;
  };

  const getUrgencyLabel = (urgency: string) => {
    if (!urgency) return "";
    const urgencyKey = urgency.toLowerCase();
    return t(`jobs.urgency.${urgencyKey}`) || urgency;
  };

  const getTypeLabel = (type: string | undefined) => {
    if (!type) return "";
    const typeKey = type.toLowerCase().replace(/_/g, "");
    return t(`jobs.type.${typeKey}`) || type.replace("_", " ");
  };

  const getWorkModeLabel = (workMode: string | undefined) => {
    if (!workMode) return "";
    const modeKey = workMode.toLowerCase().replace(/_/g, "");
    return t(`jobs.workModeOptions.${modeKey}`) || workMode.replace("_", " ");
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "URGENT":
        return "#ef4444";
      case "HIGH":
        return "#f59e0b";
      case "NORMAL":
        return "#C9963F";
      case "LOW":
        return "#8A7B68";
      default:
        return "#8A7B68";
    }
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
            Job Details
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "android" ? 40 : 20,
          }}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={Platform.OS === "android"}
          bounces={Platform.OS === "ios"}
        >
          {/* Job Header Card */}
          <View
            style={[
              styles.card,
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
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitle, { color: colors.text }]}>
                  {job.title}
                </Text>
                {job.company?.name && (
                  <Text
                    style={[
                      styles.companyName,
                      { color: isDark ? "#B8A88A" : "#8A7B68" },
                    ]}
                  >
                    {job.company.name}
                  </Text>
                )}
                {job.category && (
                  <Text
                    style={[
                      styles.categoryName,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {translateCategoryName(job.category.name, t)}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor(job.status) + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(job.status) },
                  ]}
                >
                  {getStatusLabel(job.status)}
                </Text>
              </View>
            </View>

            {job.isInstantBook && (
              <View
                style={[
                  styles.instantBadge,
                  { backgroundColor: colors.tint + "20" },
                ]}
              >
                <Feather name="zap" size={14} color={colors.tint} />
                <Text style={[styles.instantText, { color: colors.tint }]}>
                  {t("jobs.instantBookAvailable")}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Feather
                name="map-pin"
                size={16}
                color={isDark ? "#9A8E7A" : "#8A7B68"}
              />
              <Text
                style={[
                  styles.locationText,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {[job.location, job.city, job.country]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather
                  name="briefcase"
                  size={14}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {getTypeLabel(job.type)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather
                  name="home"
                  size={14}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: isDark ? "#9A8E7A" : "#8A7B68" },
                  ]}
                >
                  {getWorkModeLabel(job.workMode)}
                </Text>
              </View>
              {job.urgency && (
                <View
                  style={[
                    styles.urgencyBadge,
                    {
                      backgroundColor: getUrgencyColor(job.urgency) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.urgencyText,
                      { color: getUrgencyColor(job.urgency) },
                    ]}
                  >
                    {getUrgencyLabel(job.urgency)}
                  </Text>
                </View>
              )}
            </View>

            {/* Payment / Offered Rate */}
            {job.rateAmount != null && job.rateAmount > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.15)",
                }}
              >
                <Feather
                  name="dollar-sign"
                  size={16}
                  color={isDark ? "#C9963F" : "#B8822A"}
                />
                <Text
                  style={{
                    marginLeft: 8,
                    fontSize: 15,
                    fontWeight: "600",
                    color: isDark ? "#C9963F" : "#B8822A",
                  }}
                >
                  {t("jobs.offeredRate")}: {job.currency || "EUR"}{" "}
                  {(job.rateAmount / 100).toFixed(2)} /{" "}
                  {t(
                    `jobs.paymentType.${(job.paymentType || "HOURLY").toLowerCase()}`,
                  )}
                </Text>
              </View>
            )}
          </View>

          {/* Description Card */}
          <View
            style={[
              styles.card,
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("jobs.description")}
            </Text>
            <Text
              style={[
                styles.descriptionText,
                { color: isDark ? "#B8A88A" : "#6B6355" },
              ]}
            >
              {job.description}
            </Text>
          </View>

          {/* Requirements Card */}
          {job.requirements && job.requirements.length > 0 && (
            <View
              style={[
                styles.card,
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Requirements
              </Text>
              {job.requirements.map((req, index) => (
                <View key={index} style={styles.listItem}>
                  <Text
                    style={[
                      styles.bullet,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    •
                  </Text>
                  <Text
                    style={[
                      styles.listText,
                      { color: isDark ? "#B8A88A" : "#6B6355" },
                    ]}
                  >
                    {req}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Responsibilities Card */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <View
              style={[
                styles.card,
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Responsibilities
              </Text>
              {job.responsibilities.map((resp, index) => (
                <View key={index} style={styles.listItem}>
                  <Text
                    style={[
                      styles.bullet,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    •
                  </Text>
                  <Text
                    style={[
                      styles.listText,
                      { color: isDark ? "#B8A88A" : "#6B6355" },
                    ]}
                  >
                    {resp}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Posted Date */}
          <View
            style={[
              styles.card,
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
            <View style={styles.infoRow}>
              <Feather
                name="calendar"
                size={16}
                color={isDark ? "#9A8E7A" : "#8A7B68"}
              />
              <Text
                style={[
                  styles.dateText,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
                ]}
              >
                {t("jobs.posted")}:{" "}
                {new Date(job.createdAt).toLocaleDateString(
                  language === "pt" ? "pt-PT" : "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </Text>
            </View>
          </View>

          {/* Apply Button (for Service Providers) */}
          {isServiceProvider && job.status === "ACTIVE" && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "rgba(255,250,240,0.92)",
                  borderColor: hasApplied ? "#22c55e" : colors.tint + "40",
                  borderWidth: 2,
                },
              ]}
            >
              {hasApplied ? (
                <View>
                  <View style={styles.appliedContainer}>
                    <Feather name="check-circle" size={24} color="#22c55e" />
                    <Text style={[styles.appliedText, { color: "#22c55e" }]}>
                      {t("jobs.youHaveApplied")}
                    </Text>
                  </View>
                  {applicationId && (
                    <TouchableButton
                      style={[
                        styles.viewApplicationButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.2)"
                            : "rgba(201, 150, 63, 0.1)",
                          borderColor: isDark
                            ? "rgba(201, 150, 63, 0.4)"
                            : "rgba(201, 150, 63, 0.3)",
                        },
                      ]}
                      onPress={() =>
                        router.push(`/my-application/${applicationId}` as any)
                      }
                    >
                      <Feather name="file-text" size={18} color={colors.tint} />
                      <Text
                        style={[
                          styles.viewApplicationButtonText,
                          { color: colors.tint },
                        ]}
                      >
                        {t("jobs.viewApplicationDetails")}
                      </Text>
                    </TouchableButton>
                  )}
                  <TouchableButton
                    style={[
                      styles.withdrawButton,
                      {
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#fee2e2",
                        borderColor: isDark
                          ? "rgba(239, 68, 68, 0.3)"
                          : "#fecaca",
                      },
                    ]}
                    onPress={() => setShowWithdrawModal(true)}
                  >
                    <Feather
                      name="x-circle"
                      size={18}
                      color={isDark ? "#ef4444" : "#dc2626"}
                    />
                    <Text
                      style={[
                        styles.withdrawButtonText,
                        { color: isDark ? "#ef4444" : "#dc2626" },
                      ]}
                    >
                      {t("jobs.cannotMakeIt")}
                    </Text>
                  </TouchableButton>
                </View>
              ) : (
                <TouchableButton
                  style={[
                    styles.applyButton,
                    {
                      backgroundColor: isDark ? "#C9963F" : colors.tint,
                      borderColor: isDark ? "#C9963F" : colors.tint,
                    },
                  ]}
                  onPress={() => setShowApplyModal(true)}
                >
                  <Feather name="send" size={20} color="#FFFAF0" />
                  <Text style={styles.applyButtonText}>
                    {t("jobs.applyForThisJob")}
                  </Text>
                </TouchableButton>
              )}
            </View>
          )}

          {/* Manage Job Post Section (for Employers) */}
          {isEmployer &&
            job.employerId &&
            currentUserId &&
            job.employerId === currentUserId && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: colors.tint + "40",
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={styles.infoRow}>
                  <Feather name="edit-3" size={20} color={colors.tint} />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text, marginLeft: 8 },
                    ]}
                  >
                    {t("jobs.manageJobPost")}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.descriptionText,
                    {
                      color: isDark ? "#B8A88A" : "#6B6355",
                      marginTop: 8,
                      marginBottom: 16,
                    },
                  ]}
                >
                  {t("jobs.manageJobPostDescription")}
                </Text>
                <TouchableButton
                  style={[
                    styles.manageButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : colors.tint,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : colors.tint,
                      borderWidth: 1,
                      marginTop: 8,
                    },
                  ]}
                  onPress={() => {
                    setIsEditing(true);
                  }}
                >
                  <Feather
                    name="edit-2"
                    size={18}
                    color={isDark ? colors.text : "#FFFAF0"}
                  />
                  <Text
                    style={[
                      styles.manageButtonText,
                      { color: isDark ? colors.text : "#FFFAF0" },
                    ]}
                  >
                    {t("jobs.editJobPost")}
                  </Text>
                </TouchableButton>
                <TouchableButton
                  style={[
                    styles.manageButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.15)"
                        : "#fee2e2",
                      borderColor: isDark
                        ? "rgba(239, 68, 68, 0.3)"
                        : "#fecaca",
                      borderWidth: 1,
                      marginTop: 12,
                    },
                  ]}
                  onPress={() => setShowDeleteModal(true)}
                >
                  <Feather
                    name="trash-2"
                    size={18}
                    color={isDark ? "#ef4444" : "#dc2626"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.manageButtonText,
                      { color: isDark ? "#ef4444" : "#dc2626" },
                    ]}
                  >
                    {t("jobs.removeJob")}
                  </Text>
                </TouchableButton>
              </View>
            )}
        </ScrollView>

        {/* Withdraw Modal */}
        <Modal
          visible={showWithdrawModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowWithdrawModal(false);
            setWithdrawReason("");
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
                      {t("jobs.withdrawApplication")}
                    </Text>
                    <Text
                      style={[
                        styles.modalSubtitle,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      {t("jobs.provideReasonForWithdrawing")}
                    </Text>
                  </View>
                  <TouchableButton
                    onPress={() => {
                      setShowWithdrawModal(false);
                      setWithdrawReason("");
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

                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Warning for jobs less than 24 hours away */}
                  {job?.startDate &&
                    (() => {
                      const startDate = new Date(job.startDate);
                      const now = new Date();
                      const hoursUntilStart =
                        (startDate.getTime() - now.getTime()) /
                        (1000 * 60 * 60);
                      const isWithin24Hours =
                        hoursUntilStart > 0 && hoursUntilStart <= 24;

                      return isWithin24Hours ? (
                        <View
                          style={[
                            styles.warningBanner,
                            {
                              backgroundColor: isDark
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(239, 68, 68, 0.1)",
                              borderColor: isDark
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(239, 68, 68, 0.2)",
                              marginBottom: 16,
                              marginHorizontal: 20,
                            },
                          ]}
                        >
                          <Feather
                            name="alert-triangle"
                            size={20}
                            color="#ef4444"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[styles.warningText, { color: "#ef4444" }]}
                          >
                            {t("jobs.withdrawalWarning")}
                          </Text>
                        </View>
                      ) : null;
                    })()}

                  <View style={styles.modalSection}>
                    <Text
                      style={[
                        styles.modalLabel,
                        { color: colors.text, marginBottom: 12 },
                      ]}
                    >
                      {t("jobs.reasonForWithdrawal")}
                    </Text>
                    <TextInput
                      style={[
                        styles.modalTextArea,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,250,240,0.10)"
                            : "#f9fafb",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#E8D8B8",
                        },
                      ]}
                      placeholder={t("jobs.withdrawReasonPlaceholder")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      multiline
                      numberOfLines={4}
                      value={withdrawReason}
                      onChangeText={setWithdrawReason}
                      textAlignVertical="top"
                    />
                  </View>
                </ScrollView>

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
                      setShowWithdrawModal(false);
                      setWithdrawReason("");
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
                        backgroundColor: isDark ? "#ef4444" : "#dc2626",
                        borderColor: isDark ? "#f87171" : "#ef4444",
                        shadowColor: isDark ? "#ef4444" : "#dc2626",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 0,
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        minWidth: 0,
                      },
                      withdrawing && { opacity: 0.6 },
                    ]}
                    onPress={handleWithdraw}
                    disabled={withdrawing || !withdrawReason.trim()}
                  >
                    {withdrawing ? (
                      <ActivityIndicator color="#FFFAF0" />
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 1,
                        }}
                      >
                        <Feather name="x-circle" size={18} color="#FFFAF0" />
                        <Text
                          style={[
                            styles.modalButtonTextSubmit,
                            { flexShrink: 1, fontSize: 17 },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.9}
                        >
                          {t("jobs.withdraw")}
                        </Text>
                      </View>
                    )}
                  </TouchableButton>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete Job Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowDeleteModal(false);
            setDeleteReason("");
            setOtherReasonText("");
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
                      {t("jobs.deleteJobPost")}
                    </Text>
                    <Text
                      style={[
                        styles.modalSubtitle,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      {t("jobs.selectDeleteReasonMessage")}
                    </Text>
                  </View>
                  <TouchableButton
                    onPress={() => {
                      setShowDeleteModal(false);
                      setDeleteReason("");
                      setOtherReasonText("");
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

                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Warning for jobs less than 24 hours away */}
                  {job?.startDate &&
                    (() => {
                      const startDate = new Date(job.startDate);
                      const now = new Date();
                      const hoursUntilStart =
                        (startDate.getTime() - now.getTime()) /
                        (1000 * 60 * 60);
                      const isWithin24Hours =
                        hoursUntilStart > 0 && hoursUntilStart <= 24;

                      return isWithin24Hours ? (
                        <View
                          style={[
                            styles.warningBanner,
                            {
                              backgroundColor: isDark
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(239, 68, 68, 0.1)",
                              borderColor: isDark
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(239, 68, 68, 0.2)",
                              marginBottom: 16,
                              marginHorizontal: 20,
                            },
                          ]}
                        >
                          <Feather
                            name="alert-triangle"
                            size={20}
                            color="#ef4444"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[styles.warningText, { color: "#ef4444" }]}
                          >
                            {t("jobs.deleteWarning")}
                          </Text>
                        </View>
                      ) : null;
                    })()}

                  <View style={styles.modalSection}>
                    <Text
                      style={[
                        styles.modalLabel,
                        { color: colors.text, marginBottom: 12 },
                      ]}
                    >
                      {t("jobs.reasonForDeletion")}
                    </Text>
                    {[
                      {
                        value: "NO_LONGER_NEEDED",
                        label: t("jobs.deleteReasonNoLongerNeeded"),
                      },
                      {
                        value: "FOUND_CANDIDATE",
                        label: t("jobs.deleteReasonFoundCandidate"),
                      },
                      {
                        value: "FULFILLED",
                        label: t("jobs.deleteReasonFulfilled"),
                      },
                      {
                        value: "REQUIREMENTS_CHANGED",
                        label: t("jobs.deleteReasonRequirementsChanged"),
                      },
                      { value: "Other", label: t("common.other") },
                    ].map((reasonOption) => (
                      <TouchableButton
                        key={reasonOption.value}
                        style={[
                          styles.reasonOption,
                          {
                            backgroundColor:
                              deleteReason === reasonOption.value
                                ? isDark
                                  ? "rgba(201, 150, 63, 0.3)"
                                  : "rgba(201, 150, 63, 0.1)"
                                : isDark
                                  ? "rgba(255,250,240,0.06)"
                                  : "#f9fafb",
                            borderColor:
                              deleteReason === reasonOption.value
                                ? isDark
                                  ? "#C9963F"
                                  : "#C9963F"
                                : isDark
                                  ? "rgba(201,150,63,0.12)"
                                  : "#E8D8B8",
                            borderWidth:
                              deleteReason === reasonOption.value ? 2 : 1,
                          },
                        ]}
                        onPress={() => setDeleteReason(reasonOption.value)}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <View
                            style={[
                              styles.radioButton,
                              {
                                backgroundColor:
                                  deleteReason === reasonOption.value
                                    ? isDark
                                      ? "#C9963F"
                                      : "#C9963F"
                                    : "transparent",
                                borderColor:
                                  deleteReason === reasonOption.value
                                    ? isDark
                                      ? "#C9963F"
                                      : "#C9963F"
                                    : isDark
                                      ? "#9A8E7A"
                                      : "#8A7B68",
                              },
                            ]}
                          >
                            {deleteReason === reasonOption.value && (
                              <View style={styles.radioButtonInner} />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.reasonOptionText,
                              { color: colors.text },
                            ]}
                          >
                            {reasonOption.label}
                          </Text>
                        </View>
                      </TouchableButton>
                    ))}

                    {/* Text input for "Other" reason */}
                    {deleteReason === "Other" && (
                      <View style={{ marginTop: 12 }}>
                        <Text
                          style={[
                            styles.modalLabel,
                            { color: colors.text, marginBottom: 8 },
                          ]}
                        >
                          {t("jobs.specifyReason")}{" "}
                          <Text style={{ color: "#ef4444" }}>*</Text>
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,250,240,0.06)"
                                : "#f9fafb",
                              borderColor: !otherReasonText.trim()
                                ? "#ef4444"
                                : isDark
                                  ? "rgba(201,150,63,0.12)"
                                  : "#E8D8B8",
                              borderWidth: !otherReasonText.trim() ? 2 : 1,
                              color: colors.text,
                            },
                          ]}
                          placeholder={t("jobs.enterDeleteReasonRequired")}
                          placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                          value={otherReasonText}
                          onChangeText={setOtherReasonText}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                        {!otherReasonText.trim() && (
                          <Text
                            style={{
                              color: "#ef4444",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            {t("jobs.reasonRequired")}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </ScrollView>

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
                      setShowDeleteModal(false);
                      setDeleteReason("");
                      setOtherReasonText("");
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
                        backgroundColor: isDark ? "#ef4444" : "#dc2626",
                        borderColor: isDark ? "#f87171" : "#ef4444",
                        shadowColor: isDark ? "#ef4444" : "#dc2626",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 0,
                        borderWidth: 1,
                      },
                      deleting && { opacity: 0.6 },
                    ]}
                    onPress={handleDeleteJob}
                    disabled={
                      deleting ||
                      !deleteReason.trim() ||
                      (deleteReason === "Other" && !otherReasonText.trim())
                    }
                  >
                    {deleting ? (
                      <ActivityIndicator color="#FFFAF0" />
                    ) : (
                      <>
                        <Feather name="trash-2" size={16} color="#FFFAF0" />
                        <Text style={styles.modalButtonTextSubmit}>
                          {t("jobs.deleteJob")}
                        </Text>
                      </>
                    )}
                  </TouchableButton>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Apply Modal */}
        <Modal
          visible={showApplyModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowApplyModal(false)}
        >
          <View style={styles.modalOverlay}>
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
                    {t("jobs.applyToJob")}
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
                        : "#f1f5f9",
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#F0E8D5",
                    },
                  ]}
                  onPress={() => {
                    setShowApplyModal(false);
                    setCoverLetter("");
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
                      backgroundColor: isDark ? "#C9963F" : colors.tint,
                      borderColor: isDark ? "#C9963F" : colors.tint,
                      shadowColor: isDark ? "#C9963F" : colors.tint,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 0,
                      paddingHorizontal: 16,
                      minWidth: 0,
                    },
                    applying && { opacity: 0.6 },
                  ]}
                  onPress={handleApply}
                  disabled={applying}
                >
                  {applying ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 1,
                      }}
                    >
                      <Feather name="send" size={16} color="#FFFAF0" />
                      <Text
                        style={[
                          styles.modalButtonTextSubmit,
                          { flexShrink: 1 },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t("jobs.submitApplication")}
                      </Text>
                    </View>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  textArea: {
    height: 120,
  },
  categoryInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryText: {
    fontSize: 16,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  durationInput: {
    flex: 1,
  },
  durationUnitInput: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  durationUnitText: {
    fontSize: 16,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  optionButtonActive: {},
  optionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  categoryOption: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  categoryOptionSelected: {},
  categoryOptionText: { fontSize: 16, fontWeight: "500" },
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
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  card: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  instantBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  instantText: {
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    fontWeight: "700",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    marginTop: 2,
  },
  listText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  dateText: {
    fontSize: 13,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  paymentRange: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  paymentType: {
    fontSize: 14,
    flex: 1,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    gap: 8,
  },
  manageButtonText: {
    fontSize: 16,
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
    paddingBottom: Platform.OS === "android" ? 48 : 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 0,
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
  modalSubLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  modalTextArea: {
    borderRadius: 4,
    padding: 16,
    borderWidth: 1.5,
    fontSize: 15,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  listItemInput: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  paymentRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalHint: {},
  modalButtonPrimary: {},
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
  },
  applyButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  appliedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  appliedText: {
    fontSize: 16,
    fontWeight: "700",
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
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFAF0",
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
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  modalButtonCancel: {},
  modalButtonSubmit: {},
  modalButtonDisabled: {
    opacity: 0.6,
  },
  viewApplicationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  viewApplicationButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  withdrawButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  reasonOption: {
    padding: 16,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
  },
  reasonOptionText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFAF0",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  textInput: {
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
  },
  datePickerContainer: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 16,
    gap: 12,
    maxHeight: 400,
  },
  datePickerColumn: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  datePickerScroll: {
    maxHeight: 300,
  },
  datePickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  timePickerContainer: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 16,
    gap: 12,
    maxHeight: 400,
  },
  timePickerColumn: {
    flex: 1,
  },
});
