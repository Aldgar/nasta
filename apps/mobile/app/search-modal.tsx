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

interface Talent {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  location?: string;
  city?: string;
  coordinates?: [number, number];
  skills?: string[];
  hourlyRate?: number;
  distanceKm?: number;
}

export default function SearchModal() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [skills, setSkills] = useState<
    Array<{ id: string; name: string; category: { id: string; name: string } }>
  >([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocation();
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoadingSkills(true);
      setSkillsError(null);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        console.log("[SearchModal] No token available for fetching skills");
        setLoadingSkills(false);
        // Use fallback skills if no token
        setSkills([
          {
            id: "1",
            name: "Cleaning",
            category: { id: "1", name: "Services" },
          },
          {
            id: "2",
            name: "Plumbing",
            category: { id: "2", name: "Services" },
          },
          {
            id: "3",
            name: "Electrical",
            category: { id: "3", name: "Services" },
          },
          {
            id: "4",
            name: "Carpentry",
            category: { id: "4", name: "Services" },
          },
          {
            id: "5",
            name: "Painting",
            category: { id: "5", name: "Services" },
          },
          {
            id: "6",
            name: "Gardening",
            category: { id: "6", name: "Services" },
          },
          { id: "7", name: "Moving", category: { id: "7", name: "Services" } },
          {
            id: "8",
            name: "Delivery",
            category: { id: "8", name: "Services" },
          },
        ]);
        return;
      }

      const base = getApiBase();
      console.log(`[SearchModal] Fetching skills from ${base}/users/skills`);
      const res = await fetch(`${base}/users/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`[SearchModal] Skills response status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`[SearchModal] Received skills:`, data?.length || 0, data);
        // Handle both array response and object with skills property
        const skillsList = Array.isArray(data) ? data : data?.skills || [];
        if (skillsList.length > 0) {
          setSkills(skillsList);
        } else {
          // Fallback to default skills if empty
          console.log("[SearchModal] No skills returned, using fallback");
          setSkills([
            {
              id: "1",
              name: "Cleaning",
              category: { id: "1", name: "Services" },
            },
            {
              id: "2",
              name: "Plumbing",
              category: { id: "2", name: "Services" },
            },
            {
              id: "3",
              name: "Electrical",
              category: { id: "3", name: "Services" },
            },
            {
              id: "4",
              name: "Carpentry",
              category: { id: "4", name: "Services" },
            },
            {
              id: "5",
              name: "Painting",
              category: { id: "5", name: "Services" },
            },
            {
              id: "6",
              name: "Gardening",
              category: { id: "6", name: "Services" },
            },
            {
              id: "7",
              name: "Moving",
              category: { id: "7", name: "Services" },
            },
            {
              id: "8",
              name: "Delivery",
              category: { id: "8", name: "Services" },
            },
          ]);
        }
      } else {
        const errorText = await res.text().catch(() => "Unknown error");
        console.error(
          `[SearchModal] Failed to fetch skills: ${res.status}`,
          errorText,
        );
        setSkillsError(`Failed to load skills (${res.status})`);
        // Use fallback skills on error
        setSkills([
          {
            id: "1",
            name: "Cleaning",
            category: { id: "1", name: "Services" },
          },
          {
            id: "2",
            name: "Plumbing",
            category: { id: "2", name: "Services" },
          },
          {
            id: "3",
            name: "Electrical",
            category: { id: "3", name: "Services" },
          },
          {
            id: "4",
            name: "Carpentry",
            category: { id: "4", name: "Services" },
          },
          {
            id: "5",
            name: "Painting",
            category: { id: "5", name: "Services" },
          },
          {
            id: "6",
            name: "Gardening",
            category: { id: "6", name: "Services" },
          },
          { id: "7", name: "Moving", category: { id: "7", name: "Services" } },
          {
            id: "8",
            name: "Delivery",
            category: { id: "8", name: "Services" },
          },
        ]);
      }
    } catch (err: any) {
      console.error("[SearchModal] Error fetching skills:", err);
      setSkillsError(err?.message || "Failed to load skills");
      // Use fallback skills on error
      setSkills([
        { id: "1", name: "Cleaning", category: { id: "1", name: "Services" } },
        { id: "2", name: "Plumbing", category: { id: "2", name: "Services" } },
        {
          id: "3",
          name: "Electrical",
          category: { id: "3", name: "Services" },
        },
        { id: "4", name: "Carpentry", category: { id: "4", name: "Services" } },
        { id: "5", name: "Painting", category: { id: "5", name: "Services" } },
        { id: "6", name: "Gardening", category: { id: "6", name: "Services" } },
        { id: "7", name: "Moving", category: { id: "7", name: "Services" } },
        { id: "8", name: "Delivery", category: { id: "8", name: "Services" } },
      ]);
    } finally {
      setLoadingSkills(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (err) {
      console.log("Error getting location:", err);
    }
  };

  const searchTalents = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();

      // Fetch candidates filtered by skill
      const params = new URLSearchParams();
      if (category) {
        params.append("skill", category);
      }

      const res = await fetch(`${base}/users/candidates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const candidates = data.candidates || [];

        // Transform candidates to talents format
        const talentsList: Talent[] = candidates.map((candidate: any) => ({
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          avatar: candidate.avatar,
          location:
            candidate.location ||
            [candidate.city, candidate.country].filter(Boolean).join(", "),
          city: candidate.city,
          coordinates:
            candidate.city && candidate.country ? undefined : undefined, // TODO: Add coordinates if available
          skills:
            candidate.skills?.map((s: any) => s.name) ||
            candidate.skillsSummary ||
            [],
          hourlyRate: candidate.hourlyRate,
        }));

        setTalents(talentsList);
      } else {
        setTalents([]);
      }
    } catch (err) {
      console.error("Error searching talents:", err);
      setTalents([]);
    } finally {
      setLoading(false);
    }
  }, [category, location, router]);

  const renderTalentItem = ({ item }: { item: Talent }) => (
    <TouchableOpacity
      style={[
        styles.talentCard,
        {
          backgroundColor: isDark
            ? "rgba(12, 22, 42, 0.85)"
            : "rgba(241, 245, 249, 0.95)",
          borderColor: isDark
            ? "rgba(255,250,240,0.12)"
            : "rgba(184,130,42,0.2)",
          borderWidth: 1,
        },
      ]}
      onPress={() => {
        router.push(`/candidate/${item.id}` as any);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.talentHeader}>
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Text style={styles.avatarText}>
              {item.firstName[0]}
              {item.lastName[0]}
            </Text>
          ) : (
            <Text style={styles.avatarText}>
              {item.firstName[0]}
              {item.lastName[0]}
            </Text>
          )}
        </View>
        <View style={styles.talentInfo}>
          <Text style={[styles.talentName, { color: colors.text }]}>
            {item.firstName} {item.lastName}
          </Text>
          <View style={styles.talentMeta}>
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
                {item.distanceKm.toFixed(1)} km away
              </Text>
            )}
          </View>
        </View>
        {item.hourlyRate && (
          <View style={styles.rateContainer}>
            <Text style={[styles.rateText, { color: colors.tint }]}>
              ${item.hourlyRate}/hr
            </Text>
          </View>
        )}
      </View>
      {item.skills && item.skills.length > 0 && (
        <View style={styles.skillsContainer}>
          {item.skills.slice(0, 3).map((skill, idx) => (
            <View
              key={idx}
              style={[
                styles.skillTag,
                {
                  backgroundColor: isDark
                    ? "rgba(201, 150, 63, 0.2)"
                    : "rgba(201, 150, 63, 0.1)",
                },
              ]}
            >
              <Text style={[styles.skillText, { color: colors.tint }]}>
                {skill}
              </Text>
            </View>
          ))}
        </View>
      )}
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
                {t("searchJobs.searchTalent")}
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
                      ? "rgba(12, 22, 42, 0.75)"
                      : "rgba(241, 245, 249, 0.9)",
                    borderColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(184,130,42,0.2)",
                    borderWidth: 1,
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
                        ? "rgba(12, 22, 42, 0.75)"
                        : "rgba(241, 245, 249, 0.9)",
                      borderColor: isDark
                        ? "rgba(255,250,240,0.12)"
                        : "rgba(184,130,42,0.2)",
                      borderWidth: 1,
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
                  {
                    backgroundColor: isDark ? "#E8B86D" : "#C9963F",
                    borderWidth: 1,
                    borderColor: isDark ? "#E8B86D" : "#C9963F",
                  },
                ]}
                onPress={searchTalents}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFAF0" />
                ) : (
                  <Text style={styles.buttonText}>
                    {t("searchJobs.search")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {talents.length > 0 && (
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    viewMode === "list" && styles.toggleButtonActive,
                    {
                      backgroundColor:
                        viewMode === "list"
                          ? isDark
                            ? "#E8B86D"
                            : "#C9963F"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: 1,
                      borderColor:
                        viewMode === "list"
                          ? isDark
                            ? "#E8B86D"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.12)"
                            : "rgba(184,130,42,0.2)",
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
                    List
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
                            ? "#E8B86D"
                            : "#C9963F"
                          : isDark
                            ? "rgba(201,150,63,0.12)"
                            : "rgba(184,130,42,0.06)",
                      borderWidth: 1,
                      borderColor:
                        viewMode === "map"
                          ? isDark
                            ? "#E8B86D"
                            : "#C9963F"
                          : isDark
                            ? "rgba(255,250,240,0.12)"
                            : "rgba(184,130,42,0.2)",
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
                    Map
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {viewMode === "map" && talents.length > 0 && (
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
                  {talents
                    .filter((t) => t.coordinates && t.coordinates.length === 2)
                    .map((talent) => (
                      <Marker
                        key={talent.id}
                        coordinate={{
                          latitude: talent.coordinates![0],
                          longitude: talent.coordinates![1],
                        }}
                        title={`${talent.firstName} ${talent.lastName}`}
                      />
                    ))}
                </MapView>
              </View>
            )}

            {viewMode === "list" && (
              <FlatList
                data={talents}
                keyExtractor={(item) => item.id}
                renderItem={renderTalentItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  !loading ? (
                    <View style={styles.emptyContainer}>
                      <Feather
                        name="search"
                        size={48}
                        color={isDark ? "#6B6355" : "#B8A88A"}
                      />
                      <Text
                        style={[
                          styles.emptyText,
                          { color: isDark ? "#9A8E7A" : "#8A7B68" },
                        ]}
                      >
                        No talents found. Try adjusting your search.
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
                      : "rgba(241, 245, 249, 0.98)",
                    borderTopWidth: 1,
                    borderTopColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t("searchJobs.selectCategoryTitle")}
                  </Text>
                  <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {loadingSkills ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <Text
                        style={[styles.loadingText, { color: colors.text }]}
                      >
                        {t("searchJobs.loadingSkills")}
                      </Text>
                    </View>
                  ) : skills.length === 0 ? (
                    <View style={styles.loadingContainer}>
                      <Text
                        style={[styles.loadingText, { color: colors.text }]}
                      >
                        {t("searchJobs.noSkillsAvailable")}
                      </Text>
                    </View>
                  ) : (
                    skills.map((skill) => (
                      <TouchableOpacity
                        key={skill.id}
                        style={[
                          styles.categoryOption,
                          category === skill.name &&
                            styles.categoryOptionSelected,
                          {
                            backgroundColor:
                              category === skill.name
                                ? isDark
                                  ? "#E8B86D"
                                  : "#C9963F"
                                : isDark
                                  ? "rgba(255,250,240,0.06)"
                                  : "rgba(184,130,42,0.06)",
                            borderWidth: category === skill.name ? 1 : 0,
                            borderColor:
                              category === skill.name
                                ? isDark
                                  ? "#E8B86D"
                                  : "#C9963F"
                                : "transparent",
                          },
                        ]}
                        onPress={() => {
                          setCategory(skill.name);
                          setShowCategoryModal(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            {
                              color:
                                category === skill.name
                                  ? "#FFFAF0"
                                  : colors.text,
                            },
                          ]}
                        >
                          {skill.name}
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
  talentCard: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  talentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#C9963F",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFFAF0", fontWeight: "700", fontSize: 18 },
  talentInfo: { flex: 1 },
  talentName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  talentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  rateContainer: {
    backgroundColor: "rgba(201, 150, 63, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rateText: { fontWeight: "700", fontSize: 14 },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  skillText: { fontSize: 12, fontWeight: "700" },
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
    paddingBottom: Platform.OS === "android" ? 56 : 24,
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
  categoryOptionText: { fontSize: 16, fontWeight: "500" },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
});
