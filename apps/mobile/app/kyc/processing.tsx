import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useKyc } from "../../context/KycContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import GradientBackground from "../../components/GradientBackground";

type SubmitStatus = "uploading" | "verifying" | "done" | "error";

const STAGES: { key: SubmitStatus; labelKey: string; fallback: string }[] = [
  {
    key: "uploading",
    labelKey: "kyc.uploading",
    fallback: "Uploading documents...",
  },
  {
    key: "verifying",
    labelKey: "kyc.verifying",
    fallback: "Verifying identity...",
  },
  {
    key: "done",
    labelKey: "kyc.submitted",
    fallback: "Verification submitted!",
  },
];

export default function ProcessingScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { state, dispatch } = useKyc();

  const [status, setStatus] = useState<SubmitStatus>("uploading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Spinning animation
  useEffect(() => {
    if (status === "uploading" || status === "verifying") {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status, spinAnim]);

  // Success check animation
  useEffect(() => {
    if (status === "done") {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start();
    }
  }, [status, scaleAnim]);

  // Submit
  useEffect(() => {
    let cancelled = false;

    const submit = async () => {
      try {
        dispatch({ type: "SET_SUBMITTING", submitting: true });

        const base = getApiBase();
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) throw new Error("Not authenticated");

        const headers = { Authorization: `Bearer ${token}` };
        const verificationId = state.verificationId;
        if (!verificationId) throw new Error("No verification ID");

        // 1. Upload ID documents + selfie
        const idForm = new FormData();
        if (state.idFront?.uri) {
          idForm.append("documentFront", {
            uri: state.idFront.uri,
            type: "image/jpeg",
            name: "id-front.jpg",
          } as any);
        }
        if (state.idBack?.uri) {
          idForm.append("documentBack", {
            uri: state.idBack.uri,
            type: "image/jpeg",
            name: "id-back.jpg",
          } as any);
        }
        if (state.selfie?.uri) {
          idForm.append("selfie", {
            uri: state.selfie.uri,
            type: "image/jpeg",
            name: "selfie.jpg",
          } as any);
        }

        const uploadRes = await fetch(`${base}/kyc/${verificationId}/upload`, {
          method: "POST",
          headers,
          body: idForm,
        });
        if (!uploadRes.ok) {
          const errBody = await uploadRes.text().catch(() => "");
          throw new Error(errBody || "Document upload failed");
        }

        if (cancelled) return;
        setStatus("verifying");

        // 2. Upload criminal record via background-checks endpoint
        if (state.criminalRecord?.uri) {
          // Fetch background check ID
          const bgStatusRes = await fetch(
            `${base}/background-checks/my-status`,
            { headers },
          );
          if (bgStatusRes.ok) {
            const bgStatus = await bgStatusRes.json();
            const checkId = bgStatus?.currentCheck?.id;
            if (checkId) {
              const crForm = new FormData();
              const isPdf = state.criminalRecord.uri.endsWith(".pdf");
              crForm.append("certificate", {
                uri: state.criminalRecord.uri,
                type: isPdf ? "application/pdf" : "image/jpeg",
                name: isPdf ? "criminal-record.pdf" : "criminal-record.jpg",
              } as any);
              await fetch(
                `${base}/background-checks/${checkId}/upload-document`,
                { method: "POST", headers, body: crForm },
              );
            }
          }
        }

        // 3. Upload driver's license (separate KYC verification)
        if (state.includeDriversLicense && state.dlFront?.uri) {
          try {
            // Initiate a DL verification
            const dlInitRes = await fetch(`${base}/kyc/initiate`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                verificationType: "DRIVERS_LICENSE",
                consent: { accepted: true },
              }),
            });
            if (dlInitRes.ok) {
              const dlInit = await dlInitRes.json();
              const dlVerificationId = dlInit?.id || dlInit?.verificationId;
              if (dlVerificationId) {
                const dlForm = new FormData();
                dlForm.append("documentFront", {
                  uri: state.dlFront.uri,
                  type: "image/jpeg",
                  name: "dl-front.jpg",
                } as any);
                if (state.dlBack?.uri) {
                  dlForm.append("documentBack", {
                    uri: state.dlBack.uri,
                    type: "image/jpeg",
                    name: "dl-back.jpg",
                  } as any);
                }
                await fetch(`${base}/kyc/${dlVerificationId}/upload`, {
                  method: "POST",
                  headers,
                  body: dlForm,
                });
              }
            }
          } catch (dlErr) {
            console.warn("Driver's license upload failed:", dlErr);
          }
        }

        // 4. Upload certifications
        for (const cert of state.certifications) {
          const certForm = new FormData();
          certForm.append("certification", {
            uri: cert.uri,
            type: cert.type === "pdf" ? "application/pdf" : "image/jpeg",
            name: cert.name,
          } as any);
          await fetch(`${base}/kyc/${verificationId}/upload-certification`, {
            method: "POST",
            headers,
            body: certForm,
          });
        }

        // 5. Upload CV documents
        for (const cv of state.cvDocuments) {
          const cvForm = new FormData();
          cvForm.append("cv", {
            uri: cv.uri,
            type: cv.type === "pdf" ? "application/pdf" : "image/jpeg",
            name: cv.name,
          } as any);
          await fetch(`${base}/kyc/${verificationId}/upload-cv`, {
            method: "POST",
            headers,
            body: cvForm,
          });
        }

        if (!cancelled) {
          setStatus("done");
          dispatch({ type: "SET_SUBMITTING", submitting: false });

          // Navigate to home after brief pause
          setTimeout(() => {
            if (!cancelled) {
              router.replace("/user-home" as any);
            }
          }, 2000);
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(e?.message || "Something went wrong");
          dispatch({ type: "SET_SUBMITTING", submitting: false });
          dispatch({ type: "SET_ERROR", error: e?.message });
        }
      }
    };

    submit();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const currentStage = STAGES.find((s) => s.key === status);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.container}>
          {/* Icon */}
          {status === "uploading" || status === "verifying" ? (
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: `${colors.gold}15`,
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <Feather name="loader" size={48} color={colors.gold} />
            </Animated.View>
          ) : status === "done" ? (
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: `${colors.emerald}15`,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Feather name="check-circle" size={48} color={colors.emerald} />
            </Animated.View>
          ) : (
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${colors.danger || "#EF4444"}15` },
              ]}
            >
              <Feather
                name="alert-triangle"
                size={48}
                color={colors.danger || "#EF4444"}
              />
            </View>
          )}

          {/* Status text */}
          <Text style={[styles.statusText, { color: colors.text }]}>
            {status === "error"
              ? t("kyc.submissionFailed") || "Submission Failed"
              : t(currentStage?.labelKey ?? "") || currentStage?.fallback}
          </Text>

          {status === "error" && errorMsg && (
            <Text style={[styles.errorText, { color: colors.textMuted }]}>
              {errorMsg}
            </Text>
          )}

          {status === "done" && (
            <Text style={[styles.doneSubtext, { color: colors.textMuted }]}>
              {t("kyc.verificationPending") ||
                "Your documents are being reviewed. We'll notify you once verification is complete."}
            </Text>
          )}

          {/* Progress dots */}
          {(status === "uploading" || status === "verifying") && (
            <View style={styles.dotsContainer}>
              {STAGES.slice(0, 2).map((s, i) => (
                <View
                  key={s.key}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        STAGES.findIndex((st) => st.key === status) >= i
                          ? colors.gold
                          : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {status === "error" && (
            <View style={styles.errorActions}>
              <Text
                style={[styles.retryLink, { color: colors.gold }]}
                onPress={() => router.back()}
              >
                {t("kyc.goBack") || "Go back and try again"}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  doneSubtext: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorActions: {
    marginTop: 12,
  },
  retryLink: {
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
