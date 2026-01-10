import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useRouter } from "expo-router";
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

export default function EmployerReceiptsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [rows, setRows] = useState<EmployerReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const themeStyles = {
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
  };

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

  const fetchEmployerReceipts = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setRows([]);
        return;
      }

      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/payments/employer/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployerReceipts();
  }, [fetchEmployerReceipts]);

  useFocusEffect(
    useCallback(() => {
      fetchEmployerReceipts();
    }, [fetchEmployerReceipts])
  );

  const refreshAndResendMissing = useCallback(async () => {
    setRefreshing(true);
    // Start rotation animation
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    animationRef.current.start();
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const baseUrl = getApiBase();

      const resendRes = await fetch(
        `${baseUrl}/payments/employer/receipts/resend-missing`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const resendJson = resendRes.ok ? await resendRes.json() : null;

      await fetchEmployerReceipts();

      if (resendRes.ok && resendJson) {
        Alert.alert(
          t("common.success"),
          t("payments.resendMissingReceiptsSummary", {
            sent: resendJson.sent ?? 0,
            skipped: resendJson.skipped ?? 0,
            errors: resendJson.errors ?? 0,
          })
        );
      } else if (!resendRes.ok) {
        Alert.alert(t("common.error"), t("common.retry"));
      }
    } catch {
      Alert.alert(t("common.error"), t("common.retry"));
    } finally {
      setRefreshing(false);
      // Stop rotation animation
      if (animationRef.current) {
        animationRef.current.stop();
      }
      rotateAnim.setValue(0);
    }
  }, [fetchEmployerReceipts, t, rotateAnim]);

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
              onPress={() => router.back()}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("payments.goBack")}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => {
            const spin = rotateAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            });
            return (
              <TouchableOpacity
                onPress={refreshAndResendMissing}
                disabled={refreshing}
                style={[
                  styles.headerIconButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.05)",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("payments.refreshReceipts")}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Feather name="refresh-cw" size={20} color={colors.text} />
                </Animated.View>
              </TouchableOpacity>
            );
          },
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, themeStyles.textSecondary]}>
            {t("common.loading")}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAndResendMissing}
              tintColor={colors.tint}
            />
          }
        >
          {rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, themeStyles.textPrimary]}>
                {t("payments.receipts")}
              </Text>
              <Text style={[styles.emptyText, themeStyles.textSecondary]}>
                {t("payments.receiptsWillAppearHere")}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {rows.map((row) => (
                <TouchableOpacity
                  key={row.applicationId}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/employer-tabs/receipts/[applicationId]",
                      params: { applicationId: row.applicationId },
                    })
                  }
                  style={[
                    styles.card,
                    themeStyles.cardBackground,
                    themeStyles.border,
                  ]}
                >
                  {/* Card Header with Job Title and Amount */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.receiptIconContainer}>
                        <Feather
                          name="file-text"
                          size={16}
                          color={colors.tint}
                        />
                      </View>
                      <View style={styles.titleContainer}>
                        <Text
                          style={[styles.jobTitle, themeStyles.textPrimary]}
                          numberOfLines={1}
                        >
                          {row.jobTitle}
                        </Text>
                        {row.receiptNumber && (
                          <Text
                            style={[
                              styles.receiptNumber,
                              themeStyles.textSecondary,
                            ]}
                          >
                            {row.receiptNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.amountContainer}>
                      <Text style={[styles.amount, themeStyles.textPrimary]}>
                        {formatAmountFromCents(
                          row.totalPaidAmountCents,
                          row.currency
                        )}
                      </Text>
                      <Text
                        style={[styles.amountLabel, themeStyles.textSecondary]}
                      >
                        {t("payments.totalPaid")}
                      </Text>
                    </View>
                  </View>

                  {/* Service Provider and Date in one row */}
                  <View style={styles.metaRow}>
                    <View style={styles.infoRow}>
                      <Feather
                        name="user"
                        size={12}
                        color={isDark ? "#64748b" : "#94a3b8"}
                      />
                      <Text
                        style={[styles.infoText, themeStyles.textSecondary]}
                        numberOfLines={1}
                      >
                        {row.serviceProviderName}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Feather
                        name="calendar"
                        size={12}
                        color={isDark ? "#64748b" : "#94a3b8"}
                      />
                      <Text
                        style={[styles.infoText, themeStyles.textSecondary]}
                      >
                        {formatDate(row.completedAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Payment Breakdown - Compact */}
                  <View style={styles.paymentBreakdown}>
                    <View style={styles.breakdownRow}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          themeStyles.textSecondary,
                        ]}
                      >
                        {t("payments.serviceProviderAmount")}
                      </Text>
                      <Text
                        style={[styles.breakdownValue, themeStyles.textPrimary]}
                      >
                        {formatAmountFromCents(
                          row.serviceProviderAmountCents,
                          row.currency
                        )}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          themeStyles.textSecondary,
                        ]}
                      >
                        {t("payments.platformFee")}
                      </Text>
                      <Text
                        style={[
                          styles.breakdownValue,
                          themeStyles.textSecondary,
                        ]}
                      >
                        {formatAmountFromCents(
                          row.platformFeeAmountCents,
                          row.currency
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Receipt Status Badge */}
                  {row.employerReceiptSentAt && (
                    <View style={styles.statusContainer}>
                      <View style={[styles.statusBadge, styles.statusSent]}>
                        <Feather
                          name="check-circle"
                          size={10}
                          color="#22c55e"
                        />
                        <Text style={[styles.statusText, { color: "#22c55e" }]}>
                          {t("payments.receiptSent")}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    marginTop: 48,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    gap: 12,
  },
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    flex: 1,
    marginRight: 10,
  },
  receiptIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 2,
  },
  receiptNumber: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.2,
    marginTop: 1,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
  },
  paymentBreakdown: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusContainer: {
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusSent: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  statusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
