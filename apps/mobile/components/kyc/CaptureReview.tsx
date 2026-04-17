import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CaptureReviewProps {
  imageUri: string;
  title: string;
  onAccept: () => void;
  onRetake: () => void;
}

export default function CaptureReview({
  imageUri,
  title,
  onAccept,
  onRetake,
}: CaptureReviewProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t("kyc.doesThisLookClear") || "Does this look clear?"}
      </Text>

      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <View style={styles.checks}>
        <View style={styles.checkRow}>
          <Feather name="check-circle" size={18} color={colors.emerald} />
          <Text style={[styles.checkText, { color: colors.text }]}>
            {t("kyc.textIsReadable") || "Text is readable"}
          </Text>
        </View>
        <View style={styles.checkRow}>
          <Feather name="check-circle" size={18} color={colors.emerald} />
          <Text style={[styles.checkText, { color: colors.text }]}>
            {t("kyc.noGlareOrShadows") || "No glare or shadows"}
          </Text>
        </View>
        <View style={styles.checkRow}>
          <Feather name="check-circle" size={18} color={colors.emerald} />
          <Text style={[styles.checkText, { color: colors.text }]}>
            {t("kyc.allCornersVisible") || "All corners visible"}
          </Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.retakeButton,
            { borderColor: colors.border },
          ]}
          onPress={onRetake}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={18} color={colors.text} />
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {t("kyc.retake") || "Retake"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.acceptButton,
            { backgroundColor: colors.emerald },
          ]}
          onPress={onAccept}
          activeOpacity={0.7}
        >
          <Feather name="check" size={18} color="#fff" />
          <Text style={[styles.buttonText, { color: "#fff" }]}>
            {t("kyc.useThis") || "Use this"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  image: {
    width: SCREEN_WIDTH - 48,
    height: (SCREEN_WIDTH - 48) / 1.586,
    borderRadius: 12,
  },
  checks: {
    gap: 12,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkText: {
    fontSize: 15,
    fontWeight: "500",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 4,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retakeButton: {
    borderWidth: 1.5,
  },
  acceptButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
