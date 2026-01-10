import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import * as Linking from "expo-linking";

interface KYCVerification {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  verificationType: string;
  status: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  documentNumber?: string;
  documentCountry?: string;
  documentExpiry?: string;
  documentStatuses?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  certifications?: Array<any>;
  cvDocuments?: Array<any>;
  allVerifications?: Array<{
    id: string;
    verificationType: string;
    status: string;
    documentFrontUrl?: string;
    documentBackUrl?: string;
    selfieUrl?: string;
    documentStatuses?: Record<string, any>;
    createdAt: string;
  }>;
  backgroundCheck?: {
    id: string;
    status: string;
    uploadedDocument?: string;
    certificateNumber?: string;
    submittedAt?: string;
    createdAt: string;
  };
}

export default function KYCDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const verificationId = params.verificationId as string;
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [verification, setVerification] = useState<KYCVerification | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [imageModal, setImageModal] = useState<{
    visible: boolean;
    uri: string;
    title: string;
  }>({ visible: false, uri: "", title: "" });
  const [requestDocumentsModal, setRequestDocumentsModal] = useState(false);
  const [requestedDocument, setRequestedDocument] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestDocumentModal, setRequestDocumentModal] = useState<{
    visible: boolean;
    documentType: string;
    documentName: string;
    reason: string;
  }>({ visible: false, documentType: "", documentName: "", reason: "" });

  useEffect(() => {
    if (verificationId) {
      fetchVerification();
    }
  }, [verificationId]);

  const fetchVerification = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const res = await fetch(`${base}/kyc/admin/${verificationId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setVerification(data);
        } else {
          // Silently handle non-200 responses - don't show alert
          setVerification(null);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // Silently handle network errors - don't log or show alerts
        // Just set verification to null and let the UI show the empty state
        if (
          fetchError.name === "AbortError" ||
          fetchError.message?.includes("timeout")
        ) {
          // Timeout - silently handle
          setVerification(null);
        } else if (fetchError.message?.includes("Network request failed")) {
          // Network error - silently handle
          setVerification(null);
        } else {
          // Other errors - still handle silently
          setVerification(null);
        }
      }
    } catch (error) {
      // Silently handle all errors
      setVerification(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (decision: "VERIFIED" | "FAILED") => {
    Alert.alert(
      decision === "VERIFIED"
        ? t("admin.approveVerification")
        : t("admin.declineVerification"),
      decision === "VERIFIED"
        ? t("admin.areYouSureApproveVerification")
        : t("admin.areYouSureDeclineVerification"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text:
            decision === "VERIFIED" ? t("admin.approve") : t("admin.decline"),
          style: decision === "FAILED" ? "destructive" : "default",
          onPress: async () => {
            try {
              setProcessing(true);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) return;

              const base = getApiBase();
              const res = await fetch(
                `${base}/kyc/admin/${verificationId}/review`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    decision,
                    notes:
                      decision === "VERIFIED"
                        ? t("admin.approvedByAdmin")
                        : t("admin.declinedByAdmin"),
                  }),
                }
              );

              if (res.ok) {
                Alert.alert(
                  "Success",
                  `Verification ${decision === "VERIFIED" ? "approved" : "declined"} successfully`,
                  [{ text: t("common.ok"), onPress: () => router.back() }]
                );
              } else {
                const error = await res.json();
                Alert.alert(
                  t("common.error"),
                  error.message || t("admin.failedToUpdateVerification")
                );
              }
            } catch (error) {
              console.error("Error reviewing verification:", error);
              Alert.alert(t("common.error"), t("common.failedToConnect"));
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestAdditionalDocuments = async () => {
    if (!requestedDocument.trim() || !requestReason.trim()) {
      Alert.alert(t("common.required"), t("admin.fillDocumentNameAndReason"));
      return;
    }

    try {
      setProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/kyc/admin/${verificationId}/request-documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            requestedDocument: requestedDocument.trim(),
            reason: requestReason.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          "Success",
          "Request for additional documents sent successfully. The user will be notified via email and push notification.",
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setRequestDocumentsModal(false);
                setRequestedDocument("");
                setRequestReason("");
              },
            },
          ]
        );
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToSendRequest")
        );
      }
    } catch (error) {
      console.error("Error requesting documents:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setProcessing(false);
    }
  };

  const handleDocumentReview = async (
    documentType: string,
    decision: "APPROVED" | "REJECTED"
  ) => {
    // Handle certifications
    if (documentType.startsWith("certification-")) {
      Alert.alert(
        decision === "APPROVED"
          ? t("admin.approveCertification")
          : t("admin.rejectCertification"),
        decision === "APPROVED"
          ? t("admin.areYouSureApproveCertification")
          : t("admin.areYouSureRejectCertification"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text:
              decision === "APPROVED" ? t("admin.approve") : t("admin.reject"),
            style: decision === "REJECTED" ? "destructive" : "default",
            onPress: async () => {
              try {
                setProcessing(true);
                const token = await SecureStore.getItemAsync("auth_token");
                if (!token) return;

                const base = getApiBase();
                const res = await fetch(
                  `${base}/kyc/admin/${verificationId}/document/${documentType}/review`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      decision: decision,
                    }),
                  }
                );

                if (res.ok) {
                  Alert.alert(
                    t("common.success"),
                    `Certification ${decision === "APPROVED" ? "approved" : "rejected"} successfully`,
                    [
                      {
                        text: t("common.ok"),
                        onPress: () => fetchVerification(),
                      },
                    ]
                  );
                } else {
                  const error = await res.json();
                  Alert.alert(
                    t("common.error"),
                    error.message || t("admin.failedToUpdateCertification")
                  );
                }
              } catch (error) {
                console.error("Error reviewing certification:", error);
                Alert.alert(t("common.error"), t("common.failedToConnect"));
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Handle CV documents
    if (documentType.startsWith("cv-")) {
      Alert.alert(
        decision === "APPROVED" ? t("admin.approveCv") : t("admin.rejectCv"),
        decision === "APPROVED"
          ? t("admin.areYouSureApproveCv")
          : t("admin.areYouSureRejectCv"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text:
              decision === "APPROVED" ? t("admin.approve") : t("admin.reject"),
            style: decision === "REJECTED" ? "destructive" : "default",
            onPress: async () => {
              try {
                setProcessing(true);
                const token = await SecureStore.getItemAsync("auth_token");
                if (!token) return;

                const base = getApiBase();
                const res = await fetch(
                  `${base}/kyc/admin/${verificationId}/document/${documentType}/review`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      decision: decision,
                    }),
                  }
                );

                if (res.ok) {
                  Alert.alert(
                    t("common.success"),
                    `CV document ${decision === "APPROVED" ? "approved" : "rejected"} successfully`,
                    [
                      {
                        text: t("common.ok"),
                        onPress: () => fetchVerification(),
                      },
                    ]
                  );
                } else {
                  const error = await res.json();
                  Alert.alert(
                    t("common.error"),
                    error.message || t("admin.failedToUpdateCvDocument")
                  );
                }
              } catch (error) {
                console.error("Error reviewing CV document:", error);
                Alert.alert(t("common.error"), t("common.failedToConnect"));
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Criminal record uses a different endpoint (BackgroundCheck model)
    // Check for criminal record first before any other logic
    if (
      documentType === "criminalRecord" ||
      documentType === "criminal_record"
    ) {
      if (!verification?.backgroundCheck?.id) {
        Alert.alert(t("common.error"), t("admin.backgroundCheckIdNotFound"));
        return;
      }

      Alert.alert(
        decision === "APPROVED"
          ? t("admin.approveCriminalRecord")
          : t("admin.rejectCriminalRecord"),
        decision === "APPROVED"
          ? t("admin.areYouSureApproveCriminalRecord")
          : t("admin.areYouSureRejectCriminalRecord"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text:
              decision === "APPROVED" ? t("admin.approve") : t("admin.reject"),
            style: decision === "REJECTED" ? "destructive" : "default",
            onPress: async () => {
              try {
                setProcessing(true);
                const token = await SecureStore.getItemAsync("auth_token");
                if (!token) return;

                const base = getApiBase();
                const res = await fetch(
                  `${base}/background-checks/admin/${verification.backgroundCheck!.id}/review`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      result: decision === "APPROVED" ? "CLEAN" : "HAS_RECORDS",
                      hasCriminalRecord: decision === "REJECTED",
                      adminNotes:
                        decision === "APPROVED"
                          ? t("admin.criminalRecordApproved")
                          : t("admin.criminalRecordRejected"),
                    }),
                  }
                );

                if (res.ok) {
                  Alert.alert(
                    "Success",
                    `Criminal record ${decision === "APPROVED" ? "approved" : "rejected"} successfully`,
                    [{ text: "OK", onPress: () => fetchVerification() }]
                  );
                } else {
                  const error = await res.json();
                  Alert.alert(
                    t("common.error"),
                    error.message || t("admin.failedToUpdateCriminalRecord")
                  );
                }
              } catch (error) {
                console.error("Error reviewing criminal record:", error);
                Alert.alert(t("common.error"), t("common.failedToConnect"));
              } finally {
                setProcessing(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Regular KYC documents (ID front, back, selfie)
    Alert.alert(
      decision === "APPROVED"
        ? t("admin.approveDocument")
        : t("admin.rejectDocument"),
      decision === "APPROVED"
        ? t("admin.areYouSureApproveDocument")
        : t("admin.areYouSureRejectDocument"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "APPROVED" ? "Approve" : "Reject",
          style: decision === "REJECTED" ? "destructive" : "default",
          onPress: async () => {
            try {
              setProcessing(true);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) return;

              const base = getApiBase();
              const res = await fetch(
                `${base}/kyc/admin/${verificationId}/document/${documentType}/review`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    decision: decision, // Backend expects "APPROVED" or "REJECTED"
                  }),
                }
              );

              if (res.ok) {
                Alert.alert(
                  "Success",
                  `Document ${decision === "APPROVED" ? "approved" : "rejected"} successfully`,
                  [{ text: "OK", onPress: () => fetchVerification() }]
                );
              } else {
                const error = await res.json();
                Alert.alert(
                  t("common.error"),
                  error.message || t("admin.failedToUpdateDocument")
                );
              }
            } catch (error) {
              console.error("Error reviewing document:", error);
              Alert.alert(t("common.error"), t("common.failedToConnect"));
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestDocument = async () => {
    if (!requestDocumentModal.reason.trim()) {
      Alert.alert(t("common.required"), t("admin.provideReason"));
      return;
    }

    // Criminal record uses a different endpoint (BackgroundCheck model)
    if (
      requestDocumentModal.documentType === "criminalRecord" ||
      requestDocumentModal.documentType === "criminal_record"
    ) {
      if (!verification?.backgroundCheck?.id) {
        Alert.alert(t("common.error"), t("admin.backgroundCheckIdNotFound"));
        return;
      }

      try {
        setProcessing(true);
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const base = getApiBase();
        // Use the background check request endpoint or create a notification
        // For now, we'll use the KYC request-documents endpoint with a special handling
        const res = await fetch(
          `${base}/kyc/admin/${verificationId}/request-documents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              requestedDocument: t("admin.criminalRecordCertificate"),
              reason: requestDocumentModal.reason.trim(),
            }),
          }
        );

        if (res.ok) {
          Alert.alert(
            "Success",
            "Document request sent successfully. The user will be notified.",
            [
              {
                text: t("common.ok"),
                onPress: () => {
                  setRequestDocumentModal({
                    visible: false,
                    documentType: "",
                    documentName: "",
                    reason: "",
                  });
                  fetchVerification();
                },
              },
            ]
          );
        } else {
          const error = await res.json();
          Alert.alert(
            t("common.error"),
            error.message || t("admin.failedToSendRequest")
          );
        }
      } catch (error) {
        console.error("Error requesting criminal record:", error);
        Alert.alert(t("common.error"), t("common.failedToConnect"));
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Regular KYC documents (ID front, back, selfie)
    try {
      setProcessing(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/kyc/admin/${verificationId}/document/${requestDocumentModal.documentType}/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: requestDocumentModal.reason.trim(),
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          "Success",
          "Document request sent successfully. The user will be notified.",
          [
            {
              text: t("common.ok"),
              onPress: () => {
                setRequestDocumentModal({
                  visible: false,
                  documentType: "",
                  documentName: "",
                  reason: "",
                });
                fetchVerification();
              },
            },
          ]
        );
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToSendRequest")
        );
      }
    } catch (error) {
      console.error("Error requesting document:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!verification?.user?.id) return;

    Alert.alert(t("admin.deleteUser"), t("admin.deleteUserConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setProcessing(true);
            const token = await SecureStore.getItemAsync("auth_token");
            if (!token) return;

            const base = getApiBase();
            const res = await fetch(
              `${base}/admin/users/${verification.user!.id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (res.ok) {
              Alert.alert("Success", t("admin.userDeletedSuccessfully"), [
                { text: t("common.ok"), onPress: () => router.back() },
              ]);
            } else {
              const error = await res.json();
              Alert.alert(
                t("common.error"),
                error.message || t("admin.failedToDeleteUser")
              );
            }
          } catch (error) {
            console.error("Error deleting user:", error);
            Alert.alert(t("common.error"), t("common.failedToConnect"));
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const openImageModal = (uri: string, title: string) => {
    if (!uri) {
      Alert.alert(t("admin.noImage"), t("admin.documentImageNotAvailable"));
      return;
    }
    setImageModal({ visible: true, uri, title });
  };

  const getDocumentStatus = (
    documentType: string,
    documentStatuses?: Record<string, any>
  ): string => {
    if (!documentStatuses) return "PENDING";

    // Handle certifications (certification-0, certification-1, etc.)
    if (documentType.startsWith("certification-")) {
      const index = parseInt(documentType.split("-")[1]);
      if (
        documentStatuses.certifications &&
        Array.isArray(documentStatuses.certifications)
      ) {
        const status = documentStatuses.certifications[index] || "PENDING";
        if (status === "VERIFIED") return "APPROVED";
        if (status === "FAILED") return "REJECTED";
        return status;
      }
      // Fallback to flat structure
      const status = documentStatuses[documentType] || "PENDING";
      if (status === "VERIFIED") return "APPROVED";
      if (status === "FAILED") return "REJECTED";
      return status;
    }

    // Handle CV documents (cv-0, cv-1, etc.)
    if (documentType.startsWith("cv-")) {
      const index = parseInt(documentType.split("-")[1]);
      if (
        documentStatuses.cvDocuments &&
        Array.isArray(documentStatuses.cvDocuments)
      ) {
        const status = documentStatuses.cvDocuments[index] || "PENDING";
        if (status === "VERIFIED") return "APPROVED";
        if (status === "FAILED") return "REJECTED";
        return status;
      }
      // Fallback to flat structure
      const status = documentStatuses[documentType] || "PENDING";
      if (status === "VERIFIED") return "APPROVED";
      if (status === "FAILED") return "REJECTED";
      return status;
    }

    // Regular documents (documentFront, documentBack, selfie, etc.)
    const status = documentStatuses[documentType] || "PENDING";
    // Normalize status values: backend uses "VERIFIED"/"FAILED", but we display as "APPROVED"/"REJECTED"
    if (status === "VERIFIED") return "APPROVED";
    if (status === "FAILED") return "REJECTED";
    return status;
  };

  const renderDocumentCard = (
    label: string,
    url: string | undefined,
    documentType: string,
    modalTitle: string,
    isPdf = false,
    documentStatuses?: Record<string, string>
  ) => {
    const hasDocument = !!url;
    const docStatus = getDocumentStatus(documentType, documentStatuses);
    // Normalize status for display: handle both "APPROVED"/"REJECTED" and "VERIFIED"/"FAILED", plus background check statuses
    const normalizedStatus =
      docStatus === "APPROVED" ||
      docStatus === "VERIFIED" ||
      docStatus === "CLEAN"
        ? "APPROVED"
        : docStatus === "REJECTED" ||
            docStatus === "FAILED" ||
            docStatus === "HAS_RECORDS"
          ? "REJECTED"
          : docStatus;
    const statusColor =
      normalizedStatus === "APPROVED"
        ? "#22c55e"
        : normalizedStatus === "REJECTED"
          ? "#ef4444"
          : hasDocument
            ? "#f59e0b"
            : "#6b7280";

    return (
      <View
        style={[
          styles.documentCard,
          {
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.8)"
              : "rgba(255,255,255,0.95)",
            borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
            shadowColor: isDark ? "#000" : "#000",
          },
        ]}
      >
        <View style={styles.documentCardHeader}>
          <Text style={[styles.documentCardTitle, { color: colors.text }]}>
            {label}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: statusColor,
                  fontSize: 11,
                  fontWeight: "600",
                },
              ]}
            >
              {hasDocument
                ? normalizedStatus === "APPROVED"
                  ? "APPROVED"
                  : normalizedStatus === "REJECTED"
                    ? "REJECTED"
                    : normalizedStatus === "SUBMITTED" ||
                        normalizedStatus === "UNDER_REVIEW"
                      ? "UNDER REVIEW"
                      : "PENDING"
                : "MISSING"}
            </Text>
          </View>
        </View>

        {hasDocument ? (
          <TouchableOpacity
            onPress={async () => {
              if (isPdf) {
                const pdfUrl = fullImageUrl(url);
                if (pdfUrl) {
                  try {
                    await Linking.openURL(pdfUrl);
                  } catch (err) {
                    Alert.alert(t("common.error"), t("admin.couldNotOpenPdf"));
                  }
                }
              } else {
                openImageModal(fullImageUrl(url) || "", modalTitle);
              }
            }}
            style={styles.documentPreviewContainer}
          >
            {isPdf ? (
              <View style={[styles.documentPreview, styles.pdfContainer]}>
                <Feather name="file-text" size={48} color="#fff" />
                <Text style={styles.pdfText}>PDF Document</Text>
              </View>
            ) : (
              <Image
                source={{ uri: fullImageUrl(url) || "" }}
                style={styles.documentPreview}
                resizeMode="cover"
              />
            )}
            <View style={styles.previewOverlay}>
              <Feather
                name={isPdf ? "file-text" : "eye"}
                size={20}
                color="#fff"
              />
              <Text style={styles.previewText}>{t("admin.tapToView")}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.missingDocumentBox,
              {
                backgroundColor: isDark
                  ? "rgba(107, 114, 128, 0.1)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Feather
              name={"file-x" as any}
              size={40}
              color={isDark ? "#6b7280" : "#9ca3af"}
            />
            <Text
              style={[
                styles.missingText,
                { color: isDark ? "#6b7280" : "#9ca3af" },
              ]}
            >
              Not uploaded
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.documentActions}>
          {hasDocument && normalizedStatus !== "APPROVED" && (
            <TouchableOpacity
              style={[styles.documentActionButton, styles.approveButton]}
              onPress={() => handleDocumentReview(documentType, "APPROVED")}
              disabled={processing}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.documentActionText}>
                {t("admin.approve")}
              </Text>
            </TouchableOpacity>
          )}
          {hasDocument && normalizedStatus !== "REJECTED" && (
            <TouchableOpacity
              style={[styles.documentActionButton, styles.rejectButton]}
              onPress={() => handleDocumentReview(documentType, "REJECTED")}
              disabled={processing}
            >
              <Feather name="x" size={16} color="#fff" />
              <Text style={styles.documentActionText}>{t("admin.reject")}</Text>
            </TouchableOpacity>
          )}
          {!hasDocument && (
            <TouchableOpacity
              style={[
                styles.documentActionButton,
                styles.requestButton,
                { flex: 1 },
              ]}
              onPress={() =>
                setRequestDocumentModal({
                  visible: true,
                  documentType,
                  documentName: label,
                  reason: "",
                })
              }
              disabled={processing}
            >
              <Feather name="file-plus" size={16} color="#fff" />
              <Text style={styles.documentActionText}>
                {t("admin.request")}
              </Text>
            </TouchableOpacity>
          )}
          {hasDocument && (
            <TouchableOpacity
              style={[styles.documentActionButton, styles.requestButton]}
              onPress={() =>
                setRequestDocumentModal({
                  visible: true,
                  documentType,
                  documentName: label,
                  reason: "",
                })
              }
              disabled={processing}
            >
              <Feather name="file-plus" size={16} color="#fff" />
              <Text style={styles.documentActionText}>
                {t("admin.request")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              KYC Details
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!verification) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              KYC Details
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Verification not found
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "#22c55e";
      case "FAILED":
        return "#ef4444";
      case "MANUAL_REVIEW":
        return "#f59e0b";
      case "PENDING":
        return "#3b82f6";
      case "IN_PROGRESS":
        return "#8b5cf6";
      default:
        return "#64748b";
    }
  };

  const fullImageUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const base = getApiBase();
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            KYC Details
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {/* User Info Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.95)"
                  : "rgba(255,255,255,0.9)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {verification.user
                    ? `${verification.user.firstName || ""} ${verification.user.lastName || ""}`.trim() ||
                      t("admin.unknownUser")
                    : t("admin.unknownUser")}
                </Text>
                <Text
                  style={[
                    styles.userEmail,
                    { color: isDark ? "#cbd5e1" : "#64748b" },
                  ]}
                >
                  {verification.user?.email || "N/A"}
                </Text>
                {verification.user?.phone && (
                  <Text
                    style={[
                      styles.userEmail,
                      { color: isDark ? "#cbd5e1" : "#64748b" },
                    ]}
                  >
                    {verification.user.phone}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor(verification.status) + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(verification.status) },
                  ]}
                >
                  {verification.status.replace("_", " ")}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text }]}>
                Verification Type:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  { color: isDark ? "#cbd5e1" : "#64748b" },
                ]}
              >
                {verification.verificationType?.replace("_", " ") || "N/A"}
              </Text>
            </View>

            {verification.documentNumber && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Document Number:
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {verification.documentNumber}
                </Text>
              </View>
            )}

            {verification.documentCountry && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Country:
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {verification.documentCountry}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text }]}>
                Submitted:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {new Date(verification.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Documents Section */}
          <View style={styles.documentsContainer}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, marginBottom: 16 },
              ]}
            >
              Documents
            </Text>

            {/* ID Documents */}
            <View style={styles.documentSection}>
              <Text
                style={[styles.documentSectionTitle, { color: colors.text }]}
              >
                ID Documents (
                {verification.verificationType?.replace("_", " ") || "N/A"})
              </Text>

              {renderDocumentCard(
                t("admin.documentFront"),
                verification.documentFrontUrl,
                "documentFront",
                t("admin.documentFront"),
                false,
                verification.documentStatuses
              )}

              {renderDocumentCard(
                t("admin.documentBack"),
                verification.documentBackUrl,
                "documentBack",
                t("admin.documentBack"),
                false,
                verification.documentStatuses
              )}

              {renderDocumentCard(
                "Selfie",
                verification.selfieUrl,
                "selfie",
                "Selfie",
                false,
                verification.documentStatuses
              )}
            </View>

            {/* Driver's License Documents */}
            <View style={styles.documentSection}>
              <Text
                style={[styles.documentSectionTitle, { color: colors.text }]}
              >
                {t("admin.driversLicense")}
              </Text>
              {verification.allVerifications?.find(
                (v) => v.verificationType === "DRIVERS_LICENSE"
              ) ? (
                verification.allVerifications
                  .filter((v) => v.verificationType === "DRIVERS_LICENSE")
                  .map((dlVerification) => (
                    <View key={dlVerification.id}>
                      {renderDocumentCard(
                        t("admin.frontOfDriversLicense"),
                        dlVerification.documentFrontUrl,
                        "driversLicenseFront",
                        t("admin.frontOfDriversLicense"),
                        false,
                        dlVerification.documentStatuses
                      )}
                      {renderDocumentCard(
                        t("admin.backOfDriversLicense"),
                        dlVerification.documentBackUrl,
                        "driversLicenseBack",
                        t("admin.backOfDriversLicense"),
                        false,
                        dlVerification.documentStatuses
                      )}
                    </View>
                  ))
              ) : (
                <View
                  style={[
                    styles.emptySectionCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(107, 114, 128, 0.1)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptySectionText,
                      { color: isDark ? "#9ca3af" : "#6b7280" },
                    ]}
                  >
                    {t("admin.noDriversLicenseUploaded")}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.documentActionButton,
                      styles.requestButton,
                      { marginTop: 12 },
                    ]}
                    onPress={() =>
                      setRequestDocumentModal({
                        visible: true,
                        documentType: "driversLicense",
                        documentName: t("admin.driversLicense"),
                        reason: "",
                      })
                    }
                    disabled={processing}
                  >
                    <Feather name="file-plus" size={16} color="#fff" />
                    <Text style={styles.documentActionText}>
                      {t("admin.request")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Criminal Record */}
            {verification.backgroundCheck && (
              <View style={styles.documentSection}>
                <Text
                  style={[styles.documentSectionTitle, { color: colors.text }]}
                >
                  {t("admin.criminalRecordCertificate")}
                </Text>
                {renderDocumentCard(
                  t("admin.criminalRecord"),
                  verification.backgroundCheck.uploadedDocument,
                  "criminalRecord",
                  t("admin.criminalRecord"),
                  true, // is PDF
                  { criminalRecord: verification.backgroundCheck.status } // Use background check status
                )}
                {verification.backgroundCheck.certificateNumber && (
                  <View
                    style={[
                      styles.infoCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.1)"
                          : "rgba(59, 130, 246, 0.05)",
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.infoValue,
                        { color: isDark ? "#93c5fd" : "#2563eb" },
                      ]}
                    >
                      Certificate Number:{" "}
                      {verification.backgroundCheck.certificateNumber}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Certifications */}
            <View style={styles.documentSection}>
              <Text
                style={[styles.documentSectionTitle, { color: colors.text }]}
              >
                {t("admin.certifications")}
              </Text>
              {verification.certifications &&
              Array.isArray(verification.certifications) &&
              verification.certifications.length > 0 ? (
                verification.certifications.map((cert: any, index: number) => {
                  // Get status from documentStatuses or cert.status
                  const certStatus =
                    verification.documentStatuses &&
                    typeof verification.documentStatuses === "object" &&
                    verification.documentStatuses.certifications &&
                    Array.isArray(verification.documentStatuses.certifications)
                      ? verification.documentStatuses.certifications[index] ||
                        cert.status ||
                        "PENDING"
                      : cert.status || "PENDING";

                  return (
                    <View key={index} style={styles.certificationCard}>
                      {renderDocumentCard(
                        `${t("admin.certification")} ${index + 1}`,
                        cert.url,
                        `certification-${index}`,
                        `${t("admin.certification")} ${index + 1}`,
                        true, // is PDF
                        { [`certification-${index}`]: certStatus }
                      )}
                    </View>
                  );
                })
              ) : (
                <View
                  style={[
                    styles.emptySectionCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(107, 114, 128, 0.1)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptySectionText,
                      { color: isDark ? "#9ca3af" : "#6b7280" },
                    ]}
                  >
                    {t("admin.noCertificationsUploaded")}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.documentActionButton,
                      styles.requestButton,
                      { marginTop: 12 },
                    ]}
                    onPress={() =>
                      setRequestDocumentModal({
                        visible: true,
                        documentType: "certification",
                        documentName: t("admin.certification"),
                        reason: "",
                      })
                    }
                    disabled={processing}
                  >
                    <Feather name="file-plus" size={16} color="#fff" />
                    <Text style={styles.documentActionText}>
                      {t("admin.request")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* CV Documents */}
            <View style={styles.documentSection}>
              <Text
                style={[styles.documentSectionTitle, { color: colors.text }]}
              >
                {t("admin.cvDocuments")}
              </Text>
              {verification.cvDocuments &&
              Array.isArray(verification.cvDocuments) &&
              verification.cvDocuments.length > 0 ? (
                verification.cvDocuments.map((cv: any, index: number) => {
                  // Get status from documentStatuses or cv.status
                  const cvStatus =
                    verification.documentStatuses &&
                    typeof verification.documentStatuses === "object" &&
                    verification.documentStatuses.cvDocuments &&
                    Array.isArray(verification.documentStatuses.cvDocuments)
                      ? verification.documentStatuses.cvDocuments[index] ||
                        cv.status ||
                        "PENDING"
                      : cv.status || "PENDING";

                  return (
                    <View key={index} style={styles.certificationCard}>
                      {renderDocumentCard(
                        `${t("admin.cv")} ${index + 1}`,
                        cv.url,
                        `cv-${index}`,
                        `${t("admin.cv")} ${index + 1}`,
                        true, // is PDF
                        { [`cv-${index}`]: cvStatus }
                      )}
                    </View>
                  );
                })
              ) : (
                <View
                  style={[
                    styles.emptySectionCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(107, 114, 128, 0.1)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptySectionText,
                      { color: isDark ? "#9ca3af" : "#6b7280" },
                    ]}
                  >
                    {t("admin.noCvDocumentsUploaded")}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.documentActionButton,
                      styles.requestButton,
                      { marginTop: 12 },
                    ]}
                    onPress={() =>
                      setRequestDocumentModal({
                        visible: true,
                        documentType: "cv",
                        documentName: t("admin.cv"),
                        reason: "",
                      })
                    }
                    disabled={processing}
                  >
                    <Feather name="file-plus" size={16} color="#fff" />
                    <Text style={styles.documentActionText}>
                      {t("admin.request")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Overall Verification Action Buttons - Show for PENDING, IN_PROGRESS, or MANUAL_REVIEW */}
          {verification.status &&
            ["PENDING", "IN_PROGRESS", "MANUAL_REVIEW"].includes(
              verification.status
            ) && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleReview("VERIFIED")}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>
                        {t("admin.approve")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReview("FAILED")}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="x" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>
                        {t("admin.reject")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

          {/* Contact User */}
          {verification.user && (
            <TouchableOpacity
              style={[
                styles.contactButton,
                {
                  backgroundColor: isDark ? "#6366f1" : colors.tint,
                  borderColor: isDark ? "#6366f1" : colors.tint,
                },
              ]}
              onPress={() => {
                router.push({
                  pathname: "/chat/room",
                  params: {
                    userId: verification.user!.id,
                    userName:
                      `${verification.user!.firstName || ""} ${verification.user!.lastName || ""}`.trim() ||
                      "User",
                  },
                } as never);
              }}
              disabled={processing}
            >
              <Feather name="message-circle" size={18} color="#fff" />
              <Text style={[styles.contactButtonText, { color: "#fff" }]}>
                Contact User
              </Text>
            </TouchableOpacity>
          )}

          {/* Delete User */}
          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: isDark ? "#ef4444" : "#ef4444",
                borderColor: "#ef4444",
              },
            ]}
            onPress={handleDeleteUser}
            disabled={processing}
          >
            <Feather name="trash-2" size={18} color="#fff" />
            <Text style={[styles.deleteButtonText, { color: "#fff" }]}>
              Delete User
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Image Modal */}
        <Modal
          visible={imageModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() =>
            setImageModal({ visible: false, uri: "", title: "" })
          }
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: "rgba(0,0,0,0.95)" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{imageModal.title}</Text>
              <TouchableOpacity
                onPress={() =>
                  setImageModal({ visible: false, uri: "", title: "" })
                }
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalImageContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              <Image
                source={{ uri: imageModal.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </Modal>

        {/* Request Document Modal */}
        <Modal
          visible={requestDocumentModal.visible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setRequestDocumentModal({
              visible: false,
              documentType: "",
              documentName: "",
              reason: "",
            });
          }}
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: "rgba(0,0,0,0.7)" },
            ]}
          >
            <View
              style={[
                styles.requestModalContent,
                {
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Request {requestDocumentModal.documentName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setRequestDocumentModal({
                      visible: false,
                      documentType: "",
                      documentName: "",
                      reason: "",
                    });
                  }}
                >
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.modalLabel,
                  { color: colors.text, marginTop: 16 },
                ]}
              >
                Reason *
              </Text>
              <TextInput
                style={[
                  styles.modalTextArea,
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
                placeholder={t("admin.pleaseSpecifyWhyDocumentNeeded")}
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.5)" : "#9ca3af"
                }
                value={requestDocumentModal.reason}
                onChangeText={(text) =>
                  setRequestDocumentModal({
                    ...requestDocumentModal,
                    reason: text,
                  })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    {
                      borderColor: isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.2)",
                    },
                  ]}
                  onPress={() => {
                    setRequestDocumentModal({
                      visible: false,
                      documentType: "",
                      documentName: "",
                      reason: "",
                    });
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSubmit]}
                  onPress={handleRequestDocument}
                  disabled={processing || !requestDocumentModal.reason.trim()}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("admin.sendRequest")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  placeholder: { width: 36 },
  content: { flex: 1 },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  documentsContainer: {
    marginBottom: 16,
  },
  documentSection: {
    marginBottom: 24,
  },
  certificationCard: {
    marginBottom: 16,
  },
  documentSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  documentCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  documentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  documentCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  documentPreviewContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 12,
  },
  documentPreview: {
    width: "100%",
    height: 180,
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  previewText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  documentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  documentActionButton: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    flex: 1,
    maxWidth: "48%",
  },
  emptySectionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySectionText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  documentActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  requestButton: {
    backgroundColor: "#6366f1",
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  documentImage: {
    width: "100%",
    height: 200,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minWidth: 120,
  },
  approveButton: {
    backgroundColor: "#22c55e",
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  contactButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  contactButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    marginBottom: 32,
    alignSelf: "flex-start",
  },
  deleteButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "80%",
  },
  documentGroup: {
    marginBottom: 24,
  },
  documentGroupTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  documentItem: {
    marginBottom: 16,
  },
  documentItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  missingSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  missingTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  missingItem: {
    fontSize: 13,
    marginBottom: 4,
  },
  missingDocumentBox: {
    height: 120,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  missingText: {
    marginTop: 8,
    fontSize: 12,
  },
  pdfContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  pdfText: {
    color: "#fff",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 8,
  },
  requestModalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  modalTextArea: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 100,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  modalButtonSubmit: {
    backgroundColor: "#8b5cf6",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
