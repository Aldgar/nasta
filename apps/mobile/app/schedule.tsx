import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { TouchableWithoutFeedback } from "react-native";

// Configure calendar locale
LocaleConfig.locales["pt"] = {
  monthNames: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],
  monthNamesShort: [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ],
  dayNames: [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  today: "Hoje",
};

LocaleConfig.locales["en"] = {
  monthNames: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthNamesShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  dayNames: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};

interface AvailabilitySlot {
  id: string;
  start: string;
  end: string;
  timezone?: string;
}

export default function Schedule() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<"EMPLOYER" | "JOB_SEEKER">("EMPLOYER");

  // Set calendar locale based on user's language
  useEffect(() => {
    LocaleConfig.defaultLocale = language;
  }, [language]);

  // Fetch user role and existing availability
  const fetchData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/");
        return;
      }

      const base = getApiBase();

      // Get user role from profile
      const profileRes = await fetch(`${base}/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const role = (profileData.user?.role || "").toUpperCase();
        setUserRole(role === "EMPLOYER" ? "EMPLOYER" : "JOB_SEEKER");
      }

      // Fetch existing availability
      setLoading(true);
      const availRes = await fetch(`${base}/availability/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (availRes.ok) {
        const slots: AvailabilitySlot[] = await availRes.json();
        setAvailabilitySlots(slots);

        // Mark dates that have availability slots
        const datesWithSlots = new Set<string>();
        slots.forEach((slot) => {
          const startDate = new Date(slot.start);
          const endDate = new Date(slot.end);
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split("T")[0];
            datesWithSlots.add(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
        setSelectedDates(datesWithSlots);
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes("Network request failed")) {
        console.error("Error fetching availability:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onDayPress = (day: DateData) => {
    const dateStr = day.dateString;
    setSelectedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  const saveAvailability = async () => {
    if (selectedDates.size === 0) {
      Alert.alert(t("schedule.noDatesSelected"), t("schedule.selectAtLeastOneDate"));
      return;
    }

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/");
        return;
      }

      setSaving(true);
      const base = getApiBase();

      // Delete existing slots first
      for (const slot of availabilitySlots) {
        try {
          await fetch(`${base}/availability/${slot.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Ignore delete errors
        }
      }

      // Create new slots for selected dates
      // Group consecutive dates into ranges
      const sortedDates = Array.from(selectedDates).sort();
      const dateRanges: { start: string; end: string }[] = [];

      if (sortedDates.length > 0) {
        let rangeStart = sortedDates[0];
        let rangeEnd = sortedDates[0];

        for (let i = 1; i < sortedDates.length; i++) {
          const currentDate = new Date(sortedDates[i]);
          const prevDate = new Date(sortedDates[i - 1]);
          const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (daysDiff === 1) {
            // Consecutive date, extend range
            rangeEnd = sortedDates[i];
          } else {
            // Gap found, save current range and start new one
            dateRanges.push({ start: rangeStart, end: rangeEnd });
            rangeStart = sortedDates[i];
            rangeEnd = sortedDates[i];
          }
        }
        // Add the last range
        dateRanges.push({ start: rangeStart, end: rangeEnd });
      }

      // Create availability slots for each range
      for (const range of dateRanges) {
        const startDate = new Date(range.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(range.end);
        endDate.setHours(23, 59, 59, 999);

        await fetch(`${base}/availability/upsert`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          }),
        });
      }

      Alert.alert(t("common.success"), t("schedule.availabilitySavedSuccessfully"));
      await fetchData(); // Refresh the list
    } catch (err: any) {
      console.error("Error saving availability:", err);
      Alert.alert(t("common.error"), t("schedule.failedToSaveAvailability"));
    } finally {
      setSaving(false);
    }
  };

  const clearAll = () => {
    Alert.alert(
      t("schedule.clearAvailability"),
      t("schedule.clearAllDatesConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.clear"),
          style: "destructive",
          onPress: () => {
            setSelectedDates(new Set());
          },
        },
      ]
    );
  };

  const themeCalendar = {
    calendarBackground: "transparent",
    textSectionTitleColor: isDark ? "#b6c1cd" : "#2d4150",
    selectedDayBackgroundColor: colors.tint,
    selectedDayTextColor: isDark ? "#e0e7ff" : "#ffffff",
    todayTextColor: colors.tint,
    dayTextColor: isDark ? "#d9e1e8" : "#2d4150",
    textDisabledColor: isDark ? "#4d5b6b" : "#d9e1e8",
    dotColor: colors.tint,
    selectedDotColor: "#ffffff",
    arrowColor: isDark ? "white" : "black",
    monthTextColor: isDark ? "white" : "black",
    indicatorColor: colors.tint,
  };

  // Build marked dates object for calendar
  const markedDates: { [key: string]: any } = {};
  selectedDates.forEach((dateStr) => {
    markedDates[dateStr] = {
      selected: true,
      selectedColor: colors.tint,
      selectedTextColor: isDark ? "#1e1b4b" : "#ffffff",
    };
  });

  const roleLabel = userRole === "EMPLOYER" ? t("auth.employer") : t("auth.serviceProvider");

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header with Back Button */}
        <View style={styles.header}>
          <TouchableWithoutFeedback onPress={() => router.back()}>
            <View
              style={[
                styles.backBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </View>
          </TouchableWithoutFeedback>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("schedule.myAvailability")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                {t("schedule.loadingAvailability")}
              </Text>
            </View>
          ) : (
            <>
              <Calendar
                onDayPress={onDayPress}
                markedDates={markedDates}
                theme={themeCalendar}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                  height: 350,
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.5)"
                    : "rgba(255, 255, 255, 0.7)",
                }}
              />

              {/* Info Card */}
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.85)"
                      : "#ffffff",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "#e5e7eb",
                  },
                ]}
              >
                <Text style={[styles.infoTitle, { color: colors.text }]}>
                  {t("schedule.availabilityTitle", { role: roleLabel })}
                </Text>
                <Text
                  style={[
                    styles.infoText,
                    { color: isDark ? "#cbd5e1" : "#6b7280" },
                  ]}
                >
                  {t("schedule.availabilityDescription")}
                </Text>
                <Text
                  style={[
                    styles.infoSubtext,
                    { color: isDark ? "#94a3b8" : "#9ca3af" },
                  ]}
                >
                  {t("schedule.datesSelected", { count: selectedDates.size })}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableWithoutFeedback onPress={clearAll}>
                  <View
                    style={[
                      styles.clearButton,
                      {
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(239, 68, 68, 0.1)",
                        borderColor: isDark
                          ? "rgba(239, 68, 68, 0.5)"
                          : "rgba(239, 68, 68, 0.3)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.clearButtonText,
                        { color: "#ef4444" },
                      ]}
                    >
                      {t("schedule.clearAll")}
                    </Text>
                  </View>
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback
                  onPress={saveAvailability}
                  disabled={saving || selectedDates.size === 0}
                >
                  <View
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor:
                          saving || selectedDates.size === 0
                            ? isDark
                              ? "rgba(99, 102, 241, 0.4)"
                              : "rgba(79, 70, 229, 0.3)"
                            : isDark
                            ? "#6366f1"
                            : colors.tint,
                        opacity: saving || selectedDates.size === 0 ? 0.6 : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color={isDark ? "#e0e7ff" : "#ffffff"} />
                    ) : (
                      <Text style={[styles.saveButtonText, { color: isDark ? "#e0e7ff" : "#ffffff" }]}>{t("schedule.saveAvailability")}</Text>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </>
          )}
        </ScrollView>
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  infoCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  infoSubtext: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: "italic",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
