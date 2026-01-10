import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
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

export default function SurveyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const surveyId = params.id as string;
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [survey, setSurvey] = useState<SurveyTicket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  const fetchSurvey = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/support/admin/tickets/${surveyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSurvey(data);
      } else {
        router.back();
      }
    } catch (error) {
      console.error("Error fetching survey:", error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseSurveyMessage = (message: string) => {
    const lines = message.split("\n").filter((line) => line.trim());
    const questions: { question: string; answer: string }[] = [];

    lines.forEach((line) => {
      const match = line.match(/^(\d+)\.\s*(.+?):\s*(.+)$/);
      if (match) {
        const [, number, question, answer] = match;
        questions.push({ question: question.trim(), answer: answer.trim() });
      } else if (line.includes(":")) {
        const [question, ...answerParts] = line.split(":");
        questions.push({
          question: question.trim(),
          answer: answerParts.join(":").trim() || t("common.notAvailable"),
        });
      }
    });

    return questions;
  };

  const getImprovementAreas = (questions: { question: string; answer: string }[]) => {
    const improvementQuestions = questions.filter(
      (q) =>
        q.question.toLowerCase().includes("improve") ||
        q.question.toLowerCase().includes("better") ||
        q.question.toLowerCase().includes("suggestion")
    );
    return improvementQuestions.map((q) => q.answer).filter((a) => a !== t("common.notAvailable"));
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!survey) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t("admin.surveyNotFound")}</Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const userName = survey.user
    ? `${survey.user.firstName || ""} ${survey.user.lastName || ""}`.trim() || survey.user.email || t("admin.user")
    : survey.name || t("admin.anonymous");
  const userEmail = survey.user?.email || survey.email || t("admin.noEmail");
  const userPhone = survey.user?.phone || null;
  const isEmployerSurvey = survey.category === "EMPLOYER_SURVEY";
  const questions = parseSurveyMessage(survey.message);
  const improvementAreas = getImprovementAreas(questions);

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
              styles.backButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Survey Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Survey Info Card */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)",
                  },
                ]}
              >
                <Feather name="tag" size={20} color={isDark ? "#818cf8" : "#6366f1"} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  {t("admin.surveyType")}
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {isEmployerSurvey ? t("admin.employerSurvey") : t("admin.serviceProviderSurvey")}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)",
                  },
                ]}
              >
                <Feather name="calendar" size={20} color={isDark ? "#818cf8" : "#6366f1"} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Submitted
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatDate(survey.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Information</Text>
            <View style={styles.contactRow}>
              <Feather name="user" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text style={[styles.contactText, { color: colors.text }]}>{userName}</Text>
            </View>
            <View style={styles.contactRow}>
              <Feather name="mail" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text style={[styles.contactText, { color: colors.text }]}>{userEmail}</Text>
            </View>
            {userPhone && (
              <View style={styles.contactRow}>
                <Feather name="phone" size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text style={[styles.contactText, { color: colors.text }]}>{userPhone}</Text>
              </View>
            )}
          </View>

          {/* Survey Responses */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Survey Responses</Text>
            {questions.map((item, index) => (
              <View key={index} style={styles.questionItem}>
                <Text style={[styles.questionText, { color: colors.text }]}>{item.question}</Text>
                <Text style={[styles.answerText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  {item.answer}
                </Text>
              </View>
            ))}
          </View>

          {/* Areas for Improvement */}
          {improvementAreas.length > 0 && (
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark ? "rgba(251, 191, 36, 0.1)" : "rgba(251, 191, 36, 0.05)",
                  borderColor: isDark ? "rgba(251, 191, 36, 0.3)" : "rgba(251, 191, 36, 0.2)",
                  borderLeftWidth: 4,
                },
              ]}
            >
              <View style={styles.improvementHeader}>
                <Feather name="trending-up" size={20} color={isDark ? "#fbbf24" : "#f59e0b"} />
                <Text style={[styles.improvementTitle, { color: isDark ? "#fbbf24" : "#d97706" }]}>
                  Areas for Improvement
                </Text>
              </View>
              {improvementAreas.map((area, index) => (
                <View key={index} style={styles.improvementItem}>
                  <Text style={[styles.improvementText, { color: isDark ? "#fde68a" : "#92400e" }]}>
                    • {area}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  infoContent: {
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
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 12,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  contactText: {
    fontSize: 15,
    fontWeight: "500",
  },
  questionItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  questionText: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  improvementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  improvementTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  improvementItem: {
    marginBottom: 12,
  },
  improvementText: {
    fontSize: 15,
    lineHeight: 22,
  },
});

