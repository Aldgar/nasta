import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface KYCVerification {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  verificationType: string;
  status: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  createdAt: string;
}

export default function KYCReviewsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");

  useEffect(() => {
    fetchVerifications();
  }, [scope]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      // Backend only accepts: PENDING, IN_PROGRESS, MANUAL_REVIEW
      const statuses = scope === "unassigned" 
        ? "MANUAL_REVIEW" 
        : "PENDING,IN_PROGRESS,MANUAL_REVIEW";
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const res = await fetch(
          `${base}/kyc/admin/list?statuses=${statuses}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          
          // Backend returns array directly
          let items = Array.isArray(data) ? data : [];
          
          // Filter by scope
          if (scope === "mine") {
            // Filter to only items assigned to current admin (would need admin ID)
            // For now, show all
          } else if (scope === "unassigned") {
            items = items.filter((item: any) => !item.assignedTo);
          }
          
          setVerifications(items);
        } else {
          setVerifications([]);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setVerifications([]);
      }
    } catch (error) {
      // Silently handle all errors - no logging, no modals
      setVerifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    fetchVerifications();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "#22c55e";
      case "FAILED":
        return "#ef4444";
      case "MANUAL_REVIEW":
        return "#f59e0b";
      default:
        return "#64748b";
    }
  };

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.text }]}>KYC Reviews</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              scope === "all" 
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setScope("all")}
          >
            <Text
              style={[
                styles.filterText,
                { color: scope === "all" ? "#fff" : colors.text },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              scope === "mine" 
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setScope("mine")}
          >
            <Text
              style={[
                styles.filterText,
                { color: scope === "mine" ? "#fff" : colors.text },
              ]}
            >
              My Reviews
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              scope === "unassigned" 
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setScope("unassigned")}
          >
            <Text
              style={[
                styles.filterText,
                { color: scope === "unassigned" ? "#fff" : colors.text },
              ]}
            >
              Unassigned
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {verifications.length === 0 ? (
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No verifications found
                </Text>
              </View>
            ) : (
              verifications.map((verification) => (
                <TouchableOpacity
                  key={verification.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.95)"
                        : "rgba(255,255,255,0.9)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => {
                    router.push({
                      pathname: "/admin/kyc-detail",
                      params: { verificationId: verification.id },
                    } as never);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.userName, { color: colors.text }]}
                      >
                        {verification.user
                          ? `${verification.user.firstName || ""} ${verification.user.lastName || ""}`.trim() || "Unknown User"
                          : "Unknown User"}
                      </Text>
                      <Text
                        style={[styles.userEmail, { color: isDark ? "#cbd5e1" : "#64748b" }]}
                      >
                        {verification.user?.email || "N/A"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: getStatusColor(verification.status) + "30",
                          borderWidth: 1,
                          borderColor: getStatusColor(verification.status) + "60",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(verification.status) },
                        ]}
                      >
                        {verification.status.replace("_", " ")}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.typeText, { color: colors.text }]}>
                    Type: {verification.verificationType?.replace("_", " ") || "N/A"}
                  </Text>
                  
                  <Text style={[styles.dateText, { color: isDark ? "#cbd5e1" : "#64748b" }]}>
                    Submitted: {new Date(verification.createdAt).toLocaleDateString()}
                  </Text>
                  
                  <View style={styles.viewDetailsHint}>
                    <Text style={[styles.viewDetailsText, { color: isDark ? "#cbd5e1" : "#64748b" }]}>
                      Tap to view details and manage
                    </Text>
                    <Feather name="chevron-right" size={16} color={isDark ? "#cbd5e1" : "#64748b"} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  placeholder: { width: 36 },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: { flex: 1, padding: 16 },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  typeText: {
    fontSize: 14,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    marginBottom: 8,
  },
  viewDetailsHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontStyle: "italic",
  },
});

