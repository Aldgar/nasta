import { Platform, ViewStyle } from 'react-native';

/**
 * Utility to remove Android's default square shadow/elevation that creates visible squares
 * Use this for all cards, buttons, and interactive elements on Android
 */
export const androidNoElevation = (style: ViewStyle = {}): ViewStyle => {
  if (Platform.OS === 'android') {
    return {
      ...style,
      elevation: 0,
      overflow: 'hidden' as const,
    };
  }
  return style;
};

/**
 * Helper to conditionally apply elevation only on iOS
 */
export const conditionalElevation = (iosElevation: number, androidElevation: number = 0) => {
  return Platform.OS === 'android' ? androidElevation : iosElevation;
};

