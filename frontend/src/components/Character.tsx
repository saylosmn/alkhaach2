/**
 * АЛХААЧ — Тарваа (3D-загварчилсан SVG тарвага)
 *
 * <Character weight={0..100} color="#hex" size={px}
 *            expr="calm|happy|tired|surprised|sleep"
 *            animate morph />
 *
 * viewBox 0 0 240 260.  Бүх хэмжигдэхүүн weight-ээс шугаман интерполяциар.
 * Растр зураг, sprite sheet, Three.js ашиглаагүй — цэвэр SVG.
 */
import React, { useEffect, useRef, useState, useMemo } from "react";
import { View } from "react-native";
import Svg, {
  Defs, G, Ellipse, Circle, Path, Rect, Line,
  RadialGradient, LinearGradient, Stop, ClipPath,
} from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence,
  useReducedMotion, Easing,
} from "react-native-reanimated";
import { lerp } from "@/src/theme";

/* ─── types ─── */
type Expr = "calm" | "happy" | "tired" | "surprised" | "sleep";

type Props = {
  weight: number;           // 0–100
  color?: string;           // ороолтын өнгө
  expr?: Expr;
  size?: number;
  animate?: boolean;
  morph?: boolean;
  testID?: string;
};

/* ─── helpers ─── */
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function hexToRgb(h: string) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function mix(c1: string, c2: string, t: number) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

/* ─── morph transition ─── */
function useMorphWeight(target: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    fromRef.current = value;
    startRef.current = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startRef.current) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);
  return value;
}

/* ─── blink ─── */
function useBlink(animate: boolean, reducedMotion: boolean) {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!animate || reducedMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); schedule(); }, 120);
      }, 4000 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [animate, reducedMotion]);
  return blinking;
}

/* ─── fur palette ─── */
function furColors(t: number) {
  return {
    light:     mix("#DCD4C2", "#F5CE82", t),
    base:      mix("#B3A78F", "#D9993A", t),
    dark:      mix("#6B6252", "#8E5A16", t),
    belly:     mix("#E7DFCE", "#F8E5B9", t),
    nose:      "#2E2621",
    contour:   "#191F1B",
  };
}

/* ════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════ */
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
  const w = useMorphWeight(clamp01(weight / 100) * 100, morph && !reducedMotion);
  const t = w / 100; // 0→1

  const blinking = useBlink(animate, reducedMotion);

  /* ─── breath ─── */
  const breath = useSharedValue(1);
  useEffect(() => {
    if (animate && !reducedMotion) {
      breath.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0,  { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ), -1,
      );
    } else { breath.value = 1; }
  }, [animate, reducedMotion, breath]);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  /* ─── geometry ─── */
  const CX = 120, GROUND = 238, BODY_CY = 170;
  const bodyHW = lerp(46, 93, t);          // биеийн хагас өргөн
  const bodyHH = lerp(72, 60, t);          // биеийн хагас өндөр
  const headCY = BODY_CY - lerp(0.80, 0.60, t) * bodyHH;
  const headHW = lerp(35, 47, t);          // толгойн хагас өргөн
  const headHH = lerp(33, 39, t);          // толгойн хагас өндөр
  const earR   = lerp(13.5, 11.5, t);
  const eyeR   = lerp(9.0, 7.6, t) * (expr === "surprised" ? 1.16 : 1);
  const earCX  = 0.70 * headHW;
  const earCY  = -0.70 * headHH;
  const eyeCX  = 0.44 * headHW;
  const eyeCY  = -0.16 * headHH;
  const noseCY = 0.20 * headHH;
  const scarfCY = 0.72 * headHH;
  const pawX   = 0.50 * bodyHW;
  const pawBY  = BODY_CY + 0.32 * bodyHH;
  const fpRx   = lerp(15, 18, t), fpRy = lerp(17, 15, t);
  const hindX  = 0.44 * bodyHW;
  const hindRx = lerp(20, 26, t), hindRy = 9.5;
  const tailX  = 0.98 * bodyHW;
  const tailBY = BODY_CY + 0.44 * bodyHH;

  const fur = useMemo(() => furColors(t), [t]);
  const showFull = size >= 92;
  const showMed = size >= 50;

  /* ─── unique ID prefix ─── */
  const uid = useRef(`m${Math.random().toString(36).slice(2, 7)}`).current;
  const id = (s: string) => `${uid}_${s}`;

  /* ─── scarf darken / lighten ─── */
  const scarfDark = mix(color, "#000000", 0.30);
  const scarfLight = mix(color, "#FFFFFF", 0.22);

  return (
    <Animated.View style={breathStyle} testID={testID}>
      <View style={{ width: size, height: size * (260 / 240) }}>
        <Svg width="100%" height="100%" viewBox="0 0 240 260">
          <Defs>
            {/* ─── fur radial gradient ─── */}
            <RadialGradient id={id("furMain")}
              cx={CX - bodyHW * 0.42} cy={headCY - headHH * 0.3}
              rx={bodyHW * 1.8} ry={bodyHH * 2.2}
              fx={CX - bodyHW * 0.42} fy={headCY - headHH * 0.3}
            >
              <Stop offset="0" stopColor={fur.light} />
              <Stop offset="0.42" stopColor={fur.base} />
              <Stop offset="1" stopColor={fur.dark} />
            </RadialGradient>

            {/* belly spot */}
            <RadialGradient id={id("belly")}
              cx={CX} cy={BODY_CY + bodyHH * 0.05}
              rx={bodyHW * 0.55} ry={bodyHH * 0.6}
              fx={CX} fy={BODY_CY + bodyHH * 0.05}
            >
              <Stop offset="0" stopColor={fur.belly} stopOpacity="0.85" />
              <Stop offset="1" stopColor={fur.belly} stopOpacity="0" />
            </RadialGradient>

            {/* bottom shadow */}
            <RadialGradient id={id("botShadow")}
              cx={CX} cy={BODY_CY + bodyHH * 0.7}
              rx={bodyHW * 0.9} ry={bodyHH * 0.5}
              fx={CX} fy={BODY_CY + bodyHH * 0.7}
            >
              <Stop offset="0" stopColor={fur.dark} stopOpacity="0.62" />
              <Stop offset="1" stopColor={fur.dark} stopOpacity="0" />
            </RadialGradient>

            {/* rim light */}
            <RadialGradient id={id("rim")}
              cx={CX + bodyHW * 0.55} cy={BODY_CY - bodyHH * 0.5}
              rx={bodyHW * 0.7} ry={bodyHH * 0.7}
              fx={CX + bodyHW * 0.55} fy={BODY_CY - bodyHH * 0.5}
            >
              <Stop offset="0" stopColor={fur.light} stopOpacity="0.55" />
              <Stop offset="1" stopColor={fur.light} stopOpacity="0" />
            </RadialGradient>

            {/* nose bridge light */}
            <RadialGradient id={id("noseBridge")}
              cx={CX} cy={headCY - headHH * 0.1}
              rx={headHW * 0.4} ry={headHH * 0.45}
              fx={CX} fy={headCY - headHH * 0.1}
            >
              <Stop offset="0" stopColor={fur.belly} stopOpacity="0.7" />
              <Stop offset="1" stopColor={fur.belly} stopOpacity="0" />
            </RadialGradient>

            {/* ground shadow */}
            <RadialGradient id={id("gndShadow")}
              cx={CX} cy={GROUND} rx={bodyHW * 0.85} ry={12}
              fx={CX} fy={GROUND}
            >
              <Stop offset="0" stopColor={fur.contour} stopOpacity="0.26" />
              <Stop offset="1" stopColor={fur.contour} stopOpacity="0" />
            </RadialGradient>

            {/* ear inner gradient */}
            <RadialGradient id={id("earInner")}
              cx="50%" cy="40%" rx="50%" ry="50%"
            >
              <Stop offset="0" stopColor={fur.dark} stopOpacity="0.5" />
              <Stop offset="1" stopColor={fur.dark} stopOpacity="0.15" />
            </RadialGradient>

            {/* scarf gradient */}
            <LinearGradient id={id("scarf")} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={scarfLight} />
              <Stop offset="0.5" stopColor={color} />
              <Stop offset="1" stopColor={scarfDark} />
            </LinearGradient>

            {/* ─── clip: body + head + ears ─── */}
            <ClipPath id={id("bodyClip")}>
              {/* tail */}
              <Ellipse cx={CX + tailX} cy={tailBY} rx={25} ry={12.5}
                       transform={`rotate(32 ${CX + tailX} ${tailBY})`} />
              {/* hind paws */}
              <Ellipse cx={CX - hindX} cy={GROUND - 7} rx={hindRx} ry={hindRy} />
              <Ellipse cx={CX + hindX} cy={GROUND - 7} rx={hindRx} ry={hindRy} />
              {/* ears */}
              <Circle cx={CX - earCX} cy={headCY + earCY} r={earR} />
              <Circle cx={CX + earCX} cy={headCY + earCY} r={earR} />
              {/* body */}
              <Ellipse cx={CX} cy={BODY_CY} rx={bodyHW} ry={bodyHH} />
              {/* head */}
              <Ellipse cx={CX} cy={headCY} rx={headHW} ry={headHH} />
            </ClipPath>
          </Defs>

          {/* 1 ── ground shadow ── */}
          <Ellipse cx={CX} cy={GROUND} rx={bodyHW * 0.85} ry={10}
                   fill={`url(#${id("gndShadow")})`} />

          {/* 2 ── contour layer ── */}
          <G strokeWidth={7.5} stroke={fur.contour} fill={fur.contour}>
            <Ellipse cx={CX + tailX} cy={tailBY} rx={25} ry={12.5}
                     transform={`rotate(32 ${CX + tailX} ${tailBY})`} />
            <Ellipse cx={CX - hindX} cy={GROUND - 7} rx={hindRx} ry={hindRy} />
            <Ellipse cx={CX + hindX} cy={GROUND - 7} rx={hindRx} ry={hindRy} />
            <Circle cx={CX - earCX} cy={headCY + earCY} r={earR} />
            <Circle cx={CX + earCX} cy={headCY + earCY} r={earR} />
            <Ellipse cx={CX} cy={BODY_CY} rx={bodyHW} ry={bodyHH} />
            <Ellipse cx={CX} cy={headCY} rx={headHW} ry={headHH} />
          </G>

          {/* 3 ── clipped layers ── */}
          <G clipPath={`url(#${id("bodyClip")})`}>
            {/* a) main fur gradient */}
            <Rect x={0} y={0} width={240} height={260} fill={`url(#${id("furMain")})`} />
            {/* b) bottom shadow */}
            <Rect x={0} y={0} width={240} height={260} fill={`url(#${id("botShadow")})`} />
            {/* c) rim light */}
            <Rect x={0} y={0} width={240} height={260} fill={`url(#${id("rim")})`} />
            {/* d) belly spot */}
            <Rect x={0} y={0} width={240} height={260} fill={`url(#${id("belly")})`} />
            {/* e) nose bridge */}
            <Rect x={0} y={0} width={240} height={260} fill={`url(#${id("noseBridge")})`} />

            {/* f) scarf band */}
            <Rect x={CX - headHW - 5} y={headCY + scarfCY - 8}
                  width={headHW * 2 + 10} height={16}
                  fill={`url(#${id("scarf")})`} rx={3} />

            {/* g) ear inner */}
            <Circle cx={CX - earCX} cy={headCY + earCY} r={earR * 0.65}
                    fill={`url(#${id("earInner")})`} />
            <Circle cx={CX + earCX} cy={headCY + earCY} r={earR * 0.65}
                    fill={`url(#${id("earInner")})`} />

            {/* h) cheek blush — зөвхөн weight > 50 */}
            {t > 0.5 && (
              <>
                <Circle cx={CX - headHW * 0.55} cy={headCY + headHH * 0.15}
                        r={headHW * 0.18}
                        fill="#D9542B" opacity={clamp01((t - 0.5) * 1.2) * 0.35} />
                <Circle cx={CX + headHW * 0.55} cy={headCY + headHH * 0.15}
                        r={headHW * 0.18}
                        fill="#D9542B" opacity={clamp01((t - 0.5) * 1.2) * 0.35} />
              </>
            )}
          </G>

          {/* 4 ── scarf knot + tail (outside clip) ── */}
          <G>
            {/* knot */}
            <Ellipse cx={CX + headHW * 0.15} cy={headCY + scarfCY + 8}
                     rx={6} ry={5} fill={color}
                     stroke={fur.contour} strokeWidth={2} />
            {/* dangling end */}
            <Path d={`M ${CX + headHW * 0.15} ${headCY + scarfCY + 13}
                      q 3 12 -2 22`}
                  stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" />
            <Path d={`M ${CX + headHW * 0.15} ${headCY + scarfCY + 13}
                      q 3 12 -2 22`}
                  stroke={scarfDark} strokeWidth={2} strokeLinecap="round" fill="none"
                  opacity={0.3} />
          </G>

          {/* 5 ── front paws ── */}
          <G>
            <Ellipse cx={CX - pawX} cy={pawBY} rx={fpRx} ry={fpRy}
                     fill={mix(fur.base, fur.dark, 0.3)}
                     stroke={fur.contour} strokeWidth={2.5} />
            <Ellipse cx={CX + pawX} cy={pawBY} rx={fpRx} ry={fpRy}
                     fill={mix(fur.base, fur.dark, 0.3)}
                     stroke={fur.contour} strokeWidth={2.5} />
            {/* claws */}
            {showFull && [-1.5, 0, 1.5].map((_, i) => {
              const offsets = [-4, 0, 4];
              return (
                <React.Fragment key={`claw${i}`}>
                  <Line x1={CX - pawX + offsets[i]} y1={pawBY + fpRy - 3}
                        x2={CX - pawX + offsets[i]} y2={pawBY + fpRy + 2}
                        stroke={fur.dark} strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={CX + pawX + offsets[i]} y1={pawBY + fpRy - 3}
                        x2={CX + pawX + offsets[i]} y2={pawBY + fpRy + 2}
                        stroke={fur.dark} strokeWidth={1.5} strokeLinecap="round" />
                </React.Fragment>
              );
            })}
          </G>

          {/* 6 ── face ── */}
          <G>
            {/* ── eyes ── */}
            {expr === "sleep" ? (
              /* closed eyes */
              <>
                <Path d={`M ${CX - eyeCX - eyeR} ${headCY + eyeCY}
                          q ${eyeR} ${eyeR * 0.7} ${eyeR * 2} 0`}
                      stroke="#1B1712" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                <Path d={`M ${CX + eyeCX - eyeR} ${headCY + eyeCY}
                          q ${eyeR} ${eyeR * 0.7} ${eyeR * 2} 0`}
                      stroke="#1B1712" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              </>
            ) : expr === "happy" ? (
              /* happy arcs */
              <>
                <Path d={`M ${CX - eyeCX - eyeR * 0.8} ${headCY + eyeCY + eyeR * 0.3}
                          q ${eyeR * 0.8} ${-eyeR * 1.1} ${eyeR * 1.6} 0`}
                      stroke="#1B1712" strokeWidth={2.8} strokeLinecap="round" fill="none" />
                <Path d={`M ${CX + eyeCX - eyeR * 0.8} ${headCY + eyeCY + eyeR * 0.3}
                          q ${eyeR * 0.8} ${-eyeR * 1.1} ${eyeR * 1.6} 0`}
                      stroke="#1B1712" strokeWidth={2.8} strokeLinecap="round" fill="none" />
              </>
            ) : blinking ? (
              /* blink */
              <>
                <Line x1={CX - eyeCX - eyeR * 0.7} y1={headCY + eyeCY}
                      x2={CX - eyeCX + eyeR * 0.7} y2={headCY + eyeCY}
                      stroke="#1B1712" strokeWidth={2.5} strokeLinecap="round" />
                <Line x1={CX + eyeCX - eyeR * 0.7} y1={headCY + eyeCY}
                      x2={CX + eyeCX + eyeR * 0.7} y2={headCY + eyeCY}
                      stroke="#1B1712" strokeWidth={2.5} strokeLinecap="round" />
              </>
            ) : (
              /* normal / tired / surprised */
              <>
                <Circle cx={CX - eyeCX} cy={headCY + eyeCY} r={eyeR} fill="#1B1712" />
                <Circle cx={CX + eyeCX} cy={headCY + eyeCY} r={eyeR} fill="#1B1712" />
                {/* highlight 1 — top left, big */}
                <Circle cx={CX - eyeCX - eyeR * 0.25} cy={headCY + eyeCY - eyeR * 0.25}
                        r={eyeR * 0.34} fill="white" opacity={0.92} />
                <Circle cx={CX + eyeCX - eyeR * 0.25} cy={headCY + eyeCY - eyeR * 0.25}
                        r={eyeR * 0.34} fill="white" opacity={0.92} />
                {/* highlight 2 — bottom right, small */}
                <Circle cx={CX - eyeCX + eyeR * 0.3} cy={headCY + eyeCY + eyeR * 0.3}
                        r={eyeR * 0.16} fill="white" opacity={0.45} />
                <Circle cx={CX + eyeCX + eyeR * 0.3} cy={headCY + eyeCY + eyeR * 0.3}
                        r={eyeR * 0.16} fill="white" opacity={0.45} />
                {/* tired — droopy lids */}
                {expr === "tired" && (
                  <>
                    <Path d={`M ${CX - eyeCX - eyeR * 1.1} ${headCY + eyeCY - eyeR * 0.8}
                              q ${eyeR * 1.1} ${eyeR * 0.6} ${eyeR * 2.2} ${-eyeR * 0.1}`}
                          stroke={fur.base} strokeWidth={3} strokeLinecap="round" fill="none" />
                    <Path d={`M ${CX + eyeCX - eyeR * 1.1} ${headCY + eyeCY - eyeR * 0.8}
                              q ${eyeR * 1.1} ${-eyeR * 0.1} ${eyeR * 2.2} ${eyeR * 0.6}`}
                          stroke={fur.base} strokeWidth={3} strokeLinecap="round" fill="none" />
                  </>
                )}
              </>
            )}

            {/* ── whiskers (size ≥ 92) ── */}
            {showFull && expr !== "sleep" && (
              <G opacity={0.4} strokeWidth={1.2} stroke={fur.dark} strokeLinecap="round">
                {[-1, 1].map(side => (
                  <React.Fragment key={`wh${side}`}>
                    <Line x1={CX + side * headHW * 0.25} y1={headCY + noseCY - 1}
                          x2={CX + side * headHW * 0.75} y2={headCY + noseCY - 5} />
                    <Line x1={CX + side * headHW * 0.25} y1={headCY + noseCY + 2}
                          x2={CX + side * headHW * 0.75} y2={headCY + noseCY + 2} />
                    <Line x1={CX + side * headHW * 0.25} y1={headCY + noseCY + 5}
                          x2={CX + side * headHW * 0.70} y2={headCY + noseCY + 9} />
                  </React.Fragment>
                ))}
              </G>
            )}

            {/* ── nose ── */}
            <Path d={`M ${CX} ${headCY + noseCY - 4}
                      q ${-5.5} ${0} ${-5} ${5.5}
                      q ${0.5} ${3} ${5} ${3}
                      q ${4.5} ${0} ${5} ${-3}
                      q ${0.5} ${-5.5} ${-5} ${-5.5} Z`}
                  fill={fur.nose} />
            {/* nose highlight */}
            <Ellipse cx={CX - 1.5} cy={headCY + noseCY - 1}
                     rx={2.5} ry={1.8}
                     fill="white" opacity={0.42} />

            {/* ── mouth ── */}
            {expr === "surprised" ? (
              <Ellipse cx={CX} cy={headCY + noseCY + 10}
                       rx={3.5} ry={3} fill={fur.contour} />
            ) : (
              <>
                {/* center line from nose */}
                <Line x1={CX} y1={headCY + noseCY + 4.5}
                      x2={CX} y2={headCY + noseCY + 7.5}
                      stroke={fur.contour} strokeWidth={1.8} strokeLinecap="round" />
                {/* smile curve */}
                <Path d={`M ${CX - 6} ${headCY + noseCY + 8}
                          q ${6} ${lerp(4, -3, t) + (expr === "happy" ? 3 : 0)} ${12} 0`}
                      stroke={fur.contour} strokeWidth={1.8}
                      strokeLinecap="round" fill="none" />
              </>
            )}

            {/* ── teeth (size ≥ 92, not sleep) ── */}
            {showFull && expr !== "sleep" && expr !== "surprised" && (
              <>
                <Rect x={CX - 3} y={headCY + noseCY + 7}
                      width={2.8} height={3.5} rx={0.8}
                      fill="white" stroke={fur.contour} strokeWidth={0.7} />
                <Rect x={CX + 0.2} y={headCY + noseCY + 7}
                      width={2.8} height={3.5} rx={0.8}
                      fill="white" stroke={fur.contour} strokeWidth={0.7} />
              </>
            )}
          </G>
        </Svg>
      </View>
    </Animated.View>
  );
}
