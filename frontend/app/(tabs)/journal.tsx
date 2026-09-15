import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, fmtNum } from "@/src/theme";
import { Card, SectionTitle } from "@/src/components/UI";
import { WeekBars, WeightCurve } from "@/src/components/Charts";
import { fetchSummary, getCachedSummary } from "@/src/steps";
import { useAuth } from "@/src/context/AuthContext";

export default function Journal() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const cached = await getCachedSummary();
    if (cached) setSummary(cached);
    try {
      const s = await fetchSummary();
      if (s) setSummary(s);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = summary?.today?.steps ?? 0;
  const yesterday = summary?.yesterday?.steps ?? 0;
  const diff = today - yesterday;
  const hasData = summary && summary.week_total > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={["top"]} testID="journal-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Тэмдэглэл</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {!hasData && (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }} testID="journal-empty">
            <Feather name="wind" size={36} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              Түүх энд бичигдэнэ
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Алхаж эхэлмэгц 7 хоногийн диаграм, жингийн муруй энд харагдана
            </Text>
          </Card>
        )}

        {hasData && (
          <>
            <Card testID="week-chart-card">
              <SectionTitle>Сүүлийн 7 хоног</SectionTitle>
              <WeekBars week={summary.week} goal={summary.goal} />
            </Card>

            <Card style={{ marginTop: spacing.md }} testID="compare-card">
              <SectionTitle>Өчигдөр ↔ Өнөөдөр</SectionTitle>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={[styles.compareLabel, { color: colors.muted }]}>Өчигдөр</Text>
                  <Text style={[styles.compareNum, { color: colors.onSurface }]}>
                    {fmtNum(yesterday)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.diffBadge,
                    {
                      backgroundColor: diff >= 0 ? palette.jade : palette.amber,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={diff >= 0 ? "arrow-up-right" : "arrow-down-right"}
                    size={14}
                    color={diff >= 0 ? palette.paper : palette.ink}
                  />
                  <Text
                    style={[
                      styles.diffText,
                      { color: diff >= 0 ? palette.paper : palette.ink },
                    ]}
                  >
                    {fmtNum(Math.abs(diff))}
                  </Text>
                </View>
                <View style={[styles.compareCol, { alignItems: "flex-end" }]}>
                  <Text style={[styles.compareLabel, { color: colors.muted }]}>Өнөөдөр</Text>
                  <Text style={[styles.compareNum, { color: colors.onSurface }]}>
                    {fmtNum(today)}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        <Card style={{ marginTop: spacing.md }} testID="weight-curve-card">
          <SectionTitle>Жингийн өөрчлөлт</SectionTitle>
          <WeightCurve
            points={summary?.weight_curve ?? []}
            currentWeight={summary?.weight ?? user?.weight ?? 50}
          />
          {(summary?.weight_curve?.length ?? 0) < 2 && (
            <Text style={[styles.emptyText, { color: colors.muted, marginTop: spacing.sm }]}>
              Өдөр бүр шинэ цэг нэмэгдэнэ — маргааш эргээд хараарай
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compareCol: {
    gap: 2,
  },
  compareLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  compareNum: {
    fontFamily: fonts.mono,
    fontSize: 22,
  },
  diffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  diffText: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
});
