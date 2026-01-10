import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableButton } from "../components/TouchableButton";
import { getApiBase } from "../lib/api";

type ReasonKey =
  | "notUsing"
  | "privacy"
  | "tooExpensive"
  | "foundAlternative"
  | "technicalIssues"
  | "other";

const MAX_REASON_LENGTH = 500;

export default function DeleteAccountScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const reasons = useMemo(
    () =>
      [
        {
          key: "notUsing" as const,
          label: t("deleteAccount.reasons.notUsing"),
        },
        { key: "privacy" as const, label: t("deleteAccount.reasons.privacy") },
        {
          key: "tooExpensive" as const,
          label: t("deleteAccount.reasons.tooExpensive"),
        },
        {
          key: "foundAlternative" as const,
          label: t("deleteAccount.reasons.foundAlternative"),
        },
        {
          key: "technicalIssues" as const,
          label: t("deleteAccount.reasons.technicalIssues"),
        },
        { key: "other" as const, label: t("deleteAccount.reasons.other") },
      ] as const,
    [t]
  );

  const [selectedReason, setSelectedReason] = useState<ReasonKey | null>(null);
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const assembledReason = useMemo(() => {
    const reasonLabel = selectedReason
      ? reasons.find((r) => r.key === selectedReason)?.label
      : "";

    const trimmedDetails = details.trim();
    const parts = [reasonLabel, trimmedDetails ? `\n\n${trimmedDetails}` : ""]
      .join("")
      .trim();

    return parts.slice(0, MAX_REASON_LENGTH);
  }, [selectedReason, details, reasons]);

  const remaining = MAX_REASON_LENGTH - assembledReason.length;

  const submit = async () => {
    if (!selectedReason) {
      Alert.alert(
        t("common.error"),
        t("deleteAccount.validation.selectReason")
      );
      return;
    }
    if (!confirmed) {
      Alert.alert(t("common.error"), t("deleteAccount.validation.confirm"));
      return;
    }

    try {
      setSubmitting(true);

      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLoginAgain"));
        router.dismissAll();
        router.replace("/");
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/users/me/deletion-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: assembledReason }),
      });

      if (res.ok) {
        Alert.alert(
          t("deleteAccount.success.title"),
          t("deleteAccount.success.message"),
          [{ text: t("common.ok"), onPress: () => router.back() }]
        );
        return;
      }

      let message = t("deleteAccount.error.generic");
      try {
        const data = await res.json();
        if (typeof data?.message === "string") message = data.message;
        if (Array.isArray(data?.message) && data.message[0]) {
          message = String(data.message[0]);
        }
      } catch {
        // ignore
      }

      if (res.status === 401) {
        Alert.alert(t("auth.sessionExpired"), t("auth.pleaseLoginAgain"));
        router.dismissAll();
        router.replace("/");
        return;
      }

      Alert.alert(t("common.error"), message);
    } catch (err) {
      console.log("Delete account request failed:", err);
      Alert.alert(t("common.error"), t("deleteAccount.error.network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.topBar}>
          <TouchableButton onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("deleteAccount.title")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.85)" : "#fff",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
              },
            ]}
          >
            <Text
              style={[
                styles.description,
                { color: isDark ? "rgba(255,255,255,0.75)" : "#6b7280" },
              ]}
            >
              {t("deleteAccount.description")}
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("deleteAccount.reasonTitle")}
            </Text>

            <View style={{ gap: 10 }}>
              {reasons.map((r) => {
                const selected = r.key === selectedReason;
                return (
                  <TouchableButton
                    key={r.key}
                    onPress={() => setSelectedReason(r.key)}
                    style={[
                      styles.reasonRow,
                      {
                        borderColor: isDark
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(0,0,0,0.1)",
                        backgroundColor: selected
                          ? isDark
                            ? "rgba(99, 102, 241, 0.2)"
                            : "rgba(99, 102, 241, 0.1)"
                          : isDark
                            ? "rgba(15, 23, 42, 0.35)"
                            : "rgba(243, 244, 246, 0.6)",
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Feather
                        name={selected ? "check-circle" : "circle"}
                        size={18}
                        color={
                          selected
                            ? colors.tint
                            : isDark
                              ? "#94a3b8"
                              : "#6b7280"
                        }
                        style={{ marginTop: 2 }}
                      />
                      <Text style={[styles.reasonText, { color: colors.text }]}>
                        {r.label}
                      </Text>
                    </View>
                  </TouchableButton>
                );
              })}
            </View>

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, marginTop: 16 },
              ]}
            >
              {t("deleteAccount.detailsTitle")}
            </Text>

            <TextInput
              value={details}
              onChangeText={(val) => setDetails(val)}
              placeholder={t("deleteAccount.detailsPlaceholder")}
              placeholderTextColor={
                isDark ? "rgba(255,255,255,0.35)" : "#9ca3af"
              }
              multiline
              style={[
                styles.textArea,
                {
                  color: colors.text,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.1)",
                  backgroundColor: isDark
                    ? "rgba(15, 23, 42, 0.35)"
                    : "rgba(243, 244, 246, 0.6)",
                },
              ]}
            />

            <Text
              style={[
                styles.counter,
                {
                  color:
                    remaining < 0
                      ? "#ef4444"
                      : isDark
                        ? "rgba(255,255,255,0.55)"
                        : "#6b7280",
                },
              ]}
            >
              {t("deleteAccount.characterCount", {
                count: assembledReason.length,
                max: MAX_REASON_LENGTH,
              })}
            </Text>

            <TouchableButton
              onPress={() => setConfirmed((v) => !v)}
              style={[
                styles.confirmRow,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.1)",
                  backgroundColor: isDark
                    ? "rgba(15, 23, 42, 0.35)"
                    : "rgba(243, 244, 246, 0.6)",
                },
              ]}
            >
              <Feather
                name={confirmed ? "check-square" : "square"}
                size={18}
                color={confirmed ? colors.tint : isDark ? "#94a3b8" : "#6b7280"}
              />
              <Text style={[styles.confirmText, { color: colors.text }]}>
                {t("deleteAccount.confirmText")}
              </Text>
            </TouchableButton>

            <TouchableButton
              onPress={submit}
              disabled={submitting}
              style={[
                styles.deleteBtn,
                {
                  opacity: submitting ? 0.7 : 1,
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(239, 68, 68, 0.1)",
                  borderColor: isDark
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(239, 68, 68, 0.3)",
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={isDark ? "#fecaca" : "#991b1b"} />
              ) : (
                <Text
                  style={[
                    styles.deleteBtnText,
                    { color: isDark ? "#fecaca" : "#991b1b" },
                  ]}
                >
                  {t("deleteAccount.submit")}
                </Text>
              )}
            </TouchableButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
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
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  reasonRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  reasonText: { fontSize: 14, lineHeight: 18, flex: 1 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 110,
    textAlignVertical: "top",
  },
  counter: {
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  confirmText: { fontSize: 13, lineHeight: 18, flex: 1 },
  deleteBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700" },
});
