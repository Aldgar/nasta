import { Stack } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { KycProvider } from "../../context/KycContext";

export default function KycLayout() {
  const { colors } = useTheme();

  return (
    <KycProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </KycProvider>
  );
}
