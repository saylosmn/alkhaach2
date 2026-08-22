import React, { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius } from "@/src/theme";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import {
  getStepSourceState,
  requestStepPermission,
  syncSteps,
  PermState,
} from "@/src/steps";

export default function Permission() {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState<PermState>("undetermined");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStepSourceState().then(setState);
  }, []);

  const allow = async () => {
    setBusy(true);
    try {
      const granted = await requestStepPermission();
      if (granted) {
        try {
          await syncSteps();
        } catch {}
        router.replace("/(tabs)/home");
      } else {
        const s = await getStepSourceState();
        setState(s);
        toast("Зөвшөөрөл өгөгдсөнгүй. Гараар оруулах горимоор үргэлжилнэ.", "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const skip = () => router.replace("/(tabs)/home");

  const unavailable = state === "unavailable";
  const denied = state === "denied";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="permission-screen">
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: palette.slate, borderColor: colors.border }]}>
          <Feather name="activity" size={44} color={palette.jade} />
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          Алхамаа автоматаар тоолуулъя
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Утас чинь алхамыг аль хэдийн бичдэг — бид зөвхөн алхамын тоог уншина. Байршил,
          зүрхний цохилт зэрэг өөр юу ч авахгүй.
        </Text>

        {unavailable && (
          <Card style={{ marginTop: spacing.xl }} testID="permission-unavailable-card">
            <Text style={[styles.cardText, { color: colors.onSurface }]}>
              {Platform.OS === "web"
                ? "Вэб дээр алхам автоматаар уншигдахгүй. Гараар оруулах горимоор үргэлжилнэ — утсан дээрх аппаас автоматаар уншина."
                : "Энэ орчинд алхам автоматаар унших боломжгүй. Гараар оруулах горимоор үргэлжилнэ. Жинхэнэ iOS/Android build дээр Apple Health / Health Connect-оос автоматаар уншина."}
            </Text>
          </Card>
        )}

        {denied && (
          <Card style={{ marginTop: spacing.xl }} testID="permission-denied-card">
            <Text style={[styles.cardText, { color: colors.onSurface }]}>
              Зөвшөөрөл хаагдсан байна. Тохиргооноос нээж болно.
            </Text>
            <Btn
              label="Тохиргоо нээх"
              onPress={() => Linking.openSettings()}
              variant="outline"
              style={{ marginTop: spacing.md }}
              testID="open-settings-button"
            />
          </Card>
        )}
      </View>

      <View style={styles.footer}>
        {!unavailable && !denied && (
          <Btn
            label="Зөвшөөрөх"
            onPress={allow}
            loading={busy}
            testID="permission-allow-button"
          />
        )}
        <Btn
          label={unavailable || denied ? "Үргэлжлүүлэх" : "Гараар оруулах горимоор үргэлжлүүлэх"}
          onPress={skip}
          variant="ghost"
          testID="permission-skip-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl },
  content: { flex: 1, justifyContent: "center" },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  cardText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
