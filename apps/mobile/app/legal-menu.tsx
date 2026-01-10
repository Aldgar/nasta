import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { getLegalDocument } from "../lib/legal-text";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function LegalMenuScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();

  const legalItems = [
    {
      title: t("legal.termsAndConditions"),
      route: "/content-page",
      params: {
        pageKey: "terms",
        title: t("legal.termsAndConditions"),
        content: getLegalDocument("TERMS_OF_SERVICE", language),
        showAccept: true,
      },
    },
    {
      title: t("legal.privacyPolicy"),
      route: "/content-page",
      params: {
        pageKey: "privacy",
        title: t("legal.privacyPolicy"),
        content: getLegalDocument("PRIVACY_POLICY", language),
        showAccept: true,
      },
    },
    {
      title: t("legal.cookiesSettings"),
      route: "/cookies-settings",
    },
    {
      title: t("legal.platformRules"),
      route: "/content-page",
      params: {
        pageKey: "platform_rules",
        title: t("legal.platformRules"),
        content: getLegalDocument("PLATFORM_RULES", language),
        showAccept: true,
      },
    },
  ];

  const supportItems = [
    { title: t("legal.contactSupport"), route: "/support" },
    {
      title: t("legal.reportAbuse"),
      route: "/report",
      params: { title: t("legal.reportAbuse") },
    },
    {
      title: t("legal.reportSecurity"),
      route: "/report",
      params: { title: t("legal.reportSecurity") },
    },
    { title: t("legal.survey"), route: "/survey" },
  ];

  const handlePress = (item: any) => {
    router.push({ pathname: item.route, params: item.params } as any);
  };

  const renderSection = (title: string, items: any[]) => (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, themeStyles.text]}>{title}</Text>
      <View style={[styles.menuList, themeStyles.listBg]}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              themeStyles.itemBorder,
              index === items.length - 1 && styles.lastMenuItem,
            ]}
            onPress={() => handlePress(item)}
          >
            <Text style={[styles.menuText, themeStyles.text]}>
              {item.title}
            </Text>
            <Feather
              name="chevron-right"
              size={20}
              color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const themeStyles = {
    text: { color: colors.text },
    backData: { color: colors.text },
    listBg: {
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
      shadowColor: isDark ? "#000" : "#000",
    },
    itemBorder: {
      borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    },
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather
            name="arrow-left"
            size={24}
            color={themeStyles.backData.color}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, themeStyles.text]}>
          {t("legal.supportAndLegal")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderSection(t("legal.legal"), legalItems)}
        {renderSection(t("legal.support"), supportItems)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuList: {
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 2,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
