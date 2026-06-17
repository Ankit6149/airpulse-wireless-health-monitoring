// mobile/src/components/VitalsChart.tsx
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';

interface VitalsChartProps {
  amplitudeHistory: number[];
  respirationHistory: number[];
  width?: number;
  height?: number;
}

export function VitalsChart({
  amplitudeHistory,
  respirationHistory,
  width = Dimensions.get('window').width - 48,
  height = 180,
}: VitalsChartProps) {
  
  // Normalizes values to fit within the chart container height
  const getPathData = (data: number[], scaleY: number, offset: number, fill = false) => {
    if (data.length === 0) return '';
    
    const maxVal = Math.max(...data, 1.0);
    const minVal = Math.min(...data, -1.0);
    const range = Math.max(maxVal - minVal, 1.0);
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      // Map value to fit height
      const normalized = (val - minVal) / range; // 0 to 1
      const y = height - (normalized * (height - 30) + 15);
      return { x, y };
    });

    if (points.length === 0) return '';

    let pathStr = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathStr += ` L ${points[i].x} ${points[i].y}`;
    }

    if (fill) {
      pathStr += ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    }

    return pathStr;
  };

  const ampLine = getPathData(amplitudeHistory, 1.0, 0, false);
  const ampFill = getPathData(amplitudeHistory, 1.0, 0, true);
  const respLine = getPathData(respirationHistory, 1.0, 0, false);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="ampGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* 1. Dotted Background Grid Lines */}
        {[0.25, 0.5, 0.75].map((ratio, index) => {
          const y = height * ratio;
          return (
            <Line
              key={index}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
              strokeDasharray="4, 4"
            />
          );
        })}

        {/* 2. Raw CSI Amplitude (Indigo Solid Line + Fading Gradient) */}
        {ampFill ? (
          <Path d={ampFill} fill="url(#ampGrad)" />
        ) : null}
        {ampLine ? (
          <Path d={ampLine} fill="none" stroke="#6366f1" strokeWidth="1.5" />
        ) : null}

        {/* 3. Filtered Respiration Waveform (Cyan Solid Line) */}
        {respLine ? (
          <Path d={respLine} fill="none" stroke="#06b6d4" strokeWidth="2" />
        ) : null}

        {/* 4. Guideline labels */}
        <SvgText
          x="10"
          y="20"
          fill="rgba(255, 255, 255, 0.4)"
          fontSize="10"
          fontWeight="bold"
        >
          Raw CSI (Indigo) / Respiration (Cyan)
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 15, 30, 0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
    marginTop: 8,
  },
});
