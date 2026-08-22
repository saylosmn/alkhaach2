import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme";

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "social" | "outline" | "warn" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  testID: string;
  style?: ViewStyle;
  icon?: React.ReactNode;
};

export function Btn({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  testID,
  style,
  icon,
}: BtnProps) {
  const { colors } = useTheme();

  const bg =
    variant === "primary"
      ? colors.brand
      : variant === "social"
        ? colors.social
        : variant === "warn"
          ? colors.warn
          : variant === "ghost"
            ? "transparent"
            : colors.surfaceSecondary;
  const fg =
    variant === "primary"
      ? colors.onBrand
      : variant === "social"
        ? colors.onSocial
        : variant === "warn"
          ? colors.onWarn
          : colors.onSurface;

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? "transparent" : colors.border,
          borderBottomWidth: variant === "ghost" ? 0 : pressed ? 1.5 : 3.5,
          transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }],
          opacity: disabled ? 0.5 : 1,
          borderWidth: variant === "ghost" ? 0 : 1.5,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  testID,
  inverse,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  inverse?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: inverse ? colors.surfaceInverse : colors.surfaceSecondary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: colors.onSurface }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  btnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
  card: {
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    marginBottom: spacing.md,
  },
});
