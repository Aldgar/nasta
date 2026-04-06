import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

type Message = {
  id: string;
  body: string;
  senderUserId: string;
  senderRole: string;
  createdAt: string;
  payload?: any; // JSON payload from backend
};

export default function ChatRoom() {
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const userName = params.userName as string;
  const conversationId = params.conversationId as string | undefined;

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(conversationId || null);
  const [loading, setLoading] = useState(false); // Start as false to prevent infinite loading
  const [sending, setSending] = useState(false);
  const [contactName, setContactName] = useState<string>(
    userName || t("chat.user"),
  );
  const [contactRole, setContactRole] = useState<string>("");
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      if (activeConversationId) {
        setLoading(true); // Set loading when we have a conversation
        fetchMessages();
        fetchContactInfo(); // Fetch contact name and role - always fetch when we have a conversation

        // Auto-focus input after a delay to show keyboard when conversation is ready
        setTimeout(() => {
          inputRef.current?.focus();
        }, 600);
      } else if (userId) {
        setLoading(true); // Set loading when creating conversation
        findOrCreateConversation();
      }
    }
  }, [currentUserId, userId, activeConversationId]);

  useFocusEffect(
    useCallback(() => {
      if (activeConversationId) {
        fetchMessages();
        fetchContactInfo(); // Refresh contact info when screen is focused

        // Auto-focus input to show keyboard when screen is focused
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300); // Small delay to ensure screen is fully rendered

        // Poll for new messages every 10 seconds when chat is open (less aggressive)
        const interval = setInterval(() => {
          // Silent fetch to avoid loading indicator and prevent infinite loops
          fetchMessages(true);
        }, 10000);

        return () => clearInterval(interval);
      } else if (userId && currentUserId) {
        // If we have a user but no conversation yet, still focus input after a delay
        setTimeout(() => {
          inputRef.current?.focus();
        }, 500);
      }
    }, [activeConversationId, userId, currentUserId]), // Removed loading and sending from dependencies to prevent infinite loop
  );

  // Helper function to decode JWT payload (same as _layout.tsx)
  const decodeJwtPayload = (
    token: string,
  ): { exp?: number; sub?: string; [key: string]: any } | null => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // REMOVED: Pre-checking token expiration causes false positives
  // We now ONLY check when the backend returns 401 (Unauthorized)
  // This way, the backend is the source of truth for token validity

  const fetchCurrentUser = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        // Don't redirect - let the conversation creation handle auth
        console.warn("No token found in chat room");
        return;
      }

      // Decode token to get user ID (most reliable method)
      const payload = decodeJwtPayload(token);
      if (payload) {
        const userId = payload.sub || payload.userId || payload.id;
        if (userId) {
          setCurrentUserId(userId);
          return;
        }
      }

      // Fallback: try /profiles/me to verify token works
      try {
        const base = getApiBase();
        console.log("Verifying token with /profiles/me endpoint");
        const profileRes = await fetch(`${base}/profiles/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Profile response status:", profileRes.status);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const profileUserId = profileData.user?.id || profileData.id;
          if (profileUserId) {
            setCurrentUserId(profileUserId);
            console.log("Token is valid, user ID:", profileUserId);
          }
        } else if (profileRes.status === 401) {
          const errorText = await profileRes.text().catch(() => "");
          console.error(
            "❌ Token invalid when checking /profiles/me:",
            errorText,
          );
          console.error("Token payload:", decodeJwtPayload(token));
          // Token is invalid - clear it but don't redirect immediately
          // Let the conversation creation handle the redirect
          await SecureStore.deleteItemAsync("auth_token");
          console.warn("Token invalid, cleared from storage");
        } else {
          console.log("✅ Token is valid for /profiles/me");
        }
      } catch (fetchError) {
        console.warn("Error fetching profile:", fetchError);
        // Don't redirect on network errors
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      // Don't redirect on errors
    }
  };

  const findOrCreateConversation = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("applications.authenticationRequired"),
          t("chat.pleaseLoginToContinue"),
          [
            {
              text: t("common.ok"),
              onPress: () => router.replace("/login" as never),
            },
          ],
        );
        return;
      }

      // First, verify token works with a known endpoint
      const base = getApiBase();
      try {
        console.log("Verifying token before chat operations...");
        const verifyRes = await fetch(`${base}/profiles/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!verifyRes.ok) {
          const errorText = await verifyRes.text().catch(() => "");
          console.error(
            "❌ Token verification failed:",
            verifyRes.status,
            errorText,
          );

          if (verifyRes.status === 401) {
            // Token is invalid - decode to see what's wrong
            const payload = decodeJwtPayload(token);
            if (payload) {
              const expTime = payload.exp ? new Date(payload.exp * 1000) : null;
              const now = new Date();
              const userId = payload.sub || payload.id || payload.userId;

              console.log("Token details:", {
                userId,
                exp: expTime,
                now,
                isExpired: expTime ? expTime < now : "unknown",
                role: payload.role,
              });

              // If token is not expired, the issue is likely:
              // 1. User doesn't exist in database
              // 2. User is inactive (isActive: false)
              // 3. Token signature is invalid
              if (expTime && expTime > now) {
                console.warn(
                  "⚠️ Token is NOT expired but backend rejected it!",
                );
                console.warn(
                  "This likely means: user doesn't exist, user is inactive, or token signature is invalid",
                );
              }
            }

            // Clear invalid token and redirect to login
            await SecureStore.deleteItemAsync("auth_token");
            if (showLoading) setLoading(false);

            Alert.alert(
              t("chat.authenticationError"),
              t("chat.sessionInvalidMessage"),
              [
                {
                  text: t("common.ok"),
                  onPress: () => {
                    router.replace("/login" as never);
                  },
                },
              ],
            );
            return;
          }
        } else {
          console.log("✅ Token is valid, proceeding with chat operations");
        }
      } catch (verifyError) {
        console.error("Error verifying token:", verifyError);
        // Continue anyway - might be network issue
      }

      if (!userId) {
        Alert.alert(t("common.error"), t("chat.invalidUserSelected"));
        router.back();
        return;
      }

      // First, try to find existing conversation
      try {
        const listRes = await fetch(`${base}/chat/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (listRes.ok) {
          const listData = await listRes.json();
          const conversations = Array.isArray(listData)
            ? listData
            : listData.conversations || [];

          // Find conversation with this user
          const existingConv = conversations.find((conv: any) => {
            const others = conv.others || [];
            return others.some((p: any) => p.userId === userId);
          });

          if (existingConv) {
            setActiveConversationId(existingConv.id);
            // Fetch contact info when conversation is found
            fetchContactInfo();
            return;
          }
        } else if (listRes.status === 401) {
          // Backend says token is invalid - this is the only time we should show session expired
          const errorData = await listRes.text().catch(() => "");
          console.log(
            "Backend returned 401 when listing conversations:",
            errorData,
          );
          await SecureStore.deleteItemAsync("auth_token");
          Alert.alert(
            t("chat.sessionExpired"),
            t("chat.sessionExpiredMessage"),
            [
              {
                text: t("common.ok"),
                onPress: () => router.replace("/login" as never),
              },
            ],
          );
          return;
        }
      } catch (listError) {
        console.error("Error listing conversations:", listError);
        // Continue to create new conversation
      }

      // Create new conversation
      const createRes = await fetch(`${base}/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "JOB", // Backend only supports SUPPORT and JOB, using JOB for direct messages
          participantIds: [userId],
        }),
      });

      if (createRes.ok) {
        const data = await createRes.json();
        setActiveConversationId(data.id);
      } else {
        const errorText = await createRes.text();
        let errorMessage = t("chat.failedToCreateConversation");
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          // If not JSON, use the text or default message
          if (errorText && errorText.length < 100) {
            errorMessage = errorText;
          }
        }

        if (createRes.status === 401) {
          // Backend says token is invalid - this is the only time we should show session expired
          const errorData = await createRes.text().catch(() => "");
          console.log(
            "Backend returned 401 when creating conversation:",
            errorData,
          );
          await SecureStore.deleteItemAsync("auth_token");
          Alert.alert(
            t("chat.sessionExpired"),
            t("chat.sessionExpiredMessage"),
            [
              {
                text: t("common.ok"),
                onPress: () => router.replace("/login" as never),
              },
            ],
          );
        } else {
          console.error(
            "Conversation creation error:",
            errorMessage,
            "Status:",
            createRes.status,
          );
          // Show user-friendly error for non-401 errors
          if (createRes.status !== 401) {
            // Don't block the user - they can try sending a message which will retry
            console.log(
              "User can still try sending a message to create conversation",
            );
          }
        }
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      // Don't show alert for network errors, let user try again
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchContactInfo = async () => {
    if (!activeConversationId) {
      console.log("❌ fetchContactInfo: No activeConversationId");
      return;
    }

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        console.log("❌ fetchContactInfo: No token");
        return;
      }

      const base = getApiBase();
      console.log(
        "🔍 fetchContactInfo: Fetching conversations for",
        activeConversationId,
      );

      // Get conversation details to find participant info
      const listRes = await fetch(`${base}/chat/conversations?pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (listRes.ok) {
        const conversations = await listRes.json();
        const conv = Array.isArray(conversations)
          ? conversations.find((c: any) => c.id === activeConversationId)
          : conversations.conversations?.find(
              (c: any) => c.id === activeConversationId,
            );

        console.log(
          "📋 fetchContactInfo: Found conversation:",
          conv ? "✅ yes" : "❌ no",
          "others:",
          conv?.others?.length || 0,
        );

        // Update locked status from conversation data
        if (conv) {
          setIsLocked(!!conv.locked);
        }

        if (conv?.others?.[0]) {
          const other = conv.others[0];
          const otherUserId = other.userId;
          const otherRole = other.role;

          console.log("👤 fetchContactInfo: Other participant:", {
            otherUserId,
            otherRole,
            hasName: !!(other.firstName || other.lastName),
          });

          // Map role to display label
          // Handle both enum values and string values - normalize to string first
          const roleStr = String(otherRole).toUpperCase();
          const roleLabel =
            roleStr === "ADMIN"
              ? t("auth.admin")
              : roleStr === "EMPLOYER"
                ? t("auth.employer")
                : t("auth.serviceProvider");
          setContactRole(roleLabel);
          console.log(
            "✅ fetchContactInfo: Set role to:",
            roleLabel,
            "from role:",
            otherRole,
            "normalized:",
            roleStr,
          );

          // Use participant details directly from conversation (backend now includes firstName, lastName, email)
          if (other.firstName || other.lastName || other.email) {
            const name =
              `${other.firstName || ""} ${other.lastName || ""}`.trim() ||
              other.email ||
              t("chat.user");
            console.log(
              "✅ fetchContactInfo: Using participant name from conversation:",
              name,
            );
            setContactName(name);
            return;
          }

          // Fallback: Try to get user details if not included in conversation
          try {
            let user = null;

            // Try regular users endpoint first (works for most users, but may require admin access)
            try {
              const usersRes = await fetch(`${base}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (usersRes.ok) {
                const usersData = await usersRes.json();
                const users = Array.isArray(usersData)
                  ? usersData
                  : usersData.users || usersData.items || [];
                user = users.find((u: any) => u.id === otherUserId);
                console.log(
                  "👥 fetchContactInfo: Found user in /admin/users:",
                  user ? "✅ yes" : "❌ no",
                  "total users:",
                  users.length,
                );
              } else {
                console.log(
                  "⚠️ fetchContactInfo: /admin/users returned",
                  usersRes.status,
                  "- may require admin access",
                );
              }
            } catch (e) {
              console.log(
                "❌ Could not fetch user details from /admin/users:",
                e,
              );
            }

            // If not found and it's an admin, try admin list endpoint (may require SUPER_ADMIN)
            if (!user && otherRole === "ADMIN") {
              try {
                const adminRes = await fetch(`${base}/auth/admin/list`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (adminRes.ok) {
                  const adminsData = await adminRes.json();
                  const admins = Array.isArray(adminsData)
                    ? adminsData
                    : adminsData.admins || adminsData.items || [];
                  user = admins.find((a: any) => a.id === otherUserId);
                  console.log(
                    "👑 fetchContactInfo: Found admin in /auth/admin/list:",
                    user ? "✅ yes" : "❌ no",
                    "total admins:",
                    admins.length,
                  );
                } else {
                  console.log(
                    "⚠️ fetchContactInfo: /auth/admin/list returned",
                    adminRes.status,
                    "- may require SUPER_ADMIN",
                  );
                }
              } catch (e) {
                console.log("❌ Could not fetch admin details:", e);
              }
            }

            if (user) {
              const name =
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.email ||
                "User";
              console.log(
                "✅ fetchContactInfo: Setting contact name to:",
                name,
              );
              setContactName(name);
              return;
            } else {
              // If we can't get user details, at least show the role
              // Use a generic name based on role
              const roleBasedName =
                otherRole === "ADMIN"
                  ? t("auth.admin")
                  : otherRole === "EMPLOYER"
                    ? t("auth.employer")
                    : t("auth.serviceProvider");
              console.log(
                "⚠️ fetchContactInfo: Using role-based name:",
                roleBasedName,
              );
              setContactName(roleBasedName);
            }
          } catch (e) {
            console.log("❌ Error fetching user details:", e);
            // On error, at least show the role
            const roleBasedName =
              otherRole === "ADMIN"
                ? "Admin"
                : otherRole === "EMPLOYER"
                  ? "Employer"
                  : "Service Provider";
            setContactName(roleBasedName);
          }
        } else {
          console.log("⚠️ fetchContactInfo: No others found in conversation");
        }
      } else {
        console.log(
          "❌ fetchContactInfo: Failed to fetch conversations:",
          listRes.status,
        );
      }

      // Fallback: use passed userName if available
      if (userName && userName !== t("chat.user")) {
        console.log("📝 fetchContactInfo: Using passed userName:", userName);
        setContactName(userName);
      }
    } catch (error) {
      console.error("❌ Error fetching contact info:", error);
      // On error, at least try to use passed userName
      if (userName && userName !== t("chat.user")) {
        setContactName(userName);
      }
    }
  };

  const fetchMessages = async (silent = false) => {
    if (!activeConversationId) {
      if (!silent) setLoading(false);
      return;
    }

    // Prevent multiple simultaneous fetches (unless silent)
    if (loading && !silent) return;

    try {
      if (!silent) setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        if (!silent) setLoading(false);
        return;
      }

      // No pre-check - let the backend decide if token is valid
      // Only show "Session Expired" when backend returns 401

      const base = getApiBase();
      const res = await fetch(
        `${base}/chat/conversations/${activeConversationId}/messages?pageSize=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        const messagesList = Array.isArray(data) ? data : data.messages || [];
        // Backend returns messages in ascending order (oldest first), so no need to reverse
        // Messages will display with oldest at top, newest at bottom

        // Debug: Log messages with payloads to see structure
        messagesList.forEach((msg: any) => {
          if (msg.payload) {
            console.log(
              "Message payload:",
              msg.id,
              msg.payload,
              typeof msg.payload,
            );
          }
        });

        setMessages(messagesList);

        // Scroll to bottom after messages load (only if not silent)
        if (!silent) {
          setTimeout(() => {
            if (flatListRef.current && messagesList.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
            // Auto-focus input to show keyboard after messages load
            setTimeout(() => {
              inputRef.current?.focus();
            }, 200);
          }, 100);
        }
      } else if (res.status === 401) {
        // Token is invalid - clear it and redirect
        await SecureStore.deleteItemAsync("auth_token");
        Alert.alert(t("auth.sessionExpired"), t("auth.pleaseLoginAgain"), [
          {
            text: t("common.ok"),
            onPress: () => router.replace("/login" as never),
          },
        ]);
      } else {
        console.error("Failed to fetch messages:", res.status);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // File upload functions
  const pickImage = async () => {
    if (uploadingFile) return;
    try {
      setShowAttachmentMenu(false);
      setUploadingFile(true);

      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("kyc.permissionRequired"),
          t("kyc.pleaseAllowPhotosAccess"),
        );
        setUploadingFile(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        ...(Platform.OS === "ios"
          ? ({ preferredAssetRepresentationMode: "compatible" } as any)
          : null),
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(
          result.assets[0].uri,
          "image",
          result.assets[0].fileName || "image.jpg",
        );
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(t("common.error"), t("chat.failedToPickImage"));
    } finally {
      setUploadingFile(false);
    }
  };

  const takePhoto = async () => {
    if (uploadingFile) return;
    try {
      setShowAttachmentMenu(false);
      setUploadingFile(true);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("kyc.permissionRequired"), t("kyc.pleaseAllowAccess"));
        setUploadingFile(false);
        return;
      }

      // Check if camera is available (not available on simulators)
      const cameraAvailable = await ImagePicker.getCameraPermissionsAsync();
      if (!cameraAvailable.granted) {
        Alert.alert(t("common.error"), t("chat.cameraNotAvailable"));
        setUploadingFile(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, "image", "photo.jpg");
      }
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("simulator") || msg.includes("not available")) {
        Alert.alert(t("common.error"), t("chat.cameraNotAvailable"));
      } else {
        console.error("Error taking photo:", error);
        Alert.alert(t("common.error"), t("chat.failedToTakePhoto"));
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const pickDocument = async () => {
    if (uploadingFile) return;
    try {
      setShowAttachmentMenu(false);
      setUploadingFile(true);

      // Small delay to ensure any previous picker is fully dismissed
      await new Promise((r) => setTimeout(r, 300));

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(
          result.assets[0].uri,
          "document",
          result.assets[0].name,
        );
      }
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("picking in progress") || msg.includes("Await other")) {
        // Silently ignore concurrent picker errors
      } else {
        console.error("Error picking document:", error);
        Alert.alert(t("common.error"), t("chat.failedToPickDocument"));
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const uploadFile = async (
    fileUri: string,
    fileType: "image" | "document",
    fileName: string,
  ) => {
    if (!activeConversationId) {
      // Create conversation first
      await findOrCreateConversation(false);
      if (!activeConversationId) {
        Alert.alert(t("common.error"), t("chat.couldNotStartConversation"));
        return;
      }
    }

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("chat.pleaseLoginToContinue"));
        return;
      }

      const base = getApiBase();

      // Create FormData for file upload
      const formData = new FormData();
      const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
      let mimeType = "application/octet-stream";

      if (fileType === "image") {
        if (fileExtension === "jpg" || fileExtension === "jpeg") {
          mimeType = "image/jpeg";
        } else if (fileExtension === "png") {
          mimeType = "image/png";
        } else if (fileExtension === "gif") {
          mimeType = "image/gif";
        } else if (fileExtension === "webp") {
          mimeType = "image/webp";
        } else {
          mimeType = "image/jpeg";
        }
      } else {
        // Document types
        if (fileExtension === "pdf") {
          mimeType = "application/pdf";
        } else if (fileExtension === "doc") {
          mimeType = "application/msword";
        } else if (fileExtension === "docx") {
          mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (fileExtension === "txt") {
          mimeType = "text/plain";
        }
      }

      formData.append("file", {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);
      formData.append("conversationId", activeConversationId);
      formData.append("type", fileType);

      const res = await fetch(`${base}/chat/messages/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh messages
        await fetchMessages();
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      } else if (res.status === 401) {
        await SecureStore.deleteItemAsync("auth_token");
        Alert.alert(t("auth.sessionExpired"), t("auth.pleaseLoginAgain"), [
          {
            text: t("common.ok"),
            onPress: () => router.replace("/login" as never),
          },
        ]);
      } else {
        const errorText = await res.text();
        Alert.alert(t("common.error"), t("chat.failedToUploadFile"));
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      Alert.alert(t("common.error"), t("chat.failedToUploadFile"));
    }
  };

  const sendMessage = async (messageBody?: string, payload?: any) => {
    const messageText = messageBody || inputText.trim();
    if ((!messageText && !payload) || sending) return;

    try {
      setSending(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("chat.pleaseLoginToContinue"));
        router.replace("/login" as never);
        return;
      }

      // No pre-check - let the backend decide if token is valid
      // Only show "Session Expired" when backend returns 401

      // If no conversation exists, create one first
      if (!activeConversationId) {
        try {
          // Create conversation without showing loading (user is already trying to send)
          const base = getApiBase();
          const createRes = await fetch(`${base}/chat/conversations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              type: "JOB",
              participantIds: [userId],
            }),
          });

          if (createRes.ok) {
            const data = await createRes.json();
            setActiveConversationId(data.id);
          } else if (createRes.status === 401) {
            // Backend says token is invalid - this is the only time we should show session expired
            const errorData = await createRes.text().catch(() => "");
            console.log(
              "Backend returned 401 when creating conversation from sendMessage:",
              errorData,
            );
            await SecureStore.deleteItemAsync("auth_token");
            Alert.alert(
              t("auth.sessionExpired"),
              t("auth.sessionExpiredMessage"),
              [
                {
                  text: t("common.ok"),
                  onPress: () => router.replace("/login" as never),
                },
              ],
            );
            setSending(false);
            return;
          } else {
            const errorText = await createRes.text();
            console.error("Failed to create conversation:", errorText);
            // Try to find existing conversation first
            await findOrCreateConversation(false);
            if (!activeConversationId) {
              Alert.alert(
                t("common.error"),
                t("chat.couldNotStartConversationCheckConnection"),
              );
              setSending(false);
              return;
            }
          }
        } catch (error) {
          console.error("Error creating conversation:", error);
          Alert.alert(
            t("common.error"),
            t("chat.couldNotStartConversationCheckConnection"),
          );
          setSending(false);
          return;
        }
      }

      const base = getApiBase();
      const res = await fetch(`${base}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          body: messageText,
          payload: payload,
        }),
      });

      if (res.ok) {
        if (!messageBody) setInputText("");
        // Refresh messages
        await fetchMessages();
        // Scroll to bottom
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      } else if (res.status === 401) {
        // Token is invalid - clear it and redirect
        await SecureStore.deleteItemAsync("auth_token");
        Alert.alert(t("auth.sessionExpired"), t("auth.pleaseLoginAgain"), [
          {
            text: t("common.ok"),
            onPress: () => router.replace("/login" as never),
          },
        ]);
      } else {
        const errorText = await res.text();
        let errorMessage = t("chat.failedToSendMessage");
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          // Use default message
        }
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert(t("common.error"), t("errors.networkError"));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderUserId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar =
      !isMe && (!prevMessage || prevMessage.senderUserId !== item.senderUserId);
    const showTime =
      !prevMessage ||
      new Date(item.createdAt).getTime() -
        new Date(prevMessage.createdAt).getTime() >
        300000; // 5 minutes

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.myMessageContainer : styles.theirMessageContainer,
          { marginBottom: showTime ? 16 : 4 },
        ]}
      >
        {!isMe && showAvatar && (
          <View
            style={[
              styles.avatar,
              { backgroundColor: isDark ? "#5C5548" : "#D4C0A0" },
            ]}
          >
            <Text style={styles.avatarText}>
              {(userName || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {!isMe && !showAvatar && <View style={styles.avatarSpacer} />}
        <View style={styles.messageContent}>
          {showTime && (
            <Text
              style={[
                styles.messageDate,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {new Date(item.createdAt).toLocaleDateString() ===
              new Date().toLocaleDateString()
                ? t("chat.today")
                : new Date(item.createdAt).toLocaleDateString()}
            </Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isMe
                ? [
                    styles.myMessage,
                    {
                      backgroundColor: isDark ? "#14B8A6" : "#0891B2",
                      borderBottomRightRadius: 4,
                    },
                  ]
                : [
                    styles.theirMessage,
                    {
                      backgroundColor: isDark
                        ? "rgba(51, 65, 85, 0.6)"
                        : "#FFFAF0",
                      borderBottomLeftRadius: 4,
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.10)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ],
            ]}
          >
            {(() => {
              // Parse payload - it might be a string or object
              console.log(
                "🔍 Checking payload for message:",
                item.id,
                "Payload:",
                item.payload,
                "Type:",
                typeof item.payload,
              );

              if (!item.payload) {
                console.log("❌ No payload for message:", item.id);
                return null;
              }

              let payload: any;
              try {
                payload =
                  typeof item.payload === "string"
                    ? JSON.parse(item.payload)
                    : item.payload;
                console.log("✅ Parsed payload:", payload);
              } catch (e) {
                console.error(
                  "❌ Failed to parse payload:",
                  e,
                  "Raw payload:",
                  item.payload,
                );
                return null;
              }

              // Check if it's an image
              console.log(
                "🔍 Checking payload type:",
                payload?.type,
                "Has imageUrl:",
                !!payload?.imageUrl,
                "Has fileUrl:",
                !!payload?.fileUrl,
              );

              if (payload?.type !== "image") {
                console.log("❌ Not an image type, type is:", payload?.type);
                return null;
              }

              if (!payload.imageUrl && !payload.fileUrl) {
                console.log("❌ No imageUrl or fileUrl in payload");
                return null;
              }

              // Construct image URL
              let imageUrl: string;
              const urlSource = payload.imageUrl || payload.fileUrl;

              if (!urlSource) {
                console.error("❌ No imageUrl or fileUrl in payload:", payload);
                return null;
              }

              if (
                urlSource.startsWith("http://") ||
                urlSource.startsWith("https://")
              ) {
                imageUrl = urlSource;
              } else if (urlSource.startsWith("/")) {
                // URL already has leading slash
                imageUrl = `${getApiBase()}${urlSource}`;
              } else {
                // URL doesn't have leading slash, add it
                imageUrl = `${getApiBase()}/${urlSource}`;
              }

              console.log(
                "🖼️ Rendering image - Original URL:",
                urlSource,
                "Final URL:",
                imageUrl,
                "API Base:",
                getApiBase(),
              );

              return (
                <View style={{ marginBottom: 8 }}>
                  <Pressable
                    onPress={() => {
                      console.log("👆 Image pressed, URL:", imageUrl);
                      setFullScreenImage(imageUrl);
                    }}
                    style={styles.imagePressable}
                    android_ripple={{ color: "rgba(184,130,42,0.3)" }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.messageImage}
                      resizeMode="cover"
                      onLoad={() => {
                        console.log("✅ Image loaded successfully:", imageUrl);
                      }}
                      onError={(error) => {
                        console.error(
                          "❌ Image load error:",
                          error,
                          "URL:",
                          imageUrl,
                        );
                      }}
                    />
                  </Pressable>
                </View>
              );
            })()}
            {(() => {
              // Check if message has document payload
              if (!item.payload) return null;

              let payload: any;
              try {
                payload =
                  typeof item.payload === "string"
                    ? JSON.parse(item.payload)
                    : item.payload;
              } catch (e) {
                return null;
              }

              if (payload?.type !== "document") return null;

              return (
                <View style={styles.documentContainer}>
                  <Feather
                    name="file"
                    size={24}
                    color={isMe ? "#FFFAF0" : colors.text}
                  />
                  <Text
                    style={[
                      styles.documentName,
                      { color: isMe ? "#FFFAF0" : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {payload.fileName || t("chat.document")}
                  </Text>
                </View>
              );
            })()}
            {item.body && (
              <Text
                style={[
                  styles.messageText,
                  { color: isMe ? "#FFFAF0" : colors.text },
                ]}
                allowFontScaling={true}
                selectable={false}
              >
                {item.body}
              </Text>
            )}
            <Text
              style={[
                styles.messageTime,
                {
                  color: isMe
                    ? "rgba(240,232,213,0.7)"
                    : isDark
                      ? "#9A8E7A"
                      : "#8A7B68",
                },
              ]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !activeConversationId) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {userName || t("chat.title")}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t("chat.startingConversation")}
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: "transparent",
              borderBottomColor: isDark
                ? "rgba(201,150,63,0.12)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(240,232,213,0.7)",
              },
            ]}
          >
            <Feather
              name="arrow-left"
              size={20}
              color={isDark ? "#FFFAF0" : "#1A1710"}
            />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text
              style={[
                styles.headerTitle,
                {
                  color: isDark ? "#FFFAF0" : "#1A1710",
                  textShadowColor: isDark
                    ? "rgba(0,0,0,0.5)"
                    : "rgba(240,232,213,0.8)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                },
              ]}
            >
              {contactName}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {contactRole && (
                <Text
                  style={[
                    styles.headerRole,
                    {
                      color: isDark ? "#F0E8D5" : "#6B6355",
                      textShadowColor: isDark
                        ? "rgba(0,0,0,0.5)"
                        : "rgba(240,232,213,0.8)",
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    },
                  ]}
                >
                  {contactRole}
                </Text>
              )}
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
                ]}
              >
                {loading && !activeConversationId
                  ? t("chat.starting")
                  : activeConversationId
                    ? ""
                    : t("chat.ready")}
              </Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          style={{ flex: 1 }}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => renderMessage({ item, index })}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              inverted={false}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View
                    style={[
                      styles.emptyIconContainer,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.06)"
                          : "rgba(184,130,42,0.06)",
                      },
                    ]}
                  >
                    <Feather
                      name="message-square"
                      size={48}
                      color={
                        isDark ? "rgba(201,150,63,0.25)" : "rgba(0,0,0,0.3)"
                      }
                    />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    {t("chat.noMessagesYet")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtext,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {t("chat.startConversation")}
                  </Text>
                </View>
              }
            />
          )}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: "transparent",
                borderTopColor: isDark
                  ? "rgba(201,150,63,0.12)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            {isLocked ? (
              <View
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: isDark ? "#9A8E7A" : "#8A7B68",
                    fontSize: 13,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  🔒{" "}
                  {t("chat.conversationLocked") ||
                    "This conversation is locked. The job has been completed."}
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setShowAttachmentMenu(true)}
                  style={styles.attachBtn}
                  disabled={sending || !userId || uploadingFile}
                >
                  {uploadingFile ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#FFFAF0" : "#1A1710"}
                    />
                  ) : (
                    <Feather
                      name="plus"
                      size={24}
                      color={isDark ? "#FFFAF0" : "#1A1710"}
                    />
                  )}
                </TouchableOpacity>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark
                        ? "rgba(0,0,0,0.3)"
                        : "rgba(255,250,240,0.92)",
                      color: colors.text,
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(0,0,0,0.08)",
                    },
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={
                    activeConversationId
                      ? t("chat.typeMessage")
                      : t("chat.startingConversation")
                  }
                  placeholderTextColor={isDark ? "#9A8E7A" : "#9A8E7A"}
                  multiline
                  editable={!sending && !!userId && !uploadingFile}
                  keyboardType="default"
                  textContentType="none"
                  autoCorrect={true}
                  autoCapitalize="sentences"
                  returnKeyType="default"
                />
                <TouchableOpacity
                  onPress={() => sendMessage()}
                  disabled={
                    (!inputText.trim() && !uploadingFile) || sending || !userId
                  }
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        (inputText.trim() || uploadingFile) &&
                        userId &&
                        !sending
                          ? isDark
                            ? "#14B8A6"
                            : "#0891B2"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.2)",
                    },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFFAF0" size="small" />
                  ) : (
                    <Feather
                      name="send"
                      size={20}
                      color={
                        (inputText.trim() || uploadingFile) && userId
                          ? "#FFFAF0"
                          : isDark
                            ? "#9A8E7A"
                            : "#9A8E7A"
                      }
                    />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Attachment Menu Modal */}
        <Modal
          visible={showAttachmentMenu}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAttachmentMenu(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachmentMenu(false)}
          >
            <View
              style={[
                styles.attachmentMenu,
                {
                  backgroundColor: isDark ? "#0A1628" : "#FFFAF0",
                  borderTopColor: isDark
                    ? "rgba(201,150,63,0.12)"
                    : "rgba(184,130,42,0.2)",
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.attachmentMenuHeader}>
                <Text
                  style={[styles.attachmentMenuTitle, { color: colors.text }]}
                >
                  {t("chat.attach")}
                </Text>
                <TouchableOpacity onPress={() => setShowAttachmentMenu(false)}>
                  <Feather name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.attachmentOptions}>
                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={pickDocument}
                >
                  <View
                    style={[
                      styles.attachmentIcon,
                      {
                        backgroundColor: isDark
                          ? "#14B8A6"
                          : "rgba(255,250,240,0.92)",
                      },
                    ]}
                  >
                    <Feather
                      name="file"
                      size={24}
                      color={isDark ? "#FFFAF0" : "#0891B2"}
                    />
                  </View>
                  <Text
                    style={[styles.attachmentLabel, { color: colors.text }]}
                  >
                    {t("chat.file")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={pickImage}
                >
                  <View
                    style={[
                      styles.attachmentIcon,
                      { backgroundColor: isDark ? "#10b981" : "#d1fae5" },
                    ]}
                  >
                    <Feather
                      name="image"
                      size={24}
                      color={isDark ? "#FFFAF0" : "#10b981"}
                    />
                  </View>
                  <Text
                    style={[styles.attachmentLabel, { color: colors.text }]}
                  >
                    {t("chat.photosAndVideos")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={takePhoto}
                >
                  <View
                    style={[
                      styles.attachmentIcon,
                      { backgroundColor: isDark ? "#f59e0b" : "#fef3c7" },
                    ]}
                  >
                    <Feather
                      name="camera"
                      size={24}
                      color={isDark ? "#FFFAF0" : "#f59e0b"}
                    />
                  </View>
                  <Text
                    style={[styles.attachmentLabel, { color: colors.text }]}
                  >
                    {t("chat.camera")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Full Screen Image Modal */}
        <Modal
          visible={!!fullScreenImage}
          transparent
          animationType="fade"
          onRequestClose={() => setFullScreenImage(null)}
        >
          <TouchableOpacity
            style={styles.fullScreenImageOverlay}
            activeOpacity={1}
            onPress={() => setFullScreenImage(null)}
          >
            <View style={styles.fullScreenImageContainer}>
              {fullScreenImage && (
                <Image
                  source={{ uri: fullScreenImage }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              )}
              <TouchableOpacity
                style={styles.closeImageButton}
                onPress={() => setFullScreenImage(null)}
              >
                <Feather name="x" size={32} color="#FFFAF0" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerRole: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  messageList: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  myMessageContainer: {
    justifyContent: "flex-end",
  },
  theirMessageContainer: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 4,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFAF0",
  },
  avatarSpacer: {
    width: 40,
  },
  messageContent: {
    flex: 1,
    maxWidth: "75%",
  },
  messageDate: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 8,
    marginTop: 8,
    fontWeight: "500",
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 0,
  },
  myMessage: {
    alignSelf: "flex-end",
  },
  theirMessage: {
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
    includeFontPadding: false,
    fontFamily: Platform.OS === "android" ? "sans-serif" : undefined,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 2,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 1,
    marginRight: 12,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 0,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  attachmentMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
  },
  attachmentMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  attachmentMenuTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  attachmentOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  attachmentOption: {
    width: "22%",
    alignItems: "center",
    marginBottom: 20,
  },
  attachmentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  emojiPicker: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    maxHeight: "50%",
  },
  emojiPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emojiPickerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emojiGrid: {
    flex: 1,
  },
  emojiGridContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 20,
    justifyContent: "flex-start",
  },
  emojiItem: {
    width: "11%",
    minWidth: 40,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    padding: 4,
  },
  emojiText: {
    fontSize: 32,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    fontFamily: Platform.OS === "android" ? "sans-serif" : undefined,
  },
  imagePressable: {
    width: "100%",
    marginBottom: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  messageImage: {
    width: "100%",
    minHeight: 150,
    maxHeight: 300,
    borderRadius: 4,
    backgroundColor: "rgba(184,130,42,0.2)",
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(184,130,42,0.2)",
    marginBottom: 8,
  },
  documentName: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  fullScreenImageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  closeImageButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
