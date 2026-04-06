import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiBase } from "./api";

/**
 * Register the device's Expo push token with the server for the current user.
 * Call this after login and on app start when authenticated.
 */
export async function registerPushToken(): Promise<void> {
  const authToken = await SecureStore.getItemAsync("auth_token");
  if (!authToken) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  let pushToken: Notifications.ExpoPushToken;
  try {
    pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Firebase") ||
      error?.message?.includes("FirebaseApp")
    ) {
      return;
    }
    throw error;
  }

  const base = getApiBase();
  await fetch(`${base}/notifications/register-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      pushToken: pushToken.data,
      platform: Platform.OS,
    }),
  });
}

/**
 * Unregister the device's push token from the server before logout.
 * This prevents notifications from being sent to the wrong user on this device.
 */
export async function unregisterPushToken(): Promise<void> {
  const authToken = await SecureStore.getItemAsync("auth_token");
  if (!authToken) return;

  const base = getApiBase();
  try {
    await fetch(`${base}/notifications/unregister-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });
  } catch {
    // Best-effort — don't block logout if this fails
  }
}
