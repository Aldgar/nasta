import React, { useState } from "react";
import {
  Image,
  Text,
  View,
  ImageStyle,
  TextStyle,
  ViewStyle,
  useColorScheme,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface AvatarImageProps {
  uri: string | null | undefined;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
  iconSize?: number;
  fallbackText?: string;
  fallbackTextStyle?: TextStyle;
}

export default function AvatarImage({
  uri,
  size = 48,
  borderRadius,
  style,
  iconSize,
  fallbackText,
  fallbackTextStyle,
}: AvatarImageProps) {
  const [failed, setFailed] = useState(false);
  const isDark = useColorScheme() === "dark";

  const resolvedRadius = borderRadius ?? size / 2;
  const resolvedIconSize = iconSize ?? Math.round(size * 0.5);
  const baseShape: ImageStyle = {
    width: size,
    height: size,
    borderRadius: resolvedRadius,
  };
  const containerStyle: ViewStyle = {
    ...baseShape,
    overflow: "hidden",
  };

  if (!uri || failed) {
    return (
      <View
        style={[
          containerStyle,
          {
            backgroundColor: isDark ? "rgba(201,150,63,0.12)" : "#F0E8D5",
            justifyContent: "center",
            alignItems: "center",
          },
          style,
        ]}
      >
        {fallbackText ? (
          <Text
            style={[
              {
                fontSize: Math.round(size * 0.36),
                fontWeight: "800",
                color: isDark ? "#C9963F" : "#9A8E7A",
              },
              fallbackTextStyle,
            ]}
          >
            {fallbackText}
          </Text>
        ) : (
          <Feather
            name="user"
            size={resolvedIconSize}
            color={isDark ? "#C9963F" : "#B8860B"}
          />
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[baseShape, style as ImageStyle]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
