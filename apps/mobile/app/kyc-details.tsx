import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import GradientBackground from "../components/GradientBackground";
import { useLocalSearchParams, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { TextInput } from "react-native-gesture-handler";
import { useLanguage } from "../context/LanguageContext";

export default function KycDetails() {
  const { t } = useLanguage();
  const { verificationId } = useLocalSearchParams<{ verificationId: string }>();
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentCountry, setDocumentCountry] = useState("");
  const [documentExpiry, setDocumentExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!verificationId) {
      Alert.alert(t("kyc.missingId"), t("kyc.verificationIdNotFound"));
      return;
    }
    try {
      setSaving(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("kyc.notSignedIn"), t("kyc.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }
      const base = getApiBase();
      let res;
      try {
        res = await fetch(`${base}/kyc/${verificationId}/details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documentNumber,
            documentCountry,
            documentExpiry,
          }),
        });
      } catch (fetchErr) {
        const errorMsg = (fetchErr as Error).message;
        if (
          errorMsg.includes("Network request failed") ||
          errorMsg.includes("fetch")
        ) {
          throw new Error(
            `Network error: Cannot connect to server at ${base}. ` +
              `Please check your internet connection and ensure the server is running.`
          );
        }
        throw fetchErr;
      }

      if (!res.ok) {
        let errorText = t("kyc.failedToSaveDocumentDetails");
        try {
          errorText = await res.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
          } catch {
            // Not JSON, use as is
          }
        } catch {
          errorText = `Server error: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorText);
      }
      Alert.alert(t("common.success"), t("kyc.documentDetailsSubmitted"));
      router.replace("/user-home" as never);
    } catch (e) {
      Alert.alert(t("kyc.saveFailed"), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground>
      <View style={styles.container}>
        <Text style={styles.title}>{t("kyc.documentDetailsTitle")}</Text>
        <Text style={styles.subtitle}>{t("kyc.documentDetailsSubtitle")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("kyc.documentNumber")}</Text>
          <TextInput
            style={styles.input}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder={t("kyc.documentNumberPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.6)"
          />
          <Text style={styles.label}>{t("kyc.issuingCountryIso")}</Text>
          <TextInput
            style={styles.input}
            value={documentCountry}
            onChangeText={setDocumentCountry}
            placeholder={t("kyc.issuingCountryPlaceholder")}
            autoCapitalize="characters"
            placeholderTextColor="rgba(255,255,255,0.6)"
          />
          <Text style={styles.label}>{t("kyc.expiryYyyyMmDd")}</Text>
          <TextInput
            style={styles.input}
            value={documentExpiry}
            onChangeText={setDocumentExpiry}
            placeholder={t("kyc.expiryPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.6)"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.buttonLabel}>
            {saving ? t("common.saving") : t("common.submit")}
          </Text>
        </TouchableOpacity>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: "rgba(255,255,255,0.7)", marginBottom: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 12,
  },
  label: { color: "#fff", marginBottom: 6 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#fff",
    marginBottom: 12,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonLabel: { color: "#fff", fontWeight: "600" },
});
