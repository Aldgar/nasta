import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import AvatarImage from "../../components/AvatarImage";
import GradientBackground from "../../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

type ChatPreview = {
  id: string;
  partnerName: string;
  partnerUserId?: string;
  partnerAvatar: string | null;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
  type: "SUPPORT" | "JOB";
  jobTitle?: string;
  jobId?: string;
  locked?: boolean;
  isAdmin?: boolean;
};

type SectionData = {
  title: string;
  icon: string;
  data: ChatPreview[];
};

export default function InboxScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"JOB" | "SUPPORT">("JOB");

  const fetchChats = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/chat/conversations?pageSize=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const conversations = Array.isArray(data)
          ? data
          : data.conversations || [];
        const transformedChats: ChatPreview[] = conversations.map(
          (conv: any) => {
            const other = conv.others?.[0] || {};
            const lastMsg = conv.lastMessage;

            let partnerName = t("chat.user");
            if (other.firstName || other.lastName) {
              partnerName =
                `${other.firstName || ""} ${other.lastName || ""}`.trim();
            } else if (other.email) {
              partnerName = other.email;
            } else if (other.userId) {
              const roleStr = String(other.role || "").toUpperCase();
              partnerName =
                roleStr === "ADMIN"
                  ? "Admin"
                  : roleStr === "EMPLOYER"
                    ? t("auth.employer")
                    : roleStr === "JOB_SEEKER"
                      ? t("auth.serviceProvider")
                      : t("chat.user");
            }

            const convType: "SUPPORT" | "JOB" =
              conv.type === "SUPPORT" ||
              String(other.role || "").toUpperCase() === "ADMIN"
                ? "SUPPORT"
                : "JOB";

            const isAdmin = convType === "SUPPORT";

            return {
              id: conv.id,
              partnerName,
              partnerUserId: other.userId,
              partnerAvatar: other.avatar || null,
              lastMessage: lastMsg?.body || t("chat.noMessagesYet"),
              updatedAt: conv.updatedAt || conv.createdAt,
              unreadCount: 0,
              type: convType,
              jobTitle: conv.title || undefined,
              jobId: conv.jobId || undefined,
              locked: !!conv.locked,
              isAdmin,
            };
          },
        );
        setChats(transformedChats);
      } else {
        setChats([]);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, []),
  );

  const jobChats = chats.filter((c) => c.type === "JOB" && !c.locked);
  const supportChats = chats.filter((c) => c.type === "SUPPORT");
  const activeChats = activeTab === "JOB" ? jobChats : supportChats;

  const renderChatItem = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        {
          backgroundColor: isDark ? "rgba(255,250,240,0.06)" : "#FFFAF0",
          borderColor: isDark
            ? "rgba(201,150,63,0.12)"
            : "rgba(184,130,42,0.06)",
        },
        item.locked && { opacity: 0.6 },
      ]}
      onPress={() =>
        router.push({
          pathname: "/chat/room",
          params: {
            conversationId: item.id,
            userId: item.partnerUserId || "",
            userName: item.partnerName,
          },
        })
      }
    >
      {item.isAdmin ? (
        <Image
          source={
            isDark
              ? require("../../assets/images/NastaLogoDark.png")
              : require("../../assets/images/NastaLogoLight.png")
          }
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            marginRight: 12,
          }}
          resizeMode="contain"
        />
      ) : (
        <AvatarImage
          uri={item.partnerAvatar}
          size={50}
          fallbackText={item.partnerName.charAt(0).toUpperCase()}
          style={{ marginRight: 12 }}
        />
      )}
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={[styles.name, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.partnerName}
            </Text>
            {item.type === "JOB" && item.jobTitle && (
              <Text
                style={[
                  styles.jobTitle,
                  { color: isDark ? "#C9963F" : "#B8822A" },
                ]}
                numberOfLines={1}
              >
                {item.jobTitle}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.time}>
              {new Date(item.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {item.locked && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.15)"
                      : "rgba(239,68,68,0.1)",
                  },
                ]}
              >
                <Feather name="lock" size={10} color="#ef4444" />
                <Text style={styles.statusBadgeText}>
                  {t("chat.completed")}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text
          style={[
            styles.lastMessage,
            { color: isDark ? "#9A8E7A" : "#8A7B68" },
          ]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.tint }]}>
          <Text style={styles.badgeText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) return null;

    const isJob = activeTab === "JOB";
    return (
      <View style={styles.emptyState}>
        <Feather
          name={isJob ? "briefcase" : "headphones"}
          size={48}
          color={isDark ? "rgba(255,250,240,0.15)" : "rgba(184,130,42,0.3)"}
        />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          {isJob ? t("chat.noJobMessages") : t("chat.noSupportMessages")}
        </Text>
        <Text
          style={[
            styles.emptySubtext,
            { color: isDark ? "#9A8E7A" : "#8A7B68" },
          ]}
        >
          {isJob
            ? t("chat.noJobMessagesHint")
            : t("chat.noSupportMessagesHint")}
        </Text>
      </View>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 3,
                color: isDark ? "rgba(201,150,63,0.6)" : "rgba(184,130,42,0.5)",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              COMMS
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("chat.messages")}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "JOB" && {
                backgroundColor: isDark ? "#C9963F" : colors.tint,
              },
              activeTab !== "JOB" && {
                backgroundColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.06)",
              },
            ]}
            onPress={() => setActiveTab("JOB")}
          >
            <Feather
              name="briefcase"
              size={14}
              color={activeTab === "JOB" ? "#FFFAF0" : colors.text}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "JOB" ? "#FFFAF0" : colors.text,
                },
              ]}
            >
              {t("chat.jobMessages")}
            </Text>
            {jobChats.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === "JOB"
                        ? "rgba(255,250,240,0.3)"
                        : isDark
                          ? "rgba(201,150,63,0.3)"
                          : "rgba(184,130,42,0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    {
                      color: activeTab === "JOB" ? "#FFFAF0" : colors.text,
                    },
                  ]}
                >
                  {jobChats.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "SUPPORT" && {
                backgroundColor: isDark ? "#C9963F" : colors.tint,
              },
              activeTab !== "SUPPORT" && {
                backgroundColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(184,130,42,0.06)",
              },
            ]}
            onPress={() => setActiveTab("SUPPORT")}
          >
            <Feather
              name="headphones"
              size={14}
              color={activeTab === "SUPPORT" ? "#FFFAF0" : colors.text}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "SUPPORT" ? "#FFFAF0" : colors.text,
                },
              ]}
            >
              {t("chat.supportMessages")}
            </Text>
            {supportChats.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === "SUPPORT"
                        ? "rgba(255,250,240,0.3)"
                        : isDark
                          ? "rgba(201,150,63,0.3)"
                          : "rgba(184,130,42,0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    {
                      color: activeTab === "SUPPORT" ? "#FFFAF0" : colors.text,
                    },
                  ]}
                >
                  {supportChats.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={activeChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            activeChats.length === 0 && { flex: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchChats}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
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
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: 1.5 },
  backBtn: { padding: 4 },
  // Tabs
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  tabBadge: {
    marginLeft: 6,
    borderRadius: 8,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  // List
  list: { padding: 16 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: "700" },
  jobTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  time: { fontSize: 12, color: "#9A8E7A" },
  lastMessage: { fontSize: 14 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ef4444",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#FFFAF0", fontSize: 10, fontWeight: "800" },
  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingBottom: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 18,
  },
});
