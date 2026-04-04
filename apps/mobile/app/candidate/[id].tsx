import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import { TouchableButton } from "../../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import { useStripeAvailability } from "../../context/StripeContext";

// Load Stripe hook at module level so the hook call count is consistent across renders
let _useStripeHook: (() => any) | null = null;
try {
  const stripeModule = require("@stripe/stripe-react-native");
  _useStripeHook = stripeModule.useStripe;
} catch {
  _useStripeHook = null;
}

function useStripeForCandidate() {
  const { isStripeReady } = useStripeAvailability();
  // Always call useStripe (if available) to maintain consistent hook order
  const stripe = _useStripeHook ? _useStripeHook() : null;

  if (!isStripeReady || !stripe) {
    return { initPaymentSheet: null, presentPaymentSheet: null };
  }
  return stripe;
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
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
    yearsExp: number;
  }>;
  skillsSummary?: string[];
  languages?: Array<{ language: string; level: string }> | string[];
  rating: number;
  ratingCount: number;
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    reviewer: {
      id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  }>;
  cvUrl?: string;
  hourlyRate?: number; // Keep for backward compatibility
  rates?: Array<{
    rate: number;
    description?: string;
    paymentType: string;
    otherSpecification?: string;
  }>;
  vehicles?: Array<{
    id: string;
    vehicleType: string;
    otherTypeSpecification?: string;
    make: string;
    model: string;
    year: number;
    color?: string;
    capacity?: number;
    photoFrontUrl?: string;
  }>;
  hasVerifiedVehicle?: boolean;
  hasVerifiedDriversLicense?: boolean;
  // Verification statuses
  isIdVerified?: boolean;
  idVerificationStatus?: string;
  isBackgroundVerified?: boolean;
  backgroundCheckStatus?: string;
  hasWorkPermit?: boolean; // Derived from ID verification type RESIDENCE_PERMIT
  availability?: Array<{
    id: string;
    start: string;
    end: string;
    timezone?: string;
    isRecurring?: boolean;
    rrule?: string;
  }>;
  // Application info for employer view
  applicationInfo?: {
    hasApplied: boolean;
    hasBeenReferred?: boolean;
    applicationId?: string;
    referralId?: string;
    jobId?: string;
    paymentStatus?: {
      required: boolean;
      completed: boolean;
      paymentId?: string;
      paymentIntentId?: string;
      clientSecret?: string;
    };
  };
  // Additional profile sections
  workExperience?: Array<{
    company: string;
    fromDate: string;
    toDate: string;
    isCurrent: boolean;
    category: string;
    years: string;
    description: string;
  }>;
  certifications?: Array<{
    title: string;
    institution: string;
    graduationDate: string;
    isStillStudying: boolean;
  }>;
  education?: Array<{
    title: string;
    institution: string;
    graduationDate: string;
    isStillStudying: boolean;
  }>;
  projects?: Array<{
    title: string;
    description: string;
    url?: string;
  }>;
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

export default function CandidateProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const candidateId = params.id as string;
  const { initPaymentSheet, presentPaymentSheet } = useStripeForCandidate();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [employerJobs, setEmployerJobs] = useState<
    Array<{ id: string; title: string; category?: { name: string } }>
  >([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [referring, setReferring] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [hasAddress, setHasAddress] = useState<boolean>(false);

  useEffect(() => {
    fetchEmployerVerification();
  }, []);

  const fetchEmployerVerification = async () => {
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
      }
    } catch (err) {
      console.log("Error fetching employer verification:", err);
    }
  };

  const fetchCandidate = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setLoading(false);
        router.replace("/login" as never);
        return;
      }

      if (!candidateId) {
        console.error("No candidate ID provided");
        Alert.alert(t("common.error"), t("candidate.invalidCandidateId"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
        setLoading(false);
        return;
      }

      const base = getApiBase();
      console.log(
        `[CandidateProfile] Fetching candidate ${candidateId} from ${base}/users/candidates/${candidateId}`,
      );

      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const res = await fetch(`${base}/users/candidates/${candidateId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        console.log(`[CandidateProfile] Received candidate data:`, {
          id: data.id,
          name: `${data.firstName} ${data.lastName}`,
          hasAvatar: !!data.avatar,
          skillsCount: data.skills?.length || 0,
          applicationInfo: data.applicationInfo,
          hasApplicationInfo: !!data.applicationInfo,
          hasApplied: data.applicationInfo?.hasApplied,
          hasBeenReferred: data.applicationInfo?.hasBeenReferred,
        });
        // Construct full avatar URL if it's a relative path
        if (data.avatar && !data.avatar.startsWith("http")) {
          data.avatar = `${base}/${data.avatar.startsWith("/") ? data.avatar.slice(1) : data.avatar}`;
        }
        setCandidate(data);
        setLoading(false);
      } else {
        const errorData = await res
          .json()
          .catch(() => ({ message: t("candidate.failedToLoadProfile") }));
        console.error(
          `[CandidateProfile] Failed to fetch candidate:`,
          errorData,
        );
        setLoading(false);
        Alert.alert(
          t("common.error"),
          errorData.message || t("candidate.failedToLoadProfileNotVerified"),
          [{ text: t("common.ok"), onPress: () => router.back() }],
        );
        return;
      }
    } catch (error: any) {
      console.error("[CandidateProfile] Error fetching candidate:", error);
      setLoading(false);

      if (error.name === "AbortError") {
        Alert.alert(t("common.error"), t("errors.requestTimeout"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t("common.error"), t("errors.networkError"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      }
    }
  };

  useEffect(() => {
    if (candidateId) {
      fetchCandidate();
    } else {
      setLoading(false);
      Alert.alert(t("common.error"), t("candidate.invalidCandidateId"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);
    }
  }, [candidateId]);

  const handleViewCV = () => {
    if (candidate?.cvUrl) {
      Linking.openURL(candidate.cvUrl);
    }
  };

  const isPaymentRequired = (): boolean => {
    if (!candidate?.applicationInfo) return false;

    const paymentStatus = candidate.applicationInfo.paymentStatus;
    const paymentRequired = paymentStatus?.required ?? false;
    const paymentCompleted = paymentStatus?.completed ?? false;

    return paymentRequired && !paymentCompleted;
  };

  const hasBeenReferred = (): boolean => {
    return candidate?.applicationInfo?.hasBeenReferred ?? false;
  };

  const canChat = (): boolean => {
    if (!candidate?.applicationInfo) return false;

    // Can chat if:
    // 1. Candidate has applied OR been referred
    // 2. Payment is not required OR payment is completed
    const hasConnection =
      candidate.applicationInfo.hasApplied ||
      candidate.applicationInfo.hasBeenReferred;
    if (!hasConnection) return false;

    const paymentStatus = candidate.applicationInfo.paymentStatus;
    const paymentRequired = paymentStatus?.required ?? false;
    const paymentCompleted = paymentStatus?.completed ?? false;

    return !paymentRequired || paymentCompleted;
  };

  const showPaymentRequiredAlert = () => {
    Alert.alert(
      t("applications.paymentRequired"),
      t("candidate.paymentRequiredToChat"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("applications.proceedToPayment"),
          onPress: () => {
            setShowPaymentModal(true);
          },
        },
      ],
    );
  };

  const handleContact = async () => {
    // Only show referral modal - no chat functionality
    await fetchEmployerJobs();
    setShowReferralModal(true);
  };

  const fetchEmployerJobs = async () => {
    try {
      setLoadingJobs(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/jobs/my-jobs?status=ACTIVE`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEmployerJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching employer jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleReferToJob = async () => {
    if (!selectedJobId || !candidate) return;

    // Check verification before referring
    if (!emailVerified || !phoneVerified || !hasAddress) {
      const missing = [];
      if (!emailVerified) missing.push(t("settings.email"));
      if (!phoneVerified) missing.push(t("settings.phone"));
      if (!hasAddress) missing.push(t("profile.address"));
      Alert.alert(
        t("home.verificationRequired"),
        t("candidate.completeVerificationBeforeReferring", {
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
      setReferring(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired"),
        );
        return;
      }

      const base = getApiBase();
      const res = await fetch(
        `${base}/users/candidates/${candidate.id}/refer-to-job`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jobId: selectedJobId }),
        },
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("candidate.referredToJob"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowReferralModal(false);
              setSelectedJobId(null);
              // Refresh candidate profile to show updated referral status
              fetchCandidate();
            },
          },
        ]);
      } else {
        const errorData = await res
          .json()
          .catch(() => ({ message: t("candidate.failedToRefer") }));
        Alert.alert(
          t("common.error"),
          errorData.message || t("candidate.failedToReferToJob"),
        );
      }
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("candidate.failedToRefer"),
      );
    } finally {
      setReferring(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!candidate?.applicationInfo?.applicationId) return;

    if (!initPaymentSheet || !presentPaymentSheet) {
      Alert.alert(
        t("applications.paymentSetupRequired"),
        t("payments.paymentSystemInitializing") ||
          "Payment system is not ready. Please try again in a moment.",
      );
      return;
    }

    try {
      setPaymentProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired"),
        );
        return;
      }

      const base = getApiBase();

      // Step 1: Create payment intent
      const res = await fetch(
        `${base}/payments/applications/${candidate.applicationInfo.applicationId}/payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: t("applications.failedToCreatePayment") }));
        const errorMessage = String(
          errorData?.message || t("applications.failedToCreatePayment"),
        );

        // Only show "payment method required" if the error explicitly mentions it
        const isPaymentMethodError =
          errorMessage.toLowerCase().includes("payment method required") ||
          errorMessage.toLowerCase().includes("add a payment method");

        if (isPaymentMethodError) {
          Alert.alert(
            t("applications.paymentSetupRequired"),
            t("applications.paymentSetupRequiredMessage"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("applications.goToSettings"),
                onPress: () => {
                  setShowPaymentModal(false);
                  router.push("/settings" as any);
                },
              },
            ],
          );
        } else {
          Alert.alert(t("applications.paymentError"), errorMessage);
        }
        return;
      }

      const data = await res.json();

      if (!data.clientSecret) {
        Alert.alert(
          t("common.error"),
          t("applications.invalidPaymentResponse"),
        );
        return;
      }

      // Step 2: Initialize payment sheet with payment intent
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Nasta",
        paymentIntentClientSecret: data.clientSecret,
        returnURL: "nasta://payments/methods",
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        console.error("Payment sheet init error:", initError);
        Alert.alert(
          t("applications.paymentError"),
          initError.message || t("applications.failedToInitializePayment"),
        );
        return;
      }

      // Step 3: Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert(
            t("applications.paymentError"),
            presentError.message || t("applications.paymentFailed"),
          );
        }
        // User canceled, just return
        return;
      }

      // Step 4: Payment succeeded
      Alert.alert(
        t("applications.paymentSuccessful"),
        t("applications.paymentSuccessfulMessage"),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowPaymentModal(false);
              fetchCandidate(); // Refresh to get updated payment status
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Payment error:", error);
      const errorMessage = String(
        error?.message || t("applications.failedToProcessPayment"),
      );

      // Only show "payment method required" if the error explicitly mentions it
      const isPaymentMethodError =
        errorMessage.toLowerCase().includes("payment method required") ||
        errorMessage.toLowerCase().includes("add a payment method");

      if (isPaymentMethodError) {
        Alert.alert(
          t("applications.paymentSetupRequired"),
          t("applications.paymentSetupRequiredSettings"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("applications.goToSettings"),
              onPress: () => {
                setShowPaymentModal(false);
                router.push("/settings" as any);
              },
            },
          ],
        );
      } else {
        Alert.alert(t("applications.paymentError"), errorMessage);
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ headerShown: false, title: "" }} />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("candidate.profile")}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text
              style={[
                styles.loadingText,
                { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
              ]}
            >
              {t("candidate.loadingProfile")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!candidate) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ headerShown: false, title: "" }} />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("candidate.profile")}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.center}>
            <Feather
              name="user-x"
              size={64}
              color={isDark ? "rgba(201,150,63,0.25)" : "#9A8E7A"}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("candidate.candidateNotFound")}
            </Text>
            <Text
              style={[
                styles.emptySub,
                { color: isDark ? "rgba(255,250,240,0.6)" : "#8A7B68" },
              ]}
            >
              {t("candidate.candidateProfileNotAvailable")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();
  const location =
    [candidate.city, candidate.country].filter(Boolean).join(", ") ||
    t("applications.locationNotSpecified");
  const allSkills = [
    ...(candidate.skills || []).map((s) => s.name),
    ...(candidate.skillsSummary || []),
  ].filter((skill, index, self) => self.indexOf(skill) === index);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("candidate.profile")}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <Stack.Screen options={{ headerShown: false, title: "" }} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Profile Header */}
          <View
            style={[
              styles.profileHeader,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.85)" : "#FFFAF0",
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? "rgba(255,250,240,0.12)" : "transparent",
              },
            ]}
          >
            {candidate.avatar ? (
              <Image
                source={{ uri: candidate.avatar }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "#F0E8D5",
                  },
                ]}
              >
                <Feather
                  name="user"
                  size={48}
                  color={isDark ? "rgba(255,250,240,0.5)" : "#9A8E7A"}
                />
              </View>
            )}
            <Text style={[styles.name, { color: colors.text }]}>
              {fullName}
            </Text>
            {candidate.headline && (
              <Text
                style={[
                  styles.headline,
                  { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                ]}
              >
                {candidate.headline}
              </Text>
            )}
            <View style={styles.ratingContainer}>
              <Feather name="star" size={20} color="#eab308" />
              <Text style={[styles.rating, { color: colors.text }]}>
                {candidate.rating > 0
                  ? candidate.rating.toFixed(1)
                  : t("candidate.noRating")}
              </Text>
              {candidate.ratingCount > 0 && (
                <Text
                  style={[
                    styles.ratingCount,
                    { color: isDark ? "rgba(255,250,240,0.6)" : "#8A7B68" },
                  ]}
                >
                  ({candidate.ratingCount}{" "}
                  {candidate.ratingCount === 1 ? "review" : "reviews"})
                </Text>
              )}
            </View>
            {/* Display Rates */}
            {candidate.rates && candidate.rates.length > 0 ? (
              <View style={styles.ratesContainer}>
                {candidate.rates.map((rate, index) => {
                  const paymentTypeLabel =
                    rate.paymentType === "OTHER" && rate.otherSpecification
                      ? rate.otherSpecification
                      : rate.paymentType.charAt(0) +
                        rate.paymentType.slice(1).toLowerCase();
                  return (
                    <View key={index} style={styles.rateItem}>
                      <Text
                        style={[styles.hourlyRate, { color: colors.tint }]}
                      >
                        €{rate.rate}/{paymentTypeLabel}
                      </Text>
                      {rate.description ? (
                        <Text
                          style={[
                            styles.rateDescription,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.6)"
                                : "#8A7B68",
                            },
                          ]}
                        >
                          {rate.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : candidate.hourlyRate ? (
              <Text style={[styles.hourlyRate, { color: colors.tint }]}>
                €{candidate.hourlyRate}/hr
              </Text>
            ) : null}
          </View>

          {/* Verification Badges */}
          {(candidate.isIdVerified ||
            candidate.idVerificationStatus === "VERIFIED" ||
            candidate.isBackgroundVerified ||
            candidate.backgroundCheckStatus === "APPROVED" ||
            candidate.hasWorkPermit) && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="shield" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.verification")}
                </Text>
              </View>
              <View style={styles.verificationContainer}>
                {/* ID Verification */}
                {(candidate.isIdVerified ||
                  candidate.idVerificationStatus === "VERIFIED") && (
                  <View
                    style={[
                      styles.verificationBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(16, 185, 129, 0.1)",
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(16, 185, 129, 0.2)",
                      },
                    ]}
                  >
                    <Feather name="check-circle" size={16} color="#10b981" />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDark ? "#10b981" : "#059669" },
                      ]}
                    >
                      {t("candidate.idVerified")}
                    </Text>
                  </View>
                )}

                {/* Background Check */}
                {(candidate.isBackgroundVerified ||
                  candidate.backgroundCheckStatus === "APPROVED") && (
                  <View
                    style={[
                      styles.verificationBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(16, 185, 129, 0.1)",
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(16, 185, 129, 0.2)",
                      },
                    ]}
                  >
                    <Feather name="shield" size={16} color="#10b981" />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDark ? "#10b981" : "#059669" },
                      ]}
                    >
                      {t("candidate.backgroundCheckVerified")}
                    </Text>
                  </View>
                )}

                {/* Work Permit */}
                {candidate.hasWorkPermit && (
                  <View
                    style={[
                      styles.verificationBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(16, 185, 129, 0.1)",
                        borderColor: isDark
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(16, 185, 129, 0.2)",
                      },
                    ]}
                  >
                    <Feather name="briefcase" size={16} color="#10b981" />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDark ? "#10b981" : "#059669" },
                      ]}
                    >
                      {t("candidate.workPermitVerified")}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Vehicles */}
          {candidate.vehicles && candidate.vehicles.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="truck" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("vehicles.vehicleVerification")}
                </Text>
              </View>
              {candidate.vehicles.map((vehicle, idx) => (
                <View
                  key={vehicle.id || idx}
                  style={[
                    styles.vehicleCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(201, 150, 63, 0.1)"
                        : "rgba(201, 150, 63, 0.05)",
                      borderColor: isDark
                        ? "rgba(201, 150, 63, 0.3)"
                        : "rgba(201, 150, 63, 0.2)",
                      marginBottom:
                        idx < candidate.vehicles!.length - 1 ? 12 : 0,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Feather
                      name="truck"
                      size={18}
                      color={colors.tint}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[styles.vehicleCardTitle, { color: colors.text }]}
                    >
                      {vehicle.make} {vehicle.model} ({vehicle.year})
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.vehicleCardDetail,
                      { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                    ]}
                  >
                    {t(`vehicles.type.${vehicle.vehicleType}`)}
                    {vehicle.otherTypeSpecification
                      ? ` – ${vehicle.otherTypeSpecification}`
                      : ""}
                  </Text>
                  {vehicle.color && (
                    <Text
                      style={[
                        styles.vehicleCardDetail,
                        {
                          color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68",
                        },
                      ]}
                    >
                      {t("vehicles.color")}: {vehicle.color}
                    </Text>
                  )}
                  {vehicle.capacity != null && (
                    <Text
                      style={[
                        styles.vehicleCardDetail,
                        {
                          color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68",
                        },
                      ]}
                    >
                      {t("vehicles.capacity")}: {vehicle.capacity}
                    </Text>
                  )}
                  {candidate.hasVerifiedVehicle && (
                    <View
                      style={[
                        styles.verificationBadge,
                        {
                          backgroundColor: isDark
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(16, 185, 129, 0.1)",
                          borderColor: isDark
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(16, 185, 129, 0.2)",
                          marginTop: 10,
                          alignSelf: "flex-start",
                        },
                      ]}
                    >
                      <Feather name="check-circle" size={14} color={colors.tint} />
                      <Text
                        style={[
                          styles.verificationText,
                          { color: colors.tint },
                        ]}
                      >
                        {t("vehicles.statusVerified")}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Location */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.85)" : "#FFFAF0",
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? "rgba(255,250,240,0.12)" : "transparent",
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={20} color={colors.tint} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("candidate.location")}
              </Text>
            </View>
            <Text
              style={[
                styles.sectionContent,
                { color: isDark ? "rgba(255,250,240,0.95)" : "#0A1628" },
              ]}
            >
              {location}
            </Text>
          </View>

          {/* Bio */}
          {candidate.bio && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="user" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.about")}
                </Text>
              </View>
              <Text
                style={[
                  styles.sectionContent,
                  { color: isDark ? "rgba(255,250,240,0.95)" : "#0A1628" },
                ]}
              >
                {candidate.bio}
              </Text>
            </View>
          )}

          {/* Skills */}
          {allSkills.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="tool" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.skills")}
                </Text>
              </View>
              <View style={styles.skillsContainer}>
                {allSkills.map((skill, idx) => {
                  const skillData = candidate.skills.find(
                    (s) => s.name === skill,
                  );
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.skillTag,
                        {
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.2)"
                            : "rgba(201, 150, 63, 0.1)",
                          borderColor: isDark
                            ? "rgba(201, 150, 63, 0.3)"
                            : "rgba(201, 150, 63, 0.2)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.skillText,
                          { color: isDark ? "#E8B86D" : "#B8822A" },
                        ]}
                      >
                        {skill}
                        {skillData &&
                          skillData.yearsExp > 0 &&
                          ` (${skillData.yearsExp}${skillData.yearsExp > 1 ? "yrs" : "yr"})`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Languages */}
          {candidate.languages && candidate.languages.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="globe" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.languages")}
                </Text>
              </View>
              <View style={styles.skillsContainer}>
                {candidate.languages.map((language, idx) => {
                  const langName =
                    typeof language === "string" ? language : language.language;
                  const langLevel =
                    typeof language === "object" ? language.level : undefined;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.skillTag,
                        {
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.2)"
                            : "rgba(201, 150, 63, 0.1)",
                          borderColor: isDark
                            ? "rgba(201, 150, 63, 0.3)"
                            : "rgba(201, 150, 63, 0.2)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.skillText,
                          { color: isDark ? "#E8B86D" : "#B8822A" },
                        ]}
                      >
                        {langName}
                        {langLevel &&
                          ` (${langLevel.charAt(0) + langLevel.slice(1).toLowerCase()})`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Work Experience */}
          {candidate.workExperience && candidate.workExperience.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="briefcase" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.workExperience")}
                </Text>
              </View>
              {candidate.workExperience.map((exp, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.experienceItem,
                    {
                      borderBottomWidth:
                        idx < candidate.workExperience!.length - 1 ? 1 : 0,
                      borderBottomColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      paddingBottom:
                        idx < candidate.workExperience!.length - 1 ? 16 : 0,
                      marginBottom:
                        idx < candidate.workExperience!.length - 1 ? 16 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[styles.experienceTitle, { color: colors.text }]}
                  >
                    {exp.company}
                  </Text>
                  {exp.category && (
                    <Text
                      style={[
                        styles.experienceCategory,
                        { color: isDark ? "#E8B86D" : "#B8822A" },
                      ]}
                    >
                      {exp.category}
                    </Text>
                  )}
                  <View style={styles.experienceDates}>
                    <Text
                      style={[
                        styles.experienceDate,
                        { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                      ]}
                    >
                      {exp.fromDate} -{" "}
                      {exp.isCurrent ? t("candidate.present") : exp.toDate}
                    </Text>
                    {exp.years && (
                      <Text
                        style={[
                          styles.experienceYears,
                          {
                            color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68",
                          },
                        ]}
                      >
                        • {exp.years}{" "}
                        {parseFloat(exp.years) === 1
                          ? t("candidate.year")
                          : t("candidate.years")}
                      </Text>
                    )}
                  </View>
                  {exp.description && (
                    <Text
                      style={[
                        styles.experienceDescription,
                        {
                          color: isDark ? "rgba(255,250,240,0.92)" : "#6B6355",
                        },
                      ]}
                    >
                      {exp.description}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Education */}
          {candidate.education && candidate.education.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="book-open" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.education")}
                </Text>
              </View>
              {candidate.education.map((edu, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.experienceItem,
                    {
                      borderBottomWidth:
                        idx < candidate.education!.length - 1 ? 1 : 0,
                      borderBottomColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      paddingBottom:
                        idx < candidate.education!.length - 1 ? 16 : 0,
                      marginBottom:
                        idx < candidate.education!.length - 1 ? 16 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[styles.experienceTitle, { color: colors.text }]}
                  >
                    {edu.title}
                  </Text>
                  <Text
                    style={[
                      styles.experienceCategory,
                      { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                    ]}
                  >
                    {edu.institution}
                  </Text>
                  <Text
                    style={[
                      styles.experienceDate,
                      { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                    ]}
                  >
                    {edu.graduationDate}{" "}
                    {edu.isStillStudying ? t("candidate.stillStudying") : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Certifications */}
          {candidate.certifications && candidate.certifications.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="award" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.certifications")}
                </Text>
              </View>
              {candidate.certifications.map((cert, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.experienceItem,
                    {
                      borderBottomWidth:
                        idx < candidate.certifications!.length - 1 ? 1 : 0,
                      borderBottomColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      paddingBottom:
                        idx < candidate.certifications!.length - 1 ? 16 : 0,
                      marginBottom:
                        idx < candidate.certifications!.length - 1 ? 16 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[styles.experienceTitle, { color: colors.text }]}
                  >
                    {cert.title}
                  </Text>
                  <Text
                    style={[
                      styles.experienceCategory,
                      { color: isDark ? "rgba(240,232,213,0.8)" : "#6B6355" },
                    ]}
                  >
                    {cert.institution}
                  </Text>
                  <Text
                    style={[
                      styles.experienceDate,
                      { color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68" },
                    ]}
                  >
                    {cert.graduationDate}{" "}
                    {cert.isStillStudying ? t("candidate.stillStudying") : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Projects */}
          {candidate.projects && candidate.projects.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="folder" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.projects")}
                </Text>
              </View>
              {candidate.projects.map((project, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.experienceItem,
                    {
                      borderBottomWidth:
                        idx < candidate.projects!.length - 1 ? 1 : 0,
                      borderBottomColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      paddingBottom:
                        idx < candidate.projects!.length - 1 ? 16 : 0,
                      marginBottom:
                        idx < candidate.projects!.length - 1 ? 16 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[styles.experienceTitle, { color: colors.text }]}
                  >
                    {project.title}
                  </Text>
                  {project.description && (
                    <Text
                      style={[
                        styles.experienceDescription,
                        {
                          color: isDark ? "rgba(255,250,240,0.92)" : "#6B6355",
                        },
                      ]}
                    >
                      {project.description}
                    </Text>
                  )}
                  {project.url && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(project.url!)}
                      style={styles.projectLink}
                    >
                      <Feather
                        name="external-link"
                        size={16}
                        color={colors.tint}
                      />
                      <Text
                        style={[styles.projectLinkText, { color: colors.tint }]}
                      >
                        {t("candidate.viewProject")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Availability */}
          {candidate.availability && candidate.availability.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="calendar" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.availability")}
                </Text>
              </View>
              <View style={styles.availabilityContainer}>
                {(() => {
                  // Filter to only show future availability slots
                  const futureSlots = candidate.availability
                    .filter((slot) => {
                      const endDate = new Date(slot.end);
                      return endDate >= new Date();
                    })
                    .slice(0, 10); // Limit to next 10 slots

                  if (futureSlots.length === 0) {
                    return (
                      <Text
                        style={[
                          styles.sectionContent,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        {t("candidate.noUpcomingAvailability")}
                      </Text>
                    );
                  }

                  const now = new Date();

                  // Format date range
                  const formatDate = (date: Date) => {
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year:
                        date.getFullYear() !== now.getFullYear()
                          ? "numeric"
                          : undefined,
                    });
                  };

                  const formatTime = (date: Date) => {
                    return date.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });
                  };

                  return futureSlots.map((slot, idx) => {
                    const startDate = new Date(slot.start);
                    const endDate = new Date(slot.end);

                    // Check if it's a full day or has specific times
                    const isFullDay =
                      startDate.getHours() === 0 &&
                      startDate.getMinutes() === 0 &&
                      endDate.getHours() === 23 &&
                      endDate.getMinutes() === 59;

                    const isSameDay =
                      startDate.toDateString() === endDate.toDateString();

                    return (
                      <View
                        key={slot.id || idx}
                        style={[
                          styles.availabilitySlot,
                          {
                            backgroundColor: isDark
                              ? "rgba(201, 150, 63, 0.1)"
                              : "rgba(201, 150, 63, 0.05)",
                            borderColor: isDark
                              ? "rgba(201, 150, 63, 0.3)"
                              : "rgba(201, 150, 63, 0.2)",
                          },
                        ]}
                      >
                        <View style={styles.availabilitySlotContent}>
                          <Feather
                            name="clock"
                            size={14}
                            color={colors.tint}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            {isSameDay ? (
                              <>
                                <Text
                                  style={[
                                    styles.availabilityDate,
                                    { color: colors.text },
                                  ]}
                                >
                                  {formatDate(startDate)}
                                </Text>
                                {!isFullDay && (
                                  <Text
                                    style={[
                                      styles.availabilityTime,
                                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                                    ]}
                                  >
                                    {formatTime(startDate)} -{" "}
                                    {formatTime(endDate)}
                                  </Text>
                                )}
                                {isFullDay && (
                                  <Text
                                    style={[
                                      styles.availabilityTime,
                                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                                    ]}
                                  >
                                    All day
                                  </Text>
                                )}
                              </>
                            ) : (
                              <>
                                <Text
                                  style={[
                                    styles.availabilityDate,
                                    { color: colors.text },
                                  ]}
                                >
                                  {formatDate(startDate)} -{" "}
                                  {formatDate(endDate)}
                                </Text>
                                {!isFullDay && (
                                  <Text
                                    style={[
                                      styles.availabilityTime,
                                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                                    ]}
                                  >
                                    {formatTime(startDate)} -{" "}
                                    {formatTime(endDate)}
                                  </Text>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>
          )}

          {/* Reviews */}
          {candidate.reviews && candidate.reviews.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="star" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Reviews ({candidate.reviews.length})
                </Text>
              </View>
              {candidate.reviews.map((review) => {
                const reviewerName =
                  `${review.reviewer.firstName} ${review.reviewer.lastName}`.trim();
                return (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      {review.reviewer.avatar ? (
                        <Image
                          source={{ uri: review.reviewer.avatar }}
                          style={styles.reviewerAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.reviewerAvatarPlaceholder,
                            {
                              backgroundColor: isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#F0E8D5",
                            },
                          ]}
                        >
                          <Feather
                            name="user"
                            size={16}
                            color={isDark ? "rgba(255,250,240,0.5)" : "#9A8E7A"}
                          />
                        </View>
                      )}
                      <View style={styles.reviewerInfo}>
                        <Text
                          style={[styles.reviewerName, { color: colors.text }]}
                        >
                          {reviewerName}
                        </Text>
                        <View style={styles.reviewRating}>
                          {[...Array(5)].map((_, i) => (
                            <Feather
                              key={i}
                              name="star"
                              size={14}
                              color={
                                i < review.rating
                                  ? "#eab308"
                                  : isDark
                                    ? "rgba(255,250,240,0.15)"
                                    : "#F0E8D5"
                              }
                              fill={
                                i < review.rating ? "#eab308" : "transparent"
                              }
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    {review.comment && (
                      <Text
                        style={[
                          styles.reviewComment,
                          {
                            color: isDark ? "rgba(240,232,213,0.7)" : "#8A7B68",
                          },
                        ]}
                      >
                        {review.comment}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* CV */}
          {candidate.cvUrl && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.85)"
                    : "#FFFAF0",
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark
                    ? "rgba(255,250,240,0.12)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("candidate.resumeCv")}
                </Text>
              </View>
              <TouchableButton
                style={[
                  styles.cvButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.2)"
                      : "rgba(201, 150, 63, 0.1)",
                    borderColor: isDark
                      ? "rgba(201, 150, 63, 0.3)"
                      : "rgba(201, 150, 63, 0.2)",
                  },
                ]}
                onPress={handleViewCV}
              >
                <Feather name="download" size={20} color={colors.tint} />
                <Text style={[styles.cvButtonText, { color: colors.tint }]}>
                  {t("candidate.viewCv")}
                </Text>
              </TouchableButton>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* Request Instant Job Button - Always visible */}
            <TouchableButton
              style={[
                styles.contactButton,
                {
                  backgroundColor: isDark ? "#E8B86D" : "#C9963F",
                  borderColor: isDark ? "#E8B86D" : "#C9963F",
                  opacity:
                    !emailVerified || !phoneVerified || !hasAddress ? 0.5 : 1,
                },
              ]}
              onPress={() => {
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
                        onPress: () => router.push("/(tabs)/settings" as any),
                      },
                    ],
                  );
                  return;
                }
                router.push({
                  pathname: "/instant-job-request",
                  params: { candidateId: candidate.id },
                } as any);
              }}
            >
              <Feather name="zap" size={20} color="#FFFAF0" />
              <Text style={styles.contactButtonText}>
                {t("candidate.requestInstantJob")}
              </Text>
            </TouchableButton>

            {/* Refer to Job Button - Only show for candidates who haven't applied */}
            {(() => {
              const hasApplied =
                candidate?.applicationInfo?.hasApplied === true;
              const shouldShowReferButton = !hasApplied;

              if (!shouldShowReferButton) {
                return null;
              }

              return (
                <TouchableButton
                  style={[
                    styles.contactButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(201, 150, 63, 0.2)"
                        : "rgba(201, 150, 63, 0.1)",
                      borderColor: isDark
                        ? "rgba(201, 150, 63, 0.3)"
                        : "rgba(201, 150, 63, 0.2)",
                      marginTop: 12,
                    },
                  ]}
                  onPress={handleContact}
                >
                  <Feather name="user-plus" size={20} color={colors.tint} />
                  <Text
                    style={[styles.contactButtonText, { color: colors.tint }]}
                  >
                    {t("candidate.referToJob")}
                  </Text>
                </TouchableButton>
              );
            })()}
          </View>
        </ScrollView>

        {/* Payment Modal */}
        <Modal
          visible={showPaymentModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPaymentModal(false)}
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
                  {t("applications.completePayment")}
                </Text>
                <TouchableButton onPress={() => setShowPaymentModal(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>
              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#B8A88A" : "#6B6355" },
                  ]}
                >
                  {t("applications.paymentRequiredToChatWithCandidate")}
                </Text>
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableButton
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#B8A88A",
                    },
                  ]}
                  onPress={() => setShowPaymentModal(false)}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </TouchableButton>
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: isDark ? "#C9963F" : "#B8822A",
                      borderColor: isDark ? "#E8B86D" : "#C9963F",
                    },
                    paymentProcessing && styles.modalButtonDisabled,
                  ]}
                  onPress={handleCreatePayment}
                  disabled={paymentProcessing}
                >
                  {paymentProcessing ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      Create Payment
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Referral Modal */}
        <Modal
          visible={showReferralModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReferralModal(false)}
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
                  Refer Candidate to Job
                </Text>
                <TouchableButton onPress={() => setShowReferralModal(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>
              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#B8A88A" : "#6B6355" },
                  ]}
                >
                  Select a job to refer this candidate to. They will receive an
                  email notification about the opportunity.
                </Text>
                {loadingJobs ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.tint}
                    style={{ marginVertical: 20 }}
                  />
                ) : employerJobs.length === 0 ? (
                  <Text
                    style={[
                      styles.modalDescription,
                      { color: isDark ? "#9A8E7A" : "#8A7B68", marginTop: 20 },
                    ]}
                  >
                    You don't have any active jobs. Please create a job first.
                  </Text>
                ) : (
                  employerJobs.map((job) => (
                    <TouchableButton
                      key={job.id}
                      style={[
                        styles.jobOption,
                        {
                          backgroundColor:
                            selectedJobId === job.id
                              ? isDark
                                ? "rgba(201, 150, 63, 0.3)"
                                : "rgba(201, 150, 63, 0.1)"
                              : isDark
                                ? "rgba(255,250,240,0.06)"
                                : "rgba(184,130,42,0.06)",
                          borderColor:
                            selectedJobId === job.id
                              ? colors.tint
                              : isDark
                                ? "rgba(201,150,63,0.12)"
                                : "rgba(184,130,42,0.2)",
                        },
                      ]}
                      onPress={() => setSelectedJobId(job.id)}
                    >
                      <Text
                        style={[styles.jobOptionText, { color: colors.text }]}
                      >
                        {job.title}
                      </Text>
                      {job.category && (
                        <Text
                          style={[
                            styles.jobOptionCategory,
                            { color: isDark ? "#9A8E7A" : "#8A7B68" },
                          ]}
                        >
                          {translateCategoryName(job.category.name, t)}
                        </Text>
                      )}
                    </TouchableButton>
                  ))
                )}
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableButton
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "#F0E8D5",
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "#B8A88A",
                    },
                  ]}
                  onPress={() => {
                    setShowReferralModal(false);
                    setSelectedJobId(null);
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </TouchableButton>
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: isDark ? "#C9963F" : "#B8822A",
                      borderColor: isDark ? "#E8B86D" : "#C9963F",
                    },
                    (!selectedJobId || referring) && styles.modalButtonDisabled,
                  ]}
                  onPress={handleReferToJob}
                  disabled={!selectedJobId || referring}
                >
                  {referring ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      Send Referral
                    </Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  profileHeader: {
    borderRadius: 4,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  headline: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rating: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  ratingCount: {
    fontSize: 14,
    marginLeft: 8,
  },
  ratesContainer: {
    flexDirection: "column",
    gap: 12,
    marginTop: 8,
  },
  rateItem: {
    gap: 2,
  },
  hourlyRate: {
    fontSize: 18,
    fontWeight: "700",
  },
  rateDescription: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  experienceItem: {
    marginTop: 12,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  experienceCategory: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  experienceDates: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  experienceDate: {
    fontSize: 13,
    fontWeight: "500",
  },
  experienceYears: {
    fontSize: 13,
    fontWeight: "500",
  },
  experienceDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  projectLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  projectLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    fontWeight: "700",
    marginLeft: 12,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    fontWeight: "500",
  },
  availabilityContainer: {
    gap: 8,
  },
  availabilitySlot: {
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  availabilitySlotContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  availabilityDate: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  availabilityTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  reviewItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,250,240,0.12)",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  cvButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
  },
  cvButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionButtons: {
    marginTop: 8,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 4,
    gap: 12,
    borderWidth: 1,
  },
  contactButtonText: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  verificationContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    gap: 6,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: "700",
  },
  vehicleCard: {
    borderRadius: 4,
    padding: 14,
    borderWidth: 1,
  },
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  vehicleCardDetail: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 500,
    borderRadius: 4,
    overflow: "hidden",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(201,150,63,0.12)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(201,150,63,0.12)",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    backgroundColor: "transparent",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFAF0",
  },
  jobOption: {
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  jobOptionText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  jobOptionCategory: {
    fontSize: 14,
  },
});
