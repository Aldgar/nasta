import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
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
};

export default function InboxScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

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
        } 
      });
      
      if (res.ok) {
        const data = await res.json();
        const conversations = Array.isArray(data) ? data : (data.conversations || []);
        // Transform conversations to chat preview format
        const transformedChats = conversations.map((conv: any) => {
          const other = conv.others?.[0] || {};
          const lastMsg = conv.lastMessage;
          
          // Use actual name from conversation (backend now includes firstName, lastName, email)
          let partnerName = "Unknown";
          if (other.firstName || other.lastName) {
            partnerName = `${other.firstName || ''} ${other.lastName || ''}`.trim();
          } else if (other.email) {
            partnerName = other.email;
          } else if (other.userId) {
            // Fallback: use role-based name if available
            const roleStr = String(other.role || '').toUpperCase();
            partnerName = roleStr === 'ADMIN' ? 'Admin' 
              : roleStr === 'EMPLOYER' ? 'Employer' 
              : roleStr === 'JOB_SEEKER' ? 'Service Provider'
              : 'User';
          }
          
          return {
            id: conv.id,
            partnerName: partnerName,
            partnerUserId: other.userId,
            partnerAvatar: null,
            lastMessage: lastMsg?.body || t("chat.noMessagesYet"),
            updatedAt: conv.updatedAt || conv.createdAt,
            unreadCount: 0, // TODO: implement unread count
          };
        });
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
    }, [])
  );

  const renderItem = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        { 
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
        }
      ]}
      onPress={() => router.push({ 
        pathname: "/chat/room", 
        params: { 
          conversationId: item.id,
          userId: item.partnerUserId || "",
          userName: item.partnerName 
        } 
      })}
    >
      <View style={[styles.avatar, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
        {item.partnerAvatar ? (
            <Image source={{ uri: item.partnerAvatar }} style={styles.avatarImage} />
        ) : (
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#9ca3af" }}>
                {item.partnerName.charAt(0)}
            </Text>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
            <Text style={[styles.name, { color: colors.text }]}>{item.partnerName}</Text>
            <Text style={styles.time}>
                {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
        <Text style={[styles.lastMessage, { color: isDark ? "#9ca3af" : "#6b7280" }]} numberOfLines={1}>
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

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("chat.messages")}</Text>
            <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={chats}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchChats} tintColor={colors.text} />}
          ListEmptyComponent={
            !loading ? (
                <View style={styles.emptyState}>
                    <Feather name="message-square" size={48} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>{t("chat.noMessagesYet")}</Text>
                </View>
            ) : null
          }
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
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  backBtn: { padding: 4 },
  list: { padding: 16 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 16, fontWeight: "600" },
  time: { fontSize: 12, color: "#9ca3af" },
  lastMessage: { fontSize: 14 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, opacity: 0.6 },
});
