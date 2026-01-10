import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import { useLanguage } from "../context/LanguageContext";
import Constants from "expo-constants";

let MapView: any = null;
let Marker: any = null;

// Try to load maps - will fail gracefully in Expo Go
try {
  // Lazy require to avoid bundling error if not installed yet
  const maps = require("react-native-maps");
  MapView = maps.MapView;
  Marker = maps.Marker;
} catch (e) {
  // Maps not available (e.g., in Expo Go or not installed)
  // This is expected and the app will show a fallback UI
  MapView = null;
  Marker = null;
}

export default function ExploreMap() {
  const { t } = useLanguage();

  const androidGoogleMapsApiKey: string | undefined =
    (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ||
    (Constants.expoConfig as any)?.android?.config?.googleMapsApiKey ||
    (Constants.expoConfig as any)?.android?.googleMapsApiKey;
  const isAndroidMapsConfigured =
    Platform.OS !== "android" ||
    (typeof androidGoogleMapsApiKey === "string" &&
      androidGoogleMapsApiKey.trim().length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("navigation.explore")}</Text>
        <Text style={styles.subtitle}>{t("explore.jobsByLocation")}</Text>
      </View>
      {MapView && isAndroidMapsConfigured ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 37.78825,
            longitude: -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          <Marker
            coordinate={{ latitude: 37.78825, longitude: -122.4324 }}
            title={t("explore.sampleJob")}
            description={t("explore.nearbyJob")}
          />
        </MapView>
      ) : (
        <View style={styles.mapBox}>
          <Text style={{ color: "#9ca3af", textAlign: "center" }}>
            {Platform.OS === "android" && !isAndroidMapsConfigured
              ? "Google Maps API key is missing for Android builds."
              : "Google Maps not available."}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f1a", padding: 16 },
  headerRow: { marginBottom: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#9ca3af" },
  mapBox: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  map: { flex: 1, borderRadius: 16 },
});
