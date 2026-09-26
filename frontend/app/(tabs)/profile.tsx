import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Feather from "@expo/vector-icons/Feather";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, palette, spacing, radius, AVATAR_COLORS, fmtNum } from "@/src/theme";
import { Character } from "@/src/components/Character";
import { Btn, Card } from "@/src/components/UI";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { ensurePushPermission, registerForPush } from "@/src/push";
import {
  backgroundStepsEnabled,
  backgroundStepsSupported,
  disableBackgroundSteps,
  enableBackgroundSteps,
} from "@/src/steps";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const [name, setName] = useState(user?.display_name || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bgSteps, setBgSteps] = useState(backgroundStepsEnabled);

  // Нүүр дэлгэцээс асаасан байж болох тул таб руу орох бүрт шинэчилнэ
  useFocusEffect(
    useCallback(() => {
      setBgSteps(backgroundStepsEnabled());
    }, []),
  );

  const toggleBackgroundSteps = async (v: boolean) => {
    if (v) {
      const ok = await enableBackgroundSteps();
      if (!ok) toast("Хөдөлгөөний зөвшөөрөл өгөгдсөнгүй. Тохиргооноос нээнэ үү.", "error");
    } else {
      await disableBackgroundSteps();
    }
    setBgSteps(backgroundStepsEnabled());
  };

  const patch = async (body: any) => {
    try {
      const u = await api.patch("/me", body);
      setUser(u);
      return true;
    } catch (e: any) {
      toast(e.message, "error");
      return false;
    }
  };

  const saveName = async () => {
    const n = name.trim();
    if (n.length < 2 || n.length > 16) {
      toast("Нэр 2–16 тэмдэгт байх ёстой", "error");
      return;
    }
    if (n !== user?.display_name) {
      const ok = await patch({ display_name: n });
      if (ok) toast("Нэр хадгалагдлаа", "success");
    }
  };

  const changeGoal = async (dir: 1 | -1) => {
    const current = user?.daily_goal ?? 8000;
    const next = Math.max(4000, Math.min(20000, current + dir * 500));
    if (next !== current) {
      Haptics.selectionAsync();
      await patch({ daily_goal: next });
    }
  };

  const toggleNotif = async (field: "notif_morning" | "notif_evening", v: boolean) => {
    await patch({ [field]: v });
    if (v && user) {
      const ok = await ensurePushPermission();
      if (ok) registerForPush();
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/");
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del("/me");
      setDeleteOpen(false);
      await logout();
      router.replace("/");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={["top"]} testID="profile-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={40}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.onSurface }]}>Би</Text>

        <View style={[styles.stage, { borderColor: colors.border }]}>
          <Character weight={user.weight} color={user.avatar_color} size={110} testID="profile-character" />
          <Text style={styles.stageName}>{user.display_name}</Text>
          <Text style={styles.stageSub}>
            {user.stage} · жин {Math.round(user.weight)}
          </Text>
        </View>

        {/* Нэр */}
        <Card style={{ marginTop: spacing.lg }} testID="name-card">
          <Text style={[styles.label, { color: colors.muted }]}>Нэр</Text>
          <View style={styles.nameRow}>
            <TextInput
              testID="profile-name-input"
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.onSurface, backgroundColor: colors.surface },
              ]}
              value={name}
              onChangeText={setName}
              maxLength={16}
              onBlur={saveName}
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
          </View>
        </Card>

        {/* Өнгө */}
        <Card style={{ marginTop: spacing.md }} testID="color-card">
          <Text style={[styles.label, { color: colors.muted }]}>Дүрийн өнгө</Text>
          <View style={styles.colors}>
            {AVATAR_COLORS.map((c) => (
              <Pressable
                key={c}
                testID={`profile-color-${c.slice(1)}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  patch({ avatar_color: c });
                }}
                style={[
                  styles.colorChip,
                  { backgroundColor: c, borderColor: colors.border },
                  user.avatar_color === c && { transform: [{ scale: 1.12 }] },
                ]}
              >
                {user.avatar_color === c && (
                  <Feather name="check" size={16} color={palette.paper} />
                )}
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Өдрийн зорилго */}
        <Card style={{ marginTop: spacing.md }} testID="goal-card">
          <Text style={[styles.label, { color: colors.muted }]}>Өдрийн зорилго</Text>
          <View style={styles.goalRow}>
            <Pressable
              testID="goal-decrease-button"
              onPress={() => changeGoal(-1)}
              style={[styles.goalBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Feather name="minus" size={18} color={colors.onSurface} />
            </Pressable>
            <Text style={[styles.goalNum, { color: colors.onSurface }]} testID="goal-value">
              {fmtNum(user.daily_goal)}
            </Text>
            <Pressable
              testID="goal-increase-button"
              onPress={() => changeGoal(1)}
              style={[styles.goalBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Feather name="plus" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
          <Text style={[styles.goalHint, { color: colors.muted }]}>4 000–20 000 хооронд</Text>
        </Card>

        {/* Дэвсгэрийн алхам тоолуур (Android) */}
        {backgroundStepsSupported() && (
          <Card style={{ marginTop: spacing.md }} testID="background-steps-card">
            <Text style={[styles.label, { color: colors.muted }]}>Алхам тоолох</Text>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.onSurface }]}>Дэвсгэрт тоолох</Text>
              <Switch
                testID="background-steps-switch"
                value={bgSteps}
                onValueChange={toggleBackgroundSteps}
                trackColor={{ true: palette.jade, false: colors.surfaceTertiary }}
                thumbColor={palette.paper}
              />
            </View>
            <Text style={[styles.goalHint, { color: colors.muted }]}>
              Апп хаалттай үед ч утасны мэдрэгчээр алхам тоолно. Мэдэгдлийн самбарт жижиг
              тоолуур харагдана.
            </Text>
          </Card>
        )}

        {/* Мэдэгдэл */}
        <Card style={{ marginTop: spacing.md }} testID="notif-card">
          <Text style={[styles.label, { color: colors.muted }]}>Мэдэгдэл</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.onSurface }]}>Өглөөний илчлэлт</Text>
            <Switch
              testID="notif-morning-switch"
              value={user.notif_morning}
              onValueChange={(v) => toggleNotif("notif_morning", v)}
              trackColor={{ true: palette.jade, false: colors.surfaceTertiary }}
              thumbColor={palette.paper}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.onSurface }]}>Оройн сануулга</Text>
            <Switch
              testID="notif-evening-switch"
              value={user.notif_evening}
              onValueChange={(v) => toggleNotif("notif_evening", v)}
              trackColor={{ true: palette.jade, false: colors.surfaceTertiary }}
              thumbColor={palette.paper}
            />
          </View>
          <Text style={[styles.goalHint, { color: colors.muted }]}>
            Push мэдэгдэл аппыг суулгасны дараа идэвхжинэ
          </Text>
        </Card>

        {/* Харагдац */}
        <Card style={{ marginTop: spacing.md }} testID="theme-card">
          <Text style={[styles.label, { color: colors.muted }]}>Харагдац</Text>
          <View style={styles.themeRow}>
            {([
              ["system", "Систем"],
              ["light", "Гэрэл"],
              ["dark", "Харанхуй"],
            ] as const).map(([m, label]) => (
              <Pressable
                key={m}
                testID={`theme-${m}-button`}
                onPress={() => setMode(m)}
                style={[
                  styles.themeChip,
                  { borderColor: colors.border },
                  mode === m && { backgroundColor: colors.onSurface },
                ]}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    { color: mode === m ? colors.surface : colors.onSurface },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Btn
          label="Нууцлалын бодлого"
          onPress={() => router.push("/privacy")}
          variant="outline"
          style={{ marginTop: spacing.xl }}
          testID="privacy-policy-button"
        />
        <Btn
          label="Гарах"
          onPress={doLogout}
          variant="outline"
          style={{ marginTop: spacing.md }}
          testID="logout-button"
        />
        <Btn
          label="Данс устгах"
          onPress={() => setDeleteOpen(true)}
          variant="warn"
          style={{ marginTop: spacing.md }}
          testID="delete-account-button"
        />
        <Text style={[styles.deleteHint, { color: colors.muted }]}>
          Данс устгахад бүх өгөгдөл 30 хоногийн дотор бүрэн устана
        </Text>
      </KeyboardAwareScrollView>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Данс устгах уу?</Text>
            <Text style={[styles.sheetText, { color: colors.muted }]}>
              Дүр, алхалтын түүх, бүлгийн гишүүнчлэл бүгд устана. Энэ үйлдлийг буцаах боломжгүй.
            </Text>
            <Btn label="Тийм, устга" onPress={doDelete} variant="warn" loading={busy} testID="confirm-delete-button" />
            <Btn label="Болих" onPress={() => setDeleteOpen(false)} variant="ghost" testID="cancel-delete-button" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    paddingVertical: spacing.md,
  },
  stage: {
    backgroundColor: palette.slate,
    borderRadius: radius.stage,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  stageName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: palette.oat,
    marginTop: spacing.sm,
  },
  stageSub: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: palette.mist,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderRadius: radius.btn,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  colors: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.btn,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
  },
  goalNum: {
    fontFamily: fonts.mono,
    fontSize: 26,
  },
  goalHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  switchLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  themeChip: {
    flex: 1,
    height: 38,
    borderWidth: 1.5,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  themeChipText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
  },
  deleteHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.sm,
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
