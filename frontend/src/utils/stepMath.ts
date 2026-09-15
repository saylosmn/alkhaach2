// Алхам тооллогын цэвэр логик — native модульгүй тул нэгж тестээр шалгах боломжтой.
// steps.ts эдгээрийг импортлон хэрэглэнэ.

export type StepDay = { local_date: string; steps: number; source: string };

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

// Pedometer.watchStepCount нь бүртгэснээс хойшхи хуримтлалыг өгдөг.
// Тоолуур тэглэгдвэл (шинэ subscription) бүхэл утгыг нь зөрүү гэж авна.
export function liveDelta(raw: number, lastRaw: number): number {
  const r = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const l = Number.isFinite(lastRaw) ? Math.max(0, lastRaw) : 0;
  return r >= l ? r - l : r;
}

// Өдрийн хуримтлалыг офлайн дараалалд нэмнэ. Тухайн өдөр аль хэдийн байвал
// зөвхөн ИХ утгаар нь шинэчилнэ (алхам хэзээ ч буурахгүй).
export function mergeIntoQueue(
  queue: StepDay[],
  date: string,
  steps: number,
): StepDay[] {
  if (!date || !(steps > 0)) return queue;
  const out = queue.filter((q) => q.local_date !== date);
  const existing = queue.find((q) => q.local_date === date);
  const best = Math.max(steps, existing?.steps ?? 0);
  out.push({ local_date: date, steps: best, source: "device" });
  return out;
}
