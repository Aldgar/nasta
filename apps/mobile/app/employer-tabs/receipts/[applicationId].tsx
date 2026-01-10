import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { getApiBase } from "../../../lib/api";

type EmployerReceiptRow = {
  applicationId: string;
  jobId: string;
  bookingId: string | null;
  jobTitle: string;
  serviceProviderName: string;
  completedAt: string;
  currency: string;
  totalPaidAmountCents: number;
  platformFeeAmountCents: number;
  serviceProviderAmountCents: number;
  receiptNumber: string | null;
  employerReceiptSentAt: string | null;
};

export default function EmployerReceiptDetailsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ applicationId?: string }>();
  const applicationId = params.applicationId
    ? String(params.applicationId)
    : "";

  const [row, setRow] = useState<EmployerReceiptRow | null>(null);
  const [loading, setLoading] = useState(true);

  const themeStyles = useMemo(
    () => ({
      textPrimary: { color: colors.text },
      textSecondary: { color: isDark ? "#94a3b8" : "#64748b" },
      background: { backgroundColor: colors.background },
      cardBackground: {
        backgroundColor: isDark
          ? "rgba(30, 41, 59, 0.85)"
          : "rgba(255, 255, 255, 0.9)",
      },
      border: {
        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
      },
    }),
    [colors.background, colors.text, isDark]
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("profile.na");
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmountFromCents = (amountCents: number, currency: string) => {
    const normalizedCurrency = (currency || "EUR").toUpperCase();
    const currencySymbol =
      normalizedCurrency === "EUR"
        ? "€"
        : normalizedCurrency === "USD"
          ? "$"
          : normalizedCurrency === "GBP"
            ? "£"
            : normalizedCurrency === "JPY"
              ? "¥"
              : normalizedCurrency;

    return `${currencySymbol}${(amountCents / 100).toFixed(2)}`;
  };

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token || !applicationId) {
        setRow(null);
        return;
      }

      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/payments/employer/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setRow(null);
        return;
      }

      const data = await res.json();
      const list: EmployerReceiptRow[] = Array.isArray(data) ? data : [];
      setRow(list.find((r) => r.applicationId === applicationId) ?? null);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  return (
    <SafeAreaView style={[styles.container, themeStyles.background]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("navigation.receipts"),
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
          },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push("/employer-tabs/receipts")}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("payments.goBackToReceipts")}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, themeStyles.textSecondary]}>
            {t("common.loading")}
          </Text>
        </View>
      ) : !row ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.title, themeStyles.textPrimary]}>
            {t("common.error")}
          </Text>
          <Text style={[styles.subtitle, themeStyles.textSecondary]}>
            {t("common.retry")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.card,
              themeStyles.cardBackground,
              themeStyles.border,
            ]}
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.receiptIconContainer}>
                <Feather name="file-text" size={24} color={colors.tint} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.title, themeStyles.textPrimary]}>
                  {row.jobTitle}
                </Text>
                <Text style={[styles.receiptNumber, themeStyles.textSecondary]}>
                  {row.receiptNumber ?? t("payments.receipt")}
                </Text>
              </View>
            </View>

            {/* Service Provider & Date Section */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Feather
                    name="user"
                    size={16}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, themeStyles.textSecondary]}>
                    {t("payments.serviceProvider")}
                  </Text>
                  <Text style={[styles.infoValue, themeStyles.textPrimary]}>
                    {row.serviceProviderName}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Feather
                    name="calendar"
                    size={16}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, themeStyles.textSecondary]}>
                    {t("payments.completedAt")}
                  </Text>
                  <Text style={[styles.infoValue, themeStyles.textPrimary]}>
                    {formatDate(row.completedAt)}
                  </Text>
                </View>
              </View>

              {row.receiptNumber && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <Feather
                      name="tag"
                      size={16}
                      color={isDark ? "#64748b" : "#94a3b8"}
                    />
                  </View>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, themeStyles.textSecondary]}>
                      {t("payments.receiptNumber")}
                    </Text>
                    <Text style={[styles.infoValue, themeStyles.textPrimary]}>
                      {row.receiptNumber}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Payment Summary Section */}
            <View style={styles.paymentSection}>
              <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
                {t("payments.paymentSummary")}
              </Text>

              <View style={styles.paymentBreakdown}>
                <View style={styles.paymentRow}>
                  <Text
                    style={[styles.paymentLabel, themeStyles.textSecondary]}
                  >
                    {t("payments.serviceProviderAmount")}
                  </Text>
                  <Text style={[styles.paymentValue, themeStyles.textPrimary]}>
                    {formatAmountFromCents(
                      row.serviceProviderAmountCents,
                      row.currency
                    )}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text
                    style={[styles.paymentLabel, themeStyles.textSecondary]}
                  >
                    {t("payments.platformFee")}
                  </Text>
                  <Text
                    style={[styles.paymentValue, themeStyles.textSecondary]}
                  >
                    {formatAmountFromCents(
                      row.platformFeeAmountCents,
                      row.currency
                    )}
                  </Text>
                </View>
                <View style={[styles.divider, themeStyles.border]} />
                <View style={styles.paymentRow}>
                  <Text
                    style={[styles.paymentTotalLabel, themeStyles.textPrimary]}
                  >
                    {t("payments.totalPaid")}
                  </Text>
                  <Text
                    style={[styles.paymentTotalValue, themeStyles.textPrimary]}
                  >
                    {formatAmountFromCents(
                      row.totalPaidAmountCents,
                      row.currency
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* Receipt Status Section */}
            <View style={styles.statusSection}>
              <View style={styles.statusRow}>
                <View style={styles.statusIconContainer}>
                  <Feather
                    name="mail"
                    size={16}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={[styles.statusLabel, themeStyles.textSecondary]}>
                    {t("payments.receiptStatus")}
                  </Text>
                  <View style={styles.statusBadgeContainer}>
                    {row.employerReceiptSentAt ? (
                      <View style={[styles.statusBadge, styles.statusSent]}>
                        <Feather
                          name="check-circle"
                          size={12}
                          color="#22c55e"
                        />
                        <Text style={[styles.statusText, { color: "#22c55e" }]}>
                          {t("payments.receiptSent")}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.statusPending]}>
                        <Feather name="clock" size={12} color="#f59e0b" />
                        <Text style={[styles.statusText, { color: "#f59e0b" }]}>
                          {t("payments.pending")}
                        </Text>
                      </View>
                    )}
                    {row.employerReceiptSentAt && (
                      <Text
                        style={[styles.statusDate, themeStyles.textSecondary]}
                      >
                        {formatDate(row.employerReceiptSentAt)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Additional Information Section */}
            <View style={styles.additionalInfoSection}>
              <Text style={[styles.sectionTitle, themeStyles.textPrimary]}>
                {t("payments.additionalInfo")}
              </Text>
              <View style={styles.additionalInfoContent}>
                <View style={styles.additionalInfoRow}>
                  <Feather
                    name="briefcase"
                    size={14}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.additionalInfoText,
                      themeStyles.textSecondary,
                    ]}
                  >
                    {t("payments.jobCompleted")}
                  </Text>
                </View>
                <View style={styles.additionalInfoRow}>
                  <Feather
                    name="lock"
                    size={14}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.additionalInfoText,
                      themeStyles.textSecondary,
                    ]}
                  >
                    {t("payments.paymentProcessed")}
                  </Text>
                </View>
                <View style={styles.additionalInfoRow}>
                  <Feather
                    name="dollar-sign"
                    size={14}
                    color={isDark ? "#64748b" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.additionalInfoText,
                      themeStyles.textSecondary,
                    ]}
                  >
                    {t("payments.currency")}: {row.currency.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  subtitle: {},
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  receiptIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  receiptNumber: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  paymentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  paymentBreakdown: {
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 16,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  paymentTotalValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.3,
  },
  statusSection: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusSent: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  statusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  additionalInfoSection: {
    marginTop: 8,
  },
  additionalInfoContent: {
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 16,
    gap: 12,
  },
  additionalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  additionalInfoText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
