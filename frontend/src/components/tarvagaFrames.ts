// АВТОМАТААР ҮҮСГЭСЭН — design/tarvaga/compose_layers.py. Гараар засахгүй.
// Тарваагийн 3D рендер (Blender) жингийн түвшин бүрээр: биеийн давхарга,
// өнгөөр будагдах ороолт, анивчихад хэрэгтэй нүдний байрлал (0..1 харьцаа).

export type TarvagaEye = { x: number; y: number; rx: number; ry: number };
export type TarvagaFrame = { level: number; body: number; scarf: number; eyes: TarvagaEye[]; lid: string };

export const TARVAGA_ASPECT = 650 / 600;

export const TARVAGA_FRAMES: TarvagaFrame[] = [
  {
    level: 0,
    body: require("../../assets/character/tarvaga_body_000.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_000.webp"),
    eyes: [{ x: 0.4123, y: 0.2322, rx: 0.0379, ry: 0.0378 }, { x: 0.5251, y: 0.2347, rx: 0.0381, ry: 0.038 }],
    lid: "#B2A38A",
  },
  {
    level: 5,
    body: require("../../assets/character/tarvaga_body_005.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_005.webp"),
    eyes: [{ x: 0.4121, y: 0.2349, rx: 0.0376, ry: 0.0375 }, { x: 0.5252, y: 0.2373, rx: 0.0379, ry: 0.0378 }],
    lid: "#B5A388",
  },
  {
    level: 10,
    body: require("../../assets/character/tarvaga_body_010.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_010.webp"),
    eyes: [{ x: 0.412, y: 0.2367, rx: 0.0374, ry: 0.0373 }, { x: 0.5252, y: 0.2392, rx: 0.0377, ry: 0.0376 }],
    lid: "#B7A286",
  },
  {
    level: 15,
    body: require("../../assets/character/tarvaga_body_015.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_015.webp"),
    eyes: [{ x: 0.4118, y: 0.2393, rx: 0.0372, ry: 0.0371 }, { x: 0.5254, y: 0.2418, rx: 0.0375, ry: 0.0374 }],
    lid: "#BAA284",
  },
  {
    level: 20,
    body: require("../../assets/character/tarvaga_body_020.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_020.webp"),
    eyes: [{ x: 0.4116, y: 0.2419, rx: 0.037, ry: 0.0369 }, { x: 0.5255, y: 0.2444, rx: 0.0372, ry: 0.0371 }],
    lid: "#BDA282",
  },
  {
    level: 25,
    body: require("../../assets/character/tarvaga_body_025.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_025.webp"),
    eyes: [{ x: 0.4114, y: 0.2445, rx: 0.0368, ry: 0.0366 }, { x: 0.5256, y: 0.247, rx: 0.037, ry: 0.0369 }],
    lid: "#BFA280",
  },
  {
    level: 30,
    body: require("../../assets/character/tarvaga_body_030.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_030.webp"),
    eyes: [{ x: 0.4113, y: 0.2465, rx: 0.0365, ry: 0.0364 }, { x: 0.5256, y: 0.249, rx: 0.0368, ry: 0.0367 }],
    lid: "#C3A37E",
  },
  {
    level: 35,
    body: require("../../assets/character/tarvaga_body_035.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_035.webp"),
    eyes: [{ x: 0.4111, y: 0.249, rx: 0.0363, ry: 0.0362 }, { x: 0.5258, y: 0.2517, rx: 0.0366, ry: 0.0365 }],
    lid: "#C6A37C",
  },
  {
    level: 40,
    body: require("../../assets/character/tarvaga_body_040.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_040.webp"),
    eyes: [{ x: 0.4108, y: 0.2516, rx: 0.0361, ry: 0.036 }, { x: 0.5259, y: 0.2543, rx: 0.0364, ry: 0.0362 }],
    lid: "#C9A47A",
  },
  {
    level: 45,
    body: require("../../assets/character/tarvaga_body_045.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_045.webp"),
    eyes: [{ x: 0.4104, y: 0.254, rx: 0.0359, ry: 0.0357 }, { x: 0.5262, y: 0.2566, rx: 0.0361, ry: 0.036 }],
    lid: "#CCA477",
  },
  {
    level: 50,
    body: require("../../assets/character/tarvaga_body_050.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_050.webp"),
    eyes: [{ x: 0.4101, y: 0.2566, rx: 0.0356, ry: 0.0355 }, { x: 0.5263, y: 0.2593, rx: 0.0359, ry: 0.0358 }],
    lid: "#CDA274",
  },
  {
    level: 55,
    body: require("../../assets/character/tarvaga_body_055.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_055.webp"),
    eyes: [{ x: 0.4096, y: 0.2586, rx: 0.0354, ry: 0.0353 }, { x: 0.5268, y: 0.2613, rx: 0.0357, ry: 0.0356 }],
    lid: "#D0A271",
  },
  {
    level: 60,
    body: require("../../assets/character/tarvaga_body_060.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_060.webp"),
    eyes: [{ x: 0.4093, y: 0.2615, rx: 0.0352, ry: 0.0351 }, { x: 0.5272, y: 0.2643, rx: 0.0355, ry: 0.0354 }],
    lid: "#D3A36F",
  },
  {
    level: 65,
    body: require("../../assets/character/tarvaga_body_065.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_065.webp"),
    eyes: [{ x: 0.4088, y: 0.2638, rx: 0.035, ry: 0.0349 }, { x: 0.5274, y: 0.2667, rx: 0.0352, ry: 0.0351 }],
    lid: "#D6A36C",
  },
  {
    level: 70,
    body: require("../../assets/character/tarvaga_body_070.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_070.webp"),
    eyes: [{ x: 0.4079, y: 0.2664, rx: 0.0347, ry: 0.0346 }, { x: 0.5276, y: 0.2693, rx: 0.035, ry: 0.0349 }],
    lid: "#D9A46A",
  },
  {
    level: 75,
    body: require("../../assets/character/tarvaga_body_075.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_075.webp"),
    eyes: [{ x: 0.4075, y: 0.2689, rx: 0.0345, ry: 0.0344 }, { x: 0.5278, y: 0.2718, rx: 0.0348, ry: 0.0347 }],
    lid: "#DCA467",
  },
  {
    level: 80,
    body: require("../../assets/character/tarvaga_body_080.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_080.webp"),
    eyes: [{ x: 0.4071, y: 0.2714, rx: 0.0343, ry: 0.0342 }, { x: 0.528, y: 0.2743, rx: 0.0346, ry: 0.0345 }],
    lid: "#E0A463",
  },
  {
    level: 85,
    body: require("../../assets/character/tarvaga_body_085.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_085.webp"),
    eyes: [{ x: 0.4068, y: 0.2735, rx: 0.0341, ry: 0.034 }, { x: 0.5283, y: 0.2769, rx: 0.0344, ry: 0.0343 }],
    lid: "#E0A360",
  },
  {
    level: 90,
    body: require("../../assets/character/tarvaga_body_090.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_090.webp"),
    eyes: [{ x: 0.4064, y: 0.276, rx: 0.0339, ry: 0.0338 }, { x: 0.529, y: 0.279, rx: 0.0341, ry: 0.034 }],
    lid: "#E3A35C",
  },
  {
    level: 95,
    body: require("../../assets/character/tarvaga_body_095.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_095.webp"),
    eyes: [{ x: 0.4059, y: 0.2785, rx: 0.0336, ry: 0.0335 }, { x: 0.5287, y: 0.2815, rx: 0.0339, ry: 0.0338 }],
    lid: "#E6A358",
  },
  {
    level: 100,
    body: require("../../assets/character/tarvaga_body_100.webp"),
    scarf: require("../../assets/character/tarvaga_scarf_100.webp"),
    eyes: [{ x: 0.405, y: 0.281, rx: 0.0334, ry: 0.0333 }, { x: 0.529, y: 0.284, rx: 0.0337, ry: 0.0336 }],
    lid: "#E9A454",
  },
];
