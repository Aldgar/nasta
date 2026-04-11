import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface TicketAttachment {
  url: string;
  name: string;
  type?: "image" | "document";
  mimeType?: string;
}

interface SupportTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  userId?: string;
  user?: {
    id: string;
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
  };
  name?: string;
  email?: string;
  assignedTo?: string;
  createdAt: string;
  resolution?: string;
  adminNotes?: string;
  attachments?: TicketAttachment[];
}

export default function SupportTicketDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const ticketId = params.ticketId as string;
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/support/admin/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTicket(data);
      } else {
        Alert.alert(t("common.error"), t("admin.failedToLoadTicketDetails"));
        router.back();
      }
    } catch (error) {
      console.error("Error fetching ticket:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      Alert.alert(t("common.required"), t("admin.enterResponseMessage"));
      return;
    }

    try {
      setSendingResponse(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(
        `${base}/support/admin/tickets/${ticketId}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            response: responseText.trim(),
          }),
        },
      );

      if (res.ok) {
        Alert.alert(t("common.success"), t("admin.responseSentSuccessfully"), [
          {
            text: t("common.ok"),
            onPress: () => {
              setShowResponseModal(false);
              setResponseText("");
            },
          },
        ]);
      } else {
        const error = await res.json();
        Alert.alert(
          t("common.error"),
          error.message || t("admin.failedToSendResponse"),
        );
      }
    } catch (error) {
      console.error("Error sending response:", error);
      Alert.alert(t("common.error"), t("common.failedToConnect"));
    } finally {
      setSendingResponse(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "#ef4444";
      case "HIGH":
        return "#f59e0b";
      case "NORMAL":
        return "#C9963F";
      case "LOW":
        return "#8A7B68";
      default:
        return "#8A7B68";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "#22c55e";
      case "IN_PROGRESS":
        return "#C9963F";
      case "CLOSED":
        return "#8A7B68";
      case "OPEN":
        return "#f59e0b";
      default:
        return "#8A7B68";
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!ticket) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Ticket not found
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const userName = ticket.user
    ? `${ticket.user.firstName || ""} ${ticket.user.lastName || ""}`.trim() ||
      ticket.user.email ||
      t("admin.user")
    : ticket.name || t("admin.anonymous");
  const userEmail = ticket.user?.email || ticket.email || t("admin.noEmail");
  const userPhone = ticket.user?.phone || null;

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
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
            {t("admin.ticketDetails")}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {/* Ticket Number */}
          {ticket.ticketNumber && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "rgba(255,250,240,0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.25)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.ticketNumberLabel,
                  { color: isDark ? "#B8A88A" : "#8A7B68" },
                ]}
              >
                {t("admin.ticketNumber")}
              </Text>
              <Text
                style={[
                  styles.ticketNumber,
                  { color: isDark ? "#A78BFA" : "#7C3AED" },
                ]}
              >
                {ticket.ticketNumber}
              </Text>
            </View>
          )}

          {/* User Info */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.90)"
                  : "rgba(255,250,240,0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.25)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("admin.contactInformation")}
            </Text>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: isDark ? "#B8A88A" : "#8A7B68" },
                ]}
              >
                {t("admin.name")}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {userName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: isDark ? "#B8A88A" : "#8A7B68" },
                ]}
              >
                {t("settings.email")}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {userEmail}
              </Text>
            </View>
            {userPhone && (
              <View style={styles.infoRow}>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: isDark ? "#B8A88A" : "#8A7B68" },
                  ]}
                >
                  {t("settings.phone")}:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {userPhone}
                </Text>
              </View>
            )}
            {ticket.userId && (
              <View style={styles.infoRow}>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: isDark ? "#B8A88A" : "#8A7B68" },
                  ]}
                >
                  {t("admin.userId")}:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {ticket.userId}
                </Text>
              </View>
            )}
          </View>

          {/* Ticket Details */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? "rgba(12, 22, 42, 0.90)"
                  : "rgba(255,250,240,0.92)",
                borderColor: isDark
                  ? "rgba(201,150,63,0.25)"
                  : "rgba(184,130,42,0.2)",
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t("admin.ticketDetails")}
            </Text>
            <Text style={[styles.ticketSubject, { color: colors.text }]}>
              {ticket.subject}
            </Text>
            <Text style={[styles.ticketMessage, { color: colors.text }]}>
              {ticket.message}
            </Text>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                <Text
                  style={[
                    styles.attachmentsLabel,
                    { color: isDark ? "#B8A88A" : "#8A7B68" },
                  ]}
                >
                  {t("admin.attachments")} ({ticket.attachments.length})
                </Text>
                <View style={styles.attachmentsGrid}>
                  {ticket.attachments.map((attachment, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.attachmentItem,
                        {
                          backgroundColor: isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.06)",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "rgba(184,130,42,0.2)",
                        },
                      ]}
                      onPress={() => {
                        if (attachment.url) {
                          Linking.openURL(attachment.url).catch((err) => {
                            Alert.alert(
                              t("common.error"),
                              t("admin.failedToOpenAttachment"),
                            );
                          });
                        }
                      }}
                    >
                      {attachment.type === "image" ? (
                        <Image
                          source={{ uri: attachment.url }}
                          style={styles.attachmentThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.attachmentIcon,
                            { backgroundColor: colors.tint },
                          ]}
                        >
                          <Feather name="file" size={24} color="#FFFAF0" />
                        </View>
                      )}
                      <Text
                        style={[styles.attachmentName, { color: colors.text }]}
                        numberOfLines={2}
                        ellipsizeMode="middle"
                      >
                        {attachment.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.badges}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: getPriorityColor(ticket.priority) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: getPriorityColor(ticket.priority) },
                  ]}
                >
                  {ticket.priority}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: getStatusColor(ticket.status) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: getStatusColor(ticket.status) },
                  ]}
                >
                  {ticket.status}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: "rgba(168, 85, 247, 0.2)" },
                ]}
              >
                <Text style={[styles.badgeText, { color: "#a855f7" }]}>
                  {ticket.category}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.dateText,
                { color: isDark ? "#B8A88A" : "#8A7B68" },
              ]}
            >
              Created: {new Date(ticket.createdAt).toLocaleString()}
            </Text>
          </View>

          {/* Resolution */}
          {ticket.resolution && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "rgba(255,250,240,0.92)",
                  borderColor: isDark
                    ? "rgba(201,150,63,0.25)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Resolution
              </Text>
              <Text style={[styles.ticketMessage, { color: colors.text }]}>
                {ticket.resolution}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {ticket.userId && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark ? "#10b981" : "#22c55e",
                    marginBottom: 12,
                  },
                ]}
                onPress={() => {
                  router.push({
                    pathname: "/chat/room",
                    params: {
                      userId: ticket.userId,
                      userName: userName,
                    },
                  } as never);
                }}
              >
                <Feather name="message-circle" size={18} color="#FFFAF0" />
                <Text style={styles.actionButtonText}>
                  {t("admin.startChat")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.responseButton,
                {
                  backgroundColor: isDark ? "#A78BFA" : "#7C3AED",
                },
              ]}
              onPress={() => setShowResponseModal(true)}
            >
              <Feather name="mail" size={18} color="#FFFAF0" />
              <Text style={styles.responseButtonText}>
                {t("admin.respondToUser")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Response Modal */}
        <Modal
          visible={showResponseModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowResponseModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.90)"
                    : "#FFFAF0",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Respond to User
                </Text>
                <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalLabel, { color: colors.text }]}>
                Response Message *
              </Text>
              <TextInput
                style={[
                  styles.modalTextArea,
                  {
                    backgroundColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.06)",
                    color: colors.text,
                    borderColor: isDark
                      ? "rgba(255,250,240,0.15)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                placeholder={t("admin.enterResponseToUser")}
                placeholderTextColor={
                  isDark ? "rgba(255,250,240,0.5)" : "#9A8E7A"
                }
                value={responseText}
                onChangeText={setResponseText}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    {
                      borderColor: isDark
                        ? "rgba(201,150,63,0.25)"
                        : "rgba(184,130,42,0.3)",
                    },
                  ]}
                  onPress={() => {
                    setShowResponseModal(false);
                    setResponseText("");
                  }}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSubmit]}
                  onPress={handleRespond}
                  disabled={sendingResponse || !responseText.trim()}
                >
                  {sendingResponse ? (
                    <ActivityIndicator color="#FFFAF0" />
                  ) : (
                    <Text style={styles.modalButtonTextSubmit}>
                      {t("admin.sendResponse")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  ticketNumberLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    fontWeight: "700",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "700",
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  ticketSubject: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  ticketMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 12,
    marginTop: 8,
  },
  actionButtonsContainer: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 4,
    gap: 8,
  },
  actionButtonText: {
    color: "#FFFAF0",
    fontWeight: "700",
    fontSize: 16,
  },
  responseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 4,
    gap: 8,
  },
  responseButtonText: {
    color: "#FFFAF0",
    fontWeight: "700",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "android" ? 56 : 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalTextArea: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 20,
    minHeight: 150,
    borderWidth: 1,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonSubmit: {
    backgroundColor: "#C9963F",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalButtonTextSubmit: {
    color: "#FFFAF0",
    fontSize: 16,
    fontWeight: "700",
  },
  attachmentsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  attachmentsLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  attachmentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  attachmentItem: {
    width: 100,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
  },
  attachmentIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    fontSize: 11,
    textAlign: "center",
    width: "100%",
    lineHeight: 14,
  },
});
