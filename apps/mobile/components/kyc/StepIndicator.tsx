import { View, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({
  currentStep,
  totalSteps,
}: StepIndicatorProps) {
  const { colors } = useTheme();
  const progress = currentStep / totalSteps;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%`, { duration: 300 }),
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: colors.input }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: colors.gold }, animatedStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});
