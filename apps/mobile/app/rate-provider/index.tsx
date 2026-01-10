import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

export default function RateProviderScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const { colors, theme, isDark } = useTheme();
  const { t } = useLanguage();
  
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t("rateProvider.ratingRequired"), t("rateProvider.pleaseSelectRating"));
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
        const res = await fetch(`${base}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                targetUserId: id,
                rating,
                comment: review
            })
        });

        if (res.ok) {
            Alert.alert(t("rateProvider.thankYou"), t("rateProvider.reviewSubmitted"), [
                { text: t("common.ok"), onPress: () => router.back() }
            ]);
        } else {
            const err = await res.json().catch(() => ({ message: t("rateProvider.failedToSubmitReview") }));
            Alert.alert(t("common.error"), err.message || t("rateProvider.failedToSubmitReview"));
        }
    } catch (error) {
        console.log("Review Error", error);
        Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
        setSubmitting(false);
    }
  };

  const Star = ({ index, filled }: { index: number; filled: boolean }) => (
    <TouchableOpacity onPress={() => setRating(index + 1)}>
        <Feather 
            name="star" 
            size={40} 
            color={filled ? "#fbbf24" : (isDark ? "#4b5563" : "#d1d5db")} 
            style={{ marginHorizontal: 4 }}
        />
    </TouchableOpacity>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("rateProvider.rateProvider")}</Text>
            <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.profileSection}>
                <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
                    <Text style={{ fontSize: 32, fontWeight: "bold", color: "#9ca3af" }}>
                        {(typeof name === 'string' ? name : "U").charAt(0)}
                    </Text>
                </View>
                <Text style={[styles.name, { color: colors.text }]}>{name || t("auth.serviceProvider")}</Text>
                <Text style={styles.subtitle}>{t("rateProvider.howWasYourExperience")}</Text>
            </View>

            <View style={styles.starsContainer}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} index={i} filled={i < rating} />
                ))}
            </View>
            <Text style={[styles.ratingLabel, { color: colors.tint }]}>
                {rating > 0 ? [t("rateProvider.poor"), t("rateProvider.fair"), t("rateProvider.good"), t("rateProvider.veryGood"), t("rateProvider.excellent")][rating - 1] : t("rateProvider.tapToRate")}
            </Text>

            <View style={[styles.inputContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff" }]}>
                <Text style={[styles.label, { color: colors.text }]}>{t("rateProvider.writeReview")}</Text>
                <TextInput
                    style={[styles.textArea, { 
                        color: colors.text,
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"
                    }]}
                    placeholder={t("rateProvider.reviewPlaceholder")}
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={5}
                    value={review}
                    onChangeText={setReview}
                />
            </View>

            <TouchableOpacity 
                style={[
                    styles.submitBtn, 
                    {
                        backgroundColor: isDark ? "#6366f1" : "#4f46e5",
                        borderWidth: 1,
                        borderColor: isDark ? "#6366f1" : "#4f46e5",
                    },
                    submitting && { opacity: 0.7 }
                ]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                <Text style={[styles.submitBtnText, { color: "#ffffff" }]}>
                    {submitting ? t("rateProvider.submitting") : t("rateProvider.submitReview")}
                </Text>
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
  content: { padding: 24, alignItems: 'center' },
  profileSection: { alignItems: 'center', marginBottom: 32 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#9ca3af" },
  starsContainer: { flexDirection: 'row', marginBottom: 12 },
  ratingLabel: { fontSize: 18, fontWeight: "600", marginBottom: 40 },
  inputContainer: { width: '100%', borderRadius: 16, padding: 16, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    fontSize: 16,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  submitBtnText: { fontWeight: "bold", fontSize: 16 },
});

