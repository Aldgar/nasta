import { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Stack, useRootNavigationState, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getApiBase } from "../lib/api";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

// Note: react-native-reanimated is imported by individual components that use it
// The Babel plugin handles worklet transformation automatically
// Side-effect import removed to avoid initialization conflicts with React Native 0.81.5

// Conditionally import Stripe - it's not available in Expo Go
// Use lazy loading to prevent module initialization errors
let StripeProvider: any = null;
let stripeChecked = false;

const getStripeProvider = () => {
  if (stripeChecked) return StripeProvider;
  stripeChecked = true;

  try {
    const stripe = (() => {
      try {
        return require("@stripe/stripe-react-native");
      } catch {
        return null;
      }
    })();

    if (stripe && stripe.StripeProvider) {
      StripeProvider = stripe.StripeProvider;
    }
  } catch (e) {
    // Stripe not available (e.g., in Expo Go)
    StripeProvider = null;
  }

  return StripeProvider;
};
// Lightweight JWT payload decode (no external dependency)
function decodeJwtPayload(
  token: string
): { sub?: string; email?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

import { ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as any,
});

function RootLayoutNav() {
  const { colorScheme, isDark } = useTheme();
  const navState = useRootNavigationState();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const hasCheckedAuth = useRef(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Fetch Stripe publishable key (non-blocking)
  useEffect(() => {
    const fetchStripeKey = async () => {
      try {
        const baseUrl = getApiBase();
        // Use a timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`${baseUrl}/payments/config`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.publishableKey) {
              setPublishableKey(data.publishableKey);
            }
          } else {
            console.warn(
              "Stripe config endpoint returned non-OK status:",
              response.status
            );
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          // Silently fail - Stripe is only needed for payment pages
          // Don't log network errors as they're expected if server is down
          if (
            fetchError.name !== "AbortError" &&
            !(
              fetchError.message &&
              fetchError.message.includes("Network request failed")
            )
          ) {
            console.warn(
              "Failed to fetch Stripe publishable key:",
              fetchError.message || fetchError
            );
          }
        }
      } catch (error) {
        // Outer catch for any other errors
        if (
          error instanceof Error &&
          !error.message.includes("Network request failed")
        ) {
          console.warn("Error in Stripe key fetch:", error.message);
        }
      }
    };
    fetchStripeKey();
  }, []);

  // Initialize push notifications
  useEffect(() => {
    const registerForPushNotifications = async () => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return; // Only register if logged in

        // Request permissions
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("Push notification permission denied");
          return;
        }

        // Get push token (handle Firebase errors gracefully)
        let pushToken;
        try {
          pushToken = await Notifications.getExpoPushTokenAsync({
            projectId: undefined, // Expo will auto-detect
          });
        } catch (error: any) {
          // Firebase not initialized is expected on iOS/Android without proper setup
          if (
            error?.message?.includes("Firebase") ||
            error?.message?.includes("FirebaseApp")
          ) {
            console.log(
              "Push notifications require Firebase setup for native builds. Skipping token registration."
            );
            return;
          }
          throw error; // Re-throw other errors
        }

        // Register token with backend
        const base = getApiBase();
        try {
          await fetch(`${base}/notifications/register-token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              pushToken: pushToken.data,
              platform: Platform.OS,
            }),
          });
        } catch (err) {
          console.warn("Failed to register push token:", err);
        }

        // Set up notification listeners
        notificationListener.current =
          Notifications.addNotificationReceivedListener((notification) => {
            console.log("Notification received:", notification);
          });

        responseListener.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
            console.log("Notification response:", response);
            // Handle notification tap - navigate to relevant screen
            const data = response.notification.request.content.data;
            if (data?.conversationId) {
              router.push(
                `/chat/room?conversationId=${data.conversationId}` as any
              );
            } else if (data?.jobId) {
              router.push(`/jobs/${data.jobId}` as any);
            }
          });
      } catch (error) {
        console.warn("Error setting up push notifications:", error);
      }
    };

    registerForPushNotifications();

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Deep linking handler for email verification
  useEffect(() => {
    if (!navState?.key) return; // navigation not ready yet

    // Handle initial URL (app opened from deep link)
    const handleInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleDeepLink(initialUrl);
        }
      } catch (error) {
        console.warn("Error getting initial URL:", error);
      }
    };

    // Handle URL while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    handleInitialUrl();

    return () => {
      subscription.remove();
    };
  }, [navState?.key]);

  // Deep link handler function
  const handleDeepLink = (url: string) => {
    try {
      const parsed = Linking.parse(url);
      const path = parsed.path?.startsWith("/")
        ? parsed.path.slice(1)
        : parsed.path;

      // Handle verify-email deep links
      // Supports: cumprido://verify-email?token=XXX and https://cumprido.com/verify-email?token=XXX
      if (path === "verify-email" || path?.includes("verify-email")) {
        const token = parsed.queryParams?.token as string | undefined;
        if (token) {
          // Navigate to verify-email screen with token
          router.push({
            pathname: "/verify-email",
            params: { token },
          } as never);
        } else {
          console.warn("Email verification link missing token");
        }
      }
    } catch (error) {
      console.warn("Error handling deep link:", error);
    }
  };

  // Auth gate: only run once when navigation is ready (initial app load)
  useEffect(() => {
    if (!navState?.key) return; // navigation not ready yet
    if (hasCheckedAuth.current) return; // Already checked on initial load

    const enforceLogin = async () => {
      hasCheckedAuth.current = true;

      // Add a small delay to ensure routes are fully registered
      setTimeout(async () => {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          // No token - stay on index (landing page), no need to navigate
          return;
        }

        try {
          const payload = decodeJwtPayload(token);
          if (!payload) {
            // Invalid token - clear it and stay on index
            await SecureStore.deleteItemAsync("auth_token");
            return;
          }

          const role = String(payload?.role || "").toUpperCase();
          // Redirect based on role (only on initial load)
          // Use push instead of replace to avoid navigation errors
          if (role === "EMPLOYER") {
            router.push("/employer-home" as never);
          } else if (role === "ADMIN") {
            router.push("/admin-home" as never);
          } else {
            router.push("/user-home" as never);
          }
        } catch {
          // If token is invalid, clear it and stay on index
          await SecureStore.deleteItemAsync("auth_token");
        }
      }, 100); // Small delay to ensure routes are registered
    };
    enforceLogin();
    // Only run once when navigation is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.key]);

  const stackContent = (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonMenuEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="kyc-start" options={{ headerShown: false }} />
        <Stack.Screen name="kyc-capture" options={{ headerShown: false }} />
        <Stack.Screen name="kyc-details" options={{ headerShown: false }} />
        {/* Hide header for the tabs group to avoid breadcrumb chips */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="user-home"
          options={{
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="employer-tabs" options={{ headerShown: false }} />
        <Stack.Screen name="employer-home" options={{ headerShown: false }} />
        <Stack.Screen name="post-job" options={{ headerShown: false }} />
        <Stack.Screen
          name="manage-applications"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="rate-provider"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="rate-job-completion"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="admin-home" options={{ headerShown: false }} />
        <Stack.Screen
          name="admin/kyc-reviews"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/kyc-detail"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/support-tickets"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/support-ticket-detail"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/report-abuse-tickets"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/report-security-tickets"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="admin/surveys" options={{ headerShown: false }} />
        <Stack.Screen
          name="admin/survey-detail"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/manage-admins"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/manage-users"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/user-detail"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="legal-acceptance"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
        <Stack.Screen name="agenda" options={{ headerShown: false }} />
        <Stack.Screen name="refer" options={{ headerShown: false }} />
        <Stack.Screen
          name="search-modal"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="search-jobs"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen name="legal-menu" options={{ headerShown: false }} />
        <Stack.Screen name="content-page" options={{ headerShown: false }} />
        <Stack.Screen
          name="cookies-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="support" options={{ headerShown: false }} />
        <Stack.Screen name="report" options={{ headerShown: false }} />
        <Stack.Screen name="survey" options={{ headerShown: false }} />
        <Stack.Screen name="tracking" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="payments/payouts"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="payments/methods"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="payments/receipts"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="schedule" options={{ headerShown: false }} />
        <Stack.Screen name="candidate" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavThemeProvider>
  );

  // Always render the Stack, conditionally wrap with StripeProvider
  const StripeProviderComponent = getStripeProvider();
  if (!publishableKey || !StripeProviderComponent) {
    return stackContent;
  }

  return (
    <StripeProviderComponent publishableKey={publishableKey}>
      {stackContent}
    </StripeProviderComponent>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </LanguageProvider>
  );
}
