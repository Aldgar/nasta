import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";

/**
 * TouchableOpacity with Android ripple effect disabled
 * Use this instead of TouchableOpacity to prevent blue square ripple on Android
 */
export const TouchableButton = React.forwardRef<any, TouchableOpacityProps>(
  (props, ref) => {
    return <TouchableOpacity {...props} ref={ref} activeOpacity={0.7} />;
  }
);

TouchableButton.displayName = "TouchableButton";
