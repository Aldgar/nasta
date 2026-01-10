import { Stack } from "expo-router";

export default function CandidateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTransparent: true,
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          title: "",
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}

