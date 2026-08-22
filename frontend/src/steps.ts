import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api";
import {
  healthConnectAvailable,
  isHealthGranted,
  readHealthDays,
  requestHealthPermission,
} from "@/src/health";

export type StepDay = { local_date: string; steps: number; source: string };

const QUEUE_KEY = "alkhaach_pending_sync";
const SUMMARY_CACHE = "alkhaach_summary_cache";

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ulaanbaatar";
  } catch {
    return "Asia/Ulaanbaatar";
  }
}

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type PermState = "granted" | "denied" | "undetermined" | "unavailable";

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
    // Android дээр автомат уншилт зөвхөн Health Connect-оор (native build)
    if (await healthConnectAvailable()) return "undetermined";
    return "unavailable";
  }
  return "unavailable";
}

// Нэгдсэн: зөвшөөрөл хүсэх (Health эхэлж, боломжгүй бол Pedometer)
export async function requestStepPermission(): Promise<boolean> {
  if (await requestHealthPermission()) return true;
  if (Platform.OS === "ios") return requestPedometerPermission();
  return false;
}

// iOS: сүүлийн 7 хоногийн алхамыг уншина (CMPedometer 7 хоногийн түүхтэй).
// Android (Expo Go): түүхэн уншилт боломжгүй — null буцаана → гараар оруулах горим.
export async function readDeviceDays(): Promise<StepDay[] | null> {
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
  const health = await readHealthDays();
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
