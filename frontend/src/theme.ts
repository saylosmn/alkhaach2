// АЛХААЧ дизайн систем — Playful Neo-Brutalism
export const palette = {
  oat: "#EFEADC",
  ink: "#191F1B",
  jade: "#12A87E",
  amber: "#F0A03C",
  ultra: "#4A3AFF",
  slate: "#232B25",
  mist: "#D8D2C0",
  paper: "#FFFDF7",
};

export const AVATAR_COLORS = [
  "#12A87E",
  "#F0A03C",
  "#4A3AFF",
  "#E2574C",
  "#3A9BDC",
  "#C25AA8",
];

export type ThemeColors = {
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceInverse: string;
  onSurfaceInverse: string;
  brand: string;
  onBrand: string;
  social: string;
  onSocial: string;
  warn: string;
  onWarn: string;
  border: string;
  muted: string;
};

export const lightColors: ThemeColors = {
  surface: palette.oat,
  onSurface: palette.ink,
  surfaceSecondary: palette.paper,
  surfaceTertiary: palette.mist,
  surfaceInverse: palette.slate,
  onSurfaceInverse: palette.oat,
  brand: palette.jade,
  onBrand: palette.paper,
  social: palette.ultra,
  onSocial: palette.paper,
  warn: palette.amber,
  onWarn: palette.ink,
  border: palette.ink,
  muted: "#6B6F68",
};

export const darkColors: ThemeColors = {
  surface: palette.slate,
  onSurface: palette.oat,
  surfaceSecondary: palette.ink,
  surfaceTertiary: "#404842",
  surfaceInverse: palette.oat,
  onSurfaceInverse: palette.ink,
  brand: palette.jade,
  onBrand: palette.paper,
  social: "#6D5FFF",
  onSocial: palette.paper,
  warn: palette.amber,
  onWarn: palette.ink,
  border: palette.oat,
  muted: "#9AA096",
};

export const fonts = {
  display: "Manrope-ExtraBold",
  body: "Inter-Regular",
  bodySemi: "Inter-SemiBold",
  mono: "JetBrainsMono-Medium",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { btn: 14, card: 20, stage: 28 };

export const STAGE_NAMES: { max: number; name: string }[] = [
  { max: 19, name: "Хийсгэлэн" },
  { max: 39, name: "Тамирчин" },
  { max: 59, name: "Хэвийн" },
  { max: 79, name: "Бүдүүн" },
  { max: 100, name: "Бөндгөр" },
];

export function stageName(weight: number): string {
  for (const s of STAGE_NAMES) if (weight <= s.max) return s.name;
  return "Хэвийн";
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function mixColor(c1: string, c2: string, t: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const m = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Жингээс хамаарсан дүрийн өнгө: хаш → хув
export function weightColor(weight: number): string {
  return mixColor(palette.jade, palette.amber, Math.max(0, Math.min(1, weight / 100)));
}

export function fmtNum(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const MN_DAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
