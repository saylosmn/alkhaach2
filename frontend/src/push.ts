// Push бүртгэл — Expo-ийн үнэгүй push сервис.
// Зөвхөн жинхэнэ build дээр токен авах боломжтой; Expo Go/вэб дээр чимээгүй алгасна.
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";

const PUSH_TOKEN_KEY = "alkhaach_push_token";

// Энэ төхөөрөмжийн Expo push токен (logout үед серверээс устгуулахад хэрэгтэй)
export async function getStoredPushToken(): Promise<string | null> {
  return (await storage.getItem(PUSH_TOKEN_KEY, null)) as string | null;
}

export async function registerForPush() {
  if (Platform.OS === "web") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      const prompted = await storage.getItem("push_prompted", null);
      if (!prompted) {
        await storage.setItem("push_prompted", "1");
        const r = await Notifications.requestPermissionsAsync();
        granted = r.granted;
      }
    }
    if (!granted) return;

    // Android дээр мэдэгдэл харагдахын тулд суваг заавал хэрэгтэй
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "АЛХААЧ",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return; // EAS project холбоогүй build — push алгасна

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    // user_id илгээхгүй — сервер Bearer токеноос тодорхойлно
    await api.post("/register-push", {
      platform: Platform.OS,
      device_token: tokenResp.data,
    });
    await storage.setItem(PUSH_TOKEN_KEY, tokenResp.data);
  } catch {
    // Expo Go / симулятор — native push токен байхгүй
  }
}

// Мэдэгдлийн зөвшөөрөл хүсэх (профайлын toggle дээр дуудагдана)
export async function ensurePushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    if (!perm.canAskAgain) return false;
    const r = await Notifications.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}
