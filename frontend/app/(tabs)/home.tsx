import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius, fmtNum, stageName } from "@/src/theme";
import { Character } from "@/src/components/Character";
import { WeightAxis } from "@/src/components/WeightAxis";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { storage } from "@/src/utils/storage";
import {
  getCachedSummary,
  getStepSourceState,
  requestStepPermission,
  submitManualSteps,
  syncSteps,
  fetchSummary,
  localDateStr,
  PermState,
} from "@/src/steps";
import { registerForPush } from "@/src/push";

// Зорилго биелэхэд хаш ногоон долгион нэг удаа тархана
function GoalWave({ trigger }: { trigger: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trigger > 0 && !reduced) {
      scale.value = 0;
      opacity.value = 0.8;
      scale.value = withTiming(3.2, { duration: 1200 });
      opacity.value = withTiming(0, { duration: 1200 });
    }
  }, [trigger, reduced, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wave, style]} />
  );
}

export default function Home() {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [summary, setSummary] = useState<any | null>(null);
  const [perm, setPerm] = useState<PermState>("undetermined");
  const [refreshing, setRefreshing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const syncingRef = useRef(false);

  const load = useCallback(async (viaSync: boolean) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      let s = null;
      if (viaSync) s = await syncSteps();
      if (!s) s = await fetchSummary();
      if (s) {
        setSummary(s);
        refreshUser();
      }
    } catch (e: any) {
      if (e?.message) toast(e.message, "error");
    } finally {
      syncingRef.current = false;
    }
  }, [refreshUser]);

  // Анхны ачаалт: кэш → синк
  useEffect(() => {
    (async () => {
      const cached = await getCachedSummary();
      if (cached) setSummary(cached);
      const p = await getStepSourceState();
      setPerm(p);
      // олон хоног нээгээгүй эсэх
      const lastOpen = (await storage.getItem("last_open_date", null)) as string | null;
      const today = localDateStr(new Date());
      if (lastOpen && lastOpen !== today) {
        const gap = Math.round(
          (new Date(today).getTime() - new Date(lastOpen).getTime()) / 86400000,
        );
        setAbsentDays(gap);
      }
      await storage.setItem("last_open_date", today);
      await load(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground-д 30 мин тутам + идэвхжих бүрт синк
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load(true);
    });
    const interval = setInterval(() => load(true), 30 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  // Зорилго биелсэн долгион — өдөрт нэг удаа
  useEffect(() => {
    if (!summary?.goal_reached) return;
    (async () => {
      const key = `celebrated_${summary.local_date}`;
      const done = await storage.getItem(key, null);
      if (!done) {
        await storage.setItem(key, "1");
        setWaveTrigger(Date.now());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    })();
  }, [summary?.goal_reached, summary?.local_date]);

  // Push бүртгэл (build дээр л ажиллана, Expo Go-д чимээгүй алгасна)
  useEffect(() => {
    if (user?.user_id) registerForPush(user.user_id);
  }, [user?.user_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const askPermission = async () => {
    if (perm === "undetermined") {
      const granted = await requestStepPermission();
      const p = await getStepSourceState();
      setPerm(p);
      if (granted) await load(true);
    } else {
      router.push("/permission");
    }
  };

  const saveManual = async () => {
    const n = parseInt(manualValue.replace(/\D/g, ""), 10);
    if (isNaN(n) || n < 0 || n > 200000) {
      toast("Алхамын тоо буруу байна. Дахин шалгана уу.", "error");
      return;
    }
    setManualBusy(true);
    try {
      const s = await submitManualSteps(localDateStr(new Date()), n);
      setSummary(s);
      setManualOpen(false);
      setManualValue("");
      toast("Алхалт хадгалагдлаа", "success");
    } catch (e: any) {
      toast(e.message || "Сүлжээгүй байна. Дараа дахин илгээнэ.", "error");
    } finally {
      setManualBusy(false);
    }
  };

  const weight = summary?.weight ?? user?.weight ?? 50;
  const goal = summary?.goal ?? user?.daily_goal ?? 8000;
  const todaySteps = summary?.today?.steps ?? 0;
  const progress = Math.min(1, todaySteps / goal);
  const isNewUser = !summary || (summary.week_total === 0 && (summary.weight_curve?.length || 0) === 0);
  const noAuto = perm !== "granted";

  // Гол мессеж — төлөв бүрд өөр
  let mainMsg: string;
  if (isNewUser) mainMsg = "Тавтай морил! Анхны алхалтаа эхлүүлье";
  else if (absentDays >= 2) mainMsg = `Дүр чинь чамайг ${absentDays} хоног хүлээлээ`;
  else if (summary?.goal_reached) mainMsg = "Өнөөдрийн зорилго биеллээ!";
  else if (noAuto && todaySteps === 0) mainMsg = "Өнөөдрийн алхалтаа гараар оруулаарай";
  else mainMsg = `${fmtNum(summary?.remaining ?? goal)} алхам үлдлээ`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={["top"]} testID="home-screen">
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.onSurface }]}>АЛХААЧ</Text>
        <Text style={[styles.date, { color: colors.muted }]}>
          {`${new Date().getMonth() + 1}-р сарын ${new Date().getDate()}`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {/* Дүрийн тайз */}
        <View style={[styles.stage, { borderColor: colors.border }]} testID="character-stage">
          <GoalWave trigger={waveTrigger} />
          <Character
            weight={weight}
            color={user?.avatar_color || palette.jade}
            size={165}
            testID="home-character"
          />
          <View style={styles.stageMeta}>
            <View style={[styles.badge, { borderColor: palette.mist }]}>
              <Text style={styles.badgeText}>{stageName(weight)}</Text>
            </View>
            <View style={[styles.badge, { borderColor: palette.mist }]}>
              <Text style={[styles.badgeText, { fontFamily: fonts.mono }]}>жин {Math.round(weight)}</Text>
            </View>
            {(summary?.streak ?? 0) > 0 && (
              <View style={[styles.badge, { borderColor: palette.jade }]}>
                <Text style={[styles.badgeText, { color: palette.jade }]}>
                  🔥 {summary.streak} хоног
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.mainMsg} testID="home-main-message">{mainMsg}</Text>
        </View>

        {/* Өнөөдөр */}
        <Card style={{ marginTop: spacing.lg }} testID="today-card">
          <View style={styles.todayRow}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Өнөөдөр</Text>
            {summary?.today?.source === "manual" && (
              <View style={[styles.manualBadge, { borderColor: colors.border }]}>
                <Text style={[styles.manualBadgeText, { color: colors.onSurface }]}>Г</Text>
              </View>
            )}
          </View>
          <View style={styles.todayNumRow}>
            <Text style={[styles.todayNum, { color: colors.onSurface }]} testID="today-steps">
              {fmtNum(todaySteps)}
            </Text>
            <Text style={[styles.todayGoal, { color: colors.muted }]}>/ {fmtNum(goal)}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(2, progress * 100)}%`,
                  backgroundColor: summary?.goal_reached ? palette.jade : palette.jade,
                },
              ]}
            />
          </View>
          {noAuto && (
            <View style={styles.manualRow}>
              <Btn
                label="Гараар оруулах"
                onPress={() => setManualOpen(true)}
                variant="outline"
                style={{ flex: 1 }}
                testID="manual-entry-button"
              />
              {perm !== "unavailable" && (
                <Btn
                  label="Зөвшөөрөл"
                  onPress={askPermission}
                  variant="ghost"
                  testID="ask-permission-button"
                />
              )}
            </View>
          )}
        </Card>

        {/* Өчигдөр / 7 хоног / Жин */}
        <View style={styles.statRow}>
          <Card style={styles.statCard} testID="yesterday-card">
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Өчигдөр</Text>
            <Text style={[styles.statNum, { color: colors.onSurface }]}>
              {fmtNum(summary?.yesterday?.steps ?? 0)}
            </Text>
          </Card>
          <Card style={styles.statCard} testID="week-card">
            <Text style={[styles.cardLabel, { color: colors.muted }]}>7 хоног</Text>
            <Text style={[styles.statNum, { color: colors.onSurface }]}>
              {fmtNum(summary?.week_total ?? 0)}
            </Text>
          </Card>
          <Card style={styles.statCard} testID="weight-delta-card">
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Жин</Text>
            <Text
              style={[
                styles.statNum,
                {
                  color:
                    (summary?.weight_delta ?? 0) < 0
                      ? palette.jade
                      : (summary?.weight_delta ?? 0) > 0
                        ? palette.amber
                        : colors.onSurface,
                },
              ]}
            >
              {(summary?.weight_delta ?? 0) > 0 ? "+" : ""}
              {(summary?.weight_delta ?? 0).toFixed(1)}
            </Text>
          </Card>
        </View>

        {/* Жингийн шугам дээрх байрлал */}
        <Card style={{ marginTop: spacing.md }} testID="weight-line-card">
          <Text style={[styles.cardLabel, { color: colors.muted, marginBottom: spacing.sm }]}>
            Жингийн шугам дээрх байрлал
          </Text>
          <WeightAxis
            members={[
              {
                user_id: user?.user_id || "me",
                display_name: user?.display_name || "Би",
                avatar_color: user?.avatar_color || palette.jade,
                weight,
                is_me: false,
              },
            ]}
            height={40}
            testID="home-weight-axis"
          />
        </Card>
      </ScrollView>

      {/* Гараар оруулах modal */}
      <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setManualOpen(false)} testID="manual-modal-backdrop">
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Өнөөдрийн алхалт</Text>
            <Text style={[styles.sheetHint, { color: colors.muted }]}>
              Гараар оруулсан утга «Г» тэмдэгтэй харагдана
            </Text>
            <TextInput
              testID="manual-steps-input"
              style={[
                styles.manualInput,
                { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surface },
              ]}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={manualValue}
              onChangeText={setManualValue}
              maxLength={6}
              autoFocus
            />
            <Btn
              label="Хадгалах"
              onPress={saveManual}
              loading={manualBusy}
              testID="manual-save-button"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 1,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  stage: {
    backgroundColor: palette.slate,
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    paddingVertical: spacing.xl,
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    top: "35%",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: palette.jade,
  },
  stageMeta: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: palette.oat,
  },
  mainMsg: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: palette.oat,
    marginTop: spacing.md,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  manualBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  manualBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  todayNumRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  todayNum: {
    fontFamily: fonts.mono,
    fontSize: 40,
  },
  todayGoal: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  progressTrack: {
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  manualRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
  },
  statNum: {
    fontFamily: fonts.mono,
    fontSize: 17,
    marginTop: spacing.xs,
  },
  modalBackdrop: {
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
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
  },
  sheetHint: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  manualInput: {
    height: 56,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderRadius: radius.btn,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.mono,
    fontSize: 24,
    textAlign: "center",
  },
});
