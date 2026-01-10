import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
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
  const [roleFilter, setRoleFilter] = useState<"all" | "JOB_SEEKER" | "EMPLOYER">("all");
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
    }, [isAdmin, fetchUsers])
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
        userName: `${user.firstName} ${user.lastName}`.trim() || t("contact.user") 
      },
    } as never);
  };

  // If not admin, show regular contact form
  if (!isAdmin) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t("contact.contactUs")}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.85)" : "#ffffff",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <Text style={[styles.infoText, { color: colors.text }]}>
              {t("contact.useFormToContact")}
            </Text>
            <Text style={[styles.label, { color: colors.text }]}>{t("contact.name")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("contact.namePlaceholder")}
              placeholderTextColor={isDark ? "#94a3b8" : "#9ca3af"}
            />
            <Text style={[styles.label, { color: colors.text }]}>{t("auth.email")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={isDark ? "#94a3b8" : "#9ca3af"}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={[styles.label, { color: colors.text }]}>{t("contact.message")}</Text>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#ffffff",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                },
              ]}
              placeholder={t("contact.messagePlaceholder")}
              placeholderTextColor={isDark ? "#94a3b8" : "#9ca3af"}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: isDark ? "#6366f1" : colors.tint,
                },
              ]}
            >
              <Text style={[styles.buttonLabel, { color: "#fff" }]}>{t("chat.send")}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // Admin view: List of users
  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: colors.text }]}>{t("contact.contactUsers")}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              roleFilter === "all"
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setRoleFilter("all")}
          >
            <Text
              style={[
                styles.filterText,
                { color: roleFilter === "all" ? "#fff" : colors.text },
              ]}
            >
              {t("common.all")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              roleFilter === "JOB_SEEKER"
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setRoleFilter("JOB_SEEKER")}
          >
            <Text
              style={[
                styles.filterText,
                { color: roleFilter === "JOB_SEEKER" ? "#fff" : colors.text },
              ]}
            >
              {t("auth.serviceProvider")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              roleFilter === "EMPLOYER"
                ? { backgroundColor: isDark ? "#6366f1" : colors.tint }
                : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={() => setRoleFilter("EMPLOYER")}
          >
            <Text
              style={[
                styles.filterText,
                { color: roleFilter === "EMPLOYER" ? "#fff" : colors.text },
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
                        ? "rgba(30, 41, 59, 0.95)"
                        : "rgba(255,255,255,0.9)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.3)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                  onPress={() => handleUserPress(user)}
                  activeOpacity={0.7}
                >
                  <View style={styles.userCardContent}>
                    {user.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarPlaceholder,
                          { backgroundColor: isDark ? "#374151" : "#d1d5db" },
                        ]}
                      >
                        <Feather
                          name="user"
                          size={24}
                          color={isDark ? "#9ca3af" : "#6b7280"}
                        />
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>
                        {user.firstName} {user.lastName}
                      </Text>
                      <Text
                        style={[styles.userEmail, { color: isDark ? "#cbd5e1" : "#64748b" }]}
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
                                    ? "rgba(59, 130, 246, 0.2)"
                                    : "rgba(59, 130, 246, 0.1)"
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
                                  user.role === "EMPLOYER" ? "#3b82f6" : "#22c55e",
                              },
                            ]}
                          >
                            {user.role === "EMPLOYER" ? t("auth.employer") : t("auth.serviceProvider")}
                          </Text>
                        </View>
                        {(user.city || user.country) && (
                          <Text
                            style={[
                              styles.locationText,
                              { color: isDark ? "#94a3b8" : "#64748b" },
                            ]}
                          >
                            {[user.city, user.country].filter(Boolean).join(", ")}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={isDark ? "#cbd5e1" : "#64748b"}
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
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
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  textarea: {
    minHeight: 120,
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 16,
  },
  buttonLabel: { fontWeight: "700", fontSize: 16 },
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
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
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
    borderRadius: 12,
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
    fontWeight: "600",
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
