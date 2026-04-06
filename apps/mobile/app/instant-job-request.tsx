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
  Image,
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
    "ON_SITE",
  );
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [loading, setLoading] = useState(false);
  const [employerInfo, setEmployerInfo] = useState<any>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);

  // New fields matching web app
  const [jobType, setJobType] = useState<string>("GIG");
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [rateAmount, setRateAmount] = useState("");
  const [currencyVal, setCurrencyVal] = useState("EUR");
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [paymentType, setPaymentType] = useState("HOURLY");
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [newReq, setNewReq] = useState("");
  const [newResp, setNewResp] = useState("");

  const [isRestrictedSector, setIsRestrictedSector] = useState(false);
  const [requiresVehicle, setRequiresVehicle] = useState(false);
  const [requiresDriverLicense, setRequiresDriverLicense] = useState(false);
  const [providerHasVehicle, setProviderHasVehicle] = useState<boolean | null>(
    null,
  );
  const [providerHasLicense, setProviderHasLicense] = useState<boolean | null>(
    null,
  );
  const [candidateData, setCandidateData] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Date/Time states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    fetchEmployerInfo();
    fetchCandidateVerification();
  }, []);

  const fetchCandidateVerification = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token || !candidateId) return;
      const base = getApiBase();
      const res = await fetch(`${base}/users/candidates/${candidateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const cand = await res.json();
        setCandidateData(cand);
        setProviderHasVehicle(!!cand.hasVerifiedVehicle);
        setProviderHasLicense(!!cand.hasVerifiedDriversLicense);
      }
    } catch (err) {
      console.error("Error fetching candidate verification:", err);
    }
  };

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
        t("jobs.specifyCustomCategoryName"),
      );
      return;
    }

    if (!location || !city || !country) {
      Alert.alert(
        t("jobs.missingLocation"),
        t("jobs.provideCompleteLocationInfo"),
      );
      return;
    }

    if (!startDate || !startTime) {
      Alert.alert(t("common.error"), t("jobs.startDateTimeRequired"));
      return;
    }

    if (isRestrictedSector) {
      Alert.alert(
        t("common.error"),
        t("jobPosting.requirements.restrictedSectorMessage"),
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
        ],
      );
      return;
    }

    // Check vehicle/license requirements from already-fetched candidate data
    if (requiresVehicle || requiresDriverLicense) {
      if (requiresVehicle && providerHasVehicle === false) {
        Alert.alert(
          t("instantJob.drivingRequirementTitle"),
          t("instantJob.providerMissingVehicle"),
        );
        return;
      }
      if (
        requiresDriverLicense &&
        providerHasLicense === false &&
        providerHasVehicle !== true
      ) {
        Alert.alert(
          t("instantJob.drivingRequirementTitle"),
          t("instantJob.providerMissingDriverLicense"),
        );
        return;
      }
    }

    // All validation passed — show summary page
    setShowSummary(true);
  };

  const handleSubmitRequest = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("jobs.notSignedIn"), t("jobs.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

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
        type: jobType,
        location,
        city,
        country,
        lat,
        lng,
        startDate: startDateTime,
        isInstantBook: true,
      };

      if (endDate) {
        payload.endDate = endDate.toISOString();
      }
      if (rateAmount && parseFloat(rateAmount) > 0) {
        payload.rateAmount = Math.round(parseFloat(rateAmount) * 100);
        payload.currency = currencyVal;
        payload.paymentType = paymentType;
      }
      if (requiresVehicle) payload.requiresVehicle = true;
      if (requiresDriverLicense) payload.requiresDriverLicense = true;
      const filteredReqs = requirements.filter((r) => r.trim());
      if (filteredReqs.length > 0) payload.requirements = filteredReqs;
      const filteredResps = responsibilities.filter((r) => r.trim());
      if (filteredResps.length > 0) payload.responsibilities = filteredResps;

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
          },
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
            ],
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
            ],
          );
          return;
        }

        // Step 3: Show success and navigate to applicant details
        Alert.alert(
          t("instantJob.requestSent"),
          t("instantJob.requestSentMessage"),
          [
            {
              text: t("common.ok"),
              onPress: () =>
                router.push({
                  pathname: "/applicant/[id]",
                  params: {
                    id: applicationId,
                    instantJob: "true",
                  },
                } as any),
            },
          ],
        );
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
          ],
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
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.06)",
              },
            ]}
            onPress={() => {
              if (showSummary) {
                setShowSummary(false);
              } else {
                router.back();
              }
            }}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {showSummary
              ? t("instantJob.reviewRequest")
              : t("instantJob.requestInstantJob")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {showSummary ? (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Provider Info Card */}
            {candidateData && (
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.06)"
                      : "rgba(255,250,240,0.95)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.2)"
                      : "rgba(184,130,42,0.1)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.summaryCardTitle,
                    { color: isDark ? "#C9963F" : "#B8822A" },
                  ]}
                >
                  {t("instantJob.serviceProvider")}
                </Text>
                <View style={styles.summaryProviderRow}>
                  {candidateData.avatar ? (
                    <Image
                      source={{ uri: candidateData.avatar }}
                      style={styles.summaryAvatarImage}
                    />
                  ) : (
                    <View style={styles.summaryAvatar}>
                      <View
                        style={[
                          styles.summaryAvatarInner,
                          {
                            backgroundColor: isDark
                              ? "rgba(201,150,63,0.2)"
                              : "rgba(184,130,42,0.1)",
                          },
                        ]}
                      >
                        <Feather
                          name="user"
                          size={24}
                          color={isDark ? "#C9963F" : "#B8822A"}
                        />
                      </View>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.summaryProviderName,
                        { color: colors.text },
                      ]}
                    >
                      {candidateData.firstName} {candidateData.lastName}
                    </Text>
                    {candidateData.skills &&
                      candidateData.skills.length > 0 && (
                        <Text
                          style={[
                            styles.summaryProviderSkills,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.6)"
                                : "rgba(0,0,0,0.5)",
                            },
                          ]}
                        >
                          {candidateData.skills
                            .slice(0, 3)
                            .map((s: any) => s.name || s)
                            .join(" · ")}
                        </Text>
                      )}
                  </View>
                </View>

                {/* Provider Availability */}
                {candidateData.availability &&
                  candidateData.availability.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text
                        style={[styles.summarySubTitle, { color: colors.text }]}
                      >
                        <Feather
                          name="calendar"
                          size={14}
                          color={isDark ? "#C9963F" : "#B8822A"}
                        />{" "}
                        {t("instantJob.providerAvailability")}
                      </Text>
                      {candidateData.availability.map(
                        (avail: any, idx: number) => (
                          <View
                            key={avail.id || idx}
                            style={[
                              styles.summaryAvailItem,
                              {
                                backgroundColor: isDark
                                  ? "rgba(16,185,129,0.08)"
                                  : "rgba(5,150,105,0.06)",
                                borderColor: isDark
                                  ? "rgba(16,185,129,0.2)"
                                  : "rgba(5,150,105,0.15)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.summaryAvailText,
                                { color: colors.text },
                              ]}
                            >
                              {new Date(avail.start).toLocaleDateString(
                                undefined,
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}{" "}
                              {new Date(avail.start).toLocaleTimeString(
                                undefined,
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}{" "}
                              -{" "}
                              {new Date(avail.end).toLocaleTimeString(
                                undefined,
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                              {avail.isRecurring ? " ↻" : ""}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
              </View>
            )}

            {/* Job Details Summary */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,250,240,0.06)"
                    : "rgba(255,250,240,0.95)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.2)"
                    : "rgba(184,130,42,0.1)",
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryCardTitle,
                  { color: isDark ? "#C9963F" : "#B8822A" },
                ]}
              >
                {t("instantJob.jobDetails")}
              </Text>

              <View style={styles.summaryRow}>
                <Text
                  style={[
                    styles.summaryLabel,
                    {
                      color: isDark
                        ? "rgba(255,250,240,0.6)"
                        : "rgba(0,0,0,0.5)",
                    },
                  ]}
                >
                  {t("instantJob.jobTitle")}
                </Text>
                <Text
                  style={[styles.summaryValue, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text
                  style={[
                    styles.summaryLabel,
                    {
                      color: isDark
                        ? "rgba(255,250,240,0.6)"
                        : "rgba(0,0,0,0.5)",
                    },
                  ]}
                >
                  {t("jobs.categoryLabel")}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {category === "Other" ? customCategory : category}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text
                  style={[
                    styles.summaryLabel,
                    {
                      color: isDark
                        ? "rgba(255,250,240,0.6)"
                        : "rgba(0,0,0,0.5)",
                    },
                  ]}
                >
                  {t("jobs.locationLabel")}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {location}, {city}, {country}
                </Text>
              </View>

              {startDate && startTime && (
                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      {
                        color: isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.5)",
                      },
                    ]}
                  >
                    {t("jobs.startDate")}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {startDate.toLocaleDateString()}{" "}
                    {startTime.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}

              {endDate && (
                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      {
                        color: isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.5)",
                      },
                    ]}
                  >
                    {t("jobs.endDate")}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {endDate.toLocaleDateString()}
                  </Text>
                </View>
              )}

              {rateAmount && parseFloat(rateAmount) > 0 && (
                <View style={styles.summaryRow}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      {
                        color: isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.5)",
                      },
                    ]}
                  >
                    {t("instantJob.payment")}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {currencyVal} {rateAmount} / {paymentType.toLowerCase()}
                  </Text>
                </View>
              )}

              {requirements.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      {
                        color: isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.5)",
                        marginBottom: 4,
                      },
                    ]}
                  >
                    {t("jobs.requirements")}
                  </Text>
                  {requirements.map((req, i) => (
                    <Text
                      key={i}
                      style={[styles.summaryBullet, { color: colors.text }]}
                    >
                      • {req}
                    </Text>
                  ))}
                </View>
              )}

              {responsibilities.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      {
                        color: isDark
                          ? "rgba(255,250,240,0.6)"
                          : "rgba(0,0,0,0.5)",
                        marginBottom: 4,
                      },
                    ]}
                  >
                    {t("jobs.responsibilities")}
                  </Text>
                  {responsibilities.map((resp, i) => (
                    <Text
                      key={i}
                      style={[styles.summaryBullet, { color: colors.text }]}
                    >
                      • {resp}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Info Banner */}
            <View
              style={[
                styles.summaryInfoBanner,
                {
                  backgroundColor: isDark
                    ? "rgba(59,130,246,0.08)"
                    : "rgba(59,130,246,0.06)",
                  borderColor: isDark
                    ? "rgba(59,130,246,0.2)"
                    : "rgba(59,130,246,0.15)",
                },
              ]}
            >
              <Feather
                name="info"
                size={18}
                color={isDark ? "#60A5FA" : "#3B82F6"}
                style={{ marginRight: 10, marginTop: 2 }}
              />
              <Text
                style={[
                  styles.summaryInfoText,
                  {
                    color: isDark ? "rgba(255,250,240,0.8)" : "rgba(0,0,0,0.7)",
                  },
                ]}
              >
                {t("instantJob.requestWillBeSent")}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableButton
              style={[
                styles.submitBtn,
                {
                  backgroundColor: loading
                    ? isDark
                      ? "rgba(255,250,240,0.1)"
                      : "#ccc"
                    : isDark
                      ? "#10B981"
                      : "#059669",
                  borderColor: loading
                    ? "transparent"
                    : isDark
                      ? "#10B981"
                      : "#059669",
                  shadowColor: isDark ? "#10B981" : "#059669",
                },
                loading && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmitRequest}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFAF0" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather
                    name="send"
                    size={18}
                    color="#FFFAF0"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitBtnText}>
                    {t("instantJob.sendRequest")}
                  </Text>
                </View>
              )}
            </TouchableButton>
          </ScrollView>
        ) : (
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
                  color={isDark ? "rgba(255,250,240,0.6)" : "rgba(0,0,0,0.4)"}
                />
              </TouchableButton>

              {category === "Other" && (
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

              <InputLabel
                text={(() => {
                  const key = "jobs.workMode";
                  const translated = t(key);
                  return translated === key ? "Work Mode" : translated;
                })()}
                required
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
                    {currencyVal}
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
                required
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
                    {startDate ? startDate.toLocaleDateString() : "Select Date"}
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
                      : "Select Time"}
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
                    const key = "settings.cityPlaceholder";
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
                      color={
                        isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.3)"
                      }
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
                      setRequirements(
                        requirements.filter((_, idx) => idx !== i),
                      )
                    }
                    style={{ padding: 4 }}
                  >
                    <Feather
                      name="x"
                      size={16}
                      color={
                        isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.3)"
                      }
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
                      setResponsibilities([
                        ...responsibilities,
                        newResp.trim(),
                      ]);
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
                      color={
                        isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.3)"
                      }
                    />
                  </TouchableButton>
                </View>
              ))}

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
                        thumbColor={
                          requiresDriverLicense ? "#FFFAF0" : "#f4f3f4"
                        }
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
                    {((requiresVehicle && providerHasVehicle === false) ||
                      (requiresDriverLicense &&
                        providerHasLicense === false &&
                        providerHasVehicle !== true)) && (
                      <View
                        style={[
                          styles.drivingHintBanner,
                          {
                            backgroundColor: isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.08)",
                            borderColor: isDark
                              ? "rgba(201,150,63,0.25)"
                              : "rgba(184,130,42,0.2)",
                          },
                        ]}
                      >
                        <Feather
                          name="info"
                          size={18}
                          color={isDark ? "#C9963F" : "#B8822A"}
                        />
                        <Text
                          style={[
                            styles.drivingHintText,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.85)"
                                : "#4A4335",
                            },
                          ]}
                        >
                          {t("instantJob.drivingRequirementsHint")}
                        </Text>
                      </View>
                    )}
                    {requiresVehicle && providerHasVehicle === false && (
                      <View
                        style={[
                          styles.drivingHintBanner,
                          {
                            backgroundColor: isDark
                              ? "rgba(239,68,68,0.12)"
                              : "rgba(220,38,38,0.08)",
                            borderColor: isDark
                              ? "rgba(239,68,68,0.25)"
                              : "rgba(220,38,38,0.2)",
                          },
                        ]}
                      >
                        <Feather
                          name="alert-circle"
                          size={18}
                          color={isDark ? "#EF4444" : "#DC2626"}
                        />
                        <Text
                          style={[
                            styles.drivingHintText,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.85)"
                                : "#4A4335",
                            },
                          ]}
                        >
                          {t("instantJob.providerNoVehicle")}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {(() => {
                const vehicleBlocked =
                  requiresVehicle && providerHasVehicle === false;
                const licenseBlocked =
                  requiresDriverLicense &&
                  providerHasLicense === false &&
                  providerHasVehicle !== true;
                const isDisabled =
                  loading ||
                  isRestrictedSector ||
                  vehicleBlocked ||
                  licenseBlocked;
                return (
                  <TouchableButton
                    style={[
                      styles.submitBtn,
                      {
                        backgroundColor: isDisabled
                          ? isDark
                            ? "rgba(255,250,240,0.1)"
                            : "#ccc"
                          : isDark
                            ? "#10B981"
                            : "#059669",
                        borderColor: isDisabled
                          ? "transparent"
                          : isDark
                            ? "#10B981"
                            : "#059669",
                        shadowColor: isDark ? "#10B981" : "#059669",
                      },
                      isDisabled && styles.submitBtnDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={isDisabled}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFAF0" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {t("instantJob.continue")}
                      </Text>
                    )}
                  </TouchableButton>
                );
              })()}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
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
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: category === cat.value ? 0 : 1,
                      borderColor:
                        category === cat.value
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
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
                        color: category === cat.value ? "#FFFAF0" : colors.text,
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
              ].map((c) => (
                <TouchableButton
                  key={c.value}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor:
                        currencyVal === c.value
                          ? isDark
                            ? "#C9963F"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.06)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: currencyVal === c.value ? 0 : 1,
                      borderColor:
                        currencyVal === c.value
                          ? "transparent"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setCurrencyVal(c.value);
                    setShowCurrencyModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {
                        color:
                          currencyVal === c.value ? "#FFFAF0" : colors.text,
                        fontWeight: currencyVal === c.value ? "600" : "500",
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
  drivingHintBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  drivingHintText: {
    fontSize: 13,
    lineHeight: 19,
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
  // Summary page styles
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  summaryProviderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryAvatar: {
    width: 48,
    height: 48,
  },
  summaryAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  summaryAvatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryProviderName: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryProviderSkills: {
    fontSize: 13,
    marginTop: 2,
  },
  summarySubTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  summaryAvailItem: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  summaryAvailText: {
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  summaryLabel: {
    fontSize: 13,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1.5,
    textAlign: "right",
  },
  summaryBullet: {
    fontSize: 13,
    paddingLeft: 8,
    marginBottom: 2,
  },
  summaryInfoBanner: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  summaryInfoText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
