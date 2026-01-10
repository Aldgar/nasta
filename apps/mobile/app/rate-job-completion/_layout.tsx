import { Stack } from "expo-router";

export default function RateJobCompletionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="service-provider" options={{ headerShown: false }} />
      <Stack.Screen name="employer" options={{ headerShown: false }} />
    </Stack>
  );
}

