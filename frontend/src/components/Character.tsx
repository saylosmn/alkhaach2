import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Ellipse, Circle, Path, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useReducedMotion,
  Easing,
} from "react-native-reanimated";
import { palette, lerp, weightColor } from "@/src/theme";

type Props = {
  weight: number; // 0–100
  color?: string; // хэрэглэгчийн сонгосон өнгө (малгай)
  size?: number;
  animate?: boolean; // амьсгалын анимац
  morph?: boolean; // жин өөрчлөгдөхөд 900ms шилжилт
  testID?: string;
};

// 900ms жигд шилжилт (reduced-motion үед шууд)
function useMorphWeight(target: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(target);
  const startRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startRef.current) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);

  return value;
}

export function Character({
  weight,
  color = "#12A87E",
  size = 160,
  animate = true,
  morph = true,
  testID,
}: Props) {
  const reducedMotion = useReducedMotion();
  const w = useMorphWeight(
    Math.max(0, Math.min(100, weight)),
    morph && !reducedMotion,
  );
  const t = w / 100;

  // Амьсгал: 3.2 сек тутамд 2%
  const breath = useSharedValue(1);
  useEffect(() => {
    if (animate && !reducedMotion) {
      breath.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      breath.value = 1;
    }
  }, [animate, reducedMotion, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  // Геометр — viewBox 120×140
  const cx = 60;
  const bodyW = lerp(40, 96, t);
  const bodyH = lerp(92, 62, t);
  const rx = bodyW / 2;
  const ry = bodyH / 2;
  const bottomY = 124;
  const cy = bottomY - 12 - ry;
  const fill = weightColor(w);

  // Нүд
  const eyeGap = lerp(13, 23, t);
  const eyeY = cy - ry * 0.32;
  const eyeR = lerp(2.8, 3.4, t);

  // Ам: инээмсэглэл → тэгш
  const mouthW = lerp(12, 17, t);
  const mouthY = eyeY + lerp(11, 9, t);
  const mouthCurve = lerp(7, -2.5, t);

  // Хөл
  const legOff = lerp(9, 18, t);
  const legH = lerp(14, 10, t);

  // Гар
  const armY = cy + ry * 0.05;
  const armRy = lerp(11, 8, t);

  // Малгай (хэрэглэгчийн өнгө)
  const topY = cy - ry;
  const capW = lerp(13, 17, t);

  return (
    <Animated.View style={breathStyle} testID={testID}>
      <View style={{ width: size, height: size * (140 / 120) }}>
        <Svg width="100%" height="100%" viewBox="0 0 120 140">
          {/* Хөл */}
          <Rect
            x={cx - legOff - 4.5}
            y={bottomY - legH}
            width={9}
            height={legH + 2}
            rx={4.5}
            fill={fill}
            stroke={palette.ink}
            strokeWidth={2}
          />
          <Rect
            x={cx + legOff - 4.5}
            y={bottomY - legH}
            width={9}
            height={legH + 2}
            rx={4.5}
            fill={fill}
            stroke={palette.ink}
            strokeWidth={2}
          />
          {/* Гар */}
          <Ellipse
            cx={cx - rx - 2}
            cy={armY}
            rx={4.5}
            ry={armRy}
            fill={fill}
            stroke={palette.ink}
            strokeWidth={2}
            transform={`rotate(${lerp(14, 24, t)} ${cx - rx - 2} ${armY})`}
          />
          <Ellipse
            cx={cx + rx + 2}
            cy={armY}
            rx={4.5}
            ry={armRy}
            fill={fill}
            stroke={palette.ink}
            strokeWidth={2}
            transform={`rotate(${-lerp(14, 24, t)} ${cx + rx + 2} ${armY})`}
          />
          {/* Бие */}
          <Ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={fill}
            stroke={palette.ink}
            strokeWidth={2.2}
          />
          {/* Малгай */}
          <Path
            d={`M ${cx - capW} ${topY + 7} A ${capW} ${capW * 0.75} 0 0 1 ${cx + capW} ${topY + 7} Z`}
            fill={color}
            stroke={palette.ink}
            strokeWidth={2}
          />
          <Circle cx={cx} cy={topY - capW * 0.55 + 6} r={3} fill={color} stroke={palette.ink} strokeWidth={1.6} />
          {/* Нүд */}
          <Circle cx={cx - eyeGap / 2} cy={eyeY} r={eyeR} fill={palette.ink} />
          <Circle cx={cx + eyeGap / 2} cy={eyeY} r={eyeR} fill={palette.ink} />
          {/* Ам */}
          <Path
            d={`M ${cx - mouthW / 2} ${mouthY} Q ${cx} ${mouthY + mouthCurve} ${cx + mouthW / 2} ${mouthY}`}
            stroke={palette.ink}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
