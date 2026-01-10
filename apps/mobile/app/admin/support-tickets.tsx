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
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface TicketAttachment {
  url: string;
  name: string;
  type?: 'image' | 'document';
  mimeType?: string;
}

interface SupportTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  userId?: string;
  user?: {
    id: string;
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
  };
  name?: string;
  email?: string;
  assignedTo?: string;
  createdAt: string;
  attachments?: TicketAttachment[];
}

export default function SupportTicketsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  useEffect(() => {
    fetchTickets();
  }, [scope, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      params.append("scope", scope);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const res = await fetch(
          `${base}/support/admin/tickets?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const items = data.tickets || [];
          // Filter out surveys, abuse reports, and security concerns
          // These have their own dedicated pages
          const filteredItems = items.filter(
            (ticket: SupportTicket) =>
              ticket.category !== "EMPLOYER_SURVEY" &&
              ticket.category !== "PROVIDER_SURVEY" &&
              ticket.category !== "ABUSE" &&
              ticket.category !== "SECURITY"
          );
          setTickets(filteredItems);
        } else {
          // Silently fail - don't show error modal or log
          setTickets([]);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // Silently handle all network errors - no logging
        setTickets([]);
      }
    } catch (error: any) {
      // Silently handle all errors - no logging, no modals
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAssign = async (ticketId: string) => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/support/admin/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.ticketAssignedToYou"));
        // Refresh tickets after assignment
        fetchTickets();
      } else {
        const errorData = await res.json().catch(() => ({ message: t("admin.failedToAssignTicket") }));
        Alert.alert(t("common.error"), errorData.message || t("admin.failedToAssignTicket"));
      }
    } catch (error: any) {
      // Only show alert for non-network errors
      if (error.message?.includes('Network') || error.message?.includes('timeout')) {
        console.warn("Network error assigning ticket:", error.message);
        Alert.alert(t("common.connectionError"), t("common.checkInternetConnection"));
      } else {
        Alert.alert(t("common.error"), error.message || t("admin.failedToAssignTicket"));
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "#ef4444";
      case "HIGH":
        return "#f59e0b";
      case "NORMAL":
        return "#3b82f6";
      case "LOW":
        return "#64748b";
      default:
        return "#64748b";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "#22c55e";
      case "IN_PROGRESS":
        return "#3b82f6";
      case "CLOSED":
        return "#64748b";
      case "OPEN":
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
          <Text style={[styles.pageTitle, { color: colors.text }]}>Support Tickets</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                My Tickets
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
          </ScrollView>
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
            {tickets.length === 0 ? (
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No tickets found
                </Text>
              </View>
            ) : (
              tickets.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
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
                      pathname: "/admin/support-ticket-detail",
                      params: { ticketId: ticket.id },
                    } as never);
                  }}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: "/admin/support-ticket-detail",
                        params: { ticketId: ticket.id },
                      } as never);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        {ticket.ticketNumber && (
                          <Text
                            style={[styles.ticketNumber, { color: isDark ? "#818cf8" : "#6366f1" }]}
                          >
                            {ticket.ticketNumber}
                          </Text>
                        )}
                        <Text
                          style={[styles.ticketSubject, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {ticket.subject}
                        </Text>
                        <Text
                          style={[styles.userInfo, { color: isDark ? "#cbd5e1" : "#64748b" }]}
                        >
                          {ticket.user
                            ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() || ticket.user.email || "User"
                            : ticket.name
                            ? ticket.name
                            : "Anonymous"}
                          {ticket.user?.email || ticket.email ? ` (${ticket.user?.email || ticket.email})` : ''}
                          {ticket.user?.phone ? ` • ${ticket.user.phone}` : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <Text
                    style={[styles.ticketMessage, { color: colors.text }]}
                    numberOfLines={3}
                  >
                    {ticket.message}
                  </Text>

                  {/* Attachments */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <View style={styles.attachmentsContainer}>
                      <Text style={[styles.attachmentsLabel, { color: isDark ? "#cbd5e1" : "#64748b" }]}>
                        {t("admin.attachments")} ({ticket.attachments.length})
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsScroll}>
                        {ticket.attachments.map((attachment, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.attachmentItem,
                              {
                                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
                              },
                            ]}
                            onPress={() => {
                              if (attachment.url) {
                                Linking.openURL(attachment.url).catch(err => {
                                  Alert.alert(t("common.error"), t("admin.failedToOpenAttachment"));
                                });
                              }
                            }}
                          >
                            {attachment.type === 'image' ? (
                              <Image
                                source={{ uri: attachment.url }}
                                style={styles.attachmentThumbnail}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.attachmentIcon, { backgroundColor: colors.tint }]}>
                                <Feather name="file" size={20} color="#fff" />
                              </View>
                            )}
                            <Text
                              style={[styles.attachmentName, { color: colors.text }]}
                              numberOfLines={1}
                              ellipsizeMode="middle"
                            >
                              {attachment.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.badges}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: getPriorityColor(ticket.priority) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getPriorityColor(ticket.priority) },
                        ]}
                      >
                        {ticket.priority}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: getStatusColor(ticket.status) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getStatusColor(ticket.status) },
                        ]}
                      >
                        {ticket.status}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: "rgba(168, 85, 247, 0.2)" },
                      ]}
                    >
                      <Text
                        style={[styles.badgeText, { color: "#a855f7" }]}
                      >
                        {ticket.category}
                      </Text>
                    </View>
                  </View>

                  {!ticket.assignedTo && ticket.status === "OPEN" && (
                    <TouchableOpacity
                      style={[styles.assignButton, { backgroundColor: isDark ? "#6366f1" : colors.tint }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAssign(ticket.id);
                      }}
                    >
                      <Text style={styles.assignButtonText}>{t("admin.assignToMe")}</Text>
                    </TouchableOpacity>
                  )}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "transparent",
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
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  userInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  ticketMessage: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  assignButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  assignButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  attachmentsContainer: {
    marginBottom: 12,
  },
  attachmentsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  attachmentsScroll: {
    marginHorizontal: -4,
  },
  attachmentItem: {
    width: 80,
    marginRight: 8,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  attachmentThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 6,
    marginBottom: 4,
  },
  attachmentIcon: {
    width: 64,
    height: 64,
    borderRadius: 6,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    fontSize: 10,
    textAlign: "center",
    width: "100%",
  },
});

