import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import { TouchableButton } from "../../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface Application {
  id: string;
  status: string;
  appliedAt: string;
  coverLetter?: string;
  selectedRates?: Array<{
    rate: number;
    paymentType: string;
    otherSpecification?: string;
  }>;
  paymentAmount?: number;
  currency?: string;
  verificationCodeVerifiedAt?: string; // When service provider verified the code
  verificationCodeLastVerifiedAt?: string | null; // Latest verification (used for additional services)
  verificationCodeVersion?: number;
  verificationCodeVerifiedVersion?: number | null;
  pendingVerificationCodeVersion?: number | null;
  pendingVerificationCodeLockMode?: "SOFT" | "HARD" | null;
  completedAt?: string; // When the job was marked as complete by employer
  serviceProviderMarkedDoneAt?: string; // When the service provider marked the job as done
  paymentStatus?: {
    required: boolean;
    completed: boolean;
    paidAmount?: number;
    unpaidAmount?: number;
    paidServices?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: true;
    }>;
    unpaidServices?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
      isPaid: false;
    }>;
    paidNegotiations?: Array<{ id: string; totalAmount: number; isPaid: true }>;
    unpaidNegotiations?: Array<{
      id: string;
      totalAmount: number;
      isPaid: false;
    }>;
  };
  additionalRateRequests?: Array<{
    id: string;
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>;
    totalAmount: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    requestedAt: string;
    respondedAt?: string;
    message?: string;
    responseMessage?: string;
  }>;
  negotiationRequests?: Array<{
    id: string;
    rates: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>;
    totalAmount: number;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTER_OFFERED";
    counterOffer?: {
      id: string;
      rates: Array<{
        rate: number;
        paymentType: string;
        otherSpecification?: string;
      }>;
      totalAmount: number;
      status: "PENDING" | "ACCEPTED" | "REJECTED";
      message?: string;
    };
    suggestedAt: string;
    respondedAt?: string;
    message: string;
    responseMessage?: string;
  }>;
  additionalTimeRequests?: Array<{
    id: string;
    requestedBy: "EMPLOYER" | "JOB_SEEKER";
    message: string;
    status: "PENDING" | "PENDING_EMPLOYER_APPROVAL" | "ACCEPTED" | "REJECTED";
    requestedAt: string;
    additionalDays?: number;
    explanation?: string;
    respondedAt?: string;
    employerResponseAt?: string;
    employerResponseMessage?: string;
  }>;
  job: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    city?: string;
    country?: string;
    company?: {
      id: string;
      name: string;
    };
  };
}

export default function MyApplicationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const applicationId = params.id as string;
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNegotiationRequestModal, setShowNegotiationRequestModal] =
    useState(false);
  const [requestingNegotiation, setRequestingNegotiation] = useState(false);

  // Negotiation request form state (replaces additional rates requests)
  const [negotiationRequestRates, setNegotiationRequestRates] = useState<
    Array<{
      rate: string;
      paymentType: string;
      otherSpecification?: string;
    }>
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [negotiationRequestMessage, setNegotiationRequestMessage] =
    useState("");
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [selectedRateIndex, setSelectedRateIndex] = useState(0);
  const [showOtherSpecModal, setShowOtherSpecModal] = useState(false);
  const [otherSpecInput, setOtherSpecInput] = useState("");
  const [showNegotiationRespondModal, setShowNegotiationRespondModal] =
    useState(false);
  const [selectedNegotiationId, setSelectedNegotiationId] = useState<
    string | null
  >(null);
  const [selectedNegotiationStatus, setSelectedNegotiationStatus] = useState<
    "ACCEPTED" | "REJECTED" | null
  >(null);
  const [negotiationResponseMessage, setNegotiationResponseMessage] =
    useState("");
  const [respondingToNegotiation, setRespondingToNegotiation] = useState(false);

  // For responding to employer counter offers on service provider requests
  const [selectedCounterOfferId, setSelectedCounterOfferId] = useState<
    string | null
  >(null);
  const [isRespondingToCounterOffer, setIsRespondingToCounterOffer] =
    useState(false);

  // Counter offer state
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false);
  const [counterOfferRates, setCounterOfferRates] = useState<
    Array<{ rate: string; paymentType: string; otherSpecification?: string }>
  >([{ rate: "", paymentType: "HOUR" }]);
  const [counterOfferMessage, setCounterOfferMessage] = useState("");
  const [sendingCounterOffer, setSendingCounterOffer] = useState(false);
  const isFetchingRef = useRef(false);

  // Service verification code state
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Additional time request states
  const [showAdditionalTimeResponseModal, setShowAdditionalTimeResponseModal] =
    useState(false);
  const [selectedAdditionalTimeRequestId, setSelectedAdditionalTimeRequestId] =
    useState<string | null>(null);
  const [additionalDays, setAdditionalDays] = useState("");
  const [additionalTimeExplanation, setAdditionalTimeExplanation] =
    useState("");
  const [respondingToAdditionalTime, setRespondingToAdditionalTime] =
    useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationFlow, setVerificationFlow] = useState<
    "START_SERVICE" | "ADDITIONAL_SERVICES"
  >("START_SERVICE");

  // Mark job as done state
  const [markingJobAsDone, setMarkingJobAsDone] = useState(false);

  const PAYMENT_TYPES = [
    { value: "HOUR", label: t("applications.hourly") },
    { value: "DAY", label: t("applications.daily") },
    { value: "WEEK", label: t("applications.weekly") },
    { value: "MONTH", label: t("applications.monthly") },
    { value: "OTHER", label: t("onboarding.other") },
  ];

  const fetchApplication = useCallback(
    async (showLoading = true) => {
      // Prevent concurrent fetches
      if (isFetchingRef.current) {
        return;
      }

      try {
        isFetchingRef.current = true;
        if (showLoading) {
          setLoading(true);
        }
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          router.replace("/login" as never);
          return;
        }

        const base = getApiBase();
        const res = await fetch(`${base}/applications/${applicationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();

          // Normalize selectedRates: null or undefined should be treated as empty array
          const normalizedSelectedRates =
            data.selectedRates === null || data.selectedRates === undefined
              ? []
              : Array.isArray(data.selectedRates)
                ? data.selectedRates
                : [];

          // Calculate what the total should be from selectedRates only
          const selectedRatesTotal = normalizedSelectedRates.reduce(
            (sum: number, rate: any) => sum + (rate.rate || 0),
            0
          );

          console.log("[MyApplication] Fetched application data:", {
            id: data.id,
            selectedRatesRaw: data.selectedRates,
            selectedRatesNormalized: normalizedSelectedRates,
            selectedRatesCount: normalizedSelectedRates.length,
            selectedRates: normalizedSelectedRates,
            selectedRatesTotal: selectedRatesTotal,
            paymentAmount: data.paymentAmount,
            approvedAdditionalRates:
              data.additionalRateRequests?.filter(
                (r: any) => r.status === "APPROVED"
              ) || [],
            acceptedNegotiations:
              data.negotiationRequests?.filter(
                (r: any) => r.status === "ACCEPTED"
              ) || [],
            warning:
              normalizedSelectedRates.length > 0 && selectedRatesTotal > 0
                ? `WARNING: selectedRates contains ${normalizedSelectedRates.length} items totaling €${selectedRatesTotal.toFixed(2)} - verify this matches employer's actual selection`
                : "OK: No selected rates from employer",
          });

          // Update data with normalized selectedRates
          const normalizedData = {
            ...data,
            selectedRates: normalizedSelectedRates,
          };

          // Only update state if data actually changed
          setApplication((prev) => {
            if (!prev) {
              console.log(
                "[MyApplication] No previous state, setting initial data"
              );
              return normalizedData;
            }

            // Normalize previous rates: null/undefined should be treated as empty array
            const prevRatesRaw =
              prev.selectedRates === null || prev.selectedRates === undefined
                ? []
                : Array.isArray(prev.selectedRates)
                  ? prev.selectedRates
                  : [];

            // Use normalized rates for comparison
            const newRatesRaw = normalizedSelectedRates;

            // Quick check: if lengths differ, definitely changed
            if (prevRatesRaw.length !== newRatesRaw.length) {
              console.log(
                "[MyApplication] Rates count changed, forcing update",
                {
                  prevCount: prevRatesRaw.length,
                  newCount: newRatesRaw.length,
                  prevRates: prevRatesRaw,
                  newRates: newRatesRaw,
                }
              );
              return data;
            }

            // Quick check: if arrays are different (even if same length), update
            const prevRatesStrRaw = JSON.stringify(prevRatesRaw);
            const newRatesStrRaw = JSON.stringify(newRatesRaw);
            if (prevRatesStrRaw !== newRatesStrRaw) {
              console.log(
                "[MyApplication] Rates content changed (same count but different), forcing update",
                {
                  prevRates: prevRatesRaw,
                  newRates: newRatesRaw,
                }
              );
              return normalizedData;
            }

            // Normalize arrays for comparison
            const normalizeRates = (rates: any[]) => {
              if (!rates || !Array.isArray(rates)) return [];
              return rates
                .map((r) => ({
                  rate: r.rate,
                  paymentType: r.paymentType,
                  otherSpecification: r.otherSpecification || null,
                }))
                .sort((a, b) => {
                  // Sort by rate for consistent comparison
                  if (a.rate !== b.rate) return a.rate - b.rate;
                  if (a.paymentType !== b.paymentType)
                    return a.paymentType.localeCompare(b.paymentType);
                  return (a.otherSpecification || "").localeCompare(
                    b.otherSpecification || ""
                  );
                });
            };

            const prevRates = normalizeRates(prevRatesRaw);
            const newRates = normalizeRates(newRatesRaw);
            const prevRatesStr = JSON.stringify(prevRates);
            const newRatesStr = JSON.stringify(newRates);
            const ratesChanged = prevRatesStr !== newRatesStr;

            console.log("[MyApplication] Comparing rates:", {
              prevRatesStr,
              newRatesStr,
              ratesChanged,
              prevRatesLength: prevRates.length,
              newRatesLength: newRates.length,
              prevRates: prevRates,
              newRates: newRates,
              prevTotal: prevRates.reduce(
                (sum: number, r: any) => sum + (r.rate || 0),
                0
              ),
              newTotal: newRates.reduce(
                (sum: number, r: any) => sum + (r.rate || 0),
                0
              ),
            });

            // Compare payment amount
            const paymentChanged =
              prev.paymentAmount !== normalizedData.paymentAmount;

            // Compare additional rate requests
            const prevRequests = JSON.stringify(
              prev.additionalRateRequests || []
            );
            const newRequests = JSON.stringify(
              normalizedData.additionalRateRequests || []
            );
            const requestsChanged = prevRequests !== newRequests;

            // Compare negotiation requests
            const prevNegotiations = JSON.stringify(
              prev.negotiationRequests || []
            );
            const newNegotiations = JSON.stringify(
              normalizedData.negotiationRequests || []
            );
            const negotiationsChanged = prevNegotiations !== newNegotiations;

            // Always update if selectedRates count or content changed
            // This ensures we pick up new selections even if comparison fails
            const ratesCountChanged = prevRates.length !== newRates.length;

            // Calculate totals for comparison
            const prevTotal = prevRates.reduce(
              (sum: number, r: any) => sum + (r.rate || 0),
              0
            );
            const newTotal = newRates.reduce(
              (sum: number, r: any) => sum + (r.rate || 0),
              0
            );
            const totalChanged = Math.abs(prevTotal - newTotal) > 0.01; // Account for floating point

            const shouldUpdate =
              ratesChanged ||
              ratesCountChanged ||
              totalChanged ||
              paymentChanged ||
              requestsChanged ||
              negotiationsChanged ||
              prev.status !== data.status;

            if (shouldUpdate) {
              console.log("[MyApplication] Data changed, updating:", {
                ratesChanged,
                ratesCountChanged,
                totalChanged,
                prevRatesCount: prevRates.length,
                newRatesCount: newRates.length,
                prevRates: prevRates,
                newRates: newRates,
                prevTotal,
                newTotal,
                paymentChanged,
                requestsChanged,
                negotiationsChanged,
                statusChanged: prev.status !== data.status,
              });
              return normalizedData;
            }

            console.log(
              "[MyApplication] No changes detected, keeping previous state",
              {
                prevRatesCount: prevRates.length,
                newRatesCount: newRates.length,
                prevTotal,
                newTotal,
              }
            );
            return prev; // No changes, keep previous state
          });
        } else {
          if (showLoading) {
            Alert.alert(
              t("common.error"),
              t("applications.failedToLoadDetails"),
              [{ text: "OK", onPress: () => router.back() }]
            );
          }
        }
      } catch (error) {
        if (showLoading) {
          Alert.alert(t("common.error"), t("jobs.failedToConnect"), [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } finally {
        isFetchingRef.current = false;
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [applicationId, router]
  );

  useEffect(() => {
    if (applicationId) {
      fetchApplication();
    }
  }, [applicationId, fetchApplication]);

  // Refresh when screen comes into focus to sync with employer actions
  useFocusEffect(
    useCallback(() => {
      if (applicationId) {
        // Initial load with loading indicator
        fetchApplication(true);

        // Set up polling for real-time updates (every 4 seconds for better responsiveness)
        const interval = setInterval(() => {
          console.log("[MyApplication] Polling for updates...");
          fetchApplication(false); // Silent refresh without loading indicator
        }, 4000); // 4 seconds - better balance between responsiveness and server load

        return () => {
          console.log("[MyApplication] Cleaning up polling interval");
          clearInterval(interval);
        };
      }
    }, [applicationId, fetchApplication])
  );

  // Check for rating status when application is completed
  useEffect(() => {
    const checkRatingStatus = async () => {
      if (!applicationId || !application?.completedAt) {
        return;
      }

      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const base = getApiBase();
        const ratingRes = await fetch(
          `${base}/ratings/applications/${applicationId}/status`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (ratingRes.ok) {
          const ratingStatus = await ratingRes.json();
          if (ratingStatus.needsRating && ratingStatus.isServiceProvider) {
            // Navigate directly to rating page after a short delay to avoid interrupting the completion flow
            setTimeout(() => {
              router.push({
                pathname: "/rate-job-completion/service-provider",
                params: {
                  applicationId: applicationId,
                  employerName:
                    application?.job?.company?.name || t("auth.employer"),
                },
              } as any);
            }, 2000);
          }
        }
      } catch (error) {
        // Silently fail - rating check is not critical
        console.log("Error checking rating status:", error);
      }
    };

    checkRatingStatus();
  }, [application?.completedAt, applicationId, application?.job, router, t]);

  const handleAddRate = () => {
    setNegotiationRequestRates([
      ...negotiationRequestRates,
      { rate: "", paymentType: "HOURLY" },
    ]);
  };

  const handleRemoveRate = (index: number) => {
    if (negotiationRequestRates.length > 1) {
      setNegotiationRequestRates(
        negotiationRequestRates.filter((_, i) => i !== index)
      );
    }
  };

  const handleUpdateRate = (index: number, field: string, value: string) => {
    const updated = [...negotiationRequestRates];
    updated[index] = { ...updated[index], [field]: value };
    setNegotiationRequestRates(updated);
  };

  const handleRequestNegotiation = async () => {
    // Validate rates
    const validRates = negotiationRequestRates.filter(
      (r) => r.rate && parseFloat(r.rate) > 0
    );

    if (validRates.length === 0) {
      Alert.alert(t("common.error"), t("applications.addAtLeastOneRate"));
      return;
    }

    // Check for OTHER payment type without specification
    for (const rate of validRates) {
      if (rate.paymentType === "OTHER" && !rate.otherSpecification) {
        Alert.alert(t("common.error"), t("applications.specifyPaymentType"));
        return;
      }
    }

    // Message is required (same as employer-side Suggest Negotiation)
    if (!negotiationRequestMessage.trim()) {
      Alert.alert(
        t("common.error"),
        t("applications.provideNegotiationMessage")
      );
      return;
    }

    try {
      setRequestingNegotiation(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired")
        );
        return;
      }

      const rates = validRates.map((r) => ({
        rate: parseFloat(r.rate),
        paymentType: r.paymentType,
        otherSpecification: r.otherSpecification || undefined,
      }));

      const totalAmount = rates.reduce((sum, r) => sum + r.rate, 0);

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${applicationId}/negotiation/request`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rates,
            totalAmount,
            message: negotiationRequestMessage.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          t("applications.negotiationRequestSent"),
          [
            {
              text: "OK",
              onPress: () => {
                setShowNegotiationRequestModal(false);
                setNegotiationRequestRates([
                  { rate: "", paymentType: "HOURLY" },
                ]);
                setNegotiationRequestMessage("");
                fetchApplication();
              },
            },
          ]
        );
      } else {
        const error = await res
          .json()
          .catch(() => ({ message: "Failed to request negotiation" }));
        Alert.alert(
          t("common.error"),
          error.message || t("applications.failedToRequestNegotiation")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRequestingNegotiation(false);
    }
  };

  const handleRespondToNegotiation = async () => {
    if (!selectedNegotiationId || !selectedNegotiationStatus || !applicationId)
      return;

    try {
      setRespondingToNegotiation(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired")
        );
        return;
      }

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${applicationId}/negotiation/respond`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedNegotiationId,
            status: selectedNegotiationStatus,
            message: negotiationResponseMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          selectedNegotiationStatus === "ACCEPTED"
            ? t("applications.negotiationAcceptedSuccess")
            : t("applications.negotiationRejectedSuccess")
        );
        setShowNegotiationRespondModal(false);
        setSelectedNegotiationId(null);
        setSelectedNegotiationStatus(null);
        setNegotiationResponseMessage("");
        // Force immediate refresh to show updated status
        await fetchApplication(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToRespondNegotiation")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRespondingToNegotiation(false);
    }
  };

  const handleSendCounterOffer = async () => {
    if (!selectedNegotiationId || !applicationId) return;

    // Validate rates
    const validRates = counterOfferRates.filter(
      (r) => r.rate && parseFloat(r.rate) > 0
    );

    if (validRates.length === 0) {
      Alert.alert(t("common.error"), t("applications.addAtLeastOneRate"));
      return;
    }

    // Check for OTHER payment type without specification
    for (const rate of validRates) {
      if (rate.paymentType === "OTHER" && !rate.otherSpecification) {
        Alert.alert(t("common.error"), t("applications.specifyPaymentType"));
        return;
      }
    }

    try {
      setSendingCounterOffer(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired")
        );
        return;
      }

      const rates = validRates.map((r) => ({
        rate: parseFloat(r.rate),
        paymentType: r.paymentType,
        otherSpecification: r.otherSpecification || undefined,
      }));

      const totalAmount = rates.reduce((sum, r) => sum + r.rate, 0);

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${applicationId}/negotiation/counter-offer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedNegotiationId,
            rates,
            totalAmount,
            message: counterOfferMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("applications.counterOfferSent"), [
          {
            text: "OK",
            onPress: () => {
              setShowCounterOfferModal(false);
              setSelectedNegotiationId(null);
              setCounterOfferRates([{ rate: "", paymentType: "HOUR" }]);
              setCounterOfferMessage("");
              fetchApplication(true);
            },
          },
        ]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToSendCounterOffer")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setSendingCounterOffer(false);
    }
  };

  const handleRespondToAdditionalTimeRequest = async () => {
    if (!selectedAdditionalTimeRequestId || !applicationId) {
      return;
    }

    const days = parseInt(additionalDays, 10);
    if (!days || days <= 0 || !Number.isInteger(days)) {
      Alert.alert(t("common.error"), t("applications.enterValidDays"));
      return;
    }

    if (!additionalTimeExplanation.trim()) {
      Alert.alert(t("common.error"), t("applications.explainAdditionalDays"));
      return;
    }

    try {
      setRespondingToAdditionalTime(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired")
        );
        return;
      }

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${applicationId}/additional-time/respond`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedAdditionalTimeRequestId,
            additionalDays: days,
            explanation: additionalTimeExplanation.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("applications.responseSent"), [
          {
            text: "OK",
            onPress: () => {
              setShowAdditionalTimeResponseModal(false);
              setSelectedAdditionalTimeRequestId(null);
              setAdditionalDays("");
              setAdditionalTimeExplanation("");
              fetchApplication(true);
            },
          },
        ]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToSendResponse")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRespondingToAdditionalTime(false);
    }
  };

  const handleMarkJobAsDone = async () => {
    if (!application || !applicationId) {
      Alert.alert(t("common.error"), t("applications.applicationNotFound"));
      return;
    }

    // Prevent marking as done if already completed
    if (application.completedAt) {
      Alert.alert(
        t("applications.alreadyCompleted"),
        t("applications.alreadyCompletedMessage")
      );
      return;
    }

    // Confirm action
    Alert.alert(
      t("applications.markJobAsDone"),
      t("applications.markJobAsDoneMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("applications.markAsDone"),
          style: "default",
          onPress: async () => {
            try {
              setMarkingJobAsDone(true);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) {
                Alert.alert(
                  t("common.error"),
                  t("applications.authenticationRequired")
                );
                return;
              }

              const base = getApiBase();
              const res = await fetch(
                `${base}/applications/${applicationId}/mark-done`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (res.ok) {
                Alert.alert(
                  t("common.success"),
                  t("applications.jobMarkedAsDone")
                );
                await fetchApplication(true);
              } else {
                const errorData = await res.json().catch(() => ({}));
                Alert.alert(
                  t("common.error"),
                  errorData.message || t("applications.failedToMarkAsDone")
                );
              }
            } catch (error) {
              Alert.alert(t("common.error"), t("jobs.failedToConnect"));
            } finally {
              setMarkingJobAsDone(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "#22c55e";
      case "REJECTED":
        return "#ef4444";
      case "REVIEWING":
      case "SHORTLISTED":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return t("applications.statusPending");
      case "REVIEWING":
        return t("applications.statusReviewing");
      case "SHORTLISTED":
        return t("applications.statusShortlisted");
      case "ACCEPTED":
        return t("applications.statusAccepted");
      case "REJECTED":
        return t("applications.statusRejected");
      case "WITHDRAWN":
        return t("applications.statusWithdrawn");
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t("applications.loadingDetails")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!application) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color={colors.tint} />
            <Text style={[styles.errorText, { color: colors.text }]}>
              {t("applications.applicationNotFound")}
            </Text>
            <TouchableButton
              style={[styles.backButton, { backgroundColor: colors.tint }]}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>{t("common.back")}</Text>
            </TouchableButton>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            headerShown: false,
            title: "",
          }}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableButton
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.7)"
                  : "rgba(0,0,0,0.05)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "transparent",
                borderWidth: isDark ? 1 : 0,
              },
            ]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("applications.applicationDetails")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Job Information Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.95)"
                  : "rgba(255,255,255,0.9)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("jobs.jobDetails")}
            </Text>
            <Text style={[styles.jobTitle, { color: colors.text }]}>
              {application.job.title}
            </Text>
            {application.job.company?.name && (
              <Text
                style={[
                  styles.companyName,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {application.job.company.name}
              </Text>
            )}
            {application.job.description && (
              <Text
                style={[
                  styles.description,
                  { color: isDark ? "#cbd5e1" : "#475569" },
                ]}
              >
                {application.job.description}
              </Text>
            )}
            {(application.job.location || application.job.city) && (
              <View style={styles.locationRow}>
                <Feather
                  name="map-pin"
                  size={14}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
                <Text
                  style={[
                    styles.location,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {[application.job.city, application.job.country]
                    .filter(Boolean)
                    .join(", ") ||
                    application.job.location ||
                    t("jobs.locationNotSpecified")}
                </Text>
              </View>
            )}
          </View>

          {/* Application Status Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.95)"
                  : "rgba(255,255,255,0.9)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("applications.status")}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: `${getStatusColor(application.status)}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(application.status) },
                  ]}
                >
                  {getStatusLabel(application.status)}
                </Text>
              </View>
              <Text
                style={[
                  styles.appliedDate,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {t("applications.applied")}:{" "}
                {new Date(application.appliedAt).toLocaleDateString()}{" "}
                {t("applications.at")}{" "}
                {new Date(application.appliedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            {application.coverLetter && (
              <View style={styles.coverLetterSection}>
                <Text style={[styles.coverLetterLabel, { color: colors.text }]}>
                  {t("applications.coverLetter")}
                </Text>
                <Text
                  style={[
                    styles.coverLetter,
                    { color: isDark ? "#cbd5e1" : "#475569" },
                  ]}
                >
                  {application.coverLetter}
                </Text>
              </View>
            )}
          </View>

          {/* Service Verification Code Input (For Service Providers when Application is ACCEPTED) */}
          {application.status === "ACCEPTED" &&
            !application.verificationCodeVerifiedAt && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(99, 102, 241, 0.15)"
                      : "rgba(99, 102, 241, 0.08)",
                    borderColor: isDark
                      ? "rgba(99, 102, 241, 0.3)"
                      : "rgba(99, 102, 241, 0.2)",
                    borderWidth: 2,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                    gap: 10,
                  }}
                >
                  <Feather
                    name="shield"
                    size={20}
                    color={isDark ? "#818cf8" : "#6366f1"}
                  />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {t("applications.startService")}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.description,
                    {
                      color: isDark ? "#cbd5e1" : "#64748b",
                      marginBottom: 16,
                      fontSize: 13,
                      lineHeight: 18,
                    },
                  ]}
                >
                  {t("applications.startServiceDescription")}
                </Text>

                <TouchableButton
                  style={[
                    {
                      backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    },
                  ]}
                  onPress={() => {
                    setVerificationFlow("START_SERVICE");
                    setShowVerificationModal(true);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="key" size={18} color="#fff" />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {t("applications.enterVerificationCode")}
                    </Text>
                  </View>
                </TouchableButton>
              </View>
            )}

          {/* Service Started Confirmation (For Service Providers) */}
          {application.status === "ACCEPTED" &&
            application.verificationCodeVerifiedAt && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(34, 197, 94, 0.15)"
                      : "rgba(34, 197, 94, 0.1)",
                    borderColor: isDark ? "rgba(34, 197, 94, 0.4)" : "#22c55e",
                    borderWidth: 2,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Feather name="check-circle" size={20} color="#22c55e" />
                  <Text style={[styles.cardTitle, { color: "#22c55e" }]}>
                    {t("applications.serviceStarted")}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.description,
                    {
                      color: isDark ? "#86efac" : "#16a34a",
                      fontSize: 13,
                    },
                  ]}
                >
                  {t("applications.verificationCodeConfirmed")}{" "}
                  {new Date(
                    application.verificationCodeVerifiedAt
                  ).toLocaleString()}
                  . {t("applications.serviceMarkedAsStarted")}
                </Text>
              </View>
            )}

          {/* Additional Services Verification (after service already started) */}
          {(() => {
            if (application.status !== "ACCEPTED") return null;
            if (!application.verificationCodeVerifiedAt) return null;

            const currentVersion = application.verificationCodeVersion ?? 1;
            const verifiedVersion =
              application.verificationCodeVerifiedVersion ?? 0;
            const hasPending = !!application.pendingVerificationCodeVersion;
            const hasNewVersionToVerify =
              !hasPending && currentVersion > verifiedVersion;
            const lastVerifiedAt = application.verificationCodeLastVerifiedAt;
            const showAdditionalVerifiedCard =
              currentVersion > 1 &&
              verifiedVersion >= currentVersion &&
              !!lastVerifiedAt &&
              lastVerifiedAt !== application.verificationCodeVerifiedAt;

            if (hasPending) {
              return (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark
                        ? "rgba(251, 191, 36, 0.10)"
                        : "rgba(251, 191, 36, 0.12)",
                      borderColor: isDark
                        ? "rgba(251, 191, 36, 0.35)"
                        : "rgba(251, 191, 36, 0.45)",
                      borderWidth: 2,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Feather
                      name="alert-circle"
                      size={20}
                      color={isDark ? "#fbbf24" : "#d97706"}
                    />
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDark ? "#fbbf24" : "#d97706" },
                      ]}
                    >
                      {t("applications.additionalServicesPending")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.description,
                      {
                        color: isDark ? "#fde68a" : "#92400e",
                        fontSize: 13,
                        lineHeight: 18,
                      },
                    ]}
                  >
                    {t("applications.additionalServicesPendingDescription")}
                  </Text>
                </View>
              );
            }

            if (hasNewVersionToVerify) {
              return (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.15)"
                        : "rgba(99, 102, 241, 0.08)",
                      borderColor: isDark
                        ? "rgba(99, 102, 241, 0.3)"
                        : "rgba(99, 102, 241, 0.2)",
                      borderWidth: 2,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                      gap: 10,
                    }}
                  >
                    <Feather
                      name="shield"
                      size={20}
                      color={isDark ? "#818cf8" : "#6366f1"}
                    />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {t("applications.startAdditionalServices")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.description,
                      {
                        color: isDark ? "#cbd5e1" : "#64748b",
                        marginBottom: 16,
                        fontSize: 13,
                        lineHeight: 18,
                      },
                    ]}
                  >
                    {t("applications.startAdditionalServicesDescription")}
                  </Text>

                  <TouchableButton
                    style={[
                      {
                        backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                      },
                    ]}
                    onPress={() => {
                      setVerificationFlow("ADDITIONAL_SERVICES");
                      setShowVerificationModal(true);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="key" size={18} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {t("applications.enterNewCode")}
                      </Text>
                    </View>
                  </TouchableButton>
                </View>
              );
            }

            if (showAdditionalVerifiedCard) {
              return (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark
                        ? "rgba(34, 197, 94, 0.10)"
                        : "rgba(34, 197, 94, 0.08)",
                      borderColor: isDark
                        ? "rgba(34, 197, 94, 0.35)"
                        : "rgba(34, 197, 94, 0.45)",
                      borderWidth: 2,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Feather name="check-circle" size={20} color="#22c55e" />
                    <Text style={[styles.cardTitle, { color: "#22c55e" }]}>
                      {t("applications.additionalServicesStarted")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.description,
                      {
                        color: isDark ? "#86efac" : "#16a34a",
                        fontSize: 13,
                      },
                    ]}
                  >
                    {t("applications.verificationCodeConfirmed")}{" "}
                    {new Date(lastVerifiedAt as string).toLocaleString()}.{" "}
                    {t("applications.additionalServicesMarkedAsStarted")}
                  </Text>
                </View>
              );
            }

            return null;
          })()}

          {/* Payment Information - Selected Services Card */}
          {/* This shows what the employer has selected */}
          {(() => {
            // Normalize selectedRates: null/undefined = empty array
            // CRITICAL: Only show what employer has ACTUALLY selected (from application.selectedRates)
            // This should be empty if employer hasn't selected anything
            const normalizedSelectedRates =
              application.selectedRates === null ||
              application.selectedRates === undefined
                ? []
                : Array.isArray(application.selectedRates)
                  ? application.selectedRates
                  : [];

            // Log for debugging - this should match what employer sees
            // CRITICAL: If normalizedSelectedRates has items but employer hasn't selected anything,
            // this means we have stale data and should NOT display it
            console.log(
              "[MyApplication] Selected Services Card - Data check:",
              {
                selectedRatesRaw: application.selectedRates,
                normalizedSelectedRates,
                normalizedCount: normalizedSelectedRates.length,
                normalizedRates: normalizedSelectedRates.map((r: any) => ({
                  rate: r.rate,
                  paymentType: r.paymentType,
                  otherSpecification: r.otherSpecification,
                })),
                isEmpty: normalizedSelectedRates.length === 0,
                warning:
                  normalizedSelectedRates.length > 0
                    ? "WARNING: Showing selected rates - verify these match employer's actual selection"
                    : "OK: No selected rates (employer hasn't selected any services)",
              }
            );

            const hasSelectedServices = normalizedSelectedRates.length > 0;
            const approvedAdditionalRates =
              application?.additionalRateRequests &&
              Array.isArray(application.additionalRateRequests)
                ? application.additionalRateRequests.filter(
                    (req: any) => req.status === "APPROVED"
                  )
                : [];
            const hasApprovedAdditionalRates =
              approvedAdditionalRates && approvedAdditionalRates.length > 0;
            const acceptedNegotiations =
              application?.negotiationRequests &&
              Array.isArray(application.negotiationRequests)
                ? application.negotiationRequests.filter(
                    (req: any) => req.status === "ACCEPTED"
                  )
                : [];
            const hasAcceptedNegotiations =
              acceptedNegotiations && acceptedNegotiations.length > 0;

            // Calculate total EXACTLY like employer's getSelectedRatesTotal()
            let totalAmount = 0;

            // 1. Selected services from employer
            // CRITICAL: Only add if normalizedSelectedRates is not empty
            // If employer unchecked everything, normalizedSelectedRates should be empty array
            const selectedRatesTotal =
              normalizedSelectedRates.length > 0
                ? normalizedSelectedRates.reduce(
                    (sum: number, rate: any) => sum + (rate.rate || 0),
                    0
                  )
                : 0;
            totalAmount += selectedRatesTotal;

            // 2. Approved additional rate requests
            const approvedAdditionalTotal = approvedAdditionalRates.reduce(
              (sum: number, req: any) => sum + (req.totalAmount || 0),
              0
            );
            totalAmount += approvedAdditionalTotal;

            // 3. Accepted negotiation rates
            const acceptedNegotiationsTotal = acceptedNegotiations.reduce(
              (sum: number, req: any) => sum + (req.totalAmount || 0),
              0
            );
            totalAmount += acceptedNegotiationsTotal;

            console.log("[MyApplication] Final total calculation:", {
              selectedRatesCount: normalizedSelectedRates.length,
              selectedRatesTotal: selectedRatesTotal,
              approvedAdditionalTotal: approvedAdditionalTotal,
              acceptedNegotiationsTotal: acceptedNegotiationsTotal,
              finalTotal: totalAmount,
              breakdown: {
                fromSelectedRates: selectedRatesTotal,
                fromApprovedAdditional: approvedAdditionalTotal,
                fromAcceptedNegotiations: acceptedNegotiationsTotal,
              },
            });

            if (
              !hasSelectedServices &&
              !hasApprovedAdditionalRates &&
              !hasAcceptedNegotiations
            ) {
              return null;
            }

            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t("applications.paymentInformation")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 8 },
                  ]}
                >
                  {t("applications.servicesSelectedByEmployer")}
                </Text>
                {/* Warning for unpaid services - only show if there are unpaid services/negotiations */}
                {(() => {
                  const paymentStatus = application?.paymentStatus;
                  const unpaidAmount = paymentStatus?.unpaidAmount || 0;
                  const unpaidServices = paymentStatus?.unpaidServices || [];
                  const unpaidNegotiations =
                    paymentStatus?.unpaidNegotiations || [];

                  const hasUnpaidItems =
                    unpaidAmount > 0.01 ||
                    (Array.isArray(unpaidServices) &&
                      unpaidServices.length > 0) ||
                    (Array.isArray(unpaidNegotiations) &&
                      unpaidNegotiations.length > 0);

                  if (!hasUnpaidItems) {
                    return null;
                  }

                  return (
                    <View
                      style={[
                        {
                          backgroundColor: isDark
                            ? "rgba(251, 191, 36, 0.1)"
                            : "rgba(251, 191, 36, 0.08)",
                          borderColor: isDark
                            ? "rgba(251, 191, 36, 0.3)"
                            : "rgba(251, 191, 36, 0.4)",
                          borderWidth: 1,
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          {
                            color: isDark ? "#fbbf24" : "#d97706",
                            fontSize: 13,
                            lineHeight: 18,
                            textAlign: "left",
                          },
                        ]}
                      >
                        {t("applications.responsibilityWarning")}
                      </Text>
                    </View>
                  );
                })()}
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: colors.text, marginBottom: 8, marginTop: 4 },
                  ]}
                >
                  {t("applications.selectedServices")}
                </Text>
                {/* Selected services from employer - show paid (green) vs unpaid */}
                {hasSelectedServices &&
                  normalizedSelectedRates.map((rate: any, idx: number) => {
                    const paymentTypeLabel =
                      rate.paymentType === "OTHER" && rate.otherSpecification
                        ? rate.otherSpecification
                        : rate.paymentType === "HOURLY"
                          ? t("applications.hourly")
                          : rate.paymentType === "DAILY"
                            ? t("applications.daily")
                            : rate.paymentType === "WEEKLY"
                              ? t("applications.weekly")
                              : rate.paymentType === "MONTHLY"
                                ? t("applications.monthly")
                                : rate.paymentType === "PROJECT"
                                  ? t("applications.project")
                                  : rate.paymentType === "OTHER"
                                    ? t("onboarding.other")
                                    : rate.paymentType.charAt(0) +
                                      rate.paymentType.slice(1).toLowerCase();

                    // Check if this service is paid
                    const paymentStatus = application?.paymentStatus;
                    const paidServices = paymentStatus?.paidServices || [];
                    const unpaidServices = paymentStatus?.unpaidServices || [];

                    // Helper to match services
                    const matchService = (s1: any, s2: any): boolean => {
                      return (
                        Math.abs(s1.rate - s2.rate) < 0.01 &&
                        s1.paymentType === s2.paymentType &&
                        (s1.otherSpecification || "") ===
                          (s2.otherSpecification || "")
                      );
                    };

                    const isPaid = paidServices.some((paid: any) =>
                      matchService(rate, paid)
                    );
                    const isUnpaid = unpaidServices.some((unpaid: any) =>
                      matchService(rate, unpaid)
                    );

                    // Color: green for paid, yellow/orange for unpaid
                    const textColor = isPaid
                      ? "#22c55e" // Green for paid
                      : isUnpaid
                        ? isDark
                          ? "#fbbf24"
                          : "#d97706" // Yellow/orange for unpaid
                        : isDark
                          ? "#cbd5e1"
                          : "#475569"; // Default

                    return (
                      <View key={`selected-${idx}`} style={styles.summaryRow}>
                        <Text
                          style={[styles.summaryText, { color: textColor }]}
                        >
                          €{rate.rate}/{paymentTypeLabel}
                          {isPaid && ` ✓ ${t("applications.paid")}`}
                          {isUnpaid && ` (${t("applications.unpaid")})`}
                        </Text>
                      </View>
                    );
                  })}
                {/* Approved additional rate requests - show paid (green) vs unpaid */}
                {hasApprovedAdditionalRates &&
                  approvedAdditionalRates.map(
                    (request: any, reqIdx: number) => {
                      if (!request.rates || !Array.isArray(request.rates))
                        return null;

                      // Check if this service is paid (approved rates are treated as selected services)
                      const paymentStatus = application?.paymentStatus;
                      const paidServices = paymentStatus?.paidServices || [];
                      const unpaidServices =
                        paymentStatus?.unpaidServices || [];

                      // Helper to match services
                      const matchService = (s1: any, s2: any): boolean => {
                        return (
                          Math.abs(s1.rate - s2.rate) < 0.01 &&
                          s1.paymentType === s2.paymentType &&
                          (s1.otherSpecification || "") ===
                            (s2.otherSpecification || "")
                        );
                      };

                      return request.rates.map((rate: any, rateIdx: number) => {
                        const paymentTypeLabel =
                          rate.paymentType === "OTHER" &&
                          rate.otherSpecification
                            ? rate.otherSpecification
                            : rate.paymentType === "HOURLY"
                              ? t("applications.hourly")
                              : rate.paymentType === "DAILY"
                                ? t("applications.daily")
                                : rate.paymentType === "WEEKLY"
                                  ? t("applications.weekly")
                                  : rate.paymentType === "MONTHLY"
                                    ? t("applications.monthly")
                                    : rate.paymentType === "PROJECT"
                                      ? t("applications.project")
                                      : rate.paymentType === "OTHER"
                                        ? t("onboarding.other")
                                        : rate.paymentType.charAt(0) +
                                          rate.paymentType
                                            .slice(1)
                                            .toLowerCase();

                        const isPaid = paidServices.some((paid: any) =>
                          matchService(rate, paid)
                        );
                        const isUnpaid = unpaidServices.some((unpaid: any) =>
                          matchService(rate, unpaid)
                        );

                        // Color: green for paid, yellow/orange for unpaid
                        const textColor = isPaid
                          ? "#22c55e" // Green for paid
                          : isUnpaid
                            ? isDark
                              ? "#fbbf24"
                              : "#d97706" // Yellow/orange for unpaid
                            : isDark
                              ? "#cbd5e1"
                              : "#475569"; // Default

                        return (
                          <View
                            key={`approved-${reqIdx}-${rateIdx}`}
                            style={styles.summaryRow}
                          >
                            <Text
                              style={[styles.summaryText, { color: textColor }]}
                            >
                              €{rate.rate}/{paymentTypeLabel} (
                              {t("applications.approved")})
                              {isPaid && ` ✓ ${t("applications.paid")}`}
                              {isUnpaid && ` (${t("applications.unpaid")})`}
                            </Text>
                          </View>
                        );
                      });
                    }
                  )}
                {/* Accepted negotiation rates - show paid (green) vs unpaid */}
                {hasAcceptedNegotiations &&
                  acceptedNegotiations.map((request: any, reqIdx: number) => {
                    if (!request.rates || !Array.isArray(request.rates))
                      return null;

                    // Check if this negotiation is paid
                    const paymentStatus = application?.paymentStatus;
                    const paidNegotiations =
                      paymentStatus?.paidNegotiations || [];
                    const unpaidNegotiations =
                      paymentStatus?.unpaidNegotiations || [];

                    const isPaid = paidNegotiations.some(
                      (paid: any) => paid.id === request.id
                    );
                    const isUnpaid = unpaidNegotiations.some(
                      (unpaid: any) => unpaid.id === request.id
                    );

                    // Color: green for paid, yellow/orange for unpaid
                    const textColor = isPaid
                      ? "#22c55e" // Green for paid
                      : isUnpaid
                        ? isDark
                          ? "#fbbf24"
                          : "#d97706" // Yellow/orange for unpaid
                        : isDark
                          ? "#cbd5e1"
                          : "#475569"; // Default

                    return request.rates.map((rate: any, rateIdx: number) => {
                      const paymentTypeLabel =
                        rate.paymentType === "OTHER" && rate.otherSpecification
                          ? rate.otherSpecification
                          : rate.paymentType === "HOURLY"
                            ? t("applications.hourly")
                            : rate.paymentType === "DAILY"
                              ? t("applications.daily")
                              : rate.paymentType === "WEEKLY"
                                ? t("applications.weekly")
                                : rate.paymentType === "MONTHLY"
                                  ? t("applications.monthly")
                                  : rate.paymentType === "PROJECT"
                                    ? t("applications.project")
                                    : rate.paymentType === "OTHER"
                                      ? t("onboarding.other")
                                      : rate.paymentType.charAt(0) +
                                        rate.paymentType.slice(1).toLowerCase();
                      return (
                        <View
                          key={`negotiation-${reqIdx}-${rateIdx}`}
                          style={styles.summaryRow}
                        >
                          <Text
                            style={[styles.summaryText, { color: textColor }]}
                          >
                            €{rate.rate}/{paymentTypeLabel} (
                            {t("applications.negotiationAccepted")})
                            {isPaid && ` ✓ ${t("applications.paid")}`}
                            {isUnpaid && ` (${t("applications.unpaid")})`}
                          </Text>
                        </View>
                      );
                    });
                  })}
                {/* Show paid and unpaid amounts separately */}
                {(() => {
                  const paymentStatus = application?.paymentStatus;
                  const paidAmount = paymentStatus?.paidAmount || 0;
                  const unpaidAmount = paymentStatus?.unpaidAmount || 0;

                  return (
                    <>
                      {paidAmount > 0 && (
                        <View style={[styles.totalRow, { marginTop: 8 }]}>
                          <Text
                            style={[styles.totalLabel, { color: colors.text }]}
                          >
                            {t("applications.paidAmount")}:
                          </Text>
                          <Text
                            style={[styles.totalAmount, { color: "#22c55e" }]}
                          >
                            {application.currency?.toUpperCase() || "EUR"}{" "}
                            {paidAmount.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {unpaidAmount > 0 && (
                        <View
                          style={[
                            styles.totalRow,
                            { marginTop: paidAmount > 0 ? 4 : 8 },
                          ]}
                        >
                          <Text
                            style={[styles.totalLabel, { color: colors.text }]}
                          >
                            {t("applications.unpaidAmount")}:
                          </Text>
                          <Text
                            style={[
                              styles.totalAmount,
                              { color: isDark ? "#fbbf24" : "#d97706" },
                            ]}
                          >
                            {application.currency?.toUpperCase() || "EUR"}{" "}
                            {unpaidAmount.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.totalRow,
                          {
                            marginTop:
                              paidAmount > 0 || unpaidAmount > 0 ? 8 : 0,
                            borderTopWidth:
                              paidAmount > 0 || unpaidAmount > 0 ? 1 : 0,
                            borderTopColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                            paddingTop:
                              paidAmount > 0 || unpaidAmount > 0 ? 8 : 0,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.totalLabel,
                            { color: colors.text, fontWeight: "bold" },
                          ]}
                        >
                          {t("applications.totalAmount")}:
                        </Text>
                        <Text
                          style={[
                            styles.totalAmount,
                            { color: "#22c55e", fontWeight: "bold" },
                          ]}
                        >
                          {application.currency?.toUpperCase() || "EUR"}{" "}
                          {totalAmount.toFixed(2)}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            );
          })()}

          {/* Additional Rates Requests Card */}
          {/* Additional rates requests removed in favor of negotiation requests */}

          {/* Negotiation Suggestions from Employer (Service Provider can respond) */}
          {application.negotiationRequests &&
            application.negotiationRequests.filter(
              (req: any) => req.suggestedByRole === "EMPLOYER"
            ).length > 0 && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t("applications.negotiationSuggestions")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 16 },
                  ]}
                >
                  {t("applications.employerSuggestedRates")}
                </Text>
                {application.negotiationRequests
                  .filter((req: any) => req.suggestedByRole === "EMPLOYER")
                  .map((request, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.requestCard,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.02)",
                          borderColor:
                            request.status === "ACCEPTED"
                              ? "#22c55e"
                              : request.status === "REJECTED"
                                ? "#ef4444"
                                : isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                        },
                      ]}
                    >
                      <View style={styles.requestHeader}>
                        <Text
                          style={[
                            styles.requestStatus,
                            {
                              color:
                                request.status === "ACCEPTED"
                                  ? "#22c55e"
                                  : request.status === "REJECTED"
                                    ? "#ef4444"
                                    : "#f59e0b",
                            },
                          ]}
                        >
                          {request.status === "ACCEPTED"
                            ? `✓ ${t("applications.statusAccepted")}`
                            : request.status === "REJECTED"
                              ? `✗ ${t("applications.statusRejected")}`
                              : `⏳ ${t("applications.pendingResponse")}`}
                        </Text>
                        <Text
                          style={[
                            styles.requestDate,
                            { color: isDark ? "#94a3b8" : "#64748b" },
                          ]}
                        >
                          {new Date(request.suggestedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {request.rates.map((rate, rateIdx) => {
                        const paymentTypeLabel =
                          rate.paymentType === "OTHER" &&
                          rate.otherSpecification
                            ? rate.otherSpecification
                            : rate.paymentType === "HOURLY"
                              ? t("applications.hourly")
                              : rate.paymentType === "HOUR"
                                ? t("applications.hourly")
                                : rate.paymentType === "DAILY"
                                  ? t("applications.daily")
                                  : rate.paymentType === "WEEKLY"
                                    ? t("applications.weekly")
                                    : rate.paymentType === "MONTHLY"
                                      ? t("applications.monthly")
                                      : rate.paymentType === "PROJECT"
                                        ? t("applications.project")
                                        : rate.paymentType === "OTHER"
                                          ? t("onboarding.other")
                                          : rate.paymentType.charAt(0) +
                                            rate.paymentType
                                              .slice(1)
                                              .toLowerCase();
                        return (
                          <Text
                            key={rateIdx}
                            style={[styles.requestRate, { color: colors.text }]}
                          >
                            €{rate.rate}/{paymentTypeLabel}
                          </Text>
                        );
                      })}
                      <Text
                        style={[styles.requestTotal, { color: colors.text }]}
                      >
                        {t("applications.total")}: EUR{" "}
                        {request.totalAmount.toFixed(2)}
                      </Text>
                      {request.message && (
                        <View
                          style={[
                            styles.responseMessage,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.02)",
                              marginTop: 12,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.responseLabel,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {t("applications.employersExplanation")}:
                          </Text>
                          <Text
                            style={[
                              styles.responseText,
                              { color: isDark ? "#cbd5e1" : "#475569" },
                            ]}
                          >
                            {request.message}
                          </Text>
                        </View>
                      )}
                      {request.status === "PENDING" && (
                        <View style={{ marginTop: 12 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <TouchableButton
                              style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: "#22c55e",
                                alignItems: "center",
                              }}
                              onPress={() => {
                                setSelectedNegotiationId(request.id);
                                setSelectedNegotiationStatus("ACCEPTED");
                                setShowNegotiationRespondModal(true);
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                {t("common.accept")}
                              </Text>
                            </TouchableButton>
                            <TouchableButton
                              style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: "#ef4444",
                                alignItems: "center",
                              }}
                              onPress={() => {
                                setSelectedNegotiationId(request.id);
                                setSelectedNegotiationStatus("REJECTED");
                                setShowNegotiationRespondModal(true);
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                {t("applications.reject")}
                              </Text>
                            </TouchableButton>
                          </View>
                          <TouchableButton
                            style={{
                              padding: 12,
                              borderRadius: 8,
                              backgroundColor: isDark ? "#6366f1" : "#6366f1",
                              alignItems: "center",
                              borderWidth: 1,
                              borderColor: "#6366f1",
                            }}
                            onPress={() => {
                              setSelectedNegotiationId(request.id);
                              setCounterOfferRates([
                                { rate: "", paymentType: "HOUR" },
                              ]);
                              setCounterOfferMessage("");
                              setShowCounterOfferModal(true);
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600" }}>
                              {t("applications.proposeCounterOffer")}
                            </Text>
                          </TouchableButton>
                        </View>
                      )}
                      {request.responseMessage && (
                        <View
                          style={[
                            styles.responseMessage,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.02)",
                              marginTop: 12,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.responseLabel,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {t("applications.yourResponse")}:
                          </Text>
                          <Text
                            style={[
                              styles.responseText,
                              { color: isDark ? "#cbd5e1" : "#475569" },
                            ]}
                          >
                            {request.responseMessage}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
              </View>
            )}

          {/* Negotiation Requests from Service Provider (Read-only, show status) */}
          {application.negotiationRequests &&
            application.negotiationRequests.filter(
              (req: any) => req.suggestedByRole === "JOB_SEEKER"
            ).length > 0 && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t("applications.negotiationRequests")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 16 },
                  ]}
                >
                  {t("applications.yourNegotiationRequests")}
                </Text>
                {application.negotiationRequests
                  .filter((req: any) => req.suggestedByRole === "JOB_SEEKER")
                  .map((request, idx) => {
                    const isAccepted = request.status === "ACCEPTED";
                    const isRejected = request.status === "REJECTED";
                    const hasCounterOffer =
                      request.status === "COUNTER_OFFERED" &&
                      request.counterOffer;
                    const isPending = request.status === "PENDING";
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.requestCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.02)",
                            borderColor: isAccepted
                              ? "#22c55e"
                              : isRejected
                                ? "#ef4444"
                                : hasCounterOffer
                                  ? "#6366f1"
                                  : isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                          },
                        ]}
                      >
                        <View style={styles.requestHeader}>
                          <Text
                            style={[
                              styles.requestStatus,
                              {
                                color: isAccepted
                                  ? "#22c55e"
                                  : isRejected
                                    ? "#ef4444"
                                    : hasCounterOffer
                                      ? "#6366f1"
                                      : "#f59e0b",
                              },
                            ]}
                          >
                            {isAccepted
                              ? `✓ ${t("applications.accepted")}`
                              : isRejected
                                ? `✗ ${t("applications.rejected")}`
                                : hasCounterOffer
                                  ? `💬 ${t("applications.counterOfferReceived")}`
                                  : `⏳ ${t("applications.pending")}`}
                          </Text>
                          <Text
                            style={[
                              styles.requestDate,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {new Date(request.suggestedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {request.rates.map((rate: any, rateIdx: number) => {
                          const ratePaymentTypeLabel =
                            rate.paymentType === "OTHER" &&
                            rate.otherSpecification
                              ? rate.otherSpecification
                              : rate.paymentType === "HOURLY"
                                ? t("applications.hourly")
                                : rate.paymentType === "HOUR"
                                  ? t("applications.hourly")
                                  : rate.paymentType === "DAILY"
                                    ? t("applications.daily")
                                    : rate.paymentType === "WEEKLY"
                                      ? t("applications.weekly")
                                      : rate.paymentType === "MONTHLY"
                                        ? t("applications.monthly")
                                        : rate.paymentType === "PROJECT"
                                          ? t("applications.project")
                                          : rate.paymentType === "OTHER"
                                            ? t("onboarding.other")
                                            : rate.paymentType.charAt(0) +
                                              rate.paymentType
                                                .slice(1)
                                                .toLowerCase();
                          return (
                            <Text
                              key={rateIdx}
                              style={[
                                styles.requestRate,
                                { color: colors.text },
                              ]}
                            >
                              €{rate.rate}/{ratePaymentTypeLabel}
                            </Text>
                          );
                        })}
                        <Text
                          style={[styles.requestTotal, { color: colors.text }]}
                        >
                          {t("applications.total")}: EUR{" "}
                          {request.totalAmount.toFixed(2)}
                        </Text>
                        {request.message && (
                          <View
                            style={[
                              styles.responseMessage,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.02)",
                                marginTop: 12,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#94a3b8" : "#64748b" },
                              ]}
                            >
                              {t("applications.yourExplanation")}:
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {request.message}
                            </Text>
                          </View>
                        )}
                        {request.responseMessage && !hasCounterOffer && (
                          <View
                            style={[
                              styles.responseMessage,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.02)",
                                marginTop: 12,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#94a3b8" : "#64748b" },
                              ]}
                            >
                              {t("applications.employersResponse")}:
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {request.responseMessage}
                            </Text>
                          </View>
                        )}
                        {hasCounterOffer && request.counterOffer && (
                          <View
                            style={[
                              styles.responseMessage,
                              {
                                backgroundColor: isDark
                                  ? "rgba(99, 102, 241, 0.1)"
                                  : "rgba(99, 102, 241, 0.05)",
                                marginTop: 12,
                                borderLeftWidth: 3,
                                borderLeftColor: "#6366f1",
                                paddingLeft: 12,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: "#6366f1", fontWeight: "700" },
                              ]}
                            >
                              {t("applications.employersCounterOffer")}:
                            </Text>
                            {request.counterOffer.rates &&
                              Array.isArray(request.counterOffer.rates) &&
                              request.counterOffer.rates.map(
                                (rate: any, rateIdx: number) => {
                                  const paymentTypeLabel =
                                    rate.paymentType === "OTHER" &&
                                    rate.otherSpecification
                                      ? rate.otherSpecification
                                      : rate.paymentType.charAt(0) +
                                        rate.paymentType.slice(1).toLowerCase();
                                  return (
                                    <Text
                                      key={rateIdx}
                                      style={[
                                        styles.requestRate,
                                        { color: colors.text, marginTop: 4 },
                                      ]}
                                    >
                                      €{rate.rate}/{paymentTypeLabel}
                                    </Text>
                                  );
                                }
                              )}
                            <Text
                              style={[
                                styles.requestTotal,
                                { color: colors.text, marginTop: 4 },
                              ]}
                            >
                              {t("applications.total")}: EUR{" "}
                              {request.counterOffer.totalAmount?.toFixed(2) ||
                                "0.00"}
                            </Text>
                            {request.counterOffer.message && (
                              <Text
                                style={[
                                  styles.responseText,
                                  {
                                    color: isDark ? "#cbd5e1" : "#475569",
                                    marginTop: 8,
                                  },
                                ]}
                              >
                                {request.counterOffer.message}
                              </Text>
                            )}
                            {request.counterOffer.status === "PENDING" && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 8,
                                  marginTop: 12,
                                }}
                              >
                                <TouchableButton
                                  style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#22c55e",
                                    alignItems: "center",
                                  }}
                                  onPress={async () => {
                                    if (!request.counterOffer?.id) return;
                                    try {
                                      setIsRespondingToCounterOffer(true);
                                      const token =
                                        await SecureStore.getItemAsync(
                                          "auth_token"
                                        );
                                      if (!token) {
                                        Alert.alert(
                                          t("common.error"),
                                          t(
                                            "applications.authenticationRequired"
                                          )
                                        );
                                        return;
                                      }

                                      // Accept the counter offer - this will update the negotiation request
                                      // to use the counter offer rates and set status to ACCEPTED
                                      const base = getApiBase();
                                      const res = await fetch(
                                        `${base}/applications/${applicationId}/negotiation/counter-offer/respond-service-provider`,
                                        {
                                          method: "POST",
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            requestId: request.id,
                                            counterOfferId:
                                              request.counterOffer.id,
                                            status: "ACCEPTED",
                                            message:
                                              negotiationResponseMessage.trim() ||
                                              undefined,
                                          }),
                                        }
                                      );

                                      if (res.ok) {
                                        Alert.alert(
                                          t("common.success"),
                                          t("applications.counterOfferAccepted")
                                        );
                                        await fetchApplication(true);
                                      } else {
                                        const errorData = await res
                                          .json()
                                          .catch(() => ({}));
                                        Alert.alert(
                                          t("common.error"),
                                          errorData.message ||
                                            t(
                                              "applications.failedToAcceptCounterOffer"
                                            )
                                        );
                                      }
                                    } catch (error) {
                                      Alert.alert(
                                        t("common.error"),
                                        t("jobs.failedToConnect")
                                      );
                                    } finally {
                                      setIsRespondingToCounterOffer(false);
                                    }
                                  }}
                                  disabled={isRespondingToCounterOffer}
                                >
                                  {isRespondingToCounterOffer ? (
                                    <ActivityIndicator color="#fff" />
                                  ) : (
                                    <Text
                                      style={{
                                        color: "#fff",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {t("common.accept")}
                                    </Text>
                                  )}
                                </TouchableButton>
                                <TouchableButton
                                  style={{
                                    flex: 1,
                                    padding: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#ef4444",
                                    alignItems: "center",
                                  }}
                                  onPress={async () => {
                                    if (!request.counterOffer?.id) return;
                                    try {
                                      setIsRespondingToCounterOffer(true);
                                      const token =
                                        await SecureStore.getItemAsync(
                                          "auth_token"
                                        );
                                      if (!token) {
                                        Alert.alert(
                                          t("common.error"),
                                          t(
                                            "applications.authenticationRequired"
                                          )
                                        );
                                        return;
                                      }

                                      // Reject the counter offer
                                      const base = getApiBase();
                                      const res = await fetch(
                                        `${base}/applications/${applicationId}/negotiation/counter-offer/respond-service-provider`,
                                        {
                                          method: "POST",
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            requestId: request.id,
                                            counterOfferId:
                                              request.counterOffer.id,
                                            status: "REJECTED",
                                            message:
                                              negotiationResponseMessage.trim() ||
                                              undefined,
                                          }),
                                        }
                                      );

                                      if (res.ok) {
                                        Alert.alert(
                                          t("common.success"),
                                          t("applications.counterOfferRejected")
                                        );
                                        await fetchApplication(true);
                                      } else {
                                        const errorData = await res
                                          .json()
                                          .catch(() => ({}));
                                        Alert.alert(
                                          t("common.error"),
                                          errorData.message ||
                                            t(
                                              "applications.failedToRejectCounterOffer"
                                            )
                                        );
                                      }
                                    } catch (error) {
                                      Alert.alert(
                                        t("common.error"),
                                        t("jobs.failedToConnect")
                                      );
                                    } finally {
                                      setIsRespondingToCounterOffer(false);
                                    }
                                  }}
                                  disabled={isRespondingToCounterOffer}
                                >
                                  {isRespondingToCounterOffer ? (
                                    <ActivityIndicator color="#fff" />
                                  ) : (
                                    <Text
                                      style={{
                                        color: "#fff",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {t("applications.reject")}
                                    </Text>
                                  )}
                                </TouchableButton>
                              </View>
                            )}
                            {request.counterOffer.status === "PENDING" && (
                              <TouchableButton
                                style={{
                                  padding: 12,
                                  borderRadius: 8,
                                  backgroundColor: isDark
                                    ? "#6366f1"
                                    : "#6366f1",
                                  alignItems: "center",
                                  borderWidth: 1,
                                  borderColor: "#6366f1",
                                  marginTop: 8,
                                }}
                                onPress={() => {
                                  setSelectedNegotiationId(request.id);
                                  setCounterOfferRates([
                                    { rate: "", paymentType: "HOURLY" },
                                  ]);
                                  setCounterOfferMessage("");
                                  setShowCounterOfferModal(true);
                                }}
                              >
                                <Text
                                  style={{ color: "#fff", fontWeight: "600" }}
                                >
                                  {t("applications.requestDifferentRate")}
                                </Text>
                              </TouchableButton>
                            )}
                            {request.counterOffer.status === "ACCEPTED" && (
                              <Text
                                style={[
                                  styles.responseLabel,
                                  {
                                    color: "#22c55e",
                                    marginTop: 8,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                ✓ {t("applications.counterOfferAcceptedTitle")}
                              </Text>
                            )}
                            {request.counterOffer.status === "REJECTED" && (
                              <Text
                                style={[
                                  styles.responseLabel,
                                  {
                                    color: "#ef4444",
                                    marginTop: 8,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                ✗ {t("applications.counterOfferRejectedTitle")}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}

          {/* Additional Time Requests Section */}
          {application.status === "ACCEPTED" &&
            !application.completedAt &&
            (application.additionalTimeRequests &&
            Array.isArray(application.additionalTimeRequests) &&
            application.additionalTimeRequests.length > 0 ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.1)",
                    marginBottom: 16,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.additionalTimeRequests")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 16 },
                  ]}
                >
                  {t("applications.employerRequestsAdditionalTime")}
                </Text>
                {application.additionalTimeRequests.map(
                  (request: any, idx: number) => {
                    const isPending = request.status === "PENDING";
                    const isPendingApproval =
                      request.status === "PENDING_EMPLOYER_APPROVAL";
                    const isAccepted = request.status === "ACCEPTED";
                    const isRejected = request.status === "REJECTED";

                    return (
                      <View
                        key={request.id || idx}
                        style={[
                          styles.requestCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.02)",
                            borderColor: isAccepted
                              ? "#22c55e"
                              : isRejected
                                ? "#ef4444"
                                : isPendingApproval
                                  ? "#f59e0b"
                                  : isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            marginBottom:
                              idx <
                              application.additionalTimeRequests!.length - 1
                                ? 12
                                : 0,
                          },
                        ]}
                      >
                        <View style={styles.requestHeader}>
                          <Text
                            style={[
                              styles.requestStatusText,
                              {
                                color: isAccepted
                                  ? "#22c55e"
                                  : isRejected
                                    ? "#ef4444"
                                    : isPendingApproval
                                      ? "#f59e0b"
                                      : "#6366f1",
                              },
                            ]}
                          >
                            {isAccepted
                              ? `✓ ${t("applications.accepted")}`
                              : isRejected
                                ? `✗ ${t("applications.rejected")}`
                                : isPendingApproval
                                  ? `⏳ ${t("applications.waitingForEmployerResponse")}`
                                  : `📤 ${t("applications.awaitingYourResponse")}`}
                          </Text>
                          <Text
                            style={[
                              styles.requestDate,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </Text>
                        </View>

                        {request.requestedBy === "EMPLOYER" && (
                          <View style={{ marginTop: 8 }}>
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {t("applications.employersRequestLabel")}
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                {
                                  color: isDark ? "#cbd5e1" : "#475569",
                                  marginTop: 4,
                                },
                              ]}
                            >
                              {request.message}
                            </Text>
                          </View>
                        )}

                        {isPending && (
                          <TouchableButton
                            style={{
                              marginTop: 12,
                              padding: 12,
                              borderRadius: 8,
                              backgroundColor: isDark ? "#6366f1" : "#6366f1",
                              alignItems: "center",
                            }}
                            onPress={() => {
                              setSelectedAdditionalTimeRequestId(request.id);
                              setAdditionalDays("");
                              setAdditionalTimeExplanation("");
                              setShowAdditionalTimeResponseModal(true);
                            }}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600" }}>
                              {t(
                                "applications.respondWithAdditionalDaysNeeded"
                              )}
                            </Text>
                          </TouchableButton>
                        )}

                        {isPendingApproval && request.additionalDays && (
                          <View
                            style={[
                              {
                                backgroundColor: isDark
                                  ? "rgba(245, 158, 11, 0.1)"
                                  : "rgba(245, 158, 11, 0.05)",
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 8,
                                borderLeftWidth: 3,
                                borderLeftColor: "#f59e0b",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: "#f59e0b", fontWeight: "700" },
                              ]}
                            >
                              {t("applications.yourResponse")}:
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                {
                                  color: colors.text,
                                  marginTop: 4,
                                  fontWeight: "600",
                                },
                              ]}
                            >
                              {t("applications.additionalDaysRequested")}:{" "}
                              {request.additionalDays}
                            </Text>
                            {request.explanation && (
                              <Text
                                style={[
                                  styles.responseText,
                                  {
                                    color: isDark ? "#cbd5e1" : "#475569",
                                    marginTop: 8,
                                  },
                                ]}
                              >
                                {request.explanation}
                              </Text>
                            )}
                          </View>
                        )}

                        {isAccepted && request.employerResponseMessage && (
                          <View style={{ marginTop: 12 }}>
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {t("applications.employersResponseLabel")}
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                {
                                  color: isDark ? "#cbd5e1" : "#475569",
                                  marginTop: 4,
                                },
                              ]}
                            >
                              {request.employerResponseMessage}
                            </Text>
                          </View>
                        )}

                        {isRejected && request.employerResponseMessage && (
                          <View style={{ marginTop: 12 }}>
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {t("applications.employersResponseLabel")}
                            </Text>
                            <Text
                              style={[
                                styles.responseText,
                                {
                                  color: isDark ? "#cbd5e1" : "#475569",
                                  marginTop: 4,
                                },
                              ]}
                            >
                              {request.employerResponseMessage}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  }
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.1)",
                    marginBottom: 16,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.additionalTimeRequests")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {t(
                    "applications.noAdditionalTimeRequestsYetForServiceProvider"
                  )}
                </Text>
              </View>
            ))}

          {/* Mark Job as Done Button */}
          {application &&
            application.status === "ACCEPTED" &&
            !application.completedAt &&
            application.verificationCodeVerifiedAt && (
              <TouchableButton
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(34, 197, 94, 0.1)",
                    borderColor: "#22c55e",
                    borderWidth: 2,
                    marginBottom: 16,
                  },
                ]}
                onPress={handleMarkJobAsDone}
                disabled={
                  markingJobAsDone || !!application.serviceProviderMarkedDoneAt
                }
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Feather
                    name={
                      application.serviceProviderMarkedDoneAt
                        ? "check-circle"
                        : "check"
                    }
                    size={24}
                    color="#22c55e"
                  />
                  <Text style={[styles.cardTitle, { color: "#22c55e" }]}>
                    {application.serviceProviderMarkedDoneAt
                      ? t("applications.jobMarkedAsDoneTitle")
                      : t("applications.markJobAsDone")}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#86efac" : "#065f46", marginTop: 8 },
                  ]}
                >
                  {application.serviceProviderMarkedDoneAt
                    ? t("applications.employerNotifiedWaiting")
                    : t("applications.notifyEmployerJobComplete")}
                </Text>
                {markingJobAsDone && (
                  <ActivityIndicator color="#22c55e" style={{ marginTop: 8 }} />
                )}
              </TouchableButton>
            )}

          {/* Request Negotiation Button (replaces Additional Rates) */}
          {application && (
            <TouchableButton
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "rgba(255,255,255,0.9)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => setShowNegotiationRequestModal(true)}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.tint, fontSize: 20 }}>€</Text>
                <Text style={[styles.cardTitle, { color: colors.tint }]}>
                  {t("applications.requestNegotiation")}
                </Text>
              </View>
              <Text
                style={[
                  styles.paymentSubtitle,
                  { color: isDark ? "#94a3b8" : "#64748b", marginTop: 8 },
                ]}
              >
                {t("applications.proposeDifferentRate")}
              </Text>
            </TouchableButton>
          )}
        </ScrollView>

        {/* Request Negotiation Modal */}
        <Modal
          visible={showNegotiationRequestModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowNegotiationRequestModal(false);
            setNegotiationRequestRates([{ rate: "", paymentType: "HOURLY" }]);
            setNegotiationRequestMessage("");
          }}
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)",
              },
            ]}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  borderRadius: 24,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 10,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("applications.requestNegotiation")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowNegotiationRequestModal(false);
                    setNegotiationRequestRates([
                      { rate: "", paymentType: "HOURLY" },
                    ]);
                    setNegotiationRequestMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {t("applications.requestNegotiationDescription")}
                </Text>

                {/* Negotiation Rates */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.suggestedRates")} *
                </Text>
                {negotiationRequestRates.map((rate, idx) => (
                  <View key={idx} style={{ marginBottom: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <TextInput
                        style={[
                          styles.modalTextArea,
                          {
                            flex: 1,
                            minHeight: 56,
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "#f1f5f9",
                            borderColor: isDark
                              ? "rgba(255,255,255,0.15)"
                              : "#cbd5e1",
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "500",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderRadius: 12,
                            borderWidth: 1.5,
                          },
                        ]}
                        placeholder={t("applications.amount")}
                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                        value={rate.rate}
                        onChangeText={(text) => {
                          const updated = [...negotiationRequestRates];
                          updated[idx].rate = text;
                          setNegotiationRequestRates(updated);
                        }}
                        keyboardType="numeric"
                      />
                      <TouchableButton
                        onPress={() => {
                          const updated = negotiationRequestRates.filter(
                            (_, i) => i !== idx
                          );
                          if (updated.length === 0) {
                            updated.push({ rate: "", paymentType: "HOURLY" });
                          }
                          setNegotiationRequestRates(updated);
                        }}
                        style={{
                          padding: 14,
                          backgroundColor: isDark
                            ? "rgba(239, 68, 68, 0.25)"
                            : "#fee2e2",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(239, 68, 68, 0.4)"
                            : "#fecaca",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableButton>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        {[
                          "HOURLY",
                          "DAILY",
                          "WEEKLY",
                          "MONTHLY",
                          "PROJECT",
                          "OTHER",
                        ].map((type) => (
                          <TouchableButton
                            key={type}
                            onPress={() => {
                              const updated = [...negotiationRequestRates];
                              updated[idx].paymentType = type;
                              setNegotiationRequestRates(updated);
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              backgroundColor:
                                rate.paymentType === type
                                  ? isDark
                                    ? colors.tint + "30"
                                    : colors.tint + "15"
                                  : isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "#f1f5f9",
                              borderColor:
                                rate.paymentType === type
                                  ? colors.tint
                                  : isDark
                                    ? "rgba(255,255,255,0.15)"
                                    : "#cbd5e1",
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  rate.paymentType === type
                                    ? colors.tint
                                    : colors.text,
                                fontSize: 14,
                                fontWeight:
                                  rate.paymentType === type ? "700" : "500",
                              }}
                            >
                              {type === "HOURLY"
                                ? t("applications.hourly")
                                : type === "DAILY"
                                  ? t("applications.daily")
                                  : type === "WEEKLY"
                                    ? t("applications.weekly")
                                    : type === "MONTHLY"
                                      ? t("applications.monthly")
                                      : type === "PROJECT"
                                        ? t("applications.project")
                                        : type === "OTHER"
                                          ? t("onboarding.other")
                                          : type.charAt(0) +
                                            type
                                              .slice(1)
                                              .toLowerCase()
                                              .replace("_", " ")}
                            </Text>
                          </TouchableButton>
                        ))}
                      </View>
                      {rate.paymentType === "OTHER" && (
                        <TextInput
                          style={[
                            styles.modalTextArea,
                            {
                              minHeight: 56,
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "#f1f5f9",
                              borderColor: isDark
                                ? "rgba(255,255,255,0.15)"
                                : "#cbd5e1",
                              color: colors.text,
                              fontSize: 16,
                              fontWeight: "500",
                              paddingHorizontal: 16,
                              paddingVertical: 14,
                              borderRadius: 12,
                              borderWidth: 1.5,
                            },
                          ]}
                          placeholder={t(
                            "applications.specifyPaymentTypePlaceholder"
                          )}
                          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                          value={rate.otherSpecification}
                          onChangeText={(text) => {
                            const updated = [...negotiationRequestRates];
                            updated[idx].otherSpecification = text;
                            setNegotiationRequestRates(updated);
                          }}
                        />
                      )}
                    </View>
                  </View>
                ))}
                <TouchableButton
                  onPress={() => {
                    setNegotiationRequestRates([
                      ...negotiationRequestRates,
                      { rate: "", paymentType: "HOURLY" },
                    ]);
                  }}
                  style={{
                    padding: 16,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.tint,
                    borderRadius: 12,
                    alignItems: "center",
                    marginBottom: 20,
                    backgroundColor: isDark
                      ? colors.tint + "08"
                      : colors.tint + "05",
                  }}
                >
                  <Text
                    style={{
                      color: colors.tint,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {t("applications.addAnotherRate")}
                  </Text>
                </TouchableButton>

                {/* Message (Mandatory) */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.explanation")} *
                </Text>
                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontSize: 13,
                      marginBottom: 8,
                    },
                  ]}
                >
                  {t("applications.provideNegotiationMessage")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#f1f5f9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#cbd5e1",
                      color: colors.text,
                      fontSize: 16,
                      lineHeight: 24,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      minHeight: 140,
                    },
                  ]}
                  placeholder={t("applications.explainRateRequest")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={negotiationRequestMessage}
                  onChangeText={setNegotiationRequestMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled
                />
              </ScrollView>

              <View
                style={[
                  styles.modalFooter,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: "transparent",
                      borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                    },
                  ]}
                  onPress={() => {
                    setShowNegotiationRequestModal(false);
                    setNegotiationRequestRates([
                      { rate: "", paymentType: "HOURLY" },
                    ]);
                    setNegotiationRequestMessage("");
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
                    {
                      backgroundColor: isDark ? "#6366f1" : colors.tint,
                      borderColor: isDark ? "#6366f1" : colors.tint,
                      shadowColor: isDark ? "#6366f1" : colors.tint,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                    requestingNegotiation && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRequestNegotiation}
                  disabled={requestingNegotiation}
                >
                  {requestingNegotiation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.requestNegotiation")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Negotiation Respond Modal */}
        <Modal
          visible={showNegotiationRespondModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowNegotiationRespondModal(false)}
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)",
              },
            ]}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("applications.respondToNegotiationRequest")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowNegotiationRespondModal(false);
                    setSelectedNegotiationId(null);
                    setSelectedNegotiationStatus(null);
                    setNegotiationResponseMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {selectedNegotiationStatus === "ACCEPTED"
                    ? t("applications.acceptingNegotiationDescription")
                    : t("applications.rejectingNegotiationDescription")}
                </Text>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.responseMessageOptional")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "#cbd5e1",
                      color: colors.text,
                    },
                  ]}
                  placeholder={t("applications.addMessageOptional")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={negotiationResponseMessage}
                  onChangeText={setNegotiationResponseMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled
                />
              </ScrollView>

              <View
                style={[
                  styles.modalFooter,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: "transparent",
                      borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                    },
                  ]}
                  onPress={() => {
                    setShowNegotiationRespondModal(false);
                    setSelectedNegotiationId(null);
                    setSelectedNegotiationStatus(null);
                    setNegotiationResponseMessage("");
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
                    {
                      backgroundColor:
                        selectedNegotiationStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                      borderColor:
                        selectedNegotiationStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                    },
                    respondingToNegotiation && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRespondToNegotiation}
                  disabled={respondingToNegotiation}
                >
                  {respondingToNegotiation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {selectedNegotiationStatus === "ACCEPTED"
                        ? t("common.accept")
                        : t("applications.reject")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Counter Offer Modal */}
        <Modal
          visible={showCounterOfferModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowCounterOfferModal(false);
            setCounterOfferRates([{ rate: "", paymentType: "HOUR" }]);
            setCounterOfferMessage("");
            setSelectedNegotiationId(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback
              onPress={() => {
                setShowCounterOfferModal(false);
                setCounterOfferRates([{ rate: "", paymentType: "HOUR" }]);
                setCounterOfferMessage("");
                setSelectedNegotiationId(null);
              }}
            >
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                  maxHeight: "85%",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("applications.proposeCounterOffer")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowCounterOfferModal(false);
                    setCounterOfferRates([{ rate: "", paymentType: "HOUR" }]);
                    setCounterOfferMessage("");
                    setSelectedNegotiationId(null);
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#cbd5e1" : "#4b5563" },
                  ]}
                >
                  {t("applications.proposeCounterOfferDescription")}
                </Text>

                {counterOfferRates.map((rate, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.rateInputCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.1)",
                      },
                    ]}
                  >
                    <View style={styles.rateInputRow}>
                      <View style={styles.rateInputContainer}>
                        <Text
                          style={[
                            styles.inputLabel,
                            { color: isDark ? "#cbd5e1" : "#4b5563" },
                          ]}
                        >
                          {t("applications.amount")} (€)
                        </Text>
                        <TextInput
                          style={[
                            styles.rateInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.05)",
                              color: colors.text,
                              borderColor: isDark
                                ? "rgba(255,255,255,0.2)"
                                : "rgba(0,0,0,0.1)",
                            },
                          ]}
                          placeholder={t("applications.amountPlaceholder")}
                          placeholderTextColor={
                            isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"
                          }
                          value={rate.rate}
                          onChangeText={(text) => {
                            const updated = [...counterOfferRates];
                            updated[idx] = { ...updated[idx], rate: text };
                            setCounterOfferRates(updated);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                      {counterOfferRates.length > 1 && (
                        <TouchableButton
                          onPress={() => {
                            const updated = counterOfferRates.filter(
                              (_, i) => i !== idx
                            );
                            if (updated.length === 0) {
                              updated.push({ rate: "", paymentType: "HOUR" });
                            }
                            setCounterOfferRates(updated);
                          }}
                          style={{
                            padding: 12,
                            backgroundColor: isDark
                              ? "rgba(239, 68, 68, 0.2)"
                              : "#fee2e2",
                            borderRadius: 8,
                            marginTop: 24,
                          }}
                        >
                          <Feather name="trash-2" size={18} color="#ef4444" />
                        </TouchableButton>
                      )}
                    </View>
                    <View
                      style={[styles.paymentTypeContainer, { marginTop: 12 }]}
                    >
                      <Text
                        style={[
                          styles.inputLabel,
                          { color: isDark ? "#cbd5e1" : "#4b5563" },
                        ]}
                      >
                        {t("applications.paymentType")}
                      </Text>
                      <View style={styles.paymentTypeButtons}>
                        {PAYMENT_TYPES.map((type) => (
                          <TouchableButton
                            key={type.value}
                            onPress={() => {
                              const updated = [...counterOfferRates];
                              updated[idx] = {
                                ...updated[idx],
                                paymentType: type.value,
                              };
                              setCounterOfferRates(updated);
                            }}
                            style={[
                              styles.paymentTypeButton,
                              {
                                backgroundColor:
                                  rate.paymentType === type.value
                                    ? isDark
                                      ? "#6366f1"
                                      : "#4f46e5"
                                    : isDark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.05)",
                                borderColor:
                                  rate.paymentType === type.value
                                    ? isDark
                                      ? "#6366f1"
                                      : "#4f46e5"
                                    : isDark
                                      ? "rgba(255,255,255,0.2)"
                                      : "rgba(0,0,0,0.1)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.paymentTypeButtonText,
                                {
                                  color:
                                    rate.paymentType === type.value
                                      ? "#fff"
                                      : colors.text,
                                },
                              ]}
                            >
                              {type.label}
                            </Text>
                          </TouchableButton>
                        ))}
                      </View>
                      {rate.paymentType === "OTHER" && (
                        <TextInput
                          style={[
                            styles.rateInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.05)",
                              color: colors.text,
                              borderColor: isDark
                                ? "rgba(255,255,255,0.2)"
                                : "rgba(0,0,0,0.1)",
                              marginTop: 8,
                            },
                          ]}
                          placeholder={t(
                            "applications.specifyPaymentTypePlaceholder"
                          )}
                          placeholderTextColor={
                            isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"
                          }
                          value={rate.otherSpecification || ""}
                          onChangeText={(text) => {
                            const updated = [...counterOfferRates];
                            updated[idx] = {
                              ...updated[idx],
                              otherSpecification: text,
                            };
                            setCounterOfferRates(updated);
                          }}
                        />
                      )}
                    </View>
                  </View>
                ))}
                <TouchableButton
                  onPress={() => {
                    setCounterOfferRates([
                      ...counterOfferRates,
                      { rate: "", paymentType: "HOUR" },
                    ]);
                  }}
                  style={[
                    styles.addRateButton,
                    {
                      borderColor: isDark ? "#6366f1" : "#4f46e5",
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.1)"
                        : "rgba(79, 70, 229, 0.05)",
                    },
                  ]}
                >
                  <Feather name="plus" size={18} color={colors.tint} />
                  <Text
                    style={[styles.addRateButtonText, { color: colors.tint }]}
                  >
                    {t("applications.addAnotherRate").replace("+ ", "")}
                  </Text>
                </TouchableButton>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.messageOptional")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "#cbd5e1",
                      color: colors.text,
                    },
                  ]}
                  placeholder={t("applications.explainCounterOffer")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={counterOfferMessage}
                  onChangeText={setCounterOfferMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled
                />
              </ScrollView>

              <View
                style={[
                  styles.modalFooter,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: "transparent",
                      borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                    },
                  ]}
                  onPress={() => {
                    setShowCounterOfferModal(false);
                    setCounterOfferRates([{ rate: "", paymentType: "HOUR" }]);
                    setCounterOfferMessage("");
                    setSelectedNegotiationId(null);
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
                    {
                      backgroundColor: isDark ? "#6366f1" : "#4f46e5",
                      borderColor: isDark ? "#6366f1" : "#4f46e5",
                    },
                    sendingCounterOffer && styles.modalButtonDisabled,
                  ]}
                  onPress={handleSendCounterOffer}
                  disabled={sendingCounterOffer}
                >
                  {sendingCounterOffer ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.sendCounterOffer")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Service Verification Code Modal */}
        <Modal
          visible={showVerificationModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowVerificationModal(false);
            setVerificationCode("");
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                setShowVerificationModal(false);
                setVerificationCode("");
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
            </TouchableWithoutFeedback>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.1)",
                  width: "100%",
                  maxWidth: 400,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {verificationFlow === "ADDITIONAL_SERVICES"
                    ? t("applications.enterNewVerificationCode")
                    : t("applications.enterVerificationCode")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowVerificationModal(false);
                    setVerificationCode("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <Text
                style={[
                  styles.description,
                  {
                    color: isDark ? "#cbd5e1" : "#64748b",
                    marginBottom: 20,
                    fontSize: 14,
                    lineHeight: 20,
                  },
                ]}
              >
                {verificationFlow === "ADDITIONAL_SERVICES"
                  ? t("applications.startAdditionalServicesDescription")
                  : t("applications.startServiceDescription")}
              </Text>

              <TextInput
                style={[
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#f1f5f9",
                    borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                    borderWidth: 2,
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 24,
                    fontWeight: "700",
                    letterSpacing: 8,
                    textAlign: "center",
                    color: colors.text,
                    marginBottom: 20,
                  },
                ]}
                placeholder={t("applications.verificationCodePlaceholder")}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={verificationCode}
                onChangeText={(text) => {
                  // Only allow digits and limit to 4 characters
                  const digitsOnly = text.replace(/[^0-9]/g, "").slice(0, 4);
                  setVerificationCode(digitsOnly);
                }}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />

              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <TouchableButton
                  style={[
                    {
                      flex: 1,
                      backgroundColor: "transparent",
                      borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    },
                  ]}
                  onPress={() => {
                    setShowVerificationModal(false);
                    setVerificationCode("");
                  }}
                >
                  <Text
                    style={[
                      {
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableButton>
                <TouchableButton
                  style={[
                    {
                      flex: 1,
                      backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    },
                    verifyingCode && { opacity: 0.6 },
                  ]}
                  onPress={async () => {
                    if (verificationCode.length !== 4) {
                      Alert.alert(
                        t("applications.invalidCode"),
                        t("applications.enter4DigitCode")
                      );
                      return;
                    }

                    try {
                      setVerifyingCode(true);
                      const token =
                        await SecureStore.getItemAsync("auth_token");
                      if (!token) {
                        Alert.alert(
                          t("common.error"),
                          t("auth.pleaseLogInAgain")
                        );
                        return;
                      }

                      const base = getApiBase();
                      const res = await fetch(
                        `${base}/applications/${applicationId}/verify-code`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ code: verificationCode }),
                        }
                      );

                      if (res.ok) {
                        const data = await res.json();
                        Alert.alert(
                          verificationFlow === "ADDITIONAL_SERVICES"
                            ? t("applications.additionalServicesStarted")
                            : t("applications.serviceStarted"),
                          verificationFlow === "ADDITIONAL_SERVICES"
                            ? t("applications.additionalServicesVerified")
                            : t("applications.serviceVerified"),
                          [
                            {
                              text: t("common.ok"),
                              onPress: () => {
                                setShowVerificationModal(false);
                                setVerificationCode("");
                                fetchApplication();
                              },
                            },
                          ]
                        );
                      } else {
                        const error = await res.json();
                        Alert.alert(
                          t("applications.verificationFailed"),
                          error.message ||
                            t("applications.invalidVerificationCode")
                        );
                      }
                    } catch (error) {
                      Alert.alert(
                        t("common.error"),
                        t("applications.failedToVerifyCode")
                      );
                    } finally {
                      setVerifyingCode(false);
                    }
                  }}
                  disabled={verifyingCode || verificationCode.length !== 4}
                >
                  {verifyingCode ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {t("applications.verifyCode")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Respond to Additional Time Request Modal */}
        <Modal
          visible={showAdditionalTimeResponseModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAdditionalTimeResponseModal(false);
            setSelectedAdditionalTimeRequestId(null);
            setAdditionalDays("");
            setAdditionalTimeExplanation("");
          }}
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)",
              },
            ]}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  borderRadius: 24,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 10,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("applications.respondToAdditionalTimeRequest")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowAdditionalTimeResponseModal(false);
                    setSelectedAdditionalTimeRequestId(null);
                    setAdditionalDays("");
                    setAdditionalTimeExplanation("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {t("applications.employerRequestsAdditionalTime")}
                </Text>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.additionalDaysNeededRequired")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#f1f5f9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#cbd5e1",
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: "500",
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      minHeight: 56,
                    },
                  ]}
                  placeholder={t("applications.enterNumberOfDays")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={additionalDays}
                  onChangeText={setAdditionalDays}
                  keyboardType="numeric"
                />

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.explanation")} *
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#f1f5f9",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#cbd5e1",
                      color: colors.text,
                      fontSize: 16,
                      lineHeight: 24,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      minHeight: 140,
                    },
                  ]}
                  placeholder={t(
                    "applications.explainAdditionalDaysPlaceholder"
                  )}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={additionalTimeExplanation}
                  onChangeText={setAdditionalTimeExplanation}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled
                />
              </ScrollView>

              <View
                style={[
                  styles.modalFooter,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#e2e8f0",
                  },
                ]}
              >
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: "transparent",
                      borderColor: isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1",
                    },
                  ]}
                  onPress={() => {
                    setShowAdditionalTimeResponseModal(false);
                    setSelectedAdditionalTimeRequestId(null);
                    setAdditionalDays("");
                    setAdditionalTimeExplanation("");
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
                    {
                      backgroundColor: isDark ? "#6366f1" : colors.tint,
                      borderColor: isDark ? "#6366f1" : colors.tint,
                      shadowColor: isDark ? "#6366f1" : colors.tint,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                    respondingToAdditionalTime && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRespondToAdditionalTimeRequest}
                  disabled={respondingToAdditionalTime}
                >
                  {respondingToAdditionalTime ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.sendResponse")}
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
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: "center",
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  location: {
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  appliedDate: {
    fontSize: 12,
  },
  coverLetterSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  coverLetterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  coverLetter: {
    fontSize: 14,
    lineHeight: 20,
  },
  paymentSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  rateItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  rateText: {
    fontSize: 15,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  noPaymentText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  requestCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  requestStatus: {
    fontSize: 14,
    fontWeight: "700",
  },
  requestStatusText: {},
  requestDate: {
    fontSize: 12,
  },
  requestRate: {
    fontSize: 14,
    marginBottom: 4,
  },
  requestTotal: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  requestMessage: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: "italic",
  },
  responseMessage: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
  },
  additionalRatesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  additionalRatesButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  rateInputCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  rateInputRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  rateInputContainer: {
    flex: 1,
  },
  paymentTypeContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  rateInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  paymentTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  paymentTypeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  paymentTypeText: {
    fontSize: 15,
  },
  paymentTypeButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  removeRateButton: {
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  otherSpecContainer: {
    marginTop: 12,
  },
  otherSpecInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  addRateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  addRateButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  messageSection: {
    marginBottom: 20,
  },
  messageInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 100,
    marginTop: 8,
  },
  totalPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    marginBottom: 20,
  },
  totalPreviewLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalPreviewAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalTextArea: {
    minHeight: 120,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonDisabled: {
    opacity: 0.6,
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextSubmit: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  paymentTypeModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 20,
    marginTop: "auto",
    backgroundColor: "transparent",
  },
  paymentTypeSelectorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  paymentTypeSelectorContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 20,
    marginTop: "auto",
  },
  otherSpecSelectorContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 20,
    marginTop: "auto",
  },
  paymentTypeModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  paymentTypeModalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  paymentTypeList: {
    padding: 20,
  },
  paymentTypeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  paymentTypeOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  otherSpecModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 20,
    marginTop: "auto",
    backgroundColor: "transparent",
  },
  otherSpecModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  otherSpecModalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  otherSpecInputModal: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 20,
  },
  otherSpecModalFooter: {
    flexDirection: "row",
    gap: 12,
  },
  otherSpecCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  otherSpecSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  otherSpecButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  otherSpecButtonTextSave: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  summaryCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryRow: {
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "500",
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryTotalAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
});
