import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, MN_DAYS, fmtNum } from "@/src/theme";

type WeekDay = { local_date: string; steps: number; goal_met: boolean };

// 7 хоногийн багана диаграм
export function WeekBars({ week, goal }: { week: WeekDay[]; goal: number }) {
  const { colors } = useTheme();
  const max = Math.max(goal, ...week.map((d) => d.steps), 1);

  return (
    <View testID="week-bars">
      <View style={styles.barsRow}>
        {week.map((d, i) => {
          const h = Math.max(4, (d.steps / max) * 110);
          const day = new Date(d.local_date + "T12:00:00");
          const isToday = i === week.length - 1;
          return (
            <View key={d.local_date} style={styles.barCol}>
              <Text style={[styles.barValue, { color: colors.muted }]}>
                {d.steps > 0 ? fmtNum(d.steps / 1000 >= 10 ? Math.round(d.steps / 1000) : Math.round(d.steps / 100) / 10) + "к" : ""}
              </Text>
              <View style={[styles.barTrack, { height: 110 }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: h,
                      backgroundColor: d.goal_met ? palette.jade : colors.surfaceTertiary,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barLabel,
                  { color: isToday ? colors.onSurface : colors.muted },
                  isToday && { fontFamily: fonts.bodySemi },
                ]}
              >
                {MN_DAYS[day.getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.goalLineWrap]}>
        <View style={[styles.goalDash, { borderColor: colors.muted }]} />
        <Text style={[styles.goalText, { color: colors.muted }]}>
          зорилго {fmtNum(goal)}
        </Text>
      </View>
    </View>
  );
}

type CurvePoint = { local_date: string; weight: number };

// 30 хоногийн жингийн муруй
export function WeightCurve({ points, currentWeight }: { points: CurvePoint[]; currentWeight: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 120;
  const pad = 10;

  const data =
    points.length > 0
      ? points
      : [{ local_date: "", weight: currentWeight }];
  const n = data.length;

  const coords = data.map((p, i) => {
    const x = n === 1 ? width / 2 : pad + ((width - pad * 2) * i) / (n - 1);
    const y = pad + ((100 - p.weight) / 100) * (height - pad * 2);
    return { x, y };
  });

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="weight-curve">
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* 50 жингийн жишиг шугам */}
          <Line
            x1={pad}
            y1={pad + (height - pad * 2) / 2}
            x2={width - pad}
            y2={pad + (height - pad * 2) / 2}
            stroke={colors.muted}
            strokeWidth={1}
            strokeDasharray="4 5"
          />
          {n > 1 && (
            <Polyline
              points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke={colors.onSurface}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <Circle
            cx={coords[n - 1].x}
            cy={coords[n - 1].y}
            r={4.5}
            fill={palette.jade}
            stroke={colors.border}
            strokeWidth={1.5}
          />
        </Svg>
      )}
      <View style={styles.curveLabels}>
        <Text style={[styles.curveLabel, { color: colors.muted }]}>30 хоног</Text>
        <Text style={[styles.curveLabel, { color: colors.onSurface, fontFamily: fonts.mono }]}>
          жин {Math.round(currentWeight)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barTrack: {
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: 22,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  barValue: {
    fontFamily: "JetBrainsMono-Medium",
    fontSize: 9,
    height: 12,
  },
  barLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
  },
  goalLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  goalDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  goalText: {
    fontFamily: "JetBrainsMono-Medium",
    fontSize: 10,
  },
  curveLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  curveLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
  },
});
