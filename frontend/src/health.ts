// HealthKit (iOS) + Health Connect (Android) — зөвхөн native build дээр ажиллана.
// Expo Go / вэб дээр null буцаана → Pedometer/гараар оруулах горим руу шилжинэ.
import { NativeModules, Platform } from "react-native";
import { storage } from "@/src/utils/storage";

export type HealthStepDay = { local_date: string; steps: number; source: string };

const IOS_HEALTH_FLAG = "health_ios_authorized";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayWindows(n = 14): { date: string; start: Date; end: Date }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(now);
    start.setDate(now.getDate() - (n - 1 - i));
    start.setHours(0, 0, 0, 0);
    const end =
      i === n - 1 ? now : new Date(new Date(start).setHours(23, 59, 59, 999));
    return { date: localDateStr(start), start, end };
  });
}

// ---------- iOS: HealthKit ----------

function getAppleHealthKit(): any | null {
  if (Platform.OS !== "ios") return null;
  if (!NativeModules.AppleHealthKit) return null; // Expo Go — native модуль байхгүй
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-health").default;
  } catch {
    return null;
  }
}

function initApple(hk: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const P = hk.Constants.Permissions;
      hk.initHealthKit(
        { permissions: { read: [P.StepCount], write: [] } },
        (err: string) => resolve(!err),
      );
    } catch {
      resolve(false);
    }
  });
}

function appleReadDays(hk: any): Promise<HealthStepDay[] | null> {
  const wins = dayWindows();
  return new Promise((resolve) => {
    try {
      hk.getDailyStepCountSamples(
        {
          startDate: wins[0].start.toISOString(),
          endDate: wins[wins.length - 1].end.toISOString(),
        },
        (err: string, results: { startDate: string; value?: number }[]) => {
          if (err) return resolve(null);
          const byDate = new Map<string, number>();
          for (const row of results || []) {
            const d = localDateStr(new Date(row.startDate));
            byDate.set(d, (byDate.get(d) || 0) + Number(row.value || 0));
          }
          resolve(
            wins.map((w) => ({
              local_date: w.date,
              steps: Math.max(0, Math.round(byDate.get(w.date) || 0)),
              source: "device",
            })),
          );
        },
      );
    } catch {
      resolve(null);
    }
  });
}

// ---------- Android: Health Connect ----------

function getHealthConnect(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-health-connect");
  } catch {
    return null;
  }
}

export async function healthConnectAvailable(): Promise<boolean> {
  const hc = getHealthConnect();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    const AVAILABLE = hc.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
    return status === AVAILABLE;
  } catch {
    return false; // Expo Go — native модуль байхгүй
  }
}

async function androidGranted(hc: any): Promise<boolean> {
  try {
    const ok = await hc.initialize();
    if (!ok) return false;
    const granted = await hc.getGrantedPermissions();
    return (granted || []).some(
      (p: any) => p.recordType === "Steps" && p.accessType === "read",
    );
  } catch {
    return false;
  }
}

async function androidReadDays(hc: any): Promise<HealthStepDay[] | null> {
  try {
    const days: HealthStepDay[] = [];
    for (const w of dayWindows()) {
      try {
        const r = await hc.aggregateRecord({
          recordType: "Steps",
          timeRangeFilter: {
            operator: "between",
            startTime: w.start.toISOString(),
            endTime: w.end.toISOString(),
          },
        });
        days.push({
          local_date: w.date,
          steps: Math.max(0, Math.round(Number(r?.COUNT_TOTAL ?? 0))),
          source: "device",
        });
      } catch {
        // тухайн өдрийн уншилт амжилтгүй — алгасна
      }
    }
    return days.length > 0 ? days : null;
  } catch {
    return null;
  }
}

// Health Connect-ийн тохиргоо (эх сурвалж аппуудыг холбох) дэлгэцийг нээнэ
export function openHealthConnectSettings(): boolean {
  const hc = getHealthConnect();
  if (!hc) return false;
  try {
    hc.openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}

// ---------- Нэгдсэн API ----------

// Health эх сурвалж зөвшөөрөгдсөн эсэх (prompt харуулахгүй, чимээгүй шалгана)
export async function isHealthGranted(): Promise<boolean> {
  if (Platform.OS === "ios") {
    const hk = getAppleHealthKit();
    if (!hk) return false;
    const flag = await storage.getItem(IOS_HEALTH_FLAG, null);
    return !!flag;
  }
  if (Platform.OS === "android") {
    const hc = getHealthConnect();
    if (!hc || !(await healthConnectAvailable())) return false;
    return androidGranted(hc);
  }
  return false;
}

// Health зөвшөөрөл хүсэх (системийн prompt гарна)
export async function requestHealthPermission(): Promise<boolean> {
  if (Platform.OS === "ios") {
    const hk = getAppleHealthKit();
    if (!hk) return false;
    const ok = await initApple(hk);
    if (ok) await storage.setItem(IOS_HEALTH_FLAG, "1");
    return ok;
  }
  if (Platform.OS === "android") {
    const hc = getHealthConnect();
    if (!hc || !(await healthConnectAvailable())) return false;
    try {
      const ok = await hc.initialize();
      if (!ok) return false;
      const granted = await hc.requestPermission([
        { accessType: "read", recordType: "Steps" },
      ]);
      return (granted || []).some(
        (p: any) => p.recordType === "Steps" && p.accessType === "read",
      );
    } catch {
      return false;
    }
  }
  return false;
}

// Сүүлийн 14 хоногийн алхамыг Health-ээс уншина (боломжгүй бол null)
export async function readHealthDays(): Promise<HealthStepDay[] | null> {
  if (Platform.OS === "ios") {
    const hk = getAppleHealthKit();
    if (!hk) return null;
    const flag = await storage.getItem(IOS_HEALTH_FLAG, null);
    if (!flag) return null; // зөвшөөрөл хараахан хүсээгүй — prompt-гүйгээр уншихгүй
    const ok = await initApple(hk);
    if (!ok) return null;
    return appleReadDays(hk);
  }
  if (Platform.OS === "android") {
    const hc = getHealthConnect();
    if (!hc) return null;
    if (!(await androidGranted(hc))) return null;
    return androidReadDays(hc);
  }
  return null;
}
