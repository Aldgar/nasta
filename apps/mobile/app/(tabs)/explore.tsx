import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApiBase } from "../../lib/api";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Conditionally import react-native-maps (not available in Expo Go)
// Don't import at module level - only load when component mounts
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;
let Region: any = null;

interface Job {
  id: string;
  title: string;
  location: string;
  city: string;
  country: string;
  coordinates: [number, number];
  distanceKm?: number;
  urgency?: string;
  paymentType?: string;
  rateAmount?: number;
  currency?: string;
}

export default function ExploreMap() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<any>(null);
  const mapRef = useRef<any>(null);
  const [mapsAvailable, setMapsAvailable] = useState(false);

  const androidGoogleMapsApiKey: string | undefined =
    // Expo config shape: android.config.googleMaps.apiKey
    (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ||
    // Legacy/other shapes
    (Constants.expoConfig as any)?.android?.config?.googleMapsApiKey ||
    (Constants.expoConfig as any)?.android?.googleMapsApiKey;

  const isAndroidMapsConfigured =
    Platform.OS !== "android" ||
    (typeof androidGoogleMapsApiKey === "string" &&
      androidGoogleMapsApiKey.trim().length > 0);

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const isValidLatLng = (latitude: unknown, longitude: unknown) => {
    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;
    return true;
  };

  useEffect(() => {
    // Check if maps are available (lazy load - only when component mounts)
    let mapsAvail = false;

    // Only try to load maps if not in Expo Go
    const isExpoGo =
      Constants.executionEnvironment === "storeClient" ||
      (Constants.appOwnership === "expo" && !Constants.executionEnvironment);

    if (!isExpoGo) {
      try {
        // @ts-ignore - dynamic require
        const mapsModule = require("react-native-maps");
        if (mapsModule && mapsModule.default) {
          MapView = mapsModule.default;
          Marker = mapsModule.Marker;
          PROVIDER_DEFAULT = mapsModule.PROVIDER_DEFAULT;
          Region = mapsModule.Region;
          mapsAvail = true;
        }
      } catch (e: any) {
        // Maps not available - expected in Expo Go
        mapsAvail = false;
      }
    }

    // On Android, MapView can crash if Google Maps API key is missing.
    if (mapsAvail && !isAndroidMapsConfigured) {
      mapsAvail = false;
    }

    setMapsAvailable(mapsAvail);
    if (mapsAvail) {
      initializeMap();
    } else {
      // Still fetch jobs even without map
      setLoading(true);
      fetchJobs(null).finally(() => setLoading(false));
    }
  }, []);

  // Update map when user location is found (only if maps are available)
  useEffect(() => {
    if (mapsAvailable && userLocation && mapRef.current) {
      const userRegion = {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      console.log("📍 useEffect: Centering map on user location", userRegion);
      setRegion(userRegion);

      // Force map to center - try multiple times to ensure it works
      const centerMap = () => {
        if (mapRef.current) {
          console.log("🗺️ Forcing map to center on:", userRegion);
          mapRef.current.animateToRegion(userRegion, 1000);
        }
      };

      // Try immediately
      centerMap();

      // Try again after a short delay (in case map wasn't ready)
      const timer1 = setTimeout(centerMap, 500);

      // Try one more time after map should be fully ready
      const timer2 = setTimeout(centerMap, 1500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [userLocation, mapsAvailable]);

  const initializeMap = async () => {
    // Get user location FIRST
    const location = await getCurrentLocation();

    // Then fetch jobs (with location if available)
    await fetchJobs(location);
  };

  const getCurrentLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      setLoadingLocation(true);

      // First check if we already have permission
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("📍 Requesting location permission...");
        const permissionResult =
          await Location.requestForegroundPermissionsAsync();
        status = permissionResult.status;
      }

      if (status !== "granted") {
        console.log("❌ Location permission denied");
        setLoadingLocation(false);
        Alert.alert(
          t("explore.locationPermission"),
          t("explore.enableLocationPermissionMessage"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("explore.openSettings"),
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return null;
      }

      console.log("📍 Getting current position...");
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High, // Use High accuracy for better results
        }),
        new Promise<Location.LocationObject>((_, reject) =>
          setTimeout(() => reject(new Error("Location timeout")), 20000)
        ),
      ]);

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log("✅ User location found:", coords);
      console.log("📍 Accuracy:", location.coords.accuracy, "meters");
      console.log("📍 Altitude:", location.coords.altitude);
      console.log("📍 Heading:", location.coords.heading);
      console.log("📍 Speed:", location.coords.speed);

      // Warn if location seems wrong (San Francisco coordinates when user is in Portugal)
      // San Francisco: ~37.77, -122.41
      // Portugal: ~38.7, -9.1
      if (
        coords.latitude > 37 &&
        coords.latitude < 38 &&
        coords.longitude > -123 &&
        coords.longitude < -122
      ) {
        console.warn(
          "⚠️ Location appears to be San Francisco - this might be from an emulator/simulator"
        );
        Alert.alert(
          t("explore.locationNotice"),
          t("explore.locationNoticeMessage"),
          [{ text: t("common.ok") }]
        );
      }

      // Set user location - useEffect will handle map centering
      setUserLocation(coords);
      setLoadingLocation(false);

      // Force immediate map update
      const userRegion = {
        ...coords,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(userRegion);

      // Force map to center immediately
      setTimeout(() => {
        if (mapRef.current) {
          console.log("🗺️ Forcing immediate map center");
          mapRef.current.animateToRegion(userRegion, 1000);
        }
      }, 100);

      return coords;
    } catch (err: any) {
      console.error("❌ Error getting location:", err);
      setLoadingLocation(false);
      const errorMsg = err?.message || "Unknown error";
      console.error("Error details:", errorMsg);

      Alert.alert(
        t("explore.locationError"),
        t("explore.locationErrorMessage", { error: errorMsg }),
        [
          { text: t("common.ok") },
          { text: t("common.retry"), onPress: () => getCurrentLocation() },
        ]
      );

      return null;
    }
  };

  const fetchJobs = async (
    locationToUse?: { latitude: number; longitude: number } | null
  ) => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        console.log("No auth token");
        return;
      }

      const base = getApiBase();
      const params = new URLSearchParams();

      // Use provided location or fall back to userLocation state
      const location = locationToUse || userLocation;
      if (location) {
        params.append("lat", location.latitude.toString());
        params.append("lng", location.longitude.toString());
        params.append("radiusKm", "50"); // 50km radius
        console.log("📍 Fetching jobs with location:", location);
      } else {
        console.log("⚠️ Fetching jobs without location (all active jobs)");
      }

      const url = `${base}/jobs${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching jobs from:", url);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const jobsArray = Array.isArray(data) ? data : data.jobs || [];

        console.log(`Fetched ${jobsArray.length} jobs total`);

        // Filter and geocode jobs
        const jobsWithCoords: Job[] = [];

        for (const job of jobsArray) {
          let coords: [number, number] | null = null;

          // Check if job has valid coordinates
          if (
            Array.isArray(job.coordinates) &&
            job.coordinates.length === 2 &&
            typeof job.coordinates[0] === "number" &&
            typeof job.coordinates[1] === "number" &&
            !isNaN(job.coordinates[0]) &&
            !isNaN(job.coordinates[1])
          ) {
            coords = [job.coordinates[0], job.coordinates[1]];
          } else if (job.location && job.city && job.country) {
            // Try to geocode if coordinates are missing
            try {
              const address = `${job.location}, ${job.city}, ${job.country}`;
              const geocodeResult = await Location.geocodeAsync(address);
              if (geocodeResult && geocodeResult.length > 0) {
                coords = [
                  geocodeResult[0].latitude,
                  geocodeResult[0].longitude,
                ];
                console.log(`Geocoded job ${job.id}: ${address} -> ${coords}`);
              }
            } catch (geocodeErr) {
              console.log(`Failed to geocode job ${job.id}:`, geocodeErr);
            }
          }

          if (coords) {
            jobsWithCoords.push({
              ...job,
              coordinates: coords,
            });
          } else {
            console.log(
              `Job ${job.id} (${job.title}) - no coordinates available`
            );
          }
        }

        console.log(
          `Found ${jobsWithCoords.length} jobs with valid coordinates`
        );
        setJobs(jobsWithCoords);

        // Always prioritize user location - center on user first (only if maps are available)
        if (mapsAvailable) {
          if (userLocation && mapRef.current) {
            // Center on user location and update region state
            const userRegion = {
              ...userLocation,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };

            console.log("🗺️ Centering map on user location:", userRegion);
            setRegion(userRegion);

            // Center on user location first
            mapRef.current.animateToRegion(userRegion, 1000);

            // If we have jobs nearby, fit to show both user and jobs
            if (jobsWithCoords.length > 0) {
              // Filter to nearby jobs (within 25km for better visibility)
              const nearbyJobs = jobsWithCoords.filter((job: Job) => {
                if (!job.distanceKm) return true; // Include if no distance (might be from geocoding)
                return job.distanceKm <= 25; // Show jobs within 25km
              });

              console.log(
                `📍 Found ${nearbyJobs.length} nearby jobs (within 25km)`
              );

              if (nearbyJobs.length > 0) {
                // Wait for user location animation to complete, then fit to include jobs
                setTimeout(() => {
                  if (mapRef.current && userLocation) {
                    const coordinates = nearbyJobs.map((j: Job) => ({
                      latitude: j.coordinates[0],
                      longitude: j.coordinates[1],
                    }));

                    // Always include user location
                    coordinates.push({
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                    });

                    console.log(
                      `🗺️ Fitting map to show ${coordinates.length} points (user + ${nearbyJobs.length} jobs)`
                    );
                    mapRef.current.fitToCoordinates(coordinates, {
                      edgePadding: {
                        top: 120,
                        right: 50,
                        bottom: 100,
                        left: 50,
                      },
                      animated: true,
                    });
                  }
                }, 1200);
              } else {
                console.log("📍 No nearby jobs, keeping map centered on user");
              }
            }
          } else if (jobsWithCoords.length > 0 && mapRef.current) {
            // No user location, but we have jobs - fit to jobs
            console.log("⚠️ No user location, fitting to jobs only");
            const coordinates = jobsWithCoords.map((j: Job) => ({
              latitude: j.coordinates[0],
              longitude: j.coordinates[1],
            }));

            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          } else if (userLocation && mapRef.current) {
            // No jobs, but we have location - just center on user
            console.log("📍 No jobs found, centering on user location");
            const userRegion = {
              ...userLocation,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
            mapRef.current.animateToRegion(userRegion, 1000);
          }
        }
      } else {
        const errorText = await res.text();
        console.log("Error response:", res.status, errorText);
        setJobs([]);
      }
    } catch (err) {
      console.log("Error fetching jobs:", err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (urgency?: string) => {
    switch (urgency) {
      case "URGENT":
        return "#ef4444"; // Red
      case "HIGH":
        return "#f59e0b"; // Orange
      default:
        return "#3b82f6"; // Blue
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("navigation.explore")}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              {t("explore.jobsByLocation")}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.refreshButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.1)",
              },
            ]}
            onPress={async () => {
              if (mapsAvailable) {
                await getCurrentLocation();
              }
              await fetchJobs(userLocation);
            }}
          >
            <Feather name="refresh-cw" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {!mapsAvailable ? (
          // Fallback UI when maps aren't available (Expo Go)
          <ScrollView
            style={styles.fallbackContainer}
            contentContainerStyle={styles.fallbackContent}
          >
            <View
              style={[
                styles.fallbackHeader,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.7)"
                    : "rgba(255, 255, 255, 0.9)",
                },
              ]}
            >
              <Feather name="map" size={24} color={colors.tint} />
              <Text style={[styles.fallbackTitle, { color: colors.text }]}>
                {t("explore.mapsNotAvailable")}
              </Text>
              <Text
                style={[
                  styles.fallbackSubtitle,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {t("explore.mapsNotAvailableMessage")}
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.tint} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  {t("explore.loadingJobs")}
                </Text>
              </View>
            ) : jobs.length > 0 ? (
              <View style={styles.jobsList}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("explore.nearbyJobs", { count: jobs.length })}
                </Text>
                {jobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(30, 41, 59, 0.7)"
                          : "rgba(255, 255, 255, 0.9)",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.1)",
                      },
                    ]}
                    onPress={() => router.push(`/jobs/${job.id}` as any)}
                  >
                    <View style={styles.jobCardHeader}>
                      <Text
                        style={[styles.jobCardTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {job.title}
                      </Text>
                      {job.distanceKm && (
                        <View
                          style={[
                            styles.distanceBadge,
                            {
                              backgroundColor:
                                getMarkerColor(job.urgency) + "20",
                            },
                          ]}
                        >
                          <Feather
                            name="map-pin"
                            size={12}
                            color={getMarkerColor(job.urgency)}
                          />
                          <Text
                            style={[
                              styles.distanceText,
                              { color: getMarkerColor(job.urgency) },
                            ]}
                          >
                            {job.distanceKm.toFixed(1)} km
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.jobCardLocation}>
                      <Feather
                        name="map-pin"
                        size={14}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                      <Text
                        style={[
                          styles.jobCardLocationText,
                          { color: isDark ? "#94a3b8" : "#64748b" },
                        ]}
                      >
                        {job.location || `${job.city}, ${job.country}`}
                      </Text>
                    </View>
                    {job.rateAmount && (
                      <View style={styles.jobCardPayment}>
                        <Feather
                          name="dollar-sign"
                          size={14}
                          color={colors.tint}
                        />
                        <Text
                          style={[
                            styles.jobCardPaymentText,
                            { color: colors.tint },
                          ]}
                        >
                          {job.currency || "EUR"} {job.rateAmount}
                          {job.paymentType === "HOURLY"
                            ? "/hr"
                            : job.paymentType === "DAILY"
                              ? "/day"
                              : ""}
                        </Text>
                      </View>
                    )}
                    <View style={styles.jobCardFooter}>
                      <View
                        style={[
                          styles.urgencyBadge,
                          {
                            backgroundColor: getMarkerColor(job.urgency) + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.urgencyText,
                            { color: getMarkerColor(job.urgency) },
                          ]}
                        >
                          {job.urgency
                            ? t(`jobs.urgency.${job.urgency.toLowerCase()}`) ||
                              job.urgency
                            : t("jobs.urgency.normal")}
                        </Text>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={20}
                        color={isDark ? "#94a3b8" : "#64748b"}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Feather
                  name="map-pin"
                  size={48}
                  color={isDark ? "#475569" : "#94a3b8"}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: isDark ? "#94a3b8" : "#64748b" },
                  ]}
                >
                  {t("explore.noJobsFoundNearby")}
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    { color: isDark ? "#64748b" : "#94a3b8" },
                  ]}
                >
                  {t("explore.tryExpandingSearchRadius")}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          // Map view when available
          <View style={styles.mapContainer}>
            {loadingLocation ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.tint} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  {t("explore.gettingYourLocation")}
                </Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={
                  userLocation
                    ? {
                        ...userLocation,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                      }
                    : {
                        latitude: 38.7223, // Default to Lisbon, Portugal
                        longitude: -9.1393,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                      }
                }
                showsUserLocation={true}
                showsMyLocationButton={true}
                followsUserLocation={false}
                mapType="standard"
                customMapStyle={isDark ? darkMapStyle : undefined}
                key={
                  userLocation
                    ? `map-${userLocation.latitude}-${userLocation.longitude}`
                    : "map-default"
                }
                onMapReady={() => {
                  console.log("🗺️ Map ready, userLocation:", userLocation);
                  // When map is ready, center on user location if available
                  if (userLocation && mapRef.current) {
                    const userRegion = {
                      ...userLocation,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    };
                    console.log(
                      "🗺️ Centering map on user location from onMapReady:",
                      userRegion
                    );
                    setRegion(userRegion);
                    // Force update by calling animateToRegion
                    setTimeout(() => {
                      if (mapRef.current) {
                        console.log(
                          "🗺️ Calling animateToRegion from onMapReady"
                        );
                        mapRef.current.animateToRegion(userRegion, 1000);
                      }
                    }, 200);
                  } else {
                    // If no location yet, try to get it
                    console.log("📍 No location yet, fetching...");
                    getCurrentLocation();
                  }
                }}
                onError={(error: any) => {
                  // Defensive: if something goes wrong with maps on Android, fall back instead of crashing.
                  const msg =
                    error?.nativeEvent?.message || error?.message || "";
                  if (
                    Platform.OS === "android" &&
                    (msg.includes("API key") ||
                      msg.includes("API_KEY") ||
                      msg.includes("com.google.android.geo.API_KEY"))
                  ) {
                    setMapsAvailable(false);
                  }
                }}
              >
                {jobs
                  .filter((job) =>
                    isValidLatLng(job.coordinates?.[0], job.coordinates?.[1])
                  )
                  .map((job) => (
                    <Marker
                      key={job.id}
                      coordinate={{
                        latitude: job.coordinates[0],
                        longitude: job.coordinates[1],
                      }}
                      pinColor={getMarkerColor(job.urgency)}
                      onPress={() => router.push(`/jobs/${job.id}` as any)}
                    >
                      <View style={styles.markerContainer}>
                        <View
                          style={[
                            styles.markerPin,
                            { backgroundColor: getMarkerColor(job.urgency) },
                          ]}
                        >
                          <Feather name="briefcase" size={16} color="#fff" />
                        </View>
                        <View
                          style={[
                            styles.markerLabel,
                            {
                              backgroundColor: isDark
                                ? "rgba(30, 41, 59, 0.95)"
                                : "rgba(255, 255, 255, 0.95)",
                            },
                          ]}
                        >
                          <Text
                            style={[styles.markerTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {job.title}
                          </Text>
                          {job.distanceKm && (
                            <Text
                              style={[
                                styles.markerDistance,
                                { color: isDark ? "#94a3b8" : "#64748b" },
                              ]}
                            >
                              {job.distanceKm.toFixed(1)} km
                            </Text>
                          )}
                        </View>
                      </View>
                    </Marker>
                  ))}
              </MapView>
            )}
          </View>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 2 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.3)",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  markerContainer: {
    alignItems: "center",
  },
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  markerTitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  markerDistance: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  emptyContainer: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  fallbackContainer: {
    flex: 1,
  },
  fallbackContent: {
    paddingBottom: 20,
  },
  fallbackHeader: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  fallbackSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  jobsList: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  jobCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  jobCardLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  jobCardLocationText: {
    fontSize: 14,
  },
  jobCardPayment: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  jobCardPaymentText: {
    fontSize: 14,
    fontWeight: "600",
  },
  jobCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

// Dark map style for better visibility in dark mode
const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#242f3e" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#242f3e" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];
