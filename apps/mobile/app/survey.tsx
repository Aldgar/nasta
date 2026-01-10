import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableButton } from "../components/TouchableButton";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";

type UserRole = "EMPLOYER" | "JOB_SEEKER";

interface EmployerSurveyData {
  serviceType: string;
  satisfaction: string;
  npsScore: string;
  professionalism: string;
  punctuality: string;
  qualityOfWork: string;
  communication: string;
  hasTools: string;
  completedOnTime: string;
  timeExplanation: string;
  bookingEase: string;
  likedMost: string;
  improvements: string;
  futureServices: string;
}

interface ServiceProviderSurveyData {
  platformSatisfaction: string;
  npsScore: string;
  jobAvailability: string;
  paymentProcess: string;
  employerCommunication: string;
  appUsability: string;
  supportQuality: string;
  likedMost: string;
  improvements: string;
  futureFeatures: string;
}

export default function SurveyScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Employer survey state
  const [employerData, setEmployerData] = useState<EmployerSurveyData>({
    serviceType: "",
    satisfaction: "",
    npsScore: "",
    professionalism: "",
    punctuality: "",
    qualityOfWork: "",
    communication: "",
    hasTools: "",
    completedOnTime: "",
    timeExplanation: "",
    bookingEase: "",
    likedMost: "",
    improvements: "",
    futureServices: "",
  });

  // Service Provider survey state
  const [providerData, setProviderData] = useState<ServiceProviderSurveyData>({
    platformSatisfaction: "",
    npsScore: "",
    jobAvailability: "",
    paymentProcess: "",
    employerCommunication: "",
    appUsability: "",
    supportQuality: "",
    likedMost: "",
    improvements: "",
    futureFeatures: "",
  });

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // /auth/profile returns { user: { role: ... } }
        const role = data.user?.role || data.role;
        if (role === "EMPLOYER" || role === "JOB_SEEKER") {
          setUserRole(role as UserRole);
        } else {
          console.error(
            "Invalid or missing role:",
            role,
            "Full response:",
            data
          );
        }
      } else {
        const errorText = await res.text();
        console.error("Failed to fetch user role:", res.status, errorText);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateEmployerData = (
    field: keyof EmployerSurveyData,
    value: string
  ) => {
    setEmployerData((prev) => ({ ...prev, [field]: value }));
  };

  const updateProviderData = (
    field: keyof ServiceProviderSurveyData,
    value: string
  ) => {
    setProviderData((prev) => ({ ...prev, [field]: value }));
  };

  const submitSurvey = async () => {
    try {
      setSubmitting(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const surveyData = userRole === "EMPLOYER" ? employerData : providerData;
      const surveyType =
        userRole === "EMPLOYER" ? "EMPLOYER_SURVEY" : "PROVIDER_SURVEY";

      // Format the survey data into a message
      let message = `Survey Type: ${surveyType}\n\n`;
      if (userRole === "EMPLOYER") {
        const employerSurvey = surveyData as EmployerSurveyData;
        message += `1. Service Type: ${employerSurvey.serviceType || "N/A"}\n`;
        message += `2. Overall Satisfaction: ${employerSurvey.satisfaction || "N/A"}\n`;
        message += `3. NPS Score: ${employerSurvey.npsScore || "N/A"}\n`;
        message += `4. Service Provider Ratings:\n`;
        message += `   - Professionalism: ${employerSurvey.professionalism || "N/A"}\n`;
        message += `   - Punctuality: ${employerSurvey.punctuality || "N/A"}\n`;
        message += `   - Quality of Work: ${employerSurvey.qualityOfWork || "N/A"}\n`;
        message += `   - Communication: ${employerSurvey.communication || "N/A"}\n`;
        message += `5. Tools/Equipment: ${employerSurvey.hasTools || "N/A"}\n`;
        message += `6. Completed On Time: ${employerSurvey.completedOnTime || "N/A"}\n`;
        if (employerSurvey.timeExplanation) {
          message += `   Explanation: ${employerSurvey.timeExplanation}\n`;
        }
        message += `7. Booking Ease: ${employerSurvey.bookingEase || "N/A"}\n`;
        message += `8. What you liked most: ${employerSurvey.likedMost || "N/A"}\n`;
        message += `9. Improvements: ${employerSurvey.improvements || "N/A"}\n`;
        message += `10. Future Services: ${employerSurvey.futureServices || "N/A"}\n`;
      } else {
        const providerSurvey = surveyData as ServiceProviderSurveyData;
        message += `1. Platform Satisfaction: ${providerSurvey.platformSatisfaction || "N/A"}\n`;
        message += `2. NPS Score: ${providerSurvey.npsScore || "N/A"}\n`;
        message += `3. Job Availability: ${providerSurvey.jobAvailability || "N/A"}\n`;
        message += `4. Payment Process: ${providerSurvey.paymentProcess || "N/A"}\n`;
        message += `5. Employer Communication: ${providerSurvey.employerCommunication || "N/A"}\n`;
        message += `6. App Usability: ${providerSurvey.appUsability || "N/A"}\n`;
        message += `7. Support Quality: ${providerSurvey.supportQuality || "N/A"}\n`;
        message += `8. What you liked most: ${providerSurvey.likedMost || "N/A"}\n`;
        message += `9. Improvements: ${providerSurvey.improvements || "N/A"}\n`;
        message += `10. Future Features: ${providerSurvey.futureFeatures || "N/A"}\n`;
      }

      const response = await fetch(`${base}/support/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: `${userRole === "EMPLOYER" ? "Employer" : "Service Provider"} Survey Response`,
          message: message,
          category:
            userRole === "EMPLOYER" ? "EMPLOYER_SURVEY" : "PROVIDER_SURVEY",
          priority: "NORMAL",
        }),
      });

      if (response.ok) {
        Alert.alert(t("survey.thankYou"), t("survey.feedbackSubmitted"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        const error = await response
          .json()
          .catch(() => ({ message: "Failed to submit survey" }));
        Alert.alert(
          t("common.error"),
          error.message || t("survey.failedToSubmitSurvey")
        );
      }
    } catch (error: any) {
      console.error("Error submitting survey:", error);
      Alert.alert(t("common.error"), t("common.failedToConnectToServer"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderEmployerSurvey = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.introSection}>
        <Text style={[styles.introTitle, { color: colors.text }]}>
          {t("survey.employer.introTitle")}
        </Text>
        <Text
          style={[styles.introText, { color: isDark ? "#cbd5e1" : "#64748b" }]}
        >
          {t("survey.employer.introText")}
        </Text>
      </View>

      {/* Question 1 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question1")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.employer.question1Placeholder")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          value={employerData.serviceType}
          onChangeText={(text) => updateEmployerData("serviceType", text)}
        />
      </View>

      {/* Question 2 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question2")}
        </Text>
        <Text
          style={[styles.hintText, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {t("survey.employer.question2Hint")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    employerData.satisfaction === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    employerData.satisfaction === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateEmployerData("satisfaction", num.toString())}
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      employerData.satisfaction === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 3 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question3")}
        </Text>
        <Text
          style={[styles.hintText, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {t("survey.employer.question3Hint")}
        </Text>
        <View style={styles.npsContainer}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.npsButton,
                {
                  backgroundColor:
                    employerData.npsScore === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    employerData.npsScore === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateEmployerData("npsScore", num.toString())}
            >
              <Text
                style={[
                  styles.npsText,
                  {
                    color:
                      employerData.npsScore === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 4 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question4")}
        </Text>
        {[
          {
            key: "professionalism" as const,
            label: t("survey.professionalism"),
          },
          { key: "punctuality" as const, label: t("survey.punctuality") },
          { key: "qualityOfWork" as const, label: t("survey.qualityOfWork") },
          { key: "communication" as const, label: t("survey.communication") },
        ].map(({ key, label }) => (
          <View key={key} style={styles.subQuestionContainer}>
            <Text
              style={[
                styles.subQuestionText,
                { color: isDark ? "#cbd5e1" : "#64748b" },
              ]}
            >
              {label} {t("survey.employer.question4SubHint")}
            </Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.ratingButton,
                    {
                      backgroundColor:
                        employerData[key] === num.toString()
                          ? isDark
                            ? "#6366f1"
                            : colors.tint
                          : isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                      borderColor:
                        employerData[key] === num.toString()
                          ? isDark
                            ? "#6366f1"
                            : colors.tint
                          : isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => updateEmployerData(key, num.toString())}
                >
                  <Text
                    style={[
                      styles.ratingText,
                      {
                        color:
                          employerData[key] === num.toString()
                            ? "#fff"
                            : colors.text,
                      },
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Question 5 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question5")}
        </Text>
        <View style={styles.optionsContainer}>
          {[
            t("survey.employer.yes"),
            t("survey.employer.no"),
            t("survey.employer.partially"),
          ].map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                {
                  backgroundColor:
                    employerData.hasTools === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    employerData.hasTools === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateEmployerData("hasTools", option)}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      employerData.hasTools === option ? "#fff" : colors.text,
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 6 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question6")}
        </Text>
        <View style={styles.optionsContainer}>
          {[t("survey.employer.yes"), t("survey.employer.no")].map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                {
                  backgroundColor:
                    employerData.completedOnTime === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    employerData.completedOnTime === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateEmployerData("completedOnTime", option)}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      employerData.completedOnTime === option
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {employerData.completedOnTime === t("survey.employer.no") && (
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                color: colors.text,
                borderColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.1)",
                marginTop: 12,
              },
            ]}
            placeholder={t("survey.pleaseBrieflyExplain")}
            placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
            multiline
            numberOfLines={3}
            value={employerData.timeExplanation}
            onChangeText={(text) => updateEmployerData("timeExplanation", text)}
          />
        )}
      </View>

      {/* Question 7 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question7")}
        </Text>
        <View style={styles.optionsContainer}>
          {[
            t("survey.employer.veryDifficult"),
            t("survey.employer.difficult"),
            t("survey.employer.neutral"),
            t("survey.employer.easy"),
            t("survey.employer.veryEasy"),
          ].map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                {
                  backgroundColor:
                    employerData.bookingEase === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    employerData.bookingEase === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateEmployerData("bookingEase", option)}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      employerData.bookingEase === option
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 8 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question8")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.shareWhatYouEnjoyed")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={4}
          value={employerData.likedMost}
          onChangeText={(text) => updateEmployerData("likedMost", text)}
        />
      </View>

      {/* Question 9 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question9")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.shareYourSuggestions")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={4}
          value={employerData.improvements}
          onChangeText={(text) => updateEmployerData("improvements", text)}
        />
      </View>

      {/* Question 10 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.employer.question10")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.employer.question10Placeholder")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={3}
          value={employerData.futureServices}
          onChangeText={(text) => updateEmployerData("futureServices", text)}
        />
      </View>

      <View style={styles.submitContainer}>
        <TouchableButton
          style={[
            styles.submitButton,
            {
              backgroundColor: isDark ? "#6366f1" : colors.tint,
              opacity: submitting ? 0.6 : 1,
            },
          ]}
          onPress={submitSurvey}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {t("survey.employer.submitSurvey")}
            </Text>
          )}
        </TouchableButton>
      </View>
    </ScrollView>
  );

  const renderServiceProviderSurvey = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.introSection}>
        <Text style={[styles.introTitle, { color: colors.text }]}>
          {t("survey.serviceProvider.introTitle")}
        </Text>
        <Text
          style={[styles.introText, { color: isDark ? "#cbd5e1" : "#64748b" }]}
        >
          {t("survey.serviceProvider.introText")}
        </Text>
      </View>

      {/* Question 1 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question1")}
        </Text>
        <Text
          style={[styles.hintText, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {t("survey.serviceProvider.question1Hint")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    providerData.platformSatisfaction === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.platformSatisfaction === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() =>
                updateProviderData("platformSatisfaction", num.toString())
              }
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      providerData.platformSatisfaction === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 2 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question2")}
        </Text>
        <Text
          style={[styles.hintText, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {t("survey.serviceProvider.question2Hint")}
        </Text>
        <View style={styles.npsContainer}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.npsButton,
                {
                  backgroundColor:
                    providerData.npsScore === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.npsScore === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateProviderData("npsScore", num.toString())}
            >
              <Text
                style={[
                  styles.npsText,
                  {
                    color:
                      providerData.npsScore === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 3 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question3")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    providerData.jobAvailability === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.jobAvailability === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() =>
                updateProviderData("jobAvailability", num.toString())
              }
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      providerData.jobAvailability === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 4 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question4")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    providerData.paymentProcess === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.paymentProcess === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() =>
                updateProviderData("paymentProcess", num.toString())
              }
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      providerData.paymentProcess === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 5 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question5")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    providerData.employerCommunication === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.employerCommunication === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() =>
                updateProviderData("employerCommunication", num.toString())
              }
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      providerData.employerCommunication === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 6 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question6")}
        </Text>
        <View style={styles.optionsContainer}>
          {[
            t("survey.serviceProvider.veryDifficult"),
            t("survey.serviceProvider.difficult"),
            t("survey.serviceProvider.neutral"),
            t("survey.serviceProvider.easy"),
            t("survey.serviceProvider.veryEasy"),
          ].map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                {
                  backgroundColor:
                    providerData.appUsability === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.appUsability === option
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() => updateProviderData("appUsability", option)}
            >
              <Text
                style={[
                  styles.optionText,
                  {
                    color:
                      providerData.appUsability === option
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 7 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question7")}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.ratingButton,
                {
                  backgroundColor:
                    providerData.supportQuality === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                  borderColor:
                    providerData.supportQuality === num.toString()
                      ? isDark
                        ? "#6366f1"
                        : colors.tint
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                },
              ]}
              onPress={() =>
                updateProviderData("supportQuality", num.toString())
              }
            >
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      providerData.supportQuality === num.toString()
                        ? "#fff"
                        : colors.text,
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question 8 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question8")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.serviceProvider.question8Placeholder")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={4}
          value={providerData.likedMost}
          onChangeText={(text) => updateProviderData("likedMost", text)}
        />
      </View>

      {/* Question 9 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question9")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.shareYourSuggestions")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={4}
          value={providerData.improvements}
          onChangeText={(text) => updateProviderData("improvements", text)}
        />
      </View>

      {/* Question 10 */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {t("survey.serviceProvider.question10")}
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: colors.text,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
          ]}
          placeholder={t("survey.serviceProvider.question10Placeholder")}
          placeholderTextColor={isDark ? "#9ca3af" : "#94a3b8"}
          multiline
          numberOfLines={3}
          value={providerData.futureFeatures}
          onChangeText={(text) => updateProviderData("futureFeatures", text)}
        />
      </View>

      <View style={styles.submitContainer}>
        <TouchableButton
          style={[
            styles.submitButton,
            {
              backgroundColor: isDark ? "#6366f1" : colors.tint,
              opacity: submitting ? 0.6 : 1,
            },
          ]}
          onPress={submitSurvey}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {t("survey.employer.submitSurvey")}
            </Text>
          )}
        </TouchableButton>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableButton onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableButton>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("survey.title")}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
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
          <TouchableButton onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("survey.title")}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        {userRole === "EMPLOYER" ? (
          renderEmployerSurvey()
        ) : userRole === "JOB_SEEKER" ? (
          renderServiceProviderSurvey()
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={[styles.errorText, { color: colors.text }]}>
              {t("survey.unableToDetermineRole")}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  introSection: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: "italic",
  },
  subQuestionContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  subQuestionText: {
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "700",
  },
  npsContainer: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  npsButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  npsText: {
    fontSize: 14,
    fontWeight: "600",
  },
  optionsContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitContainer: {
    marginTop: 32,
    marginBottom: 20,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
