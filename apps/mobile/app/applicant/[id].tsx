import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  Platform,
  Dimensions,
  Image,
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
import { Colors } from "@/constants/theme";
import GradientBackground from "../../components/GradientBackground";
import { TouchableButton } from "../../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import { useStripe } from "@stripe/stripe-react-native";

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  city?: string;
  country?: string;
  isIdVerified: boolean;
  isBackgroundVerified: boolean;
  idVerificationStatus: string;
  backgroundCheckStatus: string;
  profile?: {
    bio?: string;
    headline?: string;
    avatarUrl?: string;
    addressLine1?: string;
    city?: string;
    country?: string;
    skillsSummary?: string[];
  };
}

interface Application {
  id: string;
  status: string;
  appliedAt: string;
  completedAt?: string; // When the job was marked as complete
  serviceProviderMarkedDoneAt?: string; // When the service provider marked the job as done
  coverLetter?: string;
  proposedRate?: number;
  currency?: string;
  verificationCode?: string; // 4-digit code for employer to share with service provider
  verificationCodeVerifiedAt?: string; // When service provider verified the code
  verificationCodeVisible?: boolean;
  verificationCodeMessage?: string | null;
  verificationCodeVersion?: number;
  verificationCodeVerifiedVersion?: number | null;
  pendingVerificationCodeVersion?: number | null;
  pendingVerificationCodeLockMode?: "SOFT" | "HARD" | null;
  selectedRates?: Array<{
    rate: number;
    paymentType: string;
    otherSpecification?: string;
  }>;
  applicant: Applicant;
  job: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    city?: string;
    country?: string;
    rateAmount?: number;
    currency?: string;
    startDate?: string;
    company?: {
      id: string;
      name: string;
    };
  };
  paymentStatus?: {
    required: boolean;
    completed: boolean;
    paymentId?: string;
    paymentIntentId?: string;
    clientSecret?: string;
    paidAmount?: number; // Amount that was already paid
    unpaidAmount?: number;
    paidSelectedRates?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>; // Services that were already paid for
    paidServices?: Array<any>;
    unpaidServices?: Array<any>;
    paidNegotiationAmount?: number; // Amount paid from negotiation (if no services were selected initially)
    paidNegotiations?: Array<any>;
    unpaidNegotiations?: Array<any>;
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
    suggestedAt: string;
    respondedAt?: string;
    message: string;
    responseMessage?: string;
    counterOffer?: {
      id: string;
      rates: Array<{
        rate: number;
        paymentType: string;
        otherSpecification?: string;
      }>;
      totalAmount: number;
      message?: string;
      suggestedAt: string;
      status: "PENDING" | "ACCEPTED" | "REJECTED";
    };
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
}

export default function ApplicantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const applicationId = params.id as string;
  const instantJob = params.instantJob === "true";
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [candidateData, setCandidateData] = useState<{
    rates?: Array<{
      rate: number;
      paymentType: string;
      otherSpecification?: string;
    }>;
    rating?: number;
    ratingCount?: number;
    skills?: Array<{ name: string; yearsExp?: number }>;
  } | null>(null);
  const [selectedRates, setSelectedRates] = useState<Set<number>>(new Set());
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "ACCEPT" | "REJECT" | null
  >(null);
  const [actionMessage, setActionMessage] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [selectedRequestStatus, setSelectedRequestStatus] = useState<
    "APPROVED" | "REJECTED" | null
  >(null);
  const [respondMessage, setRespondMessage] = useState("");
  const [responding, setResponding] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negotiationRates, setNegotiationRates] = useState<
    Array<{
      rate: string;
      paymentType: string;
      otherSpecification?: string;
    }>
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [negotiationMessage, setNegotiationMessage] = useState("");
  const [suggestingNegotiation, setSuggestingNegotiation] = useState(false);
  const [respondingToCounterOffer, setRespondingToCounterOffer] =
    useState(false);
  const [selectedCounterOfferRequestId, setSelectedCounterOfferRequestId] =
    useState<string | null>(null);
  const [selectedCounterOfferId, setSelectedCounterOfferId] = useState<
    string | null
  >(null);
  const [counterOfferResponseStatus, setCounterOfferResponseStatus] = useState<
    "ACCEPTED" | "REJECTED" | null
  >(null);
  const [counterOfferResponseMessage, setCounterOfferResponseMessage] =
    useState("");
  const [completingJob, setCompletingJob] = useState(false);
  const hasNavigatedToRating = useRef<string | null>(null);

  // Employer: respond to service provider negotiation requests
  const [
    showEmployerNegotiationRespondModal,
    setShowEmployerNegotiationRespondModal,
  ] = useState(false);
  const [selectedEmployerNegotiationId, setSelectedEmployerNegotiationId] =
    useState<string | null>(null);
  const [
    selectedEmployerNegotiationStatus,
    setSelectedEmployerNegotiationStatus,
  ] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [
    employerNegotiationResponseMessage,
    setEmployerNegotiationResponseMessage,
  ] = useState("");
  const [respondingToEmployerNegotiation, setRespondingToEmployerNegotiation] =
    useState(false);

  // Employer: counter offer to service provider requests
  const [showEmployerCounterOfferModal, setShowEmployerCounterOfferModal] =
    useState(false);
  const [employerCounterOfferRates, setEmployerCounterOfferRates] = useState<
    Array<{ rate: string; paymentType: string; otherSpecification?: string }>
  >([{ rate: "", paymentType: "HOURLY" }]);
  const [employerCounterOfferMessage, setEmployerCounterOfferMessage] =
    useState("");
  const [sendingEmployerCounterOffer, setSendingEmployerCounterOffer] =
    useState(false);

  // Additional time request states
  const [showAdditionalTimeModal, setShowAdditionalTimeModal] = useState(false);
  const [additionalTimeMessage, setAdditionalTimeMessage] = useState("");
  const [requestingAdditionalTime, setRequestingAdditionalTime] =
    useState(false);
  const [showAdditionalTimeResponseModal, setShowAdditionalTimeResponseModal] =
    useState(false);
  const [selectedAdditionalTimeRequestId, setSelectedAdditionalTimeRequestId] =
    useState<string | null>(null);
  const [additionalTimeResponseStatus, setAdditionalTimeResponseStatus] =
    useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [additionalTimeResponseMessage, setAdditionalTimeResponseMessage] =
    useState("");
  const [respondingToAdditionalTime, setRespondingToAdditionalTime] =
    useState(false);

  const fetchApplication = useCallback(
    async (showLoading: boolean = true) => {
      try {
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
          console.log("[ApplicantDetail] Application data:", {
            id: data.id,
            hasPaymentStatus: !!data.paymentStatus,
            paymentStatus: data.paymentStatus,
            jobRateAmount: data.job?.rateAmount,
            completedAt: data.completedAt,
          });
          // Use functional update to preserve completedAt if it was manually set
          // Also preserve selectedRates from current state to avoid overwriting user's selection during polling
          setApplication((prev) => {
            // If we have a completedAt in current state but backend doesn't return it yet,
            // preserve the current state's completedAt
            // Also, if backend returns completedAt, use it (it's the source of truth)
            const updatedData = data.completedAt
              ? data
              : prev?.completedAt
                ? { ...data, completedAt: prev.completedAt }
                : data;

            // Preserve selectedRates from current state if user has made selections
            // This prevents polling from overwriting the user's current selection
            if (
              prev?.selectedRates &&
              Array.isArray(prev.selectedRates) &&
              prev.selectedRates.length > 0
            ) {
              return {
                ...updatedData,
                selectedRates: prev.selectedRates, // Preserve current selection
              };
            }

            return updatedData;
          });

          // Fetch candidate profile data for rates, rating, and skills
          if (data.applicant?.id) {
            try {
              const candidateRes = await fetch(
                `${base}/users/candidates/${data.applicant.id}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (candidateRes.ok) {
                const candidateProfile = await candidateRes.json();
                // Construct full avatar URL if it's a relative path
                let avatarUrl = candidateProfile.avatar;
                if (avatarUrl && !avatarUrl.startsWith("http")) {
                  avatarUrl = `${base}/${avatarUrl.startsWith("/") ? avatarUrl.slice(1) : avatarUrl}`;
                }
                // Update application data with full avatar URL
                if (avatarUrl) {
                  data.applicant.avatar = avatarUrl;
                  if (data.applicant.profile) {
                    data.applicant.profile.avatarUrl = avatarUrl;
                  }
                }
                setCandidateData({
                  rates: candidateProfile.rates,
                  rating: candidateProfile.rating,
                  ratingCount: candidateProfile.ratingCount,
                  skills: candidateProfile.skills,
                });
                setApplication(data); // Update with avatar URL

                // Initialize selectedRates from backend data only on initial load (showLoading=true)
                // During polling (showLoading=false), preserve user's current selection
                if (showLoading) {
                  setSelectedRates((prevSelected) => {
                    // If user has already made selections, don't overwrite unless backend has different data
                    if (prevSelected.size > 0) {
                      console.log(
                        "[ApplicantDetail] Preserving current selection, not overwriting from backend"
                      );
                      return prevSelected;
                    }

                    if (
                      data.selectedRates &&
                      Array.isArray(data.selectedRates) &&
                      data.selectedRates.length > 0 &&
                      candidateProfile.rates
                    ) {
                      const selectedIndices = new Set<number>();

                      // For each selected rate from backend, find its index in candidate rates
                      data.selectedRates.forEach(
                        (selectedRate: {
                          rate: number;
                          paymentType: string;
                          otherSpecification?: string;
                        }) => {
                          const index = candidateProfile.rates.findIndex(
                            (rate: {
                              rate: number;
                              paymentType: string;
                              otherSpecification?: string;
                            }) => {
                              return (
                                rate.rate === selectedRate.rate &&
                                rate.paymentType === selectedRate.paymentType &&
                                (rate.otherSpecification || "") ===
                                  (selectedRate.otherSpecification || "")
                              );
                            }
                          );

                          if (index !== -1) {
                            selectedIndices.add(index);
                          }
                        }
                      );

                      console.log(
                        "[ApplicantDetail] Initializing selectedRates from backend:",
                        {
                          selectedRatesFromBackend: data.selectedRates,
                          candidateRates: candidateProfile.rates,
                          selectedIndices: Array.from(selectedIndices),
                        }
                      );

                      return selectedIndices;
                    } else {
                      // No selected rates from backend, clear local state
                      return new Set();
                    }
                  });
                }
                // During polling (showLoading=false), don't update selectedRates to preserve user's current selection
              }
            } catch (err) {
              console.log(
                "[ApplicantDetail] Failed to fetch candidate profile:",
                err
              );
            }
          } else {
            // If no candidate data, still try to initialize selectedRates from application data
            // This handles the case where candidate data might not be available yet
            if (
              data.selectedRates &&
              Array.isArray(data.selectedRates) &&
              data.selectedRates.length > 0
            ) {
              console.log(
                "[ApplicantDetail] Application has selectedRates but candidate data not yet loaded"
              );
              // We'll initialize this when candidate data is loaded
            } else {
              setSelectedRates(new Set());
            }
          }
        } else {
          Alert.alert(
            t("common.error"),
            t("applications.failedToLoadDetails"),
            [{ text: t("common.ok"), onPress: () => router.back() }]
          );
        }
      } catch (error) {
        Alert.alert(t("common.error"), t("jobs.failedToConnect"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [applicationId, router]
  );

  useEffect(() => {
    if (applicationId) {
      fetchApplication(true); // Initial load with loading indicator
    }
  }, [applicationId, fetchApplication]);

  // Refresh when screen comes into focus to sync with service provider actions
  // Set up polling for real-time updates (every 4 seconds for better responsiveness)
  useFocusEffect(
    useCallback(() => {
      if (applicationId) {
        // Initial load with loading indicator
        fetchApplication(true);

        // Set up polling for real-time updates (every 4 seconds for better responsiveness)
        const interval = setInterval(() => {
          fetchApplication(false); // Silent refresh without loading indicator
        }, 4000); // 4 seconds - better balance between responsiveness and server load

        return () => {
          clearInterval(interval);
        };
      }
    }, [applicationId, fetchApplication])
  );

  // Reset navigation ref when applicationId changes
  useEffect(() => {
    hasNavigatedToRating.current = null;
  }, [applicationId]);

  // Check for rating status when application is completed
  useEffect(() => {
    // Skip if already navigated or conditions not met
    if (
      !applicationId ||
      !application?.completedAt ||
      hasNavigatedToRating.current === applicationId
    ) {
      return;
    }

    const checkRatingStatus = async () => {
      // Double-check ref before proceeding (in case multiple calls happen)
      if (hasNavigatedToRating.current === applicationId) {
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
          if (ratingStatus.needsRating && ratingStatus.isEmployer) {
            // Set ref immediately to prevent multiple navigations for this application
            hasNavigatedToRating.current = applicationId;

            // Navigate directly to rating page after a short delay to avoid interrupting the completion flow
            setTimeout(() => {
              router.push({
                pathname: "/rate-job-completion/employer",
                params: {
                  applicationId: applicationId,
                  serviceProviderName: application?.applicant?.firstName
                    ? `${application.applicant.firstName} ${application.applicant.lastName || ""}`.trim()
                    : t("auth.serviceProvider"),
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
  }, [application?.completedAt, applicationId, router, t]);

  const handleAction = async () => {
    if (!selectedAction || !application) return;

    // Check payment before proceeding with actions that require payment
    if (selectedAction === "ACCEPT") {
      const canProceed = await checkPaymentAndProceed(selectedAction);
      if (!canProceed) {
        return;
      }
    }

    try {
      setProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      let status: string;

      if (selectedAction === "ACCEPT") {
        status = "ACCEPTED";
      } else {
        status = "REJECTED";
      }

      const res = await fetch(`${base}/applications/${applicationId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          message: actionMessage.trim() || undefined,
        }),
      });

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          selectedAction === "ACCEPT"
            ? t("applications.applicationAcceptedMessage")
            : t("applications.applicationRejectedMessage"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setShowActionModal(false);
                setSelectedAction(null);
                setActionMessage("");
                fetchApplication();
              },
            },
          ]
        );
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("applications.failedToUpdateApplication")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setProcessing(false);
    }
  };

  const showPaymentRequiredAlert = (featureName: string) => {
    if (!application) return;

    const currentTotal = getSelectedRatesTotal();
    const paymentStatus = application.paymentStatus;
    const paidAmount = paymentStatus?.paidAmount ?? 0; // Amount already paid from database
    const paymentCompleted = paymentStatus?.completed ?? false;

    // Use unpaidAmount from paymentStatus which includes only NEW services/negotiations added after payment
    // This ensures we don't subtract paid amount from new additions
    const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;
    const additionalAmountNeeded =
      unpaidAmount > 0.01
        ? unpaidAmount
        : Math.max(0, currentTotal - paidAmount);

    if (currentTotal === 0) {
      Alert.alert(
        t("applications.noServicesSelected"),
        t("applications.selectAtLeastOneService"),
        [{ text: t("common.ok") }]
      );
      return;
    }

    // If payment is completed and current total <= paid amount, no payment needed
    if (paymentCompleted && additionalAmountNeeded === 0) {
      Alert.alert(
        t("applications.paymentComplete"),
        t("applications.paymentCompleteMessage", {
          amount: paidAmount.toFixed(2),
        }),
        [{ text: t("common.ok") }]
      );
      return;
    }

    // Show different message if additional payment is needed (when payment was completed but amount increased)
    if (paymentCompleted && additionalAmountNeeded > 0) {
      Alert.alert(
        t("applications.additionalPaymentRequired"),
        t("applications.additionalPaymentRequiredMessage", {
          paidAmount: paidAmount.toFixed(2),
          currentTotal: currentTotal.toFixed(2),
          additionalAmount: additionalAmountNeeded.toFixed(2),
          featureName,
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("applications.payAdditionalAmount"),
            onPress: () => {
              setShowPaymentModal(true);
            },
          },
        ]
      );
      return;
    }

    // First payment or payment not completed
    Alert.alert(
      t("applications.paymentRequired"),
      t("applications.paymentRequiredMessage", {
        featureName,
        amount: currentTotal.toFixed(2),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("applications.proceedToPayment"),
          onPress: () => {
            setShowPaymentModal(true);
          },
        },
      ]
    );
  };

  const saveSelectedRatesToBackend = async (newSelectedRates: Set<number>) => {
    if (!application || !candidateData?.rates) return;

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const selectedRatesData = Array.from(newSelectedRates)
        .map((idx) => {
          const rate = candidateData.rates![idx];
          return {
            rate: rate.rate,
            paymentType: rate.paymentType,
            otherSpecification: rate.otherSpecification || undefined,
          };
        })
        .filter((rate) => rate.rate !== undefined && rate.rate !== null);

      console.log("[ApplicantDetail] Saving selected rates to backend:", {
        applicationId: application.id,
        selectedIndices: Array.from(newSelectedRates),
        candidateRates: candidateData.rates,
        selectedRatesCount: selectedRatesData.length,
        selectedRates: selectedRatesData,
        totalAmount: selectedRatesData.reduce(
          (sum, r) => sum + (r.rate || 0),
          0
        ),
      });

      const base = getApiBase();
      const res = await fetch(
        `${base}/applications/${application.id}/selected-rates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedRates: selectedRatesData,
          }),
        }
      );

      if (res.ok) {
        const responseData = await res.json().catch(() => ({}));
        const savedRates =
          responseData?.application?.selectedRates || selectedRatesData;

        console.log("[ApplicantDetail] Successfully saved selected rates:", {
          selectedRatesCount: selectedRatesData.length,
          selectedRates: selectedRatesData,
          totalAmount: selectedRatesData.reduce(
            (sum, r) => sum + (r.rate || 0),
            0
          ),
          backendResponse: responseData,
          savedRatesFromBackend: savedRates,
          savedRatesCount: Array.isArray(savedRates) ? savedRates.length : 0,
        });

        // Verify all rates were saved
        if (
          Array.isArray(savedRates) &&
          savedRates.length !== selectedRatesData.length
        ) {
          console.warn(
            "[ApplicantDetail] WARNING: Backend saved different number of rates!",
            {
              sent: selectedRatesData.length,
              received: savedRates.length,
              sentRates: selectedRatesData,
              receivedRates: savedRates,
            }
          );
        }

        // Update application state to reflect the saved selected rates
        // This ensures both pages stay in sync
        // IMPORTANT: If selectedRatesData is empty, set selectedRates to empty array (not null)
        // This ensures the UI properly reflects that no services are selected
        setApplication((prev) => {
          if (!prev) return prev;
          const updatedSelectedRates = Array.isArray(savedRates)
            ? savedRates.length === 0
              ? [] // Explicitly set to empty array if backend returns empty
              : savedRates
            : selectedRatesData.length === 0
              ? [] // Explicitly set to empty array if we sent empty
              : selectedRatesData;

          console.log(
            "[ApplicantDetail] Updating application state with selectedRates:",
            {
              previousSelectedRatesCount: prev.selectedRates?.length || 0,
              newSelectedRatesCount: updatedSelectedRates.length,
              updatedSelectedRates,
              isEmpty: updatedSelectedRates.length === 0,
            }
          );

          return {
            ...prev,
            selectedRates: updatedSelectedRates,
          };
        });

        // Refresh payment status immediately after saving to get updated unpaid amounts
        // This ensures the UI updates instantly without requiring navigation
        const refreshPaymentStatus = async () => {
          try {
            const token = await SecureStore.getItemAsync("auth_token");
            if (!token) return;

            const base = getApiBase();
            // Use payment-status endpoint to get updated payment status
            const paymentRes = await fetch(
              `${base}/payments/applications/${applicationId}/payment-status`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (paymentRes.ok) {
              const paymentStatus = await paymentRes.json();
              // Update only the payment status in the application state, preserving selectedRates
              setApplication((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  paymentStatus: {
                    ...prev.paymentStatus,
                    ...paymentStatus,
                  },
                };
              });
            }
          } catch (error) {
            console.error(
              "[ApplicantDetail] Error refreshing payment status:",
              error
            );
            // Fallback: do a full refresh if payment status endpoint fails
            fetchApplication();
          }
        };

        // Refresh payment status immediately after saving
        await refreshPaymentStatus();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error(
          "[ApplicantDetail] Failed to save selected rates:",
          errorData
        );
        // Show error to user
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToSaveSelectedServices"),
          [{ text: t("common.ok") }]
        );
      }
    } catch (error) {
      console.error("[ApplicantDetail] Error saving selected rates:", error);
    }
  };

  const handleSuggestNegotiation = async () => {
    // Validate rates
    const validRates = negotiationRates.filter(
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

    // Validate message is not empty (mandatory)
    if (!negotiationMessage.trim()) {
      Alert.alert(
        t("common.error"),
        t("applications.provideNegotiationMessage")
      );
      return;
    }

    try {
      setSuggestingNegotiation(true);
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
        `${base}/applications/${applicationId}/negotiation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rates,
            totalAmount,
            message: negotiationMessage.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          t("applications.negotiationSuggestionSent")
        );
        setShowNegotiationModal(false);
        setNegotiationRates([{ rate: "", paymentType: "HOURLY" }]);
        setNegotiationMessage("");
        // Refresh application data
        await fetchApplication();
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToRequestNegotiation")
        );
      }
    } catch (error) {
      console.error("[ApplicantDetail] Error suggesting negotiation:", error);
      Alert.alert(
        t("common.error"),
        t("applications.failedToSendNegotiationSuggestion")
      );
    } finally {
      setSuggestingNegotiation(false);
    }
  };

  const handleRespondToAdditionalRates = async () => {
    if (!selectedRequestId || !selectedRequestStatus || !applicationId) return;

    try {
      setResponding(true);
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
        `${base}/applications/${applicationId}/additional-rates/respond`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedRequestId,
            status: selectedRequestStatus,
            message: respondMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          selectedRequestStatus === "APPROVED"
            ? t("applications.additionalRateRequestApproved")
            : t("applications.additionalRateRequestRejected"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setShowRespondModal(false);
                setSelectedRequestId(null);
                setSelectedRequestStatus(null);
                setRespondMessage("");
                fetchApplication(); // Refresh to show updated status
              },
            },
          ]
        );
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("applications.failedToRespondToRequest")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setResponding(false);
    }
  };

  const handleRespondToServiceProviderNegotiation = async () => {
    if (
      !selectedEmployerNegotiationId ||
      !selectedEmployerNegotiationStatus ||
      !applicationId
    ) {
      return;
    }

    try {
      setRespondingToEmployerNegotiation(true);
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
        `${base}/applications/${applicationId}/negotiation/respond-employer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedEmployerNegotiationId,
            status: selectedEmployerNegotiationStatus,
            message: employerNegotiationResponseMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          selectedEmployerNegotiationStatus === "ACCEPTED"
            ? t("applications.negotiationAcceptedSuccess")
            : t("applications.negotiationRejectedSuccess"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setShowEmployerNegotiationRespondModal(false);
                setSelectedEmployerNegotiationId(null);
                setSelectedEmployerNegotiationStatus(null);
                setEmployerNegotiationResponseMessage("");
                fetchApplication();
              },
            },
          ]
        );
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
      setRespondingToEmployerNegotiation(false);
    }
  };

  const handleSendEmployerCounterOffer = async () => {
    if (!selectedEmployerNegotiationId || !applicationId) return;

    // Validate rates
    const validRates = employerCounterOfferRates.filter(
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
      setSendingEmployerCounterOffer(true);
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
      // Note: This endpoint might need to be created for employers
      // For now, using the same endpoint structure
      const res = await fetch(
        `${base}/applications/${applicationId}/negotiation/counter-offer-employer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedEmployerNegotiationId,
            rates,
            totalAmount,
            message: employerCounterOfferMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("applications.counterOfferSent"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowEmployerCounterOfferModal(false);
              setEmployerCounterOfferRates([
                { rate: "", paymentType: "HOURLY" },
              ]);
              setEmployerCounterOfferMessage("");
              setSelectedEmployerNegotiationId(null);
              fetchApplication();
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
      setSendingEmployerCounterOffer(false);
    }
  };

  const handleRespondToCounterOffer = async () => {
    if (
      !selectedCounterOfferRequestId ||
      !selectedCounterOfferId ||
      !counterOfferResponseStatus ||
      !applicationId
    ) {
      return;
    }

    try {
      setRespondingToCounterOffer(true);
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
        `${base}/applications/${applicationId}/negotiation/counter-offer/respond`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedCounterOfferRequestId,
            counterOfferId: selectedCounterOfferId,
            status: counterOfferResponseStatus,
            message: counterOfferResponseMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          counterOfferResponseStatus === "ACCEPTED"
            ? t("applications.counterOfferAccepted")
            : t("applications.counterOfferRejected"),
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setSelectedCounterOfferRequestId(null);
                setSelectedCounterOfferId(null);
                setCounterOfferResponseStatus(null);
                setCounterOfferResponseMessage("");
                fetchApplication();
              },
            },
          ]
        );
      } else {
        const error = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          error.message || t("applications.failedToRejectCounterOffer")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRespondingToCounterOffer(false);
    }
  };

  const getSelectedRatesTotal = (): number => {
    // Calculate the FULL total from all currently selected/approved/accepted items.
    // Do not attempt to exclude "already paid" items here.
    // The additional amount needed is derived elsewhere from `paymentStatus.unpaidAmount`
    // (preferred) or `Math.max(0, total - paidAmount)`.
    let total = 0;

    if (candidateData?.rates && selectedRates.size > 0) {
      total = Array.from(selectedRates).reduce((sum, idx) => {
        const rate = candidateData.rates![idx];
        return sum + (rate.rate || 0);
      }, 0);
    }

    // Add approved additional rate requests
    if (
      application?.additionalRateRequests &&
      Array.isArray(application.additionalRateRequests)
    ) {
      const approvedRequests = application.additionalRateRequests.filter(
        (request: any) => request.status === "APPROVED"
      );
      const additionalTotal = approvedRequests.reduce(
        (sum: number, request: any) => sum + (request.totalAmount || 0),
        0
      );
      total += additionalTotal;
    }

    // Add accepted negotiation totals (including accepted counter offers)
    if (
      application?.negotiationRequests &&
      Array.isArray(application.negotiationRequests)
    ) {
      const acceptedNegotiations = application.negotiationRequests.filter(
        (request: any) => request.status === "ACCEPTED"
      );
      const negotiationTotal = acceptedNegotiations.reduce(
        (sum: number, request: any) => {
          // If there's an accepted counter offer, use its totalAmount instead
          const negotiationAmount =
            request.counterOffer && request.counterOffer.status === "ACCEPTED"
              ? request.counterOffer.totalAmount || 0
              : request.totalAmount || 0;

          return sum + negotiationAmount;
        },
        0
      );
      total += negotiationTotal;
    }

    return total;
  };

  const handleRequestAdditionalTime = async () => {
    if (!additionalTimeMessage.trim()) {
      Alert.alert(t("common.error"), t("applications.explainAdditionalTime"));
      return;
    }

    try {
      setRequestingAdditionalTime(true);
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
        `${base}/applications/${applicationId}/additional-time/request`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: additionalTimeMessage.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          t("applications.additionalTimeRequestSent")
        );
        setShowAdditionalTimeModal(false);
        setAdditionalTimeMessage("");
        await fetchApplication(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToRequestAdditionalTime")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRequestingAdditionalTime(false);
    }
  };

  const handleRespondToAdditionalTimeResponse = async () => {
    if (
      !selectedAdditionalTimeRequestId ||
      !additionalTimeResponseStatus ||
      !applicationId
    ) {
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
        `${base}/applications/${applicationId}/additional-time/respond-employer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedAdditionalTimeRequestId,
            status: additionalTimeResponseStatus,
            message: additionalTimeResponseMessage.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("common.success"),
          additionalTimeResponseStatus === "ACCEPTED"
            ? t("applications.additionalTimeRequestAccepted")
            : t("applications.additionalTimeRequestRejected")
        );
        setShowAdditionalTimeResponseModal(false);
        setSelectedAdditionalTimeRequestId(null);
        setAdditionalTimeResponseStatus(null);
        setAdditionalTimeResponseMessage("");
        await fetchApplication(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("applications.failedToRespondAdditionalTime")
        );
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("jobs.failedToConnect"));
    } finally {
      setRespondingToAdditionalTime(false);
    }
  };

  const handleMarkJobComplete = async () => {
    if (!application || !applicationId) {
      Alert.alert(t("common.error"), t("applications.applicationNotFound"));
      return;
    }

    // Prevent marking as complete if already completed
    if (application.completedAt) {
      Alert.alert(
        t("applications.alreadyCompleted"),
        t("applications.alreadyCompletedMessage")
      );
      return;
    }

    // Confirm action
    Alert.alert(
      t("applications.markJobAsComplete"),
      t("applications.markJobAsCompleteMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("applications.markComplete"),
          style: "default",
          onPress: async () => {
            try {
              setCompletingJob(true);
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
                `${base}/payments/applications/${applicationId}/complete`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (res.ok) {
                const data = await res.json();

                // Immediately update the application state with completedAt from response
                // Use the completedAt from backend response, or current timestamp as fallback
                const completedAtTimestamp =
                  data.completedAt || new Date().toISOString();
                setApplication((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    completedAt: completedAtTimestamp,
                  };
                });

                // Refresh from backend to ensure consistency
                await fetchApplication();

                const message =
                  data.message ||
                  t("applications.paymentTransferredMessage", {
                    amount:
                      data.serviceProviderAmount?.toFixed(2) ||
                      data.amount?.toFixed(2) ||
                      "0.00",
                    currency: data.currency || "EUR",
                  });
                Alert.alert(
                  t("applications.jobCompletedSuccessfully"),
                  message
                );

                // Note: Rating prompt will be shown by useEffect when application.completedAt is set
              } else {
                // Try to parse error message
                let errorMessage =
                  "Unable to complete the job at this time. Please try again later.";
                try {
                  const errorData = await res.json();
                  if (errorData.message) {
                    // Map technical errors to user-friendly messages
                    if (errorData.message.includes("not found")) {
                      errorMessage =
                        "The application could not be found. Please refresh and try again.";
                    } else if (
                      errorData.message.includes("authorized") ||
                      errorData.message.includes("permission")
                    ) {
                      errorMessage =
                        "You don't have permission to complete this job.";
                    } else if (errorData.message.includes("payment")) {
                      errorMessage = t(
                        "applications.paymentIssueContactSupport"
                      );
                    } else if (errorData.message.includes("capture")) {
                      errorMessage = t(
                        "applications.paymentNotProcessedContactSupport"
                      );
                    } else {
                      errorMessage = errorData.message;
                    }
                  }
                } catch {
                  // If JSON parsing fails, use default message
                  if (res.status === 404) {
                    errorMessage =
                      "The service is temporarily unavailable. Please try again later.";
                  } else if (res.status === 401 || res.status === 403) {
                    errorMessage =
                      "Your session has expired. Please log in again.";
                  } else if (res.status >= 500) {
                    errorMessage =
                      "Our servers are experiencing issues. Please try again in a few moments.";
                  }
                }

                Alert.alert(
                  t("applications.unableToCompleteJob"),
                  errorMessage,
                  [{ text: t("common.ok") }]
                );
              }
            } catch (error: any) {
              console.error("Error completing job:", error);

              // Handle network errors gracefully
              let errorMessage =
                "Unable to connect to the server. Please check your internet connection and try again.";

              if (error.message) {
                if (
                  error.message.includes("Network request failed") ||
                  error.message.includes("fetch")
                ) {
                  errorMessage =
                    "No internet connection. Please check your network and try again.";
                } else if (error.message.includes("timeout")) {
                  errorMessage = "The request took too long. Please try again.";
                }
              }

              Alert.alert(t("applications.connectionError"), errorMessage, [
                { text: t("common.ok") },
              ]);
            } finally {
              setCompletingJob(false);
            }
          },
        },
      ]
    );
  };

  const isPaymentRequired = (): boolean => {
    if (!application) {
      console.log("[ApplicantDetail] No application, payment not required");
      return true; // Lock by default if no application
    }

    // FIRST: Check if there are unpaid amounts from paymentStatus (negotiations or additional services added after payment)
    const paymentStatus = application.paymentStatus;
    const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;

    // If there are unpaid amounts (new negotiations or additional services), lock both buttons
    if (unpaidAmount > 0.01) {
      console.log(
        "[ApplicantDetail] Unpaid amount detected - locking buttons:",
        {
          unpaidAmount,
          applicationId: application.id,
        }
      );
      return true; // Lock both Accept and Reject buttons
    }

    // Check if there are any selected rates
    const hasSelectedRates = selectedRates.size > 0;

    // Check if there are any accepted negotiations
    const hasAcceptedNegotiations =
      application.negotiationRequests &&
      Array.isArray(application.negotiationRequests) &&
      application.negotiationRequests.some(
        (req: any) => req.status === "ACCEPTED"
      );

    // Check if there are any approved additional rates
    const hasApprovedAdditionalRates =
      application.additionalRateRequests &&
      Array.isArray(application.additionalRateRequests) &&
      application.additionalRateRequests.some(
        (req: any) => req.status === "APPROVED"
      );

    // Employer MUST have selected services OR have accepted negotiations OR approved additional rates
    const hasAnyServicesSelected =
      hasSelectedRates || hasAcceptedNegotiations || hasApprovedAdditionalRates;

    // If no services are selected and no negotiations/accepted rates, payment is required (LOCKED)
    if (!hasAnyServicesSelected) {
      console.log(
        "[ApplicantDetail] No services selected - payment required (locked)"
      );
      return true; // Lock the button - employer must select services or negotiate
    }

    // Calculate the current total amount needed (all selected services, negotiations, etc.)
    const currentTotal = getSelectedRatesTotal();
    const paymentCompleted = paymentStatus?.completed ?? false;
    const paidAmount = paymentStatus?.paidAmount ?? 0; // Amount already paid from database

    // Calculate additional amount needed: current total - amount already paid
    const additionalAmountNeeded = Math.max(0, currentTotal - paidAmount);

    // Payment is required ONLY if:
    // 1. Payment is not completed AND current total > 0, OR
    // 2. Payment is completed BUT current total > paid amount (additional amount needed)
    // If current total <= paid amount, no payment is needed
    const result =
      (!paymentCompleted && currentTotal > 0) ||
      (paymentCompleted && additionalAmountNeeded > 0);

    console.log("[ApplicantDetail] Payment check:", {
      applicationId: application.id,
      selectedRatesCount: selectedRates.size,
      currentTotal,
      paidAmount,
      unpaidAmount,
      hasSelectedRates,
      hasAcceptedNegotiations,
      hasApprovedAdditionalRates,
      hasAnyServicesSelected,
      paymentStatus,
      paymentCompleted,
      additionalAmountNeeded,
      isPaymentRequired: result,
      comparison: {
        currentTotal,
        paidAmount,
        difference: currentTotal - paidAmount,
        needsPayment: currentTotal > paidAmount,
      },
    });

    return result;
  };

  const checkPaymentAndProceed = async (action: "ACCEPT" | "REJECT") => {
    if (!application) return false;

    // REJECT doesn't require payment
    if (action === "REJECT") return true;

    // Check if payment is required
    if (isPaymentRequired()) {
      // Payment required but not completed
      const featureNames: Record<string, string> = {
        ACCEPT: t("applications.acceptThisApplication"),
      };
      showPaymentRequiredAlert(
        featureNames[action] || t("applications.performThisAction")
      );
      return false;
    }
    return true;
  };

  const handleCreatePayment = async () => {
    if (!application) {
      console.log("[ApplicantDetail] No application, cannot create payment");
      return;
    }

    try {
      setPaymentProcessing(true);

      // Calculate current total including approved additional rates and accepted negotiations
      const currentTotal = getSelectedRatesTotal();
      const paymentStatus = application.paymentStatus;
      const paidAmount = paymentStatus?.paidAmount ?? 0; // Amount already paid from database

      // Use unpaidAmount from paymentStatus which includes both unpaid services AND unpaid negotiations
      const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;

      // Calculate additional amount needed: use unpaidAmount if available (more accurate), otherwise calculate
      const additionalAmountNeeded =
        unpaidAmount > 0.01
          ? unpaidAmount
          : Math.max(0, currentTotal - paidAmount);

      // Check if there are any services selected OR approved additional rates OR accepted negotiations
      const hasSelectedServices = selectedRates.size > 0;
      const hasApprovedAdditionalRates =
        application.additionalRateRequests &&
        Array.isArray(application.additionalRateRequests) &&
        application.additionalRateRequests.some(
          (req: any) => req.status === "APPROVED"
        );
      const hasAcceptedNegotiations =
        application.negotiationRequests &&
        Array.isArray(application.negotiationRequests) &&
        application.negotiationRequests.some(
          (req: any) => req.status === "ACCEPTED"
        );

      // Allow payment if there's an additional amount needed
      if (additionalAmountNeeded === 0 && paidAmount > 0) {
        Alert.alert(
          t("applications.paymentComplete"),
          t("applications.allServicesPaid"),
          [{ text: t("common.ok") }]
        );
        return;
      }

      // Allow payment if there's a total amount (from selected services, approved rates, or accepted negotiations)
      if (
        currentTotal === 0 ||
        (!hasSelectedServices &&
          !hasApprovedAdditionalRates &&
          !hasAcceptedNegotiations)
      ) {
        Alert.alert(
          t("applications.noServicesSelected"),
          t("applications.selectServicesBeforePayment"),
          [{ text: t("common.ok") }]
        );
        return;
      }

      // Get selected rates data
      const selectedRatesData = candidateData?.rates
        ? Array.from(selectedRates).map((idx) => candidateData.rates![idx])
        : [];

      // Add approved additional rate requests to the selected rates array
      if (
        application.additionalRateRequests &&
        Array.isArray(application.additionalRateRequests)
      ) {
        const approvedRequests = application.additionalRateRequests.filter(
          (request: any) => request.status === "APPROVED"
        );
        approvedRequests.forEach((request: any) => {
          if (request.rates && Array.isArray(request.rates)) {
            // Add each rate from approved requests to the selected rates
            request.rates.forEach((rate: any) => {
              selectedRatesData.push(rate);
            });
          }
        });
      }

      // NOTE: Do NOT add accepted negotiation rates into `selectedRatesData`.
      // Negotiations are not services; they are accounted via `totalAmount` and server-side negotiation metadata.

      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired")
        );
        return;
      }

      const base = getApiBase();

      // Log payment details before sending
      // Note: We send the additional amount needed (unpaidAmount), which includes both unpaid services and unpaid negotiations
      console.log("[ApplicantDetail] Creating payment with:", {
        selectedRatesCount: selectedRatesData.length,
        selectedRates: selectedRatesData,
        currentTotal,
        paidAmount,
        additionalAmountNeeded,
        unpaidAmount,
        totalAmountInCents: Math.round(additionalAmountNeeded * 100),
        includesApprovedAdditionalRates: hasApprovedAdditionalRates,
      });

      // Step 1: Create payment intent with selected rates (including approved additional rates)
      // Send the additional amount needed (unpaidAmount) which includes both unpaid services and unpaid negotiations
      // Backend will use this to create the payment intent for the correct amount
      const res = await fetch(
        `${base}/payments/applications/${application.id}/payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedRates: selectedRatesData,
            totalAmount:
              additionalAmountNeeded > 0
                ? additionalAmountNeeded
                : currentTotal, // Send unpaid amount (includes negotiations), or current total if no unpaid amount
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: t("applications.failedToCreatePayment") }));
        const errorMessage =
          errorData.message || t("applications.failedToCreatePayment");

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
            ]
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
          t("applications.invalidPaymentResponse")
        );
        return;
      }

      // Step 2: Initialize payment sheet with payment intent
      const initParams: Parameters<typeof initPaymentSheet>[0] = {
        merchantDisplayName: "Cumprido",
        paymentIntentClientSecret: data.clientSecret,
        allowsDelayedPaymentMethods: true,
      };

      // If the backend provides Stripe customer + ephemeral key, PaymentSheet can show saved cards.
      if (data.customer && data.ephemeralKey) {
        (initParams as any).customerId = data.customer;
        (initParams as any).customerEphemeralKeySecret = data.ephemeralKey;
      }

      const { error: initError } = await initPaymentSheet(initParams);

      if (initError) {
        console.error("Payment sheet init error:", initError);
        Alert.alert(
          t("applications.paymentError"),
          initError.message || t("applications.failedToInitializePayment")
        );
        return;
      }

      // Step 3: Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert(
            t("applications.paymentError"),
            presentError.message || t("applications.paymentFailed")
          );
        }
        // User canceled, just return
        return;
      }

      // Step 4: Payment succeeded
      // Close modal immediately
      setShowPaymentModal(false);

      // Immediately check payment status (this will update database if payment is authorized)
      const checkPaymentStatus = async (): Promise<boolean> => {
        try {
          const token = await SecureStore.getItemAsync("auth_token");
          if (!token) return false;

          const base = getApiBase();
          const res = await fetch(
            `${base}/payments/applications/${application.id}/payment-status`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (res.ok) {
            const status = await res.json();
            console.log("[ApplicantDetail] Payment status check:", status);

            // Update application payment status with the latest data
            // Note: `/payment-status` returns `paymentCompleted`/`paymentRequired` (service contract),
            // while the application payload uses `completed`/`required`.
            setApplication((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                paymentStatus: {
                  ...prev.paymentStatus,
                  ...status,
                  required:
                    status.paymentRequired ?? prev.paymentStatus?.required,
                  completed:
                    status.paymentCompleted ?? prev.paymentStatus?.completed,
                  paidAmount:
                    status.paidAmount ?? prev.paymentStatus?.paidAmount,
                  unpaidAmount:
                    status.unpaidAmount ?? prev.paymentStatus?.unpaidAmount,
                  paidSelectedRates:
                    status.paidSelectedRates ??
                    prev.paymentStatus?.paidSelectedRates,
                  paidNegotiationAmount:
                    status.paidNegotiationAmount ??
                    prev.paymentStatus?.paidNegotiationAmount,
                },
              };
            });

            return status.paymentCompleted === true;
          }
        } catch (error) {
          console.error(
            "[ApplicantDetail] Error checking payment status:",
            error
          );
        }
        return false;
      };

      // Check immediately - this will trigger database update if payment is authorized
      const isCompleted = await checkPaymentStatus();

      // Refresh application to get updated payment status
      await fetchApplication();

      // If still not completed, poll a few more times (webhook might be delayed)
      if (!isCompleted) {
        let attempts = 0;
        const maxAttempts = 5;
        const pollInterval = 1000;

        const pollPaymentStatus = async () => {
          attempts++;
          console.log(
            `[ApplicantDetail] Polling payment status, attempt ${attempts}/${maxAttempts}`
          );

          const completed = await checkPaymentStatus();

          // Refresh after each check
          await fetchApplication();

          if (completed) {
            console.log("[ApplicantDetail] Payment confirmed as completed!");
            return;
          }

          if (attempts < maxAttempts) {
            setTimeout(pollPaymentStatus, pollInterval);
          } else {
            console.log("[ApplicantDetail] Payment polling completed");
          }
        };

        // Start polling after a short delay
        setTimeout(pollPaymentStatus, pollInterval);
      } else {
        console.log(
          "[ApplicantDetail] Payment immediately confirmed as completed!"
        );
      }

      Alert.alert(
        t("applications.paymentSuccessful"),
        t("applications.paymentProcessedMessage"),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              // Final refresh
              fetchApplication();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Payment error:", error);
      const errorMessage =
        error.message || t("applications.failedToProcessPayment");

      // Only show "payment method required" if the error explicitly mentions it
      const isPaymentMethodError =
        errorMessage.toLowerCase().includes("payment method required") ||
        errorMessage.toLowerCase().includes("add a payment method");

      if (isPaymentMethodError) {
        Alert.alert(
          t("applications.paymentSetupRequired"),
          t("applications.paymentSetupRequiredMessageShort"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("applications.goToSettings"),
              onPress: () => {
                setShowPaymentModal(false);
                router.push("/settings" as any);
              },
            },
          ]
        );
      } else {
        Alert.alert(t("applications.paymentError"), errorMessage);
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  const openActionModal = (action: "ACCEPT" | "REJECT") => {
    // Payment check is done in button onPress handlers
    setSelectedAction(action);
    setActionMessage("");
    setShowActionModal(true);
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t("applications.loadingApplicantDetails")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!application) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {t("applications.applicationNotFound")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const applicant = application.applicant;
  const fullName = `${applicant.firstName} ${applicant.lastName}`;
  const address =
    [
      applicant.profile?.addressLine1,
      applicant.profile?.city || applicant.city,
      applicant.profile?.country || applicant.country,
    ]
      .filter(Boolean)
      .join(", ") || t("profile.notSet");

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

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
            {instantJob
              ? t("jobs.instantJob")
              : t("applications.applicantDetails")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Applicant Profile Card */}
          <TouchableButton
            style={[
              styles.candidateCard,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.95)"
                  : "rgba(255,255,255,0.9)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => {
              if (applicant.id) {
                router.push(`/candidate/${applicant.id}` as any);
              }
            }}
          >
            <View style={styles.candidateHeader}>
              <View style={styles.candidateInfo}>
                <View style={styles.avatarContainer}>
                  {(() => {
                    const avatarUrl =
                      applicant.profile?.avatarUrl || applicant.avatar;
                    if (avatarUrl) {
                      // Construct full URL if it's a relative path
                      const base = getApiBase();
                      const fullUrl = avatarUrl.startsWith("http")
                        ? avatarUrl
                        : `${base}/${avatarUrl.startsWith("/") ? avatarUrl.slice(1) : avatarUrl}`;
                      return (
                        <Image
                          source={{ uri: fullUrl }}
                          style={styles.candidateAvatar}
                          resizeMode="cover"
                          onError={(event) => {
                            const nativeError = (event as any)?.nativeEvent
                              ?.error;
                            console.warn(
                              "[ApplicantDetail] Avatar failed to load:",
                              nativeError ?? null,
                              "url:",
                              fullUrl
                            );
                          }}
                        />
                      );
                    }
                    return (
                      <View
                        style={[
                          styles.candidateAvatar,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "#e2e8f0",
                            justifyContent: "center",
                            alignItems: "center",
                          },
                        ]}
                      >
                        <Feather
                          name="user"
                          size={24}
                          color={isDark ? "rgba(255,255,255,0.5)" : "#94a3b8"}
                        />
                      </View>
                    );
                  })()}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {fullName}
                  </Text>
                  {applicant.profile?.headline && (
                    <Text
                      style={[
                        styles.headline,
                        { color: isDark ? "#94a3b8" : "#64748b", marginTop: 4 },
                      ]}
                      numberOfLines={1}
                    >
                      {applicant.profile.headline}
                    </Text>
                  )}
                  {/* Rating - More Prominent */}
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={16} color="#eab308" />
                    <Text
                      style={[
                        styles.rating,
                        {
                          color:
                            candidateData?.rating && candidateData.rating > 0
                              ? isDark
                                ? "#fbbf24"
                                : "#ca8a04"
                              : isDark
                                ? "rgba(255,255,255,0.5)"
                                : "#94a3b8",
                          fontWeight: "600",
                          fontSize: 13,
                        },
                      ]}
                    >
                      {candidateData?.rating && candidateData.rating > 0
                        ? candidateData.rating.toFixed(1)
                        : t("applications.noRating")}
                      {candidateData?.ratingCount &&
                      candidateData.ratingCount > 0
                        ? ` (${candidateData.ratingCount})`
                        : ""}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bio */}
            {(applicant.bio || applicant.profile?.bio) && (
              <Text
                style={[styles.bio, { color: isDark ? "#94a3b8" : "#64748b" }]}
                numberOfLines={2}
              >
                {applicant.profile?.bio || applicant.bio}
              </Text>
            )}

            {/* Location */}
            <View style={styles.locationRow}>
              <Feather
                name="map-pin"
                size={12}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text
                style={[
                  styles.location,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {[
                  applicant.profile?.city || applicant.city,
                  applicant.profile?.country || applicant.country,
                ]
                  .filter(Boolean)
                  .join(", ") ||
                  applicant.location ||
                  t("applications.locationNotSpecified")}
              </Text>
            </View>

            {/* Skills with Years of Experience */}
            {(() => {
              const allSkills =
                candidateData?.skills && candidateData.skills.length > 0
                  ? candidateData.skills.map((s) => ({
                      name: s.name,
                      yearsExp: s.yearsExp || 0,
                    }))
                  : (applicant.profile?.skillsSummary || []).map((name) => ({
                      name,
                      yearsExp: 0,
                    }));
              const displaySkills = allSkills.slice(0, 3);
              const totalSkillsCount = allSkills.length;

              return (
                displaySkills.length > 0 && (
                  <View style={styles.skillsContainer}>
                    {displaySkills.map((skill, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.skillTag,
                          {
                            backgroundColor: isDark
                              ? "rgba(79, 70, 229, 0.2)"
                              : "rgba(99, 102, 241, 0.1)",
                            borderColor: isDark
                              ? "rgba(79, 70, 229, 0.3)"
                              : "rgba(99, 102, 241, 0.2)",
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
                          {skill.yearsExp > 0 &&
                            ` (${skill.yearsExp}yr${skill.yearsExp > 1 ? "s" : ""})`}
                        </Text>
                      </View>
                    ))}
                    {totalSkillsCount > 3 && (
                      <Text
                        style={[
                          styles.moreSkills,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        +{totalSkillsCount - 3} {t("applications.more")}
                      </Text>
                    )}
                  </View>
                )
              );
            })()}

            {/* Rates Section with Checkboxes */}
            {candidateData?.rates && candidateData.rates.length > 0 && (
              <View style={styles.ratesSection}>
                <Text
                  style={[
                    styles.ratesSectionTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.selectServices")}
                </Text>
                {candidateData.rates.map((rate, idx) => {
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
                  const isSelected = selectedRates.has(idx);

                  // Check if this service was already paid for
                  const paidSelectedRates =
                    application?.paymentStatus?.paidSelectedRates || [];
                  const isPaid = paidSelectedRates.some(
                    (paidRate: any) =>
                      paidRate.rate === rate.rate &&
                      paidRate.paymentType === rate.paymentType &&
                      (rate.otherSpecification
                        ? paidRate.otherSpecification ===
                          rate.otherSpecification
                        : !paidRate.otherSpecification)
                  );

                  // If paid, grey it out and disable interaction
                  const isDisabled = !!application?.completedAt || isPaid;

                  return (
                    <TouchableButton
                      key={idx}
                      style={[
                        styles.rateRow,
                        {
                          backgroundColor: isDark
                            ? isPaid
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(255,255,255,0.05)"
                            : isPaid
                              ? "rgba(0,0,0,0.01)"
                              : "rgba(0,0,0,0.02)",
                          borderColor: isPaid
                            ? isDark
                              ? "rgba(255,255,255,0.15)"
                              : "rgba(0,0,0,0.15)"
                            : isSelected
                              ? isDark
                                ? "#4ade80"
                                : "#22c55e"
                              : isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.1)",
                          borderWidth: 1,
                          opacity: isPaid ? 0.5 : 1,
                        },
                      ]}
                      onPress={async () => {
                        // Lock when completed or paid - prevent any changes
                        if (application?.completedAt) {
                          Alert.alert(
                            t("applications.jobCompleted"),
                            t("applications.cannotModifyServices")
                          );
                          return;
                        }
                        if (isPaid) {
                          Alert.alert(
                            t("applications.alreadyPaid"),
                            t("applications.serviceAlreadyPaid")
                          );
                          return;
                        }
                        const newSelected = new Set(selectedRates);
                        if (isSelected) {
                          newSelected.delete(idx);
                        } else {
                          newSelected.add(idx);
                        }

                        console.log("[ApplicantDetail] Toggling service:", {
                          index: idx,
                          rate: candidateData.rates![idx],
                          wasSelected: isSelected,
                          willBeSelected: !isSelected,
                          newSelectedCount: newSelected.size,
                          newSelectedIndices: Array.from(newSelected),
                        });

                        setSelectedRates(newSelected);

                        // Save selected rates to backend in real-time
                        await saveSelectedRatesToBackend(newSelected);
                      }}
                      disabled={isDisabled}
                    >
                      <View style={styles.checkboxContainer}>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: isPaid
                                ? isDark
                                  ? "rgba(156, 163, 175, 0.5)"
                                  : "rgba(156, 163, 175, 0.3)"
                                : isSelected
                                  ? isDark
                                    ? "#4ade80"
                                    : "#22c55e"
                                  : "transparent",
                              borderColor: isPaid
                                ? isDark
                                  ? "rgba(156, 163, 175, 0.5)"
                                  : "rgba(156, 163, 175, 0.5)"
                                : isSelected
                                  ? isDark
                                    ? "#4ade80"
                                    : "#22c55e"
                                  : isDark
                                    ? "rgba(255,255,255,0.3)"
                                    : "#94a3b8",
                              borderWidth: 2,
                            },
                          ]}
                        >
                          {isPaid ? (
                            <Feather
                              name="lock"
                              size={12}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                            />
                          ) : isSelected ? (
                            <Feather name="check" size={14} color="#fff" />
                          ) : null}
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.rateText,
                          {
                            color: isPaid
                              ? isDark
                                ? "#9ca3af"
                                : "#6b7280"
                              : colors.text,
                          },
                        ]}
                      >
                        €{rate.rate}/{paymentTypeLabel}
                        {isPaid && (
                          <Text
                            style={{
                              fontSize: 11,
                              fontStyle: "italic",
                              marginLeft: 4,
                            }}
                          >
                            ({t("applications.paid")})
                          </Text>
                        )}
                      </Text>
                    </TouchableButton>
                  );
                })}
              </View>
            )}

            {/* Selected Services Summary */}
            {(() => {
              const hasSelectedServices =
                selectedRates.size > 0 && candidateData?.rates;
              const approvedAdditionalRates =
                application?.additionalRateRequests &&
                Array.isArray(application.additionalRateRequests) &&
                application.additionalRateRequests.filter(
                  (req: any) => req.status === "APPROVED"
                );
              const hasApprovedAdditionalRates =
                approvedAdditionalRates && approvedAdditionalRates.length > 0;
              const acceptedNegotiations =
                application?.negotiationRequests &&
                Array.isArray(application.negotiationRequests) &&
                application.negotiationRequests.filter(
                  (req: any) => req.status === "ACCEPTED"
                );
              const hasAcceptedNegotiations =
                acceptedNegotiations && acceptedNegotiations.length > 0;
              const totalAmount = getSelectedRatesTotal();

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
                    styles.summaryCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(79, 70, 229, 0.2)"
                        : "rgba(99, 102, 241, 0.1)",
                      borderColor: isDark
                        ? "rgba(79, 70, 229, 0.4)"
                        : "rgba(99, 102, 241, 0.3)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryTitle,
                      { color: colors.text, marginBottom: 8 },
                    ]}
                  >
                    {t("applications.selectedServices")}
                  </Text>
                  {/* Selected services from candidate rates - show unpaid (yellow) */}
                  {hasSelectedServices &&
                    Array.from(selectedRates).map((idx) => {
                      const rate = candidateData.rates![idx];
                      const paymentTypeLabel =
                        rate.paymentType === "OTHER" && rate.otherSpecification
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

                      // Check if this service is unpaid
                      const paymentStatus = application?.paymentStatus;
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

                      const isUnpaid = unpaidServices.some((unpaid: any) =>
                        matchService(rate, unpaid)
                      );

                      // Color: yellow for unpaid, default for paid
                      const textColor = isUnpaid
                        ? isDark
                          ? "#fbbf24"
                          : "#d97706" // Yellow for unpaid
                        : isDark
                          ? "#cbd5e1"
                          : "#475569"; // Default for paid

                      return (
                        <View key={`selected-${idx}`} style={styles.summaryRow}>
                          <Text
                            style={[styles.summaryText, { color: textColor }]}
                          >
                            €{rate.rate}/{paymentTypeLabel}
                            {isUnpaid && ` (${t("applications.unpaid")})`}
                          </Text>
                        </View>
                      );
                    })}
                  {/* Approved additional rate requests - show unpaid (yellow) */}
                  {hasApprovedAdditionalRates &&
                    approvedAdditionalRates.map(
                      (request: any, reqIdx: number) => {
                        if (!request.rates || !Array.isArray(request.rates))
                          return null;

                        // Check if this service is unpaid (approved rates are treated as selected services)
                        const paymentStatus = application?.paymentStatus;
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

                        return request.rates.map(
                          (rate: any, rateIdx: number) => {
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

                            const isUnpaid = unpaidServices.some(
                              (unpaid: any) => matchService(rate, unpaid)
                            );

                            // Color: yellow for unpaid, default for paid
                            const textColor = isUnpaid
                              ? isDark
                                ? "#fbbf24"
                                : "#d97706" // Yellow for unpaid
                              : isDark
                                ? "#cbd5e1"
                                : "#475569"; // Default for paid

                            return (
                              <View
                                key={`approved-${reqIdx}-${rateIdx}`}
                                style={styles.summaryRow}
                              >
                                <Text
                                  style={[
                                    styles.summaryText,
                                    { color: textColor },
                                  ]}
                                >
                                  €{rate.rate}/{paymentTypeLabel} (
                                  {t("applications.approved")})
                                  {isUnpaid && ` (${t("applications.unpaid")})`}
                                </Text>
                              </View>
                            );
                          }
                        );
                      }
                    )}
                  {/* Accepted negotiation rates - show unpaid (yellow) */}
                  {hasAcceptedNegotiations &&
                    acceptedNegotiations.map((request: any, reqIdx: number) => {
                      // If there's an accepted counter offer, use its rates instead
                      const ratesToDisplay =
                        request.counterOffer &&
                        request.counterOffer.status === "ACCEPTED"
                          ? request.counterOffer.rates
                          : request.rates;

                      if (!ratesToDisplay || !Array.isArray(ratesToDisplay))
                        return null;

                      const isCounterOffer =
                        request.counterOffer &&
                        request.counterOffer.status === "ACCEPTED";

                      // Check if this negotiation is unpaid
                      const paymentStatus = application?.paymentStatus;
                      const unpaidNegotiations =
                        paymentStatus?.unpaidNegotiations || [];
                      const isUnpaid = unpaidNegotiations.some(
                        (unpaid: any) => unpaid.id === request.id
                      );

                      // Color: yellow for unpaid, default for paid
                      const textColor = isUnpaid
                        ? isDark
                          ? "#fbbf24"
                          : "#d97706" // Yellow for unpaid
                        : isDark
                          ? "#cbd5e1"
                          : "#475569"; // Default for paid

                      return ratesToDisplay.map(
                        (rate: any, rateIdx: number) => {
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
                            <View
                              key={`negotiation-${reqIdx}-${rateIdx}`}
                              style={styles.summaryRow}
                            >
                              <Text
                                style={[
                                  styles.summaryText,
                                  { color: textColor },
                                ]}
                              >
                                €{rate.rate}/{paymentTypeLabel} (
                                {isCounterOffer
                                  ? t("applications.counterOfferAcceptedTitle")
                                  : t("applications.negotiationAcceptedTitle")}
                                ){isUnpaid && ` (${t("applications.unpaid")})`}
                              </Text>
                            </View>
                          );
                        }
                      );
                    })}
                  {/* Show paid and unpaid amounts separately */}
                  {(() => {
                    const paymentStatus = application?.paymentStatus;
                    const paidAmount = paymentStatus?.paidAmount || 0;
                    const unpaidAmount = paymentStatus?.unpaidAmount || 0;

                    return (
                      <>
                        {paidAmount > 0 && (
                          <View
                            style={[
                              styles.summaryTotal,
                              {
                                borderTopColor: isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                                borderTopWidth: 1,
                                paddingTop: 8,
                                marginTop: 8,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.summaryTotalLabel,
                                { color: colors.text },
                              ]}
                            >
                              {t("applications.paidAmount")}:
                            </Text>
                            <Text
                              style={[
                                styles.summaryTotalAmount,
                                { color: "#22c55e" },
                              ]}
                            >
                              {application.currency?.toUpperCase() || "EUR"}{" "}
                              {paidAmount.toFixed(2)}
                            </Text>
                          </View>
                        )}
                        {unpaidAmount > 0 && (
                          <View
                            style={[
                              styles.summaryTotal,
                              {
                                borderTopWidth: paidAmount > 0 ? 0 : 1,
                                borderTopColor: isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                                paddingTop: paidAmount > 0 ? 0 : 8,
                                marginTop: paidAmount > 0 ? 4 : 8,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.summaryTotalLabel,
                                { color: colors.text },
                              ]}
                            >
                              {t("applications.unpaidAmount")}:
                            </Text>
                            <Text
                              style={[
                                styles.summaryTotalAmount,
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
                            styles.summaryTotal,
                            {
                              borderTopColor: isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.1)",
                              borderTopWidth:
                                paidAmount > 0 || unpaidAmount > 0 ? 1 : 0,
                              paddingTop:
                                paidAmount > 0 || unpaidAmount > 0 ? 8 : 0,
                              marginTop:
                                paidAmount > 0 || unpaidAmount > 0 ? 8 : 0,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.summaryTotalLabel,
                              { color: colors.text, fontWeight: "bold" },
                            ]}
                          >
                            {t("applications.totalAmount")}:
                          </Text>
                          <Text
                            style={[
                              styles.summaryTotalAmount,
                              { color: colors.tint, fontWeight: "bold" },
                            ]}
                          >
                            {application.currency?.toUpperCase() || "EUR"}{" "}
                            {totalAmount.toFixed(2)}
                          </Text>
                        </View>
                        {/* Additional Amount Needed - Calculated in this card */}
                        {(() => {
                          const paymentStatus = application?.paymentStatus;
                          const paidAmount = paymentStatus?.paidAmount ?? 0;
                          const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;

                          // This is the source of truth calculation
                          const additionalAmountNeeded =
                            unpaidAmount > 0.01
                              ? unpaidAmount
                              : Math.max(0, totalAmount - paidAmount);

                          if (additionalAmountNeeded > 0.01) {
                            return (
                              <View
                                style={[
                                  styles.summaryTotal,
                                  {
                                    borderTopColor: isDark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.1)",
                                    borderTopWidth: 1,
                                    paddingTop: 8,
                                    marginTop: 8,
                                  },
                                ]}
                              >
                                <View style={{ flexDirection: "column" }}>
                                  <Text
                                    style={[
                                      styles.paymentSummaryLabel,
                                      {
                                        color: isDark ? "#fbbf24" : "#d97706",
                                        fontSize: 16,
                                        fontWeight: "700",
                                      },
                                    ]}
                                  >
                                    {t("applications.paymentRequired")}:
                                  </Text>
                                  <Text
                                    style={[
                                      styles.paymentSummaryValue,
                                      {
                                        color: isDark ? "#fbbf24" : "#d97706",
                                        fontSize: 20,
                                        fontWeight: "700",
                                        marginTop: 6,
                                        width: "100%",
                                        textAlign: "right",
                                      },
                                    ]}
                                  >
                                    {application.currency?.toUpperCase() ||
                                      "EUR"}{" "}
                                    {additionalAmountNeeded.toFixed(2)}
                                  </Text>
                                </View>
                              </View>
                            );
                          }
                          return null;
                        })()}
                      </>
                    );
                  })()}

                  {/* Payment Action Button - Single Source of Truth for Payment */}
                  {(() => {
                    const paymentStatus = application?.paymentStatus;
                    const paidAmount = paymentStatus?.paidAmount ?? 0;
                    const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;
                    const paymentCompleted = paymentStatus?.completed ?? false;

                    // Calculate additional amount needed - this is the source of truth
                    const additionalAmountNeeded =
                      unpaidAmount > 0.01
                        ? unpaidAmount
                        : Math.max(0, totalAmount - paidAmount);

                    // Show pay button if there's an unpaid amount
                    if (additionalAmountNeeded > 0.01) {
                      return (
                        <View
                          style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTopWidth: 1,
                            borderTopColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                          }}
                        >
                          <TouchableButton
                            style={[
                              {
                                // In dark theme, `colors.tint` is white; keep CTA readable by using the primary tint.
                                backgroundColor: Colors.light.tint,
                                paddingVertical: 14,
                                paddingHorizontal: 20,
                                borderRadius: 8,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                              },
                            ]}
                            onPress={() => setShowPaymentModal(true)}
                          >
                            <Feather
                              name="credit-card"
                              size={18}
                              color="#fff"
                            />
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 16,
                                fontWeight: "600",
                              }}
                            >
                              {paymentCompleted
                                ? t("applications.payAdditional")
                                : t("applications.proceedToPayment")}
                            </Text>
                          </TouchableButton>
                        </View>
                      );
                    }

                    // Show success message ONLY if everything is truly paid
                    // Check: no unpaid amount, no unpaid services, no unpaid negotiations
                    const unpaidServices = paymentStatus?.unpaidServices || [];
                    const unpaidNegotiations =
                      paymentStatus?.unpaidNegotiations || [];
                    const hasUnpaidItems =
                      unpaidServices.length > 0 ||
                      unpaidNegotiations.length > 0;

                    // Only show "All services are paid" if:
                    // 1. There's a paid amount
                    // 2. No additional amount needed
                    // 3. No unpaid services
                    // 4. No unpaid negotiations
                    if (
                      paidAmount > 0 &&
                      additionalAmountNeeded <= 0.01 &&
                      !hasUnpaidItems
                    ) {
                      return (
                        <View
                          style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTopWidth: 1,
                            borderTopColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              padding: 12,
                              backgroundColor: isDark
                                ? "rgba(34, 197, 94, 0.1)"
                                : "rgba(34, 197, 94, 0.05)",
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(34, 197, 94, 0.3)"
                                : "rgba(34, 197, 94, 0.2)",
                            }}
                          >
                            <Feather
                              name="check-circle"
                              size={18}
                              color="#22c55e"
                            />
                            <Text
                              style={{
                                color: "#22c55e",
                                fontSize: 14,
                                fontWeight: "500",
                              }}
                            >
                              {t("applications.allServicesPaid")}
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return null;
                  })()}
                </View>
              );
            })()}

            {/* Card Footer */}
            <View
              style={[
                styles.cardFooter,
                {
                  borderTopColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Text style={[styles.cta, { color: colors.tint }]}>
                {t("applications.viewFullProfile")} →
              </Text>
            </View>
          </TouchableButton>

          {/* Suggest Negotiation Button */}
          {application && !application.completedAt && (
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
              onPress={() => setShowNegotiationModal(true)}
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
                <Text style={[styles.sectionTitle, { color: colors.tint }]}>
                  {t("applications.suggestNegotiation")}
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

          {/* Application Details */}
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("applications.applicationDetails")}
            </Text>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94a3b8" : "#6b7280" },
                ]}
              >
                {t("applications.jobTitle")}:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {application.job.title}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94a3b8" : "#6b7280" },
                ]}
              >
                {t("applications.applied")}:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {new Date(application.appliedAt).toLocaleDateString()} at{" "}
                {new Date(application.appliedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#94a3b8" : "#6b7280" },
                ]}
              >
                {t("applications.status")}:
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      application.status === "ACCEPTED"
                        ? "#22c55e20"
                        : application.status === "REJECTED"
                          ? "#ef444420"
                          : "#f59e0b20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        application.status === "ACCEPTED"
                          ? "#22c55e"
                          : application.status === "REJECTED"
                            ? "#ef4444"
                            : "#f59e0b",
                    },
                  ]}
                >
                  {application.status === "ACCEPTED"
                    ? t("applications.statusAccepted")
                    : application.status === "REJECTED"
                      ? t("applications.statusRejected")
                      : application.status === "PENDING"
                        ? t("applications.statusPending")
                        : application.status}
                </Text>
              </View>
            </View>

            {/* Service Verification Code - Show inside Application Details when ACCEPTED */}
            {application.status === "ACCEPTED" &&
              ((application.verificationCodeVisible ??
                !!application.verificationCode) ||
                !!application.verificationCodeMessage) && (
                <View
                  style={{
                    marginTop: 24,
                    paddingTop: 24,
                    borderTopWidth: 1,
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                      gap: 8,
                    }}
                  >
                    <Feather
                      name="key"
                      size={16}
                      color={isDark ? "#a78bfa" : "#6d28d9"}
                    />
                    <Text
                      style={[
                        styles.label,
                        {
                          color: isDark ? "#94a3b8" : "#6b7280",
                          marginBottom: 0,
                        },
                      ]}
                    >
                      {t("applications.serviceVerificationCode")}:
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.15)"
                        : "rgba(99, 102, 241, 0.08)",
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(99, 102, 241, 0.3)"
                        : "rgba(99, 102, 241, 0.2)",
                      borderRadius: 12,
                      padding: 20,
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    {application.verificationCodeMessage ? (
                      <View
                        style={{
                          width: "100%",
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
                        }}
                      >
                        <Text
                          style={{
                            color: isDark ? "#fbbf24" : "#d97706",
                            fontSize: 13,
                            lineHeight: 18,
                            textAlign: "left",
                          }}
                        >
                          ⚠️ {application.verificationCodeMessage}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: isDark ? "#c4b5fd" : "#4c1d95",
                          fontSize: 12,
                          textAlign: "center",
                          lineHeight: 18,
                          marginBottom: 16,
                        }}
                      >
                        {t("applications.shareCodeWithProvider")}
                      </Text>
                    )}
                    {application.verificationCode ? (
                      <View
                        style={{
                          backgroundColor: isDark ? "#1e1b4b" : "#ffffff",
                          paddingVertical: 16,
                          paddingHorizontal: 32,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isDark ? "#6366f1" : "#6366f1",
                          minWidth: 140,
                          alignItems: "center",
                          shadowColor: "#6366f1",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: isDark ? "#e0e7ff" : "#3730a3",
                            fontSize: 36,
                            fontWeight: "700",
                            letterSpacing: 8,
                            fontFamily: "monospace",
                          }}
                        >
                          {application.verificationCode}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: isDark ? "#1e1b4b" : "#ffffff",
                          paddingVertical: 16,
                          paddingHorizontal: 32,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isDark ? "#6366f1" : "#6366f1",
                          minWidth: 140,
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Feather
                            name="lock"
                            size={18}
                            color={isDark ? "#e0e7ff" : "#3730a3"}
                          />
                          <Text
                            style={{
                              color: isDark ? "#e0e7ff" : "#3730a3",
                              fontSize: 16,
                              fontWeight: "700",
                            }}
                          >
                            {t("applications.locked")}
                          </Text>
                        </View>
                      </View>
                    )}
                    {application.verificationCodeVerifiedAt && (
                      <Text
                        style={{
                          color: isDark ? "#a78bfa" : "#6d28d9",
                          fontSize: 11,
                          marginTop: 16,
                          fontStyle: "italic",
                        }}
                      >
                        {t("applications.verified")}:{" "}
                        {new Date(
                          application.verificationCodeVerifiedAt
                        ).toLocaleDateString()}{" "}
                        at{" "}
                        {new Date(
                          application.verificationCodeVerifiedAt
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </View>
                </View>
              )}

            {application.coverLetter && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("applications.coverLetter")}
                </Text>
                <Text
                  style={[
                    styles.coverLetterText,
                    { color: isDark ? "#cbd5e1" : "#4b5563" },
                  ]}
                >
                  {application.coverLetter}
                </Text>
              </View>
            )}
          </View>

          {/* Additional Rate Requests */}
          {application.additionalRateRequests &&
            Array.isArray(application.additionalRateRequests) &&
            application.additionalRateRequests.length > 0 && (
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
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.additionalRateRequests")}
                </Text>
                {(application.additionalRateRequests as any[]).map(
                  (request: any, idx: number) => {
                    const isPending = request.status === "PENDING";
                    return (
                      <View
                        key={request.id || idx}
                        style={[
                          styles.requestCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.02)",
                            borderColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                            marginBottom:
                              idx <
                              (application.additionalRateRequests as any[])
                                .length -
                                1
                                ? 12
                                : 0,
                          },
                        ]}
                      >
                        <View style={styles.requestHeader}>
                          <View
                            style={[
                              styles.requestStatusBadge,
                              {
                                backgroundColor:
                                  request.status === "APPROVED"
                                    ? "#22c55e20"
                                    : request.status === "REJECTED"
                                      ? "#ef444420"
                                      : "#f59e0b20",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.requestStatusText,
                                {
                                  color:
                                    request.status === "APPROVED"
                                      ? "#22c55e"
                                      : request.status === "REJECTED"
                                        ? "#ef4444"
                                        : "#f59e0b",
                                },
                              ]}
                            >
                              {request.status === "APPROVED"
                                ? `✓ ${t("applications.approved")}`
                                : request.status === "REJECTED"
                                  ? `✗ ${t("applications.statusRejected")}`
                                  : `⏳ ${t("applications.statusPending")}`}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.requestDate,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {request.rates &&
                          Array.isArray(request.rates) &&
                          request.rates.map((rate: any, rateIdx: number) => {
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
                                  { color: colors.text },
                                ]}
                              >
                                €{rate.rate}/{paymentTypeLabel}
                              </Text>
                            );
                          })}
                        <Text
                          style={[styles.requestTotal, { color: colors.text }]}
                        >
                          {t("applications.total")}: EUR{" "}
                          {request.totalAmount?.toFixed(2) || "0.00"}
                        </Text>
                        {request.message && (
                          <Text
                            style={[
                              styles.requestMessage,
                              { color: isDark ? "#cbd5e1" : "#475569" },
                            ]}
                          >
                            {request.message}
                          </Text>
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
                                padding: 10,
                                borderRadius: 8,
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
                        {isPending && !application?.completedAt && (
                          <View style={styles.requestActions}>
                            <TouchableButton
                              style={[
                                styles.respondButton,
                                styles.rejectButton,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(239, 68, 68, 0.2)"
                                    : "rgba(239, 68, 68, 0.1)",
                                  borderColor: isDark
                                    ? "rgba(239, 68, 68, 0.4)"
                                    : "rgba(239, 68, 68, 0.3)",
                                },
                              ]}
                              onPress={() => {
                                setSelectedRequestId(request.id);
                                setSelectedRequestStatus("REJECTED");
                                setRespondMessage("");
                                setShowRespondModal(true);
                              }}
                            >
                              <Text
                                style={[
                                  styles.respondButtonText,
                                  { color: "#ef4444" },
                                ]}
                              >
                                {t("applications.reject")}
                              </Text>
                            </TouchableButton>
                            <TouchableButton
                              style={[
                                styles.respondButton,
                                styles.approveButton,
                                {
                                  backgroundColor: isDark
                                    ? "#22c55e"
                                    : "#22c55e",
                                  borderColor: isDark ? "#22c55e" : "#22c55e",
                                },
                              ]}
                              onPress={() => {
                                setSelectedRequestId(request.id);
                                setSelectedRequestStatus("APPROVED");
                                setRespondMessage("");
                                setShowRespondModal(true);
                              }}
                            >
                              <Text
                                style={[
                                  styles.respondButtonText,
                                  { color: "#fff" },
                                ]}
                              >
                                {t("applications.approve")}
                              </Text>
                            </TouchableButton>
                          </View>
                        )}
                      </View>
                    );
                  }
                )}
              </View>
            )}

          {/* Negotiation Requests from Service Provider (Employer can respond) */}
          {application.negotiationRequests &&
            Array.isArray(application.negotiationRequests) &&
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
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.negotiationRequests")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 16 },
                  ]}
                >
                  {t("applications.providerRequestedRates")}
                </Text>
                {application.negotiationRequests
                  .filter((req: any) => req.suggestedByRole === "JOB_SEEKER")
                  .map((request: any, idx: number, arr: any[]) => {
                    const isAccepted = request.status === "ACCEPTED";
                    const isRejected = request.status === "REJECTED";
                    const hasCounterOffer =
                      request.status === "COUNTER_OFFERED" &&
                      request.counterOffer;
                    const isPending = request.status === "PENDING";
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
                                : hasCounterOffer
                                  ? "#6366f1"
                                  : isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            marginBottom: idx < arr.length - 1 ? 12 : 0,
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
                                    : hasCounterOffer
                                      ? "#6366f1"
                                      : "#f59e0b",
                              },
                            ]}
                          >
                            {isAccepted
                              ? `✓ ${t("applications.statusAccepted")}`
                              : isRejected
                                ? `✗ ${t("applications.statusRejected")}`
                                : hasCounterOffer
                                  ? `💬 ${t("applications.counterOfferSentTitle")}`
                                  : `⏳ ${t("applications.statusPending")}`}
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
                        {request.rates &&
                          Array.isArray(request.rates) &&
                          request.rates.map((rate: any, rateIdx: number) => {
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
                                  { color: colors.text },
                                ]}
                              >
                                €{rate.rate}/{paymentTypeLabel}
                              </Text>
                            );
                          })}
                        <Text
                          style={[styles.requestTotal, { color: colors.text }]}
                        >
                          {t("applications.total")}: EUR{" "}
                          {request.totalAmount?.toFixed(2) || "0.00"}
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
                              {t("applications.providerExplanation")}:
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
                              {t("applications.yourCounterOffer")}:
                            </Text>
                            {request.counterOffer.rates &&
                              Array.isArray(request.counterOffer.rates) &&
                              request.counterOffer.rates.map(
                                (rate: any, rateIdx: number) => {
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
                                                    : rate.paymentType.charAt(
                                                        0
                                                      ) +
                                                      rate.paymentType
                                                        .slice(1)
                                                        .toLowerCase();
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
                              {t("applications.total")}:{" "}
                              {application.currency?.toUpperCase() || "EUR"}{" "}
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
                              <Text
                                style={[
                                  styles.responseLabel,
                                  {
                                    color: "#f59e0b",
                                    marginTop: 8,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                ⏳{" "}
                                {t("applications.waitingForProviderResponse")}
                              </Text>
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
                        {isPending && (
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
                                  setSelectedEmployerNegotiationId(request.id);
                                  setSelectedEmployerNegotiationStatus(
                                    "ACCEPTED"
                                  );
                                  setEmployerNegotiationResponseMessage("");
                                  setShowEmployerNegotiationRespondModal(true);
                                }}
                              >
                                <Text
                                  style={{ color: "#fff", fontWeight: "600" }}
                                >
                                  {t("applications.accept")}
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
                                  setSelectedEmployerNegotiationId(request.id);
                                  setSelectedEmployerNegotiationStatus(
                                    "REJECTED"
                                  );
                                  setEmployerNegotiationResponseMessage("");
                                  setShowEmployerNegotiationRespondModal(true);
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
                                setSelectedEmployerNegotiationId(request.id);
                                setEmployerCounterOfferRates([
                                  { rate: "", paymentType: "HOURLY" },
                                ]);
                                setEmployerCounterOfferMessage("");
                                setShowEmployerCounterOfferModal(true);
                              }}
                            >
                              <Text
                                style={{ color: "#fff", fontWeight: "600" }}
                              >
                                {t("applications.requestDifferentRate")}
                              </Text>
                            </TouchableButton>
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}

          {/* Negotiation Suggestions from Employer (Read-only, show service provider response) */}
          {application.negotiationRequests &&
            Array.isArray(application.negotiationRequests) &&
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
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginBottom: 12 },
                  ]}
                >
                  {t("applications.negotiationSuggestions")}
                </Text>
                <Text
                  style={[
                    styles.paymentSubtitle,
                    { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 16 },
                  ]}
                >
                  {t("applications.yourNegotiationSuggestions")}
                </Text>
                {application.negotiationRequests
                  .filter((req: any) => req.suggestedByRole === "EMPLOYER")
                  .map((request: any, idx: number, arr: any[]) => {
                    const isAccepted = request.status === "ACCEPTED";
                    const isRejected = request.status === "REJECTED";
                    const hasCounterOffer =
                      request.status === "COUNTER_OFFERED" &&
                      request.counterOffer;
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
                                : hasCounterOffer
                                  ? "#6366f1"
                                  : isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            marginBottom: idx < arr.length - 1 ? 12 : 0,
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
                        {request.rates &&
                          Array.isArray(request.rates) &&
                          request.rates.map((rate: any, rateIdx: number) => {
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
                                style={[
                                  styles.requestRate,
                                  { color: colors.text },
                                ]}
                              >
                                €{rate.rate}/{paymentTypeLabel}
                              </Text>
                            );
                          })}
                        <Text
                          style={[styles.requestTotal, { color: colors.text }]}
                        >
                          {t("applications.total")}:{" "}
                          {application.currency?.toUpperCase() || "EUR"}{" "}
                          {request.totalAmount?.toFixed(2) || "0.00"}
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
                              Service Provider Response:
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
                              {t("applications.counterOffer")}:
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
                              {t("applications.total")}:{" "}
                              {application.currency?.toUpperCase() || "EUR"}{" "}
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
                                  onPress={() => {
                                    setSelectedCounterOfferRequestId(
                                      request.id
                                    );
                                    setSelectedCounterOfferId(
                                      request.counterOffer.id
                                    );
                                    setCounterOfferResponseStatus("ACCEPTED");
                                    setCounterOfferResponseMessage("");
                                    handleRespondToCounterOffer();
                                  }}
                                  disabled={respondingToCounterOffer}
                                >
                                  {respondingToCounterOffer ? (
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
                                  onPress={() => {
                                    setSelectedCounterOfferRequestId(
                                      request.id
                                    );
                                    setSelectedCounterOfferId(
                                      request.counterOffer.id
                                    );
                                    setCounterOfferResponseStatus("REJECTED");
                                    setCounterOfferResponseMessage("");
                                    handleRespondToCounterOffer();
                                  }}
                                  disabled={respondingToCounterOffer}
                                >
                                  {respondingToCounterOffer ? (
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
                                ✓ Counter Offer Accepted
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
                                ✗ Counter Offer Rejected
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
                    styles.sectionTitle,
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
                  {t("applications.additionalTimeRequestsDescription")}
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
                                  ? `⏳ ${t("applications.awaitingYourResponse")}`
                                  : `📤 ${t("applications.pendingServiceProviderResponse")}`}
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
                              {t("applications.yourRequest")}:
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
                              {t("applications.serviceProviderResponse")}:
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
                                onPress={() => {
                                  setSelectedAdditionalTimeRequestId(
                                    request.id
                                  );
                                  setAdditionalTimeResponseStatus("ACCEPTED");
                                  setShowAdditionalTimeResponseModal(true);
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontWeight: "600",
                                  }}
                                >
                                  {t("applications.accept")}
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
                                  setSelectedAdditionalTimeRequestId(
                                    request.id
                                  );
                                  setAdditionalTimeResponseStatus("REJECTED");
                                  setShowAdditionalTimeResponseModal(true);
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontWeight: "600",
                                  }}
                                >
                                  {t("applications.reject")}
                                </Text>
                              </TouchableButton>
                            </View>
                          </View>
                        )}

                        {isAccepted && (
                          <View style={{ marginTop: 12 }}>
                            {request.additionalDays && (
                              <View
                                style={[
                                  {
                                    backgroundColor: isDark
                                      ? "rgba(34, 197, 94, 0.1)"
                                      : "rgba(34, 197, 94, 0.05)",
                                    padding: 12,
                                    borderRadius: 8,
                                    borderLeftWidth: 3,
                                    borderLeftColor: "#22c55e",
                                    marginBottom:
                                      request.employerResponseMessage ? 12 : 0,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.responseLabel,
                                    { color: "#22c55e", fontWeight: "700" },
                                  ]}
                                >
                                  {t(
                                    "applications.serviceProviderResponseAccepted"
                                  )}
                                  :
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
                                  {t("applications.additionalDays")}:{" "}
                                  {request.additionalDays}{" "}
                                  {request.additionalDays !== 1
                                    ? t("common.days")
                                    : t("common.day")}
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
                            {request.employerResponseMessage && (
                              <View>
                                <Text
                                  style={[
                                    styles.responseLabel,
                                    { color: isDark ? "#cbd5e1" : "#475569" },
                                  ]}
                                >
                                  {t("applications.yourResponse")}:
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
                        )}

                        {isRejected && request.employerResponseMessage && (
                          <View style={{ marginTop: 12 }}>
                            <Text
                              style={[
                                styles.responseLabel,
                                { color: isDark ? "#cbd5e1" : "#475569" },
                              ]}
                            >
                              {t("applications.yourResponse")}:
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
                    styles.sectionTitle,
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
                  {t("applications.noAdditionalTimeRequestsYet")}
                </Text>
              </View>
            ))}

          {/* Service Provider Marked Job as Done Notification */}
          {application.status === "ACCEPTED" &&
            !application.completedAt &&
            application.serviceProviderMarkedDoneAt && (
              <View
                style={[
                  styles.paymentBanner,
                  {
                    backgroundColor: isDark
                      ? "rgba(34, 197, 94, 0.15)"
                      : "rgba(34, 197, 94, 0.1)",
                    borderColor: isDark ? "rgba(34, 197, 94, 0.5)" : "#22c55e",
                    marginBottom: 16,
                  },
                ]}
              >
                <Feather name="check-circle" size={20} color="#22c55e" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.paymentBannerTitle, { color: "#22c55e" }]}
                  >
                    {t("applications.serviceProviderMarkedJobAsDone")}
                  </Text>
                  <Text
                    style={[
                      styles.paymentBannerText,
                      {
                        color: isDark ? "#86efac" : "#065f46",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("applications.serviceProviderMarkedJobAsDoneMessage")}
                  </Text>
                  <Text
                    style={[
                      styles.paymentSubtitle,
                      {
                        color: isDark ? "#6ee7b7" : "#047857",
                        fontSize: 12,
                        marginTop: 4,
                      },
                    ]}
                  >
                    {t("applications.markedAsDoneOn")}:{" "}
                    {new Date(
                      application.serviceProviderMarkedDoneAt
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

          {/* Auto-Completion Warning Banner with Timer */}
          {application.status === "ACCEPTED" &&
            !application.completedAt &&
            application.verificationCodeVerifiedAt &&
            (() => {
              // Use verificationCodeVerifiedAt (when service started) instead of startDate
              const serviceStartDate = new Date(
                application.verificationCodeVerifiedAt
              );

              // Calculate total additional days from all ACCEPTED requests
              // Only count requests where employer accepted the service provider's response
              // The request must have additionalDays (set when service provider responded)
              const allRequests = application.additionalTimeRequests || [];
              const acceptedRequests = allRequests.filter((req: any) => {
                // Request must be accepted AND have additionalDays (meaning service provider responded)
                const hasAdditionalDays =
                  req.additionalDays !== undefined &&
                  req.additionalDays !== null;
                const daysValue = Number(req.additionalDays) || 0;
                return (
                  req.status === "ACCEPTED" &&
                  hasAdditionalDays &&
                  daysValue > 0
                );
              });

              const totalAdditionalDays = acceptedRequests.reduce(
                (sum: number, req: any) => {
                  const days = Number(req.additionalDays) || 0;
                  return sum + days;
                },
                0
              );

              // Debug: Log for troubleshooting (can be removed later)
              if (allRequests.length > 0) {
                console.log(
                  "[Timer Debug] All requests:",
                  JSON.stringify(allRequests, null, 2)
                );
                console.log(
                  "[Timer Debug] Accepted requests with days:",
                  acceptedRequests
                );
                console.log(
                  "[Timer Debug] Total additional days:",
                  totalAdditionalDays
                );
              }

              // Base deadline is 4 days from service start, plus any accepted additional days
              const autoCompleteDate = new Date(serviceStartDate);
              autoCompleteDate.setDate(
                autoCompleteDate.getDate() + 4 + totalAdditionalDays
              );

              const now = new Date();
              const timeDiff = autoCompleteDate.getTime() - now.getTime();
              const daysUntilAutoComplete = Math.ceil(
                timeDiff / (1000 * 60 * 60 * 24)
              );
              const hoursUntilAutoComplete = Math.ceil(
                timeDiff / (1000 * 60 * 60)
              );
              const minutesUntilAutoComplete = Math.ceil(
                timeDiff / (1000 * 60)
              );

              // Determine color based on remaining time
              // Red: 12 hours or less
              // Yellow: More than 12 hours but 2 days or less
              // Green: More than 2 days
              const hoursRemaining = timeDiff / (1000 * 60 * 60);
              const isRed = hoursRemaining <= 12;
              const isYellow = hoursRemaining > 12 && hoursRemaining <= 48; // 2 days = 48 hours
              const isGreen = hoursRemaining > 48;

              const timerColor = isRed
                ? "#ef4444" // Red
                : isYellow
                  ? "#f59e0b" // Yellow/Orange
                  : "#22c55e"; // Green

              const timerBgColor = isRed
                ? isDark
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(239, 68, 68, 0.1)"
                : isYellow
                  ? isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(245, 158, 11, 0.1)"
                  : isDark
                    ? "rgba(34, 197, 94, 0.15)"
                    : "rgba(34, 197, 94, 0.1)";

              const timerBorderColor = isRed
                ? isDark
                  ? "rgba(239, 68, 68, 0.5)"
                  : "#ef4444"
                : isYellow
                  ? isDark
                    ? "rgba(245, 158, 11, 0.5)"
                    : "#f59e0b"
                  : isDark
                    ? "rgba(34, 197, 94, 0.5)"
                    : "#22c55e";

              const timerTextColor = isRed
                ? isDark
                  ? "#fca5a5"
                  : "#991b1b"
                : isYellow
                  ? isDark
                    ? "#fcd34d"
                    : "#92400e"
                  : isDark
                    ? "#86efac"
                    : "#065f46";

              // Check if there's a pending additional time request
              const hasPendingRequest =
                application.additionalTimeRequests?.some(
                  (req) =>
                    req.status === "PENDING" ||
                    req.status === "PENDING_EMPLOYER_APPROVAL"
                );

              // Always show timer if service has started
              return (
                <View
                  style={[
                    styles.paymentBanner,
                    {
                      backgroundColor: timerBgColor,
                      borderColor: timerBorderColor,
                      marginBottom: 16,
                    },
                  ]}
                >
                  <Feather
                    name={
                      isRed
                        ? "alert-triangle"
                        : isYellow
                          ? "alert-circle"
                          : "clock"
                    }
                    size={20}
                    color={timerColor}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[styles.paymentBannerTitle, { color: timerColor }]}
                    >
                      {t("applications.autoCompletionTimer")}
                    </Text>
                    <Text
                      style={[
                        styles.paymentBannerText,
                        { color: timerTextColor, marginBottom: 8 },
                      ]}
                    >
                      {daysUntilAutoComplete < 0
                        ? t("applications.autoCompletionDeadlinePassed", {
                            days: Math.abs(daysUntilAutoComplete),
                          })
                        : daysUntilAutoComplete === 0
                          ? t("applications.autoCompletionToday")
                          : daysUntilAutoComplete === 1
                            ? t("applications.timeRemainingHours", {
                                hours: hoursUntilAutoComplete,
                              })
                            : t("applications.timeRemainingDaysHours", {
                                days: daysUntilAutoComplete,
                                hours: Math.floor(
                                  (timeDiff % (1000 * 60 * 60 * 24)) /
                                    (1000 * 60 * 60)
                                ),
                              })}
                    </Text>
                    {!hasPendingRequest && (
                      <TouchableOpacity
                        onPress={() => setShowAdditionalTimeModal(true)}
                        activeOpacity={0.7}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 6,
                          backgroundColor: timerColor,
                          alignSelf: "flex-start",
                          marginTop: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {t("applications.requestAdditionalTime")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}

          {/* Job Completed Banner */}
          {application.completedAt && (
            <View
              style={[
                styles.completedBanner,
                {
                  backgroundColor: isDark ? "#065f46" : "#d1fae5",
                  borderColor: isDark ? "#10b981" : "#34d399",
                },
              ]}
            >
              <Feather name="check-circle" size={24} color="#10b981" />
              <View style={styles.completedBannerContent}>
                <Text
                  style={[
                    styles.completedBannerTitle,
                    { color: isDark ? "#6ee7b7" : "#065f46" },
                  ]}
                >
                  {t("applications.jobCompleted")}
                </Text>
                <Text
                  style={[
                    styles.completedBannerText,
                    { color: isDark ? "#a7f3d0" : "#047857" },
                  ]}
                >
                  {t("applications.jobCompletedAllActionsLocked")}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {!application.completedAt && (
            <View style={styles.actionsContainer}>
              {(() => {
                const paymentRequired = isPaymentRequired();
                console.log(
                  "[ApplicantDetail] Rendering buttons, paymentRequired:",
                  paymentRequired,
                  "completedAt:",
                  application?.completedAt
                );
                return (
                  <>
                    {application.status === "ACCEPTED" &&
                      !isPaymentRequired() &&
                      !application.completedAt && (
                        <TouchableButton
                          style={[
                            styles.actionButton,
                            {
                              backgroundColor: "#22c55e",
                              borderColor: "#22c55e",
                            },
                          ]}
                          onPress={handleMarkJobComplete}
                          disabled={completingJob}
                        >
                          {completingJob ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <Feather
                                name="check-circle"
                                size={20}
                                color="#fff"
                              />
                              <Text style={styles.actionButtonText}>
                                {t("applications.markJobAsComplete")}
                              </Text>
                            </>
                          )}
                        </TouchableButton>
                      )}
                    {application.status !== "ACCEPTED" &&
                      application.status !== "REJECTED" && (
                        <>
                          <TouchableButton
                            style={[
                              styles.actionButton,
                              styles.acceptButton,
                              {
                                backgroundColor: paymentRequired
                                  ? "#64748b"
                                  : "#22c55e",
                                borderColor: paymentRequired
                                  ? "#94a3b8"
                                  : "#22c55e",
                                opacity: paymentRequired ? 0.6 : 1,
                              },
                            ]}
                            onPress={() => {
                              if (paymentRequired) {
                                // Check if no services are selected
                                const hasSelectedRates = selectedRates.size > 0;
                                const hasAcceptedNegotiations =
                                  application.negotiationRequests &&
                                  Array.isArray(
                                    application.negotiationRequests
                                  ) &&
                                  application.negotiationRequests.some(
                                    (req: any) => req.status === "ACCEPTED"
                                  );
                                const hasApprovedAdditionalRates =
                                  application.additionalRateRequests &&
                                  Array.isArray(
                                    application.additionalRateRequests
                                  ) &&
                                  application.additionalRateRequests.some(
                                    (req: any) => req.status === "APPROVED"
                                  );

                                if (
                                  !hasSelectedRates &&
                                  !hasAcceptedNegotiations &&
                                  !hasApprovedAdditionalRates
                                ) {
                                  Alert.alert(
                                    t("applications.servicesRequired"),
                                    t("applications.selectServiceOrNegotiate"),
                                    [{ text: t("common.ok") }]
                                  );
                                } else {
                                  showPaymentRequiredAlert(
                                    "accept this application"
                                  );
                                }
                              } else {
                                openActionModal("ACCEPT");
                              }
                            }}
                            disabled={paymentRequired}
                          >
                            <Feather
                              name="check-circle"
                              size={20}
                              color="#fff"
                            />
                            <Text style={styles.actionButtonText}>
                              {t("applications.acceptApplication")}
                            </Text>
                          </TouchableButton>

                          <TouchableButton
                            style={[
                              styles.actionButton,
                              styles.rejectButton,
                              {
                                backgroundColor: "#ef4444",
                                borderColor: "#ef4444",
                                opacity: 1,
                              },
                            ]}
                            onPress={() => {
                              // Allow rejection at any time, even before payment
                              openActionModal("REJECT");
                            }}
                            disabled={false}
                          >
                            <Feather name="x-circle" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>
                              {t("applications.rejectApplication")}
                            </Text>
                          </TouchableButton>
                        </>
                      )}
                  </>
                );
              })()}
            </View>
          )}
        </ScrollView>

        {/* Action Modal */}
        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowActionModal(false);
            setSelectedAction(null);
            setActionMessage("");
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                  height: undefined,
                  maxHeight: Dimensions.get("window").height * 0.75,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedAction === "ACCEPT"
                    ? t("applications.acceptApplication")
                    : t("applications.rejectApplication")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowActionModal(false);
                    setSelectedAction(null);
                    setActionMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView contentContainerStyle={styles.modalBodyContent}>
                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color: isDark ? "#9ca3af" : "#6b7280",
                      marginBottom: selectedAction === "ACCEPT" ? 16 : 20,
                    },
                  ]}
                >
                  {selectedAction === "ACCEPT"
                    ? t("applications.acceptApplicationDescription")
                    : t("applications.rejectApplicationDescription")}
                </Text>

                {/* Warning Box for Accept Action */}
                {selectedAction === "ACCEPT" && (
                  <View
                    style={[
                      styles.warningBox,
                      {
                        backgroundColor: isDark
                          ? "rgba(251, 191, 36, 0.15)"
                          : "rgba(251, 191, 36, 0.1)",
                        borderColor: isDark
                          ? "rgba(251, 191, 36, 0.3)"
                          : "rgba(251, 191, 36, 0.4)",
                        marginBottom: 20,
                      },
                    ]}
                  >
                    <View style={styles.warningHeader}>
                      <Feather
                        name="alert-triangle"
                        size={20}
                        color={isDark ? "#fbbf24" : "#ca8a04"}
                      />
                      <Text
                        style={[
                          styles.warningTitle,
                          { color: isDark ? "#fbbf24" : "#ca8a04" },
                        ]}
                      >
                        {t("applications.importantNotice")}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.warningText,
                        { color: isDark ? "#eab308" : "#854d0e" },
                      ]}
                    >
                      {t("applications.markJobCompleteWarning")}
                    </Text>
                  </View>
                )}

                {/* Optional Message */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 0 },
                  ]}
                >
                  {t("applications.optionalMessage")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.6)"
                        : "#f1f5f9",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#e2e8f0",
                    },
                  ]}
                  placeholder={
                    selectedAction === "ACCEPT"
                      ? t("applications.acceptPlaceholder")
                      : t("applications.rejectPlaceholder")
                  }
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  multiline
                  numberOfLines={5}
                  value={actionMessage}
                  onChangeText={setActionMessage}
                  textAlignVertical="top"
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
                    styles.modalCancelButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(241, 245, 249, 0.9)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => {
                    setShowActionModal(false);
                    setSelectedAction(null);
                    setActionMessage("");
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
                        selectedAction === "ACCEPT" ? "#22c55e" : "#ef4444",
                      borderColor:
                        selectedAction === "ACCEPT" ? "#22c55e" : "#ef4444",
                    },
                    processing && styles.modalButtonDisabled,
                  ]}
                  onPress={handleAction}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {selectedAction === "ACCEPT"
                        ? t("common.accept")
                        : t("applications.reject")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

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
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
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

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
              >
                <Text
                  style={[
                    styles.modalDescription,
                    {
                      color: isDark ? "#cbd5e1" : "#4b5563",
                      marginBottom: 24,
                      fontSize: 15,
                      lineHeight: 22,
                    },
                  ]}
                >
                  {t("applications.reviewSelectedServicesAndCompletePayment")}
                </Text>

                {(() => {
                  const currentTotal = getSelectedRatesTotal();
                  const paymentStatus = application.paymentStatus;
                  const paidAmount = paymentStatus?.paidAmount ?? 0;
                  const paymentCompleted = paymentStatus?.completed ?? false;

                  // Use unpaidAmount from paymentStatus which includes both unpaid services AND unpaid negotiations
                  const unpaidAmount = paymentStatus?.unpaidAmount ?? 0;
                  const unpaidServices = paymentStatus?.unpaidServices || [];
                  const unpaidNegotiations =
                    paymentStatus?.unpaidNegotiations || [];

                  // Calculate unpaid amounts breakdown
                  const unpaidServicesAmount = unpaidServices.reduce(
                    (sum: number, service: any) => sum + (service.rate || 0),
                    0
                  );
                  const unpaidNegotiationsAmount = unpaidNegotiations.reduce(
                    (sum: number, neg: any) => sum + (neg.totalAmount || 0),
                    0
                  );

                  // Use unpaidAmount if available (more accurate), otherwise fall back to calculation
                  const additionalAmountNeeded =
                    unpaidAmount > 0.01
                      ? unpaidAmount
                      : Math.max(0, currentTotal - paidAmount);

                  const amountToPay =
                    paymentCompleted && additionalAmountNeeded > 0
                      ? additionalAmountNeeded
                      : currentTotal;

                  // Build complete list of rates from all sources
                  const allRatesData: {
                    rate: number;
                    paymentType: string;
                    otherSpecification?: string;
                    source: string;
                  }[] = [];

                  // 1. Selected services from checkboxes
                  if (candidateData?.rates) {
                    Array.from(selectedRates).forEach((idx) => {
                      allRatesData.push({
                        ...candidateData.rates![idx],
                        source: "selected",
                      });
                    });
                  }

                  // 2. Approved additional rate requests
                  if (
                    application.additionalRateRequests &&
                    Array.isArray(application.additionalRateRequests)
                  ) {
                    const approvedRequests =
                      application.additionalRateRequests.filter(
                        (request: any) => request.status === "APPROVED"
                      );
                    approvedRequests.forEach((request: any) => {
                      if (request.rates && Array.isArray(request.rates)) {
                        request.rates.forEach((rate: any) => {
                          allRatesData.push({
                            ...rate,
                            source: "approved",
                          });
                        });
                      }
                    });
                  }

                  // 3. Accepted negotiation rates (including accepted counter offers)
                  if (
                    application.negotiationRequests &&
                    Array.isArray(application.negotiationRequests)
                  ) {
                    const acceptedNegotiations =
                      application.negotiationRequests.filter(
                        (request: any) => request.status === "ACCEPTED"
                      );
                    acceptedNegotiations.forEach((request: any) => {
                      // If there's an accepted counter offer, use its rates instead
                      const ratesToAdd =
                        request.counterOffer &&
                        request.counterOffer.status === "ACCEPTED"
                          ? request.counterOffer.rates
                          : request.rates;

                      if (ratesToAdd && Array.isArray(ratesToAdd)) {
                        ratesToAdd.forEach((rate: any) => {
                          allRatesData.push({
                            ...rate,
                            source: "negotiation",
                          });
                        });
                      }
                    });
                  }

                  // If negotiations are partially paid, the backend may only provide an aggregate
                  // (paidNegotiationAmount). For the Complete Payment modal, allocate that amount
                  // across negotiation line-items so an unpaid remainder is clearly visible.
                  const negotiationAllocation: Array<"PAID" | "UNPAID" | null> =
                    new Array(allRatesData.length).fill(null);
                  const paidNegotiationAmount =
                    paymentStatus?.paidNegotiationAmount ?? 0;
                  if (paidNegotiationAmount > 0.01) {
                    let remaining = paidNegotiationAmount;
                    allRatesData.forEach((r, i) => {
                      if (r.source !== "negotiation") return;
                      if (remaining >= (r.rate || 0) - 0.01) {
                        negotiationAllocation[i] = "PAID";
                        remaining -= r.rate || 0;
                      } else {
                        negotiationAllocation[i] = "UNPAID";
                      }
                    });
                  }

                  if (currentTotal > 0 && allRatesData.length > 0) {
                    return (
                      <View>
                        {/* Selected Services Section */}
                        <View
                          style={[
                            styles.paymentServicesCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(255, 255, 255, 0.05)"
                                : "#f8fafc",
                              borderColor: isDark
                                ? "rgba(255, 255, 255, 0.1)"
                                : "#e2e8f0",
                            },
                          ]}
                        >
                          <View style={styles.paymentSectionHeader}>
                            <Feather
                              name="check-circle"
                              size={18}
                              color={isDark ? "#94a3b8" : "#64748b"}
                            />
                            <Text
                              style={[
                                styles.paymentSectionTitle,
                                { color: colors.text },
                              ]}
                            >
                              {t("applications.selectedServices")}
                            </Text>
                          </View>

                          <View style={styles.paymentServicesList}>
                            {allRatesData.map((rate, idx) => {
                              const paymentTypeLabel =
                                rate.paymentType === "OTHER" &&
                                rate.otherSpecification
                                  ? rate.otherSpecification
                                  : rate.paymentType.charAt(0) +
                                    rate.paymentType.slice(1).toLowerCase();
                              const sourceLabel =
                                rate.source === "negotiation"
                                  ? t("applications.negotiationAccepted")
                                  : rate.source === "approved"
                                    ? t("applications.approved")
                                    : "";

                              // Check if this service/negotiation is paid or unpaid
                              const paymentStatus = application.paymentStatus;
                              let isPaid: boolean | undefined = false;
                              let isUnpaid = false;

                              // Helper to match services (line-item level truth)
                              const matchService = (
                                s1: any,
                                s2: any
                              ): boolean => {
                                return (
                                  Math.abs(s1.rate - s2.rate) < 0.01 &&
                                  s1.paymentType === s2.paymentType &&
                                  (s1.otherSpecification || "") ===
                                    (s2.otherSpecification || "")
                                );
                              };

                              const unpaidServices =
                                paymentStatus?.unpaidServices || [];
                              const paidServices =
                                paymentStatus?.paidServices || [];

                              const lineIsUnpaid = unpaidServices.some(
                                (u: any) => matchService(rate, u)
                              );
                              const lineIsPaid =
                                !lineIsUnpaid &&
                                paidServices.some((p: any) =>
                                  matchService(rate, p)
                                );

                              if (lineIsUnpaid) {
                                isUnpaid = true;
                              } else if (lineIsPaid) {
                                isPaid = true;
                              }

                              if (rate.source === "negotiation") {
                                // Prefer allocation derived from paidNegotiationAmount for partial payments.
                                if (!isPaid && !isUnpaid) {
                                  const alloc = negotiationAllocation[idx];
                                  if (alloc === "PAID") isPaid = true;
                                  if (alloc === "UNPAID") isUnpaid = true;
                                }

                                // If line-item lists didn't classify it, fall back to negotiation-level lists.
                                if (!isPaid && !isUnpaid) {
                                  const unpaidNegotiations =
                                    paymentStatus?.unpaidNegotiations || [];
                                  const negotiationRequest =
                                    application.negotiationRequests?.find(
                                      (req: any) => {
                                        const ratesToCheck =
                                          req.counterOffer?.status ===
                                          "ACCEPTED"
                                            ? req.counterOffer.rates
                                            : req.rates;
                                        return ratesToCheck?.some(
                                          (r: any) =>
                                            Math.abs(r.rate - rate.rate) <
                                              0.01 &&
                                            r.paymentType === rate.paymentType
                                        );
                                      }
                                    );
                                  if (negotiationRequest) {
                                    isUnpaid = unpaidNegotiations.some(
                                      (unpaid: any) =>
                                        unpaid.id === negotiationRequest.id
                                    );
                                    isPaid =
                                      !isUnpaid &&
                                      paymentStatus?.paidNegotiations?.some(
                                        (paid: any) =>
                                          paid.id === negotiationRequest.id
                                      );
                                  }
                                }
                              }

                              // In this modal, avoid per-line paid/unpaid styling (it can be confusing
                              // when totals show an unpaid remainder). The summary below is the source of truth.
                              const textColor = colors.text;

                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.paymentServiceItem,
                                    {
                                      borderBottomColor: isDark
                                        ? "rgba(255, 255, 255, 0.05)"
                                        : "#e2e8f0",
                                    },
                                    idx === allRatesData.length - 1 && {
                                      borderBottomWidth: 0,
                                    },
                                  ]}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[
                                        styles.paymentServiceRate,
                                        { color: textColor },
                                      ]}
                                    >
                                      €{rate.rate.toFixed(2)}/{paymentTypeLabel}
                                    </Text>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        gap: 4,
                                        marginTop: 2,
                                      }}
                                    >
                                      {sourceLabel && (
                                        <Text
                                          style={[
                                            styles.paymentServiceLabel,
                                            {
                                              color: isDark
                                                ? "#94a3b8"
                                                : "#64748b",
                                            },
                                          ]}
                                        >
                                          {sourceLabel}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>

                        {/* Payment Summary Section - Single Source of Truth */}
                        <View
                          style={[
                            styles.paymentSummaryCard,
                            {
                              backgroundColor: isDark
                                ? "rgba(99, 102, 241, 0.15)"
                                : "rgba(99, 102, 241, 0.08)",
                              borderColor: isDark
                                ? "rgba(99, 102, 241, 0.3)"
                                : "rgba(99, 102, 241, 0.2)",
                              marginTop: 16,
                            },
                          ]}
                        >
                          {/* Paid Amount - from paymentStatus (calculated from metadata) */}
                          {paidAmount > 0 && (
                            <View style={styles.paymentSummaryRow}>
                              <Text
                                style={[
                                  styles.paymentSummaryLabel,
                                  { color: isDark ? "#cbd5e1" : "#64748b" },
                                ]}
                              >
                                {t("applications.paidAmount")}:
                              </Text>
                              <Text
                                style={[
                                  styles.paymentSummaryValue,
                                  { color: "#22c55e" },
                                ]}
                              >
                                EUR {paidAmount.toFixed(2)}
                              </Text>
                            </View>
                          )}

                          {/* Unpaid Amount - from paymentStatus (calculated from metadata) */}
                          {unpaidAmount > 0 && (
                            <View style={styles.paymentSummaryRow}>
                              <Text
                                style={[
                                  styles.paymentSummaryLabel,
                                  { color: isDark ? "#cbd5e1" : "#64748b" },
                                ]}
                              >
                                {t("applications.unpaidAmount")}:
                              </Text>
                              <Text
                                style={[
                                  styles.paymentSummaryValue,
                                  { color: isDark ? "#fbbf24" : "#d97706" },
                                ]}
                              >
                                EUR {unpaidAmount.toFixed(2)}
                              </Text>
                            </View>
                          )}

                          {/* Total Amount */}
                          <View
                            style={[
                              styles.paymentSummaryDivider,
                              {
                                borderTopColor: isDark
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "rgba(0, 0, 0, 0.1)",
                                borderTopWidth: 1,
                                marginTop: 12,
                                paddingTop: 12,
                              },
                            ]}
                          >
                            <View style={styles.paymentSummaryRow}>
                              <Text
                                style={[
                                  styles.paymentSummaryLabel,
                                  {
                                    color: colors.text,
                                    fontSize: 20,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                {t("applications.totalAmount")}:
                              </Text>
                              <Text
                                style={[
                                  styles.paymentSummaryValue,
                                  {
                                    color: colors.tint,
                                    fontSize: 20,
                                    fontWeight: "700",
                                  },
                                ]}
                              >
                                EUR {currentTotal.toFixed(2)}
                              </Text>
                            </View>
                          </View>

                          {/* Additional Payment Needed - calculated in this card */}
                          {additionalAmountNeeded > 0.01 && (
                            <View
                              style={[
                                styles.paymentSummaryDivider,
                                {
                                  borderTopColor: isDark
                                    ? "rgba(255, 255, 255, 0.1)"
                                    : "rgba(0, 0, 0, 0.1)",
                                  borderTopWidth: 1,
                                  marginTop: 12,
                                  paddingTop: 12,
                                  paddingHorizontal: 0,
                                },
                              ]}
                            >
                              <View style={{ flexDirection: "column" }}>
                                <Text
                                  style={[
                                    styles.paymentSummaryLabel,
                                    {
                                      color: isDark ? "#fbbf24" : "#d97706",
                                      fontSize: 16,
                                      fontWeight: "700",
                                    },
                                  ]}
                                >
                                  {t("applications.paymentRequired")}:
                                </Text>
                                <Text
                                  style={[
                                    styles.paymentSummaryValue,
                                    {
                                      color: isDark ? "#fbbf24" : "#d97706",
                                      fontSize: 20,
                                      fontWeight: "700",
                                      marginTop: 6,
                                      width: "100%",
                                      textAlign: "right",
                                    },
                                  ]}
                                >
                                  EUR {additionalAmountNeeded.toFixed(2)}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Payment Info Note */}
                        <View
                          style={[
                            styles.paymentInfoNoteBox,
                            {
                              backgroundColor: isDark
                                ? "rgba(59, 130, 246, 0.1)"
                                : "rgba(59, 130, 246, 0.05)",
                              marginTop: 16,
                            },
                          ]}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <Feather
                              name="info"
                              size={16}
                              color={isDark ? "#60a5fa" : "#3b82f6"}
                              style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.paymentInfoNoteText,
                                  {
                                    color: isDark ? "#93c5fd" : "#1e40af",
                                    fontSize: 13,
                                    lineHeight: 18,
                                  },
                                ]}
                              >
                                {t("applications.paymentHeldPlatformFeeNote")}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View
                      style={[
                        styles.paymentInfoBox,
                        {
                          backgroundColor: isDark
                            ? "rgba(251, 191, 36, 0.1)"
                            : "#fef3c7",
                          borderColor: isDark
                            ? "rgba(251, 191, 36, 0.3)"
                            : "#fbbf24",
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <Feather
                          name="alert-circle"
                          size={18}
                          color={isDark ? "#fbbf24" : "#ca8a04"}
                          style={{ marginTop: 2 }}
                        />
                        <Text
                          style={[
                            styles.paymentInfoNote,
                            {
                              color: isDark ? "#fbbf24" : "#92400e",
                              flex: 1,
                            },
                          ]}
                        >
                          Please select at least one service from the
                          candidate&apos;s rates, approve additional rate
                          requests, or have an accepted negotiation to proceed
                          with payment.
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>

              <View
                style={[
                  styles.modalFooter,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <TouchableButton
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: "transparent",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.2)",
                    },
                  ]}
                  onPress={() => setShowPaymentModal(false)}
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
                      backgroundColor: isDark ? "#4f46e5" : "#6366f1",
                      borderColor: isDark ? "#6366f1" : "#4f46e5",
                    },
                    paymentProcessing && styles.modalButtonDisabled,
                  ]}
                  onPress={handleCreatePayment}
                  disabled={(() => {
                    if (paymentProcessing) return true;

                    // Check if there's any valid payment source
                    const hasSelectedServices = selectedRates.size > 0;
                    const hasApprovedAdditionalRates =
                      application?.additionalRateRequests &&
                      Array.isArray(application.additionalRateRequests) &&
                      application.additionalRateRequests.some(
                        (req: any) => req.status === "APPROVED"
                      );
                    const hasAcceptedNegotiations =
                      application?.negotiationRequests &&
                      Array.isArray(application.negotiationRequests) &&
                      application.negotiationRequests.some(
                        (req: any) => req.status === "ACCEPTED"
                      );
                    const selectedTotal = getSelectedRatesTotal();

                    // Enable if there's a total amount from any source
                    const shouldDisable =
                      selectedTotal === 0 ||
                      (!hasSelectedServices &&
                        !hasApprovedAdditionalRates &&
                        !hasAcceptedNegotiations);

                    console.log(
                      "[ApplicantDetail] Payment button disabled check:",
                      {
                        paymentProcessing,
                        hasSelectedServices,
                        hasApprovedAdditionalRates,
                        hasAcceptedNegotiations,
                        selectedTotal,
                        shouldDisable,
                      }
                    );

                    return shouldDisable;
                  })()}
                >
                  {paymentProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.createPayment")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Respond to Additional Rates Modal */}
        <Modal
          visible={showRespondModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowRespondModal(false);
            setSelectedRequestId(null);
            setSelectedRequestStatus(null);
            setRespondMessage("");
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedRequestStatus === "APPROVED"
                    ? t("applications.approve")
                    : t("applications.reject")}{" "}
                  {t("applications.additionalRateRequests")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowRespondModal(false);
                    setSelectedRequestId(null);
                    setSelectedRequestStatus(null);
                    setRespondMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={[styles.modalBody, { flexGrow: 0, flexShrink: 1 }]}
                contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {selectedRequestStatus === "APPROVED"
                    ? t("applications.approveAdditionalRateDescription")
                    : t("applications.rejectAdditionalRateDescription")}
                </Text>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.optionalMessage")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.6)"
                        : "#f1f5f9",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#e2e8f0",
                    },
                  ]}
                  placeholder={
                    selectedRequestStatus === "APPROVED"
                      ? "Great! We approve these additional rates..."
                      : "Thank you for the request. Unfortunately..."
                  }
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  multiline
                  numberOfLines={5}
                  value={respondMessage}
                  onChangeText={setRespondMessage}
                  textAlignVertical="top"
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
                    styles.modalCancelButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(241, 245, 249, 0.9)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => {
                    setShowRespondModal(false);
                    setSelectedRequestId(null);
                    setSelectedRequestStatus(null);
                    setRespondMessage("");
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
                        selectedRequestStatus === "APPROVED"
                          ? "#22c55e"
                          : "#ef4444",
                      borderColor:
                        selectedRequestStatus === "APPROVED"
                          ? "#22c55e"
                          : "#ef4444",
                    },
                    responding && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRespondToAdditionalRates}
                  disabled={responding}
                >
                  {responding ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {selectedRequestStatus === "APPROVED"
                        ? t("applications.approve")
                        : t("applications.reject")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Suggest Negotiation Modal */}
        <Modal
          visible={showNegotiationModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowNegotiationModal(false)}
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
                  {t("applications.suggestNegotiation")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowNegotiationModal(false);
                    setNegotiationRates([{ rate: "", paymentType: "HOURLY" }]);
                    setNegotiationMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {t("applications.proposeDifferentRateAndExplain")}
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
                {negotiationRates.map((rate, idx) => (
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
                          const updated = [...negotiationRates];
                          updated[idx].rate = text;
                          setNegotiationRates(updated);
                        }}
                        keyboardType="numeric"
                      />
                      <TouchableButton
                        onPress={() => {
                          const updated = negotiationRates.filter(
                            (_, i) => i !== idx
                          );
                          if (updated.length === 0) {
                            updated.push({ rate: "", paymentType: "HOURLY" });
                          }
                          setNegotiationRates(updated);
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
                      <Text
                        style={[
                          styles.modalLabel,
                          {
                            color: colors.text,
                            fontSize: 14,
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("applications.paymentType")}
                      </Text>
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
                              const updated = [...negotiationRates];
                              updated[idx].paymentType = type;
                              setNegotiationRates(updated);
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
                            const updated = [...negotiationRates];
                            updated[idx].otherSpecification = text;
                            setNegotiationRates(updated);
                          }}
                        />
                      )}
                    </View>
                  </View>
                ))}
                <TouchableButton
                  onPress={() => {
                    setNegotiationRates([
                      ...negotiationRates,
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

                {/* Total Display */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={[
                      styles.modalLabel,
                      {
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("applications.total")}:
                  </Text>
                  <Text
                    style={{
                      color: colors.tint,
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    EUR{" "}
                    {negotiationRates
                      .reduce((sum, r) => sum + (parseFloat(r.rate) || 0), 0)
                      .toFixed(2)}
                  </Text>
                </View>

                {/* Message (Mandatory) */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.explanationRequired")}
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
                  {t("applications.explainRateRequest")}
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
                  value={negotiationMessage}
                  onChangeText={setNegotiationMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled={true}
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
                    setShowNegotiationModal(false);
                    setNegotiationRates([{ rate: "", paymentType: "HOURLY" }]);
                    setNegotiationMessage("");
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
                    suggestingNegotiation && styles.modalButtonDisabled,
                  ]}
                  onPress={handleSuggestNegotiation}
                  disabled={suggestingNegotiation}
                >
                  {suggestingNegotiation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.sendSuggestion")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Employer Respond to Service Provider Negotiation Modal */}
        <Modal
          visible={showEmployerNegotiationRespondModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowEmployerNegotiationRespondModal(false);
            setSelectedEmployerNegotiationId(null);
            setSelectedEmployerNegotiationStatus(null);
            setEmployerNegotiationResponseMessage("");
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
                    setShowEmployerNegotiationRespondModal(false);
                    setSelectedEmployerNegotiationId(null);
                    setSelectedEmployerNegotiationStatus(null);
                    setEmployerNegotiationResponseMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {selectedEmployerNegotiationStatus === "ACCEPTED"
                    ? t(
                        "applications.acceptingServiceProviderNegotiationRequestDescription"
                      )
                    : t(
                        "applications.rejectingServiceProviderNegotiationRequestDescription"
                      )}
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
                  value={employerNegotiationResponseMessage}
                  onChangeText={setEmployerNegotiationResponseMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled={true}
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
                    setShowEmployerNegotiationRespondModal(false);
                    setSelectedEmployerNegotiationId(null);
                    setSelectedEmployerNegotiationStatus(null);
                    setEmployerNegotiationResponseMessage("");
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
                        selectedEmployerNegotiationStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                      borderColor:
                        selectedEmployerNegotiationStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                    },
                    respondingToEmployerNegotiation &&
                      styles.modalButtonDisabled,
                  ]}
                  onPress={handleRespondToServiceProviderNegotiation}
                  disabled={respondingToEmployerNegotiation}
                >
                  {respondingToEmployerNegotiation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {selectedEmployerNegotiationStatus === "ACCEPTED"
                        ? t("common.accept")
                        : t("applications.reject")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Employer Counter Offer Modal */}
        <Modal
          visible={showEmployerCounterOfferModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowEmployerCounterOfferModal(false);
            setEmployerCounterOfferRates([{ rate: "", paymentType: "HOURLY" }]);
            setEmployerCounterOfferMessage("");
            setSelectedEmployerNegotiationId(null);
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
                  {t("applications.proposeCounterOffer")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowEmployerCounterOfferModal(false);
                    setEmployerCounterOfferRates([
                      { rate: "", paymentType: "HOURLY" },
                    ]);
                    setEmployerCounterOfferMessage("");
                    setSelectedEmployerNegotiationId(null);
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {t("applications.proposeCounterOfferDescription")}
                </Text>

                {/* Counter Offer Rates */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.counterOfferRates")} *
                </Text>
                {employerCounterOfferRates.map((rate, idx) => (
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
                          const updated = [...employerCounterOfferRates];
                          updated[idx].rate = text;
                          setEmployerCounterOfferRates(updated);
                        }}
                        keyboardType="numeric"
                      />
                      <TouchableButton
                        onPress={() => {
                          const updated = employerCounterOfferRates.filter(
                            (_, i) => i !== idx
                          );
                          if (updated.length === 0) {
                            updated.push({ rate: "", paymentType: "HOURLY" });
                          }
                          setEmployerCounterOfferRates(updated);
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
                      <Text
                        style={[
                          styles.modalLabel,
                          {
                            color: colors.text,
                            fontSize: 14,
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("applications.paymentType")}
                      </Text>
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
                              const updated = [...employerCounterOfferRates];
                              updated[idx].paymentType = type;
                              setEmployerCounterOfferRates(updated);
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
                            const updated = [...employerCounterOfferRates];
                            updated[idx].otherSpecification = text;
                            setEmployerCounterOfferRates(updated);
                          }}
                        />
                      )}
                    </View>
                  </View>
                ))}
                <TouchableButton
                  onPress={() => {
                    setEmployerCounterOfferRates([
                      ...employerCounterOfferRates,
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

                {/* Total Display */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={[
                      styles.modalLabel,
                      {
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("applications.total")}:
                  </Text>
                  <Text
                    style={{
                      color: colors.tint,
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    EUR{" "}
                    {employerCounterOfferRates
                      .reduce((sum, r) => sum + (parseFloat(r.rate) || 0), 0)
                      .toFixed(2)}
                  </Text>
                </View>

                {/* Message (Optional) */}
                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 8 },
                  ]}
                >
                  {t("applications.messageOptional")}
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
                  placeholder={t("applications.explainCounterOffer")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={employerCounterOfferMessage}
                  onChangeText={setEmployerCounterOfferMessage}
                  textAlignVertical="top"
                  multiline
                  scrollEnabled={true}
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
                    setShowEmployerCounterOfferModal(false);
                    setEmployerCounterOfferRates([
                      { rate: "", paymentType: "HOURLY" },
                    ]);
                    setEmployerCounterOfferMessage("");
                    setSelectedEmployerNegotiationId(null);
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
                    sendingEmployerCounterOffer && styles.modalButtonDisabled,
                  ]}
                  onPress={handleSendEmployerCounterOffer}
                  disabled={sendingEmployerCounterOffer}
                >
                  {sendingEmployerCounterOffer ? (
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

        {/* Request Additional Time Modal */}
        <Modal
          visible={showAdditionalTimeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAdditionalTimeModal(false);
            setAdditionalTimeMessage("");
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
                  {t("applications.requestAdditionalTime")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowAdditionalTimeModal(false);
                    setAdditionalTimeMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {t("applications.requestAdditionalTimeModalDescription")}
                </Text>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.explanationRequired")}
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
                  placeholder={t("applications.explainAdditionalTime")}
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={additionalTimeMessage}
                  onChangeText={setAdditionalTimeMessage}
                  textAlignVertical="top"
                  multiline
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
                    setShowAdditionalTimeModal(false);
                    setAdditionalTimeMessage("");
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
                    requestingAdditionalTime && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRequestAdditionalTime}
                  disabled={requestingAdditionalTime}
                >
                  {requestingAdditionalTime ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("applications.sendRequest")}
                    </Text>
                  )}
                </TouchableButton>
              </View>
            </View>
          </View>
        </Modal>

        {/* Respond to Additional Time Response Modal */}
        <Modal
          visible={showAdditionalTimeResponseModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowAdditionalTimeResponseModal(false);
            setSelectedAdditionalTimeRequestId(null);
            setAdditionalTimeResponseStatus(null);
            setAdditionalTimeResponseMessage("");
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {additionalTimeResponseStatus === "ACCEPTED"
                    ? t("common.accept")
                    : t("applications.reject")}{" "}
                  {t("applications.additionalTimeRequests")}
                </Text>
                <TouchableButton
                  onPress={() => {
                    setShowAdditionalTimeResponseModal(false);
                    setSelectedAdditionalTimeRequestId(null);
                    setAdditionalTimeResponseStatus(null);
                    setAdditionalTimeResponseMessage("");
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableButton>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalDescription,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {additionalTimeResponseStatus === "ACCEPTED"
                    ? t("applications.acceptAdditionalTimeDescription")
                    : t("applications.rejectAdditionalTimeDescription")}
                </Text>

                <Text
                  style={[
                    styles.modalLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  {t("applications.optionalMessage")}
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.6)"
                        : "#f1f5f9",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "#e2e8f0",
                      minHeight: 110,
                    },
                  ]}
                  placeholder={
                    additionalTimeResponseStatus === "ACCEPTED"
                      ? t("applications.additionalTimeAcceptPlaceholder")
                      : t("applications.additionalTimeRejectPlaceholder")
                  }
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  multiline
                  numberOfLines={4}
                  value={additionalTimeResponseMessage}
                  onChangeText={setAdditionalTimeResponseMessage}
                  textAlignVertical="top"
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
                    setAdditionalTimeResponseStatus(null);
                    setAdditionalTimeResponseMessage("");
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
                        additionalTimeResponseStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                      borderColor:
                        additionalTimeResponseStatus === "ACCEPTED"
                          ? "#22c55e"
                          : "#ef4444",
                    },
                    respondingToAdditionalTime && styles.modalButtonDisabled,
                  ]}
                  onPress={handleRespondToAdditionalTimeResponse}
                  disabled={respondingToAdditionalTime}
                >
                  {respondingToAdditionalTime ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {additionalTimeResponseStatus === "ACCEPTED"
                        ? t("common.accept")
                        : t("applications.reject")}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: "row",
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  headline: {
    fontSize: 14,
    marginBottom: 8,
  },
  verificationBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  paymentSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  paymentBlockedView: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  paymentBlockedText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  paymentBlockedButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentBlockedButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    flex: 1,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  skillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 80,
  },
  value: {
    fontSize: 15,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  coverLetterText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  completedBannerContent: {
    flex: 1,
  },
  completedBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  completedBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  paymentBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  paymentBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  payNowButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payNowButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  paymentInfoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  paymentInfoLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  paymentInfoAmount: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  paymentInfoNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  paymentServicesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  paymentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  paymentSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  paymentServicesList: {
    gap: 0,
  },
  paymentServiceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paymentServiceRate: {
    fontSize: 15,
    fontWeight: "600",
  },
  paymentServiceLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  paymentSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentSummaryLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentSummaryDivider: {
    borderTopWidth: 1,
  },
  paymentInfoNoteBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    padding: 14,
  },
  paymentInfoNoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  chatButton: {},
  acceptButton: {},
  rejectButton: {},
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    width: "90%",
    borderRadius: 20,
    overflow: "hidden",
    height: Dimensions.get("window").height * 0.8,
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  warningBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
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
  modalButton: {
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
  modalButtonDisabled: {
    opacity: 0.6,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  dateTimeText: {
    fontSize: 16,
    flex: 1,
  },
  ratesSection: {
    marginTop: 16,
    marginBottom: 12,
  },
  ratesSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  rateText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
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
  requestStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  requestStatusText: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    flexShrink: 1,
    paddingRight: 12,
  },
  requestDate: {
    fontSize: 12,
    flexShrink: 0,
    marginLeft: 8,
    textAlign: "right",
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
  requestActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  respondButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  respondButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  approveButton: {
    // Styles applied inline
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
  amountChangeWarning: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  amountChangeWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  amountChangeWarningTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  amountChangeWarningText: {
    fontSize: 12,
    lineHeight: 16,
  },
  candidateCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
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
  candidateAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: "600",
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
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cta: {
    fontWeight: "600",
    fontSize: 13,
  },
  moreSkills: {
    fontSize: 11,
    fontStyle: "italic",
  },
});
