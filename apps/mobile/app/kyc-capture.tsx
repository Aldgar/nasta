import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import GradientBackground from "../components/GradientBackground";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import Constants from "expo-constants";

// Helper function to decode JWT payload
const decodeJwtPayload = (token: string) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return decoded;
  } catch {
    return null;
  }
};

type IdType = "PASSPORT" | "RESIDENCE_PERMIT" | "NATIONAL_ID" | "OTHER";
type DocumentStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "MANUAL_REVIEW"
  | "VERIFIED"
  | "FAILED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | null;

interface DocumentInfo {
  uri: string | null;
  status: DocumentStatus;
  url?: string; // Server URL if already uploaded
}

export default function KycCapture() {
  const { verificationId } = useLocalSearchParams<{ verificationId: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // ID Type selection
  const [idType, setIdType] = useState<IdType | "">("");
  const [otherIdType, setOtherIdType] = useState("");
  const [showIdTypeModal, setShowIdTypeModal] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);

  // Documents
  const [frontDoc, setFrontDoc] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });
  const [backDoc, setBackDoc] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });
  const [selfieDoc, setSelfieDoc] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });
  const [criminalRecordDoc, setCriminalRecordDoc] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });

  // Certifications (array to support multiple)
  const [certifications, setCertifications] = useState<DocumentInfo[]>([]);

  // CV documents (array to support multiple)
  const [cvDocuments, setCvDocuments] = useState<DocumentInfo[]>([]);

  // Driver's License (optional)
  const [includeDriversLicense, setIncludeDriversLicense] = useState(false);
  const [driversLicenseFront, setDriversLicenseFront] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });
  const [driversLicenseBack, setDriversLicenseBack] = useState<DocumentInfo>({
    uri: null,
    status: null,
  });
  const [driversLicenseVerificationId, setDriversLicenseVerificationId] =
    useState<string | null>(null);

  const [uploadingDocument, setUploadingDocument] = useState<
    | "front"
    | "back"
    | "selfie"
    | "driversLicenseFront"
    | "driversLicenseBack"
    | "criminalRecord"
    | `certification-${number}`
    | `cv-${number}`
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [backgroundCheckId, setBackgroundCheckId] = useState<string | null>(
    null
  );
  const [previewModal, setPreviewModal] = useState<{
    visible: boolean;
    uri: string | null;
    title: string;
    isPdf?: boolean;
  }>({ visible: false, uri: null, title: "", isPdf: false });

  // Check if back is required (only for Residence Permit and EU Citizen Card)
  const shouldShowBackOfId =
    idType === "RESIDENCE_PERMIT" || idType === "NATIONAL_ID";
  const isBackRequired = shouldShowBackOfId;

  // ID Type options
  const idTypeOptions: { value: IdType; label: string }[] = [
    { value: "PASSPORT", label: t("kyc.idType.passport") },
    { value: "RESIDENCE_PERMIT", label: t("kyc.idType.residencePermit") },
    { value: "NATIONAL_ID", label: t("kyc.idType.nationalId") },
    { value: "OTHER", label: t("kyc.idType.other") },
  ];

  // Debug: Log modal state changes
  useEffect(() => {
    console.log("Modal state changed:", showIdTypeModal);
  }, [showIdTypeModal]);

  // Fetch existing verification and background check status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token || !verificationId) {
          setLoading(false);
          return;
        }

        const base = getApiBase();

        // Fetch KYC status
        const kycRes = await fetch(`${base}/kyc/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (kycRes.ok) {
          const kycData = await kycRes.json();
          const verification = kycData?.current;

          if (verification?.id === verificationId) {
            // Set ID type from verification - ensure it persists and doesn't get reset
            if (verification.verificationType) {
              const vType = verification.verificationType as IdType;
              setIdType(vType);
              if (vType === "OTHER") {
                setShowOtherInput(true);
              } else {
                setShowOtherInput(false);
              }
            }

            // Get individual document statuses from documentStatuses object
            const documentStatuses =
              (verification.documentStatuses as Record<string, string>) || {};

            // Document URLs and individual statuses are now included in my-status response
            // Use individual document status if available, otherwise fall back to overall status
            const frontStatus = (documentStatuses["documentFront"] ||
              verification.status) as DocumentStatus;
            if (verification.documentFrontUrl) {
              setFrontDoc({
                uri: null,
                status: frontStatus,
                url: verification.documentFrontUrl,
              });
            } else {
              setFrontDoc((prev) => ({ ...prev, status: frontStatus }));
            }

            const backStatus = (documentStatuses["documentBack"] ||
              verification.status) as DocumentStatus;
            if (verification.documentBackUrl) {
              setBackDoc({
                uri: null,
                status: backStatus,
                url: verification.documentBackUrl,
              });
            } else {
              setBackDoc((prev) => ({ ...prev, status: backStatus }));
            }

            const selfieStatus = (documentStatuses["selfie"] ||
              verification.status) as DocumentStatus;
            if (verification.selfieUrl) {
              setSelfieDoc({
                uri: null,
                status: selfieStatus,
                url: verification.selfieUrl,
              });
            } else {
              setSelfieDoc((prev) => ({ ...prev, status: selfieStatus }));
            }

            // Load certifications
            if (
              verification.certifications &&
              Array.isArray(verification.certifications)
            ) {
              const certs = verification.certifications.map((cert: any) => ({
                uri: null,
                status: cert.status || null,
                url: cert.url || null,
              }));
              setCertifications(certs);
            }

            // Load CV documents
            if (
              verification.cvDocuments &&
              Array.isArray(verification.cvDocuments)
            ) {
              const cvs = verification.cvDocuments.map((cv: any) => ({
                uri: null,
                status: cv.status || null,
                url: cv.url || null,
              }));
              setCvDocuments(cvs);
            }
          }
        }

        // Check for existing driver's license verification
        const allKycRes = await fetch(`${base}/kyc/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);

        if (allKycRes?.ok) {
          const allKycData = await allKycRes.json();
          // Check all verifications for driver's license
          const allVerifications = allKycData?.allVerifications || [];
          const dlVerification = allVerifications.find(
            (v: any) => v.verificationType === "DRIVERS_LICENSE"
          );

          if (dlVerification) {
            setIncludeDriversLicense(true);
            setDriversLicenseVerificationId(dlVerification.id);
            const status = dlVerification.status;

            // Set URLs and status for driver's license documents
            setDriversLicenseFront({
              uri: null,
              url: dlVerification.documentFrontUrl,
              status,
            });
            setDriversLicenseBack({
              uri: null,
              url: dlVerification.documentBackUrl,
              status,
            });
          }
        }

        // Fetch background check status
        const bgRes = await fetch(`${base}/background-checks/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (bgRes.ok) {
          const bgData = await bgRes.json();
          const currentCheck = bgData?.currentCheck;
          if (currentCheck?.id) {
            setBackgroundCheckId(currentCheck.id);
            const status = currentCheck.status as any;
            // Set URL and status for criminal record
            setCriminalRecordDoc({
              uri: null,
              url: currentCheck.uploadedDocument,
              status,
            });
          }
        } else {
          // If no background check exists, try to initiate one
          try {
            const initiateRes = await fetch(
              `${base}/background-checks/initiate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ consent: { accepted: true } }),
              }
            );
            if (initiateRes.ok) {
              const initiateData = await initiateRes.json();
              if (initiateData.id) {
                setBackgroundCheckId(initiateData.id);
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn("Failed to fetch status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [verificationId]);

  const pickImage = async (
    setter: (doc: DocumentInfo) => void,
    useCamera = true
  ) => {
    // Check if we're in a simulator/emulator (camera not available)
    const isSimulator =
      (Platform.OS === "ios" &&
        (!Constants.isDevice || Constants.deviceName?.includes("Simulator"))) ||
      (Platform.OS === "android" &&
        (Constants.deviceName?.includes("emulator") ||
          Constants.deviceName?.includes("sdk") ||
          Constants.deviceName?.includes("Emulator")));

    // If camera is requested but we're in a simulator, automatically use file picker
    if (useCamera && isSimulator) {
      console.log("Simulator detected, using image library instead of camera");
      useCamera = false;
    }

    // Request appropriate permissions
    let perm;
    if (useCamera) {
      perm = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (perm.status !== "granted") {
      Alert.alert(t("kyc.permissionRequired"), t("kyc.pleaseAllowAccess"));
      return;
    }

    let result: ImagePicker.ImagePickerResult | undefined;
    try {
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: false,
          exif: false,
          base64: false,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: true, // Allow editing to help with format conversion
          exif: false,
          base64: false,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          selectionLimit: 1,
          aspect: [4, 3], // Standard aspect ratio
        });
      }
    } catch (error: any) {
      // If camera fails and we were trying to use camera, automatically fall back to file picker
      if (useCamera) {
        console.log(
          "Camera unavailable, automatically falling back to image library"
        );
        try {
          // Request media library permission if we don't have it
          const libPerm =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== "granted") {
            Alert.alert(
              t("kyc.permissionRequired"),
              t("kyc.pleaseAllowPhotosAccess")
            );
            return;
          }

          // Use image library instead
          result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            allowsEditing: true, // Allow editing to help with format conversion
            exif: false,
            base64: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            selectionLimit: 1,
            aspect: [4, 3], // Standard aspect ratio
          });
        } catch (fallbackError: any) {
          console.error(
            "Fallback to image library also failed:",
            fallbackError
          );
          const errorMessage =
            fallbackError?.message || t("kyc.unableToAccessCameraOrPhotos");

          // If it's a PNG loading error, suggest trying a different format
          if (
            errorMessage.includes("png") ||
            errorMessage.includes("representation")
          ) {
            Alert.alert(
              t("kyc.imageFormatError"),
              t("kyc.imageFormatErrorMessage"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("common.retry"),
                  onPress: () => pickImage(setter, false), // Retry with image library
                },
              ]
            );
          } else {
            Alert.alert(
              t("common.error"),
              t("kyc.unableToAccessCameraOrPhotos")
            );
          }
          return;
        }
      } else {
        console.error("Image library access failed:", error);
        const errorMessage =
          error?.message || t("kyc.failedToAccessPhotoLibrary");

        // If it's a PNG loading error, suggest trying a different format
        if (
          errorMessage.includes("png") ||
          errorMessage.includes("representation")
        ) {
          Alert.alert(
            t("kyc.imageFormatError"),
            t("kyc.imageFormatErrorMessage"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("common.retry"),
                onPress: () => pickImage(setter, false), // Retry
              },
            ]
          );
        } else {
          Alert.alert(t("common.error"), t("kyc.failedToAccessPhotoLibrary"));
        }
        return;
      }
    }

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];

      // Validate that we have a valid URI
      if (!asset.uri) {
        Alert.alert(t("common.error"), t("kyc.failedToLoadImage"));
        return;
      }

      // Check if the URI is accessible
      // On iOS, sometimes PNG files can't be read directly, so we validate the URI
      try {
        // The URI should be accessible, but if it's a PNG that can't be loaded,
        // we'll catch that in the upload process
        setter({ uri: asset.uri, status: null });
      } catch (setError: any) {
        console.error("Error setting image URI:", setError);
        const errorMsg = setError?.message || "";

        if (errorMsg.includes("png") || errorMsg.includes("representation")) {
          Alert.alert(
            t("kyc.imageFormatIssue"),
            t("kyc.imageFormatIssueMessage"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("kyc.tryCamera"),
                onPress: () => pickImage(setter, true), // Try camera instead
              },
            ]
          );
        } else {
          Alert.alert(t("common.error"), t("kyc.failedToProcessImage"));
        }
      }
    }
  };

  const pickDocument = async (setter: (doc: DocumentInfo) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setter({ uri: result.assets[0].uri, status: null });
      }
    } catch (err) {
      Alert.alert(t("common.error"), t("kyc.failedToPickDocument"));
    }
  };

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case "VERIFIED":
      case "APPROVED":
        return "#10b981"; // green
      case "FAILED":
        return "#ef4444"; // red
      case "MANUAL_REVIEW":
      case "UNDER_REVIEW":
      case "IN_PROGRESS":
        return "#f59e0b"; // amber
      case "PENDING":
      case "SUBMITTED":
        return "#6b7280"; // gray
      default:
        return "transparent";
    }
  };

  const getStatusLabel = (status: DocumentStatus) => {
    switch (status) {
      case "VERIFIED":
        return t("kyc.status.verified");
      case "APPROVED":
        return t("kyc.status.approved");
      case "FAILED":
        return t("kyc.status.rejected");
      case "MANUAL_REVIEW":
      case "UNDER_REVIEW":
        return t("kyc.status.underReview");
      case "IN_PROGRESS":
        return t("kyc.status.processing");
      case "PENDING":
        return t("kyc.status.pending");
      case "SUBMITTED":
        return t("kyc.status.submitted");
      default:
        return "";
    }
  };

  const uploadKycDocuments = async () => {
    if (!verificationId) {
      Alert.alert(t("kyc.missingId"), t("kyc.verificationIdNotFound"));
      return;
    }
    if (!idType) {
      Alert.alert(t("common.required"), t("kyc.pleaseSelectIdType"));
      return;
    }
    if (!frontDoc.uri || !selfieDoc.uri) {
      Alert.alert(t("common.required"), t("kyc.pleaseCaptureFrontAndSelfie"));
      return;
    }
    if (shouldShowBackOfId && !backDoc.uri) {
      Alert.alert(t("common.required"), t("kyc.backOfIdRequired"));
      return;
    }
    if (
      includeDriversLicense &&
      (!driversLicenseFront.uri || !driversLicenseBack.uri)
    ) {
      Alert.alert(t("common.required"), t("kyc.pleaseUploadBothLicenseSides"));
      return;
    }

    try {
      setUploadingDocument("front"); // Use a generic state for bulk upload
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const form = new FormData();
      const makeFile = (uri: string, name: string) =>
        ({ uri, name, type: "image/jpeg" }) as any;

      if (frontDoc.uri) {
        form.append(
          "documentFront",
          makeFile(frontDoc.uri, "document-front.jpg")
        );
      }
      if (backDoc.uri) {
        form.append("documentBack", makeFile(backDoc.uri, "document-back.jpg"));
      }
      if (selfieDoc.uri) {
        form.append("selfie", makeFile(selfieDoc.uri, "selfie.jpg"));
      }

      const res = await fetch(`${base}/kyc/${verificationId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      if (!res.ok) {
        let errorText = t("kyc.failedToUploadDocuments");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      // Update verification type if needed (only if changed)
      if (idType && idType !== "OTHER") {
        try {
          await fetch(`${base}/kyc/${verificationId}/details`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentType: idType,
            }),
          });
        } catch {}
      }

      // Refresh status after upload to get server URLs
      const statusRes = await fetch(`${base}/kyc/my-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const verification = statusData?.current;
        if (verification?.id === verificationId) {
          const status = verification.status || "PENDING";
          // Clear local URIs and set server URLs
          setFrontDoc({
            uri: null,
            url: verification.documentFrontUrl,
            status,
          });
          setBackDoc({ uri: null, url: verification.documentBackUrl, status });
          setSelfieDoc({ uri: null, url: verification.selfieUrl, status });
        }
      }

      Alert.alert(t("kyc.uploaded"), t("kyc.documentsUploadedSuccessfully"));
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadSingleDocument = async (
    documentType: "front" | "back" | "selfie",
    doc: DocumentInfo
  ) => {
    if (!verificationId) {
      Alert.alert(t("kyc.missingId"), t("kyc.verificationIdNotFound"));
      return;
    }
    if (!doc.uri) {
      Alert.alert(t("common.required"), t("kyc.pleaseSelectDocumentFirst"));
      return;
    }

    try {
      setUploadingDocument(documentType);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const form = new FormData();
      const makeFile = (uri: string, name: string) =>
        ({ uri, name, type: "image/jpeg" }) as any;

      if (documentType === "front") {
        form.append("documentFront", makeFile(doc.uri, "document-front.jpg"));
      } else if (documentType === "back") {
        form.append("documentBack", makeFile(doc.uri, "document-back.jpg"));
      } else if (documentType === "selfie") {
        form.append("selfie", makeFile(doc.uri, "selfie.jpg"));
      }

      const res = await fetch(`${base}/kyc/${verificationId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      if (!res.ok) {
        let errorText = t("kyc.failedToUploadDocument");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      // Refresh status after upload
      const statusRes = await fetch(`${base}/kyc/my-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const verification = statusData?.current;
        if (verification?.id === verificationId) {
          const status = verification.status || "PENDING";
          // Get the server URL for the uploaded document
          let serverUrl: string | undefined;
          if (documentType === "front" && verification.documentFrontUrl) {
            serverUrl = verification.documentFrontUrl;
          } else if (documentType === "back" && verification.documentBackUrl) {
            serverUrl = verification.documentBackUrl;
          } else if (documentType === "selfie" && verification.selfieUrl) {
            serverUrl = verification.selfieUrl;
          }

          // Clear local URI and set server URL and status
          if (documentType === "front") {
            setFrontDoc({ uri: null, url: serverUrl, status });
          } else if (documentType === "back") {
            setBackDoc({ uri: null, url: serverUrl, status });
          } else if (documentType === "selfie") {
            setSelfieDoc({ uri: null, url: serverUrl, status });
          }
        }
      }

      Alert.alert(t("common.success"), t("kyc.documentUploadedSuccessfully"));
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadDriversLicenseDocument = async (side: "front" | "back") => {
    const doc = side === "front" ? driversLicenseFront : driversLicenseBack;
    if (!doc.uri) {
      Alert.alert(
        t("common.required"),
        side === "front"
          ? t("kyc.pleaseSelectLicenseFront")
          : t("kyc.pleaseSelectLicenseBack")
      );
      return;
    }

    try {
      setUploadingDocument(
        side === "front" ? "driversLicenseFront" : "driversLicenseBack"
      );
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Initiate driver's license verification if not already done
      let licenseVerificationId = driversLicenseVerificationId;
      if (!licenseVerificationId) {
        const initiateRes = await fetch(`${base}/kyc/initiate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationType: "DRIVERS_LICENSE",
            consent: { accepted: true, version: "v1" },
          }),
        });

        if (!initiateRes.ok) {
          let errorText = t("kyc.failedToInitiateDriversLicenseVerification");
          try {
            errorText = await initiateRes.text();
            try {
              const errorJson = JSON.parse(errorText);
              errorText = errorJson.message || errorJson.error || errorText;
            } catch {}
          } catch {}
          throw new Error(errorText);
        }

        const initiateData = await initiateRes.json();
        licenseVerificationId = initiateData.id || initiateData._id;
        setDriversLicenseVerificationId(licenseVerificationId);
      }

      // Upload single driver's license document
      const form = new FormData();
      const makeFile = (uri: string, name: string) =>
        ({ uri, name, type: "image/jpeg" }) as any;

      if (side === "front") {
        form.append("documentFront", makeFile(doc.uri, "license-front.jpg"));
      } else {
        form.append("documentBack", makeFile(doc.uri, "license-back.jpg"));
      }

      const res = await fetch(`${base}/kyc/${licenseVerificationId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      if (!res.ok) {
        let errorText = `Failed to upload ${side} of driver's license`;
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      // Fetch the uploaded document URL
      let serverUrl: string | undefined;
      try {
        const statusRes = await fetch(`${base}/kyc/my-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          // Find the driver's license verification
          const dlVerification = statusData.allVerifications?.find(
            (v: any) => v.verificationType === "DRIVERS_LICENSE"
          );
          if (dlVerification) {
            serverUrl =
              side === "front"
                ? dlVerification.documentFrontUrl
                : dlVerification.documentBackUrl;
          }
        }
      } catch {}

      Alert.alert(
        t("kyc.uploaded"),
        side === "front"
          ? t("kyc.licenseFrontUploaded")
          : t("kyc.licenseBackUploaded")
      );

      // Update the specific document state - clear URI and set URL and status
      if (side === "front") {
        setDriversLicenseFront({
          uri: null,
          url: serverUrl,
          status: "PENDING",
        });
      } else {
        setDriversLicenseBack({ uri: null, url: serverUrl, status: "PENDING" });
      }
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadCriminalRecord = async () => {
    if (!backgroundCheckId) {
      Alert.alert(t("common.error"), t("kyc.backgroundCheckNotInitialized"));
      return;
    }
    if (!criminalRecordDoc.uri) {
      Alert.alert(t("common.required"), t("kyc.pleaseSelectCriminalRecord"));
      return;
    }

    try {
      setUploadingDocument("criminalRecord");
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const form = new FormData();

      // For PDF files, we need to get the file name from the URI or use a default
      const fileName =
        criminalRecordDoc.uri.split("/").pop() || "criminal-record.pdf";
      const makeFile = (uri: string, name: string, mimeType: string) =>
        ({ uri, name, type: mimeType }) as any;

      form.append(
        "certificate",
        makeFile(criminalRecordDoc.uri, fileName, "application/pdf")
      );

      const res = await fetch(
        `${base}/background-checks/${backgroundCheckId}/upload-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: form,
        }
      );

      if (!res.ok) {
        let errorText = t("kyc.failedToUploadCriminalRecord");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      // Get the uploaded document URL from response or fetch status
      let serverUrl: string | undefined;
      try {
        const statusRes = await fetch(
          `${base}/background-checks/${backgroundCheckId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          serverUrl = statusData.uploadedDocument;
        }
      } catch {}

      Alert.alert(
        t("kyc.uploaded"),
        t("kyc.criminalRecordUploadedSuccessfully")
      );
      setCriminalRecordDoc({
        uri: null,
        url: serverUrl,
        status: "SUBMITTED" as any,
      });
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadCertification = async (index: number) => {
    if (!verificationId) {
      Alert.alert(t("common.error"), t("kyc.verificationIdNotFound"));
      return;
    }
    const cert = certifications[index];
    if (!cert.uri) {
      Alert.alert(t("common.required"), t("kyc.pleaseSelectCertification"));
      return;
    }

    try {
      setUploadingDocument(`certification-${index}` as any);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const form = new FormData();
      const fileName =
        cert.uri.split("/").pop() || `certification-${index}.pdf`;
      const makeFile = (uri: string, name: string, mimeType: string) =>
        ({ uri, name, type: mimeType }) as any;

      form.append(
        "certification",
        makeFile(cert.uri, fileName, "application/pdf")
      );

      const res = await fetch(
        `${base}/kyc/${verificationId}/upload-certification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: form,
        }
      );

      if (!res.ok) {
        let errorText = t("kyc.failedToUploadCertification");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      const data = await res.json();
      const updatedCerts = [...certifications];
      updatedCerts[index] = { uri: null, url: data.url, status: "PENDING" };
      setCertifications(updatedCerts);
      Alert.alert(
        t("kyc.uploaded"),
        t("kyc.certificationUploadedSuccessfully")
      );
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadCvDocument = async (index: number) => {
    if (!verificationId) {
      Alert.alert(t("common.error"), t("kyc.verificationIdNotFound"));
      return;
    }
    const cv = cvDocuments[index];
    if (!cv.uri) {
      Alert.alert(t("common.required"), t("kyc.pleaseSelectCvDocument"));
      return;
    }

    try {
      setUploadingDocument(`cv-${index}` as any);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const form = new FormData();
      const fileName = cv.uri.split("/").pop() || `cv-${index}.pdf`;
      const makeFile = (uri: string, name: string, mimeType: string) =>
        ({ uri, name, type: mimeType }) as any;

      form.append("cv", makeFile(cv.uri, fileName, "application/pdf"));

      const res = await fetch(`${base}/kyc/${verificationId}/upload-cv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      if (!res.ok) {
        let errorText = t("kyc.failedToUploadCv");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {}
        } catch {}
        throw new Error(errorText);
      }

      const data = await res.json();
      const updatedCvs = [...cvDocuments];
      updatedCvs[index] = { uri: null, url: data.url, status: "PENDING" };
      setCvDocuments(updatedCvs);
      Alert.alert(t("kyc.uploaded"), t("kyc.cvUploadedSuccessfully"));
    } catch (e) {
      Alert.alert(t("kyc.uploadFailed"), (e as Error).message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const addCertification = () => {
    setCertifications([...certifications, { uri: null, status: null }]);
  };

  const removeCertification = (index: number) => {
    const updated = certifications.filter((_, i) => i !== index);
    setCertifications(updated);
  };

  const addCvDocument = () => {
    setCvDocuments([...cvDocuments, { uri: null, status: null }]);
  };

  const removeCvDocument = (index: number) => {
    const updated = cvDocuments.filter((_, i) => i !== index);
    setCvDocuments(updated);
  };

  const renderDocumentCard = (
    title: string,
    doc: DocumentInfo,
    setter: (doc: DocumentInfo) => void,
    required = false,
    documentType?: "front" | "back" | "selfie"
  ) => {
    const hasLocalImage = !!doc.uri;
    const hasUploadedImage = !!doc.url && !doc.uri; // Uploaded but no local selection
    const isUploaded = hasUploadedImage;
    const isUploading = documentType && uploadingDocument === documentType;

    // If doc.url is already a full URL, use it; otherwise construct it
    // Add validation to ensure we have a valid URI
    let imageUri: string | null = null;
    if (doc.uri) {
      imageUri = doc.uri;
    } else if (doc.url) {
      if (doc.url.startsWith("http://") || doc.url.startsWith("https://")) {
        imageUri = doc.url;
      } else {
        const base = getApiBase();
        const cleanUrl = doc.url.startsWith("/") ? doc.url : `/${doc.url}`;
        imageUri = `${base}${cleanUrl}`;
      }
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {title} {required && <Text style={styles.required}>*</Text>}
          </Text>
          {doc.status && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(doc.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(doc.status)}
              </Text>
            </View>
          )}
        </View>

        {/* Show preview button if uploaded, full image if local selection */}
        {isUploaded && imageUri ? (
          <TouchableOpacity
            style={[
              styles.previewButton,
              {
                backgroundColor: isDark
                  ? "rgba(99, 102, 241, 0.25)"
                  : "rgba(79, 70, 229, 0.15)",
                borderColor: isDark
                  ? "rgba(99, 102, 241, 0.6)"
                  : "rgba(79, 70, 229, 0.4)",
              },
            ]}
            onPress={() => {
              // Check if it's a PDF (criminal record) or image
              const isPdf =
                imageUri.toLowerCase().endsWith(".pdf") ||
                imageUri.includes("application/pdf");
              setPreviewModal({
                visible: true,
                uri: imageUri,
                title: title,
                isPdf,
              });
            }}
          >
            <View style={styles.previewButtonContent}>
              <Feather name="eye" size={20} color={colors.tint} />
              <Text style={[styles.previewButtonText, { color: colors.tint }]}>
                {t("kyc.viewUploadedDocument")}
              </Text>
            </View>
          </TouchableOpacity>
        ) : hasLocalImage &&
          imageUri &&
          (imageUri.startsWith("http://") ||
            imageUri.startsWith("https://") ||
            imageUri.startsWith("file://") ||
            imageUri.startsWith("content://")) ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.preview}
            onError={(error) => {
              console.warn("Image load error:", error.nativeEvent.error);
            }}
          />
        ) : hasLocalImage && imageUri ? (
          <Text style={styles.cardText}>{t("kyc.invalidImageUri")}</Text>
        ) : (
          <Text style={styles.cardText}>{t("kyc.noDocumentUploaded")}</Text>
        )}

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => pickImage(setter, true)}
          >
            <Text style={styles.buttonLabel}>{t("kyc.useCamera")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => pickImage(setter, false)}
          >
            <Text style={styles.buttonLabel}>{t("kyc.pickFile")}</Text>
          </TouchableOpacity>
        </View>

        {/* Upload button - show if local image selected OR if already uploaded (to allow re-upload) */}
        {documentType && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonPrimary,
              styles.uploadButton,
              isUploading && { opacity: 0.7 },
            ]}
            onPress={() => {
              if (hasLocalImage) {
                // Upload the selected document
                uploadSingleDocument(documentType, doc);
              } else if (isUploaded) {
                // If already uploaded, allow selecting new document to replace
                pickImage(setter, false);
              }
            }}
            disabled={isUploading || (!hasLocalImage && !isUploaded)}
          >
            <Text style={styles.buttonLabel}>
              {isUploading
                ? t("kyc.uploading")
                : isUploaded
                  ? t("kyc.uploadAnotherDocument")
                  : hasLocalImage
                    ? t("kyc.upload")
                    : t("kyc.noDocumentSelected")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t("common.loading")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={async () => {
              // Navigate to appropriate home screen based on user role
              try {
                const token = await SecureStore.getItemAsync("auth_token");
                if (token) {
                  const payload = decodeJwtPayload(token);
                  if (payload) {
                    const role = String(payload?.role || "").toUpperCase();
                    if (role === "EMPLOYER") {
                      router.push("/employer-home" as any);
                      return;
                    } else if (role === "ADMIN") {
                      router.push("/admin-home" as any);
                      return;
                    } else {
                      router.push("/user-home" as any);
                      return;
                    }
                  }
                }
              } catch (err) {
                console.warn("Error navigating back:", err);
              }
              // Fallback: try to go back, or navigate to user-home
              try {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push("/user-home" as any);
                }
              } catch {
                // If all else fails, try to navigate to tabs
                router.push("/(tabs)" as any);
              }
            }}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Text style={styles.title}>{t("kyc.captureYourDocuments")}</Text>
            <Text style={styles.subtitle}>
              {t("kyc.uploadDocumentsSubtitle")}
            </Text>

            {/* ID Type Selection */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {t("kyc.idType")} <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => {
                  console.log(
                    "Dropdown pressed, opening modal. Current state:",
                    showIdTypeModal
                  );
                  setShowIdTypeModal(true);
                  console.log("Modal state set to true");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !idType && { color: "rgba(255,255,255,0.5)" },
                  ]}
                >
                  {idType
                    ? idTypeOptions.find((opt) => opt.value === idType)?.label
                    : t("kyc.selectIdType")}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.text} />
              </TouchableOpacity>

              {showOtherInput && (
                <TextInput
                  style={styles.otherInput}
                  placeholder={t("kyc.specifyDocumentType")}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={otherIdType}
                  onChangeText={setOtherIdType}
                />
              )}
            </View>

            {/* ID Documents */}
            {idType && (
              <>
                {renderDocumentCard(
                  t("kyc.frontOfId"),
                  frontDoc,
                  setFrontDoc,
                  true,
                  "front"
                )}
                {shouldShowBackOfId &&
                  renderDocumentCard(
                    t("kyc.backOfId"),
                    backDoc,
                    setBackDoc,
                    true,
                    "back"
                  )}
              </>
            )}

            {/* Selfie */}
            {renderDocumentCard(
              t("kyc.selfie"),
              selfieDoc,
              setSelfieDoc,
              true,
              "selfie"
            )}

            {/* Driver's License Section (Optional) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {t("kyc.driversLicenseOptional")}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newValue = !includeDriversLicense;
                    setIncludeDriversLicense(newValue);
                    if (!newValue) {
                      // Clear documents when toggling off
                      setDriversLicenseFront({ uri: null, status: null });
                      setDriversLicenseBack({ uri: null, status: null });
                    }
                  }}
                  style={styles.toggle}
                >
                  <View
                    style={[
                      styles.toggleTrack,
                      includeDriversLicense && styles.toggleTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        includeDriversLicense && styles.toggleThumbActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
              {includeDriversLicense && (
                <>
                  <Text style={[styles.cardText, { marginBottom: 12 }]}>
                    {t("kyc.driversLicenseDescription")}
                  </Text>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>
                        {t("kyc.frontOfDriversLicense")} *
                      </Text>
                      {driversLicenseFront.status && (
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: getStatusColor(
                                driversLicenseFront.status
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {getStatusLabel(driversLicenseFront.status)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {driversLicenseFront.url && !driversLicenseFront.uri ? (
                      <TouchableOpacity
                        style={[
                          styles.previewButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(99, 102, 241, 0.25)"
                              : "rgba(79, 70, 229, 0.15)",
                            borderColor: isDark
                              ? "rgba(99, 102, 241, 0.6)"
                              : "rgba(79, 70, 229, 0.4)",
                          },
                        ]}
                        onPress={() => {
                          const fullUrl = driversLicenseFront.url?.startsWith(
                            "http"
                          )
                            ? driversLicenseFront.url
                            : `${getApiBase()}${driversLicenseFront.url?.startsWith("/") ? "" : "/"}${driversLicenseFront.url}`;
                          setPreviewModal({
                            visible: true,
                            uri: fullUrl,
                            title: t("kyc.frontOfDriversLicense"),
                            isPdf: false,
                          });
                        }}
                      >
                        <View style={styles.previewButtonContent}>
                          <Feather name="eye" size={20} color={colors.tint} />
                          <Text
                            style={[
                              styles.previewButtonText,
                              { color: colors.tint },
                            ]}
                          >
                            View Uploaded Document
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : driversLicenseFront.uri ? (
                      <Image
                        source={{ uri: driversLicenseFront.uri }}
                        style={styles.preview}
                      />
                    ) : (
                      <Text style={styles.cardText}>
                        {t("kyc.noDocumentUploaded")}
                      </Text>
                    )}
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => pickImage(setDriversLicenseFront, true)}
                      >
                        <Text style={styles.buttonLabel}>Use Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => pickImage(setDriversLicenseFront, false)}
                      >
                        <Text style={styles.buttonLabel}>
                          {t("kyc.pickFile")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {(driversLicenseFront.uri ||
                      (driversLicenseFront.url &&
                        !driversLicenseFront.uri)) && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.buttonPrimary,
                          styles.uploadButton,
                          uploadingDocument === "driversLicenseFront" && {
                            opacity: 0.7,
                          },
                        ]}
                        onPress={() => {
                          if (driversLicenseFront.uri) {
                            uploadDriversLicenseDocument("front");
                          } else {
                            pickImage(setDriversLicenseFront, false);
                          }
                        }}
                        disabled={uploadingDocument === "driversLicenseFront"}
                      >
                        <Text style={styles.buttonLabel}>
                          {uploadingDocument === "driversLicenseFront"
                            ? t("kyc.uploading")
                            : driversLicenseFront.url &&
                                !driversLicenseFront.uri
                              ? t("kyc.uploadAnotherDocument")
                              : t("kyc.upload")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>
                        {t("kyc.backOfDriversLicense")} *
                      </Text>
                      {driversLicenseBack.status && (
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: getStatusColor(
                                driversLicenseBack.status
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {getStatusLabel(driversLicenseBack.status)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {driversLicenseBack.url && !driversLicenseBack.uri ? (
                      <TouchableOpacity
                        style={[
                          styles.previewButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(99, 102, 241, 0.25)"
                              : "rgba(79, 70, 229, 0.15)",
                            borderColor: isDark
                              ? "rgba(99, 102, 241, 0.6)"
                              : "rgba(79, 70, 229, 0.4)",
                          },
                        ]}
                        onPress={() => {
                          if (!driversLicenseBack.url) return;
                          const fullUrl =
                            driversLicenseBack.url.startsWith("http://") ||
                            driversLicenseBack.url.startsWith("https://")
                              ? driversLicenseBack.url
                              : `${getApiBase()}${driversLicenseBack.url.startsWith("/") ? "" : "/"}${driversLicenseBack.url}`;
                          setPreviewModal({
                            visible: true,
                            uri: fullUrl,
                            title: t("kyc.backOfDriversLicense"),
                            isPdf: false,
                          });
                        }}
                      >
                        <View style={styles.previewButtonContent}>
                          <Feather name="eye" size={20} color={colors.tint} />
                          <Text
                            style={[
                              styles.previewButtonText,
                              { color: colors.tint },
                            ]}
                          >
                            View Uploaded Document
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : driversLicenseBack.uri ? (
                      <Image
                        source={{ uri: driversLicenseBack.uri }}
                        style={styles.preview}
                      />
                    ) : (
                      <Text style={styles.cardText}>
                        {t("kyc.noDocumentUploaded")}
                      </Text>
                    )}
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => pickImage(setDriversLicenseBack, true)}
                      >
                        <Text style={styles.buttonLabel}>Use Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => pickImage(setDriversLicenseBack, false)}
                      >
                        <Text style={styles.buttonLabel}>
                          {t("kyc.pickFile")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {(driversLicenseBack.uri ||
                      (driversLicenseBack.url && !driversLicenseBack.uri)) && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.buttonPrimary,
                          styles.uploadButton,
                          uploadingDocument === "driversLicenseBack" && {
                            opacity: 0.7,
                          },
                        ]}
                        onPress={() => {
                          if (driversLicenseBack.uri) {
                            uploadDriversLicenseDocument("back");
                          } else {
                            pickImage(setDriversLicenseBack, false);
                          }
                        }}
                        disabled={uploadingDocument === "driversLicenseBack"}
                      >
                        <Text style={styles.buttonLabel}>
                          {uploadingDocument === "driversLicenseBack"
                            ? t("kyc.uploading")
                            : driversLicenseBack.url && !driversLicenseBack.uri
                              ? t("kyc.uploadAnotherDocument")
                              : t("kyc.upload")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Criminal Record */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {t("kyc.criminalRecordCertificate")}
                </Text>
                {criminalRecordDoc.status && (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(
                          criminalRecordDoc.status
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(criminalRecordDoc.status)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Show preview button if uploaded, otherwise show selection UI */}
              {criminalRecordDoc.url && !criminalRecordDoc.uri ? (
                <TouchableOpacity
                  style={[
                    styles.previewButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.25)"
                        : "rgba(79, 70, 229, 0.15)",
                      borderColor: isDark
                        ? "rgba(99, 102, 241, 0.6)"
                        : "rgba(79, 70, 229, 0.4)",
                    },
                  ]}
                  onPress={() => {
                    if (!criminalRecordDoc.url) return;
                    const fullUrl =
                      criminalRecordDoc.url.startsWith("http://") ||
                      criminalRecordDoc.url.startsWith("https://")
                        ? criminalRecordDoc.url
                        : `${getApiBase()}${criminalRecordDoc.url.startsWith("/") ? "" : "/"}${criminalRecordDoc.url}`;
                    setPreviewModal({
                      visible: true,
                      uri: fullUrl,
                      title: t("kyc.criminalRecordCertificate"),
                      isPdf: true,
                    });
                  }}
                >
                  <View style={styles.previewButtonContent}>
                    <Feather name="file-text" size={20} color={colors.tint} />
                    <Text
                      style={[styles.previewButtonText, { color: colors.tint }]}
                    >
                      View Uploaded Document
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : criminalRecordDoc.uri ? (
                <Text style={styles.cardText}>
                  {t("kyc.pdfDocumentSelected")}
                </Text>
              ) : (
                <Text style={styles.cardText}>
                  {t("kyc.noDocumentUploaded")}
                </Text>
              )}

              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => pickDocument(setCriminalRecordDoc)}
                >
                  <Text style={styles.buttonLabel}>{t("kyc.pickPdfFile")}</Text>
                </TouchableOpacity>
              </View>

              {/* Upload Button for Criminal Record */}
              {(criminalRecordDoc.uri ||
                (criminalRecordDoc.url && !criminalRecordDoc.uri)) && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    styles.uploadButton,
                    uploadingDocument === "criminalRecord" && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    if (criminalRecordDoc.uri) {
                      uploadCriminalRecord();
                    } else {
                      // If already uploaded, allow selecting new document
                      pickDocument(setCriminalRecordDoc);
                    }
                  }}
                  disabled={uploadingDocument === "criminalRecord"}
                >
                  <Text style={styles.buttonLabel}>
                    {uploadingDocument === "criminalRecord"
                      ? t("kyc.uploading")
                      : criminalRecordDoc.url && !criminalRecordDoc.uri
                        ? t("kyc.uploadAnotherDocument")
                        : t("kyc.uploadCriminalRecord")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Certifications Section */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t("kyc.certifications")}</Text>
              </View>
              <Text style={[styles.cardText, { marginBottom: 12 }]}>
                {t("kyc.certificationsDescription")}
              </Text>

              {certifications.map((cert, index) => (
                <View
                  key={index}
                  style={[styles.card, { marginBottom: 12, marginTop: 0 }]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      {t("kyc.certification")} {index + 1}
                    </Text>
                    {cert.status && (
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(cert.status) },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {getStatusLabel(cert.status)}
                        </Text>
                      </View>
                    )}
                    {certifications.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeCertification(index)}
                        style={styles.removeButton}
                      >
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {cert.url && !cert.uri ? (
                    <TouchableOpacity
                      style={[
                        styles.previewButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(99, 102, 241, 0.25)"
                            : "rgba(79, 70, 229, 0.15)",
                          borderColor: isDark
                            ? "rgba(99, 102, 241, 0.6)"
                            : "rgba(79, 70, 229, 0.4)",
                        },
                      ]}
                      onPress={() => {
                        if (!cert.url) return;
                        const fullUrl =
                          cert.url.startsWith("http://") ||
                          cert.url.startsWith("https://")
                            ? cert.url
                            : `${getApiBase()}${cert.url.startsWith("/") ? "" : "/"}${cert.url}`;
                        setPreviewModal({
                          visible: true,
                          uri: fullUrl,
                          title: `${t("kyc.certification")} ${index + 1}`,
                          isPdf: true,
                        });
                      }}
                    >
                      <View style={styles.previewButtonContent}>
                        <Feather
                          name="file-text"
                          size={20}
                          color={colors.tint}
                        />
                        <Text
                          style={[
                            styles.previewButtonText,
                            { color: colors.tint },
                          ]}
                        >
                          View Uploaded Document
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : cert.uri ? (
                    <Text style={styles.cardText}>
                      {t("kyc.pdfDocumentSelected")}
                    </Text>
                  ) : (
                    <Text style={styles.cardText}>
                      {t("kyc.noDocumentUploaded")}
                    </Text>
                  )}

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => {
                        const updated = [...certifications];
                        pickDocument((doc) => {
                          updated[index] = doc;
                          setCertifications(updated);
                        });
                      }}
                    >
                      <Text style={styles.buttonLabel}>
                        {t("kyc.pickPdfFile")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {(cert.uri || (cert.url && !cert.uri)) && (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        styles.uploadButton,
                        uploadingDocument === `certification-${index}` && {
                          opacity: 0.7,
                        },
                      ]}
                      onPress={() => {
                        if (cert.uri) {
                          uploadCertification(index);
                        } else {
                          pickDocument((doc) => {
                            const updated = [...certifications];
                            updated[index] = doc;
                            setCertifications(updated);
                          });
                        }
                      }}
                      disabled={uploadingDocument === `certification-${index}`}
                    >
                      <Text style={styles.buttonLabel}>
                        {uploadingDocument === `certification-${index}`
                          ? t("kyc.uploading")
                          : cert.url && !cert.uri
                            ? t("kyc.uploadAnotherDocument")
                            : t("kyc.uploadCertification")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={addCertification}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={colors.tint}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.buttonLabel, { color: colors.tint }]}>
                  {t("kyc.addAnotherCertification")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* CV Documents Section */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t("kyc.cvResume")}</Text>
              </View>
              <Text style={[styles.cardText, { marginBottom: 12 }]}>
                {t("kyc.cvResumeDescription")}
              </Text>

              {cvDocuments.map((cv, index) => (
                <View
                  key={index}
                  style={[styles.card, { marginBottom: 12, marginTop: 0 }]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>CV {index + 1}</Text>
                    {cv.status && (
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(cv.status) },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {getStatusLabel(cv.status)}
                        </Text>
                      </View>
                    )}
                    {cvDocuments.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeCvDocument(index)}
                        style={styles.removeButton}
                      >
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {cv.url && !cv.uri ? (
                    <TouchableOpacity
                      style={[
                        styles.previewButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(99, 102, 241, 0.25)"
                            : "rgba(79, 70, 229, 0.15)",
                          borderColor: isDark
                            ? "rgba(99, 102, 241, 0.6)"
                            : "rgba(79, 70, 229, 0.4)",
                        },
                      ]}
                      onPress={() => {
                        if (!cv.url) return;
                        const fullUrl =
                          cv.url.startsWith("http://") ||
                          cv.url.startsWith("https://")
                            ? cv.url
                            : `${getApiBase()}${cv.url.startsWith("/") ? "" : "/"}${cv.url}`;
                        setPreviewModal({
                          visible: true,
                          uri: fullUrl,
                          title: `${t("kyc.cv")} ${index + 1}`,
                          isPdf: true,
                        });
                      }}
                    >
                      <View style={styles.previewButtonContent}>
                        <Feather
                          name="file-text"
                          size={20}
                          color={colors.tint}
                        />
                        <Text
                          style={[
                            styles.previewButtonText,
                            { color: colors.tint },
                          ]}
                        >
                          View Uploaded Document
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : cv.uri ? (
                    <Text style={styles.cardText}>
                      {t("kyc.pdfDocumentSelected")}
                    </Text>
                  ) : (
                    <Text style={styles.cardText}>
                      {t("kyc.noDocumentUploaded")}
                    </Text>
                  )}

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => {
                        const updated = [...cvDocuments];
                        pickDocument((doc) => {
                          updated[index] = doc;
                          setCvDocuments(updated);
                        });
                      }}
                    >
                      <Text style={styles.buttonLabel}>
                        {t("kyc.pickPdfFile")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {(cv.uri || (cv.url && !cv.uri)) && (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        styles.uploadButton,
                        uploadingDocument === `cv-${index}` && { opacity: 0.7 },
                      ]}
                      onPress={() => {
                        if (cv.uri) {
                          uploadCvDocument(index);
                        } else {
                          pickDocument((doc) => {
                            const updated = [...cvDocuments];
                            updated[index] = doc;
                            setCvDocuments(updated);
                          });
                        }
                      }}
                      disabled={uploadingDocument === `cv-${index}`}
                    >
                      <Text style={styles.buttonLabel}>
                        {uploadingDocument === `cv-${index}`
                          ? t("kyc.uploading")
                          : cv.url && !cv.uri
                            ? t("kyc.uploadAnotherDocument")
                            : t("kyc.uploadCv")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={addCvDocument}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={colors.tint}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.buttonLabel, { color: colors.tint }]}>
                  {t("kyc.addAnotherCv")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Document Preview Modal */}
        <Modal
          visible={previewModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() =>
            setPreviewModal({
              visible: false,
              uri: null,
              title: "",
              isPdf: false,
            })
          }
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: "rgba(0,0,0,0.95)" },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <View
                style={[
                  styles.modalHeader,
                  { paddingHorizontal: 20, paddingTop: 20 },
                ]}
              >
                <TouchableOpacity
                  onPress={() =>
                    setPreviewModal({
                      visible: false,
                      uri: null,
                      title: "",
                      isPdf: false,
                    })
                  }
                  style={styles.modalBackButton}
                >
                  <Feather name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: "#fff", flex: 1, textAlign: "center" },
                  ]}
                >
                  {previewModal.title}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setPreviewModal({
                      visible: false,
                      uri: null,
                      title: "",
                      isPdf: false,
                    })
                  }
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {previewModal.isPdf && previewModal.uri ? (
                <View style={styles.previewModalContent}>
                  <View
                    style={[
                      styles.pdfPreviewContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(30, 41, 59, 0.8)"
                          : "rgba(255,255,255,0.1)",
                      },
                    ]}
                  >
                    <Feather name="file-text" size={64} color={colors.tint} />
                    <Text style={[styles.pdfPreviewText, { color: "#fff" }]}>
                      {t("kyc.pdfDocument")}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.openPdfButton,
                        {
                          backgroundColor: isDark ? "#6366f1" : "#4f46e5",
                          borderWidth: 1,
                          borderColor: isDark ? "#6366f1" : "#4f46e5",
                        },
                      ]}
                      onPress={async () => {
                        try {
                          const fullUrl = previewModal.uri?.startsWith("http")
                            ? previewModal.uri
                            : `${getApiBase()}${previewModal.uri?.startsWith("/") ? "" : "/"}${previewModal.uri}`;
                          await Linking.openURL(fullUrl);
                        } catch (err) {
                          Alert.alert(
                            t("common.error"),
                            t("kyc.couldNotOpenPdf")
                          );
                        }
                      }}
                    >
                      <Feather name="external-link" size={18} color="#fff" />
                      <Text style={styles.openPdfButtonText}>
                        {t("kyc.openPdfInBrowser")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : previewModal.uri &&
                (previewModal.uri.startsWith("http://") ||
                  previewModal.uri.startsWith("https://") ||
                  previewModal.uri.startsWith("file://") ||
                  previewModal.uri.startsWith("content://")) ? (
                <ScrollView
                  contentContainerStyle={styles.previewModalImageContainer}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                >
                  <Image
                    source={{ uri: previewModal.uri }}
                    style={styles.previewModalImage}
                    resizeMode="contain"
                    onError={(error) => {
                      console.warn(
                        "Image load error:",
                        error.nativeEvent.error
                      );
                    }}
                  />
                </ScrollView>
              ) : previewModal.uri ? (
                <View style={styles.previewModalImageContainer}>
                  <Text style={{ color: "#fff", textAlign: "center" }}>
                    {t("kyc.invalidImageUri")}
                  </Text>
                </View>
              ) : null}

              {/* Back Button at Bottom */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.modalBackButtonBottom,
                    {
                      backgroundColor: isDark ? "#6366f1" : "#4f46e5",
                      borderWidth: 1,
                      borderColor: isDark ? "#6366f1" : "#4f46e5",
                    },
                  ]}
                  onPress={() =>
                    setPreviewModal({
                      visible: false,
                      uri: null,
                      title: "",
                      isPdf: false,
                    })
                  }
                >
                  <Feather name="arrow-left" size={20} color="#fff" />
                  <Text style={[styles.modalBackButtonText, { color: "#fff" }]}>
                    {t("common.back")}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>

      {/* ID Type Modal - Outside SafeAreaView for proper rendering */}
      <Modal
        visible={showIdTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log("Modal onRequestClose called");
          setShowIdTypeModal(false);
        }}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              console.log("Overlay background pressed, closing modal");
              setShowIdTypeModal(false);
            }}
          />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#1f2937" : "#fff" },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.modalHeader} pointerEvents="auto">
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("kyc.selectIdType")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  console.log("Close button pressed");
                  setShowIdTypeModal(false);
                }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              pointerEvents="auto"
            >
              {idTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => {
                    console.log("Option selected:", option.value);
                    setIdType(option.value);
                    setShowOtherInput(option.value === "OTHER");
                    setShowIdTypeModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.modalOptionText, { color: colors.text }]}
                  >
                    {option.label}
                  </Text>
                  {idType === option.value && (
                    <Feather name="check" size={20} color={colors.tint} />
                  )}
                </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { paddingBottom: 24 },
  container: { paddingTop: 12, paddingHorizontal: 20 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: "#9ca3af", marginBottom: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(17,24,39,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  required: {
    color: "#ef4444",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardText: { color: "rgba(255,255,255,0.8)", marginBottom: 10 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.25)",
    marginTop: 8,
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  buttonPrimary: {
    backgroundColor: "#2563eb",
    borderColor: "#1d4ed8",
    marginTop: 8,
  },
  buttonLabel: { color: "#fff", fontWeight: "700" },
  uploadButton: {
    marginTop: 8,
  },
  preview: { width: "100%", height: 180, borderRadius: 10, marginTop: 8 },
  previewButton: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.5)",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  previewButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggle: {
    marginLeft: 12,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: "#2563eb",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: "flex-start",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 8,
  },
  dropdownText: {
    color: "#fff",
    fontSize: 16,
    flex: 1,
  },
  otherInput: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
    minHeight: 200,
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalBackButtonBottom: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalBackButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  modalOptionText: {
    fontSize: 16,
  },
  previewModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  previewModalImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  previewModalImage: {
    width: "100%",
    height: "80%",
    borderRadius: 12,
  },
  pdfPreviewContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    width: "100%",
  },
  pdfPreviewText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  openPdfButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  openPdfButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
