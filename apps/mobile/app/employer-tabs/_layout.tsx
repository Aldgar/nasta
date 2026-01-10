import { Tabs } from "expo-router";
import React, { useState } from "react";
import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

export default function EmployerTabLayout() {
  const { colorScheme } = useTheme();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setUnreadCount(0);
        return;
      }

      const base = getApiBase();
      const res = await fetch(`${base}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      } else if (res.status === 401) {
        // Token is invalid or expired - silently set count to 0
        setUnreadCount(0);
      } else {
        // Other errors - silently fail, keep current count
      }
    } catch (error: any) {
      // Only log network errors in dev mode to avoid spam
      if (__DEV__) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes("Network request failed")) {
          console.warn(
            `[API] Network request failed. Make sure your server is running and accessible. ` +
              `Current API base: ${getApiBase()}. ` +
              `If using a physical device, ensure EXPO_PUBLIC_API_BASE_URL is set to your machine's IP.`
          );
        }
      }
    }
  };

  // Fetch on mount and when screen is focused
  React.useEffect(() => {
    fetchUnreadCount();
    // Refresh count every 30 seconds (reduced frequency to avoid excessive logging)
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colorScheme === "dark" ? "#1e293b" : "#ffffff",
          borderTopColor:
            colorScheme === "dark"
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.1)",
        },
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.home"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("navigation.myJobs"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="briefcase" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="receipts/index"
        options={{
          title: t("navigation.receipts"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "receipt" : "receipt-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: t("navigation.contact"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="call" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("navigation.updates"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications" size={24} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle:
            unreadCount > 0
              ? {
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  fontSize: 12,
                  minWidth: 18,
                  height: 18,
                  lineHeight: 18,
                }
              : undefined,
        }}
        key={`notifications-${unreadCount}`}
      />
      {/* Hide nested routes that shouldn't appear as tabs */}
      <Tabs.Screen
        name="receipts/[applicationId]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
