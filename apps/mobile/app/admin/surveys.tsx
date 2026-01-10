import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface SurveyTicket {
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
  createdAt: string;
}

export default function SurveysScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"employer" | "provider">("employer");
  const [employerSurveys, setEmployerSurveys] = useState<SurveyTicket[]>([]);
  const [providerSurveys, setProviderSurveys] = useState<SurveyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Fetch employer surveys
      const employerRes = await fetch(
        `${base}/support/admin/tickets?category=EMPLOYER_SURVEY&scope=all`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (employerRes.ok) {
        const employerData = await employerRes.json();
        setEmployerSurveys(employerData.tickets || []);
      }

      // Fetch provider surveys
      const providerRes = await fetch(
        `${base}/support/admin/tickets?category=PROVIDER_SURVEY&scope=all`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (providerRes.ok) {
        const providerData = await providerRes.json();
        setProviderSurveys(providerData.tickets || []);
      }
    } catch (error: any) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSurveys();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserName = (survey: SurveyTicket) => {
    if (survey.user) {
      return `${survey.user.firstName} ${survey.user.lastName}`;
    }
    return survey.name || "Anonymous";
  };

  const getUserEmail = (survey: SurveyTicket) => {
    return survey.user?.email || survey.email || "No email";
  };

  const renderSurveyCard = (survey: SurveyTicket) => {
    const userName = getUserName(survey);
    const userEmail = getUserEmail(survey);

    return (
      <TouchableOpacity
        key={survey.id}
        style={[
          styles.surveyCard,
          {
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          },
        ]}
        onPress={() => router.push(`/admin/survey-detail?id=${survey.id}` as never)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)",
                },
              ]}
            >
              <Feather
                name="clipboard"
                size={20}
                color={isDark ? "#818cf8" : "#6366f1"}
              />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={[styles.surveyTitle, { color: colors.text }]}>
                {survey.category === "EMPLOYER_SURVEY" ? "Employer Survey" : "Service Provider Survey"}
              </Text>
              <Text style={[styles.surveyDate, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {formatDate(survey.createdAt)}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userInfoRow}>
            <Feather name="user" size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text style={[styles.userInfoText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              {userName}
            </Text>
          </View>
          <View style={styles.userInfoRow}>
            <Feather name="mail" size={14} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text style={[styles.userInfoText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              {userEmail}
            </Text>
          </View>
        </View>

        <View style={styles.messagePreview}>
          <Text
            style={[styles.messagePreviewText, { color: isDark ? "#cbd5e1" : "#64748b" }]}
            numberOfLines={2}
          >
            {survey.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const currentSurveys = activeTab === "employer" ? employerSurveys : providerSurveys;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              {
                padding: 8,
                borderRadius: 8,
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Surveys</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tabs */}
        <View
          style={[
            styles.tabContainer,
            {
              backgroundColor: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(255, 255, 255, 0.5)",
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "employer" && {
                backgroundColor: isDark ? "#6366f1" : colors.tint,
              },
            ]}
            onPress={() => setActiveTab("employer")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "employer"
                      ? "#fff"
                      : isDark
                      ? "#94a3b8"
                      : "#64748b",
                },
              ]}
            >
              Employer Surveys ({employerSurveys.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "provider" && {
                backgroundColor: isDark ? "#6366f1" : colors.tint,
              },
            ]}
            onPress={() => setActiveTab("provider")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "provider"
                      ? "#fff"
                      : isDark
                      ? "#94a3b8"
                      : "#64748b",
                },
              ]}
            >
              Provider Surveys ({providerSurveys.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : currentSurveys.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="clipboard" size={48} color={isDark ? "#475569" : "#94a3b8"} />
            <Text style={[styles.emptyText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              No {activeTab === "employer" ? "employer" : "provider"} surveys yet
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
            }
          >
            {currentSurveys.map(renderSurveyCard)}
          </ScrollView>
        )}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  surveyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  surveyDate: {
    fontSize: 12,
  },
  userInfo: {
    marginBottom: 12,
    gap: 8,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userInfoText: {
    fontSize: 13,
  },
  messagePreview: {
    marginTop: 8,
  },
  messagePreviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  TouchableButton: {},
});

