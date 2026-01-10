import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import * as Location from "expo-location";

// Import date/time picker components from post-job
// (We'll copy them here for now, or we could extract them to a shared component)
const DatePickerModal = ({
  visible,
  onClose,
  onSelect,
  minimumDate,
  value,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  minimumDate?: Date;
  value: Date | null;
  colors: any;
  isDark: boolean;
}) => {
  const { t } = useLanguage();
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
    if (minimumDate && date < minimumDate) {
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
            { backgroundColor: isDark ? "rgba(30, 41, 59, 0.95)" : "#ffffff" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {(() => {
                const key = "jobs.selectDate";
                const translated = t(key);
                return translated === key ? "Select Date" : translated;
              })()}
            </Text>
            <TouchableButton onPress={onClose}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableButton>
          </View>

          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {(() => {
                  const key = "jobs.year";
                  const translated = t(key);
                  return translated === key ? "Year" : translated;
                })()}
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
                              ? "#4f46e5"
                              : "#6366f1"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        borderWidth: selectedYear === year ? 0 : 1,
                        borderColor:
                          selectedYear === year
                            ? isDark
                              ? "#6366f1"
                              : "#4f46e5"
                            : isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        { color: selectedYear === year ? "#fff" : colors.text },
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
                {(() => {
                  const key = "jobs.month";
                  const translated = t(key);
                  return translated === key ? "Month" : translated;
                })()}
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
                              ? "#4f46e5"
                              : "#6366f1"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        borderWidth: selectedMonth === month ? 0 : 1,
                        borderColor:
                          selectedMonth === month
                            ? isDark
                              ? "#6366f1"
                              : "#4f46e5"
                            : isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => setSelectedMonth(month)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color: selectedMonth === month ? "#fff" : colors.text,
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
                {(() => {
                  const key = "jobs.day";
                  const translated = t(key);
                  return translated === key ? "Day" : translated;
                })()}
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
                              ? "#4f46e5"
                              : "#6366f1"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        borderWidth: selectedDay === day ? 0 : 1,
                        borderColor:
                          selectedDay === day
                            ? isDark
                              ? "#6366f1"
                              : "#4f46e5"
                            : isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        { color: selectedDay === day ? "#fff" : colors.text },
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
                    ? "rgba(255,255,255,0.15)"
                    : "#e2e8f0",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.25)" : "#cbd5e1",
                },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: colors.text, fontWeight: "600" },
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
                  backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                  borderWidth: 1,
                  borderColor: isDark ? "#6366f1" : "#4f46e5",
                  shadowColor: isDark ? "#4f46e5" : "#6366f1",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                },
              ]}
              onPress={handleConfirm}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: "#fff", fontWeight: "700" },
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
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: Date) => void;
  value: Date | null;
  colors: any;
  isDark: boolean;
}) => {
  const { t } = useLanguage();
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  useEffect(() => {
    if (value) {
      setSelectedHour(value.getHours());
      setSelectedMinute(value.getMinutes());
    }
  }, [value, visible]);

  const handleConfirm = () => {
    const time = new Date();
    time.setHours(selectedHour);
    time.setMinutes(selectedMinute);
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
            { backgroundColor: isDark ? "rgba(30, 41, 59, 0.95)" : "#ffffff" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {(() => {
                const key = "instantJob.selectTimeModalTitle";
                const translated = t(key);
                return translated === key ? "Select Time" : translated;
              })()}
            </Text>
            <TouchableButton onPress={onClose}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableButton>
          </View>

          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerColumn}>
              <Text style={[styles.datePickerLabel, { color: colors.text }]}>
                {(() => {
                  const key = "instantJob.hour";
                  const translated = t(key);
                  return translated === key ? "Hour" : translated;
                })()}
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
                              ? "#4f46e5"
                              : "#6366f1"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        borderWidth: selectedHour === hour ? 0 : 1,
                        borderColor:
                          selectedHour === hour
                            ? isDark
                              ? "#6366f1"
                              : "#4f46e5"
                            : isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        { color: selectedHour === hour ? "#fff" : colors.text },
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
                {(() => {
                  const key = "instantJob.minute";
                  const translated = t(key);
                  return translated === key ? "Minute" : translated;
                })()}
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
                              ? "#4f46e5"
                              : "#6366f1"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        borderWidth: selectedMinute === minute ? 0 : 1,
                        borderColor:
                          selectedMinute === minute
                            ? isDark
                              ? "#6366f1"
                              : "#4f46e5"
                            : isDark
                              ? "rgba(255,255,255,0.2)"
                              : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text
                      style={[
                        styles.datePickerOptionText,
                        {
                          color:
                            selectedMinute === minute ? "#fff" : colors.text,
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
                    ? "rgba(255,255,255,0.15)"
                    : "#e2e8f0",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.25)" : "#cbd5e1",
                },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: colors.text, fontWeight: "600" },
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
                  backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                  borderWidth: 1,
                  borderColor: isDark ? "#6366f1" : "#4f46e5",
                  shadowColor: isDark ? "#4f46e5" : "#6366f1",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                },
              ]}
              onPress={handleConfirm}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  { color: "#fff", fontWeight: "700" },
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

export default function InstantJobRequest() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const JOB_CATEGORIES = [
    { key: "cleaning", value: "Cleaning" },
    { key: "plumbing", value: "Plumbing" },
    { key: "gardening", value: "Gardening" },
    { key: "electrical", value: "Electrical" },
    { key: "carpentry", value: "Carpentry" },
    { key: "painting", value: "Painting" },
    { key: "moving", value: "Moving" },
    { key: "generalLabor", value: "General Labor" },
    { key: "delivery", value: "Delivery" },
    { key: "other", value: "Other" },
  ];
  const params = useLocalSearchParams();
  const candidateId = params.candidateId as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [workMode, setWorkMode] = useState<"ON_SITE" | "REMOTE" | "HYBRID">(
    "ON_SITE"
  );
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [loading, setLoading] = useState(false);
  const [employerInfo, setEmployerInfo] = useState<any>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);

  // Date/Time states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);

  useEffect(() => {
    fetchEmployerInfo();
  }, []);

  const fetchEmployerInfo = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/profiles/employer/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEmployerInfo(data);
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

        // Auto-populate location if available
        if (profile?.addressLine1) setLocation(profile.addressLine1);
        if (profile?.city) setCity(profile.city);
        if (profile?.country) setCountry(profile.country);
        else if (data.location) setLocation(data.location);
        else if (data.city) setCity(data.city);
        else if (data.country) setCountry(data.country);
      }
    } catch (err) {
      console.error("Error fetching employer info:", err);
    }
  };

  const handleContinue = async () => {
    if (!title || !description || !category) {
      Alert.alert(t("jobs.missingFields"), t("jobs.fillInAllRequiredFields"));
      return;
    }

    if (category === "Other" && !customCategory.trim()) {
      Alert.alert(
        t("jobs.missingCategory"),
        t("jobs.specifyCustomCategoryName")
      );
      return;
    }

    if (!location || !city || !country) {
      Alert.alert(
        t("jobs.missingLocation"),
        t("jobs.provideCompleteLocationInfo")
      );
      return;
    }

    // Check email, phone, and address verification
    if (!emailVerified || !phoneVerified || !hasAddress) {
      const missing = [];
      if (!emailVerified) missing.push("Email");
      if (!phoneVerified) missing.push("Phone");
      if (!hasAddress) missing.push("Address");

      Alert.alert(
        t("candidate.verificationRequired"),
        t("candidate.completeVerificationBeforeRequesting", {
          missing: missing.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("candidate.goToSettings"),
            onPress: () => router.push("/settings" as any),
          },
        ]
      );
      return;
    }

    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      // Get coordinates
      let lat = 0;
      let lng = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const locationData = await Location.geocodeAsync(
            `${location}, ${city}, ${country}`
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

      // Combine date and time for start
      let startDateTime: string | undefined;

      if (startDate && startTime) {
        const combinedStart = new Date(startDate);
        combinedStart.setHours(startTime.getHours());
        combinedStart.setMinutes(startTime.getMinutes());
        startDateTime = combinedStart.toISOString();
      }

      const payload: any = {
        title,
        description,
        categoryName: category === "Other" ? customCategory : category,
        workMode,
        urgency,
        location,
        city,
        country,
        lat,
        lng,
        startDate: startDateTime,
        isInstantBook: true, // Mark as instant book
      };

      // Step 1: Create the job
      const jobRes = await fetch(`${base}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!jobRes.ok) {
        const errorText = await jobRes.text();
        let errorMessage = "Failed to create instant job";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        Alert.alert(t("common.error"), errorMessage);
        return;
      }

      const jobData = await jobRes.json();
      const jobId = jobData.id || jobData.job?.id;

      if (!jobId) {
        Alert.alert(t("common.error"), t("jobs.jobCreatedButNoId"));
        return;
      }

      // Step 2: Automatically create an application for the candidate
      try {
        const applicationRes = await fetch(
          `${base}/applications/instant/${jobId}/${candidateId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!applicationRes.ok) {
          const errorText = await applicationRes.text();
          let errorMessage = "Failed to create application";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }

          Alert.alert(
            t("instantJob.jobCreated"),
            t("instantJob.jobCreatedSuccessfullyButCouldNotCreateApplication", {
              errorMessage,
            }),
            [
              {
                text: t("common.ok"),
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }

        const applicationData = await applicationRes.json();
        const applicationId = applicationData.id;

        if (!applicationId) {
          Alert.alert(
            t("instantJob.jobCreated"),
            t("instantJob.jobCreatedSuccessfullyNavigateToJob"),
            [
              {
                text: t("common.ok"),
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }

        // Step 3: Navigate to applicant details page with instant job flag
        router.push({
          pathname: "/applicant/[id]",
          params: {
            id: applicationId,
            instantJob: "true",
          },
        } as any);
      } catch (appError: any) {
        console.error("Error creating application:", appError);
        Alert.alert(
          "Error",
          `Failed to create application: ${appError.message || "Unknown error"}`,
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (err) {
      console.error("Error creating instant job:", err);
      Alert.alert(t("common.error"), t("jobs.failedToCreateInstantJob"));
    } finally {
      setLoading(false);
    }
  };

  const InputLabel = ({
    text,
    required,
  }: {
    text: string;
    required?: boolean;
  }) => (
    <Text style={[styles.label, { color: colors.text }]}>
      {text} {required && <Text style={{ color: "#ef4444" }}>*</Text>}
    </Text>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableButton
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Request Instant Job
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <InputLabel
              text={(() => {
                const key = "instantJob.jobTitle";
                const translated = t(key);
                return translated === key ? "Job Title" : translated;
              })()}
              required
            />
            <View
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  padding: 0,
                }}
                placeholder={(() => {
                  const key = "jobs.jobTitlePlaceholder";
                  const translated = t(key);
                  return translated === key
                    ? "e.g. Need a Plumber for leak repair"
                    : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                }
                value={title}
                onChangeText={setTitle}
                underlineColorAndroid="transparent"
              />
            </View>

            <InputLabel
              text={(() => {
                const key = "jobs.categoryLabel";
                const translated = t(key);
                return translated === key ? "Category" : translated;
              })()}
              required
            />
            <TouchableButton
              style={[
                styles.input,
                styles.categoryInput,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text
                style={[
                  styles.categoryText,
                  {
                    color: category
                      ? colors.text
                      : isDark
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(0,0,0,0.4)",
                  },
                ]}
              >
                {category
                  ? (() => {
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
                      const key = categoryMap[category];
                      if (key) {
                        const translationKey = `jobs.category.${key}`;
                        const translated = t(translationKey);
                        return translated === translationKey
                          ? category
                          : translated;
                      }
                      return category;
                    })()
                  : (() => {
                      const key = "jobs.selectCategory";
                      const translated = t(key);
                      return translated === key
                        ? "Select Category"
                        : translated;
                    })()}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"}
              />
            </TouchableButton>

            {category === "Other" && (
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.2)"
                      : "transparent",
                  },
                ]}
              >
                <TextInput
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 16,
                    padding: 0,
                  }}
                  placeholder={(() => {
                    const key = "jobs.enterCustomCategory";
                    const translated = t(key);
                    return translated === key
                      ? "Enter custom category name"
                      : translated;
                  })()}
                  placeholderTextColor={
                    isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                  }
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  underlineColorAndroid="transparent"
                />
              </View>
            )}

            <InputLabel
              text={(() => {
                const key = "jobs.description";
                const translated = t(key);
                return translated === key ? "Description" : translated;
              })()}
              required
            />
            <View
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  padding: 0,
                  minHeight: 100,
                }}
                placeholder={(() => {
                  const key = "jobs.describeTaskDetail";
                  const translated = t(key);
                  return translated === key
                    ? "Describe the task in detail..."
                    : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                }
                multiline
                numberOfLines={5}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
              />
            </View>

            <InputLabel
              text={(() => {
                const key = "jobs.workMode";
                const translated = t(key);
                return translated === key ? "Work Mode" : translated;
              })()}
            />
            <View style={styles.optionRow}>
              {(["ON_SITE", "REMOTE", "HYBRID"] as const).map((mode) => (
                <TouchableButton
                  key={mode}
                  style={[
                    styles.optionButton,
                    workMode === mode && styles.optionButtonActive,
                    {
                      backgroundColor:
                        workMode === mode
                          ? isDark
                            ? "#4f46e5"
                            : colors.tint
                          : isDark
                            ? "transparent"
                            : "rgba(0,0,0,0.05)",
                      borderColor:
                        workMode === mode
                          ? isDark
                            ? "#6366f1"
                            : colors.tint
                          : isDark
                            ? "rgba(255,255,255,0.3)"
                            : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => setWorkMode(mode)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: workMode === mode ? "#fff" : colors.text },
                    ]}
                  >
                    {(() => {
                      const key =
                        mode === "ON_SITE"
                          ? "jobs.onSite"
                          : mode === "REMOTE"
                            ? "jobs.remote"
                            : "jobs.hybrid";
                      const translated = t(key);
                      return translated === key
                        ? mode === "ON_SITE"
                          ? "On Site"
                          : mode === "REMOTE"
                            ? "Remote"
                            : "Hybrid"
                        : translated;
                    })()}
                  </Text>
                </TouchableButton>
              ))}
            </View>

            <InputLabel
              text={(() => {
                const key = "jobs.priority";
                const translated = t(key);
                return translated === key ? "Priority" : translated;
              })()}
            />
            <View style={styles.optionRow}>
              {(["NORMAL", "URGENT"] as const).map((urg) => (
                <TouchableButton
                  key={urg}
                  style={[
                    styles.optionButton,
                    urgency === urg && styles.optionButtonActive,
                    {
                      backgroundColor:
                        urgency === urg
                          ? urg === "URGENT"
                            ? "#dc2626"
                            : isDark
                              ? "#4f46e5"
                              : colors.tint
                          : isDark
                            ? "transparent"
                            : "rgba(0,0,0,0.05)",
                      borderColor:
                        urgency === urg
                          ? urg === "URGENT"
                            ? "#ef4444"
                            : isDark
                              ? "#6366f1"
                              : colors.tint
                          : isDark
                            ? "rgba(255,255,255,0.3)"
                            : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => setUrgency(urg)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: urgency === urg ? "#fff" : colors.text },
                    ]}
                  >
                    {(() => {
                      const key =
                        urg === "URGENT" ? "jobs.urgent" : "jobs.normal";
                      const translated = t(key);
                      return translated === key
                        ? urg === "URGENT"
                          ? "Urgent"
                          : "Normal"
                        : translated;
                    })()}
                  </Text>
                </TouchableButton>
              ))}
            </View>

            <InputLabel
              text={(() => {
                const key = "jobs.startDateAndTime";
                const translated = t(key);
                return translated === key ? "Start Date & Time" : translated;
              })()}
            />
            <View style={styles.dateTimeRow}>
              <TouchableButton
                style={[
                  styles.input,
                  styles.dateTimeInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.2)"
                      : "transparent",
                  },
                ]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.tint} />
                <Text
                  style={[
                    styles.dateTimeText,
                    {
                      color: startDate
                        ? colors.text
                        : isDark
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(0,0,0,0.4)",
                    },
                  ]}
                >
                  {startDate
                    ? startDate.toLocaleDateString()
                    : (() => {
                        const key = "jobs.selectDate";
                        const translated = t(key);
                        return translated === key ? "Select Date" : translated;
                      })()}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[
                  styles.input,
                  styles.dateTimeInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.2)"
                      : "transparent",
                  },
                ]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Feather name="clock" size={18} color={colors.tint} />
                <Text
                  style={[
                    styles.dateTimeText,
                    {
                      color: startTime
                        ? colors.text
                        : isDark
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(0,0,0,0.4)",
                    },
                  ]}
                >
                  {startTime
                    ? startTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : (() => {
                        const key = "jobs.selectTime";
                        const translated = t(key);
                        return translated === key ? "Select Time" : translated;
                      })()}
                </Text>
              </TouchableButton>
            </View>

            <InputLabel
              text={(() => {
                const key = "jobs.location";
                const translated = t(key);
                return translated === key ? "Location" : translated;
              })()}
              required
            />
            <View
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  padding: 0,
                }}
                placeholder={(() => {
                  const key = "jobs.streetAddress";
                  const translated = t(key);
                  return translated === key ? "Street address" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                }
                value={location}
                onChangeText={setLocation}
                underlineColorAndroid="transparent"
              />
            </View>

            <View
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  padding: 0,
                }}
                placeholder={(() => {
                  const key = "settings.cityPlaceholder";
                  const translated = t(key);
                  return translated === key ? "City" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                }
                value={city}
                onChangeText={setCity}
                underlineColorAndroid="transparent"
              />
            </View>

            <View
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? "rgba(255,255,255,0.2)" : "transparent",
                },
              ]}
            >
              <TextInput
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 16,
                  padding: 0,
                }}
                placeholder={(() => {
                  const key = "jobs.country";
                  const translated = t(key);
                  return translated === key ? "Country" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                }
                value={country}
                onChangeText={setCountry}
                underlineColorAndroid="transparent"
              />
            </View>

            <TouchableButton
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isDark ? "#4f46e5" : colors.tint,
                  borderColor: isDark ? "#6366f1" : colors.tint,
                  shadowColor: isDark ? "#4f46e5" : colors.tint,
                },
                loading && styles.submitBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {t("instantJob.continue")}
                </Text>
              )}
            </TouchableButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.95)" : "#ffffff",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("instantJob.selectCategory")}
              </Text>
              <TouchableButton onPress={() => setShowCategoryModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableButton>
            </View>
            <ScrollView>
              {JOB_CATEGORIES.map((cat) => (
                <TouchableButton
                  key={cat.value}
                  style={[
                    styles.categoryOption,
                    category === cat.value && styles.categoryOptionSelected,
                    {
                      backgroundColor:
                        category === cat.value
                          ? isDark
                            ? "#6366f1"
                            : "#4f46e5"
                          : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                      borderWidth: category === cat.value ? 0 : 1,
                      borderColor:
                        category === cat.value
                          ? "transparent"
                          : isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color: category === cat.value ? "#fff" : colors.text,
                        fontWeight: category === cat.value ? "600" : "500",
                      },
                    ]}
                  >
                    {(() => {
                      const key = `jobs.category.${cat.key}`;
                      const translated = t(key);
                      return translated === key ? cat.value : translated;
                    })()}
                  </Text>
                </TouchableButton>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Date/Time Pickers */}
      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        onSelect={(date) => setStartDate(date)}
        minimumDate={new Date()}
        value={startDate}
        colors={colors}
        isDark={isDark}
      />

      <TimePickerModal
        visible={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        onSelect={(time) => setStartTime(time)}
        value={startTime}
        colors={colors}
        isDark={isDark}
      />
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
    borderRadius: 20,
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
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 0,
    overflow: "hidden",
    ...(Platform.OS === "android" && {
      elevation: 0,
      borderWidth: 0,
    }),
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
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 0,
  },
  optionButtonActive: {},
  optionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  categoryOption: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  categoryOptionSelected: {},
  categoryOptionText: { fontSize: 16, fontWeight: "500" },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    flex: 1,
  },
  datePickerContainer: {
    flexDirection: "row",
    height: 300,
    marginVertical: 20,
  },
  datePickerColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  datePickerScroll: {
    flex: 1,
  },
  datePickerOption: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  datePickerOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  timePickerContainer: {
    flexDirection: "row",
    height: 300,
    marginVertical: 20,
  },
  timePickerColumn: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
