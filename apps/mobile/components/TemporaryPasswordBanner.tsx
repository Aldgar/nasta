import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

interface TemporaryPasswordBannerProps {
  onDismiss?: () => void;
}

export default function TemporaryPasswordBanner({
  onDismiss,
}: TemporaryPasswordBannerProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const handleUpdatePassword = () => {
    router.push("/settings" as never);
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isDark
            ? "rgba(245, 158, 11, 0.2)"
            : "rgba(245, 158, 11, 0.1)",
          borderColor: isDark
            ? "rgba(245, 158, 11, 0.4)"
            : "rgba(245, 158, 11, 0.3)",
          borderLeftWidth: 4,
        },
      ]}
    >
      <View style={styles.bannerContent}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isDark
                ? "rgba(245, 158, 11, 0.2)"
                : "rgba(245, 158, 11, 0.1)",
            },
          ]}
        >
          <Feather name="alert-circle" size={20} color="#f59e0b" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("auth.updatePasswordRequired")}
          </Text>
          <Text
            style={[
              styles.message,
              { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
            ]}
            numberOfLines={2}
          >
            {t("auth.updatePasswordRequiredMessage")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleUpdatePassword}
          style={styles.updateButton}
        >
          <Text style={[styles.updateButtonText, { color: "#f59e0b" }]}>
            {t("auth.updateNow")}
          </Text>
        </TouchableOpacity>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
          >
            <Feather name="x" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  updateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  updateButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dismissButton: {
    padding: 4,
  },
});

