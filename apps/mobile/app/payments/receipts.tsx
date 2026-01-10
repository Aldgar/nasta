import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiBase } from "../../lib/api";

interface BookingReceipt {
  id: string;
  capturedAmount: number | null;
  capturedAt: string | null;
  finalAmount: number | null;
  currency: string | null;
  agreedCurrency: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  title: string | null;
  stripeTransferId?: string | null;
  payoutStatus?: string | null;
  payoutDate?: string | null;
  job?: {
    title: string | null;
    location: string | null;
    city: string | null;
    country: string | null;
  } | null;
  employer?: {
    firstName: string | null;
    lastName: string | null;
    location: string | null;
    city: string | null;
    country: string | null;
  } | null;
  agreedPayUnit?: string | null;
  agreedRateAmount?: number | null;
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [receipts, setReceipts] = useState<BookingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingPayouts, setSyncingPayouts] = useState(false);

  const themeStyles = {
    textPrimary: { color: colors.text },
    textSecondary: { color: isDark ? "#94a3b8" : "#64748b" },
    iconColor: isDark ? "#e5e7eb" : "#4b5563",
    background: { backgroundColor: colors.background },
    headerBackground: {
      backgroundColor: isDark
        ? "rgba(15, 23, 42, 0.95)"
        : "rgba(255, 255, 255, 0.95)",
      borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    },
    backButtonBg: {
      backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.05)",
    },
    cardBackground: {
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.85)"
        : "rgba(255, 255, 255, 0.9)",
    },
    border: {
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
    },
  };

  const fetchReceipts = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/bookings/seeker/me?pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const bookings = Array.isArray(data)
          ? data
          : data?.items || data?.bookings || data?.data || [];

        // Filter for bookings with captured payments (completed payments)
        const paidBookings = bookings.filter(
          (booking: BookingReceipt) =>
            booking.capturedAmount && booking.capturedAmount > 0
        );

        // Sort by capturedAt date (most recent first)
        paidBookings.sort((a: BookingReceipt, b: BookingReceipt) => {
          const dateA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
          const dateB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
          return dateB - dateA;
        });

        setReceipts(paidBookings);
      } else {
        setReceipts([]);
      }
    } catch (error) {
      console.error("Error fetching receipts:", error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useFocusEffect(
    useCallback(() => {
      fetchReceipts();
    }, [fetchReceipts])
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("profile.na");
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount: number | null, currency: string | null) => {
    if (!amount) return "€0.00";
    // Normalize currency to uppercase for comparison
    const normalizedCurrency = currency?.toUpperCase() || "EUR";
    const currencySymbol =
      normalizedCurrency === "EUR"
        ? "€"
        : normalizedCurrency === "USD"
          ? "$"
          : normalizedCurrency === "GBP"
            ? "£"
            : normalizedCurrency === "JPY"
              ? "¥"
              : normalizedCurrency || "€";
    const amountInCurrency = amount / 100; // Convert from cents
    return `${currencySymbol}${amountInCurrency.toFixed(2)}`;
  };

  const getServiceTitle = (receipt: BookingReceipt) => {
    return receipt.job?.title || receipt.title || t("payments.serviceProvided");
  };

  const getEmployerName = (receipt: BookingReceipt) => {
    if (receipt.employer) {
      const firstName = receipt.employer.firstName || "";
      const lastName = receipt.employer.lastName || "";
      return `${firstName} ${lastName}`.trim() || t("auth.employer");
    }
    return t("auth.employer");
  };

  const getLocation = (receipt: BookingReceipt) => {
    if (receipt.job) {
      const parts = [
        receipt.job.location,
        receipt.job.city,
        receipt.job.country,
      ].filter(Boolean);
      return parts.join(", ") || t("candidate.locationNotSpecified");
    }
    if (receipt.employer) {
      const parts = [
        receipt.employer.location,
        receipt.employer.city,
        receipt.employer.country,
      ].filter(Boolean);
      return parts.join(", ") || t("candidate.locationNotSpecified");
    }
    return t("candidate.locationNotSpecified");
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return styles.statusCompleted;
      case "IN_PROGRESS":
        return styles.statusInProgress;
      case "CONFIRMED":
        return styles.statusConfirmed;
      case "CANCELLED":
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  const getStatusTextStyle = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { color: "#22c55e" };
      case "IN_PROGRESS":
        return { color: "#3b82f6" };
      case "CONFIRMED":
        return { color: "#8b5cf6" };
      case "CANCELLED":
        return { color: "#ef4444" };
      default:
        return { color: "#f59e0b" };
    }
  };

  const syncWithStripe = useCallback(async () => {
    const token = await SecureStore.getItemAsync("auth_token");
    if (!token) return;

    const baseUrl = getApiBase();

    // 1) Sync bookings (backfills missing Stripe transfers and fixes stuck receipts)
    const bookingSyncRes = await fetch(
      `${baseUrl}/payments/bookings/sync-my-bookings`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const bookingSyncJson = bookingSyncRes.ok
      ? await bookingSyncRes.json()
      : null;

    // 2) Sync payout statuses (reads Stripe payout state for transfers)
    const payoutSyncRes = await fetch(`${baseUrl}/payments/sync-my-payouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // 3) Refresh list
    await fetchReceipts();

    const synced = bookingSyncJson?.synced ?? null;
    const total = bookingSyncJson?.total ?? null;
    const bookingErrors = bookingSyncJson?.errors ?? 0;
    const transfersCreated = bookingSyncJson?.transfersCreated ?? 0;
    const transfersLinked = bookingSyncJson?.transfersLinked ?? 0;
    const transferErrors = bookingSyncJson?.transferErrors ?? 0;

    const anyIssues =
      bookingErrors > 0 || transferErrors > 0 || !payoutSyncRes.ok;
    const anyFixes = transfersCreated > 0 || transfersLinked > 0;

    if (anyIssues || anyFixes) {
      const lines: string[] = [];
      if (synced !== null && total !== null) {
        lines.push(`Bookings synced: ${synced}/${total}`);
      }
      if (anyFixes) {
        lines.push(
          `Transfers fixed: ${transfersCreated + transfersLinked} (created ${transfersCreated}, linked ${transfersLinked})`
        );
      }
      if (bookingErrors > 0 || transferErrors > 0) {
        lines.push(`Sync errors: ${bookingErrors + transferErrors}`);
      }
      if (!payoutSyncRes.ok) {
        lines.push("Payout status sync failed");
      }

      Alert.alert(
        anyIssues ? t("common.error") : t("common.success"),
        lines.join("\n"),
        [{ text: t("common.ok") }]
      );
    }
  }, [fetchReceipts, t]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await syncWithStripe();
    } catch (error) {
      console.error("Error during refresh sync:", error);
      Alert.alert(t("common.error"), t("common.tryAgain"), [
        { text: t("common.ok") },
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [syncWithStripe, t]);

  const syncPayouts = useCallback(async () => {
    try {
      setSyncingPayouts(true);
      await syncWithStripe();
    } catch (error) {
      console.error("Error syncing payouts:", error);
      Alert.alert(t("common.error"), t("payments.failedToSyncPayouts"), [
        { text: t("common.ok") },
      ]);
    } finally {
      setSyncingPayouts(false);
    }
  }, [syncWithStripe, t]);

  const totalEarnings = receipts.reduce((sum, receipt) => {
    return sum + (receipt.capturedAmount || 0);
  }, 0);

  const currency =
    receipts[0]?.currency || receipts[0]?.agreedCurrency || "EUR";

  if (loading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.container, themeStyles.background]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, themeStyles.headerBackground]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, themeStyles.backButtonBg]}
            accessibilityRole="button"
          >
            <Feather
              name="arrow-left"
              size={20}
              color={themeStyles.iconColor}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, themeStyles.textPrimary]}>
            {t("payments.receipts")}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeStyles.iconColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, themeStyles.background]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, themeStyles.headerBackground]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, themeStyles.backButtonBg]}
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={20} color={themeStyles.iconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, themeStyles.textPrimary]}>
          {t("payments.receipts")}
        </Text>
        <TouchableOpacity
          onPress={syncPayouts}
          disabled={syncingPayouts}
          style={[styles.syncButton, themeStyles.backButtonBg]}
          accessibilityRole="button"
        >
          {syncingPayouts ? (
            <ActivityIndicator size="small" color={themeStyles.iconColor} />
          ) : (
            <Feather
              name="refresh-cw"
              size={18}
              color={themeStyles.iconColor}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeStyles.iconColor}
          />
        }
      >
        {/* Summary Card */}
        <View
          style={[
            styles.summaryCard,
            themeStyles.cardBackground,
            themeStyles.border,
          ]}
        >
          <Text style={[styles.summaryLabel, themeStyles.textSecondary]}>
            {t("payments.totalEarnings")}
          </Text>
          <Text style={[styles.summaryAmount, themeStyles.textPrimary]}>
            {formatAmount(totalEarnings, currency)}
          </Text>
          <Text style={[styles.summaryCount, themeStyles.textSecondary]}>
            {receipts.length}{" "}
            {receipts.length === 1
              ? t("payments.receipt")
              : t("payments.receipts")}
          </Text>
        </View>

        {receipts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather
              name="file-text"
              size={64}
              color={themeStyles.textSecondary.color}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyTitle, themeStyles.textPrimary]}>
              {t("payments.noReceiptsYet")}
            </Text>
            <Text style={[styles.emptyText, themeStyles.textSecondary]}>
              {t("payments.receiptsWillAppearHere")}
            </Text>
          </View>
        ) : (
          receipts.map((receipt) => (
            <View
              key={receipt.id}
              style={[
                styles.receiptCard,
                themeStyles.cardBackground,
                themeStyles.border,
              ]}
            >
              {/* Receipt Header */}
              <View style={styles.receiptHeader}>
                <View style={styles.receiptHeaderLeft}>
                  <Feather
                    name="file-text"
                    size={20}
                    color={themeStyles.iconColor}
                  />
                  <Text style={[styles.receiptId, themeStyles.textSecondary]}>
                    {t("payments.receipt")} #
                    {receipt.id.slice(-8).toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[styles.statusBadge, getStatusStyle(receipt.status)]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      getStatusTextStyle(receipt.status),
                    ]}
                  >
                    {t(`payments.status.${receipt.status.toLowerCase()}`) ||
                      receipt.status}
                  </Text>
                </View>
              </View>

              {/* Service Info */}
              <View style={styles.receiptSection}>
                <Text style={[styles.receiptLabel, themeStyles.textSecondary]}>
                  {t("payments.service")}
                </Text>
                <Text style={[styles.receiptValue, themeStyles.textPrimary]}>
                  {getServiceTitle(receipt)}
                </Text>
              </View>

              {/* Employer Info */}
              <View style={styles.receiptSection}>
                <Text style={[styles.receiptLabel, themeStyles.textSecondary]}>
                  {t("auth.employer")}
                </Text>
                <Text style={[styles.receiptValue, themeStyles.textPrimary]}>
                  {getEmployerName(receipt)}
                </Text>
                <Text
                  style={[styles.receiptSubValue, themeStyles.textSecondary]}
                >
                  {getLocation(receipt)}
                </Text>
              </View>

              {/* Payment Details */}
              <View style={styles.receiptSection}>
                <Text style={[styles.receiptLabel, themeStyles.textSecondary]}>
                  {t("payments.amountReceived")}
                </Text>
                <Text style={[styles.receiptAmount, themeStyles.textPrimary]}>
                  {formatAmount(
                    receipt.capturedAmount,
                    receipt.currency || receipt.agreedCurrency
                  )}
                </Text>
              </View>

              {/* Date Range */}
              {(receipt.startTime || receipt.endTime) && (
                <View style={styles.receiptSection}>
                  <Text
                    style={[styles.receiptLabel, themeStyles.textSecondary]}
                  >
                    {t("payments.servicePeriod")}
                  </Text>
                  <Text style={[styles.receiptValue, themeStyles.textPrimary]}>
                    {receipt.startTime
                      ? formatDate(receipt.startTime)
                      : t("profile.na")}
                    {receipt.endTime && ` - ${formatDate(receipt.endTime)}`}
                  </Text>
                </View>
              )}

              {/* Payment Date */}
              {receipt.capturedAt && (
                <View style={styles.receiptSection}>
                  <Text
                    style={[styles.receiptLabel, themeStyles.textSecondary]}
                  >
                    {t("payments.paymentDate")}
                  </Text>
                  <Text style={[styles.receiptValue, themeStyles.textPrimary]}>
                    {formatDate(receipt.capturedAt)}
                  </Text>
                </View>
              )}

              {/* Payout Status */}
              {receipt.stripeTransferId && (
                <View style={styles.receiptSection}>
                  <Text
                    style={[styles.receiptLabel, themeStyles.textSecondary]}
                  >
                    {t("payments.payoutStatus")}
                  </Text>
                  <View style={styles.payoutStatusContainer}>
                    <View
                      style={[
                        styles.payoutStatusBadge,
                        receipt.payoutStatus === "paid"
                          ? styles.payoutStatusPaid
                          : receipt.payoutStatus === "failed"
                            ? styles.payoutStatusFailed
                            : styles.payoutStatusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.payoutStatusText,
                          receipt.payoutStatus === "paid"
                            ? { color: "#22c55e" }
                            : receipt.payoutStatus === "failed"
                              ? { color: "#ef4444" }
                              : { color: "#f59e0b" },
                        ]}
                      >
                        {receipt.payoutStatus === "paid"
                          ? t("payments.paid")
                          : receipt.payoutStatus === "failed"
                            ? t("payments.failed")
                            : t("payments.pending")}
                      </Text>
                    </View>
                    {receipt.payoutDate && (
                      <Text
                        style={[
                          styles.receiptSubValue,
                          themeStyles.textSecondary,
                          { marginTop: 4 },
                        ]}
                      >
                        {t("payments.paidOn")} {formatDate(receipt.payoutDate)}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Divider */}
              <View style={[styles.divider, themeStyles.border]} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 2 : 0,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 14,
  },
  receiptCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: Platform.OS === "android" ? 1 : 0,
  },
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  receiptHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  receiptId: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusCompleted: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  statusInProgress: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  statusConfirmed: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  statusCancelled: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  statusPending: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  receiptSection: {
    marginBottom: 12,
  },
  receiptLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  receiptValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  receiptSubValue: {
    fontSize: 13,
    marginTop: 2,
  },
  receiptAmount: {
    fontSize: 20,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginTop: 8,
    borderTopWidth: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
  },
  payoutStatusContainer: {
    marginTop: 4,
  },
  payoutStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  payoutStatusPaid: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  payoutStatusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  payoutStatusFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
