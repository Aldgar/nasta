import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import GradientBackground from "../components/GradientBackground";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

interface Job {
  id: string;
  title: string;
  description: string;
  location?: string;
  city?: string;
  country?: string;
  coordinates?: [number, number];
  type?: string;
  workMode?: string;
  category?: { id: string; name: string };
  company?: { id: string; name: string };
  distanceKm?: number;
  isInstantBook?: boolean;
}

// Helper function to translate category names
const translateCategoryName = (
  categoryName: string | undefined,
  t: (key: string) => string,
): string => {
  if (!categoryName) return "";
  const categoryMap: Record<string, string> = {
    Cleaning: "cleaning",
    Plumbing: "plumbing",
    Gardening: "gardening",
    Electrical: "electrical",
    Carpentry: "carpentry",
    Painting: "painting",
    Moving: "moving",
    "General Labor": "generalLabor",
    Delivery: "delivery",
    Other: "other",
  };
  const key = categoryMap[categoryName];
  return key ? t(`jobs.category.${key}`) : categoryName;
};

export default function SearchJobs() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    getCurrentLocation();
    fetchCategories();
    // Load all available jobs on mount (no filters)
    loadAllJobs();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const base = getApiBase();
      const response = await fetch(`${base}/jobs/categories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch categories");
        // Fallback to default categories if API fails
        setCategories([
          { id: "", name: "Cleaning" },
          { id: "", name: "Plumbing" },
          { id: "", name: "Gardening" },
          { id: "", name: "Electrical" },
          { id: "", name: "Carpentry" },
          { id: "", name: "Painting" },
          { id: "", name: "Moving" },
          { id: "", name: "General Labor" },
          { id: "", name: "Delivery" },
        ]);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      // Fallback to default categories on error
      setCategories([
        { id: "", name: "Cleaning" },
        { id: "", name: "Plumbing" },
        { id: "", name: "Gardening" },
        { id: "", name: "Electrical" },
        { id: "", name: "Carpentry" },
        { id: "", name: "Painting" },
        { id: "", name: "Moving" },
        { id: "", name: "General Labor" },
        { id: "", name: "Delivery" },
      ]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // Still allow search without location
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (err) {
      console.log("Error getting location:", err);
      // Continue without location - user can still search
    }
  };

  const loadAllJobs = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const jobsRes = await fetch(`${base}/jobs?limit=200`, {
        method: "GET",
        headers,
      });

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        const allJobs: Job[] = Array.isArray(jobsData)
          ? jobsData
          : jobsData.jobs || jobsData.items || [];
        setJobs(allJobs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error("Error loading jobs:", err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const searchJobs = useCallback(async () => {
    // If no filters applied, just load all jobs
    if (!category && !location?.trim()) {
      setHasSearched(false);
      await loadAllJobs();
      return;
    }
    setHasSearched(true);
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      const params = new URLSearchParams();
      params.append("limit", "200");

      // Use server-side category filtering
      if (category && category !== "") {
        params.append("category", category);
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const jobsRes = await fetch(`${base}/jobs?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        let allJobs: Job[] = Array.isArray(jobsData)
          ? jobsData
          : jobsData.jobs || jobsData.items || [];

        // Filter by location text if provided (client-side)
        if (location && location.trim() !== "") {
          const locationLower = location.toLowerCase().trim();
          allJobs = allJobs.filter(
            (job: Job) =>
              job.city?.toLowerCase().includes(locationLower) ||
              job.location?.toLowerCase().includes(locationLower) ||
              job.country?.toLowerCase().includes(locationLower),
          );
        }

        // Sort by distance if available, otherwise keep server order
        if (userLocation) {
          allJobs.sort((a, b) => {
            if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
              return a.distanceKm - b.distanceKm;
            }
            return 0;
          });
        }

        setJobs(allJobs);
      } else {
        const errorText = await jobsRes.text();
        console.error("Failed to fetch jobs:", jobsRes.status, errorText);
        setJobs([]);
      }
    } catch (err) {
      console.error("Error searching jobs:", err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [category, location, userLocation, router]);

  // searchJobs is only called when user taps the Search button

  const renderJobItem = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={[
        styles.jobCard,
        {
          backgroundColor: isDark ? "rgba(12, 22, 42, 0.75)" : "#FFFAF0",
          borderColor: isDark
            ? "rgba(201,150,63,0.12)"
            : "rgba(184,130,42,0.2)",
        },
      ]}
      onPress={() => {
        // TODO: Navigate to job details page when implemented
        // For now, show job info and allow applying
        router.back();
        // You can add navigation to job details or application page here
      }}
    >
      <View style={styles.jobHeader}>
        <View style={styles.jobInfo}>
          <Text
            style={[styles.jobTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.company?.name && (
            <Text
              style={[
                styles.companyName,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {item.company.name}
            </Text>
          )}
        </View>
        {item.isInstantBook && (
          <View
            style={[
              styles.instantBadge,
              { backgroundColor: isDark ? "#22D3EE" : "#06B6D4" },
            ]}
          >
            <Text style={styles.instantText}>{t("jobs.instant")}</Text>
          </View>
        )}
      </View>

      {item.description && (
        <Text
          style={[
            styles.jobDescription,
            { color: isDark ? "#B8A88A" : "#6B6355" },
          ]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      )}

      <View style={styles.jobMeta}>
        <View style={styles.metaRow}>
          {item.city && (
            <View style={styles.metaItem}>
              <Feather
                name="map-pin"
                size={12}
                color={isDark ? "#9A8E7A" : "#8A7B68"}
              />
              <Text
                style={[
                  styles.metaText,
                  { color: isDark ? "#9A8E7A" : "#8A7B68" },
                ]}
              >
                {item.city}
                {item.country && `, ${item.country}`}
              </Text>
            </View>
          )}
          {item.distanceKm && (
            <Text
              style={[
                styles.metaText,
                { color: isDark ? "#9A8E7A" : "#8A7B68" },
              ]}
            >
              {t("searchJobs.kmAway", { distance: item.distanceKm.toFixed(1) })}
            </Text>
          )}
        </View>

        <View style={styles.jobTags}>
          {item.type && (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: isDark
                    ? "rgba(201, 150, 63, 0.2)"
                    : "rgba(201, 150, 63, 0.1)",
                },
              ]}
            >
              <Text style={[styles.tagText, { color: colors.tint }]}>
                {item.type
                  ? t(
                      `jobs.type.${item.type.toLowerCase().replace(/_/g, "")}`,
                    ) || item.type.replace("_", " ")
                  : ""}
              </Text>
            </View>
          )}
          {item.workMode && (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: isDark
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(34, 197, 94, 0.1)",
                },
              ]}
            >
              <Text style={[styles.tagText, { color: "#22c55e" }]}>
                {item.workMode
                  ? t(
                      `jobs.workModeOptions.${item.workMode.toLowerCase().replace(/_/g, "")}`,
                    ) || item.workMode.replace("_", " ")
                  : ""}
              </Text>
            </View>
          )}
          {item.category?.name && (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: isDark
                    ? "rgba(168, 85, 247, 0.2)"
                    : "rgba(168, 85, 247, 0.1)",
                },
              ]}
            >
              <Text style={[styles.tagText, { color: "#a855f7" }]}>
                {translateCategoryName(item.category.name, t)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.container}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("searchJobs.title")}
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.closeBtn}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("searchJobs.jobCategory")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.categoryInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.55)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: category
                        ? colors.text
                        : isDark
                          ? "#8A7B68"
                          : "#9A8E7A",
                    },
                  ]}
                >
                  {category || t("searchJobs.selectCategory")}
                </Text>
                <Feather
                  name="chevron-down"
                  size={20}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                />
              </TouchableOpacity>

              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#B8A88A" : "#6B6355" },
                ]}
              >
                {t("searchJobs.location")}
              </Text>
              <View style={styles.inputRow}>
                <Feather
                  name="map-pin"
                  size={18}
                  color={isDark ? "#9A8E7A" : "#8A7B68"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputWithIcon,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "rgba(255,250,240,0.92)",
                      borderColor: isDark
                        ? "rgba(201,150,63,0.12)"
                        : "rgba(184,130,42,0.2)",
                      color: colors.text,
                    },
                  ]}
                  placeholder={t("searchJobs.enterCityOrZipCode")}
                  placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: isDark ? "#C9963F" : colors.tint },
                ]}
                onPress={searchJobs}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFAF0" />
                ) : (
                  <Text style={styles.buttonText}>{t("common.search")}</Text>
                )}
              </TouchableOpacity>
            </View>

            {jobs.length > 0 && (
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    viewMode === "list" && styles.toggleButtonActive,
                    {
                      backgroundColor:
                        viewMode === "list"
                          ? isDark
                            ? "#C9963F"
                            : colors.tint
                          : "transparent",
                    },
                  ]}
                  onPress={() => setViewMode("list")}
                >
                  <Feather
                    name="list"
                    size={18}
                    color={viewMode === "list" ? "#FFFAF0" : colors.text}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      { color: viewMode === "list" ? "#FFFAF0" : colors.text },
                    ]}
                  >
                    {t("searchJobs.list")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    viewMode === "map" && styles.toggleButtonActive,
                    {
                      backgroundColor:
                        viewMode === "map"
                          ? isDark
                            ? "#C9963F"
                            : colors.tint
                          : "transparent",
                    },
                  ]}
                  onPress={() => setViewMode("map")}
                >
                  <Feather
                    name="map"
                    size={18}
                    color={viewMode === "map" ? "#FFFAF0" : colors.text}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      { color: viewMode === "map" ? "#FFFAF0" : colors.text },
                    ]}
                  >
                    {t("searchJobs.map")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {viewMode === "map" && jobs.length > 0 && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: userLocation?.lat || 37.78825,
                    longitude: userLocation?.lng || -122.4324,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }}
                >
                  {userLocation && (
                    <Marker
                      coordinate={{
                        latitude: userLocation.lat,
                        longitude: userLocation.lng,
                      }}
                      title={t("searchJobs.yourLocation")}
                      pinColor="blue"
                    />
                  )}
                  {jobs
                    .filter(
                      (job) => job.coordinates && job.coordinates.length === 2,
                    )
                    .map((job) => (
                      <Marker
                        key={job.id}
                        coordinate={{
                          latitude: job.coordinates![0],
                          longitude: job.coordinates![1],
                        }}
                        title={job.title}
                        description={job.company?.name || job.location}
                      />
                    ))}
                </MapView>
              </View>
            )}

            {viewMode === "list" && (
              <FlatList
                data={jobs}
                keyExtractor={(item) => item.id}
                renderItem={renderJobItem}
                contentContainerStyle={styles.listContent}
                refreshing={loading}
                onRefresh={searchJobs}
                ListEmptyComponent={
                  !loading ? (
                    <View style={styles.emptyContainer}>
                      <Feather
                        name="briefcase"
                        size={48}
                        color={isDark ? "#6B6355" : "#B8A88A"}
                      />
                      <Text
                        style={[
                          styles.emptyText,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        {t("searchJobs.noJobsFound")}
                      </Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>

          <Modal
            visible={showCategoryModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCategoryModal(false)}
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
                    {t("searchJobs.selectCategory")}
                  </Text>
                  <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <TouchableOpacity
                    style={[
                      styles.categoryOption,
                      category === "" && styles.categoryOptionSelected,
                      {
                        backgroundColor:
                          category === ""
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.06)"
                              : "rgba(184,130,42,0.06)",
                        borderWidth: category === "" ? 0 : 1,
                        borderColor:
                          category === ""
                            ? "transparent"
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "rgba(184,130,42,0.2)",
                      },
                    ]}
                    onPress={() => {
                      setCategory("");
                      setShowCategoryModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color: category === "" ? "#FFFAF0" : colors.text,
                          fontWeight: category === "" ? "600" : "500",
                        },
                      ]}
                    >
                      {t("searchJobs.allCategories")}
                    </Text>
                  </TouchableOpacity>
                  {loadingCategories ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color={colors.tint} />
                      <Text
                        style={[styles.loadingText, { color: colors.text }]}
                      >
                        {t("searchJobs.loadingCategories")}
                      </Text>
                    </View>
                  ) : (
                    categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id || cat.name}
                        style={[
                          styles.categoryOption,
                          category === cat.name &&
                            styles.categoryOptionSelected,
                          {
                            backgroundColor:
                              category === cat.name
                                ? isDark
                                  ? "#C9963F"
                                  : "#C9963F"
                                : isDark
                                  ? "rgba(255,250,240,0.06)"
                                  : "rgba(184,130,42,0.06)",
                            borderWidth: category === cat.name ? 0 : 1,
                            borderColor:
                              category === cat.name
                                ? "transparent"
                                : isDark
                                  ? "rgba(201,150,63,0.12)"
                                  : "rgba(184,130,42,0.2)",
                          },
                        ]}
                        onPress={() => {
                          setCategory(cat.name);
                          setShowCategoryModal(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            {
                              color:
                                category === cat.name ? "#FFFAF0" : colors.text,
                              fontWeight: category === cat.name ? "600" : "500",
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 24 },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,250,240,0.15)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: 2 },
  closeBtn: { padding: 4 },
  searchSection: { marginBottom: 20 },
  label: { fontWeight: "700", marginBottom: 8, marginLeft: 4, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  categoryInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryText: { fontSize: 16 },
  inputRow: { position: "relative", marginBottom: 20 },
  inputWithIcon: { paddingLeft: 44, marginBottom: 0 },
  inputIcon: { position: "absolute", left: 14, top: 18, zIndex: 1 },
  button: {
    padding: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#FFFAF0", fontWeight: "700", fontSize: 16 },
  viewToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,250,240,0.15)",
  },
  toggleButtonActive: {
    borderColor: "transparent",
  },
  toggleText: { fontWeight: "700", fontSize: 14 },
  mapContainer: {
    flex: 1,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  map: { flex: 1 },
  listContent: { paddingBottom: 20 },
  jobCard: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobInfo: { flex: 1, marginRight: 8 },
  jobTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  companyName: { fontSize: 14, fontWeight: "500" },
  instantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  instantText: { color: "#FFFAF0", fontSize: 10, fontWeight: "700" },
  jobDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  jobMeta: { marginTop: 8 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  jobTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  categoryOption: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  categoryOptionSelected: {},
  categoryOptionText: { fontSize: 16 },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
