import { View, StyleSheet, Dimensions, Text } from "react-native";
import Svg, { Defs, Rect, Mask, Ellipse } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CameraOverlayProps {
  /** "document" for ID rectangle, "face" for selfie oval */
  type: "document" | "face";
  /** Guidance text shown below the frame */
  hint?: string;
}

// Document frame: credit-card aspect ratio (85.6mm × 53.98mm ≈ 1.586:1)
const DOC_FRAME_WIDTH = SCREEN_WIDTH * 0.85;
const DOC_FRAME_HEIGHT = DOC_FRAME_WIDTH / 1.586;
const DOC_FRAME_RADIUS = 12;

// Face oval dimensions
const FACE_OVAL_RX = SCREEN_WIDTH * 0.32;
const FACE_OVAL_RY = FACE_OVAL_RX * 1.35;

export default function CameraOverlay({ type, hint }: CameraOverlayProps) {
  const { colors } = useTheme();

  const overlayHeight =
    type === "document" ? DOC_FRAME_HEIGHT + 120 : FACE_OVAL_RY * 2 + 120;
  const centerY = overlayHeight / 2;
  const centerX = SCREEN_WIDTH / 2;

  return (
    <View
      style={[styles.container, { height: overlayHeight }]}
      pointerEvents="none"
    >
      <Svg
        width={SCREEN_WIDTH}
        height={overlayHeight}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Mask id="cutout">
            {/* White = visible (the overlay). Black = hidden (the cutout). */}
            <Rect
              x="0"
              y="0"
              width={SCREEN_WIDTH}
              height={overlayHeight}
              fill="white"
            />
            {type === "document" ? (
              <Rect
                x={(SCREEN_WIDTH - DOC_FRAME_WIDTH) / 2}
                y={centerY - DOC_FRAME_HEIGHT / 2}
                width={DOC_FRAME_WIDTH}
                height={DOC_FRAME_HEIGHT}
                rx={DOC_FRAME_RADIUS}
                ry={DOC_FRAME_RADIUS}
                fill="black"
              />
            ) : (
              <Ellipse
                cx={centerX}
                cy={centerY}
                rx={FACE_OVAL_RX}
                ry={FACE_OVAL_RY}
                fill="black"
              />
            )}
          </Mask>
        </Defs>

        {/* Semi-transparent overlay with cutout */}
        <Rect
          x="0"
          y="0"
          width={SCREEN_WIDTH}
          height={overlayHeight}
          fill="rgba(0,0,0,0.6)"
          mask="url(#cutout)"
        />

        {/* Frame border */}
        {type === "document" ? (
          <Rect
            x={(SCREEN_WIDTH - DOC_FRAME_WIDTH) / 2}
            y={centerY - DOC_FRAME_HEIGHT / 2}
            width={DOC_FRAME_WIDTH}
            height={DOC_FRAME_HEIGHT}
            rx={DOC_FRAME_RADIUS}
            ry={DOC_FRAME_RADIUS}
            fill="none"
            stroke={colors.gold}
            strokeWidth={2.5}
          />
        ) : (
          <Ellipse
            cx={centerX}
            cy={centerY}
            rx={FACE_OVAL_RX}
            ry={FACE_OVAL_RY}
            fill="none"
            stroke={colors.gold}
            strokeWidth={2.5}
          />
        )}
      </Svg>

      {hint && (
        <View
          style={[
            styles.hintContainer,
            {
              top:
                centerY +
                (type === "document" ? DOC_FRAME_HEIGHT / 2 : FACE_OVAL_RY) +
                16,
            },
          ]}
        >
          <Text style={[styles.hint, { color: "#fff" }]}>{hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  hintContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  hint: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export { DOC_FRAME_WIDTH, DOC_FRAME_HEIGHT, FACE_OVAL_RX, FACE_OVAL_RY };
