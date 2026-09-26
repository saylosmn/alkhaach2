/**
 * АЛХААЧ — Тарваа (Blender-ээр загварчилсан 3D дүр)
 *
 * <Character weight={0..100} color="#hex" size={px}
 *            expr="calm|happy|tired|surprised|sleep"
 *            animate morph />
 *
 * Дүрийг design/tarvaga/build_tarvaga.py (Blender) жингийн 21 түвшинд (5 алхамтай)
 * рендерлэж, түвшин бүрийг хоёр давхарга болгосон (compose_layers.py):
 *   scarf — цагаан ороолт; `tintColor`-оор хэрэглэгчийн өнгөөр будагдана
 *   body  — ороолтоос бусад бүх хэсэг + ороолтын 3D сүүдэр + газрын сүүдэр
 * Тиймээс өнгө солиход ч ороолтын гэрэл сүүдэр, сүлжмэл хээ хадгалагдана.
 */
import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { TARVAGA_ASPECT, TARVAGA_FRAMES, type TarvagaFrame } from "./tarvagaFrames";

type Expr = "calm" | "happy" | "tired" | "surprised" | "sleep";

type Props = {
  weight: number; // 0–100
  color?: string; // ороолтын өнгө
  expr?: Expr; // 3D дүрд одоогоор зөвхөн "sleep" (нүд аньсан) ялгаатай
  size?: number;
  animate?: boolean;
  morph?: boolean;
  testID?: string;
};

const STEP = 100 / (TARVAGA_FRAMES.length - 1);

function frameIndex(weight: number): number {
  const w = Math.max(0, Math.min(100, Number.isFinite(weight) ? weight : 50));
  return Math.round(w / STEP);
}

/* Жин өөрчлөгдөхөд 0.9 сек-т түвшин бүрээр дамжин шилжинэ. */
function useMorphFrame(weight: number, enabled: boolean): number {
  const target = frameIndex(weight);
  const [index, setIndex] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (!enabled || current.current === target) {
      current.current = target;
      setIndex(target);
      return;
    }
    const from = current.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      if (next !== current.current) {
        current.current = next;
        setIndex(next);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return index;
}

function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 120);
      }, 4000 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);
  return blinking;
}

/* Аньсан нүд: зовхины өнгөтэй эллипс + доогуураа нимгэн зураас. */
function Lids({ frame, width, height }: { frame: TarvagaFrame; width: number; height: number }) {
  return (
    <>
      {frame.eyes.map((e, i) => {
        const rx = e.rx * width * 1.3;
        const ry = e.ry * height * 1.3;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: e.x * width - rx,
              top: e.y * height - ry,
              width: rx * 2,
              height: ry * 2,
              borderRadius: rx,
              backgroundColor: frame.lid,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: rx * 1.25,
                height: Math.max(1, ry * 0.22),
                borderRadius: ry,
                backgroundColor: "#2A1E18",
                marginTop: ry * 0.35,
              }}
            />
          </View>
        );
      })}
    </>
  );
}

export function Character({
  weight,
  color = "#12A87E",
  expr = "calm",
  size = 160,
  animate = true,
  morph = true,
  testID,
}: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const motion = animate && !reducedMotion;
  const index = useMorphFrame(weight, morph && !reducedMotion);
  const frame = TARVAGA_FRAMES[index];
  const blinking = useBlink(motion && size >= 60 && expr !== "sleep");

  const width = size;
  const height = size * TARVAGA_ASPECT;
  // Жижиг дүрсийг (бүлгийн жагсаалт) Android дээр жижгээр decode хийж санах ой хэмнэнэ
  const resizeMethod = size < 90 ? "resize" : "auto";
  // Хэмжээг тодорхой өгнө: absoluteFill дангаараа вэб дээр зургийн анхны хэмжээг авдаг
  const layer = { position: "absolute" as const, left: 0, top: 0, width, height };

  /* амьсгал — хөлөө газарт тулгуулан бага зэрэг томорно */
  const breath = useSharedValue(1);
  useEffect(() => {
    if (motion) {
      breath.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      breath.value = 1;
    }
  }, [motion, breath]);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  return (
    <Animated.View style={[{ width, height, transformOrigin: "bottom" }, breathStyle]} testID={testID}>
      <Image
        source={frame.scarf}
        style={[layer, { tintColor: color }]}
        resizeMethod={resizeMethod}
        fadeDuration={0}
      />
      <Image
        source={frame.body}
        style={layer}
        resizeMethod={resizeMethod}
        fadeDuration={0}
        accessibilityIgnoresInvertColors={Platform.OS === "ios"}
      />
      {(blinking || expr === "sleep") && <Lids frame={frame} width={width} height={height} />}
    </Animated.View>
  );
}
