import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  type AlertButton,
  Platform,
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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("support.permissionRequired"),
          t("support.pleaseAllowCameraAccess")
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
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
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("support.permissionRequired"),
          t("support.pleaseAllowPhotosAccess")
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: AttachedFile[] = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
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
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: AttachedFile[] = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
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
          t("support.pleaseProvideStepsToReproduce")
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
      };

      if (attachedFiles.length > 0) {
        // Use FormData if files are attached
        const formData = new FormData();
        formData.append(
          "subject",
          `${ISSUE_TYPES.find((type) => type.value === issueType)?.label || t("support.supportRequest")}`
        );
        formData.append("message", message);
        formData.append("category", issueType || "GENERAL");
        formData.append("priority", priority);
        if (userEmail) {
          formData.append("email", userEmail);
        }

        // Append files
        attachedFiles.forEach((file, index) => {
          const fileExtension = file.uri.split(".").pop() || "";
          const fileName = file.name || `file_${index}.${fileExtension}`;

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

      if (response.ok) {
        const result = await response.json();
        const ticketNumber =
          result.ticket?.ticketNumber || t("support.notAvailable");
        Alert.alert(
          t("support.ticketCreatedSuccessfully"),
          t("support.ticketCreatedMessage", {
            ticketNumber,
            email: userEmail || t("support.yourEmailAddress"),
          }),
          [{ text: t("common.ok"), onPress: () => router.back() }]
        );
      } else {
        const error = await response.json();
        Alert.alert(
          t("common.error"),
          error.message || t("support.failedToSubmitTicket")
        );
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              multiline
              numberOfLines={4}
              placeholder={t("support.describeStepsToReproduce")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder={t("support.whatShouldHappen")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder={t("support.whatActuallyHappens")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("support.enterTransactionId")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("support.enterAmount")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("support.enterYourEmail")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("support.whenDidThisIssueStartPlaceholder")}
              placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
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
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
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
                      })
                    );
                    buttons.push({ text: t("common.cancel"), style: "cancel" });
                    return buttons;
                  })()
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
                        ? "#9ca3af"
                        : "#94a3b8",
                  },
                ]}
              >
                {formData.verificationType ||
                  t("support.selectVerificationTypePlaceholder")}
              </Text>
              <Feather
                name="chevron-down"
                size={20}
                color={isDark ? "#9ca3af" : "#94a3b8"}
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
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                borderColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
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
                      ? "#9ca3af"
                      : "#94a3b8",
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
              color={isDark ? "#9ca3af" : "#94a3b8"}
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
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                color: colors.text,
                borderColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
            multiline
            numberOfLines={6}
            placeholder={t("support.provideDetailsAboutIssue")}
            placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
            textAlignVertical="top"
            value={formData.description}
            onChangeText={(text) => updateFormData("description", text)}
          />

          {/* Dynamic Form Fields Based on Issue Type */}
          {renderIssueForm()}

          {/* File Attachments Section */}
          <View style={styles.attachmentsSection}>
            <Text
              style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}
            >
              {t("support.attachments")} ({t("common.optional")})
            </Text>
            <Text
              style={[
                styles.hintText,
                { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 12 },
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
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.95)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.08)",
                    shadowColor: isDark ? "#000" : "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.3 : 0.1,
                    shadowRadius: 4,
                    elevation: Platform.OS === "android" ? 2 : 0,
                  },
                ]}
                onPress={takePhoto}
              >
                <View
                  style={[
                    styles.fileButtonIconContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.2)"
                        : "rgba(99, 102, 241, 0.1)",
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
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.95)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.08)",
                    shadowColor: isDark ? "#000" : "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.3 : 0.1,
                    shadowRadius: 4,
                    elevation: Platform.OS === "android" ? 2 : 0,
                  },
                ]}
                onPress={pickImage}
              >
                <View
                  style={[
                    styles.fileButtonIconContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.2)"
                        : "rgba(99, 102, 241, 0.1)",
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
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.95)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.08)",
                    shadowColor: isDark ? "#000" : "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.3 : 0.1,
                    shadowRadius: 4,
                    elevation: Platform.OS === "android" ? 2 : 0,
                  },
                ]}
                onPress={pickDocument}
              >
                <View
                  style={[
                    styles.fileButtonIconContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(99, 102, 241, 0.2)"
                        : "rgba(99, 102, 241, 0.1)",
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
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.05)",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.2)"
                          : "rgba(0,0,0,0.1)",
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
                        <Feather name="file" size={24} color="#fff" />
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
                          { color: isDark ? "#94a3b8" : "#64748b" },
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
                backgroundColor: isDark ? "#4f46e5" : colors.tint,
                opacity: submitting ? 0.6 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={isDark ? "#e0e7ff" : "#ffffff"} />
            ) : (
              <Text
                style={[
                  styles.btnText,
                  { color: isDark ? "#e0e7ff" : "#ffffff" },
                ]}
              >
                {t("support.submitTicket")}
              </Text>
            )}
          </TouchableButton>
        </ScrollView>

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
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
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

              <ScrollView style={styles.modalList}>
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
                              ? "rgba(79, 70, 229, 0.3)"
                              : "rgba(79, 70, 229, 0.1)"
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
                        color={isDark ? "#818cf8" : "#4f46e5"}
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
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scrollView: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 32 },
  label: { marginBottom: 12, fontSize: 16, fontWeight: "600" },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: Platform.OS === "android" ? 0 : 1,
  },
  textArea: {
    minHeight: 120,
  },
  pickerButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: Platform.OS === "android" ? 0 : 1,
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
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
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
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
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
    borderBottomColor: "rgba(0,0,0,0.05)",
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
    borderRadius: 14,
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
    fontWeight: "600",
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
    borderRadius: 12,
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
    fontWeight: "600",
    marginBottom: 4,
  },
  attachedFileType: {
    fontSize: 12,
  },
  removeFileButton: {
    padding: 4,
  },
});
