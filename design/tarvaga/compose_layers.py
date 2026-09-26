"""
build_tarvaga.py-ийн рендерүүдийг аппын хоёр давхарга болгоно (Python 3 + Pillow + numpy).

  python design/tarvaga/compose_layers.py design/tarvaga/renders frontend/assets/character

Түвшин бүрт:
  tarvaga_scarf_XXX.webp — цагаан, alpha = ороолтын хэсэг. Апп `tintColor`-оор
                          хэрэглэгчийн өнгөөр будна.
  tarvaga_body_XXX.webp  — ороолтын дээр тавигдана: ороолтоос бусад бүх хэсэг +
                          ороолтын сүүдэр (хар, alpha = 1 - гэрэлтэлт) + газрын сүүдэр.
Хоёуланг нь давхарлахад ороолт = өнгө × гэрэлтэлт болж, 3D сүүдэр нь хадгалагдана.

Мөн frontend/src/components/tarvagaFrames.ts-ийг (require жагсаалт + нүдний байрлал) үүсгэнэ.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SHADOW_OPACITY = 0.38


def load(path):
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0


def to_img(rgb, alpha):
    arr = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]])
    return Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "RGBA")


def ground_shadow(alpha):
    """Хөлний доорх зөөлөн эллипс сүүдэр (0..SHADOW_OPACITY)."""
    h, w = alpha.shape
    rows = np.where(alpha.max(axis=1) > 0.5)[0]
    bottom = rows.max()
    band = alpha[max(0, bottom - int(0.08 * h)):bottom + 1] > 0.5
    cols = np.where(band.any(axis=0))[0]
    cx, half = (cols.min() + cols.max()) / 2, (cols.max() - cols.min()) / 2 * 1.08
    ry = 0.022 * h
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).ellipse((cx - half, bottom - ry * 1.2, cx + half, bottom + ry * 0.8),
                                fill=int(255 * SHADOW_OPACITY))
    img = img.filter(ImageFilter.GaussianBlur(0.02 * h))
    return np.asarray(img, dtype=np.float32) / 255.0


def compose_level(beauty, mask):
    rgb, a = beauty[..., :3], beauty[..., 3]
    scarf = np.minimum(mask[..., 0] * mask[..., 3], a)  # ороолтын бүрхэлт (premultiplied)
    frac = np.where(a > 1e-4, scarf / np.maximum(a, 1e-4), 0.0)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lit = lum[frac > 0.9]
    ref = np.clip(np.percentile(lit, 97) if lit.size else 0.9, 0.75, 1.0)
    light = np.clip(lum / ref, 0.12, 1.0)

    rest = np.clip(a - scarf, 0, 1)  # ороолтоос бусад хэсгийн бүрхэлт
    alpha = scarf * (1 - light) + rest
    premult = rgb * rest[..., None]
    shadow = ground_shadow(a)
    alpha = alpha + shadow * (1 - a)
    straight = np.where(alpha[..., None] > 1e-4, premult / np.maximum(alpha, 1e-4)[..., None], 0.0)
    return to_img(np.ones_like(rgb), scarf), to_img(straight, alpha)


def lid_color(beauty, eye):
    """Анивчихад нүдийг таглах зовхины өнгө — хөмсөгний хэсгээс авна."""
    h, w = beauty.shape[:2]
    x = int(eye["x"] * w)
    y = int((eye["y"] - 1.9 * eye["ry"]) * h)
    patch = beauty[max(0, y - 4):y + 5, max(0, x - 4):x + 5]
    ok = patch[..., 3] > 0.9
    rgb = patch[..., :3][ok].mean(axis=0) if ok.any() else np.array([0.6, 0.5, 0.4])
    return "#" + "".join(f"{int(round(c * 255)):02X}" for c in rgb)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    here = os.path.dirname(os.path.abspath(__file__))
    ts_path = os.path.normpath(os.path.join(here, "..", "..", "frontend", "src", "components", "tarvagaFrames.ts"))
    os.makedirs(dst, exist_ok=True)
    with open(os.path.join(src, "meta.json"), encoding="utf-8") as f:
        meta = json.load(f)

    frames = []
    for level_s, info in sorted(meta["levels"].items(), key=lambda kv: int(kv[0])):
        level = int(level_s)
        beauty = load(os.path.join(src, f"beauty_{level:03d}.png"))
        mask = load(os.path.join(src, f"mask_{level:03d}.png"))
        scarf_img, body_img = compose_level(beauty, mask)
        # WebP: PNG-ээс 3-4 дахин жижиг. Ороолтод зөвхөн alpha чухал тул lossless.
        scarf_img.save(os.path.join(dst, f"tarvaga_scarf_{level:03d}.webp"), lossless=True, method=6)
        body_img.save(os.path.join(dst, f"tarvaga_body_{level:03d}.webp"), quality=90, alpha_quality=100, method=6)
        eyes = info["eyes"]
        frames.append({"level": level, "eyes": eyes, "lid": lid_color(beauty, eyes[0])})
        print("level", level)

    rel = os.path.relpath(dst, os.path.dirname(ts_path)).replace(os.sep, "/")
    lines = [
        "// АВТОМАТААР ҮҮСГЭСЭН — design/tarvaga/compose_layers.py. Гараар засахгүй.",
        "// Тарваагийн 3D рендер (Blender) жингийн түвшин бүрээр: биеийн давхарга,",
        "// өнгөөр будагдах ороолт, анивчихад хэрэгтэй нүдний байрлал (0..1 харьцаа).",
        "",
        "export type TarvagaEye = { x: number; y: number; rx: number; ry: number };",
        "export type TarvagaFrame = { level: number; body: number; scarf: number; eyes: TarvagaEye[]; lid: string };",
        "",
        f"export const TARVAGA_ASPECT = {meta['height']} / {meta['width']};",
        "",
        "export const TARVAGA_FRAMES: TarvagaFrame[] = [",
    ]
    for fr in frames:
        eyes = ", ".join(f"{{ x: {e['x']}, y: {e['y']}, rx: {e['rx']}, ry: {e['ry']} }}" for e in fr["eyes"])
        lines += [
            "  {",
            f"    level: {fr['level']},",
            f"    body: require(\"{rel}/tarvaga_body_{fr['level']:03d}.webp\"),",
            f"    scarf: require(\"{rel}/tarvaga_scarf_{fr['level']:03d}.webp\"),",
            f"    eyes: [{eyes}],",
            f"    lid: \"{fr['lid']}\",",
            "  },",
        ]
    lines += ["];", ""]
    with open(ts_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print("wrote", ts_path)


main()
