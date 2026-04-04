import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../../lib/api";

interface VehicleReview {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  vehicleType: string;
  otherTypeSpecification?: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  status: string;
  createdAt: string;
}

export default function VehicleReviewsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<VehicleReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        router.replace("/login" as never);
        return;
      }

      const base = getApiBase();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(
          `${base}/admin/dashboard/vehicles/pending?take=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setVehicles(data.vehicles || []);
          setTotal(data.total || 0);
        } else {
          setVehicles([]);
        }
      } catch {
        clearTimeout(timeoutId);
        setVehicles([]);
      }
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  const vehicleTypeLabel = (vt: string, other?: string) => {
    if (vt === "OTHER" && other) return other;
    return t(`vehicles.type.${vt}`);
  };

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
            {t("vehicles.vehicleVerification")}
          </Text>
          <View style={styles.placeholder} />
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {vehicles.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather
                  name="check-circle"
                  size={48}
                  color={isDark ? "rgba(255,250,240,0.2)" : "rgba(0,0,0,0.15)"}
                />
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: isDark
                        ? "rgba(255,250,240,0.4)"
                        : "rgba(0,0,0,0.3)",
                    },
                  ]}
                >
                  No pending vehicle reviews
                </Text>
              </View>
            ) : (
              <>
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isDark
                        ? "rgba(255,250,240,0.5)"
                        : "rgba(0,0,0,0.4)",
                    },
                  ]}
                >
                  {total} pending
                </Text>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,250,240,0.04)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "rgba(184,130,42,0.15)",
                      },
                    ]}
                    onPress={() =>
                      router.push(
                        `/admin/vehicle-review-detail?vehicleId=${v.id}` as never,
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <Feather
                        name="truck"
                        size={20}
                        color={isDark ? "#C9963F" : "#B8822A"}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={[styles.cardTitle, { color: colors.text }]}
                        >
                          {v.make} {v.model} ({v.year})
                        </Text>
                        <Text
                          style={[
                            styles.cardSubtitle,
                            {
                              color: isDark
                                ? "rgba(255,250,240,0.5)"
                                : "#8A7B68",
                            },
                          ]}
                        >
                          {vehicleTypeLabel(
                            v.vehicleType,
                            v.otherTypeSpecification,
                          )}{" "}
                          · {v.licensePlate}
                        </Text>
                      </View>
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={colors.text}
                      />
                    </View>
                    {v.user && (
                      <Text
                        style={[
                          styles.cardProvider,
                          {
                            color: isDark
                              ? "rgba(255,250,240,0.4)"
                              : "#6B6355",
                          },
                        ]}
                      >
                        {v.user.firstName} {v.user.lastName} · {v.user.email}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.cardDate,
                        {
                          color: isDark
                            ? "rgba(255,250,240,0.3)"
                            : "rgba(0,0,0,0.25)",
                        },
                      ]}
                    >
                      {new Date(v.createdAt).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        )}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  placeholder: { width: 40 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: { flex: 1 },
  listContent: { padding: 16 },
  countText: { fontSize: 13, marginBottom: 12 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 16,
  },
  emptyText: { fontSize: 16 },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  cardProvider: {
    fontSize: 12,
    marginTop: 8,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 4,
  },
});
