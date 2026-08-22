# АЛХААЧ

Монгол хэл дээрх алхалт хэмжигч апп. Өдөр тутмын алхалтаас хамаарч
хэрэглэгчийн SVG дүр турах/бүдүүрнэ (жин 0–100). 6 оронтой кодоор хаалттай
бүлэг үүсгэж, зөвхөн гишүүд бие биеийнхээ дүр, алхалтыг харна.

## Технологи

| Давхарга | Технологи |
|---|---|
| Апп | Expo (React Native) SDK 54 + TypeScript + expo-router |
| Backend | FastAPI (Python 3.11) |
| Database | MongoDB (Atlas) |
| Нэвтрэлт | Google OAuth 2.0 |
| Мэдэгдэл | Expo Push |
| Hosting | Render |

## Эхлэх

Тохируулах, deploy хийх, APK бүтээх бүрэн заавар → **[SETUP.md](./SETUP.md)**

## Бүтэц

```
backend/
  server.py           FastAPI — бүх route /api prefix-тэй
  requirements.txt
  .env.example        MONGO_URL, DB_NAME, GOOGLE_CLIENT_ID/SECRET, PUBLIC_BASE_URL
frontend/
  app/                expo-router дэлгэцүүд
  src/                api, auth, steps, components
  eas.json            APK build тохиргоо
  .env.example        EXPO_PUBLIC_BACKEND_URL
render.yaml           Render blueprint
```

## Орчны хувьсагч

**backend/.env**
```
MONGO_URL=mongodb+srv://...
DB_NAME=alkhaach
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PUBLIC_BASE_URL=https://alkhaach-api.onrender.com
```

**frontend/.env**
```
EXPO_PUBLIC_BACKEND_URL=https://alkhaach-api.onrender.com
```
