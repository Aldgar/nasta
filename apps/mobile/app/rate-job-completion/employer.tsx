import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

export default function EmployerRatingScreen() {
  const router = useRouter();
  const { applicationId, serviceProviderName } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const [platformRating, setPlatformRating] = useState(0);
  const [easeOfServiceRating, setEaseOfServiceRating] = useState(0);
  const [serviceProviderRating, setServiceProviderRating] = useState(0);
  const [platformComment, setPlatformComment] = useState("");
  const [easeOfServiceComment, setEaseOfServiceComment] = useState("");
  const [serviceProviderComment, setServiceProviderComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const Star = ({
    index,
    filled,
    onPress,
  }: {
    index: number;
    filled: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress}>
      <Feather
        name="star"
        size={36}
        color={filled ? "#fbbf24" : isDark ? "#4b5563" : "#d1d5db"}
        style={{ marginHorizontal: 4 }}
      />
    </TouchableOpacity>
  );

  const handleSubmit = async () => {
    if (platformRating === 0 || easeOfServiceRating === 0 || serviceProviderRating === 0) {
      Alert.alert(t("common.error"), t("ratings.pleaseRateAll"));
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("applications.authenticationRequired"));
        setSubmitting(false);
        return;
      }

      const base = getApiBase();
      const res = await fetch(
        `${base}/ratings/applications/${applicationId}/employer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            platformRating,
            easeOfServiceRating,
            serviceProviderRating,
            platformComment: platformComment.trim() || undefined,
            easeOfServiceComment: easeOfServiceComment.trim() || undefined,
            serviceProviderComment: serviceProviderComment.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        Alert.alert(
          t("ratings.thankYou"),
          t("ratings.ratingSubmitted"),
          [{ text: t("common.ok"), onPress: () => router.back() }]
        );
      } else {
        const err = await res.json().catch(() => ({
          message: t("ratings.failedToSubmit"),
        }));
        Alert.alert(t("common.error"), err.message || t("ratings.failedToSubmit"));
      }
    } catch (error) {
      console.log("Rating Error", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("ratings.rateYourExperience")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Platform Rating */}
          <View style={styles.ratingSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("ratings.ratePlatform")}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {t("ratings.howWasPlatformExperience")}
            </Text>
            <View style={styles.starsContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  index={i}
                  filled={i < platformRating}
                  onPress={() => setPlatformRating(i + 1)}
                />
              ))}
            </View>
            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                },
              ]}
              placeholder={t("ratings.optionalComment")}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={platformComment}
              onChangeText={setPlatformComment}
            />
          </View>

          {/* Ease of Service Rating */}
          <View style={styles.ratingSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("ratings.rateEaseOfService")}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {t("ratings.howEasyWasService")}
            </Text>
            <View style={styles.starsContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  index={i}
                  filled={i < easeOfServiceRating}
                  onPress={() => setEaseOfServiceRating(i + 1)}
                />
              ))}
            </View>
            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                },
              ]}
              placeholder={t("ratings.optionalComment")}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={easeOfServiceComment}
              onChangeText={setEaseOfServiceComment}
            />
          </View>

          {/* Service Provider Rating */}
          <View style={styles.ratingSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("ratings.rateServiceProvider")}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {t("ratings.howWasServiceProvider", { name: serviceProviderName || t("auth.serviceProvider") })}
            </Text>
            <View style={styles.starsContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  index={i}
                  filled={i < serviceProviderRating}
                  onPress={() => setServiceProviderRating(i + 1)}
                />
              ))}
            </View>
            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                },
              ]}
              placeholder={t("ratings.optionalComment")}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={serviceProviderComment}
              onChangeText={setServiceProviderComment}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: isDark ? "#6366f1" : "#4f46e5",
                opacity: submitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{t("ratings.submitRating")}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  backBtn: { padding: 4 },
  content: { padding: 24 },
  ratingSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  commentInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

