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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import * as Location from "expo-location";

// Custom date/time picker components that work in Expo Go
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
    // Set time to start of day for comparison
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if the selected date is today - block it and show helpful message
    if (date.getTime() === today.getTime()) {
      Alert.alert(
        t("jobs.invalidDate"),
        t("jobs.dateMustBeFuture") + "\n\n" + t("jobs.todayDateSuggestion"),
        [{ text: t("common.ok") }],
      );
      return;
    }

    if (minimumDate) {
      // Normalize minimumDate to start of day for comparison
      const minDate = new Date(minimumDate);
      minDate.setHours(0, 0, 0, 0);

      if (date < minDate) {
        Alert.alert(t("jobs.invalidDate"), t("jobs.dateMustBeFuture"));
        return;
      }
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
                  borderColor: isDark ? "#10B981" : "#059669",
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
            { backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0" },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {(() => {
                const key = "jobs.selectTime";
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
                  const key = "jobs.hour";
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
                {(() => {
                  const key = "jobs.minute";
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
                  borderColor: isDark ? "#10B981" : "#059669",
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

// Job categories - using keys for translation
const getJobCategories = () => [
  { key: "cleaning" },
  { key: "plumbing" },
  { key: "gardening" },
  { key: "electrical" },
  { key: "carpentry" },
  { key: "painting" },
  { key: "moving" },
  { key: "generalLabor" },
  { key: "delivery" },
  { key: "other" },
];

// Helper function to translate category name
const translateCategoryName = (
  categoryKey: string,
  t: (key: string) => string,
): string => {
  if (!categoryKey) return "";
  const key = `jobs.category.${categoryKey}`;
  const translated = t(key);
  // If translation key doesn't exist, return capitalized key as fallback
  return translated === key
    ? categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)
    : translated;
};

const getDurationUnits = (t: (key: string) => string) => [
  { key: "hours", value: "hours" },
  { key: "days", value: "days" },
  { key: "weeks", value: "weeks" },
  { key: "months", value: "months" },
];

export default function PostJob() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [workMode, setWorkMode] = useState<"ON_SITE" | "REMOTE" | "HYBRID">(
    "ON_SITE",
  );
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [loading, setLoading] = useState(false);
  const [employerInfo, setEmployerInfo] = useState<any>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);

  // New fields matching web app
  const [jobType, setJobType] = useState<string>("FULL_TIME");
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [rateAmount, setRateAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [paymentType, setPaymentType] = useState("HOURLY");
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [newReq, setNewReq] = useState("");
  const [newResp, setNewResp] = useState("");

  // Job requirement flags
  const [isRestrictedSector, setIsRestrictedSector] = useState(false);
  const [requiresVehicle, setRequiresVehicle] = useState(false);
  const [requiresDriverLicense, setRequiresDriverLicense] = useState(false);

  // Date/Time states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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

  const handleSubmit = async () => {
    if (!title || !description || !category) {
      Alert.alert(t("auth.missingFields"), t("auth.fillAllFields"));
      return;
    }

    if (category === "other" && !customCategory.trim()) {
      Alert.alert(t("common.error"), t("jobs.specifyCustomCategory"));
      return;
    }

    if (!location || !city || !country) {
      Alert.alert(t("common.error"), t("jobs.provideLocationInfo"));
      return;
    }

    if (!startDate || !startTime) {
      Alert.alert(t("common.error"), t("jobs.startDateTimeRequired"));
      return;
    }

    // Check email, phone, and address verification
    if (!emailVerified || !phoneVerified || !hasAddress) {
      const missing = [];
      if (!emailVerified) missing.push(t("settings.email"));
      if (!phoneVerified) missing.push(t("settings.phone"));
      if (!hasAddress) missing.push(t("profile.address"));

      Alert.alert(
        t("home.verificationRequired"),
        t("jobs.completeVerificationBeforePosting", {
          missing: missing.join(", "),
        }),
        [
          { text: t("common.ok") },
          {
            text: t("applications.goToSettings"),
            onPress: () => router.push("/settings" as any),
          },
        ],
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
            `${location}, ${city}, ${country}`,
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
        categoryName:
          category === "other"
            ? customCategory
            : translateCategoryName(category, t),
        workMode,
        urgency,
        type: jobType,
        location,
        city,
        country,
        lat,
        lng,
        startDate: startDateTime,
      };

      if (endDate) {
        payload.endDate = endDate.toISOString();
      }
      if (rateAmount && parseFloat(rateAmount) > 0) {
        payload.rateAmount = Math.round(parseFloat(rateAmount) * 100);
        payload.currency = currency;
        payload.paymentType = paymentType;
      }
      if (requiresVehicle) payload.requiresVehicle = true;
      if (requiresDriverLicense) payload.requiresDriverLicense = true;
      const filteredReqs = requirements.filter((r) => r.trim());
      if (filteredReqs.length > 0) payload.requirements = filteredReqs;
      const filteredResps = responsibilities.filter((r) => r.trim());
      if (filteredResps.length > 0) payload.responsibilities = filteredResps;

      const res = await fetch(`${base}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("jobs.jobPostedSuccessfully"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        const errorText = await res.text();
        let errorMessage = t("jobs.failedToPostJob");
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (err) {
      console.error("Error posting job:", err);
      Alert.alert(t("common.error"), t("jobs.failedToPostJobTryAgain"));
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
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.06)",
              },
            ]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("jobs.postJob")}
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
                const key = "jobs.jobTitle";
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
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
                  const key = "jobs.jobTitlePlaceholder";
                  const translated = t(key);
                  return translated === key
                    ? "e.g. Need a Plumber for leak repair"
                    : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
                    : "transparent",
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
                        ? "rgba(255,250,240,0.6)"
                        : "rgba(0,0,0,0.4)",
                  },
                ]}
              >
                {category
                  ? translateCategoryName(category, t)
                  : t("jobs.selectCategory")}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
              />
            </TouchableButton>

            {category === "other" && (
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                    isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
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
                  isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
                }
                multiline
                numberOfLines={5}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
              />
            </View>

            <InputLabel text={t("jobs.workMode")} required />
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
                            ? "#C9963F"
                            : colors.tint
                          : isDark
                            ? "transparent"
                            : "rgba(184,130,42,0.06)",
                      borderColor:
                        workMode === mode
                          ? isDark
                            ? "#C9963F"
                            : colors.tint
                          : isDark
                            ? "rgba(201,150,63,0.25)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => setWorkMode(mode)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: workMode === mode ? "#FFFAF0" : colors.text },
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
                              ? "#C9963F"
                              : colors.tint
                          : isDark
                            ? "transparent"
                            : "rgba(184,130,42,0.06)",
                      borderColor:
                        urgency === urg
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
                  onPress={() => setUrgency(urg)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: urgency === urg ? "#FFFAF0" : colors.text },
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

            <InputLabel text={t("jobs.jobTypeLabel")} />
            <TouchableButton
              style={[
                styles.input,
                styles.categoryInput,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
                    : "transparent",
                },
              ]}
              onPress={() => setShowJobTypeModal(true)}
            >
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {(
                  {
                    FULL_TIME: t("jobs.type.fulltime"),
                    PART_TIME: t("jobs.type.parttime"),
                    CONTRACT: t("jobs.type.contract"),
                    TEMPORARY: t("jobs.type.temporary"),
                    FREELANCE: t("jobs.type.freelance"),
                    INTERNSHIP: t("jobs.type.internship"),
                    GIG: t("jobs.type.gig"),
                  } as Record<string, string>
                )[jobType] || jobType}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
              />
            </TouchableButton>

            <InputLabel text={t("jobs.paymentOptional")} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <View
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                  placeholder="0.00"
                  placeholderTextColor={
                    isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
                  }
                  value={rateAmount}
                  onChangeText={setRateAmount}
                  keyboardType="decimal-pad"
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableButton
                style={[
                  styles.input,
                  styles.categoryInput,
                  {
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
                      : "transparent",
                  },
                ]}
                onPress={() => setShowCurrencyModal(true)}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {currency}
                </Text>
                <Feather
                  name="chevron-down"
                  size={20}
                  color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
                />
              </TouchableButton>
            </View>
            <TouchableButton
              style={[
                styles.input,
                styles.categoryInput,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
                    : "transparent",
                },
              ]}
              onPress={() => setShowPaymentTypeModal(true)}
            >
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {(
                  {
                    HOURLY: t("jobs.paymentType.hourly"),
                    DAILY: t("jobs.paymentType.daily"),
                    WEEKLY: t("jobs.paymentType.weekly"),
                    MONTHLY: t("jobs.paymentType.monthly"),
                    FIXED: t("jobs.paymentType.fixed"),
                  } as Record<string, string>
                )[paymentType] || paymentType}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
              />
            </TouchableButton>

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
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                          ? "rgba(255,250,240,0.6)"
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
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                          ? "rgba(255,250,240,0.6)"
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
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
                  const key = "jobs.streetAddress";
                  const translated = t(key);
                  return translated === key ? "Street address" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
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
                  const key = "jobs.city";
                  const translated = t(key);
                  return translated === key ? "City" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
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
                    ? "rgba(255,250,240,0.12)"
                    : "rgba(255,250,240,0.95)",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.15)"
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
                  const key = "jobs.country";
                  const translated = t(key);
                  return translated === key ? "Country" : translated;
                })()}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
                }
                value={country}
                onChangeText={setCountry}
                underlineColorAndroid="transparent"
              />
            </View>

            <InputLabel text={t("jobs.endDateOptional")} />
            <View style={styles.dateTimeRow}>
              <TouchableButton
                style={[
                  styles.input,
                  styles.dateTimeInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
                      : "transparent",
                  },
                ]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.tint} />
                <Text
                  style={[
                    styles.dateTimeText,
                    {
                      color: endDate
                        ? colors.text
                        : isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.4)",
                    },
                  ]}
                >
                  {endDate
                    ? endDate.toLocaleDateString()
                    : t("jobs.selectEndDate")}
                </Text>
              </TouchableButton>
              {endDate && (
                <TouchableButton
                  style={{ justifyContent: "center", paddingHorizontal: 8 }}
                  onPress={() => setEndDate(null)}
                >
                  <Feather
                    name="x"
                    size={20}
                    color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
                  />
                </TouchableButton>
              )}
            </View>

            <InputLabel text={t("jobs.requirementsOptional")} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <View
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                  placeholder={t("jobs.addRequirementPlaceholder")}
                  placeholderTextColor={
                    isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
                  }
                  value={newReq}
                  onChangeText={setNewReq}
                  onSubmitEditing={() => {
                    if (newReq.trim()) {
                      setRequirements([...requirements, newReq.trim()]);
                      setNewReq("");
                    }
                  }}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableButton
                style={[
                  styles.optionButton,
                  {
                    flex: 0,
                    paddingHorizontal: 16,
                    backgroundColor: isDark ? "#C9963F" : colors.tint,
                    borderColor: isDark ? "#C9963F" : colors.tint,
                  },
                ]}
                onPress={() => {
                  if (newReq.trim()) {
                    setRequirements([...requirements, newReq.trim()]);
                    setNewReq("");
                  }
                }}
              >
                <Feather name="plus" size={20} color="#FFFAF0" />
              </TouchableButton>
            </View>
            {requirements.map((req, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                  paddingLeft: 8,
                }}
              >
                <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
                  • {req}
                </Text>
                <TouchableButton
                  onPress={() =>
                    setRequirements(requirements.filter((_, idx) => idx !== i))
                  }
                  style={{ padding: 4 }}
                >
                  <Feather
                    name="x"
                    size={16}
                    color={isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.3)"}
                  />
                </TouchableButton>
              </View>
            ))}

            <InputLabel text={t("jobs.responsibilitiesOptional")} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <View
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(255,250,240,0.95)",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
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
                  placeholder={t("jobs.addResponsibilityPlaceholder")}
                  placeholderTextColor={
                    isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"
                  }
                  value={newResp}
                  onChangeText={setNewResp}
                  onSubmitEditing={() => {
                    if (newResp.trim()) {
                      setResponsibilities([
                        ...responsibilities,
                        newResp.trim(),
                      ]);
                      setNewResp("");
                    }
                  }}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableButton
                style={[
                  styles.optionButton,
                  {
                    flex: 0,
                    paddingHorizontal: 16,
                    backgroundColor: isDark ? "#C9963F" : colors.tint,
                    borderColor: isDark ? "#C9963F" : colors.tint,
                  },
                ]}
                onPress={() => {
                  if (newResp.trim()) {
                    setResponsibilities([...responsibilities, newResp.trim()]);
                    setNewResp("");
                  }
                }}
              >
                <Feather name="plus" size={20} color="#FFFAF0" />
              </TouchableButton>
            </View>
            {responsibilities.map((resp, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                  paddingLeft: 8,
                }}
              >
                <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
                  • {resp}
                </Text>
                <TouchableButton
                  onPress={() =>
                    setResponsibilities(
                      responsibilities.filter((_, idx) => idx !== i),
                    )
                  }
                  style={{ padding: 4 }}
                >
                  <Feather
                    name="x"
                    size={16}
                    color={isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.3)"}
                  />
                </TouchableButton>
              </View>
            ))}

            {/* Job Requirements Section */}
            <View
              style={[
                styles.requirementsSection,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.04)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.15)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.requirementsSectionTitle,
                  { color: colors.text },
                ]}
              >
                {t("jobPosting.requirements.title")}
              </Text>

              {/* Q1: Restricted Sector */}
              <Text
                style={[
                  styles.requirementsQuestion,
                  { color: isDark ? "rgba(255,250,240,0.8)" : "#4A4335" },
                ]}
              >
                {t("jobPosting.requirements.restrictedSectorQuestion")}
              </Text>
              <View style={styles.requirementsToggleRow}>
                <Switch
                  value={isRestrictedSector}
                  onValueChange={setIsRestrictedSector}
                  trackColor={{
                    false: isDark ? "rgba(255,250,240,0.15)" : "#ccc",
                    true: "#ef4444",
                  }}
                  thumbColor={isRestrictedSector ? "#FFFAF0" : "#f4f3f4"}
                />
                <Text
                  style={[
                    styles.requirementsToggleLabel,
                    { color: isRestrictedSector ? "#ef4444" : colors.text },
                  ]}
                >
                  {isRestrictedSector
                    ? t("jobPosting.requirements.restrictedSectorYes")
                    : t("common.no")}
                </Text>
              </View>
              {isRestrictedSector && (
                <View
                  style={[
                    styles.restrictedBanner,
                    {
                      backgroundColor: isDark
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(239,68,68,0.08)",
                      borderColor: isDark
                        ? "rgba(239,68,68,0.3)"
                        : "rgba(239,68,68,0.2)",
                    },
                  ]}
                >
                  <Feather name="alert-triangle" size={18} color="#ef4444" />
                  <Text
                    style={[
                      styles.restrictedBannerText,
                      { color: isDark ? "#fca5a5" : "#dc2626" },
                    ]}
                  >
                    {t("jobPosting.requirements.restrictedSectorMessage")}
                  </Text>
                </View>
              )}

              {/* Q2: Vehicle / Driving */}
              {!isRestrictedSector && (
                <>
                  <Text
                    style={[
                      styles.requirementsQuestion,
                      {
                        color: isDark ? "rgba(255,250,240,0.8)" : "#4A4335",
                        marginTop: 16,
                      },
                    ]}
                  >
                    {t("jobPosting.requirements.vehicleQuestion")}
                  </Text>
                  <View style={styles.requirementsToggleRow}>
                    <Switch
                      value={requiresVehicle}
                      onValueChange={setRequiresVehicle}
                      trackColor={{
                        false: isDark ? "rgba(255,250,240,0.15)" : "#ccc",
                        true: isDark ? "#C9963F" : "#B8822A",
                      }}
                      thumbColor={requiresVehicle ? "#FFFAF0" : "#f4f3f4"}
                    />
                    <Text
                      style={[
                        styles.requirementsToggleLabel,
                        { color: colors.text },
                      ]}
                    >
                      {t("jobPosting.requirements.requiresVehicle")}
                    </Text>
                  </View>
                  <View style={styles.requirementsToggleRow}>
                    <Switch
                      value={requiresDriverLicense}
                      onValueChange={setRequiresDriverLicense}
                      trackColor={{
                        false: isDark ? "rgba(255,250,240,0.15)" : "#ccc",
                        true: isDark ? "#C9963F" : "#B8822A",
                      }}
                      thumbColor={requiresDriverLicense ? "#FFFAF0" : "#f4f3f4"}
                    />
                    <Text
                      style={[
                        styles.requirementsToggleLabel,
                        { color: colors.text },
                      ]}
                    >
                      {t("jobPosting.requirements.requiresDriverLicense")}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <TouchableButton
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isRestrictedSector
                    ? isDark
                      ? "rgba(255,250,240,0.1)"
                      : "#ccc"
                    : isDark
                      ? "#10B981"
                      : "#059669",
                  borderColor: isRestrictedSector
                    ? "transparent"
                    : isDark
                      ? "#10B981"
                      : "#059669",
                  shadowColor: isDark ? "#10B981" : "#059669",
                },
                (loading || isRestrictedSector) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || isRestrictedSector}
            >
              {loading ? (
                <ActivityIndicator color="#FFFAF0" />
              ) : (
                <Text style={styles.submitBtnText}>{t("jobs.postJob")}</Text>
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
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
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
              {getJobCategories().map((cat) => (
                <TouchableButton
                  key={cat.key}
                  style={[
                    styles.categoryOption,
                    category === cat.key && styles.categoryOptionSelected,
                    {
                      backgroundColor:
                        category === cat.key
                          ? isDark
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: category === cat.key ? 0 : 1,
                      borderColor:
                        category === cat.key
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setCategory(cat.key);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color: category === cat.key ? "#FFFAF0" : colors.text,
                        fontWeight: category === cat.key ? "600" : "500",
                      },
                    ]}
                  >
                    {translateCategoryName(cat.key, t)}
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

      <DatePickerModal
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        onSelect={(date) => setEndDate(date)}
        minimumDate={startDate || new Date()}
        value={endDate}
        colors={colors}
        isDark={isDark}
      />

      {/* Job Type Modal */}
      <Modal
        visible={showJobTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJobTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("jobs.selectJobType")}
              </Text>
              <TouchableButton onPress={() => setShowJobTypeModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableButton>
            </View>
            <ScrollView>
              {[
                { value: "FULL_TIME", label: t("jobs.type.fulltime") },
                { value: "PART_TIME", label: t("jobs.type.parttime") },
                { value: "CONTRACT", label: t("jobs.type.contract") },
                { value: "TEMPORARY", label: t("jobs.type.temporary") },
                { value: "FREELANCE", label: t("jobs.type.freelance") },
                { value: "INTERNSHIP", label: t("jobs.type.internship") },
                { value: "GIG", label: t("jobs.type.gig") },
              ].map((jt) => (
                <TouchableButton
                  key={jt.value}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor:
                        jobType === jt.value
                          ? isDark
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: jobType === jt.value ? 0 : 1,
                      borderColor:
                        jobType === jt.value
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setJobType(jt.value);
                    setShowJobTypeModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color: jobType === jt.value ? "#FFFAF0" : colors.text,
                        fontWeight: jobType === jt.value ? "600" : "500",
                      },
                    ]}
                  >
                    {jt.label}
                  </Text>
                </TouchableButton>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("jobs.selectCurrency")}
              </Text>
              <TouchableButton onPress={() => setShowCurrencyModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableButton>
            </View>
            <ScrollView>
              {[
                { value: "EUR", label: "EUR – Euro" },
                { value: "USD", label: "USD – US Dollar" },
                { value: "GBP", label: "GBP – British Pound" },
                { value: "CHF", label: "CHF – Swiss Franc" },
                { value: "SEK", label: "SEK – Swedish Krona" },
                { value: "NOK", label: "NOK – Norwegian Krone" },
                { value: "DKK", label: "DKK – Danish Krone" },
                { value: "PLN", label: "PLN – Polish Złoty" },
                { value: "CZK", label: "CZK – Czech Koruna" },
              ].map((c) => (
                <TouchableButton
                  key={c.value}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor:
                        currency === c.value
                          ? isDark
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: currency === c.value ? 0 : 1,
                      borderColor:
                        currency === c.value
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setCurrency(c.value);
                    setShowCurrencyModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color: currency === c.value ? "#FFFAF0" : colors.text,
                        fontWeight: currency === c.value ? "600" : "500",
                      },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableButton>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Type Modal */}
      <Modal
        visible={showPaymentTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("jobs.selectPaymentType")}
              </Text>
              <TouchableButton onPress={() => setShowPaymentTypeModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableButton>
            </View>
            <ScrollView>
              {[
                { value: "HOURLY", label: t("jobs.paymentType.hourly") },
                { value: "DAILY", label: t("jobs.paymentType.daily") },
                { value: "WEEKLY", label: t("jobs.paymentType.weekly") },
                { value: "MONTHLY", label: t("jobs.paymentType.monthly") },
                { value: "FIXED", label: t("jobs.paymentType.fixed") },
              ].map((pt) => (
                <TouchableButton
                  key={pt.value}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor:
                        paymentType === pt.value
                          ? isDark
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: paymentType === pt.value ? 0 : 1,
                      borderColor:
                        paymentType === pt.value
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setPaymentType(pt.value);
                    setShowPaymentTypeModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color:
                          paymentType === pt.value ? "#FFFAF0" : colors.text,
                        fontWeight: paymentType === pt.value ? "600" : "500",
                      },
                    ]}
                  >
                    {pt.label}
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
    borderRadius: 4,
    alignItems: "center",
    borderWidth: 0,
  },
  optionButtonActive: {},
  optionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
    paddingVertical: 12,
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  switchText: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 12,
  },
  requirementsSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  requirementsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  requirementsQuestion: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  requirementsToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  requirementsToggleLabel: {
    fontSize: 14,
    flex: 1,
  },
  restrictedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  restrictedBannerText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
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
    fontWeight: "700",
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
    borderRadius: 4,
    alignItems: "center",
  },
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
