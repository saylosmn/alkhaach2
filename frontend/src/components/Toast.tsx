import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { palette, fonts, radius } from "@/src/theme";

type ToastMsg = { id: number; text: string; type: "info" | "error" | "success" };

let pushToast: ((t: Omit<ToastMsg, "id">) => void) | null = null;
let counter = 0;

export function toast(text: string, type: "info" | "error" | "success" = "info") {
  pushToast?.({ text, type });
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    pushToast = ({ text, type }) => {
      const id = ++counter;
      setItems((prev) => [...prev.slice(-2), { id, text, type }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 2800);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + 8 }]}
      testID="toast-host"
    >
      {items.map((t) => (
        <Animated.View
          key={t.id}
          entering={FadeInUp.duration(200)}
          exiting={FadeOutUp.duration(150)}
          style={[
            styles.toast,
            t.type === "error" && { backgroundColor: palette.amber },
            t.type === "success" && { backgroundColor: palette.jade },
          ]}
          testID={`toast-${t.type}`}
        >
          <Text
            style={[
              styles.text,
              t.type === "success" && { color: palette.paper },
            ]}
          >
            {t.text}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
    gap: 8,
  },
  toast: {
    backgroundColor: palette.paper,
    borderWidth: 1.5,
    borderColor: palette.ink,
    borderBottomWidth: 3.5,
    borderRadius: radius.btn,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 420,
  },
  text: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: palette.ink,
    textAlign: "center",
  },
});
