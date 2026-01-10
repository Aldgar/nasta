import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";

export default function ReportScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams();
  const titleParam = params.title;
  const title =
    (Array.isArray(titleParam) ? titleParam[0] : titleParam) ??
    t("report.report");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Determine category based on title
  const getCategory = () => {
    if (title.toLowerCase().includes("abuse")) {
      return "ABUSE";
    } else if (title.toLowerCase().includes("security")) {
      return "SECURITY";
    }
    return "GENERAL";
  };

  const submit = async () => {
    if (!detail.trim()) {
      Alert.alert(t("common.required"), t("report.pleaseProvideDetails"));
      return;
    }

    try {
      setSubmitting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      const base = getApiBase();
      const category = getCategory();

      const response = await fetch(`${base}/support/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: title,
          message: detail.trim(),
          category: category,
          priority:
            category === "ABUSE" || category === "SECURITY" ? "HIGH" : "NORMAL",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const ticketNumber = result.ticket?.ticketNumber || "N/A";
        Alert.alert(
          t("report.reportSubmitted"),
          t("report.reportSubmittedMessage", { ticketNumber }),
          [{ text: t("common.ok"), onPress: () => router.back() }]
        );
      } else {
        const error = await response
          .json()
          .catch(() => ({ message: t("report.failedToSubmitReport") }));
        Alert.alert(
          t("common.error"),
          error.message || t("report.failedToSubmitReportTryAgain")
        );
      }
    } catch (error: any) {
      console.error("Error submitting report:", error);
      Alert.alert(t("common.error"), t("errors.networkError"));
    } finally {
      setSubmitting(false);
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
            {title}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t("report.pleaseProvideDetails")}:
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
            numberOfLines={6}
            placeholder={t("report.describeIssue")}
            placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
            textAlignVertical="top"
            value={detail}
            onChangeText={setDetail}
          />
          <TouchableButton
            style={[
              styles.btn,
              { backgroundColor: "#ef4444", opacity: submitting ? 0.6 : 1 },
            ]}
            onPress={submit}
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
                {t("report.submitReport")}
              </Text>
            )}
          </TouchableButton>
        </View>
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
  content: { padding: 20 },
  label: { marginBottom: 12, fontSize: 16, fontWeight: "600" },
  input: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    minHeight: 120,
    borderWidth: 1,
    fontSize: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: Platform.OS === "android" ? 0 : 1,
  },
  btn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
  },
  btnText: { fontWeight: "700", fontSize: 16 },
});
