import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing } from "@/src/theme";
import { Btn, Card } from "@/src/components/UI";
import { WeightAxis } from "@/src/components/WeightAxis";
import { api } from "@/src/api";
import { toast } from "@/src/components/Toast";

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await api.get("/groups");
      setGroups(g);
    } catch (e: any) {
      if (groups === null) setGroups([]);
      toast(e.message, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={["top"]} testID="groups-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Бүлэг</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {groups !== null && groups.length === 0 && (
          <Card style={styles.empty} testID="groups-empty">
            <Feather name="users" size={36} color={colors.social} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              Найзуудтайгаа нэг шугам дээр
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Бүлэг үүсгээд 6 оронтой кодоо хуваалцвал зөвхөн бүлгийн гишүүд бие
              биеийнхээ дүрийг харна
            </Text>
          </Card>
        )}

        {groups?.map((g) => (
          <Pressable
            key={g.group_id}
            onPress={() => router.push(`/group/${g.group_id}`)}
            testID={`group-card-${g.group_id}`}
          >
            <Card style={{ marginBottom: spacing.md }}>
              <View style={styles.groupHead}>
                <Text style={[styles.groupName, { color: colors.onSurface }]}>{g.name}</Text>
                <View style={[styles.countBadge, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.countText, { color: colors.onSurface }]}>
                    {g.member_count} гишүүн
                  </Text>
                </View>
              </View>
              <WeightAxis members={g.members} height={34} testID={`group-axis-${g.group_id}`} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Btn
          label="Бүлэг үүсгэх"
          onPress={() => router.push("/create-group")}
          variant="social"
          style={{ flex: 1 }}
          testID="create-group-button"
        />
        <Btn
          label="Кодоор нэгдэх"
          onPress={() => router.push("/join")}
          variant="outline"
          style={{ flex: 1 }}
          testID="join-group-button"
        />
      </View>
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
    paddingBottom: spacing.lg,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    marginTop: spacing.md,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  groupName: {
    fontFamily: fonts.display,
    fontSize: 17,
    flex: 1,
    marginRight: spacing.sm,
  },
  countBadge: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1.5,
  },
});
