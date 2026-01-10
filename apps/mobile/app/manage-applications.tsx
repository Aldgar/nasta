import { useEffect, useState, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "../lib/api";

type Application = {
  id: string;
  jobTitle: string;
  candidateName: string;
  candidateId: string;
  status: "New" | "Reviewed" | "Accepted" | "Rejected";
  createdAt: string;
  isInstantJob: boolean;
};

// Backend response type
type BackendApplication = {
  id: string;
  status: string;
  appliedAt: string;
  job: {
    id: string;
    title: string;
    isInstantBook?: boolean;
  };
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type TabType = "all" | "instant" | "normal";

export default function ManageApplications() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
        setLoading(true);
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const base = getApiBase();
        // Use the employer-specific endpoint
        const res = await fetch(`${base}/applications/employer`, { 
            headers: { Authorization: `Bearer ${token}` } 
        });

        if (res.ok) {
            const data: BackendApplication[] = await res.json();
            // Transform backend data to frontend format
            const transformed = (Array.isArray(data) ? data : []).map((app: BackendApplication) => {
              // Map status from backend enum to frontend display status
              let displayStatus: "New" | "Reviewed" | "Accepted" | "Rejected" = "New";
              if (app.status === "PENDING") {
                displayStatus = "New";
              } else if (app.status === "REVIEWING" || app.status === "SHORTLISTED" || app.status === "INTERVIEW") {
                displayStatus = "Reviewed";
              } else if (app.status === "ACCEPTED") {
                displayStatus = "Accepted";
              } else if (app.status === "REJECTED") {
                displayStatus = "Rejected";
              }
              // Note: Status values are kept as-is for display logic, but will be translated in the UI

              return {
                id: app.id,
                jobTitle: app.job?.title || t("manageApplications.unknownJob"),
                candidateName: `${app.applicant?.firstName || ""} ${app.applicant?.lastName || ""}`.trim() || t("manageApplications.unknownCandidate"),
                candidateId: app.applicant?.id || "",
                status: displayStatus,
                createdAt: app.appliedAt,
                isInstantJob: app.job?.isInstantBook === true,
              };
            });
            setApplications(transformed);
        } else {
            const error = await res.json().catch(() => ({}));
            console.log("Error fetching applications:", error);
            setApplications([]); 
        }
    } catch (err) {
        console.log("Error fetching applications", err);
        setApplications([]);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteInstantJob = async (applicationId: string) => {
    Alert.alert(
      t("manageApplications.deleteInstantJobRequest"),
      t("manageApplications.deleteInstantJobConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(applicationId);
              const token = await SecureStore.getItemAsync("auth_token");
              if (!token) {
                Alert.alert(t("common.error"), t("applications.authenticationRequired"));
                return;
              }

              const base = getApiBase();
              const res = await fetch(`${base}/applications/${applicationId}/delete-instant`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });

              if (res.ok) {
                Alert.alert(t("common.success"), t("manageApplications.instantJobDeleted"));
                await fetchApplications();
              } else {
                const errorData = await res.json().catch(() => ({ message: t("manageApplications.failedToDeleteInstantJob") }));
                Alert.alert(t("common.error"), errorData.message || t("manageApplications.failedToDeleteInstantJob"));
              }
            } catch (error: any) {
              console.error("Error deleting instant job request:", error);
              Alert.alert(t("common.error"), error?.message || t("manageApplications.failedToDeleteInstantJob"));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
        fetchApplications();
    }, [])
  );

  // Filter applications based on active tab
  const filteredApplications = applications.filter((app) => {
    if (activeTab === "instant") {
      return app.isInstantJob;
    } else if (activeTab === "normal") {
      return !app.isInstantJob;
    }
    return true; // "all" tab shows everything
  });

  const instantJobCount = applications.filter((app) => app.isInstantJob).length;
  const normalJobCount = applications.filter((app) => !app.isInstantJob).length;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={styles.header}>
           <TouchableOpacity 
             style={[styles.backBtn, { 
               backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0,0,0,0.05)",
               borderColor: isDark ? "rgba(255,255,255,0.1)" : "transparent",
               borderWidth: isDark ? 1 : 0,
             }]}
             onPress={() => router.back()}
           >
             <Feather name="arrow-left" size={24} color={colors.text} />
           </TouchableOpacity>
           <Text style={[styles.headerTitle, { color: colors.text }]}>{t("manageApplications.applications")}</Text>
           <View style={{ width: 40 }} />
         </View>

         {/* Tabs */}
         <View style={styles.tabsContainer}>
           <TouchableOpacity
             style={[
               styles.tab,
               activeTab === "all" && styles.tabActive,
               {
                 backgroundColor: activeTab === "all" 
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : "transparent",
                 borderColor: activeTab === "all"
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
               },
             ]}
             onPress={() => setActiveTab("all")}
           >
             <Text
               style={[
                 styles.tabText,
                 {
                   color: activeTab === "all" ? "#fff" : colors.text,
                   fontWeight: activeTab === "all" ? "700" : "500",
                 },
               ]}
             >
               {t("manageApplications.all")} ({applications.length})
             </Text>
           </TouchableOpacity>

           <TouchableOpacity
             style={[
               styles.tab,
               activeTab === "instant" && styles.tabActive,
               {
                 backgroundColor: activeTab === "instant" 
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : "transparent",
                 borderColor: activeTab === "instant"
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
               },
             ]}
             onPress={() => setActiveTab("instant")}
           >
             <Feather 
               name="zap" 
               size={16} 
               color={activeTab === "instant" ? "#fff" : colors.text} 
               style={{ marginRight: 6 }}
             />
             <Text
               style={[
                 styles.tabText,
                 {
                   color: activeTab === "instant" ? "#fff" : colors.text,
                   fontWeight: activeTab === "instant" ? "700" : "500",
                 },
               ]}
             >
               {t("manageApplications.instant")} ({instantJobCount})
             </Text>
           </TouchableOpacity>

           <TouchableOpacity
             style={[
               styles.tab,
               activeTab === "normal" && styles.tabActive,
               {
                 backgroundColor: activeTab === "normal" 
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : "transparent",
                 borderColor: activeTab === "normal"
                   ? (isDark ? "#6366f1" : "#4f46e5")
                   : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
               },
             ]}
             onPress={() => setActiveTab("normal")}
           >
             <Text
               style={[
                 styles.tabText,
                 {
                   color: activeTab === "normal" ? "#fff" : colors.text,
                   fontWeight: activeTab === "normal" ? "700" : "500",
                 },
               ]}
             >
               {t("manageApplications.jobPosts")} ({normalJobCount})
             </Text>
           </TouchableOpacity>
         </View>

         {loading ? (
             <View style={styles.emptyContainer}>
                 <ActivityIndicator size="large" color={colors.tint} />
             </View>
         ) : (
             <FlatList
               data={filteredApplications}
               keyExtractor={(item) => item.id}
               contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.itemCard, 
                    { 
                      backgroundColor: isDark ? "rgba(30, 41, 59, 0.85)" : "#fff",
                      borderColor: item.isInstantJob
                        ? (isDark ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.3)")
                        : (isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb"),
                      borderWidth: item.isInstantJob ? 2 : 1,
                    }
                  ]}
                  onPress={() => router.push({
                    pathname: `/applicant/${item.id}`,
                    params: item.isInstantJob ? { instantJob: "true" } : {},
                  } as any)}
                >
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      {item.isInstantJob && (
                        <View style={[styles.instantBadge, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)" }]}>
                          <Feather name="zap" size={12} color={isDark ? "#818cf8" : "#6366f1"} />
                          <Text style={[styles.instantBadgeText, { color: isDark ? "#818cf8" : "#6366f1" }]}>
                            {t("manageApplications.instantJob")}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.jobTitle, { color: isDark ? "#94a3b8" : "#6b7280" }]}>{item.jobTitle}</Text>
                      <Text style={[styles.candidate, { color: colors.tint }]}>{item.candidateName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === "New" ? "#10b981" : "#6b7280" }]}>
                      <Text style={styles.statusText}>
                        {item.status === "New" ? t("manageApplications.new") : 
                         item.status === "Reviewed" ? t("manageApplications.reviewed") :
                         item.status === "Accepted" ? t("manageApplications.accepted") :
                         t("manageApplications.rejected")}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <Text style={[styles.date, { color: isDark ? "#94a3b8" : "#6b7280" }]}>
                              {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          {/* Delete button for instant job requests (only if not accepted) */}
                          {item.isInstantJob && item.status !== "Accepted" && (
                            <TouchableOpacity
                              style={[styles.deleteBtn, { 
                                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
                              }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteInstantJob(item.id);
                              }}
                              disabled={deletingId === item.id}
                            >
                              {deletingId === item.id ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                              ) : (
                                <>
                                  <Feather name="trash-2" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                                  <Text style={[styles.deleteBtnText, { color: "#ef4444" }]}>Delete</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                          {(item.status === "Accepted" || item.status === "Reviewed") && (
                            <TouchableOpacity
                                style={[styles.rateBtn, { borderColor: colors.tint }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  router.push({ pathname: "/rate-provider", params: { id: item.candidateId, name: item.candidateName } });
                                }}
                            >
                                <Feather name="star" size={14} color={colors.tint} style={{ marginRight: 6 }} />
                                <Text style={[styles.rateBtnText, { color: colors.tint }]}>Rate Provider</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                    </View>
                  </TouchableOpacity>
               )}
               ListEmptyComponent={
                 <View style={styles.emptyContainer}>
                   <Feather name="inbox" size={48} color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} />
                   <Text style={[styles.emptyText, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }]}>
                     {activeTab === "instant" 
                       ? t("manageApplications.noInstantJobRequestsYet")
                       : activeTab === "normal"
                       ? t("manageApplications.noJobPostApplicationsYet")
                       : t("manageApplications.noApplicationsYet")}
                   </Text>
                 </View>
               }
             />
         )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
  },
  listContent: {
    padding: 20,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  instantBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    gap: 4,
  },
  instantBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  jobTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  candidate: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  date: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  rateBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
