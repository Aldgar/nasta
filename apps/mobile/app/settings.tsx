import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, Stack } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getApiBase } from "../lib/api";
import * as ImagePicker from "expo-image-picker";
import { TouchableButton } from "../components/TouchableButton";
import GradientBackground from "../components/GradientBackground";

// Country list with flags and dial codes
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dialCode: "+351" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "+34" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "+39" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dialCode: "+31" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", dialCode: "+32" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", dialCode: "+41" },
  { code: "AT", name: "Austria", flag: "🇦🇹", dialCode: "+43" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", dialCode: "+46" },
  { code: "NO", name: "Norway", flag: "🇳🇴", dialCode: "+47" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", dialCode: "+45" },
  { code: "FI", name: "Finland", flag: "🇫🇮", dialCode: "+358" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", dialCode: "+353" },
  { code: "PL", name: "Poland", flag: "🇵🇱", dialCode: "+48" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", dialCode: "+420" },
  { code: "GR", name: "Greece", flag: "🇬🇷", dialCode: "+30" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "+55" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", dialCode: "+52" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dialCode: "+54" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "+81" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "+82" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", dialCode: "+20" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "+254" },
  { code: "IL", name: "Israel", flag: "🇮🇱", dialCode: "+972" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", dialCode: "+90" },
  { code: "RU", name: "Russia", flag: "🇷🇺", dialCode: "+7" },
].sort((a, b) => a.name.localeCompare(b.name));

// Password Requirement Item Component
const RequirementItem = ({
  met,
  text,
  colors,
  isDark,
}: {
  met: boolean;
  text: string;
  colors: any;
  isDark: boolean;
}) => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Feather
        name={met ? "check-circle" : "circle"}
        size={16}
        color={
          met
            ? isDark
              ? "#10b981"
              : "#059669"
            : isDark
              ? "#8A7B68"
              : "#9A8E7A"
        }
      />
      <Text
        style={{
          fontSize: 12,
          color: met
            ? isDark
              ? "#10b981"
              : "#059669"
            : isDark
              ? "#8A7B68"
              : "#9A8E7A",
        }}
      >
        {text}
      </Text>
    </View>
  );
};

export default function Settings() {
  const { theme, setTheme, colors, isDark } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  // Helper function to translate verification status
  const translateStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      pending: t("profile.status.pending"),
      not_verified: t("profile.status.notVerified"),
      verified: t("profile.status.verified"),
      rejected: t("profile.status.rejected"),
      manual_review: t("profile.status.manualReview"),
      in_progress: t("profile.status.inProgress"),
      approved: t("profile.status.approved"),
      clean: t("profile.status.clean"),
      submitted: t("profile.status.submitted"),
      under_review: t("profile.status.underReview"),
      not_registered: t("vehicles.notRegistered"),
    };
    return statusMap[status] || status.replace("_", " ");
  };

  // Local state for permissions since they are async
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Profile State
  const [profile, setProfile] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    dateOfBirth: null as Date | null,
    address: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    online: true,
    avatar: null as string | null,
    role: "",
  });

  // Verification State
  const [verification, setVerification] = useState({
    emailVerified: false,
    phoneVerified: false,
    idStatus: "pending" as
      | "pending"
      | "verified"
      | "rejected"
      | "manual_review"
      | "in_progress",
    backgroundStatus: "not_verified" as
      | "not_verified"
      | "pending"
      | "verified"
      | "rejected"
      | "submitted"
      | "under_review"
      | "approved"
      | "clean",
    vehicleStatus: "not_registered" as
      | "not_registered"
      | "pending"
      | "verified"
      | "rejected",
  });

  // Edit Modals State
  const [editModal, setEditModal] = useState<
    "email" | "phone" | "dateOfBirth" | "address" | "password" | null
  >(null);
  const [editValue, setEditValue] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState({
    day: "",
    month: "",
    year: "",
  });
  const [addressForm, setAddressForm] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [phoneForm, setPhoneForm] = useState({
    countryCode: "+1",
    countryFlag: "🇺🇸",
    countryName: "United States",
    phoneNumber: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Password validation function
  const validatePassword = (
    password: string,
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push(t("auth.passwordRequirements.minLength"));
    }
    if (!/[A-Z]/.test(password)) {
      errors.push(t("auth.passwordRequirements.uppercase"));
    }
    if (!/[a-z]/.test(password)) {
      errors.push(t("auth.passwordRequirements.lowercase"));
    }
    if (!/\d/.test(password)) {
      errors.push(t("auth.passwordRequirements.number"));
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push(t("auth.passwordRequirements.special"));
    }

    return { isValid: errors.length === 0, errors };
  };

  // Check individual password requirements
  const checkPasswordRequirement = (
    password: string,
    requirement: string,
  ): boolean => {
    switch (requirement) {
      case "minLength":
        return password.length >= 8;
      case "uppercase":
        return /[A-Z]/.test(password);
      case "lowercase":
        return /[a-z]/.test(password);
      case "number":
        return /\d/.test(password);
      case "special":
        return /[!@#$%^&*(),.?":{}|<>]/.test(password);
      default:
        return false;
    }
  };

  // Verification Modal State
  const [verificationModal, setVerificationModal] = useState<
    "email" | "phone" | null
  >(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [settings, setSettings] = useState({
    language: "English",
    location: false,
    dataQuality: "Standard",
  });
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Fetch Profile & Status
  const fetchProfile = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();

      // Try to decode token to check if user is admin
      let isAdmin = false;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        isAdmin = payload.role === "ADMIN";
      } catch (e) {
        // If token decode fails, try regular profile endpoint
      }

      let res;
      if (isAdmin) {
        // Admin uses different endpoint
        res = await fetch(`${base}/admin/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await fetch(`${base}/profiles/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        });
      }

      if (res.ok) {
        const data = await res.json();

        if (isAdmin) {
          // Admin profile structure
          const admin = data.admin;
          const p = data.profile;
          setProfile({
            name: `${admin.firstName} ${admin.lastName}`,
            username: `@${admin.firstName.toLowerCase()}`,
            email: admin.email,
            phone: "N/A",
            address: "N/A",
            online: true,
            avatar: (() => {
              const avatarUrl = p?.avatarUrl;
              if (!avatarUrl) return null;
              // Construct full URL if it's a relative path
              if (avatarUrl.startsWith("http")) {
                return avatarUrl;
              }
              const apiBase = getApiBase();
              return `${apiBase}/${avatarUrl.startsWith("/") ? avatarUrl.slice(1) : avatarUrl}`;
            })(),
            role: "ADMIN",
          } as any);
          // Admins don't have verification
          setVerification({
            emailVerified: false,
            phoneVerified: false,
            idStatus: "pending",
            backgroundStatus: "pending",
          });
        } else {
          // Regular user profile structure
          const u = data.user;
          const p = data.profile;

          // Build address from UserProfile (preferred) or User model (legacy)
          let addressStr = t("profile.notSet");
          const addressParts: string[] = [];

          if (p?.addressLine1 || p?.city || p?.country) {
            // Use UserProfile fields
            if (p.addressLine1) addressParts.push(p.addressLine1);
            if (p.city) addressParts.push(p.city);
            if (p.state) addressParts.push(p.state);
            if (p.postalCode) addressParts.push(p.postalCode);
            if (p.country) addressParts.push(p.country);
            addressStr =
              addressParts.length > 0
                ? addressParts.join(", ")
                : t("profile.notSet");
          } else if (u.location || u.city || u.country) {
            // Fallback to User model fields
            const parts = [u.location, u.city, u.country].filter(Boolean);
            addressStr =
              parts.length > 0 ? parts.join(", ") : t("profile.notSet");
          }

          setProfile({
            name: `${u.firstName} ${u.lastName}`,
            username: `@${u.firstName.toLowerCase()}`,
            email: u.email,
            phone: u.phone || t("profile.notSet"),
            dateOfBirth: p?.dateOfBirth ? new Date(p.dateOfBirth) : null,
            address: addressStr,
            addressLine1: p?.addressLine1 || "",
            addressLine2: p?.addressLine2 || "",
            city: p?.city || u.city || "",
            state: p?.state || "",
            postalCode: p?.postalCode || "",
            country: p?.country || u.country || "",
            online: true,
            avatar: (() => {
              const avatarUrl = p?.avatarUrl || u.avatar;
              if (!avatarUrl) return null;
              // Construct full URL if it's a relative path
              if (avatarUrl.startsWith("http")) {
                return avatarUrl;
              }
              const apiBase = getApiBase();
              return `${apiBase}/${avatarUrl.startsWith("/") ? avatarUrl.slice(1) : avatarUrl}`;
            })(),
            role: (u.role || "").toUpperCase(),
          });

          // Fetch KYC status to get individual document statuses
          let idStatus = (u.idVerificationStatus || "pending").toLowerCase();
          try {
            const kycRes = await fetch(`${base}/kyc/my-status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (kycRes.ok) {
              const kycData = await kycRes.json();
              const currentVerification = kycData?.current;
              if (currentVerification?.documentStatuses) {
                // Check individual document statuses
                const statuses = currentVerification.documentStatuses as Record<
                  string,
                  string
                >;
                // Backend stores "APPROVED" or "REJECTED" in documentStatuses
                // If all documents are approved, set status to verified
                const allApproved =
                  (statuses.documentFront === "APPROVED" ||
                    statuses.documentFront === "VERIFIED") &&
                  (statuses.documentBack === "APPROVED" ||
                    statuses.documentBack === "VERIFIED") &&
                  (statuses.selfie === "APPROVED" ||
                    statuses.selfie === "VERIFIED");
                if (allApproved) {
                  idStatus = "verified";
                } else if (
                  Object.values(statuses).some(
                    (s) => s === "REJECTED" || s === "FAILED",
                  )
                ) {
                  idStatus = "rejected";
                } else if (
                  Object.values(statuses).some(
                    (s) => s === "MANUAL_REVIEW" || s === "PENDING",
                  )
                ) {
                  idStatus = Object.values(statuses).some(
                    (s) => s === "MANUAL_REVIEW",
                  )
                    ? "manual_review"
                    : "in_progress";
                }
              }
              // Also check overall status if documentStatuses check didn't set a status
              if (
                idStatus ===
                  (u.idVerificationStatus || "pending").toLowerCase() &&
                currentVerification?.status
              ) {
                const overallStatus = (
                  currentVerification.status || ""
                ).toLowerCase();
                if (overallStatus === "verified") {
                  idStatus = "verified";
                } else if (overallStatus === "failed") {
                  idStatus = "rejected";
                } else if (overallStatus === "manual_review") {
                  idStatus = "manual_review";
                } else if (
                  overallStatus === "in_progress" ||
                  overallStatus === "pending"
                ) {
                  idStatus = overallStatus;
                }
              }
            }
          } catch (err) {
            // Silently fail - use default status
          }

          const rawBgStatus = (
            u.backgroundCheckStatus || "pending"
          ).toLowerCase();

          // Fetch vehicle status
          let vehicleStatus: string = "not_registered";
          try {
            const vRes = await fetch(`${base}/vehicles/my-vehicles`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (vRes.ok) {
              const vList = await vRes.json();
              if (Array.isArray(vList) && vList.length > 0) {
                if (vList.some((v: any) => v.status === "VERIFIED"))
                  vehicleStatus = "verified";
                else if (vList.some((v: any) => v.status === "PENDING"))
                  vehicleStatus = "pending";
                else if (vList.some((v: any) => v.status === "REJECTED"))
                  vehicleStatus = "rejected";
              }
            }
          } catch {
            // Silently fail
          }

          setVerification({
            emailVerified: !!u.emailVerifiedAt,
            phoneVerified: !!u.phoneVerifiedAt,
            idStatus,
            backgroundStatus:
              rawBgStatus === "pending" ? "not_verified" : rawBgStatus,
            vehicleStatus: vehicleStatus as any,
          });
        }
      }
    } catch (err: any) {
      // Only log non-network errors to avoid noise when backend is unavailable
      if (err?.message && !err.message.includes("Network request failed")) {
        console.log("Error loading profile", err);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      (async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
        setLocationEnabled(status === "granted");
      })();
    }, [fetchProfile]),
  );

  const toggleLocation = async (value: boolean) => {
    /* ... existing location logic ... */
    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationEnabled(true);
      } else {
        Alert.alert(
          t("settings.permissionRequired"),
          t("settings.locationPermissionNeeded"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("settings.openSettings"),
              onPress: () => Linking.openSettings(),
            },
          ],
        );
        setLocationEnabled(false);
      }
    } else {
      Alert.alert(
        t("settings.disableLocation"),
        t("settings.disableLocationDescription"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.openSettings"),
            onPress: () => Linking.openSettings(),
          },
        ],
      );
    }
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("settings.permissionNeeded"),
          t("settings.cameraRollPermissionMessage"),
        );
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        ...(Platform.OS === "ios"
          ? ({ preferredAssetRepresentationMode: "compatible" } as any)
          : null),
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImg = result.assets[0];
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) {
          Alert.alert(
            t("common.error"),
            t("settings.pleaseLogInToUploadPhoto"),
          );
          return;
        }

        // Upload the image to the backend
        const base = getApiBase();
        const formData = new FormData();

        // Get file extension from URI
        const uriParts = selectedImg.uri.split(".");
        const fileExtension = uriParts[uriParts.length - 1];
        const fileName = `avatar.${fileExtension}`;

        // Create file object for FormData
        formData.append("file", {
          uri: selectedImg.uri,
          name: fileName,
          type: `image/${fileExtension}`,
        } as any);

        // Show loading indicator
        Alert.alert(
          t("settings.uploading"),
          t("settings.uploadingPhotoPleaseWait"),
        );

        const uploadRes = await fetch(`${base}/profiles/me/avatar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const avatarUrl =
            uploadData.profile?.avatarUrl || uploadData.avatarUrl;

          if (avatarUrl) {
            // Construct full URL for display
            const fullAvatarUrl = avatarUrl.startsWith("http")
              ? avatarUrl
              : `${base}/${avatarUrl.startsWith("/") ? avatarUrl.slice(1) : avatarUrl}`;

            setProfile((prev) => ({ ...prev, avatar: fullAvatarUrl }));

            // Refresh profile data
            fetchProfile();

            Alert.alert(
              t("common.success"),
              t("settings.profilePhotoUploadedSuccessfully"),
            );
          } else {
            throw new Error("No avatar URL returned from server");
          }
        } else {
          const errorData = await uploadRes
            .json()
            .catch(() => ({ message: "Failed to upload photo" }));
          throw new Error(errorData.message || "Failed to upload photo");
        }
      }
    } catch (error: any) {
      console.error("Error uploading profile photo:", error);
      Alert.alert(
        t("common.error"),
        error.message || t("settings.failedToUploadProfilePhoto"),
      );
    }
  };

  // Edit Handlers
  const handleEditEmail = () => {
    setEditValue(profile.email);
    setEditModal("email");
  };

  const handleEditPhone = () => {
    // Parse existing phone number to extract country code and number
    const phone = profile.phone === t("profile.notSet") ? "" : profile.phone;
    let countryCode = "+1";
    let countryFlag = "🇺🇸";
    let countryName = "United States";
    let phoneNumber = phone;

    // Try to extract country code from phone number
    if (phone && phone.startsWith("+")) {
      for (const country of COUNTRIES) {
        if (phone.startsWith(country.dialCode)) {
          countryCode = country.dialCode;
          countryFlag = country.flag;
          countryName = country.name;
          phoneNumber = phone.substring(country.dialCode.length).trim();
          break;
        }
      }
    }

    setPhoneForm({
      countryCode,
      countryFlag,
      countryName,
      phoneNumber,
    });
    setEditModal("phone");
  };

  const handleEditPassword = async () => {
    // Try to get the last login password from SecureStore
    let lastPassword = "";
    try {
      lastPassword =
        (await SecureStore.getItemAsync("last_login_password")) || "";
    } catch (err) {
      // If not available, that's okay - user will need to enter it manually
      console.log("Could not retrieve last login password:", err);
    }

    setPasswordForm({
      currentPassword: lastPassword,
      newPassword: "",
      confirmPassword: "",
    });
    setShowPassword({
      current: false,
      new: false,
      confirm: false,
    });
    setEditModal("password");
  };

  const handleEditAddress = () => {
    setAddressForm({
      addressLine1: profile.addressLine1 || "",
      addressLine2: profile.addressLine2 || "",
      city: profile.city || "",
      state: profile.state || "",
      postalCode: profile.postalCode || "",
      country: profile.country || "",
    });
    setEditModal("address");
  };

  const handleUseCurrentLocation = async () => {
    // Only allow for service providers (JOB_SEEKER) and employers
    if (profile.role !== "JOB_SEEKER" && profile.role !== "EMPLOYER") {
      return;
    }

    setIsGettingLocation(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("common.error"),
          t("settings.locationPermissionRequired"),
          [{ text: t("common.ok") }],
        );
        setIsGettingLocation(false);
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        Alert.alert(t("common.error"), t("settings.locationServicesDisabled"), [
          { text: t("common.ok") },
        ]);
        setIsGettingLocation(false);
        return;
      }

      // Get current location
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<Location.LocationObject>((_, reject) =>
          setTimeout(() => reject(new Error("Location timeout")), 15000),
        ),
      ]);

      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        setAddressForm({
          addressLine1:
            address.streetNumber && address.street
              ? `${address.streetNumber} ${address.street}`
              : address.street || addressForm.addressLine1,
          addressLine2: addressForm.addressLine2,
          city: address.city || addressForm.city,
          state: address.region || addressForm.state,
          postalCode: address.postalCode || addressForm.postalCode,
          country: address.country || addressForm.country,
        });
        Alert.alert(t("common.success"), t("settings.locationRetrieved"), [
          { text: t("common.ok") },
        ]);
      } else {
        Alert.alert(t("common.error"), t("settings.couldNotRetrieveAddress"), [
          { text: t("common.ok") },
        ]);
      }
    } catch (error: any) {
      console.error("Error getting location:", error);
      // Handle specific error messages
      let errorMessage = t("settings.locationError");
      if (error.message) {
        if (
          error.message.includes("unavailable") ||
          error.message.includes("location services")
        ) {
          errorMessage = t("settings.locationServicesDisabled");
        } else if (error.message.includes("timeout")) {
          errorMessage = t("settings.locationTimeout");
        } else if (error.message.includes("permission")) {
          errorMessage = t("settings.locationPermissionRequired");
        }
      }
      Alert.alert(t("common.error"), errorMessage, [{ text: t("common.ok") }]);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleEditDateOfBirth = () => {
    const currentDate = profile.dateOfBirth || null;
    if (currentDate) {
      const d = new Date(currentDate);
      setDateInput({
        day: d.getDate().toString().padStart(2, "0"),
        month: (d.getMonth() + 1).toString().padStart(2, "0"),
        year: d.getFullYear().toString(),
      });
    } else {
      setDateInput({ day: "", month: "", year: "" });
    }
    setDateOfBirth(currentDate);
    setEditModal("dateOfBirth");
  };

  const updateDateFromInputs = (inputs: {
    day: string;
    month: string;
    year: string;
  }) => {
    if (inputs.day && inputs.month && inputs.year) {
      const day = parseInt(inputs.day);
      const month = parseInt(inputs.month);
      const year = parseInt(inputs.year);

      // Validate the date
      const testDate = new Date(year, month - 1, day);
      const isValid =
        !isNaN(testDate.getTime()) &&
        testDate.getDate() === day &&
        testDate.getMonth() === month - 1 &&
        testDate.getFullYear() === year &&
        testDate <= new Date();

      if (isValid) {
        setDateOfBirth(testDate);
      }
    } else {
      setDateOfBirth(null);
    }
  };

  const handleSaveEdit = async () => {
    if (editModal === "address") {
      // Address validation - at least one field should be filled
      if (
        !addressForm.addressLine1.trim() &&
        !addressForm.city.trim() &&
        !addressForm.country.trim()
      ) {
        Alert.alert(t("common.error"), t("settings.pleaseEnterAddressFields"));
        return;
      }
    } else if (editModal === "phone") {
      // Phone validation is handled in the phone-specific section below
      // Skip the generic validation for phone
    } else if (editModal === "dateOfBirth") {
      // Date of Birth validation - check if dateOfBirth is set
      if (!dateOfBirth) {
        Alert.alert(
          t("common.error"),
          t("settings.pleaseEnterValidDateOfBirth"),
        );
        return;
      }
    } else if (editModal === "password") {
      // Password validation is handled in the password-specific section below
      // Skip the generic validation for password
    } else {
      if (!editValue.trim()) {
        Alert.alert(t("common.error"), t("settings.pleaseEnterValue"));
        return;
      }
    }

    setIsSaving(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert(
          t("common.error"),
          t("applications.authenticationRequired"),
        );
        return;
      }

      const base = getApiBase();
      const originalEmail = profile.email;
      const originalPhone = profile.phone;

      if (editModal === "email") {
        // Update email
        const res = await fetch(`${base}/users/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: editValue.trim() }),
        });

        if (res.ok) {
          // If email changed, require verification
          if (editValue.trim() !== originalEmail) {
            setEditModal(null);
            setVerificationModal("email");
            // Request email verification
            await requestEmailVerification();
          } else {
            setEditModal(null);
            fetchProfile();
            Alert.alert(t("common.success"), t("settings.emailUpdated"));
          }
        } else {
          const error = await res.json();
          // Handle both string and array error messages
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Failed to update email";
          Alert.alert(t("common.error"), errorMessage);
        }
      } else if (editModal === "phone") {
        // Update phone - combine country code and phone number
        const fullPhone = phoneForm.phoneNumber.trim()
          ? `${phoneForm.countryCode}${phoneForm.phoneNumber.trim()}`
          : "";

        if (!fullPhone) {
          Alert.alert(t("common.error"), t("settings.pleaseEnterPhoneNumber"));
          setIsSaving(false);
          return;
        }

        const res = await fetch(`${base}/users/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: fullPhone }),
        });

        if (res.ok) {
          // If phone changed, require verification
          if (fullPhone !== originalPhone) {
            setEditModal(null);
            setVerificationModal("phone");
            // Request phone verification
            await requestPhoneVerification();
          } else {
            setEditModal(null);
            fetchProfile();
            Alert.alert(t("common.success"), t("settings.phoneNumberUpdated"));
          }
        } else {
          const error = await res.json();
          // Handle both string and array error messages
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Failed to update phone";
          Alert.alert(t("common.error"), errorMessage);
        }
      } else if (editModal === "dateOfBirth") {
        if (!dateOfBirth) {
          Alert.alert(t("common.error"), t("settings.pleaseSelectDateOfBirth"));
          setIsSaving(false);
          return;
        }

        const res = await fetch(`${base}/profiles/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dateOfBirth: dateOfBirth.toISOString() }),
        });

        if (res.ok) {
          setEditModal(null);
          setDateOfBirth(null);
          fetchProfile();
          Alert.alert(t("common.success"), t("settings.dateOfBirthUpdated"));
        } else {
          const error = await res.json();
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Failed to update date of birth";
          Alert.alert(t("common.error"), errorMessage);
        }
      } else if (editModal === "address") {
        // Update address with all fields
        const addressData: any = {
          addressLine1: addressForm.addressLine1.trim() || undefined,
          addressLine2: addressForm.addressLine2.trim() || undefined,
          city: addressForm.city.trim() || undefined,
          state: addressForm.state.trim() || undefined,
          postalCode: addressForm.postalCode.trim() || undefined,
          country: addressForm.country.trim() || undefined,
        };

        // Remove undefined fields
        Object.keys(addressData).forEach((key) => {
          if (addressData[key] === undefined) {
            delete addressData[key];
          }
        });

        // Update user address
        const res = await fetch(`${base}/users/me/address`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(addressData),
        });

        if (res.ok) {
          // If user is an employer, also update employer profile address
          if (profile.role === "EMPLOYER") {
            try {
              await fetch(`${base}/profiles/employer/me/address`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(addressData),
              });
            } catch (err) {
              console.error("Error updating employer address:", err);
              // Don't fail the whole operation if employer update fails
            }
          }
          setEditModal(null);
          fetchProfile();
          Alert.alert(t("common.success"), t("settings.addressUpdated"));
        } else {
          const error = await res.json();
          // Handle both string and array error messages
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Failed to update address";
          Alert.alert(t("common.error"), errorMessage);
        }
      } else if (editModal === "password") {
        // Validate password fields
        if (!passwordForm.currentPassword.trim()) {
          Alert.alert(
            t("common.error"),
            t("settings.pleaseEnterCurrentPassword"),
          );
          setIsSaving(false);
          return;
        }
        if (!passwordForm.newPassword.trim()) {
          Alert.alert(t("common.error"), t("settings.pleaseEnterNewPassword"));
          setIsSaving(false);
          return;
        }

        // Comprehensive password validation
        const validation = validatePassword(passwordForm.newPassword);
        if (!validation.isValid) {
          const errorMessage =
            t("settings.passwordRequirementsNotMet") +
            "\n\n" +
            validation.errors.map((err) => `• ${err}`).join("\n");
          Alert.alert(t("common.error"), errorMessage);
          setIsSaving(false);
          return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          Alert.alert(t("common.error"), t("settings.passwordsDoNotMatch"));
          setIsSaving(false);
          return;
        }

        // Check if new password is same as current password
        if (passwordForm.currentPassword === passwordForm.newPassword) {
          Alert.alert(
            t("common.error"),
            t("settings.newPasswordSameAsCurrent"),
          );
          setIsSaving(false);
          return;
        }

        // Change password
        const res = await fetch(`${base}/auth/password/change`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        });

        if (res.ok) {
          // Clear the stored password after successful change
          try {
            await SecureStore.deleteItemAsync("last_login_password");
          } catch (err) {
            // Ignore errors when clearing
          }

          setEditModal(null);
          setPasswordForm({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          Alert.alert(t("common.success"), t("settings.passwordUpdated"));
        } else {
          const error = await res.json();
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Failed to change password";
          Alert.alert(t("common.error"), errorMessage);
        }
      }
    } catch (err) {
      console.error("Error saving:", err);
      Alert.alert(t("common.error"), t("settings.failedToSaveChanges"));
    } finally {
      setIsSaving(false);
    }
  };

  const requestEmailVerification = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/auth/email/request-verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        Alert.alert(
          t("settings.verificationSent"),
          t("emailVerification.checkEmailForLink"),
          [{ text: t("common.ok"), onPress: () => setVerificationModal(null) }],
        );
        // Close verification modal since email uses link, not code
        setVerificationModal(null);
      } else {
        const error = await res.json();
        // Handle both string and array error messages
        const errorMessage = Array.isArray(error.message)
          ? error.message.join(", ")
          : error.message || "Failed to send verification email";
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (err) {
      console.error("Error requesting email verification:", err);
      Alert.alert(
        t("common.error"),
        t("emailVerification.failedToSendVerificationEmail"),
      );
    }
  };

  const requestPhoneVerification = async () => {
    setIsRequestingCode(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) return;

      const base = getApiBase();
      const res = await fetch(`${base}/auth/phone/request-verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        Alert.alert(
          t("settings.codeSent"),
          t("settings.verificationCodeSentToPhone"),
        );
      } else {
        const error = await res.json();
        // Handle both string and array error messages
        const errorMessage = Array.isArray(error.message)
          ? error.message.join(", ")
          : error.message || "Failed to send verification code";
        Alert.alert(t("common.error"), errorMessage);
      }
    } catch (err) {
      console.error("Error requesting phone verification:", err);
      Alert.alert(
        t("common.error"),
        t("settings.failedToSendVerificationCode"),
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationModal === "phone") {
      // Phone verification
      if (!verificationCode.trim() || verificationCode.length !== 6) {
        Alert.alert(t("common.error"), t("settings.pleaseEnter6DigitCode"));
        return;
      }

      setIsVerifying(true);
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const base = getApiBase();
        const res = await fetch(`${base}/auth/phone/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: verificationCode,
          }),
        });

        if (res.ok) {
          setVerificationModal(null);
          setVerificationCode("");
          fetchProfile();
          Alert.alert(
            t("common.success"),
            t("settings.phoneVerifiedSuccessfully"),
          );
        } else {
          const error = await res.json();
          // Handle both string and array error messages
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Invalid verification code";
          Alert.alert(t("common.error"), errorMessage);
        }
      } catch (err) {
        console.error("Error verifying:", err);
        Alert.alert(t("common.error"), t("settings.failedToVerify"));
      } finally {
        setIsVerifying(false);
      }
    } else if (verificationModal === "email") {
      // Email verification using token/code from email
      if (!verificationCode.trim()) {
        Alert.alert(
          t("common.error"),
          t("settings.pleaseEnterVerificationCodeFromEmail"),
        );
        return;
      }

      setIsVerifying(true);
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/auth/email/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: verificationCode.trim(),
          }),
        });

        if (res.ok) {
          setVerificationModal(null);
          setVerificationCode("");
          fetchProfile();
          Alert.alert(
            t("common.success"),
            t("settings.emailVerifiedSuccessfully"),
          );
        } else {
          const error = await res.json();
          const errorMessage = Array.isArray(error.message)
            ? error.message.join(", ")
            : error.message || "Invalid or expired verification code";
          Alert.alert(t("common.error"), errorMessage);
        }
      } catch (err) {
        console.error("Error verifying email:", err);
        Alert.alert(t("common.error"), t("settings.failedToVerifyEmail"));
      } finally {
        setIsVerifying(false);
      }
    }
  };

  // Interaction Handlers
  const handleEmailPress = () => {
    if (!verification.emailVerified) {
      // If email is not verified, open verification modal
      setVerificationModal("email");
      setVerificationCode("");
    } else {
      // If email is verified, allow editing
      handleEditEmail();
    }
  };

  const handlePhonePress = () => {
    handleEditPhone();
  };

  const handleAddressPress = () => {
    handleEditAddress();
  };

  const handleIdPress = () => {
    if (verification.idStatus === "verified") {
      Alert.alert(t("profile.verified"), t("profile.idVerified"));
      return;
    }
    router.push("/kyc-start" as never);
  };

  const handleBgPress = () => {
    if (verification.backgroundStatus === "approved") {
      Alert.alert(t("profile.verified"), t("profile.backgroundCheckClean"));
      return;
    }
    if (verification.backgroundStatus === "not_verified") {
      router.push("/kyc-start" as never);
      return;
    }
    Alert.alert(
      t("profile.backgroundCheck"),
      t("profile.currentStatus", {
        status: translateStatus(verification.backgroundStatus),
      }),
    );
  };

  const Row = ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => (
    <TouchableButton
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderBottomColor: isDark
            ? "rgba(201,150,63,0.12)"
            : "rgba(184,130,42,0.2)",
        },
      ]}
    >
      {children}
    </TouchableButton>
  );

  const Label = ({ text }: { text: string }) => (
    <Text style={[styles.label, { color: colors.text }]}>{text}</Text>
  );

  const Value = ({ text }: { text: string }) => (
    <View
      style={[
        styles.valueBox,
        {
          backgroundColor: isDark ? "rgba(12, 22, 42, 0.80)" : "#E8D8B8",
          borderColor: isDark ? "rgba(255,250,240,0.15)" : "transparent",
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <Text
        style={[styles.valueText, { color: isDark ? "#F0E8D5" : "#6B6355" }]}
      >
        {text}
      </Text>
    </View>
  );

  const Status = ({ ok, text }: { ok: boolean; text: string }) => (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: ok ? "#22c55e" : "#ef4444" },
      ]}
    >
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );

  const SectionCard = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: isDark
            ? "rgba(12, 22, 42, 0.85)"
            : "rgba(255,250,240,0.92)",
          borderColor: isDark
            ? "rgba(201,150,63,0.25)"
            : "rgba(184,130,42,0.2)",
        },
      ]}
    >
      {title && (
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? "rgba(201,150,63,0.7)" : "rgba(184,130,42,0.6)" },
          ]}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <GradientBackground>
        <SafeAreaView style={[styles.container]}>
          <View style={styles.topBar}>
            <TouchableButton
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={colors.text} />
            </TouchableButton>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 3,
                  color: isDark
                    ? "rgba(201,150,63,0.6)"
                    : "rgba(184,130,42,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                CONTROL PANEL
              </Text>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {t("settings.title")}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "android" ? "on-drag" : "interactive"
            }
            {...(Platform.OS === "android" ? {
              removeClippedSubviews: true,
              overScrollMode: "never" as const,
              nestedScrollEnabled: true,
            } : {})}
          >
            <SectionCard>
              <View style={styles.avatarRow}>
                <TouchableButton
                  onPress={pickImage}
                  style={{ position: "relative" }}
                >
                  {profile.avatar ? (
                    // eslint-disable-next-line
                    <Image
                      source={{ uri: profile.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: isDark ? "#5C5548" : "#D4C0A0" },
                      ]}
                    />
                  )}
                  <View
                    style={[styles.editBadge, { backgroundColor: colors.tint }]}
                  >
                    <Feather
                      name="camera"
                      size={12}
                      color={isDark ? "#F0E8D5" : "#FFFAF0"}
                    />
                  </View>
                </TouchableButton>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.titlePrimary, { color: colors.text }]}>
                    {profile.name || t("profile.yourName")}
                  </Text>
                  <Text
                    style={[
                      styles.subtitleSmall,
                      { color: isDark ? "#9A8E7A" : "#8A7B68" },
                    ]}
                  >
                    {profile.online
                      ? t("settings.online")
                      : t("settings.offline")}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: isDark
                      ? "rgba(201,150,63,0.7)"
                      : "rgba(184,130,42,0.6)",
                  },
                ]}
              >
                {t("profile.aboutMe")}
              </Text>
              <Row>
                <Label text={t("profile.username")} />
                <Value text={profile.username || "@username"} />
              </Row>
              <Row onPress={handleEditEmail}>
                <Label text={t("profile.email")} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Value text={profile.email || "hello@example.com"} />
                  <Feather name="edit-2" size={16} color={colors.text} />
                </View>
              </Row>
              <Row onPress={handleEditPhone}>
                <Label text={t("profile.phone")} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Value text={profile.phone || "+123-456-7890"} />
                  <Feather name="edit-2" size={16} color={colors.text} />
                </View>
              </Row>
              {profile.role !== "EMPLOYER" && (
                <Row onPress={handleEditDateOfBirth}>
                  <Label text={t("profile.dateOfBirth")} />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Value
                      text={
                        profile.dateOfBirth
                          ? (() => {
                              const d = new Date(profile.dateOfBirth);
                              const month = String(d.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const day = String(d.getDate()).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${month}/${day}/${year}`;
                            })()
                          : t("profile.notSet")
                      }
                    />
                    <Feather name="edit-2" size={16} color={colors.text} />
                  </View>
                </Row>
              )}
              <Row onPress={handleEditAddress}>
                <Label text={t("profile.address")} />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    justifyContent: "flex-end",
                  }}
                >
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.valueText,
                        {
                          color: isDark ? "rgba(255,250,240,0.92)" : "#5C5548",
                          textAlign: "right",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {profile.address || "123 Anywhere St, Any City"}
                    </Text>
                  </View>
                  <Feather name="edit-2" size={16} color={colors.text} />
                </View>
              </Row>
              {profile.role !== "EMPLOYER" && profile.role !== "ADMIN" && (
                <Row onPress={() => router.push("/onboarding" as never)}>
                  <Label text={t("settings.onboarding")} />
                  <View
                    style={[
                      styles.valueBox,
                      { backgroundColor: isDark ? "#C9963F" : colors.tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.valueText,
                        { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                      ]}
                    >
                      {t("settings.completeProfile")}
                    </Text>
                  </View>
                </Row>
              )}
            </SectionCard>

            <SectionCard title={t("settings.password")}>
              <Row onPress={handleEditPassword}>
                <Label text={t("settings.changePassword")} />
                <View
                  style={[
                    styles.valueBox,
                    { backgroundColor: isDark ? "#C9963F" : colors.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.valueText,
                      { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                    ]}
                  >
                    {t("settings.updatePassword")}
                  </Text>
                </View>
              </Row>
            </SectionCard>

            {profile.role !== "ADMIN" && (
              <SectionCard title={t("settings.verification")}>
                <Row onPress={handleEmailPress}>
                  <Label text={t("profile.email")} />
                  <Status
                    ok={verification.emailVerified}
                    text={
                      verification.emailVerified
                        ? t("profile.verified")
                        : t("profile.notVerified")
                    }
                  />
                </Row>
                <Row onPress={handlePhonePress}>
                  <Label text={t("profile.phone")} />
                  <Status
                    ok={verification.phoneVerified}
                    text={
                      verification.phoneVerified
                        ? t("profile.verified")
                        : t("profile.notVerified")
                    }
                  />
                </Row>
                {profile.role !== "EMPLOYER" && (
                  <>
                    <Row onPress={handleIdPress}>
                      <Label text={t("profile.id")} />
                      <Status
                        ok={verification.idStatus === "verified"}
                        text={translateStatus(verification.idStatus)}
                      />
                    </Row>
                    <Row onPress={handleBgPress}>
                      <Label text={t("profile.background")} />
                      <Status
                        ok={["approved", "clean"].includes(
                          verification.backgroundStatus,
                        )}
                        text={translateStatus(verification.backgroundStatus)}
                      />
                    </Row>
                    <Row
                      onPress={() => {
                        if (verification.vehicleStatus !== "verified") {
                          router.push("/kyc-capture" as never);
                        }
                      }}
                    >
                      <Label text={t("vehicles.vehicleVerification")} />
                      <Status
                        ok={verification.vehicleStatus === "verified"}
                        text={translateStatus(verification.vehicleStatus)}
                      />
                    </Row>
                  </>
                )}
              </SectionCard>
            )}

            {profile.role !== "ADMIN" && (
              <SectionCard title={t("settings.payment")}>
                {profile.role === "EMPLOYER" ? (
                  <Row
                    onPress={() => router.push("/payments/methods" as never)}
                  >
                    <Label text={t("profile.paymentMethods")} />
                    <View
                      style={[
                        styles.valueBox,
                        { backgroundColor: isDark ? "#C9963F" : colors.tint },
                      ]}
                    >
                      <Text
                        style={[
                          styles.valueText,
                          { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                        ]}
                      >
                        {t("settings.manageCards")}
                      </Text>
                    </View>
                  </Row>
                ) : (
                  <Row
                    onPress={() => router.push("/payments/payouts" as never)}
                  >
                    <Label text={t("settings.payoutSettings")} />
                    <View
                      style={[
                        styles.valueBox,
                        { backgroundColor: isDark ? "#C9963F" : colors.tint },
                      ]}
                    >
                      <Text
                        style={[
                          styles.valueText,
                          { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                        ]}
                      >
                        {t("settings.managePayouts")}
                      </Text>
                    </View>
                  </Row>
                )}
              </SectionCard>
            )}

            <SectionCard title={t("settings.title")}>
              <Row onPress={() => setShowLanguageModal(true)}>
                <Label text={t("settings.language")} />
                <Value
                  text={
                    language === "pt"
                      ? t("settings.portuguese")
                      : t("settings.english")
                  }
                />
              </Row>
              <Row>
                <Label text={t("settings.darkMode")} />
                <Switch
                  value={isDark}
                  onValueChange={(val) => setTheme(val ? "dark" : "light")}
                />
              </Row>
              <Row>
                <Label text={t("settings.location")} />
                <Switch
                  value={locationEnabled}
                  onValueChange={toggleLocation}
                />
              </Row>
              <Row>
                <Label text={t("settings.mobileDataSettings")} />
                <Value text={settings.dataQuality} />
              </Row>
            </SectionCard>

            <SectionCard title={t("settings.account")}>
              <Row onPress={() => router.push("/delete-account" as never)}>
                <Label text={t("deleteAccount.menuLabel")} />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={[
                      styles.valueBox,
                      {
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(239, 68, 68, 0.1)",
                        borderColor: isDark
                          ? "rgba(239, 68, 68, 0.5)"
                          : "rgba(239, 68, 68, 0.3)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.valueText,
                        { color: isDark ? "#fecaca" : "#991b1b" },
                      ]}
                    >
                      {t("deleteAccount.menuBadge")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.text} />
                </View>
              </Row>
            </SectionCard>

            <View style={styles.footerRow}>
              <TouchableButton
                style={[
                  styles.signOutBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(239, 68, 68, 0.1)",
                    borderColor: isDark
                      ? "rgba(239, 68, 68, 0.5)"
                      : "rgba(239, 68, 68, 0.3)",
                  },
                ]}
                onPress={async () => {
                  await SecureStore.deleteItemAsync("auth_token");
                  // Use dismissAll to exit tabs navigator, then navigate to landing
                  router.dismissAll();
                  router.replace("/");
                }}
              >
                <Text style={styles.signOutText}>{t("settings.signOut")}</Text>
              </TouchableButton>
            </View>
          </ScrollView>

          {/* Edit Modal */}
          <Modal
            visible={editModal !== null}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setEditModal(null)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
            <View style={styles.modalOverlay} pointerEvents="box-none">
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "#FFFAF0",
                    position: "relative",
                  },
                ]}
                pointerEvents="auto"
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {showCountryPicker && editModal === "phone"
                      ? t("profile.selectCountry")
                      : editModal === "email"
                        ? t("profile.editEmail")
                        : editModal === "phone"
                          ? t("profile.editPhone")
                          : editModal === "dateOfBirth"
                            ? t("profile.editDateOfBirth")
                            : editModal === "address"
                              ? t("profile.editAddress")
                              : t("common.edit")}
                  </Text>
                  <TouchableButton
                    onPress={() => {
                      if (showCountryPicker) {
                        setShowCountryPicker(false);
                      } else {
                        setEditModal(null);
                      }
                    }}
                  >
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableButton>
                </View>

                {/* Country Picker Overlay - Shows inside edit modal when phone editing */}
                {showCountryPicker && editModal === "phone" ? (
                  <ScrollView style={{ maxHeight: 500 }}>
                    {COUNTRIES && COUNTRIES.length > 0 ? (
                      COUNTRIES.map((country) => (
                        <TouchableButton
                          key={country.code}
                          style={[
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 16,
                              paddingHorizontal: 16,
                              borderBottomWidth: 1,
                              borderBottomColor: isDark
                                ? "rgba(201,150,63,0.12)"
                                : "rgba(184,130,42,0.06)",
                            },
                            phoneForm.countryCode === country.dialCode && {
                              backgroundColor: isDark
                                ? "rgba(201, 150, 63, 0.2)"
                                : "rgba(201, 150, 63, 0.1)",
                            },
                          ]}
                          onPress={() => {
                            setPhoneForm({
                              ...phoneForm,
                              countryCode: country.dialCode,
                              countryFlag: country.flag,
                              countryName: country.name,
                            });
                            setShowCountryPicker(false);
                          }}
                        >
                          <Text style={{ fontSize: 28, marginRight: 12 }}>
                            {country.flag}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.modalOptionText,
                                { color: colors.text, fontWeight: "700" },
                              ]}
                            >
                              {country.name}
                            </Text>
                            <Text
                              style={[
                                styles.modalOptionText,
                                {
                                  color: isDark ? "#9A8E7A" : "#8A7B68",
                                  fontSize: 14,
                                  marginTop: 2,
                                },
                              ]}
                            >
                              {country.dialCode}
                            </Text>
                          </View>
                          {phoneForm.countryCode === country.dialCode && (
                            <Feather
                              name="check"
                              size={20}
                              color={colors.tint}
                            />
                          )}
                        </TouchableButton>
                      ))
                    ) : (
                      <View />
                    )}
                  </ScrollView>
                ) : editModal === "address" ? (
                  <ScrollView style={{ maxHeight: 400 }}>
                    {(profile.role === "JOB_SEEKER" ||
                      profile.role === "EMPLOYER") && (
                      <TouchableButton
                        onPress={handleUseCurrentLocation}
                        disabled={isGettingLocation}
                        style={{
                          marginBottom: 16,
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.3)"
                            : "rgba(201, 150, 63, 0.1)",
                          borderColor: isDark ? "#C9963F" : "#C9963F",
                          borderWidth: 1,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {isGettingLocation ? (
                          <>
                            <ActivityIndicator
                              size="small"
                              color={isDark ? "#C9963F" : "#C9963F"}
                            />
                            <Text
                              style={{
                                color: isDark ? "#C9963F" : "#C9963F",
                                fontSize: 16,
                              }}
                            >
                              {t("settings.gettingLocation")}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Feather
                              name="map-pin"
                              size={18}
                              color={isDark ? "#C9963F" : "#C9963F"}
                            />
                            <Text
                              style={{
                                color: isDark ? "#C9963F" : "#C9963F",
                                fontSize: 16,
                              }}
                            >
                              {t("settings.useCurrentLocation")}
                            </Text>
                          </>
                        )}
                      </TouchableButton>
                    )}
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.addressLine1}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, addressLine1: text })
                      }
                      placeholder={t("profile.addressLine1")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.addressLine2}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, addressLine2: text })
                      }
                      placeholder={t("profile.addressLine2Optional")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.city}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, city: text })
                      }
                      placeholder={t("profile.city")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.state}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, state: text })
                      }
                      placeholder={t("settings.provinceState")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.postalCode}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, postalCode: text })
                      }
                      placeholder={t("settings.zipPostalCode")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="characters"
                    />
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={addressForm.country}
                      onChangeText={(text) =>
                        setAddressForm({ ...addressForm, country: text })
                      }
                      placeholder={t("profile.selectCountry")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="words"
                    />
                  </ScrollView>
                ) : editModal === "dateOfBirth" ? (
                  <View pointerEvents="auto">
                    <Text
                      style={[
                        styles.modalLabel,
                        { color: colors.text, marginBottom: 16 },
                      ]}
                    >
                      {t("settings.enterDateOfBirth")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        marginBottom: 12,
                      }}
                      pointerEvents="auto"
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalLabel,
                            {
                              color: isDark ? "#9A8E7A" : "#8A7B68",
                              fontSize: 12,
                              marginBottom: 6,
                            },
                          ]}
                        >
                          {t("settings.day")}
                        </Text>
                        <TextInput
                          style={[
                            styles.modalInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(12, 22, 42, 0.75)"
                                : "#FFFAF0",
                              color: colors.text,
                              borderColor: isDark
                                ? "rgba(255,250,240,0.12)"
                                : "#D4C0A0",
                              padding: 16,
                              fontSize: 16,
                              textAlign: "center",
                            },
                          ]}
                          value={dateInput.day}
                          onChangeText={(text) => {
                            const num = text.replace(/[^\d]/g, "");
                            const parsed = num === "" ? 0 : parseInt(num);
                            const isValid =
                              num === "" || (parsed >= 1 && parsed <= 31);
                            if (isValid) {
                              const newInput = {
                                ...dateInput,
                                day: num.slice(0, 2),
                              };
                              setDateInput(newInput);
                              updateDateFromInputs(newInput);
                            }
                          }}
                          placeholder={t("settings.dd")}
                          placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                          keyboardType="numeric"
                          maxLength={2}
                          editable={true}
                          selectTextOnFocus={false}
                        />
                      </View>
                      <View style={{ flex: 1 }} pointerEvents="box-none">
                        <Text
                          style={[
                            styles.modalLabel,
                            {
                              color: isDark ? "#9A8E7A" : "#8A7B68",
                              fontSize: 12,
                              marginBottom: 6,
                            },
                          ]}
                        >
                          {t("settings.month")}
                        </Text>
                        <TextInput
                          style={[
                            styles.modalInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(12, 22, 42, 0.75)"
                                : "#FFFAF0",
                              color: colors.text,
                              borderColor: isDark
                                ? "rgba(255,250,240,0.12)"
                                : "#D4C0A0",
                              padding: 16,
                              fontSize: 16,
                              textAlign: "center",
                            },
                          ]}
                          value={dateInput.month}
                          onChangeText={(text) => {
                            const num = text.replace(/[^\d]/g, "");
                            const parsed = num === "" ? 0 : parseInt(num);
                            const isValid =
                              num === "" || (parsed >= 1 && parsed <= 12);
                            if (isValid) {
                              const newInput = {
                                ...dateInput,
                                month: num.slice(0, 2),
                              };
                              setDateInput(newInput);
                              updateDateFromInputs(newInput);
                            }
                          }}
                          placeholder={t("settings.mm")}
                          placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                          keyboardType="numeric"
                          maxLength={2}
                          editable={true}
                          selectTextOnFocus={false}
                        />
                      </View>
                      <View style={{ flex: 1.5 }} pointerEvents="box-none">
                        <Text
                          style={[
                            styles.modalLabel,
                            {
                              color: isDark ? "#9A8E7A" : "#8A7B68",
                              fontSize: 12,
                              marginBottom: 6,
                            },
                          ]}
                        >
                          {t("settings.year")}
                        </Text>
                        <TextInput
                          style={[
                            styles.modalInput,
                            {
                              backgroundColor: isDark
                                ? "rgba(12, 22, 42, 0.75)"
                                : "#FFFAF0",
                              color: colors.text,
                              borderColor: isDark
                                ? "rgba(255,250,240,0.12)"
                                : "#D4C0A0",
                              padding: 16,
                              fontSize: 16,
                              textAlign: "center",
                            },
                          ]}
                          value={dateInput.year}
                          onChangeText={(text) => {
                            const num = text.replace(/[^\d]/g, "");
                            const currentYear = new Date().getFullYear();
                            // Allow partial inputs while typing (1-4 digits)
                            // Only validate full range when we have 4 digits
                            const isValid =
                              num === "" ||
                              (num.length <= 4 &&
                                (num.length < 4 ||
                                  (parseInt(num) >= 1900 &&
                                    parseInt(num) <= currentYear)));
                            if (isValid) {
                              const newInput = {
                                ...dateInput,
                                year: num.slice(0, 4),
                              };
                              setDateInput(newInput);
                              updateDateFromInputs(newInput);
                            }
                          }}
                          placeholder={t("settings.yyyy")}
                          placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                          keyboardType="numeric"
                          maxLength={4}
                          editable={true}
                          selectTextOnFocus={false}
                        />
                      </View>
                    </View>
                    {dateOfBirth && (
                      <Text
                        style={[
                          styles.modalLabel,
                          {
                            color: isDark ? "#6ee7b7" : "#059669",
                            fontSize: 14,
                            marginTop: 8,
                            textAlign: "center",
                          },
                        ]}
                      >
                        {(() => {
                          const month = String(
                            dateOfBirth.getMonth() + 1,
                          ).padStart(2, "0");
                          const day = String(dateOfBirth.getDate()).padStart(
                            2,
                            "0",
                          );
                          const year = dateOfBirth.getFullYear();
                          return `${month}/${day}/${year}`;
                        })()}
                      </Text>
                    )}
                  </View>
                ) : editModal === "phone" ? (
                  <View>
                    {/* Country Picker */}
                    <TouchableOpacity
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        },
                      ]}
                      onPress={() => {
                        setShowCountryPicker(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>
                          {phoneForm.countryFlag}
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 16 }}>
                          {phoneForm.countryName} {phoneForm.countryCode}
                        </Text>
                      </View>
                      <Feather
                        name="chevron-down"
                        size={20}
                        color={colors.text}
                      />
                    </TouchableOpacity>

                    {/* Phone Number Input */}
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={phoneForm.phoneNumber}
                      onChangeText={(text) =>
                        setPhoneForm({ ...phoneForm, phoneNumber: text })
                      }
                      placeholder={t("settings.enterPhoneNumber")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>
                ) : editModal === "password" ? (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.text }]}>
                      {t("settings.currentPassword")}
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.75)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor: isDark
                              ? "rgba(255,250,240,0.12)"
                              : "#D4C0A0",
                            paddingRight: 50,
                          },
                        ]}
                        value={passwordForm.currentPassword}
                        onChangeText={(text) =>
                          setPasswordForm({
                            ...passwordForm,
                            currentPassword: text,
                          })
                        }
                        placeholder={t("settings.enterCurrentPassword")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        secureTextEntry={!showPassword.current}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 12,
                          padding: 4,
                        }}
                        onPress={() =>
                          setShowPassword({
                            ...showPassword,
                            current: !showPassword.current,
                          })
                        }
                      >
                        <Feather
                          name={showPassword.current ? "eye" : "eye-off"}
                          size={20}
                          color={isDark ? "#8A7B68" : "#9A8E7A"}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[
                        styles.modalLabel,
                        { color: colors.text, marginTop: 16 },
                      ]}
                    >
                      {t("settings.newPassword")}
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.75)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor:
                              passwordForm.newPassword &&
                              !validatePassword(passwordForm.newPassword)
                                .isValid
                                ? isDark
                                  ? "#ef4444"
                                  : "#dc2626"
                                : isDark
                                  ? "rgba(255,250,240,0.12)"
                                  : "#D4C0A0",
                            paddingRight: 50,
                          },
                        ]}
                        value={passwordForm.newPassword}
                        onChangeText={(text) => {
                          setPasswordForm({
                            ...passwordForm,
                            newPassword: text,
                          });
                          const validation = validatePassword(text);
                          setPasswordErrors(validation.errors);
                        }}
                        placeholder={t("settings.enterNewPassword")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        secureTextEntry={!showPassword.new}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 12,
                          padding: 4,
                        }}
                        onPress={() =>
                          setShowPassword({
                            ...showPassword,
                            new: !showPassword.new,
                          })
                        }
                      >
                        <Feather
                          name={showPassword.new ? "eye" : "eye-off"}
                          size={20}
                          color={isDark ? "#8A7B68" : "#9A8E7A"}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Password Requirements */}
                    {passwordForm.newPassword.length > 0 && (
                      <View style={{ marginTop: 8, marginBottom: 8 }}>
                        <Text
                          style={[
                            styles.modalLabel,
                            {
                              color: colors.text,
                              fontSize: 12,
                              marginBottom: 8,
                            },
                          ]}
                        >
                          {t("settings.passwordRequirements")}:
                        </Text>
                        <View style={{ gap: 6 }}>
                          <RequirementItem
                            met={checkPasswordRequirement(
                              passwordForm.newPassword,
                              "minLength",
                            )}
                            text={t("auth.passwordRequirements.minLength")}
                            colors={colors}
                            isDark={isDark}
                          />
                          <RequirementItem
                            met={checkPasswordRequirement(
                              passwordForm.newPassword,
                              "uppercase",
                            )}
                            text={t("auth.passwordRequirements.uppercase")}
                            colors={colors}
                            isDark={isDark}
                          />
                          <RequirementItem
                            met={checkPasswordRequirement(
                              passwordForm.newPassword,
                              "lowercase",
                            )}
                            text={t("auth.passwordRequirements.lowercase")}
                            colors={colors}
                            isDark={isDark}
                          />
                          <RequirementItem
                            met={checkPasswordRequirement(
                              passwordForm.newPassword,
                              "number",
                            )}
                            text={t("auth.passwordRequirements.number")}
                            colors={colors}
                            isDark={isDark}
                          />
                          <RequirementItem
                            met={checkPasswordRequirement(
                              passwordForm.newPassword,
                              "special",
                            )}
                            text={t("auth.passwordRequirements.special")}
                            colors={colors}
                            isDark={isDark}
                          />
                        </View>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.modalLabel,
                        { color: colors.text, marginTop: 16 },
                      ]}
                    >
                      {t("settings.confirmPassword")}
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TextInput
                        style={[
                          styles.modalInput,
                          {
                            backgroundColor: isDark
                              ? "rgba(12, 22, 42, 0.75)"
                              : "#FFFAF0",
                            color: colors.text,
                            borderColor:
                              passwordForm.confirmPassword &&
                              passwordForm.newPassword !==
                                passwordForm.confirmPassword
                                ? isDark
                                  ? "#ef4444"
                                  : "#dc2626"
                                : passwordForm.confirmPassword &&
                                    passwordForm.newPassword ===
                                      passwordForm.confirmPassword
                                  ? isDark
                                    ? "#10b981"
                                    : "#059669"
                                  : isDark
                                    ? "rgba(255,250,240,0.12)"
                                    : "#D4C0A0",
                            paddingRight: 50,
                          },
                        ]}
                        value={passwordForm.confirmPassword}
                        onChangeText={(text) =>
                          setPasswordForm({
                            ...passwordForm,
                            confirmPassword: text,
                          })
                        }
                        placeholder={t("settings.enterConfirmPassword")}
                        placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                        secureTextEntry={!showPassword.confirm}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 12,
                          padding: 4,
                        }}
                        onPress={() =>
                          setShowPassword({
                            ...showPassword,
                            confirm: !showPassword.confirm,
                          })
                        }
                      >
                        <Feather
                          name={showPassword.confirm ? "eye" : "eye-off"}
                          size={20}
                          color={isDark ? "#8A7B68" : "#9A8E7A"}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.75)"
                          : "#FFFAF0",
                        color: colors.text,
                        borderColor: isDark
                          ? "rgba(255,250,240,0.12)"
                          : "#D4C0A0",
                      },
                    ]}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder={t("settings.enterEmailAddress")}
                    placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                )}

                {editModal && !showCountryPicker && (
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
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setEditModal(null)}
                    >
                      <Text
                        style={[styles.modalButtonText, { color: colors.text }]}
                      >
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
                          shadowColor: isDark ? "#C9963F" : colors.tint,
                        },
                      ]}
                      onPress={handleSaveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator
                          color={isDark ? "#F0E8D5" : "#FFFAF0"}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.modalButtonText,
                            { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                          ]}
                        >
                          {t("common.save")}
                        </Text>
                      )}
                    </TouchableButton>
                  </View>
                )}
              </View>
            </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Verification Modal */}
          <Modal
            visible={verificationModal !== null}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              setVerificationModal(null);
              setVerificationCode("");
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
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
                    {verificationModal === "email"
                      ? t("settings.verifyEmail")
                      : t("settings.verifyPhone")}
                  </Text>
                  <TouchableButton
                    onPress={() => {
                      setVerificationModal(null);
                      setVerificationCode("");
                    }}
                  >
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableButton>
                </View>

                {verificationModal === "email" ? (
                  <>
                    <Text
                      style={[
                        styles.modalDescription,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      {t("settings.verificationCodeEmailDescription")}
                    </Text>
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder={t("settings.enterVerificationCodeFromEmail")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableButton
                      style={[
                        styles.resendButton,
                        {
                          borderColor: colors.tint,
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.2)"
                            : "transparent",
                        },
                      ]}
                      onPress={requestEmailVerification}
                      disabled={isRequestingCode}
                    >
                      {isRequestingCode ? (
                        <ActivityIndicator color={colors.tint} />
                      ) : (
                        <Text
                          style={[
                            styles.resendButtonText,
                            { color: colors.tint },
                          ]}
                        >
                          {t("settings.resendVerificationEmail")}
                        </Text>
                      )}
                    </TouchableButton>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.modalDescription,
                        { color: isDark ? "#9A8E7A" : "#8A7B68" },
                      ]}
                    >
                      {t("settings.verificationCodePhoneDescription")}
                    </Text>
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          backgroundColor: isDark
                            ? "rgba(12, 22, 42, 0.75)"
                            : "#FFFAF0",
                          color: colors.text,
                          borderColor: isDark
                            ? "rgba(255,250,240,0.12)"
                            : "#D4C0A0",
                        },
                      ]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder={t("settings.enter6DigitCode")}
                      placeholderTextColor={isDark ? "#8A7B68" : "#9A8E7A"}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableButton
                      style={[
                        styles.resendButton,
                        {
                          borderColor: colors.tint,
                          backgroundColor: isDark
                            ? "rgba(201, 150, 63, 0.2)"
                            : "transparent",
                        },
                      ]}
                      onPress={requestPhoneVerification}
                      disabled={isRequestingCode}
                    >
                      {isRequestingCode ? (
                        <ActivityIndicator color={colors.tint} />
                      ) : (
                        <Text
                          style={[
                            styles.resendButtonText,
                            { color: colors.tint },
                          ]}
                        >
                          Resend Code
                        </Text>
                      )}
                    </TouchableButton>
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableButton
                    style={[
                      styles.modalButton,
                      styles.modalButtonCancel,
                      {
                        backgroundColor: isDark
                          ? "rgba(12, 22, 42, 0.75)"
                          : "#F5ECD8",
                        borderColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "transparent",
                        borderWidth: isDark ? 1 : 0,
                      },
                    ]}
                    onPress={() => {
                      setVerificationModal(null);
                      setVerificationCode("");
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, { color: colors.text }]}
                    >
                      {t("common.cancel")}
                    </Text>
                  </TouchableButton>
                  {(verificationModal === "phone" ||
                    verificationModal === "email") && (
                    <TouchableButton
                      style={[
                        styles.modalButton,
                        styles.modalButtonSave,
                        {
                          backgroundColor: isDark ? "#C9963F" : colors.tint,
                          borderColor: isDark ? "#C9963F" : colors.tint,
                          shadowColor: isDark ? "#C9963F" : colors.tint,
                        },
                      ]}
                      onPress={handleVerifyCode}
                      disabled={
                        isVerifying ||
                        (verificationModal === "phone"
                          ? verificationCode.length !== 6
                          : !verificationCode.trim())
                      }
                    >
                      {isVerifying ? (
                        <ActivityIndicator
                          color={isDark ? "#F0E8D5" : "#FFFAF0"}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.modalButtonText,
                            { color: isDark ? "#F0E8D5" : "#FFFAF0" },
                          ]}
                        >
                          {t("common.verify")}
                        </Text>
                      )}
                    </TouchableButton>
                  )}
                </View>
              </View>
            </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Language Selection Modal */}
          <Modal
            visible={showLanguageModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguageModal(false)}
          >
            <View style={styles.modalOverlay} pointerEvents="box-none">
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isDark
                      ? "rgba(12, 22, 42, 0.90)"
                      : "#FFFAF0",
                  },
                ]}
                pointerEvents="auto"
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {t("settings.selectLanguage")}
                  </Text>
                  <TouchableButton onPress={() => setShowLanguageModal(false)}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableButton>
                </View>

                <ScrollView style={{ maxHeight: 400 }}>
                  <TouchableButton
                    style={[
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "rgba(184,130,42,0.06)",
                      },
                      language === "en" && {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                    onPress={async () => {
                      await setLanguage("en");
                      setShowLanguageModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {t("settings.english")}
                    </Text>
                    {language === "en" && (
                      <Feather name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableButton>

                  <TouchableButton
                    style={[
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark
                          ? "rgba(201,150,63,0.12)"
                          : "rgba(184,130,42,0.06)",
                      },
                      language === "pt" && {
                        backgroundColor: isDark
                          ? "rgba(201, 150, 63, 0.2)"
                          : "rgba(201, 150, 63, 0.1)",
                      },
                    ]}
                    onPress={async () => {
                      await setLanguage("pt");
                      setShowLanguageModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {t("settings.portuguese")}
                    </Text>
                    {language === "pt" && (
                      <Feather name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableButton>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </GradientBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", letterSpacing: 1.5 },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#C9963F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 0,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase" as const,
    fontWeight: "800",
    marginBottom: 10,
  },

  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  titlePrimary: { fontSize: 18, fontWeight: "800" },
  subtitleSmall: { color: "#9A8E7A", fontSize: 12 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14 },
  valueBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  valueText: { fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  statusText: {
    color: "#FFFAF0",
    fontWeight: "700",
    textTransform: "capitalize",
    fontSize: 12,
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  signOutBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 0,
  },
  signOutText: { color: "#ef4444", fontWeight: "700" },
  editBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
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
    fontWeight: "700",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 0,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 0,
  },
  modalButtonCancel: {
    // backgroundColor set inline
  },
  modalButtonSave: {
    // backgroundColor set inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  resendButton: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOptionText: {
    fontSize: 16,
  },
});
