import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import GradientBackground from "../components/GradientBackground";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import { TouchableButton } from "../components/TouchableButton";
import EmailVerificationBanner from "../components/EmailVerificationBanner";

export default function EmployerHome() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<{
    firstName: string;
    lastName: string;
    isVerified: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    hasAddress: boolean;
  } | null>(null);

  const [activeBooking, setActiveBooking] = useState<{
    id: string;
    job?: { title: string };
    jobSeeker?: { firstName: string; lastName: string };
  } | null>(null);

  const fetchProfile = async () => {
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
        const profileData = data.profile;
        const isVerified = !!(u.emailVerifiedAt && u.phoneVerifiedAt);
        
        // Check address verification (must have addressLine1 or city and country)
        // Check both EmployerProfile and UserProfile (fallback)
        // Handle both null/undefined and empty strings
        const hasAddressLine1 = profileData?.addressLine1 && profileData.addressLine1.trim().length > 0;
        const hasCity = profileData?.city && profileData.city.trim().length > 0;
        const hasCountry = profileData?.country && profileData.country.trim().length > 0;
        let addressVerified = hasAddressLine1 || (hasCity && hasCountry);
        
        // If employer profile doesn't have address, check user profile as fallback
        if (!addressVerified && data.userProfile) {
          const userProfile = data.userProfile;
          const userHasAddressLine1 = userProfile?.addressLine1 && userProfile.addressLine1.trim().length > 0;
          const userHasCity = userProfile?.city && userProfile.city.trim().length > 0;
          const userHasCountry = userProfile?.country && userProfile.country.trim().length > 0;
          addressVerified = userHasAddressLine1 || (userHasCity && userHasCountry);
        }

        setProfile({
          firstName: u.firstName,
          lastName: u.lastName,
          isVerified: isVerified,
          emailVerified: !!u.emailVerifiedAt,
          phoneVerified: !!u.phoneVerifiedAt,
          hasAddress: !!addressVerified,
        });
      }
    } catch (err) {
      console.log("Error fetching employer profile", err);
    }
  };

  const fetchActiveBooking = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        console.log("No auth token found for booking fetch");
        return;
      }
      const base = getApiBase();
      console.log(
        "Fetching active bookings from:",
        `${base}/bookings/employer/me`
      );

      // Fetch IN_PROGRESS bookings first
      const res = await fetch(
        `${base}/bookings/employer/me?status=IN_PROGRESS`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log("IN_PROGRESS bookings:", data);
        if (data && data.length > 0) {
          console.log("Setting active booking (IN_PROGRESS):", data[0]);
          setActiveBooking(data[0]);
          return;
        }
      } else {
        console.log("Failed to fetch IN_PROGRESS bookings:", res.status);
      }

      // If no in-progress, check confirmed
      const res2 = await fetch(
        `${base}/bookings/employer/me?status=CONFIRMED`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res2.ok) {
        const data2 = await res2.json();
        console.log("CONFIRMED bookings:", data2);
        if (data2 && data2.length > 0) {
          console.log("Setting active booking (CONFIRMED):", data2[0]);
          setActiveBooking(data2[0]);
          return;
        }
      } else {
        console.log("Failed to fetch CONFIRMED bookings:", res2.status);
      }

      console.log("No active bookings found");
      setActiveBooking(null);
    } catch (e: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (e?.message && !e.message.includes("Network request failed")) {
        console.error("Error fetching active booking:", e);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchActiveBooking();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    await fetchActiveBooking();
    setRefreshing(false);
  };

  const handlePostJob = () => {
    if (!profile?.emailVerified || !profile?.phoneVerified || !profile?.hasAddress) {
      const missing = [];
      if (!profile?.emailVerified) missing.push("Email");
      if (!profile?.phoneVerified) missing.push("Phone");
      if (!profile?.hasAddress) missing.push("Address");
      Alert.alert(
        "Verification Required",
        `Please complete your verification before posting jobs. Missing: ${missing.join(", ")}. Please go to Settings to complete your verification.`
      );
      return;
    }
    router.push("/post-job" as never);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          }
        >
          {profile && (
            <EmailVerificationBanner
              emailVerified={profile?.emailVerified ?? true}
              onVerify={() => fetchProfile()}
            />
          )}
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.text }]}>
                {t("home.welcome")},
              </Text>
              <Text style={[styles.nameText, { color: colors.tint }]}>
                {profile?.firstName || t("home.employer")}
              </Text>
            </View>
          </View>

          {/* Quick Switch */}
          <View style={{ gap: 12, marginBottom: 32 }}>
            <TouchableButton
              style={[
                styles.switchBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.7)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "transparent",
                  borderWidth: isDark ? 1 : 0,
                },
              ]}
              onPress={() => router.push("/employer-tabs" as never)}
            >
              <Feather
                name="home"
                size={16}
                color={colors.text}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.switchText, { color: colors.text }]}>
                {t("home.cumpridoHome")}
              </Text>
              <Feather
                name="arrow-right"
                size={16}
                color={colors.text}
                style={{ marginLeft: "auto" }}
              />
            </TouchableButton>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t("home.quickActions")}
          </Text>

          {/* Post a Job Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.85)" : "#fff",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
              },
            ]}
          >
            <View style={styles.cardIconRow}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(79, 70, 229, 0.3)"
                      : "#e0e7ff",
                  },
                ]}
              >
                <Feather
                  name="plus-circle"
                  size={24}
                  color={isDark ? "#a5b4fc" : "#4f46e5"}
                />
              </View>
              {!profile?.isVerified && (
                <View style={[styles.badge, { backgroundColor: "#ef4444" }]}>
                  <Feather
                    name="lock"
                    size={12}
                    color="#fff"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.badgeText}>{t("home.verificationRequired")}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("home.postJob")}
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { color: isDark ? "#9ca3af" : "#6b7280" },
              ]}
            >
              {t("home.postJobDescription")}
            </Text>
            <TouchableButton
              style={[
                styles.actionBtn,
                {
                  backgroundColor: profile?.isVerified
                    ? "#4f46e5"
                    : isDark
                      ? "rgba(79, 70, 229, 0.5)"
                      : "#a5b4fc",
                  opacity: profile?.isVerified ? 1 : 0.7,
                },
              ]}
              onPress={handlePostJob}
              disabled={!profile?.isVerified}
            >
              <Text style={[
                styles.actionBtnText,
                { 
                  color: profile?.isVerified 
                    ? (isDark ? "#e0e7ff" : "#ffffff")
                    : (isDark ? "#f8fafc" : "#ffffff")
                }
              ]}>
                {profile?.isVerified ? t("home.createListing") : t("home.verifyToPost")}
              </Text>
            </TouchableButton>
          </View>

          {/* Manage Applications Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.85)" : "#fff",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
              },
            ]}
          >
            <View style={styles.cardIconRow}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isDark
                      ? "rgba(79, 70, 229, 0.3)"
                      : "#e0e7ff",
                  },
                ]}
              >
                <Feather
                  name="users"
                  size={24}
                  color={isDark ? "#a5b4fc" : "#4f46e5"}
                />
              </View>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("home.manageApplications")}
            </Text>
            <Text
              style={[
                styles.cardDesc,
                { color: isDark ? "#9ca3af" : "#6b7280" },
              ]}
            >
              {t("home.manageApplicationsDescription")}
            </Text>
            <TouchableButton
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(79, 70, 229, 0.8)"
                    : "#4f46e5",
                },
              ]}
              onPress={() => router.push("/manage-applications" as never)}
            >
              <Text style={[styles.actionBtnText, { color: isDark ? "#e0e7ff" : "#ffffff" }]}>{t("home.viewApplications")}</Text>
            </TouchableButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 24 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  welcomeText: { fontSize: 16, opacity: 0.8 },
  nameText: { fontSize: 32, fontWeight: "800", marginTop: 4 },

  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  switchText: { fontWeight: "600", fontSize: 14 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },

  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: Platform.OS === "android" ? 0 : 5,
  },
  cardIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  cardTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  cardDesc: { fontSize: 14, lineHeight: 20, marginBottom: 20 },

  actionBtn: {
    backgroundColor: "#4f46e5", // primary brand color usually, or allow dynamic
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnText: { fontWeight: "700", fontSize: 15 },
});
