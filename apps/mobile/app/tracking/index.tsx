import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { socketService } from "../../services/socket";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { getApiBase } from "../../lib/api";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import GradientBackground from "../../components/GradientBackground";

// Safely import react-native-maps (may not be available in Expo Go)
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;
let mapsAvailable = false;
let mapsChecked = false;

const checkMapsAvailability = (): boolean => {
  if (mapsChecked) {
    return mapsAvailable;
  }
  mapsChecked = true;
  mapsAvailable = false;

  try {
    // Try to load the module (suppress errors by catching them)
    let mapsModule: any = null;
    try {
      // @ts-ignore - dynamic require that may fail
      mapsModule = require("react-native-maps");
    } catch (requireErr: any) {
      mapsModule = null;
    }

    if (mapsModule && mapsModule.default) {
      MapView = mapsModule.default;
      Marker = mapsModule.Marker;
      PROVIDER_DEFAULT = mapsModule.PROVIDER_DEFAULT;
      mapsAvailable = true;
    }
  } catch (e: any) {
    // Maps not available or error loading maps module
  }

  return mapsAvailable;
};

// Error boundary for MapView to catch API key errors
const SafeMapView = ({ children, ...props }: any) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (hasError) {
    return null; // Return null so parent can show fallback
  }

  try {
    if (!MapView) {
      return null;
    }
    return (
      <MapView
        {...props}
        onError={(error: any) => {
          console.log("MapView error:", error);
          setHasError(true);
          if (
            error?.message?.includes("API key") ||
            error?.message?.includes("API_KEY")
          ) {
            setErrorMessage(
              "Google Maps API key is missing. Please configure it in app.json"
            );
          }
        }}
      >
        {children}
      </MapView>
    );
  } catch (error: any) {
    console.log("Error rendering MapView:", error);
    if (
      error?.message?.includes("API key") ||
      error?.message?.includes("API_KEY")
    ) {
      setErrorMessage("Google Maps API key is missing");
    }
    return null;
  }
};

export default function TrackingScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  // Safely get theme with fallback
  let colors, isDark;
  try {
    const theme = useTheme();
    colors = theme?.colors || { text: "#000", tint: "#6366f1" };
    isDark = theme?.isDark || false;
  } catch (themeErr) {
    console.log("Theme context error:", themeErr);
    colors = { text: "#000", tint: "#6366f1" };
    isDark = false;
  }

  // Get translation function
  let t: (key: string) => string = (key: string) => key;
  try {
    const language = useLanguage();
    t = language.t;
  } catch (langErr) {
    console.log("Language context error:", langErr);
  }

  const bookingId = params.bookingId as string;
  const [role, setRole] = useState<string | null>(null); // Start as null, will be determined
  const [roleDetermined, setRoleDetermined] = useState(false);

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [otherPersonLocation, setOtherPersonLocation] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
  } | null>(null);

  const [booking, setBooking] = useState<any>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [startingTracking, setStartingTracking] = useState<string | null>(null); // Track which booking is starting
  const [stoppingTracking, setStoppingTracking] = useState<string | null>(null); // Track which booking is stopping
  const [deletingBooking, setDeletingBooking] = useState<string | null>(null); // Track which booking is being deleted
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationRetryKey, setLocationRetryKey] = useState(0); // Force location effect to re-run

  const mapRef = useRef<any>(null);

  // Decode JWT to get user role
  const decodeJwtPayload = (token: string): { role?: string } | null => {
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
  };

  // Check maps availability on mount
  useEffect(() => {
    try {
      const available = checkMapsAvailability();
      setMapsLoaded(available);
    } catch (err: any) {
      console.log("Error checking maps availability:", err);
      setMapsLoaded(false);
      if (
        err?.message?.includes("API key") ||
        err?.message?.includes("API_KEY")
      ) {
        setMapsError("Google Maps API key is missing");
      }
    }
  }, []);

  // Determine role from JWT token or URL parameter
  useEffect(() => {
    const determineRole = async () => {
      try {
        // First check URL parameter
        const urlRole = params.role as string;
        if (urlRole === "EMPLOYER" || urlRole === "JOB_SEEKER") {
          setRole(urlRole);
          setRoleDetermined(true);
          return;
        }

        // Otherwise, get role from JWT token
        try {
          const token = await SecureStore.getItemAsync("auth_token");
          if (token) {
            const payload = decodeJwtPayload(token);
            if (payload?.role) {
              const userRole = String(payload.role).toUpperCase();
              if (userRole === "EMPLOYER") {
                setRole("EMPLOYER");
              } else {
                setRole("JOB_SEEKER");
              }
            } else {
              // Default to JOB_SEEKER if we can't determine
              setRole("JOB_SEEKER");
            }
          } else {
            // No token, default to JOB_SEEKER
            setRole("JOB_SEEKER");
          }
        } catch (err) {
          console.log("Error determining role from token:", err);
          // Default to JOB_SEEKER if we can't determine
          setRole("JOB_SEEKER");
        }
      } catch (err) {
        console.log("Error in determineRole:", err);
        setRole("JOB_SEEKER"); // Fallback
      } finally {
        setRoleDetermined(true);
      }
    };
    determineRole();
  }, [params.role]);

  // Fetch Bookings List (when no bookingId, or when should show list)
  useEffect(() => {
    // Wait for role to be determined
    if (!role || !roleDetermined) return;

    // Always fetch list if no bookingId
    // If we have a bookingId, only fetch list if booking status is not IN_PROGRESS
    // This ensures we show the list when appropriate
    if (bookingId && booking?.status === "IN_PROGRESS") {
      // Don't fetch list if we have an active tracking session
      return;
    }

    const fetchBookings = async () => {
      setLoadingBookings(true);
      setError(null);
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          setLoadingBookings(false);
          return;
        }
        const baseUrl = getApiBase();

        // Fetch active bookings based on role
        const endpoint =
          role === "EMPLOYER"
            ? `${baseUrl}/bookings/employer/me`
            : `${baseUrl}/bookings/seeker/me`;

        // Fetch all bookings and filter for CONFIRMED and IN_PROGRESS
        const res = await fetch(`${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch bookings: ${res.status}`);
        }

        const data = await res.json();

        // Backend returns array directly
        const allBookings = Array.isArray(data) ? data : [];

        // Filter to only include CONFIRMED and IN_PROGRESS bookings
        // Also filter out bookings where job is null (deleted jobs)
        const activeBookings = allBookings.filter((b: any) => {
          // Must be CONFIRMED or IN_PROGRESS
          if (b.status !== "CONFIRMED" && b.status !== "IN_PROGRESS") {
            return false;
          }
          // If booking has a jobId, the job must exist (not deleted)
          if (b.jobId && !b.job) {
            return false;
          }
          // Direct bookings (no jobId) are always valid
          return true;
        });

        setBookings(activeBookings);
      } catch (e: any) {
        console.log("Error fetching bookings:", e?.message || "Unknown error");
        // Don't show error message, just set empty bookings
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [bookingId, role, roleDetermined, booking?.status]);

  // Fetch Booking Details
  useEffect(() => {
    if (!bookingId) {
      setLoadingBooking(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const fetchBooking = async () => {
      setError(null);
      setLoadingBooking(true);
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          if (!cancelled) {
            setError("Authentication required");
            setLoadingBooking(false);
          }
          return;
        }
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            // Check if booking's job has been deleted
            if (data.jobId && !data.job) {
              setError(
                "This booking is no longer available. The associated job has been removed."
              );
              setBooking(null);
              setLoadingBooking(false);
              // Navigate back to list view
              router.replace(`/tracking?role=${role}` as any);
              return;
            }
            setBooking(data);
            setLoadingBooking(false);
          }
        } else {
          if (!cancelled) {
            setError("Failed to load booking details");
            setLoadingBooking(false);
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        console.log("Failed to fetch booking:", e?.message || "Unknown error");
        if (e.name === "AbortError") {
          setError("Request timed out. Please check your connection.");
        } else {
          setError("Failed to load booking. Please try again.");
        }
        setLoadingBooking(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };
    fetchBooking();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId || !role) return;

    let isMounted = true;

    const setupSocket = async () => {
      try {
        // 1. Connect socket
        socketService.connect();

        // Wait a bit for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!isMounted) return;

        // 2. Join booking room
        socketService.joinBooking(bookingId);

        // 3. Listen for updates (if we are the Viewer, or just to see others)
        socketService.onLocationUpdate((data: any) => {
          if (!isMounted) return;

          try {
            if (
              data &&
              typeof data.lat === "number" &&
              typeof data.lng === "number"
            ) {
              setOtherPersonLocation({
                latitude: data.lat,
                longitude: data.lng,
                heading: data.heading || 0,
              });

              // Animate map to show the other person if we are the viewer
              if (role === "EMPLOYER" && mapRef.current) {
                try {
                  mapRef.current.animateCamera({
                    center: { latitude: data.lat, longitude: data.lng },
                    zoom: 15,
                  });
                } catch (mapErr) {
                  console.log("Map animation error:", mapErr);
                }
              }
            }
          } catch (err) {
            console.log("Error processing location update:", err);
          }
        });
      } catch (socketErr) {
        console.log("Socket connection error:", socketErr);
      }
    };

    setupSocket();

    return () => {
      isMounted = false;
      // Only remove the listener, don't disconnect the socket completely
      // as it might be used by other parts of the app
      try {
        socketService.removeLocationUpdateListener();
      } catch (err) {
        console.log("Error removing socket listener:", err);
      }
    };
  }, [bookingId, role]);

  // Check if tracking is active (must be defined before useEffect)
  const isTrackingActive = booking?.status === "IN_PROGRESS";

  useEffect(() => {
    // 3. Location Permissions & Tracking (Only for Service Provider when tracking is active)
    if (
      !role ||
      role !== "JOB_SEEKER" ||
      !bookingId ||
      booking?.status !== "IN_PROGRESS"
    ) {
      return;
    }

    let cancelled = false;
    let watchSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        setLocationError(null);

        // Check existing permission first
        let { status } = await Location.getForegroundPermissionsAsync();

        // Request permission if not granted
        if (status !== "granted") {
          const permissionResult =
            await Location.requestForegroundPermissionsAsync();
          status = permissionResult.status;
        }

        if (status !== "granted") {
          if (!cancelled) {
            setLocationError("Location permission denied");
            Alert.alert(
              t("tracking.locationPermissionRequired"),
              t("tracking.enableLocationPermissionMessage"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("tracking.openSettings"),
                  onPress: () => Linking.openSettings(),
                },
              ]
            );
          }
          return;
        }

        if (cancelled) return;

        // Get initial location with timeout
        try {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced, // Changed from High to Balanced for faster response
            }),
            new Promise<Location.LocationObject>((_, reject) =>
              setTimeout(() => reject(new Error("Location timeout")), 10000)
            ),
          ]);

          if (!cancelled) {
            setLocation(loc);
          }

          if (cancelled) return;

          // Start watching position
          try {
            watchSubscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced, // Changed from High
                timeInterval: 5000, // Increased from 2000 to reduce battery usage
                distanceInterval: 20, // Increased from 10
              },
              (newLoc) => {
                if (!cancelled) {
                  setLocation(newLoc);
                  // Emit to socket
                  try {
                    socketService.updateLocation({
                      bookingId,
                      lat: newLoc.coords.latitude,
                      lng: newLoc.coords.longitude,
                      heading: newLoc.coords.heading || 0,
                    });
                  } catch (socketErr) {
                    console.log("Socket update error:", socketErr);
                  }
                }
              }
            );
          } catch (watchErr) {
            console.log("Error watching position:", watchErr);
            if (!cancelled) {
              setLocationError("Failed to start location tracking");
            }
          }
        } catch (locErr: any) {
          console.log("Error getting location:", locErr);
          if (!cancelled) {
            setLocationError("Failed to get your location");
            // Don't show alert if it's just a timeout - user can still see the map
            if (locErr?.message !== "Location timeout") {
              Alert.alert(
                t("tracking.locationError"),
                t("tracking.failedToGetLocation")
              );
            }
          }
        }
      } catch (err) {
        console.log("Location permission error:", err);
        if (!cancelled) {
          setLocationError("Location permission error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (watchSubscription) {
        watchSubscription.remove();
      }
    };
  }, [role, bookingId, booking?.status, locationRetryKey]);

  // Determine displayed name
  const providerName = booking?.jobSeeker
    ? `${booking.jobSeeker.firstName} ${booking.jobSeeker.lastName}`
    : t("common.serviceProvider");

  // If user is seeker, "You" are the provider
  const displayName = role === "JOB_SEEKER" ? "You" : providerName;

  // Show loading state while determining role
  if (!roleDetermined || !role) {
    try {
      return (
        <GradientBackground>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.container}>
            <View style={styles.center}>
              <ActivityIndicator
                size="large"
                color={colors?.tint || "#6366f1"}
              />
              <Text
                style={[
                  styles.loadingText,
                  { color: colors?.text || "#000", marginTop: 16 },
                ]}
              >
                {t("common.loading")}
              </Text>
            </View>
          </SafeAreaView>
        </GradientBackground>
      );
    } catch (renderErr) {
      console.log("Error rendering loading state:", renderErr);
      // Fallback simple loading view without GradientBackground
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000",
          }}
        >
          <Stack.Screen options={{ headerShown: false }} />
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ color: "#fff", marginTop: 16 }}>
            {t("common.loading")}
          </Text>
        </View>
      );
    }
  }

  // Check if maps are available
  const mapsAvailable = checkMapsAvailability();

  // CRITICAL: If maps aren't available, ALWAYS show the list so users can stop tracking
  // This must be checked FIRST and override everything else
  // For employers, always show the list first unless booking is IN_PROGRESS AND maps are available
  // For job seekers (service providers), show list if:
  //   - Maps are not available (PRIORITY - so they can always see the Stop Tracking button), OR
  //   - No bookingId, OR
  //   - Booking status is not IN_PROGRESS, OR
  //   - Currently stopping tracking
  // This ensures service providers can always stop tracking even if maps aren't available
  const shouldShowList =
    !mapsAvailable || // PRIORITY: Always show list if maps aren't available (checked first)
    !bookingId ||
    (role === "EMPLOYER" && booking?.status !== "IN_PROGRESS") ||
    (role === "JOB_SEEKER" && booking?.status !== "IN_PROGRESS") ||
    stoppingTracking !== null;

  if (shouldShowList) {
    try {
      return (
        <GradientBackground>
          <Stack.Screen options={{ headerShown: false }} />
          <SafeAreaView style={styles.container}>
            <View style={styles.listHeader}>
              <TouchableWithoutFeedback onPress={() => router.back()}>
                <View
                  style={[
                    styles.backButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  <Feather name="arrow-left" size={20} color={colors.text} />
                </View>
              </TouchableWithoutFeedback>
              <Text style={[styles.listTitle, { color: colors.text }]}>
                {t("tracking.activeBookings")}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            {loadingBookings ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.tint} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                  ]}
                >
                  {t("tracking.loadingBookings")}
                </Text>
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.center}>
                <Ionicons
                  name="location-outline"
                  size={64}
                  color={isDark ? "rgba(255,255,255,0.3)" : "#94a3b8"}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t("tracking.noActiveBookings")}
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" },
                  ]}
                >
                  {t("tracking.noActiveBookingsMessage")}
                </Text>
              </View>
            ) : (
              <View style={styles.bookingsList}>
                {bookings.map((b) => {
                  // For employers, show job seeker name; for job seekers, show job title/employer
                  const displayName =
                    role === "EMPLOYER"
                      ? b.jobSeeker
                        ? `${b.jobSeeker.firstName || ""} ${b.jobSeeker.lastName || ""}`.trim()
                        : t("common.serviceProvider")
                      : b.job?.title || b.title || t("tracking.job");
                  const displaySub =
                    role === "EMPLOYER"
                      ? b.job?.title || b.title || t("tracking.job")
                      : b.employer
                        ? `${b.employer.firstName || ""} ${b.employer.lastName || ""}`.trim()
                        : "Employer";

                  const isTrackingActive = b.status === "IN_PROGRESS";
                  const canStartTracking =
                    role === "JOB_SEEKER" && b.status === "CONFIRMED";
                  const canStopTracking =
                    role === "JOB_SEEKER" && b.status === "IN_PROGRESS";
                  const isStarting = startingTracking === b.id;
                  const isStopping = stoppingTracking === b.id;
                  const isDeleting = deletingBooking === b.id;
                  const canViewTracking =
                    role === "EMPLOYER" && isTrackingActive;
                  // Check if job is deleted (jobId exists but job is null, or jobId is null but booking has a title suggesting it was from a job)
                  const isJobDeleted =
                    (b.jobId && !b.job) || (!b.jobId && b.title);

                  // Make card clickable when tracking is active to navigate to map view
                  const CardWrapper = isTrackingActive
                    ? TouchableOpacity
                    : View;
                  const cardProps = isTrackingActive
                    ? {
                        onPress: () => {
                          // Navigate to map view when card is clicked and tracking is active
                          router.push(
                            `/tracking?bookingId=${b.id}&role=${role}` as any
                          );
                        },
                        activeOpacity: 0.7,
                      }
                    : {};

                  return (
                    <CardWrapper
                      key={b.id}
                      {...cardProps}
                      style={[
                        styles.bookingCard,
                        {
                          backgroundColor: isDark
                            ? "rgba(30, 41, 59, 0.85)"
                            : "#ffffff",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(0,0,0,0.08)",
                        },
                      ]}
                    >
                      <View style={styles.bookingCardHeader}>
                        <View
                          style={[
                            styles.bookingAvatar,
                            { backgroundColor: isDark ? "#475569" : "#1E293B" },
                          ]}
                        >
                          <Ionicons name="person" size={24} color="white" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text
                            style={[
                              styles.bookingProviderName,
                              { color: colors.text },
                            ]}
                          >
                            {displayName}
                          </Text>
                          <Text
                            style={[
                              styles.bookingJobTitle,
                              {
                                color: isDark
                                  ? "rgba(255,255,255,0.6)"
                                  : "#64748b",
                              },
                            ]}
                          >
                            {displaySub}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: isTrackingActive
                                ? "#22C55E"
                                : b.status === "CONFIRMED"
                                  ? "#3B82F6"
                                  : "#6b7280",
                            },
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {isTrackingActive ? "TRACKING" : b.status}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.bookingCardFooter,
                          {
                            borderTopColor: isDark
                              ? "rgba(255,255,255,0.1)"
                              : "#F1F5F9",
                          },
                        ]}
                      >
                        {isJobDeleted ? (
                          <TouchableOpacity
                            style={[
                              styles.deleteBookingButton,
                              {
                                backgroundColor: isDark ? "#ef4444" : "#dc2626",
                                opacity: isDeleting ? 0.6 : 1,
                              },
                            ]}
                            onPress={async (e) => {
                              // Stop event propagation so card click doesn't trigger
                              if (e && e.stopPropagation) {
                                e.stopPropagation();
                              }
                              try {
                                Alert.alert(
                                  t("tracking.deleteBooking"),
                                  t("tracking.deleteBookingConfirm"),
                                  [
                                    {
                                      text: t("common.cancel"),
                                      style: "cancel",
                                    },
                                    {
                                      text: t("common.delete"),
                                      style: "destructive",
                                      onPress: async () => {
                                        try {
                                          setDeletingBooking(b.id);
                                          const token =
                                            await SecureStore.getItemAsync(
                                              "auth_token"
                                            );
                                          if (!token) {
                                            setDeletingBooking(null);
                                            return;
                                          }

                                          const base = getApiBase();

                                          const res = await fetch(
                                            `${base}/bookings/${b.id}`,
                                            {
                                              method: "DELETE",
                                              headers: {
                                                Authorization: `Bearer ${token}`,
                                              },
                                            }
                                          );

                                          if (res.ok) {
                                            // Remove booking from list
                                            setBookings(
                                              bookings.filter(
                                                (booking) => booking.id !== b.id
                                              )
                                            );

                                            // If we're viewing this booking, navigate back to list
                                            if (bookingId === b.id) {
                                              setBooking(null);
                                              router.replace(
                                                `/tracking?role=${role}` as any
                                              );
                                            }

                                            Alert.alert(
                                              t("tracking.success"),
                                              t(
                                                "tracking.bookingDeletedSuccessfully"
                                              )
                                            );
                                          } else {
                                            const errorData = await res
                                              .json()
                                              .catch(() => ({
                                                message: t(
                                                  "tracking.failedToDeleteBooking"
                                                ),
                                              }));
                                            Alert.alert(
                                              t("tracking.error"),
                                              errorData.message ||
                                                t(
                                                  "tracking.failedToDeleteBooking"
                                                )
                                            );
                                          }
                                        } catch (err) {
                                          console.error(
                                            "Error deleting booking:",
                                            err
                                          );
                                          Alert.alert(
                                            t("tracking.error"),
                                            t(
                                              "tracking.failedToDeleteBookingTryAgain"
                                            )
                                          );
                                        } finally {
                                          setDeletingBooking(null);
                                        }
                                      },
                                    },
                                  ]
                                );
                              } catch (err) {
                                console.error(
                                  "Error showing delete confirmation:",
                                  err
                                );
                              }
                            }}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Ionicons
                                  name="trash-outline"
                                  size={18}
                                  color="#fff"
                                />
                                <Text style={styles.deleteBookingText}>
                                  {t("tracking.deleteBooking")}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : canStartTracking ? (
                          <TouchableOpacity
                            style={[
                              styles.startTrackingButton,
                              {
                                backgroundColor: isDark
                                  ? "#4f46e5"
                                  : colors.tint,
                                opacity: isStarting ? 0.6 : 1,
                              },
                            ]}
                            onPress={async () => {
                              try {
                                setStartingTracking(b.id);
                                const token =
                                  await SecureStore.getItemAsync("auth_token");
                                if (!token) {
                                  setStartingTracking(null);
                                  return;
                                }

                                const base = getApiBase();

                                // Update booking status to IN_PROGRESS
                                const res = await fetch(
                                  `${base}/bookings/${b.id}/status`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                      status: "IN_PROGRESS",
                                    }),
                                  }
                                );

                                if (res.ok) {
                                  // Success! The backend will send push notification to employer
                                  // Refresh bookings list to show updated status
                                  const endpoint =
                                    (role as unknown as string) === "EMPLOYER"
                                      ? `${base}/bookings/employer/me`
                                      : `${base}/bookings/seeker/me`;
                                  const refreshRes = await fetch(
                                    `${endpoint}`,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    }
                                  );
                                  if (refreshRes.ok) {
                                    const refreshData = await refreshRes.json();
                                    const allBookings = Array.isArray(
                                      refreshData
                                    )
                                      ? refreshData
                                      : refreshData?.items ||
                                        refreshData?.bookings ||
                                        refreshData?.data ||
                                        [];
                                    const activeBookings = allBookings.filter(
                                      (booking: any) =>
                                        booking.status === "CONFIRMED" ||
                                        booking.status === "IN_PROGRESS"
                                    );
                                    setBookings(activeBookings);
                                  }

                                  // Show success message
                                  Alert.alert(
                                    t("tracking.trackingStarted"),
                                    t("tracking.trackingStartedMessage"),
                                    [
                                      {
                                        text: t("tracking.viewMap"),
                                        onPress: () => {
                                          // Navigate to tracking map - it will show because status is now IN_PROGRESS
                                          router.push(
                                            `/tracking?bookingId=${b.id}&role=${role}` as any
                                          );
                                        },
                                      },
                                    ]
                                  );
                                } else {
                                  const errorData = await res
                                    .json()
                                    .catch(() => ({
                                      message: t(
                                        "tracking.failedToStartTracking"
                                      ),
                                    }));
                                  Alert.alert(
                                    t("tracking.error"),
                                    errorData.message ||
                                      t("tracking.failedToStartTracking")
                                  );
                                }
                              } catch (err) {
                                console.error("Error starting tracking:", err);
                                Alert.alert(
                                  t("tracking.error"),
                                  t("tracking.failedToStartTrackingTryAgain")
                                );
                              } finally {
                                setStartingTracking(null);
                              }
                            }}
                            disabled={isStarting}
                          >
                            {isStarting ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Ionicons
                                  name="navigate"
                                  size={18}
                                  color="#fff"
                                />
                                <Text style={styles.startTrackingText}>
                                  {t("tracking.startTracking")}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : canStopTracking ? (
                          <TouchableOpacity
                            style={[
                              styles.startTrackingButton,
                              {
                                backgroundColor: isDark ? "#ef4444" : "#dc2626",
                                opacity: isStopping ? 0.6 : 1,
                              },
                            ]}
                            onPress={async (e) => {
                              // Stop event propagation so card click doesn't trigger
                              if (e && e.stopPropagation) {
                                e.stopPropagation();
                              }
                              try {
                                setStoppingTracking(b.id);
                                const token =
                                  await SecureStore.getItemAsync("auth_token");
                                if (!token) {
                                  setStoppingTracking(null);
                                  return;
                                }

                                const base = getApiBase();

                                // Update booking status back to CONFIRMED
                                const res = await fetch(
                                  `${base}/bookings/${b.id}/status`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                      status: "CONFIRMED",
                                    }),
                                  }
                                );

                                if (res.ok) {
                                  // If we're on the map view, clear booking state and navigate back to list immediately to prevent flash
                                  if (bookingId === b.id) {
                                    setBooking(null); // Clear booking state immediately
                                    router.replace(
                                      `/tracking?role=${role}` as any
                                    );
                                  }

                                  // Refresh bookings list to show updated status
                                  const endpoint =
                                    (role as unknown as string) === "EMPLOYER"
                                      ? `${base}/bookings/employer/me`
                                      : `${base}/bookings/seeker/me`;
                                  const refreshRes = await fetch(
                                    `${endpoint}`,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    }
                                  );
                                  if (refreshRes.ok) {
                                    const refreshData = await refreshRes.json();
                                    const allBookings = Array.isArray(
                                      refreshData
                                    )
                                      ? refreshData
                                      : refreshData?.items ||
                                        refreshData?.bookings ||
                                        refreshData?.data ||
                                        [];
                                    const activeBookings = allBookings.filter(
                                      (booking: any) =>
                                        booking.status === "CONFIRMED" ||
                                        booking.status === "IN_PROGRESS"
                                    );
                                    setBookings(activeBookings);
                                  }

                                  // Show success message after a small delay to ensure navigation is complete
                                  setTimeout(() => {
                                    Alert.alert(
                                      t("tracking.trackingStopped"),
                                      t("tracking.trackingStoppedMessage"),
                                      [{ text: t("common.ok") }]
                                    );
                                  }, 100);
                                } else {
                                  const errorData = await res
                                    .json()
                                    .catch(() => ({
                                      message: t(
                                        "tracking.failedToStopTracking"
                                      ),
                                    }));
                                  Alert.alert(
                                    t("tracking.error"),
                                    errorData.message ||
                                      t("tracking.failedToStopTracking")
                                  );
                                }
                              } catch (err) {
                                console.error("Error stopping tracking:", err);
                                Alert.alert(
                                  t("tracking.error"),
                                  t("tracking.failedToStopTrackingTryAgain")
                                );
                              } finally {
                                setStoppingTracking(null);
                              }
                            }}
                            disabled={isStopping}
                          >
                            {isStopping ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Ionicons
                                  name="stop-circle"
                                  size={18}
                                  color="#fff"
                                />
                                <Text style={styles.startTrackingText}>
                                  {t("tracking.stopTracking")}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : canViewTracking ? (
                          <TouchableOpacity
                            style={[
                              styles.viewTrackingButton,
                              {
                                backgroundColor: isDark
                                  ? "rgba(34, 197, 94, 0.2)"
                                  : "#22c55e20",
                                borderColor: "#22c55e",
                              },
                            ]}
                            onPress={(e) => {
                              // Stop event propagation so card click doesn't trigger
                              if (e && e.stopPropagation) {
                                e.stopPropagation();
                              }
                              router.push(
                                `/tracking?bookingId=${b.id}&role=${role}` as any
                              );
                            }}
                          >
                            <Ionicons name="map" size={18} color="#22c55e" />
                            <Text
                              style={[
                                styles.viewTrackingText,
                                { color: "#22c55e" },
                              ]}
                            >
                              {t("tracking.viewTracking")}
                            </Text>
                          </TouchableOpacity>
                        ) : role === "EMPLOYER" && b.status === "CONFIRMED" ? (
                          <View style={[styles.waitingContainer]}>
                            <Ionicons
                              name="time-outline"
                              size={18}
                              color={isDark ? "#f59e0b" : "#f59e0b"}
                            />
                            <Text
                              style={[
                                styles.waitingText,
                                { color: isDark ? "#f59e0b" : "#f59e0b" },
                              ]}
                            >
                              {t("tracking.waitingForProvider")}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.viewDetailsButton]}
                            onPress={(e) => {
                              // Stop event propagation so card click doesn't trigger
                              if (e && e.stopPropagation) {
                                e.stopPropagation();
                              }
                              router.push(
                                `/tracking?bookingId=${b.id}&role=${role}` as any
                              );
                            }}
                          >
                            <Ionicons
                              name="arrow-forward"
                              size={20}
                              color={colors.tint}
                            />
                            <Text
                              style={[styles.trackText, { color: colors.tint }]}
                            >
                              {t("tracking.viewDetails")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </CardWrapper>
                  );
                })}
              </View>
            )}
          </SafeAreaView>
        </GradientBackground>
      );
    } catch (renderErr) {
      console.log("Error rendering bookings list:", renderErr);
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000",
            padding: 20,
          }}
        >
          <Stack.Screen options={{ headerShown: false }} />
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {t("tracking.errorLoadingBookings")}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: "#6366f1", padding: 12, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              {t("tracking.goBack")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  // Show fallback if maps not available or API key error
  // CRITICAL FIX: On Android, MapView crashes immediately if API key is missing.
  // Since we can't detect this before render, we must be conservative:
  // On Android, only render MapView if we have explicit confirmation it's safe.
  // Since app.json has empty API key, we default to fallback on Android.

  // On Android, always show fallback unless we have explicit error message (which means we tried and failed)
  // This prevents the native crash from happening
  const shouldShowFallbackAndroid = Platform.OS === "android" && !mapsError;

  if (!mapsLoaded || mapsError || shouldShowFallbackAndroid) {
    return (
      <GradientBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.listHeader}>
            <TouchableWithoutFeedback onPress={() => router.back()}>
              <View
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <Feather name="arrow-left" size={20} color={colors.text} />
              </View>
            </TouchableWithoutFeedback>
            <Text style={[styles.listTitle, { color: colors.text }]}>
              {t("tracking.tracking")}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.center}>
            <Ionicons
              name="map-outline"
              size={64}
              color={isDark ? "rgba(255,255,255,0.3)" : "#94a3b8"}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {mapsError
                ? t("tracking.mapsConfigurationError")
                : t("tracking.mapsNotAvailable")}
            </Text>
            <Text
              style={[
                styles.emptySub,
                {
                  color: isDark ? "rgba(255,255,255,0.6)" : "#64748b",
                  textAlign: "center",
                  paddingHorizontal: 40,
                  marginTop: 8,
                },
              ]}
            >
              {mapsError || t("tracking.mapsNotAvailableMessage")}
            </Text>
            {mapsError && Platform.OS === "android" && (
              <View
                style={[
                  styles.bookingInfoCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.2)"
                      : "#fee2e2",
                    marginTop: 24,
                    padding: 16,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bookingInfoTitle,
                    { color: isDark ? "#fca5a5" : "#dc2626", marginBottom: 8 },
                  ]}
                >
                  {t("tracking.howToFix")}
                </Text>
                <Text
                  style={[
                    styles.bookingInfoText,
                    {
                      color: isDark ? "rgba(255,255,255,0.8)" : "#991b1b",
                      fontSize: 12,
                    },
                  ]}
                >
                  1. Get a Google Maps API key from Google Cloud Console{"\n"}
                  2. Add it to app.json in the react-native-maps plugin:{"\n"}
                  {'  "googleMapsApiKey": "YOUR_KEY_HERE"'}
                </Text>
              </View>
            )}
            {booking && (
              <View
                style={[
                  styles.bookingInfoCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.85)"
                      : "#ffffff",
                    marginTop: 24,
                  },
                ]}
              >
                <Text style={[styles.bookingInfoTitle, { color: colors.text }]}>
                  {t("tracking.bookingDetails")}
                </Text>
                <Text
                  style={[
                    styles.bookingInfoText,
                    { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                  ]}
                >
                  {role === "EMPLOYER"
                    ? `Service Provider: ${providerName}`
                    : `Job: ${booking.job?.title || "N/A"}`}
                </Text>
                <Text
                  style={[
                    styles.bookingInfoText,
                    { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                  ]}
                >
                  Status: {booking.status}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.mapContainer}>
        {MapView && mapsLoaded && Platform.OS !== "android" ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: location?.coords.latitude || 38.7223,
              longitude: location?.coords.longitude || -9.1393,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            showsUserLocation={role === "JOB_SEEKER" && !!location}
            userInterfaceStyle={isDark ? "dark" : "light"}
            onMapReady={() => {
              // Map loaded successfully
              setMapsError(null);
            }}
            onError={(error: any) => {
              console.log("MapView error:", error);
              const errorMsg =
                error?.nativeEvent?.message || error?.message || "";
              if (
                errorMsg.includes("API key") ||
                errorMsg.includes("API_KEY") ||
                errorMsg.includes("com.google.android.geo.API_KEY")
              ) {
                setMapsError(
                  "Google Maps API key is missing. Please configure it in app.json"
                );
                setMapsLoaded(false);
              }
            }}
          >
            {/* If we are Viewer, show the Provider's marker */}
            {role === "EMPLOYER" && otherPersonLocation && Marker && (
              <Marker
                coordinate={otherPersonLocation}
                title={providerName}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[styles.carMarker, { backgroundColor: colors.tint }]}
                >
                  <Ionicons name="person" size={24} color="white" />
                </View>
              </Marker>
            )}

            {/* If we are Provider, show the Job Location */}
            {role === "JOB_SEEKER" && booking?.job?.coordinates && Marker && (
              <Marker
                coordinate={{
                  latitude: booking.job.coordinates[0],
                  longitude: booking.job.coordinates[1],
                }}
                title={t("tracking.jobLocation")}
              >
                <View
                  style={[styles.carMarker, { backgroundColor: "#EF4444" }]}
                >
                  <Ionicons name="briefcase" size={20} color="white" />
                </View>
              </Marker>
            )}
          </MapView>
        ) : (
          <View style={[styles.center, { flex: 1 }]}>
            <Ionicons
              name="map-outline"
              size={64}
              color={isDark ? "rgba(255,255,255,0.3)" : "#94a3b8"}
            />
            <Text
              style={[styles.emptyTitle, { color: colors.text, marginTop: 16 }]}
            >
              {t("tracking.mapsNotAvailable")}
            </Text>
            {mapsError ? (
              <Text
                style={[
                  styles.emptySub,
                  {
                    color: isDark ? "rgba(255,255,255,0.6)" : "#64748b",
                    textAlign: "center",
                    paddingHorizontal: 40,
                    marginTop: 8,
                  },
                ]}
              >
                {mapsError}
              </Text>
            ) : (
              <Text
                style={[
                  styles.emptySub,
                  {
                    color: isDark ? "rgba(255,255,255,0.6)" : "#64748b",
                    textAlign: "center",
                    paddingHorizontal: 40,
                    marginTop: 8,
                  },
                ]}
              >
                {t("tracking.mapsNotAvailableMessage")}
              </Text>
            )}
            {/* Add button to go back to list when maps aren't available */}
            {role === "JOB_SEEKER" && booking?.status === "IN_PROGRESS" && (
              <TouchableOpacity
                style={[
                  styles.startTrackingButton,
                  {
                    marginTop: 24,
                    backgroundColor: "#ef4444",
                  },
                ]}
                onPress={() => {
                  // Navigate back to list view
                  router.replace(`/tracking?role=${role}` as any);
                }}
              >
                <Ionicons name="list" size={18} color="#fff" />
                <Text style={styles.startTrackingText}>
                  {t("tracking.viewBookingsList")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          {/* Floating Header with Back Button */}
          <View style={styles.floatingHeader}>
            <TouchableWithoutFeedback onPress={() => router.back()}>
              <View
                style={[
                  styles.backButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.95)",
                    shadowColor: isDark ? "#000" : "rgba(0,0,0,0.2)",
                  },
                ]}
              >
                <Feather name="arrow-left" size={20} color={colors.text} />
              </View>
            </TouchableWithoutFeedback>
          </View>

          {/* Loading State or Bottom Info Card */}
          {loadingBooking ? (
            <View
              style={[
                styles.loadingCard,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.08)",
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.tint} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Loading details...
              </Text>
            </View>
          ) : isTrackingActive ? (
            <View
              style={[
                styles.bottomCard,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.95)"
                    : "#ffffff",
                  borderTopColor: isDark
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(0,0,0,0.08)",
                },
              ]}
            >
              <View
                style={[
                  styles.handle,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.3)"
                      : "#E5E7EB",
                  },
                ]}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {role === "JOB_SEEKER" ? "Sharing Location" : "Arriving Soon"}
              </Text>
              <Text
                style={[
                  styles.cardSub,
                  { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                ]}
              >
                {role === "JOB_SEEKER"
                  ? location
                    ? "Your location is visible to the client"
                    : locationError || "Getting your location..."
                  : `${providerName} is on the way`}
              </Text>

              {locationError && role === "JOB_SEEKER" && (
                <TouchableOpacity
                  style={[
                    styles.retryButton,
                    {
                      marginTop: 12,
                      alignSelf: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                    },
                  ]}
                  onPress={() => {
                    setLocationError(null);
                    setLocation(null);
                    // Force location effect to re-run
                    setLocationRetryKey((prev) => prev + 1);
                  }}
                >
                  <Text
                    style={[styles.retryButtonText, { color: colors.tint }]}
                  >
                    {t("tracking.retryLocation")}
                  </Text>
                </TouchableOpacity>
              )}

              {role === "JOB_SEEKER" && (
                <TouchableOpacity
                  style={[
                    styles.startTrackingButton,
                    {
                      marginTop: 16,
                      backgroundColor: "#ef4444",
                      opacity: stoppingTracking === bookingId ? 0.6 : 1,
                    },
                  ]}
                  onPress={async () => {
                    if (!bookingId) return;
                    try {
                      setStoppingTracking(bookingId);
                      const token =
                        await SecureStore.getItemAsync("auth_token");
                      if (!token) {
                        setStoppingTracking(null);
                        return;
                      }

                      const base = getApiBase();

                      // Update booking status back to CONFIRMED
                      const res = await fetch(
                        `${base}/bookings/${bookingId}/status`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ status: "CONFIRMED" }),
                        }
                      );

                      if (res.ok) {
                        // Clear booking state immediately to prevent flash
                        setBooking(null);

                        // Navigate back to list immediately to prevent flash
                        router.replace(`/tracking?role=${role}` as any);

                        // Refresh bookings list after navigation
                        setTimeout(async () => {
                          const endpoint = `${base}/bookings/seeker/me`;
                          const refreshRes = await fetch(endpoint, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (refreshRes.ok) {
                            const refreshData = await refreshRes.json();
                            const allBookings = Array.isArray(refreshData)
                              ? refreshData
                              : refreshData?.items ||
                                refreshData?.bookings ||
                                refreshData?.data ||
                                [];
                            const activeBookings = allBookings.filter(
                              (booking: any) =>
                                booking.status === "CONFIRMED" ||
                                booking.status === "IN_PROGRESS"
                            );
                            setBookings(activeBookings);
                          }
                        }, 200);

                        // Show success message after navigation
                        setTimeout(() => {
                          Alert.alert(
                            "Tracking Stopped",
                            "Location sharing has been stopped. You can start tracking again when ready.",
                            [{ text: "OK" }]
                          );
                        }, 300);
                      } else {
                        const errorData = await res
                          .json()
                          .catch(() => ({
                            message: t("tracking.failedToStopTracking"),
                          }));
                        Alert.alert(
                          t("tracking.error"),
                          errorData.message ||
                            t("tracking.failedToStopTracking")
                        );
                      }
                    } catch (err) {
                      console.error("Error stopping tracking:", err);
                      Alert.alert(
                        t("tracking.error"),
                        t("tracking.failedToStopTrackingTryAgain")
                      );
                    } finally {
                      setStoppingTracking(null);
                    }
                  }}
                  disabled={stoppingTracking === bookingId}
                >
                  {stoppingTracking === bookingId ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="stop-circle" size={18} color="#fff" />
                      <Text style={styles.startTrackingText}>
                        {t("tracking.stopTracking")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View
                style={[
                  styles.driverRow,
                  {
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "#F1F5F9",
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isDark ? "#475569" : "#1E293B" },
                  ]}
                >
                  <Ionicons name="person" size={24} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {displayName}
                  </Text>
                  <Text
                    style={[
                      styles.driverSub,
                      { color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" },
                    ]}
                  >
                    Service Provider
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.callButton, { backgroundColor: "#22c55e" }]}
                    onPress={() => {
                      const phoneNumber =
                        role === "EMPLOYER"
                          ? booking?.jobSeeker?.phone
                          : booking?.employer?.phone;
                      if (phoneNumber) {
                        Linking.openURL(`tel:${phoneNumber}`);
                      } else {
                        Alert.alert(t("tracking.phoneNumberNotAvailable"));
                      }
                    }}
                  >
                    <Ionicons name="call" size={20} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.callButton,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      const otherUserId =
                        role === "EMPLOYER"
                          ? booking?.jobSeeker?.id
                          : booking?.employer?.id;
                      if (otherUserId) {
                        router.push(`/chat/room?userId=${otherUserId}` as any);
                      }
                    }}
                  >
                    <Ionicons name="chatbubble" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  floatingHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 4,
  },
  carMarker: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  // Cards
  loadingCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: Platform.OS === "android" ? 0 : 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
  },
  driverSub: {
    fontSize: 13,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },
  // Bookings List Styles
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  bookingsList: {
    flex: 1,
    padding: 20,
  },
  bookingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 3,
  },
  bookingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  bookingProviderName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  bookingJobTitle: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bookingCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  trackText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  startTrackingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  startTrackingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteBookingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  deleteBookingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  startTrackingButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  viewTrackingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  viewTrackingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  waitingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  waitingText: {
    fontSize: 13,
    fontWeight: "500",
    fontStyle: "italic",
    flex: 1,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  bookingInfoCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    width: "90%",
  },
  bookingInfoTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  bookingInfoText: {
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "currentColor",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 12,
    padding: 16,
    margin: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
