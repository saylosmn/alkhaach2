import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius, fmtNum } from "@/src/theme";
import { Character } from "@/src/components/Character";
import { WeightAxis } from "@/src/components/WeightAxis";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/api";

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [group, setGroup] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: "remove" | "leave" | "delete" | "rotate";
    uid?: string;
    name?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await api.get(`/groups/${id}`);
      setGroup(g);
    } catch (e: any) {
      toast(e.message, "error");
      if (e.status === 403 || e.status === 404) router.back();
    }
  }, [id, router]);

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

  const shareCode = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `«${group.name}» бүлэгт нэгдээрэй! Код: ${group.join_code} — alkhaach.mn/j/${group.join_code}`,
      });
    } catch {}
  };

  const copyCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.join_code);
    toast("Код хуулагдлаа", "success");
  };

  const doConfirm = async () => {
    if (!confirm || !group) return;
    setBusy(true);
    try {
      if (confirm.type === "remove" && confirm.uid) {
        await api.del(`/groups/${group.group_id}/members/${confirm.uid}`);
        toast("Гишүүн хасагдлаа", "success");
        await load();
      } else if (confirm.type === "leave") {
        await api.del(`/groups/${group.group_id}/members/${user?.user_id}`);
        toast("Бүлгээс гарлаа", "success");
        router.back();
      } else if (confirm.type === "delete") {
        await api.del(`/groups/${group.group_id}`);
        toast("Бүлэг устгагдлаа", "success");
        router.back();
      } else if (confirm.type === "rotate") {
        const r = await api.post(`/groups/${group.group_id}/code`);
        setGroup({ ...group, join_code: r.join_code });
        toast("Шинэ код үүслээ. Хуучин код хүчингүй боллоо.", "success");
      }
      setConfirm(null);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="group-loading">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="group-back-button">
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const confirmTexts: Record<string, { title: string; body: string; btn: string }> = {
    remove: {
      title: `${confirm?.name || "Гишүүн"}-г хасах уу?`,
      body: "Хасагдсан гишүүн кодоор дахин нэгдэж болно.",
      btn: "Хасах",
    },
    leave: {
      title: "Бүлгээс гарах уу?",
      body: "Гарсны дараа таны Тарваа энэ бүлэгт харагдахаа болино.",
      btn: "Гарах",
    },
    delete: {
      title: "Бүлэг устгах уу?",
      body: "Бүх гишүүдийн хувьд энэ бүлэг устана. Буцаах боломжгүй.",
      btn: "Устгах",
    },
    rotate: {
      title: "Код солих уу?",
      body: "Хуучин код тэр дороо хүчингүй болно.",
      btn: "Солих",
    },
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="group-detail-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="group-back-button">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={[styles.count, { color: colors.muted }]}>{group.member_count}/50</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        {/* Жингийн шугам */}
        <View style={[styles.stage, { borderColor: colors.border }]} testID="group-weight-axis-stage">
          <WeightAxis members={group.members} height={46} testID="group-weight-axis" />
        </View>

        {/* Өнөөдрийн алхалт */}
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Өнөөдрийн алхалт</Text>
        {group.members.map((m: any) => (
          <Card key={m.user_id} style={styles.memberRow} testID={`member-row-${m.user_id}`}>
            <Character weight={m.weight} color={m.avatar_color} size={34} animate={false} morph={false} />
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={[styles.memberName, { color: colors.onSurface }]} numberOfLines={1}>
                  {m.display_name}
                  {m.is_me ? " (би)" : ""}
                </Text>
                {m.is_owner && <Feather name="star" size={12} color={palette.amber} />}
              </View>
              <Text style={[styles.memberStage, { color: colors.muted }]}>{m.stage}</Text>
            </View>
            <View style={styles.memberSteps}>
              {m.flagged ? (
                <Text style={[styles.memberStepNum, { color: colors.muted }]}>—</Text>
              ) : (
                <View style={styles.stepRow}>
                  <Text
                    style={[
                      styles.memberStepNum,
                      { color: m.goal_met ? palette.jade : colors.onSurface },
                    ]}
                  >
                    {fmtNum(m.today_steps ?? 0)}
                  </Text>
                  {m.source === "manual" && (
                    <View style={[styles.manualBadge, { borderColor: colors.border }]}>
                      <Text style={[styles.manualBadgeText, { color: colors.onSurface }]}>Г</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            {group.is_owner && !m.is_me && (
              <Pressable
                testID={`remove-member-${m.user_id}`}
                onPress={() => setConfirm({ type: "remove", uid: m.user_id, name: m.display_name })}
                style={styles.removeBtn}
                hitSlop={8}
              >
                <Feather name="x" size={16} color={colors.muted} />
              </Pressable>
            )}
          </Card>
        ))}

        {/* Урих код */}
        <Card style={{ marginTop: spacing.lg }} testID="invite-code-card">
          <Text style={[styles.codeLabel, { color: colors.muted }]}>Урих код</Text>
          <View style={styles.codeRow}>
            <Text style={[styles.code, { color: colors.social }]} testID="group-join-code">
              {group.join_code}
            </Text>
            <Pressable onPress={copyCode} style={styles.copyBtn} hitSlop={8} testID="copy-code-button">
              <Feather name="copy" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
          <Btn
            label="Код хуваалцах"
            onPress={shareCode}
            variant="social"
            style={{ marginTop: spacing.md }}
            testID="share-code-button"
          />
          {group.is_owner && (
            <Btn
              label="Код солих"
              onPress={() => setConfirm({ type: "rotate" })}
              variant="ghost"
              testID="rotate-code-button"
            />
          )}
        </Card>

        {group.is_owner ? (
          <Btn
            label="Бүлэг устгах"
            onPress={() => setConfirm({ type: "delete" })}
            variant="warn"
            style={{ marginTop: spacing.lg }}
            testID="delete-group-button"
          />
        ) : (
          <Btn
            label="Бүлгээс гарах"
            onPress={() => setConfirm({ type: "leave" })}
            variant="warn"
            style={{ marginTop: spacing.lg }}
            testID="leave-group-button"
          />
        )}
      </ScrollView>

      <Modal visible={!!confirm} transparent animationType="slide" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirm(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>
              {confirm ? confirmTexts[confirm.type].title : ""}
            </Text>
            <Text style={[styles.sheetText, { color: colors.muted }]}>
              {confirm ? confirmTexts[confirm.type].body : ""}
            </Text>
            <Btn
              label={confirm ? confirmTexts[confirm.type].btn : ""}
              onPress={doConfirm}
              variant={confirm?.type === "rotate" ? "social" : "warn"}
              loading={busy}
              testID="confirm-action-button"
            />
            <Btn label="Болих" onPress={() => setConfirm(null)} variant="ghost" testID="cancel-action-button" />
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
    flex: 1,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  stage: {
    backgroundColor: palette.slate,
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    flexShrink: 1,
  },
  memberStage: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  memberSteps: {
    alignItems: "flex-end",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberStepNum: {
    fontFamily: fonts.mono,
    fontSize: 16,
  },
  manualBadge: {
    borderWidth: 1.5,
    borderRadius: 5,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  manualBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  codeLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 30,
    letterSpacing: 6,
  },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  sheetText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
