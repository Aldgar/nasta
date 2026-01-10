import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import * as SecureStore from "expo-secure-store";

export default function Refer() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert(t("common.error"), t("refer.fillInAllFields"));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t("common.error"), t("auth.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("refer.pleaseLogInToSendInvites"));
        router.push("/login");
        return;
      }

      const base = getApiBase();
      const response = await fetch(`${base}/users/me/referral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          friendName: name.trim(),
          friendEmail: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t("refer.failedToSendInvite"));
      }

      Alert.alert(
        t("common.success"),
        t("refer.inviteSentSuccessfully", { email: email.trim() }),
        [
          {
            text: t("common.ok"),
            onPress: () => {
              setName("");
              setEmail("");
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("refer.failedToSendInvite")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={isDark ? "#fff" : colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? "#fff" : colors.text }]}>{t("refer.title")}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.heroIcon, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.1)" }]}>
            <Feather name="gift" size={48} color={colors.tint} />
          </View>
          <Text style={[styles.heading, { color: isDark ? "#fff" : colors.text }]}>{t("refer.inviteAndEarn")}</Text>
          <Text style={[styles.subtext, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            {t("refer.inviteAndEarnDescription")}
          </Text>

          <View style={styles.form}>
            <Text style={[styles.label, { color: isDark ? "#cbd5e1" : "#475569" }]}>{t("refer.friendsName")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(255,255,255,0.9)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  color: colors.text,
                },
              ]}
              placeholder={t("refer.friendsNamePlaceholder")}
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: isDark ? "#cbd5e1" : "#475569" }]}>{t("auth.email")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(255,255,255,0.9)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  color: colors.text,
                },
              ]}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: isDark ? "#6366f1" : colors.tint,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
              onPress={handleSendInvite}
              disabled={loading || !name.trim() || !email.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.buttonText, { color: "#ffffff" }]}>
                  {t("refer.sendInvite")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  backButton: { marginRight: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  content: { padding: 24, alignItems: 'center' },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20
  },
  heading: { fontSize: 24, fontWeight: "800", marginBottom: 12 },
  subtext: { textAlign: "center", marginBottom: 32, lineHeight: 22 },
  form: { width: '100%' },
  label: { fontWeight: "600", marginBottom: 8, marginLeft: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 16
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  buttonText: { fontWeight: "700", fontSize: 16, color: "#ffffff" }
});
