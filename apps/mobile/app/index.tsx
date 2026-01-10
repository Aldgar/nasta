import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import GradientBackground from "../components/GradientBackground";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { TouchableWithoutFeedback } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  FadeInDown,
  FadeInUp,
  FadeIn,
  Easing,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import Svg, { Path, G } from "react-native-svg";

export default function LandingPage() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // Animation values
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(0);
  const titleTranslateY = useSharedValue(50);
  const subtitleOpacity = useSharedValue(0);

  // Separate animations for text and tick mark
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const tickOpacity = useSharedValue(0);
  const tickScale = useSharedValue(0);
  const tickRotation = useSharedValue(-10);

  useEffect(() => {
    setMounted(true);

    // Animate text first
    textOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    textScale.value = withSequence(
      withTiming(1.1, { duration: 400, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) })
    );

    // Animate tick mark with bounce and rotation
    tickOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    tickScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        600,
        withTiming(1.3, { duration: 400, easing: Easing.out(Easing.back(1.5)) })
      ),
      withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) })
    );
    tickRotation.value = withSequence(
      withTiming(-10, { duration: 0 }),
      withDelay(
        600,
        withTiming(5, { duration: 300, easing: Easing.out(Easing.ease) })
      ),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) })
    );

    // Animate logo container
    logoScale.value = withTiming(1, { duration: 600 });
    logoOpacity.value = withTiming(1, { duration: 600 });

    // Floating animation for logo
    logoTranslateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Animate title
    titleTranslateY.value = withDelay(
      200,
      withTiming(0, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      })
    );

    // Animate subtitle
    subtitleOpacity.value = withDelay(
      400,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      })
    );
  }, []);

  // Check if user is already logged in (only on mount, not after logout)
  useEffect(() => {
    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync("auth_token");
      if (token) {
        // User is logged in, redirect will be handled by _layout.tsx
        return;
      }
    };
    checkAuth();
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value },
    ],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  const tickAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tickOpacity.value,
    transform: [
      { scale: tickScale.value },
      { rotate: `${tickRotation.value}deg` },
    ],
  }));

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <Animated.View
            entering={FadeIn.duration(600)}
            style={[styles.logoContainer, logoAnimatedStyle]}
          >
            <View style={styles.logoBackground}>
              {/* Wavy border - static */}
              <Svg
                width={180}
                height={180}
                viewBox="0 0 21496 8288"
                style={styles.logo}
                preserveAspectRatio="xMidYMid meet"
              >
                <Path
                  d="M2209.15 7854.13C2956.84 8235.25 3565.58 8334.38 4804.11 8268.72C4806.07 8268.61 4808.06 8268.31 4809.95 8267.82C5458.11 8100.47 5976.41 7736.13 6122.82 7668.13C6534.43 7476.97 7155.27 7373.58 7659.72 7505.59H7659.72C7871.57 7561.28 7940.19 7586.04 8228.68 7722.14L8228.68 7722.15C8589.74 7893.29 8902.39 8006.69 9279.59 8101.54L9279.59 8101.54C9679.86 8203.83 9921.26 8241.17 10378.2 8271.96L10389 8272.68C10994.1 8313.92 11605.3 8256.19 12216.5 8101.54C12596.7 8005.39 12905.5 7895.03 13270.9 7722.12L13279.5 7718.02C13522.6 7601.51 13704.7 7529.83 13885.5 7489.61C14066.4 7449.38 14246 7440.62 14484.1 7449.9L14484 7449.9C14919.9 7466.4 15172.1 7538.6 15557.5 7755.16H15557.5C16725.3 8412.89 18052.5 8462.37 19210.3 7887.12H19210.3C19728.6 7630.39 20138.9 7312.29 20497 6887.99L20501.2 6883C21047.7 6233.99 21390 5433.6 21480.4 4597.97L21481.5 4588.14C21509.5 4316.07 21493.8 3769.94 21450.2 3491.57L21449.2 3485.04C21124.4 1470.59 19464.4 0.5 17516 0.5C16797.9 0.500028 16229.2 161.314 15450.5 586.077C15094.8 781.259 14763.1 855.695 14313.8 839.967L14308.5 839.778C13939.3 827.403 13725.4 775.833 13388.4 619.085H13388.4C12684.5 291.229 12214.5 146.896 11526.6 47.9229C11354.2 23.183 11050.1 10.8105 10745.8 10.8105C10441.4 10.8105 10136.8 23.1831 9963.39 47.9229H9963.39C9265.47 151.02 8868.11 272.669 8063.26 637.646H8063.26C7768.67 771.712 7542.67 823.278 7205.73 839.777L7205.73 839.778C7003.98 848.028 6892.99 843.903 6733.58 817.088H6733.58C6436.97 765.523 6285.62 709.821 5853.91 487.103C5315.54 210.915 4987.69 103.215 4480.22 33.0762L4468.2 31.4268C4366.36 18.0269 4185.33 8.23244 4017.65 4.1084C3933.81 2.04644 3853.31 1.40167 3787.73 2.43262C3722.13 3.46375 3671.5 6.17139 3647.34 10.8008C3639.21 12.8738 3611.46 17.5142 3573.18 23.1777C3534.84 28.8491 3485.92 35.5515 3435.49 41.7383C2882.98 115.674 2314.46 332.814 1837.58 650.363L1831.97 654.104C883.812 1289.97 259.115 2256.51 46.126 3420.48L44.8809 3427.31C23.707 3544.81 9.08183 3760.27 3.28223 3982.98C-2.51721 4205.67 0.509305 4435.57 14.627 4581.95C111.445 5526.29 516.87 6404.65 1166.35 7074.75L1166.35 7074.75C1496.57 7414.35 1804.93 7646.36 2199.81 7849.34L2209.15 7854.13ZM19997.6 6258.8C19321.8 7182.74 18335.2 7669.5 17302.1 7589.06H17302.1C16843.7 7552.22 16534.2 7454.47 15985.6 7168.93L15972.5 7162.15C15474.2 6902.33 15162.6 6808.97 14631.7 6763.22L14619.1 6762.15C14290.4 6735.35 13987.8 6758.03 13632.9 6838.44H13632.9C13362.6 6900.29 13251.7 6941.52 12862.4 7120.92C12703 7195.15 12493.2 7283.83 12394.3 7318.9H12394.3C11361.4 7690.11 10132.7 7690.11 9101.78 7318.9C9002.91 7283.83 8813.27 7203.4 8680.12 7141.54L8680.12 7141.54C8308.96 6968.32 8159.71 6910.6 7895.5 6844.62C7102.83 6646.69 6265.47 6758.85 5593.91 7143.58C5521.82 7184.88 5463.79 7220.88 5422.02 7249.11C5409.5 7257.57 5375.38 7284.07 5341.14 7310.45C5306.92 7336.81 5272.57 7363.06 5259.64 7371L5043.85 7503.37C5040.42 7505.47 5036.61 7506.88 5032.64 7507.5L4502.94 7590.75C4501.37 7591 4499.75 7591.12 4498.16 7591.12C3749.3 7591.09 3398.58 7576.52 2969.26 7413.75H2969.26C1607.38 6894.01 707.556 5394.64 840.714 3862.29C883.081 3373.51 981.942 2994.03 1177.64 2577.42C1633.61 1606.04 2470.91 927.49 3441.38 741.867H3441.38C3594.69 712.999 3676.42 698.042 3757.65 691.596C3838.87 685.149 3919.6 687.213 4070.88 692.368L4070.88 692.369C4234.3 696.494 4419.92 715.054 4530.91 739.809L4530.91 739.81C4851.71 807.871 5055.5 886.25 5456.96 1094.54L5456.96 1094.54C5801.9 1272.9 6070.66 1384.75 6342.43 1449.18C6614.2 1513.6 6889.01 1530.62 7246.04 1519.28V1519.27C7522.38 1510 7723.57 1488.86 7932.31 1434.74C8141.05 1380.63 8357.37 1293.52 8663.99 1152.27V1152.26C9662.63 690.308 10689.5 570.693 11766.9 793.422L11766.9 793.423C12170.4 875.916 12475 981.099 12904.7 1185.26C13033.8 1245.06 13215.3 1321.35 13310.1 1356.4C13701.4 1496.59 14233.9 1562.57 14663.5 1525.46V1525.46C14926.8 1501.75 15125.4 1468.76 15329.6 1405.11C15533.8 1341.45 15743.6 1247.13 16029 1100.72V1100.72C16338.7 939.873 16570.2 838.295 16791.9 776.676C17013.6 715.054 17225.5 693.399 17495.8 692.368C17970.1 690.314 18350.3 776.256 18766.1 976.688L18771 979.052C19684.9 1420.42 20364.8 2319.63 20590.8 3381.75L20590.8 3381.75C20719.9 3996.35 20685.6 4660.44 20489.9 5281.21C20401.2 5569.96 20173.2 6019.55 19997.6 6258.8Z"
                  fill="#052353"
                  stroke="#FEFBFB"
                />
              </Svg>

              {/* Text paths - animated */}
              <Animated.View
                style={[StyleSheet.absoluteFill, textAnimatedStyle]}
              >
                <Svg
                  width={180}
                  height={180}
                  viewBox="0 0 21496 8288"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <G>
                    <Path
                      d="M17553 2047.71L17345.2 2121.94V2872.55C17345.2 3491.18 17341.1 3619.03 17319 3600.47C17262.5 3550.98 17087 3530.36 16947.8 3555.11C16778.3 3583.98 16647.2 3652.03 16524.2 3775.75C16261.9 4039.7 16140.9 4365.52 16159 4765.57C16171.1 5002.71 16219.5 5153.24 16328.5 5283.15C16441.4 5419.25 16556.4 5476.99 16731.9 5489.37C16863.1 5497.61 16893.3 5493.49 16992.2 5441.94C17107.1 5384.2 17236.3 5243.97 17300.8 5105.81C17319 5070.76 17339.1 5039.83 17347.2 5039.83C17353.3 5039.83 17363.3 5093.44 17369.4 5159.43C17383.5 5369.76 17496.5 5472.87 17708.3 5472.87C17839.4 5472.87 17942.3 5419.25 18049.2 5295.53C18140 5190.36 18148.1 5161.49 18101.7 5122.31C18075.4 5099.63 18061.3 5103.75 18014.9 5149.12C17934.2 5227.48 17861.6 5239.85 17821.3 5182.11C17793 5138.81 17789 4973.84 17789 3550.98C17789 2678.71 17782.9 1967.28 17774.9 1969.35C17764.8 1971.41 17665.9 2006.46 17553 2047.71ZM17276.6 3854.11L17345.2 3907.73V4243.85C17345.2 4862.48 17254.4 5136.74 17026.5 5204.79C16778.3 5283.15 16592.7 5050.14 16564.5 4627.4C16542.3 4262.41 16685.5 3928.35 16911.5 3819.06C17022.4 3765.44 17181.8 3779.88 17276.6 3854.11Z"
                      fill="#052353"
                    />
                    <Path
                      d="M15338 2365.27C15204.9 2410.64 15093.9 2449.82 15089.9 2451.88C15085.8 2453.94 15116.1 2633.34 15158.5 2847.8L15231.1 3239.6L15334 3208.67C15392.5 3192.17 15444.9 3173.62 15455 3165.37C15467.1 3152.99 15594.2 2293.09 15584.1 2284.85C15582.1 2282.78 15471.1 2319.9 15338 2365.27Z"
                      fill="#052353"
                    />
                    <Path
                      d="M2713.9 2711.7C2112.76 2794.19 1616.51 3266.41 1447.06 3915.97C1394.61 4116 1384.52 4513.98 1426.88 4689.26C1487.4 4944.97 1668.96 5219.23 1852.53 5338.83C2060.31 5470.8 2362.9 5522.36 2604.97 5464.62C2843.01 5406.88 3147.62 5217.16 3286.81 5037.76C3347.33 4959.4 3349.35 4953.21 3315.05 4916.1C3266.64 4862.48 3240.41 4864.54 3181.91 4928.47C3103.24 5013.01 2917.65 5118.18 2780.47 5155.3C2558.57 5213.04 2342.73 5149.11 2169.24 4973.83C1913.05 4711.95 1804.11 4148.99 1921.12 3689.14C1971.55 3497.36 2104.69 3239.6 2211.6 3126.19C2455.69 2870.48 2778.46 2868.42 2951.94 3117.94C3004.39 3196.3 3012.46 3229.29 3020.53 3371.58C3026.58 3522.11 3022.55 3548.92 2964.05 3668.52C2905.55 3790.18 2832.92 3872.67 2721.97 3946.9C2679.61 3975.77 2677.59 3984.02 2701.8 4025.26C2721.97 4056.2 2742.15 4066.51 2770.39 4058.26C2992.29 3994.33 3282.78 3734.51 3387.67 3507.68C3621.68 2996.27 3313.03 2629.22 2713.9 2711.7Z"
                      fill="#052353"
                    />
                    <Path
                      d="M5009.56 3596.35L4787.66 3672.64L4741.26 3948.97C4662.59 4433.56 4535.5 4839.8 4418.5 4982.08C4357.98 5056.32 4277.29 5093.44 4245.01 5060.44C4230.89 5046.01 4218.79 4819.18 4212.74 4404.69C4202.65 3786.06 4200.63 3769.56 4156.25 3693.27C4043.29 3509.74 3785.07 3487.06 3583.35 3643.78C3468.36 3734.51 3415.91 3827.3 3448.19 3882.98C3474.41 3922.16 3476.43 3922.16 3551.07 3852.05C3593.43 3812.87 3643.87 3781.94 3666.06 3781.94C3754.82 3781.94 3758.85 3810.81 3768.94 4573.79C3777.01 5215.1 3783.06 5305.84 3815.33 5363.57C3912.16 5547.1 4192.56 5534.73 4378.15 5338.83C4495.15 5215.1 4702.93 4740.82 4745.3 4499.55C4773.54 4336.64 4797.75 4400.57 4797.75 4641.84C4797.75 4942.9 4823.97 5190.36 4868.35 5303.77C4971.23 5565.66 5370.65 5518.23 5550.19 5223.35C5580.45 5171.8 5580.45 5165.61 5544.14 5132.62C5513.88 5103.75 5503.79 5103.75 5489.67 5126.43C5443.27 5208.92 5302.06 5254.28 5267.77 5198.61C5259.7 5186.23 5247.6 4802.68 5241.55 4346.95L5231.46 3520.05L5009.56 3596.35Z"
                      fill="#052353"
                    />
                    <Path
                      d="M5987.94 3575.72C5883.04 3627.28 5820.5 3682.95 5762 3777.81C5723.67 3841.74 5723.67 3849.99 5753.93 3880.92C5784.19 3911.85 5790.24 3909.79 5852.78 3847.92C5889.09 3810.81 5939.52 3781.94 5965.75 3781.94C6066.61 3781.94 6066.61 3796.37 6068.63 4676.89V5497.61L6135.2 5485.24C6169.49 5479.05 6264.3 5458.43 6342.98 5439.87L6488.22 5406.88L6502.34 5198.6C6532.6 4728.44 6617.33 4316.02 6726.26 4111.87C6790.81 3990.21 6833.17 3955.15 6883.61 3973.71C6911.85 3986.08 6915.88 4062.38 6915.88 4742.88V5497.61L6996.57 5483.18C7040.95 5474.93 7141.82 5454.31 7222.51 5433.68L7369.77 5400.69L7383.89 5122.31C7414.15 4483.05 7567.46 3967.53 7726.83 3967.53C7747 3967.53 7767.17 3986.08 7773.22 4012.89C7779.28 4039.7 7785.33 4324.27 7787.34 4648.02C7793.4 5198.6 7795.41 5239.85 7835.76 5307.9C7930.57 5474.93 8122.21 5520.29 8332.01 5425.44C8469.18 5361.51 8586.18 5210.98 8549.87 5140.87C8525.67 5097.56 8525.67 5097.56 8483.3 5138.8C8386.47 5227.47 8309.82 5246.03 8259.39 5192.42C8231.14 5165.61 8227.11 5068.69 8227.11 4460.37C8227.11 3802.56 8225.09 3755.13 8186.76 3678.83C8134.32 3573.66 8075.81 3534.48 7968.9 3534.48C7857.95 3534.48 7791.38 3569.54 7688.5 3685.02C7583.6 3800.49 7502.91 3963.4 7428.27 4204.67L7369.77 4390.26L7359.68 4050.01C7347.58 3678.83 7331.44 3614.9 7236.63 3563.35C7153.92 3520.05 7022.8 3526.23 6942.11 3577.79C6798.88 3668.52 6651.62 3911.85 6562.86 4204.67L6518.48 4349.02L6506.38 4066.51C6494.27 3755.13 6468.05 3664.4 6367.18 3588.1C6284.48 3526.23 6102.92 3522.11 5987.94 3575.72Z"
                      fill="#052353"
                    />
                    <Path
                      d="M9013.85 3557.17C8921.05 3596.35 8816.15 3680.89 8759.67 3763.38C8709.24 3839.68 8707.22 3847.92 8737.48 3878.86C8767.74 3909.79 8775.81 3907.73 8842.38 3847.92C8927.1 3769.56 8979.55 3765.44 9021.92 3827.3C9050.16 3868.55 9054.19 4037.64 9054.19 5260.47C9054.19 6023.45 9058.23 6648.27 9064.28 6648.27C9070.33 6648.27 9169.18 6615.27 9286.18 6574.03L9497.99 6499.8V5953.34C9497.99 5439.87 9500.01 5406.88 9534.3 5421.31C9859.08 5555.35 10191.9 5489.36 10411.8 5248.1C10599.4 5043.95 10690.2 4767.63 10690.2 4402.63C10690.2 4175.8 10653.9 4025.27 10563.1 3880.92C10391.6 3604.6 10083 3468.5 9857.07 3571.6C9736.03 3625.22 9617.01 3738.63 9556.49 3854.11C9530.27 3905.66 9502.03 3946.91 9495.97 3946.91C9487.91 3946.91 9477.82 3899.48 9473.78 3841.74C9455.63 3664.4 9342.66 3553.04 9171.19 3540.67C9112.69 3538.61 9042.09 3544.79 9013.85 3557.17ZM9978.1 3856.17C10194 3946.91 10304.9 4177.86 10304.9 4534.61C10304.9 4837.74 10208.1 5124.37 10076.9 5204.79C9963.98 5274.9 9736.03 5248.1 9661.39 5157.36C9647.27 5136.74 9627.1 5122.31 9619.03 5122.31C9610.96 5122.31 9582.72 5180.05 9556.49 5250.16L9508.08 5380.07L9502.03 4895.48C9495.97 4384.07 9512.11 4208.79 9580.7 4050.01C9669.46 3843.8 9800.58 3779.88 9978.1 3856.17Z"
                      fill="#052353"
                    />
                    <Path
                      d="M18987.2 3625.22C18579.8 3835.55 18333.6 4214.98 18333.6 4637.71C18333.6 5083.13 18622.1 5427.5 19051.8 5493.49C19592.4 5578.03 20060.4 5142.93 20102.8 4513.99C20127 4140.74 19949.5 3790.19 19659 3635.53L19529.9 3567.48L19390.7 3672.64C19314 3730.38 19225.3 3806.68 19193 3841.74C19140.6 3897.41 19138.5 3905.66 19172.8 3905.66C19285.8 3907.73 19489.5 4050.01 19612.6 4214.98C19876.9 4567.6 19828.4 5068.69 19517.8 5215.1C19253.5 5342.95 18999.3 5227.48 18860.2 4916.1C18805.7 4794.43 18789.6 4732.57 18781.5 4588.22C18763.3 4254.16 18856.1 4033.51 19126.4 3755.13C19255.5 3623.15 19279.7 3588.1 19261.6 3563.35C19223.3 3517.99 19178.9 3528.3 18987.2 3625.22Z"
                      fill="#052353"
                    />
                    <Path
                      d="M15348.1 3645.84L15156.4 3713.89L15150.4 4474.81C15146.4 5165.61 15150.4 5241.91 15180.6 5307.9C15235.1 5417.19 15331.9 5472.87 15467.1 5472.87C15616.4 5470.81 15719.3 5421.31 15838.3 5289.34C15935.1 5184.17 15937.1 5180.05 15900.8 5140.87C15870.6 5105.81 15860.5 5103.75 15842.3 5126.43C15771.7 5221.29 15646.6 5254.28 15610.3 5186.23C15598.2 5161.49 15590.2 4905.79 15590.2 4499.55C15590.2 3876.79 15578.1 3573.66 15551.8 3577.79C15545.8 3577.79 15453 3608.72 15348.1 3645.84Z"
                      fill="#052353"
                    />
                  </G>
                </Svg>
              </Animated.View>

              {/* Tick mark - animated separately */}
              <Animated.View
                style={[StyleSheet.absoluteFill, tickAnimatedStyle]}
              >
                <Svg
                  width={180}
                  height={180}
                  viewBox="0 0 21496 8288"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <Path
                    d="M15156.4 1872.42C15134.3 1886.86 14989 1981.72 14833.7 2082.76C14333.4 2408.57 13689.9 2911.73 13252.1 3317.96C12959.6 3590.16 12530 4033.51 12328.2 4270.66C12211.2 4410.88 12102.3 4524.3 12086.2 4524.3C12072 4524.3 11985.3 4454.18 11894.5 4367.58C11616.1 4101.56 11105.8 3685.02 10863.7 3528.3C10801.1 3487.06 10748.7 3495.3 10748.7 3544.79C10748.7 3561.29 10847.5 3726.26 10968.6 3911.85C11585.9 4852.17 11809.8 5345.02 11928.8 6029.64C11944.9 6126.55 11959.1 6242.03 11959.1 6289.46C11959.1 6386.38 12005.5 6442.06 12084.1 6442.06C12154.7 6442.06 12176.9 6407 12201.1 6264.72C12300 5693.51 12402.9 5408.94 12681.2 4936.72C12838.6 4668.64 13191.6 4171.68 13419.6 3895.35C13653.6 3612.84 13954.1 3266.41 14105.4 3101.44C14321.3 2868.42 15140.3 2033.27 15223 1961.09C15257.3 1930.16 15287.6 1890.98 15287.6 1874.49C15287.6 1837.37 15212.9 1835.31 15156.4 1872.42Z"
                    fill="#CC0909"
                  />
                </Svg>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Hero Section */}
          <Animated.View
            entering={FadeInUp.duration(800).delay(200)}
            style={styles.heroSection}
          >
            <Animated.Text
              style={[
                styles.heroTitle,
                { color: colors.text },
                titleAnimatedStyle,
              ]}
            >
              {t("landing.heroTitle")}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.heroSubtitle,
                { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
                subtitleAnimatedStyle,
              ]}
            >
              {t("landing.heroSubtitle")}
            </Animated.Text>
          </Animated.View>

          {/* Features Section */}
          <Animated.View
            entering={FadeInDown.duration(800).delay(400)}
            style={styles.featuresSection}
          >
            <FeatureCard
              icon="briefcase"
              title={t("landing.findJobs")}
              description={t("landing.findJobsDescription")}
              isDark={isDark}
              colors={colors}
              delay={500}
            />
            <FeatureCard
              icon="map-pin"
              title={t("landing.trackWork")}
              description={t("landing.trackWorkDescription")}
              isDark={isDark}
              colors={colors}
              delay={600}
            />
            <FeatureCard
              icon="credit-card"
              title={t("landing.getPaid")}
              description={t("landing.getPaidDescription")}
              isDark={isDark}
              colors={colors}
              delay={700}
            />
          </Animated.View>

          {/* CTA Buttons */}
          <Animated.View
            entering={FadeInUp.duration(800).delay(600)}
            style={styles.ctaSection}
          >
            <TouchableWithoutFeedback
              onPress={() => router.push("/register?role=JOB_SEEKER" as never)}
            >
              <View
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: isDark ? "#4f46e5" : colors.tint,
                    borderColor: isDark ? "#6366f1" : colors.tint,
                    shadowColor: isDark ? "#6366f1" : colors.tint,
                  },
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {t("landing.createAccount")}
                </Text>
              </View>
            </TouchableWithoutFeedback>

            <TouchableWithoutFeedback
              onPress={() => router.push("/login" as never)}
            >
              <View
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.9)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(0,0,0,0.1)",
                  },
                ]}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: colors.text }]}
                >
                  {t("landing.login")}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.duration(800).delay(800)}
            style={styles.footer}
          >
            <Text
              style={[
                styles.footerText,
                { color: isDark ? "rgba(255,255,255,0.5)" : "#94a3b8" },
              ]}
            >
              {t("landing.termsAgreement")}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  isDark,
  colors,
  delay = 0,
}: {
  icon: string;
  title: string;
  description: string;
  isDark: boolean;
  colors: any;
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(delay)}
      style={[
        styles.featureCard,
        {
          backgroundColor: isDark
            ? "rgba(30, 41, 59, 0.6)"
            : "rgba(255, 255, 255, 0.8)",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
        },
      ]}
    >
      <View
        style={[
          styles.featureIconContainer,
          {
            backgroundColor: isDark
              ? "rgba(79, 70, 229, 0.3)"
              : "rgba(79, 70, 229, 0.1)",
          },
        ]}
      >
        <Feather
          name={icon as any}
          size={24}
          color={isDark ? "#a5b4fc" : "#4f46e5"}
        />
      </View>
      <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
      <Text
        style={[
          styles.featureDescription,
          { color: isDark ? "rgba(255,255,255,0.7)" : "#64748b" },
        ]}
      >
        {description}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBackground: {
    backgroundColor: "transparent",
    borderRadius: 20,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 180,
  },
  heroSection: {
    marginBottom: 48,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresSection: {
    marginBottom: 40,
    gap: 16,
  },
  featureCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 3,
    overflow: "hidden",
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaSection: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: Platform.OS === "android" ? 0 : 5,
    overflow: "hidden",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === "android" ? 0 : 2,
    overflow: "hidden",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
