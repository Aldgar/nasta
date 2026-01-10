import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import GradientBackground from "../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiBase } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ActivityIndicator } from "react-native";

// Helper function to decode JWT token (without verification)
function decodeJwtPayload(token: string): { exp?: number; iat?: number; sub?: string; id?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true; // If no expiration, assume expired
  const exp = payload.exp * 1000; // Convert to milliseconds
  return Date.now() >= exp;
}

export default function KycStartScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check for existing verification on mount
  useEffect(() => {
    const checkExistingVerification = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          console.log("⚠️ No token found in SecureStore");
          setCheckingStatus(false);
          return;
        }

        // Validate token format
        const tokenParts = token.split(".");
        if (tokenParts.length !== 3) {
          console.error("❌ Invalid token format in SecureStore");
          await SecureStore.deleteItemAsync("auth_token");
          setCheckingStatus(false);
          return;
        }

        const base = getApiBase();
        console.log("🔍 Checking existing verification status...");
        const statusRes = await fetch(`${base}/kyc/my-status`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        
        console.log("📥 Status check response:", statusRes.status);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const currentVerification = statusData?.current;
          
          // If there's a verification in progress, redirect to capture screen
          if (currentVerification?.id) {
            const status = currentVerification.status;
            console.log("✅ Found existing verification:", currentVerification.id, "Status:", status);
            if (['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW'].includes(status)) {
              router.replace({
                pathname: "/kyc-capture",
                params: { verificationId: currentVerification.id },
              } as never);
              return;
            }
          } else {
            console.log("ℹ️ No existing verification found");
          }
        } else if (statusRes.status === 401) {
          console.error("❌ 401 Unauthorized during status check - token invalid");
          await SecureStore.deleteItemAsync("auth_token");
        } else {
          console.warn("⚠️ Status check failed:", statusRes.status, statusRes.statusText);
        }
      } catch (err) {
        // Log error but don't block user
        console.warn("⚠️ Failed to check existing verification:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkExistingVerification();
  }, []);

  const startKyc = async () => {
    if (!consent) {
      Alert.alert(t("kyc.consentRequired"), t("kyc.pleaseAcceptToContinue"));
      return;
    }
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("auth.notSignedIn"), t("auth.pleaseLogInAgain"));
        router.replace("/login" as never);
        return;
      }

      // Debug: Log token presence (don't log the actual token for security)
      console.log("🔑 Token retrieved:", token ? `Token exists (${token.length} chars)` : "No token");
      
      // Validate token format (should be a JWT with 3 parts separated by dots)
      const tokenParts = token.split(".");
      if (tokenParts.length !== 3) {
        console.error("❌ Invalid token format - not a valid JWT");
        Alert.alert(t("kyc.invalidToken"), t("kyc.invalidTokenMessage"));
        await SecureStore.deleteItemAsync("auth_token");
        router.replace("/login" as never);
        return;
      }
      
      // Check if token is expired
      if (isTokenExpired(token)) {
        console.error("❌ Token is expired");
        const payload = decodeJwtPayload(token);
        const exp = payload?.exp ? new Date(payload.exp * 1000).toLocaleString() : "unknown";
        Alert.alert(
          t("auth.sessionExpired"),
          t("auth.sessionExpiredAt", { exp }),
          [
            {
              text: t("common.ok"),
              onPress: async () => {
                await SecureStore.deleteItemAsync("auth_token");
                router.replace("/login" as never);
              },
            },
          ]
        );
        return;
      }
      
      // Log token info (without exposing the actual token)
      const payload = decodeJwtPayload(token);
      if (payload) {
        const exp = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "unknown";
        console.log("✅ Token valid - expires:", exp, "Role:", payload.role || "N/A");
      }

      const base = getApiBase();
      console.log("🌐 API Base:", base);

      // Check connectivity first (optional - don't fail if health endpoint doesn't exist)
      try {
        const healthCheck = await fetch(`${base}/health`, {
          method: "GET",
        });
        if (!healthCheck.ok && healthCheck.status !== 404) {
          console.warn(`Server health check returned status: ${healthCheck.status}`);
        }
      } catch (healthErr) {
        console.warn("Health check failed (this is okay if endpoint doesn't exist):", healthErr);
        // Continue anyway - health endpoint might not exist
      }

      // Initiate ID verification
      let kycRes;
      try {
        const url = `${base}/kyc/initiate`;
        console.log("📤 Sending KYC initiation request to:", url);
        console.log("📤 Authorization header:", `Bearer ${token.substring(0, 20)}...`);
        
        kycRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationType: "GOVERNMENT_ID",
            consent: { accepted: true, version: "v1" },
          }),
        });
        
        console.log("📥 Response status:", kycRes.status, kycRes.statusText);
      } catch (fetchErr) {
        const errorMsg = (fetchErr as Error).message;
        console.error("❌ Fetch error:", errorMsg);
        if (errorMsg.includes("Network request failed") || errorMsg.includes("fetch")) {
          throw new Error(
            `Network error: Cannot connect to ${base}/kyc/initiate. ` +
            `Please check your internet connection and ensure the server is running.`
          );
        }
        throw fetchErr;
      }

      if (!kycRes.ok) {
        let errorText = t("kyc.failedToInitiateVerification");
        let errorJson: any = null;
        try {
          errorText = await kycRes.text();
          console.error("❌ Error response:", errorText);
          // Try to parse as JSON for better error message
          try {
            errorJson = JSON.parse(errorText);
            errorText = errorJson.message || errorJson.error || errorText;
            console.error("❌ Parsed error:", errorJson);
          } catch {
            // Not JSON, use as is
            console.error("❌ Error is not JSON, raw text:", errorText);
          }
        } catch {
          errorText = `Server error: ${kycRes.status} ${kycRes.statusText}`;
          console.error("❌ Failed to read error response");
        }
        
        // If it's a 401 Unauthorized, the token is likely invalid or expired
        if (kycRes.status === 401) {
          console.error("❌ 401 Unauthorized - token may be invalid or expired");
          Alert.alert(
            t("auth.sessionExpired"),
            t("auth.sessionExpiredMessage"),
            [
              {
                text: "OK",
                onPress: async () => {
                  await SecureStore.deleteItemAsync("auth_token");
                  router.replace("/login" as never);
                },
              },
            ]
          );
          return;
        }

        // If error is "already in progress", check status and redirect
        if (errorText.includes("already have") && errorText.includes("verification")) {
          try {
            const statusRes = await fetch(`${base}/kyc/my-status`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            if (statusRes.ok) {
              const statusData = await statusRes.json();
              const currentVerification = statusData?.current;
              
              if (currentVerification?.id) {
                Alert.alert(
                  t("kyc.verificationInProgress"),
                  t("kyc.continueVerificationMessage"),
                  [
                    {
                      text: t("common.cancel"),
                      style: "cancel",
                    },
                    {
                      text: t("common.continue"),
                      onPress: () => {
                        router.replace({
                          pathname: "/kyc-capture",
                          params: { verificationId: currentVerification.id },
                        } as never);
                      },
                    },
                  ]
                );
                return;
              }
            }
          } catch (statusErr) {
            // Fall through to show error
          }
        }

        throw new Error(errorText);
      }

      const kycJson = await kycRes.json();
      const verificationId =
        kycJson?.id || kycJson?._id || kycJson?.verificationId;

      // Initiate background check (optional, don't fail if this fails)
      try {
      const bgRes = await fetch(`${base}/background-checks/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ consent: { accepted: true } }),
      });
      if (!bgRes.ok) {
          console.warn("Background check initiation failed, continuing with KYC");
        }
      } catch (bgErr) {
        console.warn("Background check initiation error:", bgErr);
        // Don't fail the whole flow if background check fails
      }

      Alert.alert(t("kyc.kycStarted"), t("kyc.kycStartedMessage"));
      if (verificationId) {
        router.replace({
          pathname: "/kyc-capture",
          params: { verificationId },
        } as never);
      } else {
        router.replace("/" as never);
      }
    } catch (err) {
      const errorMessage = (err as Error).message || t("common.unknownError");
      console.error("KYC initiation error:", err);
      Alert.alert(t("kyc.kycError"), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.contentContainer, { justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b", marginTop: 16 }]}>
              Checking verification status...
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[
              styles.topButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[styles.topButtonText, { color: colors.text }]}>{t("common.back")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{t("kyc.verifyIdentity")}</Text>
          <Text style={[styles.subtitle, { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" }]}>
            {t("kyc.verifyIdentitySubtitle")}
          </Text>

          <TouchableOpacity
            onPress={() => setConsent((v) => !v)}
            style={styles.checkboxRow}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: consent
                    ? (isDark ? "#6366f1" : "#4f46e5")
                    : isDark
                      ? "rgba(255,255,255,0.6)"
                      : "#94a3b8",
                  backgroundColor: consent
                    ? (isDark ? "#4f46e5" : "#4338ca")
                    : "transparent",
                },
                consent && styles.checkboxChecked,
              ]}
            >
              {consent && (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>✓</Text>
              )}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              {t("kyc.consentToChecks")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: consent ? (isDark ? "#4f46e5" : colors.tint) : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.05)"),
                borderColor: consent ? (isDark ? "#6366f1" : colors.tint) : (isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)"),
                shadowColor: consent ? (isDark ? "#4f46e5" : colors.tint) : "transparent",
              },
              loading && styles.buttonLoading,
            ]}
            onPress={startKyc}
            disabled={loading || !consent}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
            <Text style={styles.buttonLabel}>
              {loading ? t("common.loading") : t("kyc.startVerification")}
            </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.replace("/user-home" as never)}
          >
            <Text style={[styles.secondaryText, { color: isDark ? "rgba(255,255,255,0.8)" : "#64748b" }]}>
              {t("kyc.doThisLater")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 24 },
  topBar: {
    height: 50,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  topButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topButtonText: { fontSize: 12, fontWeight: "600" },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40, 
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 32,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    justifyContent: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {},
  checkboxLabel: {
    fontSize: 16,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    width: "100%",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 0 : 4,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryAction: {
    marginTop: 24,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 14,
  },
});
