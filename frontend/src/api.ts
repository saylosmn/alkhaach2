import BackgroundSteps from "@/modules/alkhaach-steps";

// Ард нь налуу зураастай URL тохируулсан ч `…com//api` болж эвдрэхээс сэргийлнэ
export const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
const BASE = `${API_ROOT}/api`;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
  // Дэвсгэрийн тоолуур сервер рүү өөрөө илгээдэг — токеныг нь шинэчилнэ
  // (native тал зөвхөн асаалттай үед хадгална)
  BackgroundSteps?.setAuth(t).catch(() => {});
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Render-ийн үнэгүй багц унтсан бол сэрэхэд 30–60 сек болдог — түүнийг даах хэмжээний,
// гэхдээ муу сүлжээнд хүсэлт үүрд өлгөөтэй үлдэхгүй хугацаа. Хэтэрвэл сүлжээний алдаа
// (status-гүй) болж, дуудагч талууд офлайн горимоор (кэш/дараалал) үргэлжилнэ.
const TIMEOUT_MS = 60_000;

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    const msg =
      typeof data?.detail === "string" ? data.detail : "Алдаа гарлаа. Дахин оролдоно уу.";
    throw new ApiError(res.status, msg);
  }
  return data;
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  patch: (path: string, body?: unknown) => request("PATCH", path, body),
  del: (path: string) => request("DELETE", path),
};
