// Push бүртгэл — Expo-ийн үнэгүй push сервис.
// Зөвхөн жинхэнэ build дээр токен авах боломжтой; Expo Go/вэб дээр чимээгүй алгасна.
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";

export async function registerForPush(userId: string) {
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
    await api.post("/register-push", {
      user_id: userId,
      platform: Platform.OS,
      device_token: tokenResp.data,
    });
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
