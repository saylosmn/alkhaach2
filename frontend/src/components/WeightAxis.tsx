import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import { palette, weightColor } from "@/src/theme";
import { Character } from "@/src/components/Character";

export type AxisMember = {
  user_id: string;
  display_name: string;
  avatar_color: string;
  weight: number;
  is_me?: boolean;
};

type Props = {
  members: AxisMember[];
  height?: number; // дүрийн хэмжээ
  showLabels?: boolean;
  testID?: string;
};

// Гарын үсэг элемент: бүх гишүүн Хөнгөн → Хүнд тэнхлэг дээр өөрийн жингээрээ зогсоно
export function WeightAxis({ members, height = 44, showLabels = true, testID }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pad = height * 0.6;
  const usable = Math.max(0, width - pad * 2);

  return (
    <View testID={testID}>
      <View
        style={[styles.track, { height: height * 1.5 }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {/* Тэнхлэгийн шугам */}
        <View
          style={[
            styles.line,
            { backgroundColor: colors.border, bottom: 6 },
          ]}
        />
        {/* Туйлын цэгүүд */}
        <View style={[styles.pole, { backgroundColor: palette.jade, left: 0, bottom: 2 }]} />
        <View style={[styles.pole, { backgroundColor: palette.amber, right: 0, bottom: 2 }]} />
        {width > 0 &&
          members.map((m) => {
            const x = pad + (usable * Math.max(0, Math.min(100, m.weight))) / 100;
            return (
              <View
                key={m.user_id}
                style={[styles.member, { left: x - height / 2, bottom: 4, width: height }]}
                testID={`axis-member-${m.user_id}`}
              >
                {m.is_me && (
                  <View
                    style={[
                      styles.meRing,
                      { borderColor: colors.social, width: height + 8, height: height + 12 },
                    ]}
                  />
                )}
                <Character weight={m.weight} color={m.avatar_color} size={height} animate={false} morph={false} />
              </View>
            );
          })}
      </View>
      {showLabels && (
        <View style={styles.labels}>
          <Text style={[styles.label, { color: weightColor(5) }]}>Хөнгөн</Text>
          <Text style={[styles.label, { color: weightColor(95) }]}>Хүнд</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "relative",
    justifyContent: "flex-end",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.5,
  },
  pole: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#191F1B",
  },
  member: {
    position: "absolute",
    alignItems: "center",
  },
  meRing: {
    position: "absolute",
    bottom: -4,
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: "dashed",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  label: {
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
  },
});
