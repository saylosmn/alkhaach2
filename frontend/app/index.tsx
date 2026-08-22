import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius } from "@/src/theme";
import { Character } from "@/src/components/Character";
import { Btn } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import Svg, { Path } from "react-native-svg";

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function Index() {
  const { user, loading, login } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (user && user.onboarded) return <Redirect href="/(tabs)/home" />;
  if (user && !user.onboarded) return <Redirect href="/onboarding" />;

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login();
    } catch {
      toast("Нэвтрэлт амжилтгүй. Дахин оролдоно уу.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="login-screen">
      <View style={styles.top}>
        <Text style={[styles.logo, { color: colors.onSurface }]}>АЛХААЧ</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>
          Алхалт чинь дүрээ бүтээнэ
        </Text>
      </View>

      <View style={[styles.stage, { backgroundColor: palette.slate, borderColor: colors.border }]}>
        <Character weight={45} color={palette.jade} size={170} testID="login-character" />
        <View style={styles.axisHint}>
          <View style={[styles.dot, { backgroundColor: palette.jade }]} />
          <View style={[styles.hintLine, { backgroundColor: palette.mist }]} />
          <View style={[styles.dot, { backgroundColor: palette.amber }]} />
        </View>
        <Text style={styles.stageText}>Өдөр бүр алхвал дүр чинь хөнгөрнө</Text>
      </View>

      <View style={styles.bottom}>
        <Btn
          label="Google-ээр нэвтрэх"
          onPress={handleLogin}
          loading={busy}
          variant="outline"
          icon={<GoogleIcon />}
          testID="google-login-button"
        />
        <Text style={[styles.privacy, { color: colors.muted }]}>
          Зөвхөн алхамын тоог уншина. Өөр юу ч биш.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  stage: {
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginVertical: spacing.xl,
  },
  axisHint: {
    flexDirection: "row",
    alignItems: "center",
    width: "60%",
    marginTop: spacing.lg,
    gap: 4,
  },
  hintLine: {
    flex: 1,
    height: 1.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.mist,
    marginTop: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  privacy: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
  },
});
