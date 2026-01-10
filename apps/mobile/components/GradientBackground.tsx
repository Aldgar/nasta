import React from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";

type Props = {
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

const { width, height } = Dimensions.get("window");

export default function GradientBackground({ children, contentStyle }: Props) {
  let isDark = false;
  try {
    const theme = useTheme();
    isDark = theme?.isDark || false;
  } catch (err) {
    console.log("GradientBackground: Theme context error:", err);
    isDark = false;
  }

  // Dark mode: Dark blue to purple gradient (similar to screenshot)
  const darkColors = ["#1e3a8a", "#3b82f6", "#7c3aed", "#9333ea"] as const;

  // Light mode: Light blue to light purple gradient
  const lightColors = ["#dbeafe", "#e0e7ff", "#f3e8ff", "#faf5ff"] as const;

  const gradientColors = (isDark ? darkColors : lightColors) as unknown as [
    string,
    string,
    ...string[],
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Additional gradient layers for depth */}
      <View
        style={[
          styles.topGlow,
          {
            backgroundColor: isDark
              ? "rgba(124, 58, 237, 0.3)"
              : "rgba(219, 234, 254, 0.4)",
          },
        ]}
      />

      <View
        style={[
          styles.bottomGlow,
          {
            backgroundColor: isDark
              ? "rgba(59, 130, 246, 0.2)"
              : "rgba(224, 231, 255, 0.3)",
          },
        ]}
      />

      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  topGlow: {
    position: "absolute",
    top: -height * 0.4,
    left: -width * 0.2,
    width: width * 1.4,
    height: height * 0.9,
    borderRadius: width,
    opacity: 0.4,
    transform: [{ rotate: "-15deg" }],
  },
  bottomGlow: {
    position: "absolute",
    bottom: -height * 0.3,
    right: -width * 0.2,
    width: width * 1.3,
    height: height * 0.7,
    borderRadius: width,
    opacity: 0.3,
    transform: [{ rotate: "25deg" }],
  },
});
