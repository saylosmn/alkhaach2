import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius, AVATAR_COLORS } from "@/src/theme";
import { Character } from "@/src/components/Character";
import { Btn } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { deviceTz } from "@/src/steps";

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState(user?.display_name || "");
  const [color, setColor] = useState(user?.avatar_color || AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2 && name.trim().length <= 16;

  const save = async () => {
    if (!valid) {
      toast("Нэр 2–16 тэмдэгт байх ёстой", "error");
      return;
    }
    setBusy(true);
    try {
      const u = await api.patch("/me", {
        display_name: name.trim(),
        avatar_color: color,
        tz: deviceTz(),
      });
      setUser(u);
      router.replace("/permission");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="onboarding-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={80}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.onSurface }]}>Тарваагаа бүтээе</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Нэр болон ороолтын өнгөө сонго. Тарваа чинь алхалтаас хамаарч өөрчлөгдөнө.
        </Text>

        <View style={[styles.stage, { backgroundColor: palette.slate, borderColor: colors.border }]}>
          <Character weight={user?.weight ?? 50} color={color} size={140} testID="onboarding-character" />
          {name.trim().length > 0 && (
            <Text style={styles.previewName}>{name.trim()}</Text>
          )}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Нэр</Text>
        <TextInput
          testID="onboarding-name-input"
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              color: colors.onSurface,
            },
          ]}
          placeholder="Жишээ нь: Хурдан хүлэг"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          maxLength={16}
          returnKeyType="done"
        />
        <Text style={[styles.hint, { color: colors.muted }]}>{name.trim().length}/16 тэмдэгт</Text>

        <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Дүрийн өнгө</Text>
        <View style={styles.colors}>
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              testID={`color-choice-${c.slice(1)}`}
              onPress={() => {
                Haptics.selectionAsync();
                setColor(c);
              }}
              style={[
                styles.colorChip,
                { backgroundColor: c, borderColor: colors.border },
                color === c && styles.colorChipActive,
              ]}
            >
              {color === c && <View style={[styles.colorDot, { backgroundColor: palette.paper }]} />}
            </Pressable>
          ))}
        </View>
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <Btn
          label="Үргэлжлүүлэх"
          onPress={save}
          disabled={!valid}
          loading={busy}
          testID="onboarding-continue-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  stage: {
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginVertical: spacing.xl,
  },
  previewName: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: palette.oat,
    marginTop: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderRadius: radius.btn,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  colors: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipActive: {
    transform: [{ scale: 1.1 }],
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#191F1B",
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
