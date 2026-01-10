import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Platform, Image, ScrollView, Alert, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { TouchableButton } from "../../components/TouchableButton";
import ActionBanner from "../../components/ActionBanner";
import TemporaryPasswordBanner from "../../components/TemporaryPasswordBanner";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface CandidateItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  city?: string;
  country?: string;
  location?: string;
  bio?: string;
  headline?: string;
  skills: Array<{
    id: string;
    name: string;
    proficiency: string;
    yearsExp?: number;
  }>;
  skillsSummary: string[];
  rating: number;
  ratingCount: number;
  cvUrl?: string;
  hourlyRate?: number; // Keep for backward compatibility
  rates?: Array<{
    rate: number;
    paymentType: string;
    otherSpecification?: string;
  }>;
}

export default function EmployerFeed() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [userName, setUserName] = useState<string>("");
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);
  const [hasTemporaryPassword, setHasTemporaryPassword] = useState(false);

  const [activeBooking, setActiveBooking] = useState<{
    id: string;
    status?: string;
    job?: { title: string };
    jobSeeker?: { firstName: string; lastName: string };
  } | null>(null);

  useEffect(() => {
    fetchCandidates();
    fetchActiveBooking();
    fetchProfile();
  }, []);

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
        const profile = data.profile;
        if (u?.firstName) {
          setUserName(u.firstName);
        }
        // Check email verification
        setEmailVerified(!!u?.emailVerifiedAt);
        // Check phone verification
        setPhoneVerified(!!u?.phoneVerifiedAt);
        // Check address verification (must have addressLine1 or city and country)
        // Check both EmployerProfile and UserProfile (fallback)
        // Handle both null/undefined and empty strings
        const hasAddressLine1 = profile?.addressLine1 && profile.addressLine1.trim().length > 0;
        const hasCity = profile?.city && profile.city.trim().length > 0;
        const hasCountry = profile?.country && profile.country.trim().length > 0;
        let addressVerified = hasAddressLine1 || (hasCity && hasCountry);
        
        // If employer profile doesn't have address, check user profile as fallback
        if (!addressVerified && data.userProfile) {
          const userProfile = data.userProfile;
          const userHasAddressLine1 = userProfile?.addressLine1 && userProfile.addressLine1.trim().length > 0;
          const userHasCity = userProfile?.city && userProfile.city.trim().length > 0;
          const userHasCountry = userProfile?.country && userProfile.country.trim().length > 0;
          addressVerified = userHasAddressLine1 || (userHasCity && userHasCountry);
        }
        
        console.log('[EmployerFeed] Address verification check:', {
          employerProfile: profile ? { addressLine1: profile.addressLine1, city: profile.city, country: profile.country } : null,
          userProfile: data.userProfile ? { addressLine1: data.userProfile.addressLine1, city: data.userProfile.city, country: data.userProfile.country } : null,
          hasAddressLine1,
          hasCity,
          hasCountry,
          addressVerified
        });
        setHasAddress(addressVerified);
        // Check for temporary password flag
        setHasTemporaryPassword(!!data.hasTemporaryPassword);
      }
    } catch (err) {
      console.log("Error fetching profile", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchActiveBooking();
      fetchCandidates(); // Also refetch candidates when screen comes into focus
      fetchProfile(); // Refresh profile to update temporary password banner
    }, [])
  );

  const fetchActiveBooking = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        return;
      }
      const base = getApiBase();

      // Fetch IN_PROGRESS bookings first
      const res = await fetch(
        `${base}/bookings/employer/me?status=IN_PROGRESS`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setActiveBooking(data[0]);
          return;
        }
      } else if (res.status === 401) {
        // Token is invalid or expired
        console.warn("[EmployerFeed] Authentication failed in fetchActiveBooking - clearing token");
        await SecureStore.deleteItemAsync("auth_token");
        router.replace("/(auth)/login" as any);
        return;
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
        if (data2 && data2.length > 0) {
          setActiveBooking(data2[0]);
          return;
        }
      } else if (res2.status === 401) {
        // Token is invalid or expired
        console.warn("[EmployerFeed] Authentication failed in fetchActiveBooking - clearing token");
        await SecureStore.deleteItemAsync("auth_token");
        router.replace("/(auth)/login" as any);
        return;
      }

      setActiveBooking(null);
    } catch (e: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (e?.message && !e.message.includes('Network request failed')) {
        console.error("Error fetching active booking:", e);
      }
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        console.warn("[EmployerFeed] No auth token found");
        setLoading(false);
        return;
      }
      const base = getApiBase();
      const url = `${base}/users/candidates`;
      console.log(`[EmployerFeed] Fetching candidates from: ${url}`);
      // Health check is optional - skip verbose logging
      try {
        const healthController = new AbortController();
        const healthTimeout = setTimeout(() => healthController.abort(), 3000);
        await fetch(`${base}/health`, {
          method: "GET",
          signal: healthController.signal,
        }).catch(() => null);
        clearTimeout(healthTimeout);
      } catch {
        // Health check failed - this is okay, continue with main request
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutDuration = 15000; // 15 seconds
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);
      
      const fetchStartTime = Date.now();
      
      let res;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log(`[EmployerFeed] Fetch completed with status: ${res.status}`);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Handle network/timeout errors - server might be unavailable
        if (fetchError.name === 'AbortError') {
          console.warn(`[EmployerFeed] Request timeout - server took too long to respond`);
          setCandidates([]);
          setLoading(false);
          return;
        }
        
        if (fetchError.message === 'Network request failed' || 
            fetchError.message?.includes('Network request failed')) {
          console.warn(`[EmployerFeed] Cannot connect to server at ${base}. Please ensure:`);
          console.warn(`  1. Server is running (check terminal)`);
          console.warn(`  2. Server is accessible at ${base}`);
          console.warn(`  3. Device and computer are on the same network`);
          setCandidates([]);
          setLoading(false);
          return;
        }
        
        // Log other errors for debugging
        console.error(`[EmployerFeed] Fetch error: ${fetchError.message || 'Unknown error'}`);
        setCandidates([]);
        setLoading(false);
        return;
      }
      
      // If we get here, fetch succeeded (even if status is not 200)
      if (res && res.ok) {
        const data = await res.json();
        console.log(`[EmployerFeed] Raw response data:`, JSON.stringify(data).substring(0, 200));
        
        // Handle different response formats
        let candidatesList: any[] = [];
        if (Array.isArray(data)) {
          // Response is directly an array
          candidatesList = data;
        } else if (data.candidates && Array.isArray(data.candidates)) {
          // Response has candidates property
          candidatesList = data.candidates;
        } else if (data.data && Array.isArray(data.data)) {
          // Response has data property
          candidatesList = data.data;
        }
        
        console.log(`[EmployerFeed] Successfully fetched ${candidatesList.length} candidates`);
        console.log(`[EmployerFeed] Candidate IDs:`, candidatesList.map((c: any) => ({
          id: c.id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        })));
        
        if (candidatesList.length === 0) {
          console.warn(`[EmployerFeed] No candidates returned from server. This could mean:`);
          console.warn(`  - No fully verified candidates exist in the database`);
          console.warn(`  - All candidates must have: email verified, phone verified, ID verified, and background check approved`);
        }
        
        // Construct full avatar URLs for all candidates
        const candidatesWithFullAvatars = candidatesList.map((candidate: CandidateItem) => {
          if (candidate.avatar && !candidate.avatar.startsWith('http')) {
            candidate.avatar = `${base}/${candidate.avatar.startsWith('/') ? candidate.avatar.slice(1) : candidate.avatar}`;
          }
          return candidate;
        });
        
        console.log(`[EmployerFeed] Setting ${candidatesWithFullAvatars.length} candidates to state`);
        setCandidates(candidatesWithFullAvatars);
      } else if (res) {
        // Handle 401 Unauthorized - token is invalid or expired
        if (res.status === 401) {
          console.warn("[EmployerFeed] Authentication failed - clearing token and redirecting to login");
          await SecureStore.deleteItemAsync("auth_token");
          router.replace("/(auth)/login" as any);
          return;
        }
        
        // Non-200 response (but not 401) - log status for debugging
        try {
          const errorData = await res.json();
          console.error(`[EmployerFeed] Server returned ${res.status}:`, errorData.message || errorData.error || 'Unknown error');
        } catch {
          console.error(`[EmployerFeed] Server returned ${res.status}: Unable to parse error response`);
        }
        setCandidates([]);
      } else {
        // No response object - shouldn't happen but handle it
        console.error(`[EmployerFeed] No response object received`);
        setCandidates([]);
      }
    } catch (err: any) {
      // Silently handle network/timeout errors - they're expected when server is unavailable
      if (err?.message && 
          !err.message.includes('Network request failed') && 
          !err.message.includes('timeout') &&
          !err.message.includes('Cannot connect')) {
        console.error("[EmployerFeed] Unexpected error:", err.message);
      }
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const themeStyles = {
    textPrimary: { color: colors.text },
    textSecondary: { color: isDark ? "#94a3b8" : "#64748b" },
    iconColor: isDark ? "#e5e7eb" : "#4b5563",
    cardBg: { 
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.85)"
        : "rgba(255, 255, 255, 0.9)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
    },
    actionBtn: {
      backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "#fff",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0",
    },
  };

  const renderItem = ({ item }: { item: CandidateItem }) => {
    const fullName = `${item.firstName} ${item.lastName}`;
    const location = [item.city, item.country].filter(Boolean).join(", ") || item.location || t("jobs.locationNotSpecified");
    
    // Get skills with years of experience - prioritize skills array over skillsSummary
    const allSkills = item.skills && item.skills.length > 0 
      ? item.skills.map(s => ({ name: s.name, yearsExp: s.yearsExp || 0 }))
      : (item.skillsSummary || []).map(name => ({ name, yearsExp: 0 }));
    
    const displaySkills = allSkills.slice(0, 3);
    const totalSkillsCount = allSkills.length;
    
    return (
      <TouchableButton
        style={[styles.card, themeStyles.cardBg]}
        onPress={() => {
          // TODO: Navigate to candidate profile
          router.push(`/candidate/${item.id}` as any);
        }}
      >
        <View style={styles.candidateHeader}>
          <View style={styles.candidateInfo}>
            <View style={styles.avatarContainer}>
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.avatar}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error(`[EmployerFeed] Failed to load avatar for ${item.firstName} ${item.lastName}:`, error.nativeEvent.error);
                  }}
                  onLoad={() => {
                    console.log(`[EmployerFeed] Successfully loaded avatar for ${item.firstName} ${item.lastName}:`, item.avatar);
                  }}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0", justifyContent: "center", alignItems: "center" }]}>
                  <Feather name="user" size={24} color={isDark ? "rgba(255,255,255,0.5)" : "#94a3b8"} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.cardTitle, themeStyles.textPrimary]}>
                {fullName}
              </Text>
              {/* Rates below name - Show all rates */}
              {(item.rates && item.rates.length > 0) ? (
                <View style={{ marginTop: 4, marginBottom: 4, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {item.rates.map((rate, idx) => {
                    const paymentTypeLabel = rate.paymentType === "OTHER" && rate.otherSpecification
                      ? rate.otherSpecification
                      : rate.paymentType.charAt(0) + rate.paymentType.slice(1).toLowerCase();
                    return (
                      <Text key={idx} style={[styles.payout, { fontSize: 13, fontWeight: "700", marginTop: 2 }]}>
                        €{rate.rate}/{paymentTypeLabel}
                      </Text>
                    );
                  })}
                </View>
              ) : item.hourlyRate ? (
                <Text style={[styles.payout, { fontSize: 14, fontWeight: "700", marginTop: 4, marginBottom: 4 }]}>
                  €{item.hourlyRate}/hr
                </Text>
              ) : null}
              {item.headline && (
                <Text style={[styles.headline, themeStyles.textSecondary]} numberOfLines={1}>
                  {item.headline}
                </Text>
              )}
              {/* Rating - More Prominent */}
              <View style={styles.ratingRow}>
                <Feather name="star" size={16} color="#eab308" />
                <Text style={[styles.rating, { 
                  color: item.rating > 0 ? (isDark ? "#fbbf24" : "#ca8a04") : (isDark ? "rgba(255,255,255,0.5)" : "#94a3b8"),
                  fontWeight: "600",
                  fontSize: 13,
                }]}>
                  {item.rating > 0 ? item.rating.toFixed(1) : t("candidate.noRating")}
                  {item.ratingCount > 0 && ` (${item.ratingCount})`}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {item.bio && (
          <Text style={[styles.bio, themeStyles.textSecondary]} numberOfLines={2}>
            {item.bio}
          </Text>
        )}
        
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={12} color={isDark ? "#94a3b8" : "#64748b"} />
          <Text style={[styles.location, themeStyles.textSecondary]}>
            {location}
          </Text>
        </View>
        
        {/* Skills with Years of Experience */}
        {displaySkills.length > 0 && (
          <View style={styles.skillsContainer}>
            {displaySkills.map((skill, idx) => (
              <View
                key={idx}
                style={[
                  styles.skillTag,
                  {
                    backgroundColor: isDark ? "rgba(79, 70, 229, 0.2)" : "rgba(99, 102, 241, 0.1)",
                    borderColor: isDark ? "rgba(79, 70, 229, 0.3)" : "rgba(99, 102, 241, 0.2)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.skillText,
                    { color: isDark ? "#a78bfa" : "#6366f1" },
                  ]}
                >
                  {skill.name}
                  {skill.yearsExp > 0 && ` (${skill.yearsExp}${skill.yearsExp > 1 ? t("common.years") : t("common.year")})`}
                </Text>
              </View>
            ))}
            {totalSkillsCount > 3 && (
              <Text style={[styles.moreSkills, themeStyles.textSecondary]}>
                {t("common.moreItems", { count: totalSkillsCount - 3 })}
              </Text>
            )}
          </View>
        )}
        
        <View style={[
          styles.cardFooter,
          { borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }
        ]}>
          {item.cvUrl && (
            <View style={styles.cvBadge}>
              <Feather name="file-text" size={12} color={isDark ? "#22c55e" : "#16a34a"} />
              <Text style={[styles.cvText, { color: isDark ? "#22c55e" : "#16a34a" }]}>
                {t("candidate.cvAvailable")}
              </Text>
            </View>
          )}
          <Text style={[styles.cta, { color: colors.tint }]}>{t("jobs.viewFullProfile")}</Text>
        </View>
      </TouchableButton>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableButton
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <Feather
              name="arrow-left"
              size={24}
              color={themeStyles.iconColor}
            />
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
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchCandidates}
              tintColor={colors.tint}
            />
          }
        >
          {hasTemporaryPassword && (
            <TemporaryPasswordBanner />
          )}
          <ActionBanner />
          
          <View style={styles.headerSummary}>
            <Text style={[styles.greeting, themeStyles.textPrimary]}>
              {t("employerHome.findTalent", { name: userName ? `, ${userName}` : "" })}
            </Text>
            <Text style={[styles.balanceLabel, themeStyles.textSecondary]}>
              {t("employerHome.postJobsOrSearch")}
            </Text>
          </View>

        <View style={styles.quickActions}>
          <TouchableButton
            style={[styles.qaBtn, themeStyles.actionBtn]}
            onPress={() => router.push("/search-modal" as any)}
          >
            <Feather
              name="search"
              size={20}
              color={themeStyles.iconColor}
              style={styles.qaIcon}
            />
            <Text style={[styles.qaText, themeStyles.textPrimary]}>
              {t("employerHome.searchTalent")}
            </Text>
          </TouchableButton>

          <TouchableButton
            style={[
              styles.qaBtn, 
              themeStyles.actionBtn,
              (!emailVerified || !phoneVerified || !hasAddress) && { opacity: 0.5 }
            ]}
            onPress={() => {
              if (!emailVerified || !phoneVerified || !hasAddress) {
                const missing = [];
                if (!emailVerified) missing.push(t("settings.email"));
                if (!phoneVerified) missing.push(t("settings.phone"));
                if (!hasAddress) missing.push(t("profile.address"));
                Alert.alert(
                  t("home.verificationRequired"),
                  t("employerHome.completeVerificationBeforePosting", { missing: missing.join(", ") }),
                  [
                    { text: t("common.ok") },
                    { 
                      text: t("employerHome.goToSettings"), 
                      onPress: () => router.push("/settings" as any) 
                    }
                  ]
                );
                return;
              }
              router.push("/post-job" as any);
            }}
          >
            <Feather
              name="plus-circle"
              size={20}
              color={themeStyles.iconColor}
              style={styles.qaIcon}
            />
            <Text style={[styles.qaText, themeStyles.textPrimary]}>
              {t("jobs.postJob")}
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
              onPress={() => router.push("/manage-applications" as any)}
            >
              <Feather
                name="users"
                size={24}
                color={themeStyles.iconColor}
                style={{ marginBottom: 6 }}
              />
              <Text style={[styles.iconText, themeStyles.textPrimary]}>
                {t("manageApplications.applications")}
              </Text>
            </TouchableButton>
            <TouchableButton
              style={[styles.iconBox, themeStyles.actionBtn]}
              onPress={() => {
                // Always navigate to the list view first, so users can view/start tracking
                router.push("/tracking?role=EMPLOYER" as any);
              }}
            >
              <Feather
                name="navigation"
                size={24}
                color={themeStyles.iconColor}
                style={{ marginBottom: 6 }}
              />
              <Text style={[styles.iconText, themeStyles.textPrimary]}>
                {t("tracking.activeBookings")}
              </Text>
            </TouchableButton>
            <TouchableButton
              style={[styles.iconBox, themeStyles.actionBtn]}
              onPress={() => router.push("/chat/inbox" as any)}
            >
              <Feather
                name="message-square"
                size={24}
                color={themeStyles.iconColor}
                style={{ marginBottom: 6 }}
              />
              <Text style={[styles.iconText, themeStyles.textPrimary]}>
                {t("chat.messages")}
              </Text>
            </TouchableButton>
          </View>
        </View>

        {/* Track Providers Card */}
        <View style={[styles.section, { paddingBottom: 0 }]}>
          <View
            style={[
              styles.trackCard,
              { 
                backgroundColor: "#4F46E5", 
                borderColor: "#4F46E5",
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View
                style={[
                  {
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Feather name="map" size={24} color="white" />
              </View>
              {activeBooking && activeBooking.status === 'IN_PROGRESS' && (
                <View style={{ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: "#10B981"
                }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{t("payouts.active")}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 8, color: "white" }}>
              {t("employerHome.trackProviders")}
            </Text>
            <Text
              style={{ 
                fontSize: 14, 
                lineHeight: 20, 
                marginBottom: 20,
                color: "rgba(255,255,255,0.9)"
              }}
            >
              {activeBooking 
                ? t("employerHome.viewBookingsStatus", { status: activeBooking.status === 'IN_PROGRESS' ? t("payouts.active") : t("applications.accepted") })
                : t("employerHome.viewAcceptedProviders")}
            </Text>
            <TouchableButton
              style={{ 
                backgroundColor: "white",
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
              }}
              onPress={() => router.push("/tracking?role=EMPLOYER" as any)}
            >
              <Text style={{ fontWeight: "700", fontSize: 15, color: "#4F46E5" }}>
                {t("employerHome.viewBookings")}
              </Text>
            </TouchableButton>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
            {t("employerHome.recommendedCandidates")}
          </Text>
          {loading ? (
            <Text style={[styles.loading, themeStyles.textSecondary]}>
              {t("common.loading")}
            </Text>
          ) : candidates.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={[styles.empty, themeStyles.textSecondary, { marginBottom: 8 }]}>
                {t("employerHome.noVerifiedCandidates")}
            </Text>
              <Text style={[styles.empty, themeStyles.textSecondary, { fontSize: 12, opacity: 0.7 }]}>
                {t("employerHome.candidatesMustBeVerified")}
              </Text>
            </View>
          ) : (
            <View>
              {candidates.map((item) => (
                <View key={item.id}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          )}
        </View>
        </ScrollView>
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
  loading: { padding: 16 },
  greeting: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  balanceLabel: { fontSize: 13, marginTop: 4 },
  
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
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 2,
  },
  qaIcon: { marginRight: 8 },
  qaText: { fontWeight: "600", fontSize: 13 },
  section: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    fontSize: 15,
  },
  iconRow: { flexDirection: "row", gap: 12 },
  iconBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    alignItems: "center",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 2,
  },
  iconText: { fontWeight: "500", fontSize: 12 },
  
  empty: { fontSize: 14 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  trackCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 5,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  sub: { marginTop: 4, fontSize: 13 },
  rating: { fontSize: 12, fontWeight: "600" },
  payout: { color: "#4ade80", fontWeight: "700", fontSize: 14 },
  cta: { color: "#60a5fa", fontWeight: "600", fontSize: 13 },
  candidateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  candidateInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  headline: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 4,
  },
  location: {
    fontSize: 12,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  skillTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  skillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  moreSkills: {
    fontSize: 11,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  cvBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cvText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
