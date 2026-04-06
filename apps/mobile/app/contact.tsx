import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
import AvatarImage from "../components/AvatarImage";
import { useFocusEffect } from "expo-router";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  avatar?: string;
  city?: string;
  country?: string;
}

export default function Contact() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "JOB_SEEKER" | "EMPLOYER"
  >("all");
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            setIsAdmin(payload.role === "ADMIN");
          } catch (e) {
            setIsAdmin(false);
          }
        }
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const roleParam = roleFilter !== "all" ? `&role=${roleFilter}` : "";
      const res = await fetch(`${base}/admin/users?limit=100${roleParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        console.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        fetchUsers();
      }
    }, [isAdmin, fetchUsers]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleUserPress = (user: User) => {
    router.push({
      pathname: "/chat/room",
      params: {
        userId: user.id,
        userName:
          `${user.firstName} ${user.lastName}`.trim() || t("contact.user"),
      },
    } as never);
  };

  // If not admin, show support hub with navigation cards
  if (!isAdmin) {
    const supportOptions = [
      {
        icon: "headphones" as const,
        title: t("legal.contactSupport"),
        desc: t("contact.contactSupportDesc"),
        color: "#C9963F",
        route: "/support",
      },
      {
        icon: "alert-triangle" as const,
        title: t("legal.reportAbuse"),
        desc: t("contact.reportAbuseDesc"),
        color: "#ef4444",
        route: "/report",
        params: { title: t("legal.reportAbuse") },
      },
      {
        icon: "shield" as const,
        title: t("legal.reportSecurity"),
        desc: t("contact.reportSecurityDesc"),
        color: "#3b82f6",
        route: "/report",
        params: { title: t("legal.reportSecurity") },
      },
      {
        icon: "clipboard" as const,
        title: t("legal.survey"),
        desc: t("contact.surveyDesc"),
        color: "#22c55e",
        route: "/survey",
      },
    ];

    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("contact.supportHub")}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero section */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: isDark
                    ? "rgba(201, 150, 63, 0.12)"
                    : "rgba(201, 150, 63, 0.08)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.25)"
                    : "rgba(184,130,42,0.15)",
                },
              ]}
            >
              <View
                style={[
                  styles.heroIconContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.2)"
                      : "rgba(201, 150, 63, 0.15)",
                  },
                ]}
              >
                <Feather name="headphones" size={32} color="#C9963F" />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                {t("contact.supportHubSubtitle")}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { color: isDark ? "#B8A88A" : "#8A7B68" },
                ]}
              >
                {t("contact.useFormToContact")}
              </Text>
            </View>

            {/* Support option cards */}
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: option.route,
                    params: (option as any).params,
                  } as any)
                }
                style={[
                  styles.supportCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.82)"
                      : "#FFFAF0",
                    borderColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(0,0,0,0.08)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.supportIconContainer,
                    {
                      backgroundColor: isDark
                        ? `${option.color}20`
                        : `${option.color}15`,
                    },
                  ]}
                >
                  <Feather name={option.icon} size={22} color={option.color} />
                </View>
                <View style={styles.supportCardText}>
                  <Text
                    style={[styles.supportCardTitle, { color: colors.text }]}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={[
                      styles.supportCardDesc,
                      { color: isDark ? "#B8A88A" : "#8A7B68" },
                    ]}
                  >
                    {option.desc}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={isDark ? "rgba(201,150,63,0.4)" : "rgba(0,0,0,0.25)"}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Admin view: List of users
  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.pageTitle, { color: colors.text }]}>
              {t("contact.contactUsers")}
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                roleFilter === "all"
                  ? { backgroundColor: isDark ? "#C9963F" : colors.tint }
                  : {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.06)",
                    },
              ]}
              onPress={() => setRoleFilter("all")}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: roleFilter === "all" ? "#FFFAF0" : colors.text },
                ]}
              >
                {t("common.all")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                roleFilter === "JOB_SEEKER"
                  ? { backgroundColor: isDark ? "#C9963F" : colors.tint }
                  : {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.06)",
                    },
              ]}
              onPress={() => setRoleFilter("JOB_SEEKER")}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color:
                      roleFilter === "JOB_SEEKER" ? "#FFFAF0" : colors.text,
                  },
                ]}
              >
                {t("auth.serviceProvider")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                roleFilter === "EMPLOYER"
                  ? { backgroundColor: isDark ? "#C9963F" : colors.tint }
                  : {
                      backgroundColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.06)",
                    },
              ]}
              onPress={() => setRoleFilter("EMPLOYER")}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: roleFilter === "EMPLOYER" ? "#FFFAF0" : colors.text,
                  },
                ]}
              >
                {t("auth.employer")}
              </Text>
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              keyboardShouldPersistTaps="handled"
            >
              {users.length === 0 ? (
                <View style={styles.center}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {t("contact.noUsersFound")}
                  </Text>
                </View>
              ) : (
                users.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.90)"
                          : "rgba(255,250,240,0.92)",
                        borderColor: isDark
                          ? "rgba(201,150,63,0.25)"
                          : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => handleUserPress(user)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.userCardContent}>
                      <AvatarImage
                        uri={user.avatar}
                        size={50}
                        style={{ marginRight: 12 }}
                      />
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {user.firstName} {user.lastName}
                        </Text>
                        <Text
                          style={[
                            styles.userEmail,
                            { color: isDark ? "#B8A88A" : "#8A7B68" },
                          ]}
                        >
                          {user.email}
                        </Text>
                        <View style={styles.userMeta}>
                          <View
                            style={[
                              styles.roleBadge,
                              {
                                backgroundColor:
                                  user.role === "EMPLOYER"
                                    ? isDark
                                      ? "rgba(201, 150, 63, 0.2)"
                                      : "rgba(201, 150, 63, 0.1)"
                                    : isDark
                                      ? "rgba(34, 197, 94, 0.2)"
                                      : "rgba(34, 197, 94, 0.1)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleText,
                                {
                                  color:
                                    user.role === "EMPLOYER"
                                      ? "#C9963F"
                                      : "#22c55e",
                                },
                              ]}
                            >
                              {user.role === "EMPLOYER"
                                ? t("auth.employer")
                                : t("auth.serviceProvider")}
                            </Text>
                          </View>
                          {(user.city || user.country) && (
                            <Text
                              style={[
                                styles.locationText,
                                { color: isDark ? "#9A8E7A" : "#8A7B68" },
                              ]}
                            >
                              {[user.city, user.country]
                                .filter(Boolean)
                                .join(", ")}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={20}
                        color={isDark ? "#B8A88A" : "#8A7B68"}
                      />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 4,
  },
  title: { fontSize: 22, fontWeight: "800" },
  // Hero section styles
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  // Support cards
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  supportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  supportCardText: {
    flex: 1,
    marginRight: 8,
  },
  supportCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  supportCardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,250,240,0.15)",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  list: { flex: 1, padding: 16 },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  userCard: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  userCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  locationText: {
    fontSize: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  placeholder: { width: 36 },
});
