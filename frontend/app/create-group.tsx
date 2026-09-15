import React, { useState } from "react";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius } from "@/src/theme";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/api";

export default function CreateGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<any | null>(null);

  const valid = name.trim().length >= 2 && name.trim().length <= 30;

  const create = async () => {
    setBusy(true);
    try {
      const g = await api.post("/groups", { name: name.trim() });
      setCreated(g);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const shareCode = async () => {
    if (!created) return;
    try {
      await Share.share({
        message: `«${created.name}» бүлэгт нэгдээрэй! Код: ${created.join_code} — alkhaach.mn/j/${created.join_code}`,
      });
    } catch {}
  };

  const copyCode = async () => {
    if (!created) return;
    await Clipboard.setStringAsync(created.join_code);
    toast("Код хуулагдлаа", "success");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="create-group-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="create-back-button">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Бүлэг үүсгэх</Text>
      </View>

      {!created ? (
        <>
          <KeyboardAwareScrollView contentContainerStyle={styles.scroll} bottomOffset={80}>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Кодыг мэддэг хүн л нэгдэнэ. Нээлттэй хайлт байхгүй.
            </Text>
            <Text style={[styles.label, { color: colors.onSurface }]}>Бүлгийн нэр</Text>
            <TextInput
              testID="group-name-input"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  color: colors.onSurface,
                },
              ]}
              placeholder="Жишээ нь: Өглөөний алхагчид"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.muted }]}>
              {name.trim().length}/30 тэмдэгт
            </Text>
          </KeyboardAwareScrollView>
          <View style={styles.footer}>
            <Btn
              label="Үүсгэх"
              onPress={create}
              disabled={!valid}
              loading={busy}
              variant="social"
              testID="create-group-submit-button"
            />
          </View>
        </>
      ) : (
        <View style={styles.scroll}>
          <Card style={styles.successCard} testID="group-created-card">
            <Feather name="check-circle" size={40} color={palette.jade} />
            <Text style={[styles.successTitle, { color: colors.onSurface }]}>
              «{created.name}» үүслээ
            </Text>
            <Text style={[styles.successHint, { color: colors.muted }]}>
              Энэ кодыг найзууддаа илгээгээрэй
            </Text>
            <View style={styles.codeRow}>
              <Text style={[styles.code, { color: colors.social }]} testID="created-group-code">
                {created.join_code}
              </Text>
              <Pressable onPress={copyCode} hitSlop={8} style={styles.copyBtn} testID="copy-created-code-button">
                <Feather name="copy" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            <Btn
              label="Код хуваалцах"
              onPress={shareCode}
              variant="social"
              style={{ alignSelf: "stretch" }}
              testID="share-created-code-button"
            />
            <Btn
              label="Бүлэг рүү очих"
              onPress={() => router.replace(`/group/${created.group_id}`)}
              variant="ghost"
              testID="go-to-group-button"
            />
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
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
  charCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  successCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  successTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: "center",
  },
  successHint: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 34,
    letterSpacing: 8,
  },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
