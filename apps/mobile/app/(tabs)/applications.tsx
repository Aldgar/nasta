import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

type FilterStatus =
  | "ALL"
  | "REQUESTED"
  | "PENDING"
  | "ACCEPTED"
  | "COMPLETED"
  | "REJECTED";

interface BackendApp {
  id: string;
  status: string;
  appliedAt: string;
  completedAt?: string;
  jobId?: string;
  job?: {
    id: string;
    title: string;
    city?: string;
    country?: string;
    type?: string;
    workMode?: string;
    isInstantBook?: boolean;
    category?: { id: string; name: string } | string;
    company?: { id: string; name: string };
  };
}

interface AppItem {
  id: string;
  status: string;
  appliedAt: string;
  completedAt?: string;
  jobTitle: string;
  jobCity?: string;
  jobCountry?: string;
  jobType?: string;
  workMode?: string;
  isInstant?: boolean;
  category?: string;
  company?: string;
}

function statusLabel(
  raw: string,
  hasCompleted: boolean,
  t: (key: string) => string,
): string {
  if (raw.toUpperCase() === "ACCEPTED" && hasCompleted) {
    return t("applications.statusCompleted");
  }
  switch (raw.toUpperCase()) {
    case "REQUESTED":
      return t("applications.statusRequested");
    case "PENDING":
      return t("applications.statusPending");
    case "REVIEWING":
      return t("applications.statusReviewing");
    case "SHORTLISTED":
      return t("applications.statusShortlisted");
    case "ACCEPTED":
      return t("applications.statusAccepted");
    case "REJECTED":
      return t("applications.statusRejected");
    case "WITHDRAWN":
      return t("applications.statusWithdrawn");
    default:
      return raw;
  }
}

function statusColor(
  raw: string,
  isDark: boolean,
  hasCompleted?: boolean,
): string {
  if (raw.toUpperCase() === "ACCEPTED" && hasCompleted) {
    return "#8B5CF6"; // purple for completed
  }
  switch (raw.toUpperCase()) {
    case "REQUESTED":
      return "#60A5FA";
    case "PENDING":
    case "REVIEWING":
      return "#E8B86D";
    case "ACCEPTED":
      return "#22c55e";
    case "REJECTED":
      return "#ef4444";
    case "WITHDRAWN":
      return isDark ? "rgba(255,250,240,0.4)" : "rgba(0,0,0,0.4)";
    default:
      return isDark ? "#FFFAF0" : "#1a1a2e";
  }
}

function progressForStatus(raw: string, hasCompleted?: boolean): number {
  if (raw.toUpperCase() === "ACCEPTED" && hasCompleted) return 1;
  switch (raw.toUpperCase()) {
    case "REQUESTED":
      return 0.1;
    case "PENDING":
      return 0.2;
    case "REVIEWING":
      return 0.35;
    case "SHORTLISTED":
      return 0.5;
    case "ACCEPTED":
      return 0.85;
    case "REJECTED":
    case "WITHDRAWN":
      return 1;
    default:
      return 0.1;
  }
}

function timeAgo(
  dateStr: string,
  t: (key: string, params?: any) => string,
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t("applications.track.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("applications.track.hoursAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("applications.track.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString();
}

export default function MyApplicationsTab() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  const fetchApps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;
      const base = getApiBase();
      const res = await fetch(`${base}/applications/me?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: BackendApp[] = await res.json();
        const items: AppItem[] = (Array.isArray(data) ? data : []).map((a) => {
          const cat = a.job?.category;
          return {
            id: a.id,
            status: a.status,
            appliedAt: a.appliedAt,
            completedAt: a.completedAt,
            jobTitle: a.job?.title || "Untitled Job",
            jobCity: a.job?.city,
            jobCountry: a.job?.country,
            jobType: a.job?.type,
            workMode: a.job?.workMode,
            isInstant: a.job?.isInstantBook,
            category:
              typeof cat === "object" && cat
                ? cat.name
                : typeof cat === "string"
                  ? cat
                  : undefined,
            company: a.job?.company?.name,
          };
        });
        setApps(items);
      }
    } catch (err) {
      console.error("Error fetching applications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchApps();
    }, []),
  );

  const filtered = apps.filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "REQUESTED") return a.status.toUpperCase() === "REQUESTED";
    if (filter === "PENDING")
      return (
        ["PENDING", "REVIEWING", "SHORTLISTED"].includes(
          a.status.toUpperCase(),
        ) ||
        (a.status.toUpperCase() === "ACCEPTED" && !a.completedAt)
      );
    if (filter === "ACCEPTED")
      return a.status.toUpperCase() === "ACCEPTED" && !a.completedAt;
    if (filter === "COMPLETED")
      return a.status.toUpperCase() === "ACCEPTED" && !!a.completedAt;
    if (filter === "REJECTED")
      return ["REJECTED", "WITHDRAWN"].includes(a.status.toUpperCase());
    return true;
  });

  const counts = {
    total: apps.length,
    requests: apps.filter((a) => a.status.toUpperCase() === "REQUESTED").length,
    active: apps.filter((a) =>
      ["PENDING", "REVIEWING", "SHORTLISTED"].includes(a.status.toUpperCase()),
    ).length,
    accepted: apps.filter(
      (a) => a.status.toUpperCase() === "ACCEPTED" && !a.completedAt,
    ).length,
    completed: apps.filter(
      (a) => a.status.toUpperCase() === "ACCEPTED" && !!a.completedAt,
    ).length,
    rejected: apps.filter((a) =>
      ["REJECTED", "WITHDRAWN"].includes(a.status.toUpperCase()),
    ).length,
  };

  const cardBg = isDark ? "rgba(12, 22, 42, 0.75)" : "rgba(255, 248, 235, 0.9)";
  const cardBorder = isDark ? "rgba(201,150,63,0.2)" : "rgba(184,130,42,0.12)";
  const mutedText = isDark ? "rgba(255,250,240,0.5)" : "rgba(0,0,0,0.45)";
  const gold = "#E8B86D";

  const renderItem = ({ item }: { item: AppItem }) => {
    const isCompleted = !!(
      item.status.toUpperCase() === "ACCEPTED" && item.completedAt
    );
    const progress = progressForStatus(item.status, isCompleted);
    const sColor = statusColor(item.status, isDark, isCompleted);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: cardBg, borderColor: cardBorder },
        ]}
        activeOpacity={0.7}
        onPress={() => router.push(`/my-application/${item.id}`)}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.jobTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.jobTitle}
            </Text>
            {item.company ? (
              <Text
                style={[styles.company, { color: mutedText }]}
                numberOfLines={1}
              >
                {item.company}
              </Text>
            ) : null}
          </View>
          {item.isInstant && (
            <View
              style={[
                styles.instantBadge,
                {
                  backgroundColor: isDark
                    ? "rgba(232,184,109,0.15)"
                    : "rgba(201,150,63,0.1)",
                },
              ]}
            >
              <Ionicons name="flash" size={12} color={gold} />
              <Text
                style={{
                  color: gold,
                  fontSize: 11,
                  fontWeight: "600",
                  marginLeft: 2,
                }}
              >
                {t("applications.track.instant")}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          {item.jobCity || item.jobCountry ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={12} color={mutedText} />
              <Text style={[styles.metaText, { color: mutedText }]}>
                {[item.jobCity, item.jobCountry].filter(Boolean).join(", ")}
              </Text>
            </View>
          ) : null}
          {item.category ? (
            <View style={styles.metaItem}>
              <Feather name="tag" size={12} color={mutedText} />
              <Text style={[styles.metaText, { color: mutedText }]}>
                {item.category}
              </Text>
            </View>
          ) : null}
          {item.jobType ? (
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={mutedText} />
              <Text style={[styles.metaText, { color: mutedText }]}>
                {item.jobType.replace(/_/g, " ")}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: sColor }]} />
            <Text style={[styles.statusText, { color: sColor }]}>
              {statusLabel(item.status, isCompleted, t)}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: mutedText }]}>
            {timeAgo(item.completedAt || item.appliedAt, t)}
          </Text>
        </View>

        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor: isDark
                ? "rgba(255,250,240,0.08)"
                : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor:
                  item.status.toUpperCase() === "REJECTED"
                    ? "#ef4444"
                    : isCompleted
                      ? "#8B5CF6"
                      : gold,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="locate" size={22} color={gold} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("navigation.myApplications") || "Track"}
          </Text>
        </View>

        {/* Summary Cards (clickable filters) */}
        <View style={styles.summaryRow}>
          {(
            [
              {
                key: "ALL" as FilterStatus,
                label: t("applications.track.total"),
                value: counts.total,
                color: colors.text,
              },
              {
                key: "REQUESTED" as FilterStatus,
                label: t("applications.track.requests"),
                value: counts.requests,
                color: "#60A5FA",
              },
              {
                key: "PENDING" as FilterStatus,
                label: t("applications.track.active"),
                value: counts.active,
                color: gold,
              },
              {
                key: "ACCEPTED" as FilterStatus,
                label: t("applications.track.accepted"),
                value: counts.accepted,
                color: "#22c55e",
              },
              {
                key: "COMPLETED" as FilterStatus,
                label: t("applications.track.completed"),
                value: counts.completed,
                color: "#8B5CF6",
              },
              {
                key: "REJECTED" as FilterStatus,
                label: t("applications.track.rejected"),
                value: counts.rejected,
                color: "#ef4444",
              },
            ] as const
          ).map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: cardBg,
                  borderColor: filter === s.key ? s.color : cardBorder,
                  borderWidth: filter === s.key ? 1.5 : 1,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setFilter(s.key)}
            >
              <Text style={[styles.summaryValue, { color: s.color }]}>
                {s.value}
              </Text>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: filter === s.key ? s.color : mutedText },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={gold} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={mutedText}
            />
            <Text style={[styles.emptyText, { color: mutedText }]}>
              {filter === "ALL"
                ? t("applications.track.noApplications")
                : t("applications.track.noFilteredApplications")}
            </Text>
            <Text style={[styles.emptyHint, { color: mutedText }]}>
              {t("applications.track.browseJobs")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchApps(true)}
                tintColor={gold}
              />
            }
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  company: {
    fontSize: 13,
    marginTop: 1,
  },
  instantBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 12,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 13,
  },
});
