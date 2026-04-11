import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  type AlertButton,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

type IssueType =
  | "GENERAL"
  | "REPORT"
  | "BILLING"
  | "ACCOUNT"
  | "VERIFICATION"
  | null;

interface AttachedFile {
  uri: string;
  name: string;
  type: "image" | "document";
  mimeType?: string;
}

interface IssueFormData {
  description: string;
  // Bug report fields
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  // Payment fields
  transactionId?: string;
  amount?: string;
  // Login fields
  email?: string;
  whenStarted?: string;
  // Verification fields
  verificationType?: string;
}

const MAX_ATTACHMENTS = 5;

const getIssueTypes = (t: any) => [
  { label: t("support.generalSupport"), value: "GENERAL" as IssueType },
  { label: t("support.reportBug"), value: "REPORT" as IssueType },
  { label: t("support.paymentIssues"), value: "BILLING" as IssueType },
  { label: t("support.loginIssues"), value: "ACCOUNT" as IssueType },
  {
    label: t("support.verificationIssues"),
    value: "VERIFICATION" as IssueType,
  },
];

const getVerificationTypes = (t: any) => [
  t("support.emailVerification"),
  t("support.phoneVerification"),
  t("support.idVerification"),
  t("support.backgroundCheck"),
];

export default function SupportScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [issueType, setIssueType] = useState<IssueType>(null);
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [formData, setFormData] = useState<IssueFormData>({
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUserEmail(data.email || null);
        const fullName =
          `${data.firstName || ""} ${data.lastName || ""}`.trim();
        setUserName(fullName || data.email || null);
        // Pre-fill email for login issues
        if (data.email) {
          setFormData((prev) => ({ ...prev, email: data.email }));
        }
      }
    } catch (err) {
      console.log("Error fetching user info:", err);
    }
  };

  const updateFormData = (field: keyof IssueFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // File upload functions
  const takePhoto = async () => {
    try {
      if (attachedFiles.length >= MAX_ATTACHMENTS) {
        Alert.alert(
          t("common.error"),
          t("support.maximumAttachmentsReached", { count: MAX_ATTACHMENTS }),
        );
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("support.permissionRequired"),
          t("support.pleaseAllowCameraAccess"),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedFiles((prev) => [
          ...prev,
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            type: "image",
            mimeType: "image/jpeg",
          },
        ]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert(t("common.error"), t("support.failedToTakePhoto"));
    }
  };

  const pickImage = async () => {
    try {
      if (attachedFiles.length >= MAX_ATTACHMENTS) {
        Alert.alert(
          t("common.error"),
          t("support.maximumAttachmentsReached", { count: MAX_ATTACHMENTS }),
        );
        return;
      }

      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("support.permissionRequired"),
          t("support.pleaseAllowPhotosAccess"),
        );
        return;
      }

      const remainingSlots = Math.max(
        0,
        MAX_ATTACHMENTS - attachedFiles.length,
      );

      const tryPick = async (opts: any) =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          ...opts,
        });

      let result: ImagePicker.ImagePickerResult;
      try {
        // iOS: multi-select can fail when Photos can't export a usable representation.
        // We keep it single-select and allow repeated picks to attach multiple images.
        if (Platform.OS === "ios") {
          result = await tryPick({
            allowsMultipleSelection: false,
            selectionLimit: 1,
            allowsEditing: false,
            preferredAssetRepresentationMode: "compatible",
          });
        } else {
          result = await tryPick({
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
            allowsEditing: false,
          });
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        // Fallback: retry with a different representation mode.
        if (
          Platform.OS === "ios" &&
          msg.includes("Cannot load representation")
        ) {
          result = await tryPick({
            allowsMultipleSelection: false,
            selectionLimit: 1,
            allowsEditing: false,
            preferredAssetRepresentationMode: "current",
          });
        } else {
          throw e;
        }
      }

      if (!result.canceled && result.assets) {
        const newFiles: AttachedFile[] = result.assets
          .slice(0, remainingSlots)
          .map((asset, i) => ({
            uri: asset.uri,
            name:
              asset.fileName ||
              `image_${Date.now()}_${i}_${Math.random().toString(16).slice(2, 8)}.jpg`,
            type: "image" as const,
            mimeType: asset.mimeType || "image/jpeg",
          }));
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(t("common.error"), t("support.failedToPickImage"));
    }
  };

  const pickDocument = async () => {
    try {
      if (attachedFiles.length >= MAX_ATTACHMENTS) {
        Alert.alert(
          t("common.error"),
          t("support.maximumAttachmentsReached", { count: MAX_ATTACHMENTS }),
        );
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const remainingSlots = Math.max(
          0,
          MAX_ATTACHMENTS - attachedFiles.length,
        );
        const newFiles: AttachedFile[] = result.assets
          .slice(0, remainingSlots)
          .map((asset, i) => ({
            uri: asset.uri,
            name:
              asset.name ||
              `file_${Date.now()}_${i}_${Math.random().toString(16).slice(2, 8)}`,
            type: "document" as const,
            mimeType: asset.mimeType || "application/octet-stream",
          }));
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert(t("common.error"), t("support.failedToPickDocument"));
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (!issueType) {
      Alert.alert(t("common.required"), t("support.pleaseSelectIssueType"));
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert(t("common.required"), t("support.pleaseDescribeIssue"));
      return;
    }

    // Issue-specific validation
    if (issueType === "REPORT") {
      if (!formData.stepsToReproduce?.trim()) {
        Alert.alert(
          t("common.required"),
          t("support.pleaseProvideStepsToReproduce"),
        );
        return;
      }
    }

    if (issueType === "ACCOUNT" && !formData.email?.trim()) {
      Alert.alert(t("common.required"), t("support.pleaseProvideEmailAddress"));
      return;
    }

    try {
      setSubmitting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      const base = getApiBase();

      // Build the message with all form data
      let message = formData.description;
      const ISSUE_TYPES = getIssueTypes(t);

      if (issueType === "REPORT") {
        message += `\n\n${t("support.stepsToReproduce")}:\n${formData.stepsToReproduce || t("support.notAvailable")}`;
        message += `\n\n${t("support.expectedBehavior")}:\n${formData.expectedBehavior || t("support.notAvailable")}`;
        message += `\n\n${t("support.actualBehavior")}:\n${formData.actualBehavior || t("support.notAvailable")}`;
      } else if (issueType === "BILLING") {
        if (formData.transactionId) {
          message += `\n\n${t("support.transactionId")}: ${formData.transactionId}`;
        }
        if (formData.amount) {
          message += `\n\n${t("support.amount")}: ${formData.amount}`;
        }
      } else if (issueType === "ACCOUNT") {
        message += `\n\n${t("auth.email")}: ${formData.email || t("support.notAvailable")}`;
        if (formData.whenStarted) {
          message += `\n\n${t("support.whenDidThisStart")}: ${formData.whenStarted}`;
        }
      } else if (issueType === "VERIFICATION") {
        if (formData.verificationType) {
          message += `\n\n${t("support.verificationType")}: ${formData.verificationType}`;
        }
      }

      // Determine priority based on issue type
      const priority =
        issueType === "BILLING"
          ? "HIGH"
          : issueType === "ACCOUNT"
            ? "HIGH"
            : "NORMAL";

      // Prepare form data with files if any
      let requestBody: any;
      let headers: any = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/json",
      };

      if (attachedFiles.length > 0) {
        // Use FormData if files are attached
        const formData = new FormData();
        formData.append(
          "subject",
          `${ISSUE_TYPES.find((type) => type.value === issueType)?.label || t("support.supportRequest")}`,
        );
        formData.append("message", message);
        formData.append("category", issueType || "GENERAL");
        formData.append("priority", priority);
        if (userEmail) {
          formData.append("email", userEmail);
        }

        // Append files
        attachedFiles.forEach((file, index) => {
          const inferredExt = file.name?.includes(".")
            ? file.name.split(".").pop()
            : file.uri.includes(".")
              ? file.uri.split(".").pop()
              : undefined;
          const safeExt = inferredExt ? `.${inferredExt}` : "";
          const fileName =
            file.name ||
            `file_${Date.now()}_${index}_${Math.random().toString(16).slice(2, 8)}${safeExt}`;

          formData.append("files", {
            uri: file.uri,
            name: fileName,
            type:
              file.mimeType ||
              (file.type === "image"
                ? "image/jpeg"
                : "application/octet-stream"),
          } as any);
        });

        requestBody = formData;
      } else {
        // Use JSON if no files
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify({
          subject: `${ISSUE_TYPES.find((type) => type.value === issueType)?.label || t("support.supportRequest")}`,
          message: message,
          category: issueType,
          priority: priority,
          ...(userEmail ? { email: userEmail } : {}),
        });
      }

      const response = await fetch(`${base}/support/contact`, {
        method: "POST",
        headers: headers,
        body: requestBody,
      });

      const responseText = await response.text();
      const parsed = (() => {
        try {
          return responseText ? JSON.parse(responseText) : null;
        } catch {
          return null;
        }
      })();

      if (response.ok) {
        const ticketNumber =
          parsed?.ticket?.ticketNumber || t("support.notAvailable");
        Alert.alert(
          t("support.ticketCreatedSuccessfully"),
          t("support.ticketCreatedMessage", {
            ticketNumber,
            email: userEmail || t("support.yourEmailAddress"),
          }),
          [{ text: t("common.ok"), onPress: () => router.back() }],
        );
      } else {
        const errorMessage =
          parsed?.message ||
          parsed?.error ||
          (responseText ? responseText : t("support.failedToSubmitTicket"));
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      Alert.alert(t("common.error"), t("errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderIssueForm = () => {
    if (!issueType) return null;

    switch (issueType) {
      case "REPORT":
        return (
          <View style={styles.formSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              {t("support.stepsToReproduce")} *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              multiline
              numberOfLines={4}
              placeholder={t("support.describeStepsToReproduce")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              textAlignVertical="top"
              value={formData.stepsToReproduce || ""}
              onChangeText={(text) => updateFormData("stepsToReproduce", text)}
            />

            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.expectedBehavior")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder={t("support.whatShouldHappen")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              textAlignVertical="top"
              value={formData.expectedBehavior || ""}
              onChangeText={(text) => updateFormData("expectedBehavior", text)}
            />

            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.actualBehavior")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder={t("support.whatActuallyHappens")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              textAlignVertical="top"
              value={formData.actualBehavior || ""}
              onChangeText={(text) => updateFormData("actualBehavior", text)}
            />
          </View>
        );

      case "BILLING":
        return (
          <View style={styles.formSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              {t("support.transactionId")} ({t("common.optional")})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              placeholder={t("support.enterTransactionId")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              value={formData.transactionId || ""}
              onChangeText={(text) => updateFormData("transactionId", text)}
            />

            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.amount")} ({t("common.optional")})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              placeholder={t("support.enterAmount")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              keyboardType="decimal-pad"
              value={formData.amount || ""}
              onChangeText={(text) => updateFormData("amount", text)}
            />
          </View>
        );

      case "ACCOUNT":
        return (
          <View style={styles.formSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              {t("auth.email")} *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              placeholder={t("support.enterYourEmail")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email || ""}
              onChangeText={(text) => updateFormData("email", text)}
            />

            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.whenDidThisIssueStart")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              placeholder={t("support.whenDidThisIssueStartPlaceholder")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              value={formData.whenStarted || ""}
              onChangeText={(text) => updateFormData("whenStarted", text)}
            />
          </View>
        );

      case "VERIFICATION":
        return (
          <View style={styles.formSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>
              {t("support.verificationType")}
            </Text>
            <TouchableOpacity
              style={[
                styles.pickerButton,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              onPress={() => {
                // Simple selection for now - can be enhanced with modal
                const VERIFICATION_TYPES = getVerificationTypes(t);
                Alert.alert(
                  t("support.selectVerificationType"),
                  "",
                  (() => {
                    const buttons: AlertButton[] = VERIFICATION_TYPES.map(
                      (type) => ({
                        text: type,
                        onPress: () => updateFormData("verificationType", type),
                      }),
                    );
                    buttons.push({ text: t("common.cancel"), style: "cancel" });
                    return buttons;
                  })(),
                );
              }}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  {
                    color: formData.verificationType
                      ? colors.text
                      : isDark
                        ? "#9A8E7A"
                        : "#9A8E7A",
                  },
                ]}
              >
                {formData.verificationType ||
                  t("support.selectVerificationTypePlaceholder")}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "#9A8E7A" : "#9A8E7A"}
              />
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <TouchableButton onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableButton>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("legal.support")}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.text }]}>
              {t("support.howCanWeHelpYou")}
            </Text>

            {/* Issue Type Picker */}
            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 0 }]}
            >
              {t("support.issueType")} *
            </Text>
            <TouchableOpacity
              style={[
                styles.pickerButton,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              onPress={() => setShowIssueTypePicker(true)}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  {
                    color: issueType
                      ? colors.text
                      : isDark
                        ? "#9A8E7A"
                        : "#9A8E7A",
                  },
                ]}
              >
                {issueType
                  ? getIssueTypes(t).find((type) => type.value === issueType)
                      ?.label
                  : t("support.selectIssueTypePlaceholder")}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "#9A8E7A" : "#9A8E7A"}
              />
            </TouchableOpacity>

            {/* Description Field */}
            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.describeYourIssue")} *
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#FFFAF0",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              multiline
              numberOfLines={6}
              placeholder={t("support.provideDetailsAboutIssue")}
              placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={(text) => updateFormData("description", text)}
            />

            {/* Dynamic Form Fields Based on Issue Type */}
            {renderIssueForm()}

            {/* File Attachments Section */}
            <View style={styles.attachmentsSection}>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.text, marginTop: 16 },
                ]}
              >
                {t("support.attachments")} ({t("common.optional")})
              </Text>
              <Text
                style={[
                  styles.hintText,
                  { color: isDark ? "#9A8E7A" : "#8A7B68", marginBottom: 12 },
                ]}
              >
                {t("support.attachmentsHint")}
              </Text>

              {/* File Selection Buttons */}
              <View style={styles.fileButtonsContainer}>
                <TouchableButton
                  style={[
                    styles.fileButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(255,250,240,0.95)",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.2)"
                        : "rgba(0,0,0,0.08)",
                      shadowColor: isDark ? "#000" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: 0,
                    },
                  ]}
                  onPress={takePhoto}
                >
                  <View
                    style={[
                      styles.fileButtonIconContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                  >
                    <Feather name="camera" size={22} color={colors.tint} />
                  </View>
                  <Text
                    style={[styles.fileButtonText, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {t("support.takePhotoShort")}
                  </Text>
                </TouchableButton>

                <TouchableButton
                  style={[
                    styles.fileButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(255,250,240,0.95)",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.2)"
                        : "rgba(0,0,0,0.08)",
                      shadowColor: isDark ? "#000" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: 0,
                    },
                  ]}
                  onPress={pickImage}
                >
                  <View
                    style={[
                      styles.fileButtonIconContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                  >
                    <Feather name="image" size={22} color={colors.tint} />
                  </View>
                  <Text
                    style={[styles.fileButtonText, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {t("support.selectImageShort")}
                  </Text>
                </TouchableButton>

                <TouchableButton
                  style={[
                    styles.fileButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(255,250,240,0.95)",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.2)"
                        : "rgba(0,0,0,0.08)",
                      shadowColor: isDark ? "#000" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: 0,
                    },
                  ]}
                  onPress={pickDocument}
                >
                  <View
                    style={[
                      styles.fileButtonIconContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                  >
                    <Feather name="file" size={22} color={colors.tint} />
                  </View>
                  <Text
                    style={[styles.fileButtonText, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {t("support.selectFileShort")}
                  </Text>
                </TouchableButton>
              </View>

              {/* Display Attached Files */}
              {attachedFiles.length > 0 && (
                <View style={styles.attachedFilesContainer}>
                  {attachedFiles.map((file, index) => (
                    <View
                      key={index}
                      style={[
                        styles.attachedFileItem,
                        {
                          backgroundColor: isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.06)",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "rgba(184,130,42,0.2)",
                        },
                      ]}
                    >
                      {file.type === "image" ? (
                        <Image
                          source={{ uri: file.uri }}
                          style={styles.attachedFileThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.attachedFileIcon,
                            { backgroundColor: colors.tint },
                          ]}
                        >
                          <Feather name="file" size={24} color="#FFFAF0" />
                        </View>
                      )}
                      <View style={styles.attachedFileInfo}>
                        <Text
                          style={[
                            styles.attachedFileName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {file.name}
                        </Text>
                        <Text
                          style={[
                            styles.attachedFileType,
                            { color: isDark ? "#9A8E7A" : "#8A7B68" },
                          ]}
                        >
                          {file.type === "image"
                            ? t("support.image")
                            : t("support.document")}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeFile(index)}
                        style={styles.removeFileButton}
                      >
                        <Feather
                          name="x"
                          size={20}
                          color={isDark ? "#ef4444" : "#dc2626"}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableButton
              style={[
                styles.btn,
                {
                  backgroundColor: isDark ? "#FB7185" : "#E11D48",
                  opacity: submitting ? 0.6 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={isDark ? "#F0E8D5" : "#FFFAF0"} />
              ) : (
                <Text
                  style={[
                    styles.btnText,
                    { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                  ]}
                >
                  {t("support.submitTicket")}
                </Text>
              )}
            </TouchableButton>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Issue Type Picker Modal */}
        <Modal
          visible={showIssueTypePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowIssueTypePicker(false)}
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
                  {t("support.selectIssueType")}
                </Text>
                <TouchableOpacity onPress={() => setShowIssueTypePicker(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
              >
                {getIssueTypes(t).map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.modalItem,
                      issueType === type.value && styles.modalItemSelected,
                      {
                        backgroundColor:
                          issueType === type.value
                            ? isDark
                              ? "rgba(201, 150, 63, 0.3)"
                              : "rgba(201, 150, 63, 0.1)"
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      setIssueType(type.value);
                      setShowIssueTypePicker(false);
                      // Reset form data when changing issue type
                      setFormData({ description: formData.description });
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        {
                          color: colors.text,
                          fontWeight: issueType === type.value ? "600" : "400",
                        },
                      ]}
                    >
                      {type.label}
                    </Text>
                    {issueType === type.value && (
                      <Feather
                        name="check"
                        size={20}
                        color={isDark ? "#FB7185" : "#E11D48"}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: 1.5 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 32 },
  label: { marginBottom: 12, fontSize: 16, fontWeight: "700" },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
  },
  input: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 0,
  },
  textArea: {
    minHeight: 120,
  },
  pickerButton: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 0,
  },
  pickerButtonText: {
    fontSize: 16,
    flex: 1,
  },
  formSection: {
    marginTop: 8,
  },
  btn: {
    padding: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 0,
  },
  btnText: { fontWeight: "700", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "android" ? 48 : 0,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(184,130,42,0.2)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(184,130,42,0.06)",
  },
  modalItemSelected: {
    // Additional styling handled inline
  },
  modalItemText: {
    fontSize: 16,
  },
  attachmentsSection: {
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: "italic",
  },
  fileButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  fileButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    flex: 1,
    minWidth: "30%",
    minHeight: 100,
  },
  fileButtonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  fileButtonText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  attachedFilesContainer: {
    marginTop: 8,
    gap: 8,
  },
  attachedFileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  attachedFileThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  attachedFileIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attachedFileInfo: {
    flex: 1,
    marginRight: 8,
  },
  attachedFileName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  attachedFileType: {
    fontSize: 12,
  },
  removeFileButton: {
    padding: 4,
  },
});
