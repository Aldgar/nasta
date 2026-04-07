import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/theme";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiBase } from "../../lib/api";

// European countries with ISO 3166-1 alpha-2 codes
const EUROPEAN_COUNTRIES = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "GB", name: "United Kingdom" },
  { code: "IS", name: "Iceland" },
  { code: "NO", name: "Norway" },
  { code: "CH", name: "Switzerland" },
].sort((a, b) => a.name.localeCompare(b.name));

// IBAN formatting function - adds spaces every 4 characters
const formatIban = (iban: string): string => {
  // Remove all spaces first
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  // Add space every 4 characters
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
};

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // Helper function to translate country names
  const translateCountryName = (countryCode: string): string => {
    const key = `countries.${countryCode}`;
    const translated = t(key);
    // If translation key doesn't exist, fallback to English name from array
    return translated !== key
      ? translated
      : EUROPEAN_COUNTRIES.find((c) => c.code === countryCode)?.name ||
          countryCode;
  };

  // Validate IBAN format and country code match
  const validateIban = (
    iban: string,
    countryCode: string,
  ): { valid: boolean; error?: string } => {
    const cleaned = iban.replace(/\s/g, "").toUpperCase();

    // Check minimum length (IBAN is typically 15-34 characters)
    if (cleaned.length < 15 || cleaned.length > 34) {
      return { valid: false, error: t("payments.ibanLengthError") };
    }

    // Check if IBAN starts with the selected country code
    if (!cleaned.startsWith(countryCode.toUpperCase())) {
      const countryName = translateCountryName(countryCode);
      return {
        valid: false,
        error: t("payments.ibanCountryError", {
          code: countryCode.toUpperCase(),
          country: countryName,
        }),
      };
    }

    // Basic format check - should be alphanumeric
    if (!/^[A-Z0-9]+$/.test(cleaned)) {
      return { valid: false, error: t("payments.ibanFormatError") };
    }

    return { valid: true };
  };
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [country, setCountry] = useState("PT");
  const [currency, setCurrency] = useState("EUR");
  const [iban, setIban] = useState("");
  const [useIban, setUseIban] = useState(true); // For EU countries, use IBAN
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Poll or fetch status
  const fetchStatus = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const baseUrl = getApiBase();

      const res = await fetch(`${baseUrl}/payments/connect/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleAddBankAccount = () => {
    setShowForm(true);
  };

  const handleDeleteBankAccount = async (bankAccountId: string) => {
    Alert.alert(
      t("payments.deleteBankAccount"),
      t("payments.deleteBankAccountConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) {
                Alert.alert(t("common.error"), t("chat.pleaseLoginToContinue"));
                return;
              }
              const baseUrl = getApiBase();

              const res = await fetch(
                `${baseUrl}/payments/connect/bank-account/${bankAccountId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                Alert.alert(
                  t("common.error"),
                  errorData.message || t("payments.failedToDeleteBankAccount"),
                );
                return;
              }

              Alert.alert(
                t("common.success"),
                t("payments.bankAccountDeletedSuccessfully"),
              );
              await fetchStatus();
            } catch (error: any) {
              console.error("Error deleting bank account:", error);
              Alert.alert(
                t("common.error"),
                t("payments.failedToDeleteBankAccountTryAgain"),
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSetDefault = async (bankAccountId: string) => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("chat.pleaseLoginToContinue"));
        return;
      }
      const baseUrl = getApiBase();

      const res = await fetch(
        `${baseUrl}/payments/connect/bank-account/${bankAccountId}/set-default`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(
          t("common.error"),
          errorData.message || t("payments.failedToSetDefaultBankAccount"),
        );
        return;
      }

      Alert.alert(t("common.success"), t("payments.defaultBankAccountUpdated"));
      await fetchStatus();
    } catch (error: any) {
      console.error("Error setting default bank account:", error);
      Alert.alert(
        t("common.error"),
        t("payments.failedToSetDefaultBankAccountTryAgain"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBankAccount = async () => {
    if (
      !accountHolderName.trim() ||
      (!useIban && (!accountNumber.trim() || !routingNumber.trim())) ||
      (useIban && !iban.trim())
    ) {
      Alert.alert(t("common.error"), t("payments.pleaseFillAllRequiredFields"));
      return;
    }

    // Validate country code - ensure it's a 2-letter ISO code
    if (!country || typeof country !== "string") {
      console.error("[BankAccount] Country is missing or invalid:", country);
      Alert.alert(t("common.error"), t("payments.pleaseSelectCountry"));
      return;
    }

    const countryCode = country.trim().toUpperCase();
    console.log(
      "[BankAccount] Submit - Country value:",
      country,
      "Type:",
      typeof country,
      "Normalized:",
      countryCode,
    );

    if (countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
      console.error(
        "[BankAccount] Invalid country code format:",
        countryCode,
        "Length:",
        countryCode.length,
      );
      Alert.alert(
        t("common.error"),
        t("payments.invalidCountryCode", { country }),
      );
      return;
    }

    // Ensure country is from our European countries list
    const countryMatch = EUROPEAN_COUNTRIES.find((c) => c.code === countryCode);
    if (!countryMatch) {
      console.error("[BankAccount] Country not in European list:", countryCode);
      console.log(
        "[BankAccount] Available countries:",
        EUROPEAN_COUNTRIES.map((c) => c.code).join(", "),
      );
      Alert.alert(
        t("common.error"),
        t("payments.countryNotSupported", { country: countryCode }),
      );
      return;
    }

    console.log(
      "[BankAccount] Country validated successfully:",
      countryCode,
      "Name:",
      countryMatch.name,
    );

    // Validate IBAN if using IBAN
    if (useIban && iban.trim()) {
      const ibanValidation = validateIban(iban, countryCode);
      if (!ibanValidation.valid) {
        Alert.alert(
          t("payments.invalidIban"),
          ibanValidation.error || t("payments.checkIbanFormat"),
        );
        return;
      }
    }

    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("chat.pleaseLoginToContinue"));
        setSaving(false);
        return;
      }

      const baseUrl = getApiBase();

      // Prepare request body - ensure country is always the 2-letter code
      const requestBody: any = {
        accountHolderName: accountHolderName.trim(),
        iban: useIban ? iban.trim().replace(/\s/g, "") : undefined,
        country: countryCode, // Always use the validated 2-letter ISO code
        currency: currency.toLowerCase(),
        accountHolderType: "individual",
      };

      // Only include accountNumber and routingNumber if not using IBAN
      if (!useIban) {
        requestBody.accountNumber = accountNumber.trim();
        requestBody.routingNumber = routingNumber.trim();
      }

      console.log(
        "[BankAccount] Submitting request body:",
        JSON.stringify(requestBody, null, 2),
      );
      console.log(
        "[BankAccount] Country in request:",
        requestBody.country,
        "Type:",
        typeof requestBody.country,
      );

      const res = await fetch(`${baseUrl}/payments/connect/bank-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        let errorMessage = t("payments.failedToAddBankAccount");
        let errorDetails: any = null;
        try {
          const errorData = await res.json();
          errorDetails = errorData;
          errorMessage = errorData.message || errorData.error || errorMessage;

          console.error("[BankAccount] Backend error response:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
          });

          // Provide user-friendly messages for common errors
          if (
            errorMessage.includes("country") ||
            errorMessage.includes("Country")
          ) {
            // Show the actual backend error message if it's specific
            if (
              errorMessage.includes("Invalid country code") ||
              errorMessage.includes("2-letter ISO")
            ) {
              errorMessage = errorMessage; // Use backend message as-is
            } else {
              errorMessage = t("payments.invalidCountryCodeSelect");
            }
          } else if (
            errorMessage.includes("validation") ||
            errorMessage.includes("required")
          ) {
            errorMessage = t("payments.fillAllRequiredFieldsCorrectly");
          } else if (
            errorMessage.includes("IBAN") ||
            errorMessage.includes("iban")
          ) {
            errorMessage = t("payments.invalidIbanFormat");
          } else if (
            errorMessage.includes("routing") ||
            errorMessage.includes("account number")
          ) {
            errorMessage = t("payments.invalidAccountOrRoutingNumber");
          } else if (
            errorMessage.includes("Stripe") ||
            errorMessage.includes("stripe")
          ) {
            errorMessage = t("payments.unableToProcessBankAccount");
          }
        } catch (parseError) {
          console.error(
            "[BankAccount] Failed to parse error response:",
            parseError,
          );
          // If JSON parsing fails, use status-based messages
          if (res.status === 400) {
            errorMessage = t("payments.invalidBankAccountDetails");
          } else if (res.status === 401 || res.status === 403) {
            errorMessage = t("chat.sessionExpiredMessage");
          } else if (res.status >= 500) {
            errorMessage = t("payments.serversExperiencingIssues");
          }
        }

        console.error(
          "[BankAccount] Final error message to show user:",
          errorMessage,
        );
        Alert.alert(t("payments.unableToAddBankAccount"), errorMessage);
        setSaving(false);
        return;
      }

      const data = await res.json();
      Alert.alert(
        t("payments.bankAccountAdded"),
        t("payments.bankAccountAddedMessage"),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowForm(false);
              // Reset form
              setAccountHolderName("");
              setAccountNumber("");
              setRoutingNumber("");
              setIban("");
              // Refresh status
              fetchStatus();
            },
          },
        ],
      );
    } catch (e: any) {
      console.error("Error adding bank account:", e);

      // Provide user-friendly error messages
      let errorMessage = t("payments.failedToAddBankAccount");

      if (e?.message) {
        if (
          e.message.includes("network") ||
          e.message.includes("fetch") ||
          e.message.includes("Network request failed")
        ) {
          errorMessage = t("payments.noInternetConnection");
        } else if (e.message.includes("timeout")) {
          errorMessage = t("payments.requestTookTooLong");
        } else {
          errorMessage = e.message;
        }
      }

      Alert.alert(t("common.error"), errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.light.tint} />
          ) : (
            <>
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: isDark ? "rgba(12, 22, 42, 0.82)" : "#fff",
                  },
                ]}
              >
                <Text style={[styles.label, { color: colors.text }]}>
                  {t("payments.payoutCapability")}
                </Text>
                <View
                  style={[
                    styles.badge,
                    status?.isEnabled ? styles.bgGreen : styles.bgOrange,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      status?.isEnabled ? styles.textGreen : styles.textOrange,
                    ]}
                  >
                    {status?.isEnabled
                      ? t("payments.active")
                      : t("payments.restricted")}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.infoText,
                  { color: isDark ? "#B8A88A" : "#64748B" },
                ]}
              >
                {status?.isEnabled
                  ? t("payments.accountReadyForPayouts")
                  : status?.bankAccounts && status.bankAccounts.length > 0
                    ? t("payments.bankAccountAddedNeedsVerification")
                    : t("payments.needToAddBankAccount")}
              </Text>

              {/* Show verification requirements if account is restricted */}
              {!status?.isEnabled && status?.requirements && (
                <View
                  style={[
                    styles.requirementsCard,
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
                  <View style={styles.requirementsHeader}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color={isDark ? "#fbbf24" : "#d97706"}
                    />
                    <Text
                      style={[
                        styles.requirementsTitle,
                        { color: isDark ? "#fbbf24" : "#d97706" },
                      ]}
                    >
                      {t("payments.accountVerificationRequired")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.requirementsText,
                      { color: isDark ? "#fde68a" : "#92400e" },
                    ]}
                  >
                    {status.requirements.currentlyDue &&
                    status.requirements.currentlyDue.length > 0
                      ? t("payments.stripeAccountNeedsVerification")
                      : status.requirements.disabledReason === "listed"
                        ? t("payments.accountUnderReview")
                        : t("payments.stripeAccountNeedsVerification")}
                  </Text>
                  {status.requirements.currentlyDue &&
                    status.requirements.currentlyDue.length > 0 && (
                      <View style={styles.requirementsList}>
                        <Text
                          style={[
                            styles.requirementsSubtitle,
                            { color: isDark ? "#fbbf24" : "#d97706" },
                          ]}
                        >
                          {t("payments.requiredInformation")}:
                        </Text>
                        {status.requirements.currentlyDue
                          .filter((req: string) => {
                            // Filter out business_profile requirements for individual accounts
                            // Filter out TOS acceptance - it's handled automatically by the backend
                            return (
                              !req.startsWith("business_profile.") &&
                              !req.startsWith("tos_acceptance.")
                            );
                          })
                          .map((req: string, idx: number) => {
                            // User-friendly labels
                            const friendlyLabels: { [key: string]: string } = {
                              "individual.address.city": t("profile.city"),
                              "individual.address.line1": t(
                                "payments.streetAddress",
                              ),
                              "individual.address.postal_code": t(
                                "payments.postalCode",
                              ),
                              "individual.dob.day": t(
                                "payments.dateOfBirthDay",
                              ),
                              "individual.dob.month": t(
                                "payments.dateOfBirthMonth",
                              ),
                              "individual.dob.year": t(
                                "payments.dateOfBirthYear",
                              ),
                              "individual.phone": t("profile.phone"),
                            };

                            const label =
                              friendlyLabels[req] ||
                              req
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (l: string) =>
                                  l.toUpperCase(),
                                );

                            return (
                              <Text
                                key={idx}
                                style={[
                                  styles.requirementItem,
                                  { color: isDark ? "#fde68a" : "#92400e" },
                                ]}
                              >
                                • {label}
                              </Text>
                            );
                          })}
                      </View>
                    )}
                  <Text
                    style={[
                      styles.requirementsNote,
                      { color: isDark ? "#fde68a" : "#92400e" },
                    ]}
                  >
                    {t("payments.verificationNote")}
                  </Text>
                </View>
              )}

              {/* Display existing bank accounts */}
              {status?.bankAccounts && status.bankAccounts.length > 0 && (
                <View
                  style={[
                    styles.bankAccountsContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "#FFF8F0",
                      borderColor: isDark ? "rgba(201,150,63,0.12)" : "#F0E8D5",
                    },
                  ]}
                >
                  <Text
                    style={[styles.bankAccountsTitle, { color: colors.text }]}
                  >
                    {t("payments.bankAccounts")}
                  </Text>
                  {status.bankAccounts.map(
                    (bankAccount: any, index: number) => (
                      <View
                        key={bankAccount.id || index}
                        style={[
                          styles.bankAccountCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.80)"
                              : "#ffffff",
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                          },
                        ]}
                      >
                        <View style={styles.bankAccountHeader}>
                          <Ionicons
                            name="card-outline"
                            size={24}
                            color={isDark ? "#38BDF8" : "#0284C7"}
                          />
                          <View style={styles.bankAccountInfo}>
                            <Text
                              style={[
                                styles.bankAccountName,
                                { color: colors.text },
                              ]}
                            >
                              {bankAccount.accountHolderName || "N/A"}
                            </Text>
                            <Text
                              style={[
                                styles.bankAccountDetails,
                                { color: isDark ? "#9A8E7A" : "#64748b" },
                              ]}
                            >
                              {bankAccount.iban
                                ? `${t("payments.iban")}: ${bankAccount.iban}`
                                : bankAccount.last4
                                  ? `****${bankAccount.last4}`
                                  : t("profile.na")}
                            </Text>
                            <Text
                              style={[
                                styles.bankAccountDetails,
                                { color: isDark ? "#9A8E7A" : "#64748b" },
                              ]}
                            >
                              {bankAccount.bankName ||
                                bankAccount.country ||
                                ""}{" "}
                              • {bankAccount.currency?.toUpperCase() || "EUR"}
                            </Text>
                            {bankAccount.defaultForCurrency && (
                              <View
                                style={[
                                  styles.defaultBadge,
                                  {
                                    backgroundColor: isDark
                                      ? "rgba(34, 197, 94, 0.2)"
                                      : "#d1fae5",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.defaultBadgeText,
                                    { color: isDark ? "#6ee7b7" : "#065f46" },
                                  ]}
                                >
                                  {t("payments.default")}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View
                          style={[
                            styles.bankAccountActions,
                            {
                              borderTopColor: isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#F0E8D5",
                            },
                          ]}
                        >
                          {!bankAccount.defaultForCurrency && (
                            <TouchableOpacity
                              style={[
                                styles.bankAccountActionBtn,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "#d1fae5",
                                },
                              ]}
                              onPress={() => handleSetDefault(bankAccount.id)}
                              disabled={loading}
                            >
                              <Ionicons
                                name="star"
                                size={16}
                                color={isDark ? "#6ee7b7" : "#065f46"}
                              />
                              <Text
                                style={[
                                  styles.bankAccountActionText,
                                  { color: isDark ? "#6ee7b7" : "#065f46" },
                                ]}
                              >
                                {t("payments.setDefault")}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {status.bankAccounts.length > 1 && (
                            <TouchableOpacity
                              style={[
                                styles.bankAccountActionBtn,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(239, 68, 68, 0.2)"
                                    : "#fee2e2",
                                },
                              ]}
                              onPress={() =>
                                handleDeleteBankAccount(bankAccount.id)
                              }
                              disabled={loading}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={isDark ? "#f87171" : "#dc2626"}
                              />
                              <Text
                                style={[
                                  styles.bankAccountActionText,
                                  { color: isDark ? "#f87171" : "#dc2626" },
                                ]}
                              >
                                {t("common.delete")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ),
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isDark ? "#38BDF8" : "#0284C7",
                    shadowColor: isDark ? "#38BDF8" : "#0284C7",
                  },
                  loading && styles.actionBtnDisabled,
                ]}
                onPress={handleAddBankAccount}
                disabled={loading}
              >
                <Text style={styles.btnText}>
                  {status?.bankAccounts && status.bankAccounts.length > 0
                    ? t("payments.addAnotherBankAccount")
                    : t("payments.addBankAccount")}
                </Text>
                <Ionicons
                  name={
                    status?.bankAccounts && status.bankAccounts.length > 0
                      ? "add-circle-outline"
                      : "add-circle-outline"
                  }
                  size={20}
                  color="white"
                />
              </TouchableOpacity>

              <Modal
                visible={showForm}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForm(false)}
              >
                <View style={styles.modalOverlay}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
                    style={{ width: "100%" }}
                  >
                    <View
                      style={[
                        styles.modalContent,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.90)"
                            : "#ffffff",
                        },
                      ]}
                    >
                      <View style={styles.modalHeader}>
                        <Text
                          style={[styles.modalTitle, { color: colors.text }]}
                        >
                          {t("payments.addBankAccount")}
                        </Text>
                        <TouchableOpacity onPress={() => setShowForm(false)}>
                          <Ionicons
                            name="close"
                            size={24}
                            color={colors.text}
                          />
                        </TouchableOpacity>
                      </View>

                      <ScrollView
                        style={styles.formContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Text
                          style={[styles.formLabel, { color: colors.text }]}
                        >
                          {t("payments.accountHolderName")}
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#fff",
                              borderColor: isDark
                                ? "rgba(255,250,240,0.15)"
                                : "#F0E8D5",
                              color: colors.text,
                            },
                          ]}
                          value={accountHolderName}
                          onChangeText={setAccountHolderName}
                          placeholder={t(
                            "payments.accountHolderNamePlaceholder",
                          )}
                          placeholderTextColor={isDark ? "#9ca3af" : "#9A8E7A"}
                          underlineColorAndroid="transparent"
                        />

                        <View style={styles.toggleContainer}>
                          <TouchableOpacity
                            style={[
                              styles.toggleBtn,
                              useIban && styles.toggleBtnActive,
                            ]}
                            onPress={() => setUseIban(true)}
                          >
                            <Text
                              style={[
                                styles.toggleText,
                                useIban && styles.toggleTextActive,
                              ]}
                            >
                              {t("payments.ibanEu")}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.toggleBtn,
                              !useIban && styles.toggleBtnActive,
                            ]}
                            onPress={() => setUseIban(false)}
                          >
                            <Text
                              style={[
                                styles.toggleText,
                                !useIban && styles.toggleTextActive,
                              ]}
                            >
                              {t("payments.accountAndRouting")}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {useIban ? (
                          <>
                            <Text
                              style={[styles.formLabel, { color: colors.text }]}
                            >
                              {t("payments.iban")}
                            </Text>
                            <TextInput
                              style={[
                                styles.formInput,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(201,150,63,0.12)"
                                    : "#fff",
                                  borderColor: isDark
                                    ? "rgba(255,250,240,0.15)"
                                    : "#F0E8D5",
                                  color: colors.text,
                                },
                              ]}
                              value={iban}
                              onChangeText={(text) => {
                                // Remove all non-alphanumeric characters except spaces
                                const cleaned = text
                                  .replace(/[^A-Za-z0-9\s]/g, "")
                                  .toUpperCase();
                                // Format with spaces every 4 characters
                                const formatted = formatIban(cleaned);
                                setIban(formatted);
                              }}
                              placeholder={
                                country
                                  ? `${country}00 0000 0000 0000 0000 00`
                                  : "LT00 0000 0000 0000 0000"
                              }
                              placeholderTextColor={
                                isDark ? "#9ca3af" : "#9A8E7A"
                              }
                              autoCapitalize="characters"
                              maxLength={42} // Max IBAN length (34) + spaces (8)
                              underlineColorAndroid="transparent"
                            />
                            {iban && country && (
                              <Text
                                style={[
                                  styles.helperText,
                                  { color: isDark ? "#9A8E7A" : "#64748b" },
                                ]}
                              >
                                {validateIban(iban, country).valid
                                  ? t("payments.validIbanFormat")
                                  : validateIban(iban, country).error ||
                                    t("payments.checking")}
                              </Text>
                            )}
                          </>
                        ) : (
                          <>
                            <Text
                              style={[styles.formLabel, { color: colors.text }]}
                            >
                              {t("payments.accountNumber")}
                            </Text>
                            <TextInput
                              style={[
                                styles.formInput,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(201,150,63,0.12)"
                                    : "#fff",
                                  borderColor: isDark
                                    ? "rgba(255,250,240,0.15)"
                                    : "#F0E8D5",
                                  color: colors.text,
                                },
                              ]}
                              value={accountNumber}
                              onChangeText={setAccountNumber}
                              placeholder={t(
                                "payments.accountNumberPlaceholder",
                              )}
                              placeholderTextColor={
                                isDark ? "#9ca3af" : "#9A8E7A"
                              }
                              keyboardType="numeric"
                              underlineColorAndroid="transparent"
                            />
                            <Text
                              style={[styles.formLabel, { color: colors.text }]}
                            >
                              {t("payments.routingNumber")}
                            </Text>
                            <TextInput
                              style={[
                                styles.formInput,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(201,150,63,0.12)"
                                    : "#fff",
                                  borderColor: isDark
                                    ? "rgba(255,250,240,0.15)"
                                    : "#F0E8D5",
                                  color: colors.text,
                                },
                              ]}
                              value={routingNumber}
                              onChangeText={setRoutingNumber}
                              placeholder={t(
                                "payments.routingNumberPlaceholder",
                              )}
                              placeholderTextColor={
                                isDark ? "#9ca3af" : "#9A8E7A"
                              }
                              keyboardType="numeric"
                              underlineColorAndroid="transparent"
                            />
                          </>
                        )}

                        <Text
                          style={[styles.formLabel, { color: colors.text }]}
                        >
                          {t("profile.country")}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.formInput,
                            styles.countryPicker,
                            {
                              backgroundColor: isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#fff",
                              borderColor: isDark
                                ? "rgba(255,250,240,0.15)"
                                : "#F0E8D5",
                            },
                          ]}
                          onPress={() => {
                            console.log(
                              "[BankAccount] Opening country picker, current country:",
                              country,
                            );
                            setShowCountryPicker(true);
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 16 }}>
                            {country
                              ? translateCountryName(country)
                              : t("profile.selectCountry")}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color={colors.text}
                          />
                        </TouchableOpacity>
                        {country && (
                          <Text
                            style={[
                              styles.helperText,
                              { color: isDark ? "#9A8E7A" : "#64748b" },
                            ]}
                          >
                            {t("payments.selected")}: {country} (
                            {translateCountryName(country)})
                          </Text>
                        )}

                        {/* Country Picker Modal */}
                        <Modal
                          visible={showCountryPicker}
                          transparent={true}
                          animationType="slide"
                          onRequestClose={() => setShowCountryPicker(false)}
                        >
                          <View style={styles.pickerOverlay}>
                            <View
                              style={[
                                styles.pickerContent,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(12, 22, 42, 0.90)"
                                    : "#ffffff",
                                },
                              ]}
                            >
                              <View style={styles.pickerHeader}>
                                <Text
                                  style={[
                                    styles.pickerTitle,
                                    { color: colors.text },
                                  ]}
                                >
                                  {t("profile.selectCountry")}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => setShowCountryPicker(false)}
                                >
                                  <Ionicons
                                    name="close"
                                    size={24}
                                    color={colors.text}
                                  />
                                </TouchableOpacity>
                              </View>
                              <ScrollView
                                style={styles.pickerList}
                                keyboardShouldPersistTaps="handled"
                              >
                                {EUROPEAN_COUNTRIES.map((countryOption) => (
                                  <TouchableOpacity
                                    key={countryOption.code}
                                    style={[
                                      styles.pickerItem,
                                      country === countryOption.code &&
                                        styles.pickerItemSelected,
                                      {
                                        borderBottomColor: isDark
                                          ? "rgba(201,150,63,0.12)"
                                          : "#F0E8D5",
                                      },
                                    ]}
                                    onPress={() => {
                                      // Always set the country code (2-letter ISO), never the name
                                      const selectedCode = countryOption.code;
                                      console.log(
                                        "[BankAccount] Country picker - Selected:",
                                        countryOption.name,
                                        "Code:",
                                        selectedCode,
                                        "Type:",
                                        typeof selectedCode,
                                      );

                                      // Ensure we're setting a valid 2-letter code
                                      if (
                                        selectedCode &&
                                        selectedCode.length === 2 &&
                                        /^[A-Z]{2}$/.test(selectedCode)
                                      ) {
                                        setCountry(selectedCode);
                                        console.log(
                                          "[BankAccount] Country state updated to:",
                                          selectedCode,
                                        );
                                      } else {
                                        console.error(
                                          "[BankAccount] Invalid country code from picker:",
                                          selectedCode,
                                        );
                                        Alert.alert(
                                          t("common.error"),
                                          t("payments.invalidCountrySelection"),
                                        );
                                        return;
                                      }

                                      // Set EUR for all European countries
                                      setCurrency("EUR");
                                      // Clear IBAN if country changes and IBAN doesn't match new country
                                      if (
                                        iban &&
                                        !iban
                                          .replace(/\s/g, "")
                                          .toUpperCase()
                                          .startsWith(selectedCode)
                                      ) {
                                        setIban("");
                                      }
                                      setShowCountryPicker(false);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.pickerItemText,
                                        { color: colors.text },
                                        country === countryOption.code &&
                                          styles.pickerItemTextSelected,
                                      ]}
                                    >
                                      {translateCountryName(countryOption.code)}
                                    </Text>
                                    {country === countryOption.code && (
                                      <Ionicons
                                        name="checkmark"
                                        size={20}
                                        color={isDark ? "#38BDF8" : "#0284C7"}
                                      />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          </View>
                        </Modal>

                        <TouchableOpacity
                          style={[
                            styles.submitBtn,
                            {
                              backgroundColor: isDark ? "#38BDF8" : "#0284C7",
                              shadowColor: isDark ? "#38BDF8" : "#0284C7",
                            },
                          ]}
                          onPress={handleSubmitBankAccount}
                          disabled={saving}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text style={styles.submitBtnText}>
                              {t("payments.addBankAccount")}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  </KeyboardAvoidingView>
                </View>
              </Modal>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  bgGreen: { backgroundColor: "#DCFCE7" },
  bgOrange: { backgroundColor: "#FFEDD5" },
  textGreen: { color: "#166534", fontWeight: "600", fontSize: 12 },
  textOrange: { color: "#9A3412", fontWeight: "600", fontSize: 12 },
  infoText: {
    lineHeight: 22,
    marginBottom: 32,
  },
  actionBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  badgeText: {
    fontWeight: "600",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(184,130,42,0.2)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  formContainer: {
    padding: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  countryPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(184,130,42,0.2)",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerItemSelected: {
    backgroundColor: "rgba(201, 150, 63, 0.1)",
  },
  pickerItemText: {
    fontSize: 16,
  },
  pickerItemTextSelected: {
    fontWeight: "600",
    color: Platform.OS === "ios" ? "#0284C7" : undefined,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 16,
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F0E8D5",
    backgroundColor: "rgba(184,130,42,0.06)",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  toggleTextActive: {
    color: "#fff",
  },
  submitBtn: {
    padding: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  bankAccountsContainer: {
    marginTop: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  bankAccountsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  bankAccountCard: {
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  bankAccountHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bankAccountInfo: {
    flex: 1,
  },
  bankAccountName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  bankAccountDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  defaultBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  requirementsCard: {
    marginTop: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  requirementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  requirementsText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  requirementsList: {
    marginTop: 8,
    marginBottom: 12,
  },
  requirementsSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 8,
  },
  requirementsNote: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
  bankAccountActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bankAccountActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  bankAccountActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
