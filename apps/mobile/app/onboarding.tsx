import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator, // Added ActivityIndicator
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import GradientBackground from "../components/GradientBackground";
import { TouchableButton } from "../components/TouchableButton";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store"; // Added SecureStore
import { getApiBase } from "../lib/api"; // Added getApiBase

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, theme, isDark } = useTheme();
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(1); // Kept activeStep as it's used in StepIndicator
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Rate entry type
  interface RateEntry {
    id: string;
    rate: string;
    description: string;
    paymentType: "HOUR" | "DAY" | "WEEK" | "MONTH" | "OTHER";
    otherSpecification?: string;
  }

  // Language entry type
  interface LanguageEntry {
    language: string;
    level: "NATIVE" | "PROFESSIONAL" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  }

  // Skill entry type
  interface SkillEntry {
    name: string;
    yearsExperience: string;
  }

  // Work Experience entry type
  interface WorkExperienceEntry {
    id: string;
    company: string;
    fromDate: string;
    toDate: string;
    isCurrent: boolean;
    category: string;
    years: string;
    description: string;
  }

  // Certification entry type
  interface CertificationEntry {
    id: string;
    title: string;
    institution: string;
    graduationDate: string;
    isStillStudying: boolean;
    certificateUri: string | null;
    certificateName: string | null;
  }

  // Education entry type (same as certification)
  interface EducationEntry {
    id: string;
    title: string;
    institution: string;
    graduationDate: string;
    isStillStudying: boolean;
    certificateUri: string | null;
    certificateName: string | null;
  }

  // Project entry type
  interface ProjectEntry {
    id: string;
    title: string;
    description: string;
    url?: string;
  }

  // Form State
  const [formData, setFormData] = useState({
    aboutMe: "",
    rates: [
      {
        id: Date.now().toString(),
        rate: "",
        paymentType: "HOUR" as const,
        otherSpecification: "",
      },
    ] as RateEntry[],
    languages: [] as LanguageEntry[],
    skills: [] as SkillEntry[],
    workExperience: [] as WorkExperienceEntry[],
    certifications: [] as CertificationEntry[],
    education: [] as EducationEntry[],
    projects: [] as ProjectEntry[],
  });

  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState<
    string | null
  >(null);
  const [showOtherInputModal, setShowOtherInputModal] = useState<string | null>(
    null,
  );
  const [otherInputValue, setOtherInputValue] = useState("");

  // Modal states for new sections
  const [showLanguageLevelModal, setShowLanguageLevelModal] = useState<
    string | null
  >(null);
  const [showLanguageSelectModal, setShowLanguageSelectModal] = useState(false);
  const [selectedLanguageForAdd, setSelectedLanguageForAdd] = useState<
    string | null
  >(null);
  const [selectedLanguageLevel, setSelectedLanguageLevel] = useState<
    LanguageEntry["level"] | null
  >(null);
  const [showSkillSelectModal, setShowSkillSelectModal] = useState(false);
  const [showWorkExpModal, setShowWorkExpModal] = useState<string | null>(null);
  const [showCertificationModal, setShowCertificationModal] = useState<
    string | null
  >(null);
  const [showEducationModal, setShowEducationModal] = useState<string | null>(
    null,
  );
  const [showProjectModal, setShowProjectModal] = useState<string | null>(null);

  // Load existing profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          setLoadingProfile(false);
          return;
        }

        const base = getApiBase();
        const res = await fetch(`${base}/profiles/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const profile = data.profile;

          if (profile) {
            // Load bio
            const bio = profile.bio || "";

            // Load data from links JSON field
            const links = profile.links as
              | {
                  hourlyRate?: number;
                  yearsExperience?: number;
                  languages?:
                    | Array<{ language: string; level: string }>
                    | string[];
                  cvUrl?: string;
                  rates?: Array<{
                    rate: number;
                    description?: string;
                    paymentType: string;
                    otherSpecification?: string;
                  }>;
                  workExperience?: WorkExperienceEntry[];
                  certifications?: CertificationEntry[];
                  education?: EducationEntry[];
                  projects?: ProjectEntry[];
                  skills?: Array<{ name: string; yearsExperience: number }>;
                }
              | null
              | undefined;

            const hourlyRate = links?.hourlyRate?.toString() || "";

            // Load languages with levels
            let languages: LanguageEntry[] = [];
            if (links?.languages) {
              if (
                Array.isArray(links.languages) &&
                links.languages.length > 0
              ) {
                if (typeof links.languages[0] === "string") {
                  // Old format: array of strings
                  languages = (links.languages as string[]).map((lang) => ({
                    language: lang,
                    level: "INTERMEDIATE" as const,
                  }));
                } else {
                  // New format: array of objects
                  languages = (
                    links.languages as Array<{
                      language: string;
                      level: string;
                    }>
                  ).map((l) => ({
                    language: l.language,
                    level: (l.level ||
                      "INTERMEDIATE") as LanguageEntry["level"],
                  }));
                }
              }
            }

            // Load skills with years of experience
            let skills: SkillEntry[] = [];
            if (links?.skills && Array.isArray(links.skills)) {
              skills = links.skills.map((s: any) => ({
                name: s.name || s,
                yearsExperience: (s.yearsExperience || "").toString(),
              }));
            } else if (data.user?.skills && data.user.skills.length > 0) {
              // Fallback to user.skills
              skills = data.user.skills.map((s: any) => ({
                name: s.skill?.name || s.name || s,
                yearsExperience: (s.yearsExp || "").toString(),
              }));
            } else if (
              profile.skillsSummary &&
              profile.skillsSummary.length > 0
            ) {
              // Fallback to skillsSummary
              skills = profile.skillsSummary.map((s: string) => ({
                name: s,
                yearsExperience: "",
              }));
            }

            // Load rates - prioritize rates array, fallback to hourlyRate, or default
            let rates: RateEntry[] = [];
            if (links?.rates && links.rates.length > 0) {
              rates = links.rates.map((r, index) => ({
                id: `${Date.now()}_${index}`,
                rate: r.rate.toString(),
                description: r.description || "",
                paymentType: (r.paymentType ||
                  "HOUR") as RateEntry["paymentType"],
                otherSpecification: r.otherSpecification || "",
              }));
            } else if (hourlyRate) {
              rates = [
                {
                  id: Date.now().toString(),
                  rate: hourlyRate,
                  description: "",
                  paymentType: "HOUR" as const,
                  otherSpecification: "",
                },
              ];
            } else {
              rates = [
                {
                  id: Date.now().toString(),
                  rate: "",
                  description: "",
                  paymentType: "HOUR" as const,
                  otherSpecification: "",
                },
              ];
            }

            // Load work experience
            const workExperience: WorkExperienceEntry[] =
              links?.workExperience?.map((we: any, index: number) => ({
                id: we.id || `${Date.now()}_we_${index}`,
                company: we.company || "",
                fromDate: we.fromDate || "",
                toDate: we.toDate || "",
                isCurrent: we.isCurrent || false,
                category: we.category || "",
                years: we.years || "",
                description: we.description || "",
              })) || [];

            // Load certifications
            const certifications: CertificationEntry[] =
              links?.certifications?.map((c: any, index: number) => ({
                id: c.id || `${Date.now()}_cert_${index}`,
                title: c.title || "",
                institution: c.institution || "",
                graduationDate: c.graduationDate || "",
                isStillStudying: c.isStillStudying || false,
                certificateUri: c.certificateUri || null,
                certificateName: c.certificateName || null,
              })) || [];

            // Load education
            const education: EducationEntry[] =
              links?.education?.map((e: any, index: number) => ({
                id: e.id || `${Date.now()}_edu_${index}`,
                title: e.title || "",
                institution: e.institution || "",
                graduationDate: e.graduationDate || "",
                isStillStudying: e.isStillStudying || false,
                certificateUri: e.certificateUri || null,
                certificateName: e.certificateName || null,
              })) || [];

            // Load projects
            const projects: ProjectEntry[] =
              links?.projects?.map((p: any, index: number) => ({
                id: p.id || `${Date.now()}_proj_${index}`,
                title: p.title || "",
                description: p.description || "",
                url: p.url || "",
              })) || [];

            setFormData({
              aboutMe: bio,
              rates: rates,
              languages: languages,
              skills: skills,
              workExperience: workExperience,
              certifications: certifications,
              education: education,
              projects: projects,
            });
          }
        }
      } catch (error) {
        console.log("Error loading profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  // temporary lists
  const availableLanguages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Dutch",
    "Russian",
    "Chinese",
    "Japanese",
    "Korean",
    "Arabic",
    "Hindi",
    "Turkish",
    "Polish",
    "Greek",
    "Swedish",
    "Norwegian",
    "Danish",
    "Finnish",
    "Czech",
    "Hungarian",
    "Romanian",
    "Bulgarian",
    "Hebrew",
    "Thai",
    "Vietnamese",
    "Indonesian",
    "Malay",
    "Tagalog",
    "Swahili",
    "Afrikaans",
  ];
  // Store skill keys, translate when displaying
  const availableSkills = [
    "plumbing",
    "electrical",
    "cleaning",
    "carpentry",
    "painting",
    "gardening",
    "moving",
    "assembly",
  ];

  // Helper function to translate skill names
  const translateSkillName = (skillName: string): string => {
    // If it's a known key, translate it
    if (availableSkills.includes(skillName)) {
      if (skillName === "assembly") {
        const assemblyTranslated = t("onboarding.assembly");
        return assemblyTranslated !== "onboarding.assembly"
          ? assemblyTranslated
          : "Assembly";
      }
      const translationKey = `jobs.category.${skillName}`;
      const translated = t(translationKey);
      // If translation returns the key itself, it means translation failed - return capitalized skill name
      return translated !== translationKey
        ? translated
        : skillName.charAt(0).toUpperCase() + skillName.slice(1);
    }
    // If it looks like a translation key, try to translate it
    if (skillName.startsWith("jobs.category.")) {
      const key = skillName.replace("jobs.category.", "");
      const translationKey = `jobs.category.${key}`;
      const translated = t(translationKey);
      return translated !== translationKey
        ? translated
        : key.charAt(0).toUpperCase() + key.slice(1);
    }
    // Otherwise, return as is (for custom skills or already translated)
    return skillName;
  };

  // Custom skill modal state
  const [showCustomSkillModal, setShowCustomSkillModal] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState("");

  // Language management
  const handleAddLanguage = () => {
    if (!selectedLanguageForAdd || !selectedLanguageLevel) return;

    // Check if language already exists
    const exists = formData.languages.find(
      (l) => l.language === selectedLanguageForAdd,
    );
    if (exists) {
      Alert.alert(
        t("onboarding.languageAlreadyAdded"),
        t("onboarding.languageAlreadyInList"),
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      languages: [
        ...prev.languages,
        { language: selectedLanguageForAdd, level: selectedLanguageLevel },
      ],
    }));

    // Reset form
    setSelectedLanguageForAdd(null);
    setSelectedLanguageLevel(null);
    setShowLanguageSelectModal(false);
  };

  const removeLanguage = (language: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l.language !== language),
    }));
  };

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguageForAdd(language);
    setShowLanguageSelectModal(false);
  };

  const handleLanguageLevelSelect = (level: LanguageEntry["level"]) => {
    setSelectedLanguageLevel(level);
    setShowLanguageLevelModal(null);
  };

  // Skill management
  const handleAddSkill = (skillName: string) => {
    if (skillName === t("onboarding.other")) {
      setShowCustomSkillModal(true);
      setShowSkillSelectModal(false);
      return;
    }

    // Check if skill already exists
    const exists = formData.skills.find((s) => s.name === skillName);
    if (exists) {
      Alert.alert(
        t("onboarding.skillAlreadyAdded"),
        t("onboarding.skillAlreadyInList"),
      );
      setShowSkillSelectModal(false);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: skillName, yearsExperience: "" }],
    }));
    setShowSkillSelectModal(false);
  };

  const removeSkill = (skillName: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.name !== skillName),
    }));
  };

  const updateSkillYears = (skillName: string, years: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.map((s) =>
        s.name === skillName ? { ...s, yearsExperience: years } : s,
      ),
    }));
  };

  // Work Experience management
  const addWorkExperience = () => {
    setFormData((prev) => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        {
          id: Date.now().toString(),
          company: "",
          fromDate: "",
          toDate: "",
          isCurrent: false,
          category: "",
          years: "",
          description: "",
        },
      ],
    }));
  };

  const removeWorkExperience = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      workExperience: prev.workExperience.filter((we) => we.id !== id),
    }));
  };

  const updateWorkExperience = (
    id: string,
    field: keyof WorkExperienceEntry,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      workExperience: prev.workExperience.map((we) =>
        we.id === id ? { ...we, [field]: value } : we,
      ),
    }));
  };

  // Certification management
  const addCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          id: Date.now().toString(),
          title: "",
          institution: "",
          graduationDate: "",
          isStillStudying: false,
          certificateUri: null,
          certificateName: null,
        },
      ],
    }));
  };

  const removeCertification = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((c) => c.id !== id),
    }));
  };

  const updateCertification = (
    id: string,
    field: keyof CertificationEntry,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      ),
    }));
  };

  // Education management (same as certification)
  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: Date.now().toString(),
          title: "",
          institution: "",
          graduationDate: "",
          isStillStudying: false,
          certificateUri: null,
          certificateName: null,
        },
      ],
    }));
  };

  const removeEducation = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  };

  const updateEducation = (
    id: string,
    field: keyof EducationEntry,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    }));
  };

  // Project management
  const addProject = () => {
    setFormData((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          id: Date.now().toString(),
          title: "",
          description: "",
          url: "",
        },
      ],
    }));
  };

  const removeProject = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }));
  };

  const updateProject = (
    id: string,
    field: keyof ProjectEntry,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      ),
    }));
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (!trimmed) {
      Alert.alert(t("common.error"), t("onboarding.enterSkillName"));
      return;
    }
    // Add custom skill to the list with empty years
    setFormData((prev) => {
      if (prev.skills.find((s) => s.name === trimmed)) {
        Alert.alert(t("common.info"), t("onboarding.skillAlreadyAdded"));
        return prev;
      }
      return {
        ...prev,
        skills: [...prev.skills, { name: trimmed, yearsExperience: "" }],
      };
    });
    setCustomSkillInput("");
    setShowCustomSkillModal(false);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        setFormData((prev) => ({
          ...prev,
          cvName: result.assets![0].name,
          cvUri: result.assets![0].uri,
        }));
      }
    } catch (err) {
      console.log("Doc picker error", err);
    }
  };

  const addRateEntry = () => {
    setFormData((prev) => ({
      ...prev,
      rates: [
        ...prev.rates,
        {
          id: Date.now().toString(),
          rate: "",
          description: "",
          paymentType: "HOUR" as const,
          otherSpecification: "",
        },
      ],
    }));
  };

  const removeRateEntry = (id: string) => {
    if (formData.rates.length === 1) {
      Alert.alert(
        t("onboarding.cannotRemove"),
        t("onboarding.mustHaveOneRate"),
      );
      return;
    }
    setFormData((prev) => ({
      ...prev,
      rates: prev.rates.filter((rate) => rate.id !== id),
    }));
  };

  const updateRateEntry = (
    id: string,
    field: keyof RateEntry,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      rates: prev.rates.map((rate) =>
        rate.id === id ? { ...rate, [field]: value } : rate,
      ),
    }));
  };

  const handlePaymentTypeSelect = (
    rateId: string,
    paymentType: RateEntry["paymentType"],
  ) => {
    updateRateEntry(rateId, "paymentType", paymentType);
    setShowPaymentTypeModal(null);

    if (paymentType === "OTHER") {
      setShowOtherInputModal(rateId);
      setOtherInputValue("");
    } else {
      updateRateEntry(rateId, "otherSpecification", "");
    }
  };

  const handleSubmit = async () => {
    // Validate rates
    const validRates = formData.rates.filter((rate) => {
      if (!rate.rate || parseFloat(rate.rate) <= 0) return false;
      if (rate.paymentType === "OTHER" && !rate.otherSpecification?.trim())
        return false;
      return true;
    });

    // Validate skills - at least one skill with years of experience
    const validSkills = formData.skills.filter((skill) => {
      const years = parseFloat(skill.yearsExperience);
      return skill.name.trim() && !isNaN(years) && years > 0;
    });

    // Check for missing required fields
    const missingFields: string[] = [];
    if (!formData.aboutMe?.trim()) missingFields.push(t("onboarding.aboutMe"));
    if (formData.skills.length === 0)
      missingFields.push(t("onboarding.atLeastOneSkill"));
    if (validSkills.length === 0 && formData.skills.length > 0)
      missingFields.push(t("onboarding.yearsOfExperienceForSkills"));
    if (validRates.length === 0)
      missingFields.push(t("onboarding.atLeastOneValidRate"));

    if (missingFields.length > 0) {
      Alert.alert(
        t("onboarding.missingInformation"),
        t("onboarding.fillRequiredFields", {
          fields: missingFields.join("\n• "),
        }),
      );
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(t("common.error"), t("onboarding.notLoggedIn"));
        setLoading(false);
        return;
      }

      const base = getApiBase();
      const url = `${base}/profiles/onboarding`;

      // Calculate average years experience from skills for backward compatibility
      const avgYearsExp =
        validSkills.length > 0
          ? Math.round(
              validSkills.reduce(
                (sum, s) => sum + (parseFloat(s.yearsExperience) || 0),
                0,
              ) / validSkills.length,
            )
          : 0;

      const body = {
        aboutMe: formData.aboutMe,
        hourlyRate: parseFloat(validRates[0].rate), // For backward compatibility
        yearsExperience: avgYearsExp, // Calculated from skills
        languages: formData.languages.map((l) => ({
          language: l.language,
          level: l.level,
        })),
        skills: validSkills.map((s) => ({
          name: s.name,
          yearsExperience: parseFloat(s.yearsExperience) || 0,
        })),
        workExperience: formData.workExperience,
        certifications: formData.certifications,
        education: formData.education,
        projects: formData.projects,
        rates: validRates.map((rate) => ({
          rate: parseFloat(rate.rate),
          description: rate.description.trim() || undefined,
          paymentType: rate.paymentType,
          otherSpecification:
            rate.paymentType === "OTHER" ? rate.otherSpecification : undefined,
        })),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        Alert.alert(t("common.success"), t("onboarding.profileUpdated"), [
          { text: t("common.ok"), onPress: () => router.back() },
        ]);
      } else {
        const err = await res.json();
        Alert.alert(
          t("common.error"),
          err.message || t("onboarding.failedToUpdateProfile"),
        );
      }
    } catch (error) {
      console.log("Onboarding error", error);
      Alert.alert(t("common.error"), t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            {
              backgroundColor:
                step <= activeStep
                  ? colors.tint
                  : isDark
                    ? "#5C5548"
                    : "#E8D8B8",
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
        <View style={styles.header}>
          <TouchableButton onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableButton>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("onboarding.professionalProfile")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingProfile ? (
          <View
            style={[
              styles.loadingContainer,
              { flex: 1, justifyContent: "center", alignItems: "center" },
            ]}
          >
            <ActivityIndicator size="large" color={colors.tint} />
            <Text
              style={[
                styles.loadingText,
                { color: colors.text, marginTop: 16 },
              ]}
            >
              {t("onboarding.loadingProfile")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.introText, { color: colors.text }]}>
              {t("onboarding.completeProfileDescription")}
            </Text>

            <View
              style={[
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.80)"
                    : "#FFFAF0",
                  borderRadius: 4,
                  padding: 20,
                  marginBottom: 20,
                  borderWidth: 1.5,
                  borderColor: isDark ? "rgba(255, 250, 240, 0.12)" : "#F0E8D5",
                  shadowColor: isDark ? "#000" : "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.3 : 0.08,
                  shadowRadius: 12,
                  elevation: 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                    marginBottom: 12,
                    fontSize: 18,
                    fontWeight: "700",
                  },
                ]}
              >
                {t("onboarding.aboutMe")}
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark
                      ? "rgba(15, 23, 42, 0.5)"
                      : "#FFF8F0",
                    color: colors.text,
                    borderColor: isDark ? "rgba(255,250,240,0.12)" : "#F0E8D5",
                    borderWidth: 1.5,
                    borderRadius: 4,
                    padding: 16,
                    minHeight: 120,
                  },
                ]}
                placeholder={t("onboarding.tellUsAboutExperience")}
                placeholderTextColor={isDark ? "#8A7B68" : "#94a3af"}
                multiline
                numberOfLines={4}
                value={formData.aboutMe}
                onChangeText={(t) =>
                  setFormData((prev) => ({ ...prev, aboutMe: t }))
                }
              />
            </View>

            {/* Dynamic Rate Entries - Each in its own card */}
            {formData.rates.map((rateEntry, index) => (
              <View
                key={rateEntry.id}
                style={[
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.80)"
                      : "#FFFAF0",
                    borderRadius: 4,
                    padding: 20,
                    marginBottom: 16,
                    borderWidth: 1.5,
                    borderColor: isDark
                      ? "rgba(255, 250, 240, 0.12)"
                      : "#F0E8D5",
                    shadowColor: isDark ? "#000" : "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.3 : 0.08,
                    shadowRadius: 12,
                    elevation: 0,
                  },
                ]}
              >
                {/* Card Header with Remove Button */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("onboarding.rate")} {index + 1}
                  </Text>
                  {formData.rates.length > 1 && (
                    <TouchableButton
                      onPress={() => removeRateEntry(rateEntry.id)}
                      style={{
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#fee2e2",
                        borderRadius: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Feather name="trash-2" size={14} color="#ef4444" />
                      <Text
                        style={{
                          color: "#ef4444",
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {t("onboarding.removeRate")}
                      </Text>
                    </TouchableButton>
                  )}
                </View>

                {/* Rate Input */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("onboarding.rate")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(15, 23, 42, 0.5)"
                          : "#FFF8F0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        borderRadius: 4,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        fontSize: 16,
                      },
                    ]}
                    placeholder={t("onboarding.ratePlaceholder")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#94a3af"}
                    keyboardType="numeric"
                    value={rateEntry.rate}
                    onChangeText={(t) =>
                      updateRateEntry(rateEntry.id, "rate", t)
                    }
                  />
                </View>

                {/* Description Input */}
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("onboarding.rateDescription")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(15, 23, 42, 0.5)"
                          : "#FFF8F0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        borderRadius: 4,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        fontSize: 16,
                      },
                    ]}
                    placeholder={t("onboarding.rateDescriptionPlaceholder")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#94a3af"}
                    value={rateEntry.description}
                    onChangeText={(t) =>
                      updateRateEntry(rateEntry.id, "description", t)
                    }
                  />
                </View>

                {/* Payment Type Dropdown */}
                <View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {t("onboarding.paymentType")}
                  </Text>
                  <TouchableButton
                    onPress={() => setShowPaymentTypeModal(rateEntry.id)}
                    style={[
                      styles.dropdownButton,
                      {
                        backgroundColor: isDark
                          ? "rgba(15, 23, 42, 0.5)"
                          : "#FFF8F0",
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        borderRadius: 4,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        paddingRight: 12,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        {
                          color: colors.text,
                          flex: 1,
                          marginRight: 8,
                          fontSize: 16,
                          fontWeight: "500",
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {rateEntry.paymentType === "OTHER" &&
                      rateEntry.otherSpecification
                        ? rateEntry.otherSpecification
                        : rateEntry.paymentType === "HOUR"
                          ? t("onboarding.hour")
                          : rateEntry.paymentType === "DAY"
                            ? t("common.day")
                            : rateEntry.paymentType === "WEEK"
                              ? t("applications.week")
                              : rateEntry.paymentType === "MONTH"
                                ? t("applications.month")
                                : t("onboarding.other")}
                    </Text>
                    <Feather
                      name="chevron-down"
                      size={18}
                      color={isDark ? "#B8A88A" : "#8A7B68"}
                    />
                  </TouchableButton>
                </View>
              </View>
            ))}

            {/* Add Another Rate Button */}
            <TouchableButton
              onPress={addRateEntry}
              style={[
                styles.addRateButton,
                {
                  backgroundColor: isDark
                    ? "rgba(201, 150, 63, 0.5)"
                    : "#D4A24E",
                  borderColor: isDark ? "rgba(201, 150, 63, 0.8)" : "#E8B86D",
                  borderWidth: 2,
                  borderStyle: "dashed",
                  shadowColor: isDark ? "#C9963F" : "#C9963F",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 0,
                  marginBottom: 24,
                },
              ]}
            >
              <Feather
                name="plus"
                size={22}
                color={isDark ? "#F0E8D5" : "#C9963F"}
              />
              <Text
                style={[
                  styles.addRateText,
                  {
                    color: isDark ? "#F0E8D5" : "#C9963F",
                    fontWeight: "700",
                    fontSize: 16,
                  },
                ]}
              >
                {t("onboarding.addAnotherRate")}
              </Text>
            </TouchableButton>

            {/* Languages Section with Form */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.75)"
                    : "#FFFAF0",
                  borderWidth: 1.5,
                  borderColor: isDark ? "rgba(255,250,240,0.15)" : "#F0E8D5",
                  shadowColor: isDark ? "#000" : "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.3 : 0.05,
                  shadowRadius: 8,
                  elevation: 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                    marginBottom: 16,
                    fontSize: 18,
                    fontWeight: "700",
                  },
                ]}
              >
                {t("onboarding.languages")}
              </Text>

              {/* Add Language Form */}
              <View
                style={[
                  styles.addLanguageForm,
                  {
                    backgroundColor: isDark
                      ? "rgba(15, 23, 42, 0.3)"
                      : "#FFF8F0",
                    borderColor: isDark ? "rgba(201,150,63,0.12)" : "#F0E8D5",
                    borderWidth: 1.5,
                    borderRadius: 4,
                    padding: 16,
                    marginBottom: 16,
                  },
                ]}
              >
                <View style={styles.rowContainer}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark ? "#B8A88A" : "#8A7B68",
                          marginBottom: 8,
                        },
                      ]}
                    >
                      {t("onboarding.selectLanguage")}
                    </Text>
                    <TouchableButton
                      onPress={() => setShowLanguageSelectModal(true)}
                      style={[
                        styles.dropdownButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.80)"
                            : "#FFFAF0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "#F0E8D5",
                          borderWidth: 1.5,
                          paddingRight: 12,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          {
                            color: selectedLanguageForAdd
                              ? colors.text
                              : isDark
                                ? "#9A8E7A"
                                : "#9A8E7A",
                            fontWeight: "500",
                            flex: 1,
                            marginRight: 8,
                          },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {selectedLanguageForAdd ||
                          t("onboarding.chooseLanguage")}
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={18}
                        color={isDark ? "#B8A88A" : "#8A7B68"}
                      />
                    </TouchableButton>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[
                        styles.inputLabel,
                        {
                          color: isDark ? "#B8A88A" : "#8A7B68",
                          marginBottom: 8,
                        },
                      ]}
                    >
                      {t("onboarding.level")}
                    </Text>
                    <TouchableButton
                      onPress={() => setShowLanguageLevelModal("new")}
                      style={[
                        styles.dropdownButton,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.80)"
                            : "#FFFAF0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "#F0E8D5",
                          borderWidth: 1.5,
                          paddingRight: 12,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          {
                            color: selectedLanguageLevel
                              ? colors.text
                              : isDark
                                ? "#9A8E7A"
                                : "#9A8E7A",
                            fontWeight: "500",
                            flex: 1,
                            marginRight: 8,
                          },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {selectedLanguageLevel
                          ? t(
                              `onboarding.languageLevel.${selectedLanguageLevel.toLowerCase()}`,
                            )
                          : t("onboarding.chooseLevel")}
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={18}
                        color={isDark ? "#B8A88A" : "#8A7B68"}
                      />
                    </TouchableButton>
                  </View>
                </View>
                <TouchableButton
                  onPress={handleAddLanguage}
                  style={[
                    styles.addLanguageButton,
                    {
                      backgroundColor:
                        !selectedLanguageForAdd || !selectedLanguageLevel
                          ? isDark
                            ? "rgba(201, 150, 63, 0.25)"
                            : "#D4A24E"
                          : isDark
                            ? "#C9963F"
                            : "#C9963F",
                      marginTop: 16,
                      opacity:
                        !selectedLanguageForAdd || !selectedLanguageLevel
                          ? 0.5
                          : 1,
                      shadowColor:
                        !selectedLanguageForAdd || !selectedLanguageLevel
                          ? "transparent"
                          : isDark
                            ? "#C9963F"
                            : "#C9963F",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 0,
                    },
                  ]}
                  disabled={!selectedLanguageForAdd || !selectedLanguageLevel}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color="#FFFAF0"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.addLanguageButtonText,
                      { color: "#FFFAF0", fontWeight: "700", fontSize: 15 },
                    ]}
                  >
                    {t("onboarding.addLanguage")}
                  </Text>
                </TouchableButton>
              </View>

              {/* Added Languages List */}
              {formData.languages.length > 0 && (
                <View style={styles.languagesList}>
                  {formData.languages.map((langEntry, index) => (
                    <View
                      key={index}
                      style={[
                        styles.languageListItem,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.55)"
                            : "#FFF8F0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "#F0E8D5",
                          borderWidth: 1.5,
                          borderRadius: 4,
                          padding: 14,
                          marginBottom:
                            index < formData.languages.length - 1 ? 12 : 0,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.languageListItemName,
                            { color: colors.text, fontWeight: "700" },
                          ]}
                        >
                          {t(
                            `onboarding.language.${langEntry.language.toLowerCase()}`,
                          )}
                        </Text>
                        <Text
                          style={[
                            styles.languageListItemLevel,
                            { color: isDark ? "#E8B86D" : "#B8822A" },
                          ]}
                        >
                          {t(
                            `onboarding.languageLevel.${langEntry.level.toLowerCase()}`,
                          )}
                        </Text>
                      </View>
                      <TouchableButton
                        onPress={() => removeLanguage(langEntry.language)}
                        style={[
                          styles.removeLanguageButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(239, 68, 68, 0.15)"
                              : "#fee2e2",
                            borderRadius: 8,
                            padding: 10,
                            minWidth: 40,
                            minHeight: 40,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Professional Skills Section with Dropdown and List */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.75)"
                    : "#FFFAF0",
                  borderWidth: 1.5,
                  borderColor: isDark ? "rgba(255,250,240,0.15)" : "#F0E8D5",
                  shadowColor: isDark ? "#000" : "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.4 : 0.05,
                  shadowRadius: 8,
                  elevation: 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                    marginBottom: 16,
                    fontSize: 18,
                    fontWeight: "700",
                  },
                ]}
              >
                {t("onboarding.professionalSkills")}
              </Text>

              {/* Skill Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: isDark ? "#B8A88A" : "#8A7B68", marginBottom: 8 },
                  ]}
                >
                  {t("onboarding.selectSkill")}
                </Text>
                <TouchableButton
                  onPress={() => setShowSkillSelectModal(true)}
                  style={[
                    styles.dropdownButton,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.80)"
                        : "#FFFAF0",
                      borderColor: isDark
                        ? "rgba(255,250,240,0.15)"
                        : "#F0E8D5",
                      borderWidth: 1.5,
                      paddingRight: 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      {
                        color: isDark ? "#9A8E7A" : "#9A8E7A",
                        fontWeight: "500",
                        flex: 1,
                        marginRight: 8,
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t("onboarding.chooseSkill")}
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={18}
                    color={isDark ? "#B8A88A" : "#8A7B68"}
                  />
                </TouchableButton>
              </View>

              {/* Added Skills List */}
              {formData.skills.length > 0 && (
                <View style={styles.skillsList}>
                  {formData.skills.map((skillEntry, index) => (
                    <View
                      key={index}
                      style={[
                        styles.skillListItem,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.55)"
                            : "#FFF8F0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.15)"
                            : "#F0E8D5",
                          borderWidth: 1.5,
                          borderRadius: 4,
                          padding: 14,
                          marginBottom:
                            index < formData.skills.length - 1 ? 12 : 0,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text
                          style={[
                            styles.skillListItemName,
                            {
                              color: colors.text,
                              fontWeight: "700",
                              marginBottom: 8,
                            },
                          ]}
                        >
                          {translateSkillName(skillEntry.name)}
                        </Text>
                        <TextInput
                          style={[
                            styles.skillYearsInputList,
                            {
                              backgroundColor: isDark
                                ? "rgba(12, 22, 42, 0.65)"
                                : "#FFFAF0",
                              borderColor: isDark
                                ? "rgba(201, 150, 63, 0.4)"
                                : "#D4A24E",
                              borderWidth: 1.5,
                              color: colors.text,
                            },
                          ]}
                          placeholder={t("onboarding.years")}
                          placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                          keyboardType="numeric"
                          value={skillEntry.yearsExperience}
                          onChangeText={(t) =>
                            updateSkillYears(skillEntry.name, t)
                          }
                        />
                      </View>
                      <TouchableButton
                        onPress={() => removeSkill(skillEntry.name)}
                        style={[
                          styles.removeSkillButton,
                          {
                            backgroundColor: isDark
                              ? "rgba(239, 68, 68, 0.15)"
                              : "#fee2e2",
                            borderRadius: 8,
                            padding: 10,
                            minWidth: 40,
                            minHeight: 40,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Work Experience Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.65)"
                    : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.label, { color: colors.text }]}>
                {t("onboarding.workExperience")}
              </Text>
              {formData.workExperience.map((exp, index) => (
                <View
                  key={exp.id}
                  style={[
                    styles.workExpCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "#f9fafb",
                      borderColor: isDark ? "rgba(201,150,63,0.12)" : "#E8D8B8",
                      marginBottom:
                        index < formData.workExperience.length - 1 ? 12 : 0,
                    },
                  ]}
                >
                  <View style={styles.workExpHeader}>
                    <Text style={[styles.workExpTitle, { color: colors.text }]}>
                      {t("onboarding.experience")} #{index + 1}
                    </Text>
                    {formData.workExperience.length > 1 && (
                      <TouchableButton
                        onPress={() => removeWorkExperience(exp.id)}
                        style={styles.removeExpButton}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.companyPlace")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.enterCompanyName")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={exp.company}
                    onChangeText={(t) =>
                      updateWorkExperience(exp.id, "company", t)
                    }
                  />
                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark ? "#B8A88A" : "#8A7B68",
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("onboarding.fromDate")}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.65)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                            borderWidth: 1.5,
                          },
                        ]}
                        placeholder={t("onboarding.datePlaceholder")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        value={exp.fromDate}
                        onChangeText={(t) =>
                          updateWorkExperience(exp.id, "fromDate", t)
                        }
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark ? "#B8A88A" : "#8A7B68",
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("onboarding.toDate")}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.65)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                            borderWidth: 1.5,
                            opacity: exp.isCurrent ? 0.6 : 1,
                          },
                        ]}
                        placeholder={t("onboarding.datePlaceholder")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        value={exp.toDate}
                        onChangeText={(t) =>
                          updateWorkExperience(exp.id, "toDate", t)
                        }
                        editable={!exp.isCurrent}
                      />
                    </View>
                  </View>
                  <View
                    style={[
                      styles.rowContainer,
                      { marginTop: 12, alignItems: "center" },
                    ]}
                  >
                    <TouchableButton
                      onPress={() =>
                        updateWorkExperience(
                          exp.id,
                          "isCurrent",
                          !exp.isCurrent,
                        )
                      }
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: exp.isCurrent
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.12)"
                              : "#f9fafb",
                          borderColor: exp.isCurrent
                            ? isDark
                              ? "#C9963F"
                              : colors.tint
                            : isDark
                              ? "rgba(201,150,63,0.25)"
                              : "#D4C0A0",
                        },
                      ]}
                    >
                      {exp.isCurrent && (
                        <Feather name="check" size={16} color="#FFFAF0" />
                      )}
                    </TouchableButton>
                    <Text
                      style={[styles.checkboxLabel, { color: colors.text }]}
                    >
                      {t("onboarding.currentJob")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                        marginTop: 12,
                      },
                    ]}
                  >
                    {t("onboarding.jobCategory")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.egSoftwareDevelopment")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={exp.category}
                    onChangeText={(t) =>
                      updateWorkExperience(exp.id, "category", t)
                    }
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.yearsOfExperience")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.eg3")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    keyboardType="numeric"
                    value={exp.years}
                    onChangeText={(t) =>
                      updateWorkExperience(exp.id, "years", t)
                    }
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.description")}
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        minHeight: 100,
                      },
                    ]}
                    placeholder={t("onboarding.describeResponsibilities")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    multiline
                    numberOfLines={4}
                    value={exp.description}
                    onChangeText={(t) =>
                      updateWorkExperience(exp.id, "description", t)
                    }
                  />
                </View>
              ))}
              <TouchableButton
                onPress={addWorkExperience}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.15)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark ? "rgba(201, 150, 63, 0.4)" : "#D4A24E",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isDark ? "#E8B86D" : "#B8822A"}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    {
                      color: isDark ? "#E8B86D" : "#B8822A",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("onboarding.addWorkExperience")}
                </Text>
              </TouchableButton>
            </View>

            {/* Certifications Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.65)"
                    : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.label, { color: colors.text }]}>
                {t("onboarding.certifications")}
              </Text>
              {formData.certifications.map((cert, index) => (
                <View
                  key={cert.id}
                  style={[
                    styles.certCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "#f9fafb",
                      borderColor: isDark ? "rgba(201,150,63,0.12)" : "#E8D8B8",
                      marginBottom:
                        index < formData.certifications.length - 1 ? 12 : 0,
                    },
                  ]}
                >
                  <View style={styles.certHeader}>
                    <Text style={[styles.certTitle, { color: colors.text }]}>
                      {t("onboarding.certification")} #{index + 1}
                    </Text>
                    {formData.certifications.length > 1 && (
                      <TouchableButton
                        onPress={() => removeCertification(cert.id)}
                        style={styles.removeCertButton}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.title")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.egBscComputerScience")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={cert.title}
                    onChangeText={(t) =>
                      updateCertification(cert.id, "title", t)
                    }
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.institution")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.egUniversityOfLondon")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={cert.institution}
                    onChangeText={(t) =>
                      updateCertification(cert.id, "institution", t)
                    }
                  />
                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark ? "#B8A88A" : "#8A7B68",
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("onboarding.graduationDate")}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.65)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                            borderWidth: 1.5,
                            opacity: cert.isStillStudying ? 0.6 : 1,
                          },
                        ]}
                        placeholder={t("onboarding.datePlaceholder")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        value={cert.graduationDate}
                        onChangeText={(t) =>
                          updateCertification(cert.id, "graduationDate", t)
                        }
                        editable={!cert.isStillStudying}
                      />
                    </View>
                    <View
                      style={[
                        styles.rowContainer,
                        { flex: 1, marginLeft: 8, alignItems: "center" },
                      ]}
                    >
                      <TouchableButton
                        onPress={() =>
                          updateCertification(
                            cert.id,
                            "isStillStudying",
                            !cert.isStillStudying,
                          )
                        }
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: cert.isStillStudying
                              ? isDark
                                ? "#C9963F"
                                : colors.tint
                              : isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#f9fafb",
                            borderColor: cert.isStillStudying
                              ? isDark
                                ? "#C9963F"
                                : colors.tint
                              : isDark
                                ? "rgba(201,150,63,0.25)"
                                : "#D4C0A0",
                          },
                        ]}
                      >
                        {cert.isStillStudying && (
                          <Feather name="check" size={16} color="#FFFAF0" />
                        )}
                      </TouchableButton>
                      <Text
                        style={[styles.checkboxLabel, { color: colors.text }]}
                      >
                        {t("onboarding.stillStudying")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <TouchableButton
                onPress={addCertification}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.15)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark ? "rgba(201, 150, 63, 0.4)" : "#D4A24E",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isDark ? "#E8B86D" : "#B8822A"}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    {
                      color: isDark ? "#E8B86D" : "#B8822A",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("onboarding.addCertification")}
                </Text>
              </TouchableButton>
            </View>

            {/* Education Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.65)"
                    : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.label, { color: colors.text }]}>
                {t("onboarding.education")}
              </Text>
              {formData.education.map((edu, index) => (
                <View
                  key={edu.id}
                  style={[
                    styles.certCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "#f9fafb",
                      borderColor: isDark ? "rgba(201,150,63,0.12)" : "#E8D8B8",
                      marginBottom:
                        index < formData.education.length - 1 ? 12 : 0,
                    },
                  ]}
                >
                  <View style={styles.certHeader}>
                    <Text style={[styles.certTitle, { color: colors.text }]}>
                      {t("onboarding.education")} #{index + 1}
                    </Text>
                    {formData.education.length > 1 && (
                      <TouchableButton
                        onPress={() => removeEducation(edu.id)}
                        style={styles.removeCertButton}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.degreeTitle")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.egBscComputerScience")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={edu.title}
                    onChangeText={(t) => updateEducation(edu.id, "title", t)}
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.institution")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.egUniversityOfLondon")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={edu.institution}
                    onChangeText={(t) =>
                      updateEducation(edu.id, "institution", t)
                    }
                  />
                  <View style={styles.rowContainer}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            color: isDark ? "#B8A88A" : "#8A7B68",
                            marginBottom: 8,
                          },
                        ]}
                      >
                        {t("onboarding.graduationDate")}
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.65)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                            borderWidth: 1.5,
                            opacity: edu.isStillStudying ? 0.6 : 1,
                          },
                        ]}
                        placeholder={t("onboarding.datePlaceholder")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        value={edu.graduationDate}
                        onChangeText={(t) =>
                          updateEducation(edu.id, "graduationDate", t)
                        }
                        editable={!edu.isStillStudying}
                      />
                    </View>
                    <View
                      style={[
                        styles.rowContainer,
                        { flex: 1, marginLeft: 8, alignItems: "center" },
                      ]}
                    >
                      <TouchableButton
                        onPress={() =>
                          updateEducation(
                            edu.id,
                            "isStillStudying",
                            !edu.isStillStudying,
                          )
                        }
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: edu.isStillStudying
                              ? isDark
                                ? "#C9963F"
                                : colors.tint
                              : isDark
                                ? "rgba(201,150,63,0.12)"
                                : "#f9fafb",
                            borderColor: edu.isStillStudying
                              ? isDark
                                ? "#C9963F"
                                : colors.tint
                              : isDark
                                ? "rgba(201,150,63,0.25)"
                                : "#D4C0A0",
                          },
                        ]}
                      >
                        {edu.isStillStudying && (
                          <Feather name="check" size={16} color="#FFFAF0" />
                        )}
                      </TouchableButton>
                      <Text
                        style={[styles.checkboxLabel, { color: colors.text }]}
                      >
                        {t("onboarding.stillStudying")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <TouchableButton
                onPress={addEducation}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.15)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark ? "rgba(201, 150, 63, 0.4)" : "#D4A24E",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isDark ? "#E8B86D" : "#B8822A"}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    {
                      color: isDark ? "#E8B86D" : "#B8822A",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("onboarding.addEducation")}
                </Text>
              </TouchableButton>
            </View>

            {/* Projects Section */}
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark
                    ? "rgba(12, 22, 42, 0.65)"
                    : "#FFFAF0",
                },
              ]}
            >
              <Text style={[styles.label, { color: colors.text }]}>
                {t("onboarding.projects")}
              </Text>
              {formData.projects.map((project, index) => (
                <View
                  key={project.id}
                  style={[
                    styles.projectCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(12, 22, 42, 0.55)"
                        : "#f9fafb",
                      borderColor: isDark ? "rgba(201,150,63,0.12)" : "#E8D8B8",
                      marginBottom:
                        index < formData.projects.length - 1 ? 12 : 0,
                    },
                  ]}
                >
                  <View style={styles.projectHeader}>
                    <Text style={[styles.projectTitle, { color: colors.text }]}>
                      {t("onboarding.project")} #{index + 1}
                    </Text>
                    {formData.projects.length > 1 && (
                      <TouchableButton
                        onPress={() => removeProject(project.id)}
                        style={styles.removeProjectButton}
                      >
                        <Feather name="x" size={18} color="#ef4444" />
                      </TouchableButton>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.projectTitle")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                      },
                    ]}
                    placeholder={t("onboarding.enterProjectTitle")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={project.title}
                    onChangeText={(t) => updateProject(project.id, "title", t)}
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.description")}
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                        marginBottom: 12,
                        minHeight: 100,
                      },
                    ]}
                    placeholder={t("onboarding.describeProject")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    multiline
                    numberOfLines={4}
                    value={project.description}
                    onChangeText={(t) =>
                      updateProject(project.id, "description", t)
                    }
                  />
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color: isDark ? "#B8A88A" : "#8A7B68",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    {t("onboarding.projectUrlOptional")}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.65)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#F0E8D5",
                        borderWidth: 1.5,
                      },
                    ]}
                    placeholder={t("onboarding.projectUrlPlaceholder")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    value={project.url}
                    onChangeText={(t) => updateProject(project.id, "url", t)}
                  />
                </View>
              ))}
              <TouchableButton
                onPress={addProject}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.15)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark ? "rgba(201, 150, 63, 0.4)" : "#D4A24E",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isDark ? "#E8B86D" : "#B8822A"}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    {
                      color: isDark ? "#E8B86D" : "#B8822A",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("onboarding.addProject")}
                </Text>
              </TouchableButton>
            </View>

            <TouchableButton
              style={[
                styles.submitBtn,
                {
                  backgroundColor: isDark ? "#C9963F" : colors.tint,
                  borderColor: isDark ? "#C9963F" : colors.tint,
                  borderWidth: 1,
                },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? t("onboarding.saving") : t("onboarding.saveProfile")}
              </Text>
            </TouchableButton>
          </ScrollView>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageSelectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageSelectModal(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
                maxHeight: "80%",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.selectLanguage")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowLanguageSelectModal(false)}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 500 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {availableLanguages
                .filter(
                  (lang) =>
                    !formData.languages.find((l) => l.language === lang),
                )
                .map((lang) => {
                  const isSelected = selectedLanguageForAdd === lang;
                  return (
                    <TouchableButton
                      key={lang}
                      onPress={() => {
                        setSelectedLanguageForAdd(lang);
                        setShowLanguageSelectModal(false);
                      }}
                      style={[
                        styles.paymentTypeOption,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? "rgba(201, 150, 63, 0.2)"
                              : "rgba(255,250,240,0.92)"
                            : isDark
                              ? "rgba(255,250,240,0.10)"
                              : "#FFF8F0",
                          borderColor: isSelected
                            ? isDark
                              ? "#C9963F"
                              : "#C9963F"
                            : isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#F0E8D5",
                          borderWidth: 1.5,
                          marginBottom: 8,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentTypeText,
                          {
                            color: isSelected
                              ? isDark
                                ? "#E8B86D"
                                : "#C9963F"
                              : colors.text,
                            fontWeight: isSelected ? "600" : "500",
                          },
                        ]}
                      >
                        {t(`onboarding.language.${lang.toLowerCase()}`)}
                      </Text>
                      {isSelected && (
                        <Feather
                          name="check"
                          size={18}
                          color={isDark ? "#E8B86D" : "#B8822A"}
                        />
                      )}
                    </TouchableButton>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Language Level Selection Modal */}
      <Modal
        visible={!!showLanguageLevelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageLevelModal(null)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.selectLanguageLevel")}
              </Text>
              <TouchableOpacity onPress={() => setShowLanguageLevelModal(null)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {[
              "NATIVE",
              "PROFESSIONAL",
              "INTERMEDIATE",
              "ADVANCED",
              "BEGINNER",
            ].map((level) => {
              const langLevel = level as LanguageEntry["level"];
              const isSelected = selectedLanguageLevel === langLevel;

              return (
                <TouchableButton
                  key={level}
                  onPress={() => handleLanguageLevelSelect(langLevel)}
                  style={[
                    styles.paymentTypeOption,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? "#C9963F"
                          : colors.tint
                        : isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#f9fafb",
                      borderColor: isSelected
                        ? isDark
                          ? "#C9963F"
                          : colors.tint
                        : isDark
                          ? "rgba(255,250,240,0.15)"
                          : "#E8D8B8",
                      borderWidth: 1.5,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentTypeText,
                      {
                        color: isSelected ? "#FFFAF0" : colors.text,
                        fontWeight: isSelected ? "600" : "500",
                      },
                    ]}
                  >
                    {t(`onboarding.languageLevel.${level.toLowerCase()}`)}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={20} color="#FFFAF0" />
                  )}
                </TouchableButton>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Payment Type Selection Modal */}
      <Modal
        visible={!!showPaymentTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentTypeModal(null)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.selectPaymentType")}
              </Text>
              <TouchableOpacity onPress={() => setShowPaymentTypeModal(null)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {["HOUR", "DAY", "WEEK", "MONTH", "OTHER"].map((type) => {
              const paymentType = type as RateEntry["paymentType"];
              const currentRate = formData.rates.find(
                (r) => r.id === showPaymentTypeModal,
              );
              const isSelected = currentRate?.paymentType === paymentType;

              return (
                <TouchableButton
                  key={type}
                  onPress={() =>
                    handlePaymentTypeSelect(showPaymentTypeModal!, paymentType)
                  }
                  style={[
                    styles.paymentTypeOption,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? "#C9963F"
                          : colors.tint
                        : isDark
                          ? "rgba(201,150,63,0.12)"
                          : "#f9fafb",
                      borderColor: isSelected
                        ? isDark
                          ? "#C9963F"
                          : colors.tint
                        : isDark
                          ? "rgba(255,250,240,0.15)"
                          : "#E8D8B8",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentTypeText,
                      { color: isSelected ? "#FFFAF0" : colors.text },
                    ]}
                  >
                    {type === "HOUR"
                      ? t("onboarding.hour")
                      : type === "DAY"
                        ? t("common.day")
                        : type === "WEEK"
                          ? t("applications.week")
                          : type === "MONTH"
                            ? t("applications.month")
                            : t("onboarding.other")}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={20} color="#FFFAF0" />
                  )}
                </TouchableButton>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Other Payment Type Specification Modal */}
      <Modal
        visible={!!showOtherInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowOtherInputModal(null);
          setOtherInputValue("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.specifyPaymentType")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowOtherInputModal(null);
                  setOtherInputValue("");
                }}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: colors.text }]}>
              {t("onboarding.paymentTypeName")}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#f9fafb",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,250,240,0.15)" : "#E8D8B8",
                },
              ]}
              placeholder={t("onboarding.egProjectMilestone")}
              placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
              value={otherInputValue}
              onChangeText={setOtherInputValue}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableButton
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "#F5ECD8",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => {
                  setShowOtherInputModal(null);
                  setOtherInputValue("");
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[
                  styles.modalButton,
                  styles.modalButtonSave,
                  {
                    backgroundColor: isDark ? "#C9963F" : colors.tint,
                    borderColor: isDark ? "#C9963F" : colors.tint,
                  },
                ]}
                onPress={() => {
                  if (showOtherInputModal && otherInputValue.trim()) {
                    updateRateEntry(
                      showOtherInputModal,
                      "otherSpecification",
                      otherInputValue.trim(),
                    );
                    setShowOtherInputModal(null);
                    setOtherInputValue("");
                  }
                }}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFAF0" }]}>
                  {t("common.save")}
                </Text>
              </TouchableButton>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Skill Selection Modal */}
      <Modal
        visible={showSkillSelectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSkillSelectModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
                maxHeight: "80%",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.selectProfessionalSkill")}
              </Text>
              <TouchableOpacity onPress={() => setShowSkillSelectModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 500 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {availableSkills
                .filter(
                  (skill) => !formData.skills.find((s) => s.name === skill),
                )
                .map((skill) => {
                  return (
                    <TouchableButton
                      key={skill}
                      onPress={() => {
                        handleAddSkill(skill);
                        setShowSkillSelectModal(false);
                      }}
                      style={[
                        styles.paymentTypeOption,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,250,240,0.10)"
                            : "#FFF8F0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#F0E8D5",
                          borderWidth: 1.5,
                          marginBottom: 8,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentTypeText,
                          {
                            color: colors.text,
                            fontWeight: "500",
                          },
                        ]}
                      >
                        {translateSkillName(skill)}
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={isDark ? "#9A8E7A" : "#8A7B68"}
                      />
                    </TouchableButton>
                  );
                })}
              <TouchableButton
                onPress={() => {
                  setShowSkillSelectModal(false);
                  setShowCustomSkillModal(true);
                }}
                style={[
                  styles.paymentTypeOption,
                  {
                    backgroundColor: isDark
                      ? "rgba(201, 150, 63, 0.15)"
                      : "rgba(255,250,240,0.92)",
                    borderColor: isDark ? "rgba(201, 150, 63, 0.4)" : "#D4A24E",
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    marginTop: 8,
                  },
                ]}
              >
                <Feather
                  name="plus"
                  size={18}
                  color={isDark ? "#E8B86D" : "#B8822A"}
                />
                <Text
                  style={[
                    styles.paymentTypeText,
                    {
                      color: isDark ? "#E8B86D" : "#B8822A",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {t("onboarding.other")}
                </Text>
              </TouchableButton>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Skill Modal */}
      <Modal
        visible={showCustomSkillModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCustomSkillModal(false);
          setCustomSkillInput("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "rgba(12, 22, 42, 0.90)" : "#FFFAF0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("onboarding.addCustomSkill")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCustomSkillModal(false);
                  setCustomSkillInput("");
                }}
              >
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLabel, { color: colors.text }]}>
              {t("onboarding.skillName")}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#f9fafb",
                  color: colors.text,
                  borderColor: isDark ? "rgba(255,250,240,0.15)" : "#E8D8B8",
                },
              ]}
              placeholder={t("onboarding.egWeldingLandscaping")}
              placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
              value={customSkillInput}
              onChangeText={setCustomSkillInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableButton
                style={[
                  styles.modalButton,
                  styles.modalButtonCancel,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,250,240,0.12)"
                      : "#F5ECD8",
                    borderColor: isDark
                      ? "rgba(201,150,63,0.25)"
                      : "rgba(184,130,42,0.2)",
                  },
                ]}
                onPress={() => {
                  setShowCustomSkillModal(false);
                  setCustomSkillInput("");
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableButton>
              <TouchableButton
                style={[
                  styles.modalButton,
                  styles.modalButtonSave,
                  {
                    backgroundColor: isDark ? "#C9963F" : colors.tint,
                    borderColor: isDark ? "#C9963F" : colors.tint,
                  },
                ]}
                onPress={handleAddCustomSkill}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFAF0" }]}>
                  {t("common.add")}
                </Text>
              </TouchableButton>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: 1.5 },
  backBtn: { padding: 4 },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  introText: { fontSize: 16, marginBottom: 24, paddingHorizontal: 4 },
  section: {
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  inputLabel: {},
  textArea: {
    borderRadius: 4,
    padding: 14,
    borderWidth: 1.5,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 16,
    fontWeight: "500",
  },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  chipText: { fontWeight: "700", fontSize: 14 },
  submitBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
  submitBtnText: { color: "#FFFAF0", fontWeight: "800", fontSize: 16 },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 4,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: { marginTop: 8, fontWeight: "700" },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  },
  fileName: { flex: 1, marginHorizontal: 12 },
  stepContainer: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 0,
    alignItems: "flex-start",
  },
  languageChipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  levelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  levelChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  skillChipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  skillYearsInput: {
    width: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  workExpCard: {
    borderRadius: 4,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  workExpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  workExpTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  removeExpButton: {
    padding: 4,
  },
  certCard: {
    borderRadius: 4,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  certHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  certTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  removeCertButton: {
    padding: 4,
  },
  projectCard: {
    borderRadius: 4,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  removeProjectButton: {
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    marginTop: 16,
    gap: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderRadius: 4,
    padding: 14,
    borderWidth: 1.5,
    fontSize: 16,
    fontWeight: "500",
  },
  dropdownButton: {
    borderRadius: 4,
    padding: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 50,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: "500",
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 28,
  },
  addRateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    marginTop: 12,
    marginBottom: 0,
    gap: 10,
  },
  addRateText: {
    fontSize: 16,
    fontWeight: "700",
  },
  paymentTypeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  paymentTypeText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalInput: {
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: "center",
    borderWidth: 1,
  },
  modalButtonCancel: {},
  modalButtonSave: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  addLanguageForm: {
    marginBottom: 16,
  },
  addLanguageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 4,
    gap: 8,
    minHeight: 50,
  },
  addLanguageButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  languagesList: {
    marginTop: 8,
  },
  languageListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  languageListItemName: {
    fontSize: 16,
    marginBottom: 6,
    fontWeight: "700",
  },
  languageListItemLevel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  removeLanguageButton: {
    padding: 10,
    borderRadius: 8,
  },
  skillsList: {
    marginTop: 8,
  },
  skillListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  skillListItemName: {
    fontSize: 16,
  },
  skillYearsInputList: {
    width: 100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    fontSize: 14,
    fontWeight: "500",
  },
  removeSkillButton: {
    padding: 10,
    marginTop: 4,
  },
});
