import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";
import { api, setAuthToken, setUnauthorizedHandler } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "alkhaach_session_token";

export type User = {
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  display_name: string | null;
  avatar_color: string;
  daily_goal: number;
  weight: number;
  stage: string;
  tz: string;
  onboarded: boolean;
  streak: number;
  notif_morning: boolean;
  notif_evening: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
  refreshUser: async () => {},
});

const processedSessionIds = new Set<string>();

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingUrlRef = useRef<string | null>(null);

  const setUser = useCallback((u: User | null) => setUserState(u), []);

  const storeToken = useCallback(async (token: string | null) => {
    setAuthToken(token);
    if (Platform.OS === "web") {
      try {
        if (token) window.localStorage.setItem(TOKEN_KEY, token);
        else window.localStorage.removeItem(TOKEN_KEY);
      } catch {}
    } else {
      if (token) await storage.secureSet(TOKEN_KEY, token);
      else await storage.secureRemove(TOKEN_KEY);
    }
  }, []);

  const readToken = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === "web") {
      try {
        return window.localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return (await storage.secureGet(TOKEN_KEY, null)) as string | null;
  }, []);

  const exchangeSessionId = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (processedSessionIds.has(sessionId)) return false;
      processedSessionIds.add(sessionId);
      try {
        const data = await api.post("/auth/session", { session_id: sessionId });
        await storeToken(data.session_token);
        setUserState(data.user);
        return true;
      } catch {
        return false;
      }
    },
    [storeToken],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storeToken(null);
    setUserState(null);
  }, [storeToken]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.get("/auth/me");
      setUserState(u);
    } catch {}
  }, []);

  // Session шалгалт + deep link сонсогч
  useEffect(() => {
    setUnauthorizedHandler(() => {
      storeToken(null);
      setUserState(null);
    });

    let sub: { remove: () => void } | null = null;
    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", (e) => {
        pendingUrlRef.current = e.url;
        const sid = extractSessionId(e.url);
        if (sid) exchangeSessionId(sid);
      });
    }

    (async () => {
      try {
        // 1) URL дээрх session_id-г эхэлж боловсруулна
        if (Platform.OS === "web") {
          const href = typeof window !== "undefined" ? window.location.href : "";
          const sid = extractSessionId(href);
          if (sid) {
            const ok = await exchangeSessionId(sid);
            if (ok) {
              try {
                const url = new URL(window.location.href);
                url.hash = url.hash.replace(/session_id=[^&#]+&?/, "").replace(/^#?$/, "");
                url.searchParams.delete("session_id");
                window.history.replaceState(window.history.state, "", url.toString());
              } catch {}
              setLoading(false);
              return;
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            const ok = await exchangeSessionId(sid);
            if (ok) {
              setLoading(false);
              return;
            }
          }
        }
        // 2) Хадгалсан токен
        const token = await readToken();
        if (token) {
          setAuthToken(token);
          try {
            const u = await api.get("/auth/me");
            setUserState(u);
          } catch {
            await storeToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      sub?.remove();
      setUnauthorizedHandler(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/google/start?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    pendingUrlRef.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    let sid: string | null = null;
    if (result.type === "success" && "url" in result) {
      sid = extractSessionId(result.url);
    }
    if (!sid) sid = extractSessionId(pendingUrlRef.current);
    if (!sid) sid = extractSessionId(await Linking.getInitialURL());
    if (sid) await exchangeSessionId(sid);
  }, [exchangeSessionId]);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, setUser, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
