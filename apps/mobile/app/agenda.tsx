import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import * as SecureStore from "expo-secure-store";

interface BookingItem {
  id: string;
  startTime?: string;
  status: string;
  title?: string;
  jobId?: string;
  applicationId?: string | null;
  job?: {
    id: string;
    title: string;
    location?: string;
    city?: string;
    country?: string;
  };
  employer?: {
    firstName?: string;
    lastName?: string;
    location?: string;
    city?: string;
    country?: string;
  };
}

export default function Agenda() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("agenda.dateTBD");
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const locale = language === "pt" ? "pt-PT" : "en-US";
    const timeStr = date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });

    if (bookingDate.getTime() === today.getTime()) {
      return t("agenda.today", { time: timeStr });
    } else if (bookingDate.getTime() === tomorrow.getTime()) {
      return t("agenda.tomorrow", { time: timeStr });
    } else {
      return date.toLocaleDateString(locale, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return isDark ? "#60a5fa" : "#2563eb";
      case "CONFIRMED":
        return isDark ? "#94a3b8" : "#64748b";
      case "COMPLETED":
        return isDark ? "#22c55e" : "#059669";
      case "PENDING":
        return isDark ? "#fbbf24" : "#d97706";
      default:
        return isDark ? "#94a3b8" : "#64748b";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return t("agenda.inProgress");
      case "CONFIRMED":
        return t("agenda.confirmed");
      case "COMPLETED":
        return t("agenda.completed");
      case "PENDING":
        return t("agenda.pending");
      default:
        return status;
    }
  };

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      // Fetch all bookings for the job seeker, ordered by startTime
      const res = await fetch(`${base}/bookings/seeker/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Sort by startTime, upcoming first
        const sorted = (data || []).sort((a: BookingItem, b: BookingItem) => {
          if (!a.startTime) return 1;
          if (!b.startTime) return -1;
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
        setBookings(sorted);
      } else {
        setBookings([]);
      }
    } catch (err) {
      // Silently handle network errors - no logging
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const getAddress = (booking: BookingItem) => {
    if (booking.job?.location) {
      const parts = [booking.job.location, booking.job.city, booking.job.country].filter(Boolean);
      return parts.join(", ") || t("agenda.locationTBD");
    }
    if (booking.employer?.location) {
      const parts = [booking.employer.location, booking.employer.city, booking.employer.country].filter(Boolean);
      return parts.join(", ") || t("agenda.locationTBD");
    }
    return t("agenda.locationTBD");
  };

  const getJobTitle = (booking: BookingItem) => {
    return booking.job?.title || booking.title || t("agenda.serviceRequest");
  };

  const handleBookingPress = async (booking: BookingItem) => {
    // If there's an applicationId, navigate directly to application details
    if (booking.applicationId) {
      router.push(`/my-application/${booking.applicationId}` as any);
      return;
    }

    // If there's a jobId but no applicationId, try to find the application
    if (booking.jobId) {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const base = getApiBase();
        // Fetch user's applications to find the one for this job
        const res = await fetch(`${base}/applications/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const applications = Array.isArray(data) ? data : (data.applications || []);
          const application = applications.find((app: any) => 
            (app.job?.id === booking.jobId || app.jobId === booking.jobId)
          );

          if (application?.id) {
            // Found the application, navigate to it
            router.push(`/my-application/${application.id}` as any);
            return;
          }
        }
      } catch (err) {
        console.log("Error finding application:", err);
      }

      // Fallback: navigate to job details if application not found
      router.push(`/jobs/${booking.jobId}` as any);
    }
  };

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t("agenda.title")}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: isDark ? "#94a3b8" : "#64748b" }]}>{t("agenda.loadingBookings")}</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.center}>
            <Feather name="calendar" size={64} color={isDark ? "#475569" : "#cbd5e1"} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("agenda.noBookings")}</Text>
            <Text style={[styles.emptySub, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {t("agenda.noBookingsMessage")}
            </Text>
          </View>
        ) : (
        <FlatList
            data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#ffffff",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  shadowColor: isDark ? "#000" : "#000",
                }
              ]}
              onPress={() => handleBookingPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                  <Text style={[styles.date, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                    {formatDate(item.startTime)}
                  </Text>
                  <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
                <Text style={[styles.jobTitle, { color: colors.text }]}>
                  {getJobTitle(item)}
                </Text>
                <View style={styles.locationRow}>
                  <Feather 
                    name="map-pin" 
                    size={14} 
                    color={isDark ? "#94a3b8" : "#64748b"} 
                  />
                  <Text style={[styles.address, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                    {getAddress(item)}
                  </Text>
                </View>
                <View style={styles.cardFooter}>
                  <Feather 
                    name="chevron-right" 
                    size={20} 
                    color={isDark ? "#6366f1" : "#4f46e5"} 
                  />
                </View>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  list: { padding: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  date: { fontSize: 13, fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "600" },
  jobTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  address: { fontSize: 14 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
    lineHeight: 20,
  },
});
