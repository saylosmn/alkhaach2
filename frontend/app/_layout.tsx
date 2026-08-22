import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, Modal, Platform, Pressable, StyleSheet, Text } from "react-native";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { AuthProvider } from "@/src/context/AuthContext";
import { ToastHost } from "@/src/components/Toast";
import { Btn } from "@/src/components/UI";
import { storage } from "@/src/utils/storage";
import { fonts, radius, spacing } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Push мэдэгдэл: foreground handler + Android суваг — MODULE SCOPE
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const [nudgeOpen, setNudgeOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Мэдэгдэл дээр дарахад (апп нээлттэй үед)
    const tapSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data: any = response.notification.request.content.data || {};
        const url = data.deeplink || data.action_url;
        if (!url) return;
        if (String(url).startsWith("http")) Linking.openURL(url);
        else router.push(url);
      },
    );

    // Cold start: апп унтраалттай байхад мэдэгдэл дарж нээсэн бол
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data: any = response.notification.request.content.data || {};
      const url = data.deeplink || data.action_url;
      if (url) {
        if (String(url).startsWith("http")) Linking.openURL(url);
        else router.push(url);
      }
    });

    // Мэдэгдэл хаасан хэрэглэгчид 7 хоногт нэг удаа сануулна
    (async () => {
      try {
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== "denied" || canAskAgain) return;
        const lastNudge = await storage.getItem("pushNudgeAt", null);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
        setNudgeOpen(true);
      } catch {}
    })();

    return () => {
      tapSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeNudge = async (openSettings: boolean) => {
    await storage.setItem("pushNudgeAt", String(Date.now()));
    setNudgeOpen(false);
    if (openSettings) Linking.openSettings();
  };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
      <ToastHost />
      <Modal visible={nudgeOpen} transparent animationType="slide" onRequestClose={() => closeNudge(false)}>
        <Pressable style={nudgeStyles.backdrop} onPress={() => closeNudge(false)}>
          <Pressable
            style={[nudgeStyles.sheet, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[nudgeStyles.title, { color: colors.onSurface }]}>
              Мэдэгдэл хаалттай байна
            </Text>
            <Text style={[nudgeStyles.body, { color: colors.muted }]}>
              Өглөөний илчлэлт, оройн сануулгыг авахын тулд тохиргооноос мэдэгдлийг нээгээрэй.
            </Text>
            <Btn label="Тохиргоо нээх" onPress={() => closeNudge(true)} testID="nudge-open-settings-button" />
            <Btn label="Дараа" onPress={() => closeNudge(false)} variant="ghost" testID="nudge-later-button" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const nudgeStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.stage,
    borderTopRightRadius: radius.stage,
    borderWidth: 1.5,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "Manrope-ExtraBold": require("../assets/fonts/Manrope-ExtraBold.ttf"),
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "JetBrainsMono-Medium": require("../assets/fonts/JetBrainsMono-Medium.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
