import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import GradientBackground from "../components/GradientBackground";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiBase } from "../lib/api";

export default function AdminHome() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );
      return () => sub.remove();
    }, []),
  );

  const [kycPending, setKycPending] = useState<number | null>(null);
  const [kycMyReviews, setKycMyReviews] = useState<number | null>(null);
  const [ticketsOpen, setTicketsOpen] = useState<number | null>(null);
  const [ticketsUnassigned, setTicketsUnassigned] = useState<number | null>(
    null,
  );
  const [abuseOpen, setAbuseOpen] = useState<number | null>(null);
  const [abuseUnassigned, setAbuseUnassigned] = useState<number | null>(null);
  const [securityOpen, setSecurityOpen] = useState<number | null>(null);
  const [securityUnassigned, setSecurityUnassigned] = useState<number | null>(
    null,
  );
  const [vehiclesPending, setVehiclesPending] = useState<number | null>(null);
  const [deletionPending, setDeletionPending] = useState<number | null>(null);
  const [deletionUnassigned, setDeletionUnassigned] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounts();
  }, []);

  // Refresh counts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, []),
  );

  const fetchCounts = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Fetch KYC counts
      try {
        // Fetch all pending/in-progress/manual-review verifications with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const kycRes = await fetch(
            `${base}/kyc/admin/list?statuses=PENDING,IN_PROGRESS,MANUAL_REVIEW`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (kycRes.ok) {
            const kycData = await kycRes.json();
            const items = Array.isArray(kycData)
              ? kycData
              : kycData.items || kycData.verifications || [];

            // Pending = PENDING + IN_PROGRESS statuses (not assigned)
            const pending = items.filter(
              (item: any) =>
                (item.status === "PENDING" || item.status === "IN_PROGRESS") &&
                !item.assignedTo,
            ).length;

            // In Review = MANUAL_REVIEW status
            const inReview = items.filter(
              (item: any) => item.status === "MANUAL_REVIEW",
            ).length;

            setKycPending(pending);
            setKycMyReviews(inReview);
          } else {
            console.error("KYC fetch failed:", kycRes.status);
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (
            fetchError.name === "AbortError" ||
            fetchError.message?.includes("timeout")
          ) {
            console.warn(
              "KYC fetch timed out - this is normal if the server is slow",
            );
          } else {
            throw fetchError;
          }
        }
      } catch (e) {
        // Silently handle errors - don't log to console to avoid toast notifications
        // Only log non-timeout errors as warnings
        if (
          !(
            e instanceof Error &&
            (e.name === "AbortError" || e.message?.includes("timeout"))
          )
        ) {
          // Suppress error logging to prevent toast notifications
        }
      }

      // Fetch Support Ticket counts
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const ticketsRes = await fetch(
            `${base}/support/admin/tickets?scope=all`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (ticketsRes.ok) {
            const ticketsData = await ticketsRes.json();
            const tickets = ticketsData.tickets || [];
            // Filter out surveys, abuse, and security reports - only count actual support tickets
            const supportTickets = tickets.filter(
              (t: any) =>
                t.category !== "EMPLOYER_SURVEY" &&
                t.category !== "PROVIDER_SURVEY" &&
                t.category !== "ABUSE" &&
                t.category !== "SECURITY",
            );
            setTicketsOpen(
              supportTickets.filter((t: any) => t.status === "OPEN").length,
            );
            setTicketsUnassigned(
              supportTickets.filter((t: any) => !t.assignedTo).length,
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          setTicketsOpen(null);
          setTicketsUnassigned(null);
        }
      } catch (e) {
        setTicketsOpen(null);
        setTicketsUnassigned(null);
      }

      // Fetch Abuse Report counts
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const abuseRes = await fetch(
            `${base}/support/admin/tickets?scope=all&category=ABUSE`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (abuseRes.ok) {
            const abuseData = await abuseRes.json();
            const abuseTickets = abuseData.tickets || [];
            setAbuseOpen(
              abuseTickets.filter((t: any) => t.status === "OPEN").length,
            );
            setAbuseUnassigned(
              abuseTickets.filter((t: any) => !t.assignedTo).length,
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          setAbuseOpen(null);
          setAbuseUnassigned(null);
        }
      } catch (e) {
        setAbuseOpen(null);
        setAbuseUnassigned(null);
      }

      // Fetch Security Report counts
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const securityRes = await fetch(
            `${base}/support/admin/tickets?scope=all&category=SECURITY`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (securityRes.ok) {
            const securityData = await securityRes.json();
            const securityTickets = securityData.tickets || [];
            setSecurityOpen(
              securityTickets.filter((t: any) => t.status === "OPEN").length,
            );
            setSecurityUnassigned(
              securityTickets.filter((t: any) => !t.assignedTo).length,
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          setSecurityOpen(null);
          setSecurityUnassigned(null);
        }
      } catch (e) {
        setSecurityOpen(null);
        setSecurityUnassigned(null);
      }

      // Fetch Deletion Request counts
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const delRes = await fetch(
            `${base}/admin/users/deletion-requests?scope=all&status=PENDING`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (delRes.ok) {
            const delData = await delRes.json();
            const items = Array.isArray(delData) ? delData : [];
            setDeletionPending(items.length);
            setDeletionUnassigned(
              items.filter((r: any) => !r.assignedTo).length,
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          setDeletionPending(null);
          setDeletionUnassigned(null);
        }
      } catch (e) {
        setDeletionPending(null);
        setDeletionUnassigned(null);
      }

      // Fetch vehicle pending count
      try {
        const vRes = await fetch(
          `${base}/admin/dashboard/vehicles/pending/count`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          setVehiclesPending(vData.count ?? 0);
        }
      } catch {
        setVehiclesPending(null);
      }
    } catch (error) {
      // Silently handle all errors - no logging
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Admin Dashboard
          </Text>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
            onPress={() => {
              SecureStore.deleteItemAsync("auth_token");
              router.replace("/");
            }}
          >
            <Feather name="log-out" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <>
              {/* KYC Reviews Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => router.push("/admin/kyc-reviews" as never)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                      ]}
                    >
                      <Feather name="user-check" size={24} color="#FFFAF0" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        KYC Reviews
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        Identity verification
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {kycPending !== null ? kycPending : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#B8A88A" : "#8A7B68" },
                      ]}
                    >
                      Pending
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.15)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {kycMyReviews !== null ? kycMyReviews : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      In Review
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/kyc-reviews" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      Review Now
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Vehicle Reviews Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() =>
                  router.push("/admin/vehicle-reviews" as never)
                }
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#C9963F" : "#B8822A" },
                      ]}
                    >
                      <Feather name="truck" size={24} color="#FFFAF0" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text
                        style={[styles.cardTitle, { color: colors.text }]}
                      >
                        Vehicle Reviews
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        Vehicle verification
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {vehiclesPending !== null ? vehiclesPending : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Pending
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#C9963F" : "#B8822A" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/vehicle-reviews" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      Review Now
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Support Tickets Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => router.push("/admin/support-tickets" as never)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                      ]}
                    >
                      <Feather name="headphones" size={24} color="#FFFAF0" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Support Tickets
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        User support requests
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {ticketsOpen !== null ? ticketsOpen : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Open
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.15)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {ticketsUnassigned !== null ? ticketsUnassigned : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Unassigned
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#A78BFA" : "#7C3AED" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/support-tickets" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      View Tickets
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Report Abuse Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() =>
                  router.push("/admin/report-abuse-tickets" as never)
                }
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#ef4444" : "#dc2626" },
                      ]}
                    >
                      <Feather
                        name="alert-triangle"
                        size={24}
                        color="#FFFAF0"
                      />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Report Abuse
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        Abuse reports and violations
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {abuseOpen !== null ? abuseOpen : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Open
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.15)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {abuseUnassigned !== null ? abuseUnassigned : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Unassigned
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#ef4444" : "#dc2626" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/report-abuse-tickets" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      View Reports
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Report Security Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() =>
                  router.push("/admin/report-security-tickets" as never)
                }
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#f59e0b" : "#d97706" },
                      ]}
                    >
                      <Feather name="lock" size={24} color="#FFFAF0" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Security Concerns
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        Security issues and concerns
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {securityOpen !== null ? securityOpen : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Open
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.15)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {securityUnassigned !== null ? securityUnassigned : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Unassigned
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#f59e0b" : "#d97706" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/report-security-tickets" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      View Reports
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Deletion Requests Card */}
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => router.push("/admin/deletion-requests" as never)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: isDark ? "#ef4444" : "#dc2626" },
                      ]}
                    >
                      <Feather name="user-minus" size={24} color="#FFFAF0" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        Deletion Requests
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: isDark ? "#B8A88A" : "#8A7B68" },
                        ]}
                      >
                        Account deletion reviews
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={isDark ? "#9A8E7A" : "#8A7B68"}
                  />
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {deletionPending !== null ? deletionPending : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Pending
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.15)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {deletionUnassigned !== null ? deletionUnassigned : "-"}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      Unassigned
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? "#ef4444" : "#dc2626" },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push("/admin/deletion-requests" as never);
                    }}
                  >
                    <Text
                      style={[styles.actionButtonText, { color: "#FFFAF0" }]}
                    >
                      Review Requests
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Bottom Navigation */}
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: isDark
                ? "rgba(12, 22, 42, 0.90)"
                : "rgba(255, 250, 240, 0.95)",
              borderTopColor: isDark
                ? "rgba(201,150,63,0.12)"
                : "rgba(184,130,42,0.2)",
            },
          ]}
        >
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push("/admin-home" as never)}
          >
            <Feather name="home" size={22} color={colors.tint} />
            <Text style={[styles.navLabel, { color: colors.tint }]}>
              {t("admin.home")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push("/admin/manage-users" as never)}
          >
            <Feather
              name="users"
              size={22}
              color={isDark ? "#9A8E7A" : "#8A7B68"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {t("admin.users")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push("/admin/surveys" as never)}
          >
            <Feather
              name="clipboard"
              size={22}
              color={isDark ? "#9A8E7A" : "#8A7B68"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {t("admin.survey")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push("/settings" as never)}
          >
            <Feather
              name="settings"
              size={22}
              color={isDark ? "#9A8E7A" : "#8A7B68"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {t("admin.settings")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push("/admin/manage-admins" as never)}
          >
            <Feather
              name="users"
              size={22}
              color={isDark ? "#9A8E7A" : "#8A7B68"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {t("admin.admins")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  card: {
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  cardActions: {
    marginTop: 8,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
});
