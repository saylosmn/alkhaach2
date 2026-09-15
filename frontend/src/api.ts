// Ард нь налуу зураастай URL тохируулсан ч `…com//api` болж эвдрэхээс сэргийлнэ
const ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
const BASE = `${ROOT}/api`;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
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

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
