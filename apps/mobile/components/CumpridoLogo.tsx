import React from 'react';
import Svg, { Path, Text, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface CumpridoLogoProps {
  width?: number;
  height?: number;
  style?: any;
}

export default function CumpridoLogo({ width = 400, height = 120, style }: CumpridoLogoProps) {
  const { isDark } = useTheme();
  const blueColor = isDark ? '#3b82f6' : '#1e3a8a';
  const textColor = isDark ? '#e2e8f0' : '#1e3a8a';
  const borderColor = isDark ? '#60a5fa' : '#1e3a8a';

  return (
    <Svg width={width} height={height} viewBox="0 0 400 120" style={style}>
      <Defs>
        <LinearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={blueColor} stopOpacity="1" />
          <Stop offset="100%" stopColor={isDark ? '#2563eb' : '#1e40af'} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      
      {/* Wavy cloud-like border with 3 distinct bumps on top and bottom */}
      <Path
        d="M 15 30 
           Q 25 15, 45 20
           Q 65 25, 90 22
           Q 115 19, 140 23
           Q 165 27, 190 22
           Q 215 17, 240 23
           Q 265 29, 290 22
           Q 315 15, 340 23
           Q 360 28, 385 30
           L 385 90
           Q 360 95, 340 93
           Q 315 91, 290 97
           Q 265 103, 240 97
           Q 215 91, 190 97
           Q 165 103, 140 97
           Q 115 91, 90 97
           Q 65 103, 45 98
           Q 25 93, 15 90
           Z"
        fill="none"
        stroke={borderColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Text: Cumprido with checkmark on the 'i' */}
      <G transform="translate(200, 70)">
        {/* Cump */}
        <Text
          x="-75"
          y="0"
          fontFamily="Arial, sans-serif"
          fontSize="40"
          fontWeight="700"
          fill={textColor}
          textAnchor="middle"
        >
          Cump
        </Text>
        
        {/* r */}
        <Text
          x="-20"
          y="0"
          fontFamily="Arial, sans-serif"
          fontSize="40"
          fontWeight="700"
          fill={textColor}
          textAnchor="middle"
        >
          r
        </Text>
        
        {/* i with red checkmark as dot */}
        <G>
          <Text
            x="5"
            y="0"
            fontFamily="Arial, sans-serif"
            fontSize="40"
            fontWeight="700"
            fill={textColor}
            textAnchor="middle"
          >
            i
          </Text>
          {/* Red checkmark replacing the dot on 'i' */}
          <Path
            d="M 8 -8 L 12 -4 L 18 -12"
            stroke="#ef4444"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
        
        {/* do */}
        <Text
          x="30"
          y="0"
          fontFamily="Arial, sans-serif"
          fontSize="40"
          fontWeight="700"
          fill={textColor}
          textAnchor="middle"
        >
          do
        </Text>
      </G>
    </Svg>
  );
}
