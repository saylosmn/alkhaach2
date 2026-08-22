# АЛХААЧ — PRD

## Original problem statement
Монгол хэл дээрх алхалт хэмжигч апп. Хэрэглэгч бүр SVG дүртэй бөгөөд өдөр тутмын
алхалтаас хамаарч дүр нь турах/бүдүүрэх (жин 0–100). 6 оронтой кодоор хаалттай
бүлэг үүсгэж, зөвхөн гишүүд бие биеийнхээ дүр, алхалтыг харна. Дизайн:
Playful Neo-Brutalism (Овъёос/Бэх/Хаш/Хув/Ультра/Занар палитр, хатуу 0 2px 0
сүүдэр, 1.5px хүрээ). Дизайн PDF хавсаргасан.

## User choices
- Стек: Expo (React Native) + FastAPI + MongoDB (Capacitor/MySQL-ийн оронд — зөвшөөрсөн)
- Нэвтрэлт: Emergent-ийн удирддаг Google Auth
- Алхам: Expo Pedometer (iOS) + гараар оруулах горим; native build дээр
  HealthKit/Health Connect дараа нэмэх
- Push мэдэгдэл: MVP-д оруулаагүй, дараа нэмнэ

## Architecture
- Backend: `/app/backend/server.py` — FastAPI, бүх route `/api` prefix-тэй
  - Auth: POST /api/auth/session (Emergent session_id солилцоо), GET /api/auth/me,
    POST /api/auth/logout — Bearer session_token (7 хоног)
  - Профайл: PATCH /api/me (нэр 2–16, өнгө, зорилго 4000–20000, tz, мэдэгдэл),
    DELETE /api/me (бүх өгөгдөл каскад устгана)
  - Алхам: POST /api/steps/sync (14 хоногийн багц, дарж бичих, >60000 → flagged),
    POST /api/steps/manual (source="manual", «Г» тэмдэг), GET /api/me/summary
  - Жингийн хөдөлгүүр: cron-ийн оронд lazy боловсруулалт — summary/sync дуудагдахад
    боловсруулаагүй өнгөрсөн өдрүүдийг дарааллаар тооцно.
    Томьёо: delta=(зорилго−алхам)/зорилго; шинэ_жин=clamp(0,100, жин+delta×6);
    ±6/өдөр хязгаар; 2× зорилго → −2; 7 хоногийн streak → −4. Шинэ хэрэглэгч 50.
  - Бүлэг: POST /api/groups (6 оронтой код, O 0 I 1 L хасагдсан charset),
    POST /api/groups/join (5 буруу/10мин → 429 rate limit), GET /api/groups,
    GET /api/groups/preview/{code}, GET /api/groups/{id} (гишүүн биш → 403!),
    DELETE members (өөрөө гарах / owner хасах), POST code (owner солих),
    DELETE group (owner). Хязгаар: 10 бүлэг/хэрэглэгч, 50 гишүүн/бүлэг.
  - Огноо: хэрэглэгчийн tz-ээр орон нутгийн огноо (YYYY-MM-DD string)
- Frontend: Expo Router
  - `app/index.tsx` — нэвтрэх (A) + auth gate
  - `app/onboarding.tsx` (B нэр+6 өнгө), `app/permission.tsx` (C зөвшөөрөл)
  - `app/(tabs)/` — home (D), journal (E), groups (F), profile (I); custom tab bar
  - `app/group/[id].tsx` (G), `app/join.tsx` (H 6 нүд), `app/create-group.tsx`,
    `app/j/[code].tsx` (гүн холбоос)
  - `src/components/Character.tsx` — SVG дүр: жин 0–100 → биеийн өргөн/өндөр,
    нүдний зай, амны муруйлт, өнгө (хаш→хув interpolation); малгай = хэрэглэгчийн
    өнгө; амьсгал 3.2с; 900ms morph; reduced-motion дэмжинэ
  - `src/components/WeightAxis.tsx` — Хөнгөн→Хүнд хэвтээ тэнхлэг (гарын үсэг элемент)
  - `src/steps.ts` — Pedometer уншилт (iOS 7 хоног), офлайн дараалал, summary кэш,
    30мин foreground синк, AppState сонсогч
  - Fonts: Manrope-ExtraBold (display, кирилл), Inter 400/600, JetBrains Mono 500
  - Dark mode: Систем/Гэрэл/Харанхуй сонголт профайлд
  - Keyboard: react-native-keyboard-controller (KeyboardProvider, AwareScrollView)

## Test credentials
`/app/memory/test_credentials.md` — seeded sessions:
test_session_token_alkhaach_1 (owner), test_session_token_alkhaach_2 (member)

## Implemented (2026-08-20)
- [x] Emergent Google Auth (web + mobile deep link flow)
- [x] Onboarding: нэр + 6 өнгө + дүрийн урьдчилан харах + зөвшөөрлийн дэлгэц
- [x] SVG дүр 5 шат, тасралтгүй morph, амьсгал, зорилгын долгион
- [x] Алхам: Pedometer (iOS), гараар оруулах (Г тэмдэг), 14 хоногийн синк,
      офлайн дараалал + кэш, flagged >60k
- [x] Жингийн хөдөлгүүр (томьёо, streak, бонусууд)
- [x] Нүүр: тайз, өнөөдөр/өчигдөр/7 хоног/жин, төлөв бүрийн мессеж, pull-refresh
- [x] Тэмдэглэл: 7 хоногийн багана, өчигдөр↔өнөөдөр, 30 хоногийн жингийн муруй
- [x] Бүлэг: үүсгэх, кодоор нэгдэх (6 нүд + preview), жингийн тэнхлэг,
      гишүүдийн жагсаалт, код хуулах/хуваалцах/солих, хасах/гарах/устгах,
      rate limit, 403 хамгаалалт
- [x] Профайл: нэр, өнгө, зорилго stepper, мэдэгдлийн toggle, theme, гарах,
      данс устгах
- [x] Testing agent: backend 31/31 PASS, frontend бүх дэлгэц OK

## Backlog (priority)
- P0: (хоосон — MVP бүрэн)
- P1: Native build дээр HealthKit (iOS) / Health Connect (Android) интеграц
- P1: Push мэдэгдэл (Emergent-managed, google-services.json хэрэгтэй,
      зөвхөн build дээр ажиллана) — өглөө 08:30 / орой 20:00, өдөрт max 2
- P2: Нууцлалын бодлогын хуудас (App Store/Play Store шаардлага)
- P2: 90 хоногоос хуучин түүх нэгтгэн шахах
- P2: Гүн холбоос alkhaach.mn домэйн тохиргоо (одоо апп доторх /j/[code] ажиллана)
