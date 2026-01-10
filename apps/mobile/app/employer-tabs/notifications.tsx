import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getApiBase } from "../../lib/api";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useRouter } from "expo-router";

interface Notification {
  id: string;
  type:
    | "NEARBY_JOB"
    | "JOB_MESSAGE"
    | "APPLICATION_UPDATE"
    | "SYSTEM"
    | "LEGAL_ACTION"
    | "WARNING"
    | "ACTION_FORM";
  title: string | null;
  body: string | null;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export default function EmployerNotifications() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const baseUrl = getApiBase();
      const url = `${baseUrl}/notifications?status=all&limit=50`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          setNotifications([]);
        } else {
          // Other error
          setNotifications([]);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await response.json();

      // Backend returns { items, total, page, limit }
      const items = Array.isArray(data) ? data : data.items || data.data || [];

      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.warn("Notifications response is not an array:", items);
        setNotifications([]);
        return;
      }

      setNotifications(items);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const baseUrl = getApiBase();
      await fetch(`${baseUrl}/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.readAt) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type and payload
    const payload = notification.payload as any;

    try {
      switch (notification.type) {
        case "APPLICATION_UPDATE":
          if (payload?.applicationId) {
            // For employer, navigate to applicant detail page
            router.push(`/applicant/${payload.applicationId}` as any);
          } else if (payload?.jobId) {
            // Fallback to job details if no applicationId
            router.push(`/jobs/${payload.jobId}` as any);
          }
          break;

        case "JOB_MESSAGE":
          if (payload?.conversationId) {
            router.push(
              `/chat/room?conversationId=${payload.conversationId}` as any
            );
          }
          break;

        case "NEARBY_JOB":
          if (payload?.jobId) {
            router.push(`/jobs/${payload.jobId}` as any);
          }
          break;

        case "ACTION_FORM":
        case "WARNING":
        case "LEGAL_ACTION":
          // These might not have specific navigation targets
          // Could navigate to a support/help page or stay on notifications
          break;

        case "SYSTEM":
          // System notifications might not need navigation
          break;

        default:
          // For unknown types, try to navigate if there's a jobId or applicationId
          if (payload?.applicationId) {
            router.push(`/applicant/${payload.applicationId}` as any);
          } else if (payload?.jobId) {
            router.push(`/jobs/${payload.jobId}` as any);
          }
          break;
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("notifications.justNow");
    if (diffMins < 60) return `${diffMins}${t("notifications.minutesAgo")}`;
    if (diffHours < 24) return `${diffHours}${t("notifications.hoursAgo")}`;
    if (diffDays < 7) return `${diffDays}${t("notifications.daysAgo")}`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "NEARBY_JOB":
        return "briefcase";
      case "JOB_MESSAGE":
        return "chatbubble";
      case "APPLICATION_UPDATE":
        return "checkmark-circle";
      case "SYSTEM":
        return "notifications";
      case "LEGAL_ACTION":
        return "briefcase";
      case "WARNING":
        return "alert-triangle";
      case "ACTION_FORM":
        return "file-text";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "NEARBY_JOB":
        return "#3B82F6";
      case "JOB_MESSAGE":
        return "#10B981";
      case "APPLICATION_UPDATE":
        return "#F59E0B";
      case "SYSTEM":
        return colors.tint;
      case "LEGAL_ACTION":
        return "#8b5cf6";
      case "WARNING":
        return "#f59e0b";
      case "ACTION_FORM":
        return "#10b981";
      default:
        return colors.tint;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "NEARBY_JOB":
        return t("notifications.jobOpportunities");
      case "JOB_MESSAGE":
        return t("notifications.messages");
      case "APPLICATION_UPDATE":
        return t("notifications.applicationUpdates");
      case "SYSTEM":
        return t("notifications.systemNotifications");
      default:
        return t("notifications.other");
    }
  };

  // Toggle section expand/collapse
  const toggleSection = (sectionType: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionType)) {
        newSet.delete(sectionType);
      } else {
        newSet.add(sectionType);
      }
      return newSet;
    });
  };

  // Initialize all sections as expanded by default
  useEffect(() => {
    if (notifications.length > 0) {
      const types = new Set(notifications.map((n) => n.type || "SYSTEM"));
      setExpandedSections((prev) => {
        // Only initialize if empty, otherwise preserve user's choices
        if (prev.size === 0) {
          return types;
        }
        // Add any new types that weren't there before
        const newSet = new Set(prev);
        types.forEach((type) => {
          if (!newSet.has(type)) {
            newSet.add(type);
          }
        });
        return newSet;
      });
    }
  }, [notifications, t]);

  // Group notifications by type
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {};

    notifications.forEach((notification) => {
      const type = notification.type || "SYSTEM";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(notification);
    });

    // Convert to section list format and sort by most recent first
    const sections = Object.entries(groups).map(([type, items]) => ({
      title: getNotificationTypeLabel(type),
      type,
      data: items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }));

    // Sort sections by most recent notification in each group
    return sections.sort((a, b) => {
      const aLatest = new Date(a.data[0]?.createdAt || 0).getTime();
      const bLatest = new Date(b.data[0]?.createdAt || 0).getTime();
      return bLatest - aLatest;
    });
  }, [notifications]);

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("notifications.title")}
            </Text>
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("notifications.title")}
          </Text>
        </View>
        <SectionList
          sections={groupedNotifications.map((section) => ({
            ...section,
            data: expandedSections.has(section.type) ? section.data : [],
          }))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
          renderSectionHeader={({ section }) => {
            const iconColor = getNotificationColor(section.type);
            const isExpanded = expandedSections.has(section.type);
            return (
              <TouchableOpacity
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.4)"
                      : "rgba(255,255,255,0.5)",
                    borderLeftColor: iconColor,
                  },
                ]}
                onPress={() => toggleSection(section.type)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.sectionIconContainer,
                    {
                      backgroundColor: isDark
                        ? `${iconColor}30`
                        : `${iconColor}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(section.type) as any}
                    size={16}
                    color={iconColor}
                  />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {section.title}
                </Text>
                <Text
                  style={[
                    styles.sectionCount,
                    { color: isDark ? "rgba(255,255,255,0.5)" : "#94a3b8" },
                  ]}
                >
                  {section.data.length}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={isDark ? "rgba(255,255,255,0.6)" : "#64748b"}
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            );
          }}
          renderItem={({ item, section }) => {
            const isRead = !!item.readAt;
            const iconColor = getNotificationColor(item.type);

            return (
              <TouchableOpacity
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark
                      ? isRead
                        ? "rgba(30, 41, 59, 0.6)"
                        : "rgba(30, 41, 59, 0.85)"
                      : isRead
                        ? "rgba(255,255,255,0.7)"
                        : "#ffffff",
                    borderColor: isDark
                      ? isRead
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.15)"
                      : isRead
                        ? "rgba(0,0,0,0.05)"
                        : "rgba(0,0,0,0.08)",
                    borderLeftWidth: isRead ? 0 : 3,
                    borderLeftColor: isRead ? "transparent" : iconColor,
                    marginLeft: 12,
                    marginRight: 12,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isDark
                        ? `${iconColor}30`
                        : `${iconColor}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(item.type) as any}
                    size={20}
                    color={iconColor}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: colors.text,
                        fontWeight: isRead ? "500" : "600",
                        opacity: isRead ? 0.8 : 1,
                      },
                    ]}
                  >
                    {item.title || t("notifications.notification")}
                  </Text>
                  <Text
                    style={[
                      styles.cardMessage,
                      {
                        color: isDark ? "rgba(255,255,255,0.7)" : "#64748b",
                        opacity: isRead ? 0.7 : 1,
                      },
                    ]}
                  >
                    {item.body || t("notifications.noMessage")}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      {
                        color: isDark ? "rgba(255,255,255,0.5)" : "#94a3b8",
                      },
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
                {!isRead && (
                  <View
                    style={[styles.unreadDot, { backgroundColor: iconColor }]}
                  />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="notifications-outline"
                size={64}
                color={isDark ? "rgba(255,255,255,0.3)" : "#94a3b8"}
              />
              <Text
                style={[
                  styles.empty,
                  {
                    color: isDark ? "rgba(255,255,255,0.5)" : "#64748b",
                  },
                ]}
              >
                {t("notifications.noNewNotifications")}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: "flex-start",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 16, marginBottom: 4 },
  cardMessage: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
  time: { fontSize: 12 },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  sectionIconContainer: {
    padding: 6,
    borderRadius: 6,
    marginRight: 10,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});
