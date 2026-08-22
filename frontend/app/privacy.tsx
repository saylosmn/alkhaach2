import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing } from "@/src/theme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Ямар мэдээлэл цуглуулдаг вэ",
    body: "АЛХААЧ дараах мэдээллийг л цуглуулна: Google дансны имэйл ба нэр (нэвтрэхэд), таны сонгосон дүрийн нэр ба өнгө, өдөр тутмын алхамын тоо, өдрийн зорилго, цагийн бүс. Өөр юу ч цуглуулахгүй.",
  },
  {
    title: "2. Эрүүл мэндийн өгөгдөл",
    body: "Апп нь Apple Health (iOS) болон Health Connect (Android)-оос зөвхөн алхамын тоог уншина. Зөвхөн унших эрхтэй — юу ч бичихгүй. Байршил, зүрхний цохилт, биеийн жин, унтлага зэрэг өөр ямар ч эрүүл мэндийн төрөлд хандахгүй. Зөвшөөрлөө хэдийд ч утасныхаа тохиргооноос цуцалж болно — апп гараар оруулах горимоор үргэлжлүүлэн ажиллана.",
  },
  {
    title: "3. Өгөгдөл хэрхэн ашиглагддаг вэ",
    body: "Алхамын тоо нь зөвхөн таны дүрийн жинг тооцоолох, өөрийн явцыг харуулах, таны нэгдсэн бүлгүүдэд харуулахад ашиглагдана. Өгөгдлийг зар сурталчилгаанд ашиглахгүй, гуравдагч этгээдэд зарахгүй, дамжуулахгүй.",
  },
  {
    title: "4. Бүлгийн нууцлал",
    body: "Таны дүр, өнөөдрийн алхалт зөвхөн таны нэгдсэн хаалттай бүлгийн гишүүдэд харагдана. Дэлхийн нээлттэй лидерборд байхгүй. Бүлгээс гарсан даруйд таны өгөгдөл тэр бүлэгт харагдахаа болино.",
  },
  {
    title: "5. Мэдэгдэл",
    body: "Апп өдөрт хамгийн ихдээ 2 push мэдэгдэл илгээнэ (өглөөний илчлэлт, оройн сануулга). Тус бүрийг профайлын тохиргооноос унтраах боломжтой.",
  },
  {
    title: "6. Өгөгдөл хадгалалт ба устгал",
    body: "Өгөгдөл найдвартай серверт хадгалагдана. «Данс устгах» товчийг дарахад таны бүх өгөгдөл — дүр, алхалтын түүх, бүлгийн гишүүнчлэл — 30 хоногийн дотор бүрэн устана.",
  },
  {
    title: "7. Хүүхдийн нууцлал",
    body: "Апп 13-аас доош насны хүүхдэд зориулагдаагүй бөгөөд тэдний мэдээллийг санаатайгаар цуглуулдаггүй.",
  },
  {
    title: "8. Холбоо барих",
    body: "Нууцлалтай холбоотой асуулт байвал info@alkhaach.mn хаягаар холбогдоно уу.",
  },
];

export default function Privacy() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} testID="privacy-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="privacy-back-button">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Нууцлалын бодлого</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.updated, { color: colors.muted }]}>
          Сүүлд шинэчилсэн: 2026 оны 6-р сар
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{s.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.muted }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
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
    paddingBottom: spacing.xxl,
  },
  updated: {
    fontFamily: fonts.mono,
    fontSize: 11,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
});
