import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useColorScheme } from "react-native";
import { storage } from "@/src/utils/storage";
import { ThemeColors, lightColors, darkColors } from "@/src/theme";

type Mode = "system" | "light" | "dark";

type ThemeCtx = {
  colors: ThemeColors;
  isDark: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
};

const Ctx = createContext<ThemeCtx>({
  colors: lightColors,
  isDark: false,
  mode: "system",
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>("system");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem("theme_mode", "system");
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    })();
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    storage.setItem("theme_mode", m);
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  return <Ctx.Provider value={{ colors, isDark, mode, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
