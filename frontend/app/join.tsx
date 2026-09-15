import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius } from "@/src/theme";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/api";

const VALID_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

export default function JoinByCode() {
  const { code: prefill } = useLocalSearchParams<{ code?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (prefill) {
      const clean = String(prefill).toUpperCase().replace(VALID_CHARS, "").slice(0, 6);
      setCode(clean);
    }
  }, [prefill]);

  useEffect(() => {
    setPreview(null);
    setError(null);
    if (code.length === 6) {
      Haptics.selectionAsync();
      setChecking(true);
      api
        .get(`/groups/preview/${code}`)
        .then((p) => setPreview(p))
        .catch((e) => setError(e.message))
        .finally(() => setChecking(false));
    }
  }, [code]);

  const onChangeCode = (v: string) => {
    setCode(v.toUpperCase().replace(VALID_CHARS, "").slice(0, 6));
  };

  const join = async () => {
    setJoining(true);
    try {
      const r = await api.post("/groups/join", { code });
      if (r.already_member) toast("Та энэ бүлгийн гишүүн байна", "info");
      else toast(`«${r.name}» бүлэгт нэгдлээ!`, "success");
      router.replace(`/group/${r.group_id}`);
    } catch (e: any) {
      setError(e.message);
      toast(e.message, "error");
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="join-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="join-back-button">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Кодоор нэгдэх</Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} bottomOffset={80}>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Бүлгийн үүсгэгчээс авсан 6 оронтой кодоо оруулна уу
        </Text>

        <Pressable onPress={() => inputRef.current?.focus()} testID="code-cells">
          <View style={styles.cells}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    borderColor: error
                      ? palette.amber
                      : i === code.length
                        ? colors.social
                        : colors.border,
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
                testID={`code-cell-${i}`}
              >
                <Text style={[styles.cellText, { color: colors.onSurface }]}>
                  {code[i] || ""}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
        <TextInput
          ref={inputRef}
          testID="join-code-input"
          style={styles.hiddenInput}
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          autoFocus
        />

        {checking && (
          <Text style={[styles.status, { color: colors.muted }]}>Шалгаж байна...</Text>
        )}

        {error && (
          <Text style={[styles.status, { color: palette.amber }]} testID="join-error-text">
            {error}
          </Text>
        )}

        {preview && (
          <Card style={{ marginTop: spacing.lg }} testID="group-preview-card">
            <Text style={[styles.previewLabel, { color: colors.muted }]}>Олдлоо</Text>
            <Text style={[styles.previewName, { color: colors.onSurface }]}>{preview.name}</Text>
            <Text style={[styles.previewCount, { color: colors.muted }]}>
              {preview.member_count} гишүүнтэй
            </Text>
          </Card>
        )}
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <Btn
          label="Нэгдэх"
          onPress={join}
          disabled={!preview}
          loading={joining}
          variant="social"
          testID="join-submit-button"
        />
      </View>
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
  cells: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 60,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontFamily: fonts.mono,
    fontSize: 26,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
  status: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  previewLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  previewName: {
    fontFamily: fonts.display,
    fontSize: 20,
    marginTop: spacing.xs,
  },
  previewCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
});
