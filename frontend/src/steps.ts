import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import BackgroundSteps from "@/modules/alkhaach-steps";
import { storage } from "@/src/utils/storage";
import { api, API_ROOT, getAuthToken } from "@/src/api";
import {
  healthConnectAvailable,
  isHealthGranted,
  readHealthDays,
  requestHealthPermission,
} from "@/src/health";

import {
  deviceTz,
  liveDelta,
  localDateStr,
  mergeIntoQueue,
  type StepDay,
} from "@/src/utils/stepMath";

export type { StepDay };
export { deviceTz, localDateStr };

const QUEUE_KEY = "alkhaach_pending_sync";
const SUMMARY_CACHE = "alkhaach_summary_cache";
const LIVE_KEY = "alkhaach_live_steps";
// Health Connect зөвшөөрөгдсөн ч 14 хоногт нэг ч алхам ирээгүй (Samsung Health /
// Google Fit холбогдоогүй) — энэ үед мэдрэгч рүү шилжиж, зааварчилгаа харуулна
const HC_EMPTY_KEY = "alkhaach_hc_empty";

export type PermState = "granted" | "denied" | "undetermined" | "unavailable";

// Android-ийн алхамын эх сурвалж (нүүрэн дэх зааварт):
//   health       — Health Connect-оос бүтэн өдрийн тоо ирж байна
//   background   — өөрийн дэвсгэрийн тоолуур (foreground service) ажиллаж байна
//   health-empty — Health Connect хоосон, алхам бичдэг апп холбогдоогүй
//   sensor       — зөвхөн апп нээлттэй үед тоолно
export type AndroidStepSource = "health" | "background" | "health-empty" | "sensor" | "none";

async function isHealthEmpty(): Promise<boolean> {
  return (await storage.getItem(HC_EMPTY_KEY, null)) === "1";
}

export async function getAndroidStepSource(): Promise<AndroidStepSource | null> {
  if (Platform.OS !== "android") return null;
  const hcGranted = await isHealthGranted();
  if (hcGranted && !(await isHealthEmpty())) return "health";
  if (backgroundStepsEnabled()) return "background";
  if (hcGranted) return "health-empty";
  // Health Connect байгаа ч зөвшөөрөөгүй — нүүрэн дээр «Зөвшөөрөл» товч аль хэдийн харагдана
  if (await healthConnectAvailable()) return "none";
  if ((await getPedometerState()) === "granted") return "sensor";
  return "none";
}

export async function getPedometerState(): Promise<PermState> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return "unavailable";
    const p = await Pedometer.getPermissionsAsync();
    if (p.granted) return "granted";
    return p.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function requestPedometerPermission(): Promise<boolean> {
  try {
    const p = await Pedometer.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

// Нэгдсэн: автомат уншилтын төлөв (Health эхэлж, дараа нь Pedometer)
export async function getStepSourceState(): Promise<PermState> {
  if (await isHealthGranted()) return "granted";
  if (Platform.OS === "ios") return getPedometerState();
  if (Platform.OS === "android") {
    // Health Connect (native build) байхгүй бол төхөөрөмжийн алхам мэдрэгч рүү шилжинэ
    if (await healthConnectAvailable()) return "undetermined";
    return getPedometerState();
  }
  return "unavailable";
}

// Нэгдсэн: зөвшөөрөл хүсэх (Health эхэлж, боломжгүй бол Pedometer)
export async function requestStepPermission(): Promise<boolean> {
  if (await requestHealthPermission()) {
    // Health Connect хоосон байвал мэдрэгч нөөц болно — хөдөлгөөний зөвшөөрлийг хамт авна
    if (Platform.OS === "android") await requestPedometerPermission();
    return true;
  }
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return requestPedometerPermission();
  }
  return false;
}

// ---------- Дэвсгэрийн тоолуур (Android foreground service) ----------
// Апп хаалттай үед ч утасны алхам мэдрэгчээс өдөр бүрийн тоог хадгална.
// Мэдэгдлийн самбарт байнгын жижиг тоолуур харагддаг тул хэрэглэгч өөрөө асаана.

export function backgroundStepsSupported(): boolean {
  try {
    return !!BackgroundSteps?.isSupported();
  } catch {
    return false;
  }
}

export function backgroundStepsEnabled(): boolean {
  try {
    return !!BackgroundSteps?.isEnabled();
  } catch {
    return false;
  }
}

export async function enableBackgroundSteps(): Promise<boolean> {
  if (!BackgroundSteps || !backgroundStepsSupported()) return false;
  // Android 10+: ACTIVITY_RECOGNITION; Android 14+ дээр health FGS-д мөн заавал
  if ((await getPedometerState()) !== "granted" && !(await requestPedometerPermission())) {
    return false;
  }
  try {
    const ok = await BackgroundSteps.start(API_ROOT || null, getAuthToken());
    // Апп нээлттэй үед өнөөдөр тоолсноос үргэлжлүүлнэ
    if (ok) {
      const live = await getLive();
      if (live.steps > 0) await BackgroundSteps.raiseDay(live.date, live.steps);
    }
    return ok;
  } catch {
    return false;
  }
}

export async function disableBackgroundSteps() {
  try {
    await BackgroundSteps?.stop();
  } catch {
    // алгасна
  }
}

// Апп нээгдэх бүрт: OS зогсоосон бол дахин асаана. Зөвшөөрөл цуцлагдсан бол
// унтраана — эс тэгвээс "асаалттай" гэж харагдаад юу ч тоолохгүй үлдэнэ.
export async function ensureBackgroundSteps() {
  if (!backgroundStepsEnabled()) return;
  try {
    if (!(await BackgroundSteps!.ensureRunning())) await BackgroundSteps!.stop();
  } catch {
    // алгасна
  }
}

async function readBackgroundDays(): Promise<StepDay[] | null> {
  if (!backgroundStepsEnabled()) return null;
  try {
    const days = await BackgroundSteps!.getDays();
    return days.map((d) => ({ local_date: d.local_date, steps: d.steps, source: "device" }));
  } catch {
    return null;
  }
}

// ---------- Амьд тоолуур (Android: мэдрэгчээс шууд) ----------
// Android дээр түүхэн уншилт байхгүй тул апп идэвхтэй үед watchStepCount-оор
// өдрийн алхамыг хуримтлуулж локалд хадгална.

type LiveStore = { date: string; steps: number };

// Өдөр солигдоход өмнөх өдрийн хуримтлалыг устгахгүй, офлайн дараалалд шилжүүлнэ
async function carryOverLiveDay(date: string, steps: number) {
  if (!date || steps <= 0) return;
  await setQueue(mergeIntoQueue(await getQueue(), date, steps));
}

async function getLive(): Promise<LiveStore> {
  const today = localDateStr(new Date());
  const raw = (await storage.getItem(LIVE_KEY, null)) as string | null;
  if (raw) {
    try {
      const v = JSON.parse(raw) as LiveStore;
      if (v && v.date === today) return { date: today, steps: Number(v.steps) || 0 };
      await carryOverLiveDay(v?.date, Number(v?.steps) || 0);
    } catch {
      // буруу өгөгдөл — шинээр эхэлнэ
    }
  }
  const fresh: LiveStore = { date: today, steps: 0 };
  await storage.setItem(LIVE_KEY, JSON.stringify(fresh));
  return fresh;
}

// Серверийн тоо (Health/гар оруулга) илүү бол локал тоолуурыг түүнд тэнцүүлнэ —
// ингэснээр харагдах тоо хэзээ ч буурахгүй, давхар нэмэгдэхгүй.
async function reconcileLive(summary: any) {
  if (Platform.OS !== "android") return;
  const serverSteps = Number(summary?.today?.steps);
  const date = summary?.local_date;
  if (!date || !Number.isFinite(serverSteps)) return;
  if (date !== localDateStr(new Date())) return;
  if (backgroundStepsEnabled()) {
    try {
      await BackgroundSteps!.raiseDay(date, serverSteps);
    } catch {
      // алгасна
    }
    return;
  }
  const cur = await getLive();
  if (serverSteps > cur.steps) {
    await storage.setItem(LIVE_KEY, JSON.stringify({ date, steps: serverSteps }));
  }
}

async function addLiveSteps(delta: number) {
  if (delta <= 0) return;
  const cur = await getLive();
  cur.steps += delta;
  await storage.setItem(LIVE_KEY, JSON.stringify(cur));
}

let liveSub: { remove: () => void } | null = null;
let lastRaw = 0;

// Мэдрэгчээс алхам тоолж эхэлнэ. Зогсоох функц буцаана.
function subscribeLive() {
  if (liveSub) return;
  lastRaw = 0;
  try {
    liveSub = Pedometer.watchStepCount((r) => {
      const raw = Number(r?.steps) || 0;
      const delta = liveDelta(raw, lastRaw);
      lastRaw = raw;
      void addLiveSteps(delta);
    });
  } catch {
    liveSub = null;
  }
}

function unsubscribeLive() {
  try {
    liveSub?.remove();
  } catch {
    // алгасна
  }
  liveSub = null;
  lastRaw = 0;
}

export function startLiveStepTracking(): () => void {
  if (Platform.OS !== "android" || liveSub) return () => {};
  let cancelled = false;
  (async () => {
    // Health Connect-оос өгөгдөл ирж байвал мэдрэгч хэрэггүй. Хоосон бол мэдрэгч
    // нөөц болно (сервер өдөр бүрийн их утгыг авдаг тул давхар тоологдохгүй).
    if ((await isHealthGranted()) && !(await isHealthEmpty())) return;
    // Дэвсгэрийн тоолуур ажиллаж байвал апп доторх тоолуур хэрэггүй
    if (backgroundStepsEnabled()) return;
    if (cancelled) return;
    subscribeLive();
  })();
  return () => {
    cancelled = true;
    unsubscribeLive();
  };
}

export async function getLiveStepsToday(): Promise<number> {
  return (await getLive()).steps;
}

// iOS: сүүлийн 7 хоногийн алхамыг уншина (CMPedometer 7 хоногийн түүхтэй).
// Android: дэвсгэрийн тоолуурын 14 хоног, эсвэл апп нээлттэй үед тоолсон өнөөдөр.
export async function readDeviceDays(): Promise<StepDay[] | null> {
  if (Platform.OS === "android") {
    const background = await readBackgroundDays();
    if (background) return background.length > 0 ? background : null;
    if ((await getPedometerState()) !== "granted") return null;
    const live = await getLive();
    if (live.steps <= 0) return null;
    return [{ local_date: live.date, steps: live.steps, source: "device" }];
  }
  if (Platform.OS !== "ios") return null;
  try {
    const state = await getPedometerState();
    if (state !== "granted") return null;
    const days: StepDay[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = i === 0 ? now : new Date(new Date(start).setHours(23, 59, 59, 999));
      try {
        const r = await Pedometer.getStepCountAsync(start, end);
        days.push({ local_date: localDateStr(day), steps: r.steps, source: "device" });
      } catch {
        // тухайн өдрийн уншилт амжилтгүй — алгасна
      }
    }
    return days.length > 0 ? days : null;
  } catch {
    return null;
  }
}

export async function getCachedSummary(): Promise<any | null> {
  const raw = (await storage.getItem(SUMMARY_CACHE, null)) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function cacheSummary(summary: any) {
  await storage.setItem(SUMMARY_CACHE, JSON.stringify(summary));
  await reconcileLive(summary);
}

async function getQueue(): Promise<StepDay[]> {
  const raw = (await storage.getItem(QUEUE_KEY, null)) as string | null;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function setQueue(days: StepDay[]) {
  if (days.length === 0) await storage.removeItem(QUEUE_KEY);
  else await storage.setItem(QUEUE_KEY, JSON.stringify(days));
}

// Синк: Health/төхөөрөмжийн өгөгдөл + офлайн дараалал → сервер. Summary буцаана.
export async function syncSteps(): Promise<any | null> {
  let health = await readHealthDays();
  if (Platform.OS === "android" && health) {
    const empty = health.every((d) => d.steps <= 0);
    await storage.setItem(HC_EMPTY_KEY, empty ? "1" : "0");
    // Хоосон Health Connect-ийн 0-үүдийг илгээхгүй — мэдрэгчийн тоог ашиглана
    if (empty) health = null;
  }
  const device = health ?? (await readDeviceDays()) ?? [];
  const queue = await getQueue();
  const merged = new Map<string, StepDay>();
  for (const d of queue) merged.set(d.local_date, d);
  for (const d of device) merged.set(d.local_date, d);
  const days = Array.from(merged.values());

  try {
    const summary = await api.post("/steps/sync", { tz: deviceTz(), days });
    await setQueue([]);
    await cacheSummary(summary);
    return summary;
  } catch (e: any) {
    // Сүлжээгүй үед дараалалд хадгална
    if (days.length > 0) await setQueue(days);
    if (e?.status) throw e;
    return null;
  }
}

export async function submitManualSteps(localDate: string, steps: number): Promise<any> {
  try {
    const summary = await api.post("/steps/manual", { local_date: localDate, steps });
    await cacheSummary(summary);
    return summary;
  } catch (e: any) {
    if (!e?.status) {
      // офлайн — дараалалд нэмнэ
      const queue = await getQueue();
      const filtered = queue.filter((q) => q.local_date !== localDate);
      filtered.push({ local_date: localDate, steps, source: "manual" });
      await setQueue(filtered);
    }
    throw e;
  }
}

export async function fetchSummary(): Promise<any | null> {
  try {
    const summary = await api.get("/me/summary");
    await cacheSummary(summary);
    return summary;
  } catch (e: any) {
    if (e?.status) throw e;
    return getCachedSummary();
  }
}
