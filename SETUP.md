# АЛХААЧ — Тохируулах, Deploy хийх, APK бүтээх заавар

Дараалал чухал. **1 → 2 → 3 → 4** гэж явна. Нийт 40–60 минут.

---

## Алхам 1 — MongoDB Atlas дээр шинэ database (10 мин)

1. https://www.mongodb.com/cloud/atlas/register — бүртгүүлнэ.
2. **Create a cluster** → **M0 (FREE)** сонгоно. Бүс: Singapore (Монголд хамгийн ойр).
3. **Database Access** → *Add New Database User*
   - Хэрэглэгчийн нэр: `alkhaach`
   - Нууц үг: **Autogenerate** дараад **хуулж хадгална** (дахин харагдахгүй)
   - Эрх: `Read and write to any database`
4. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`)
   > Render-ийн IP тогтмол биш тул энэ шаардлагатай. Хамгаалалт нь нууц үгээр хийгдэнэ.
5. **Database** → *Connect* → *Drivers* → **Python** → холболтын мөрийг хуулна:

```
mongodb+srv://alkhaach:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

`<db_password>` хэсгийг 3-р алхамд хуулсан жинхэнэ нууц үгээрээ солино.
Нууц үгэнд `@ : / ?` зэрэг тэмдэг байвал URL-encode хийх шаардлагатай тул
autogenerate хийсэн нууц үг ашиглах нь илүү дөхөм.

> Table/collection гараар үүсгэх шаардлагагүй — backend анх ажиллахдаа
> бүх коллекц, индексийг өөрөө үүсгэнэ.

---

## Алхам 2 — Google OAuth (10 мин)

1. https://console.cloud.google.com → дээд талын project сонгогчоос **New Project** → нэр: `Alkhaach`
2. **APIs & Services → OAuth consent screen**
   - User Type: **External** → *Create*
   - App name: `АЛХААЧ`, support email: өөрийн имэйл
   - Developer contact: өөрийн имэйл → *Save and Continue*
   - Scopes: юу ч нэмэхгүй → *Save and Continue*
   - **Test users** → өөрийн Gmail хаягийг нэмнэ ⚠️ *(чухал — доорх тайлбарыг уншина уу)*
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application** ← *(Android биш! SHA-1 хэрэггүй)*
   - Name: `Alkhaach backend`
   - **Authorized redirect URIs** → *ADD URI*:
     ```
     https://alkhaach2.onrender.com/api/auth/google/callback
     ```
     > Энэ хаягийг Алхам 3-т Render үүсгэсний дараа л мэднэ.
     > Одоохондоо ойролцоогоор бичээд, Render дээр жинхэнэ хаяг гармагц
     > **буцаж энд засна.** Заавал яг таарах ёстой.
   - *Create* → **Client ID** болон **Client secret** хоёрыг хуулж хадгална.

### ⚠️ "Testing" горимын тухай
OAuth consent screen нь эхлээд **Testing** төлөвт байна. Энэ үед
**зөвхөн Test users жагсаалтад нэмсэн хаягууд** нэвтэрч чадна (дээд тал нь 100).
Найзууддаа тараах гэж байвал тэдний Gmail хаягийг жагсаалтад нэмнэ.

Хэн ч нэвтрэх боломжтой болгохын тулд **Publish app** дарна. Гэхдээ бидний
ашиглаж буй scope-ууд (`email`, `profile`, `openid`) нь *sensitive биш* тул
Google-ийн шалгалт (verification) шаардахгүй, шууд нийтлэгдэнэ.

---

## Алхам 3 — Backend-ийг Render дээр deploy (10 мин)

Эхлээд засварласан кодоо GitHub руу түлхэнэ:

```bash
cd alkhaach
git add -A
git commit -m "АЛХААЧ — Google OAuth + Expo push"
git push
```

Дараа нь:

1. https://dashboard.render.com → **New → Web Service**
2. GitHub repo `saylosmn/alkhaach`-ыг холбож сонгоно
3. Тохиргоо:

   | Талбар | Утга |
   |---|---|
   | Name | `alkhaach2` |
   | Region | Singapore |
   | Root Directory | `backend` |
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | Free |

   > `--host 0.0.0.0 --port $PORT` хэсэг **заавал** ийм байх ёстой.
   > Хатуу порт бичвэл Render дээр гарцаагүй унана.

4. **Environment Variables** нэмнэ:

   | Key | Value |
   |---|---|
   | `MONGO_URL` | Алхам 1-ийн холболтын мөр |
   | `DB_NAME` | `alkhaach` |
   | `GOOGLE_CLIENT_ID` | Алхам 2-ын Client ID |
   | `GOOGLE_CLIENT_SECRET` | Алхам 2-ын Client secret |
   | `PUBLIC_BASE_URL` | `https://alkhaach2.onrender.com` ← Render өгсөн жинхэнэ хаяг, **сүүлийн `/` байхгүй** |
   | `PYTHON_VERSION` | `3.11.9` |

5. **Create Web Service** → build дуусахыг хүлээнэ (3–5 мин)

6. **Ажиллаж байгааг шалгана:**
   ```
   https://alkhaach2.onrender.com/api/
   ```
   `{"message":"АЛХААЧ API"}` гарвал амжилттай. ✅

7. 🔁 **Алхам 2 руу буцаж** Google Credentials дээрх redirect URI-г
   Render-ийн жинхэнэ хаягаар засна.

### ⚠️ Render Free tier-ийн онцлог
15 минут хэрэглээгүй бол сервер унтдаг. Дараагийн хүсэлт **40–60 секунд**
хүлээлгэнэ. Хэрэглэгч апп нээхэд "гацсан" мэт санагдана. Мөн шөнийн
мэдэгдэл (push) сервер унтарсан үед явахгүй.

Засах арга нь хоёр:

**A. Сард $7 — Starter plan.** Сервер унтахгүй, юу ч тохируулах шаардлагагүй.

**B. Үнэгүй — гадны cron.** Render дээр:

| Түлхүүр | Утга |
|---|---|
| `SCHEDULER_IN_PROCESS` | `0` |
| `NOTIFY_SECRET` | санамсаргүй урт мөр (өөрөө зохионо) |

Дараа нь [cron-job.org](https://cron-job.org) дээр үнэгүй бүртгүүлж, 5 минут тутам
дуудагдах ажил үүсгэнэ:

- URL: `https://alkhaach2.onrender.com/api/internal/notify-tick`
- Method: `POST`
- Header: `X-Notify-Secret: <NOTIFY_SECRET-ийн утга>`

Энэ дуудлага серверийг сэрээж, мэдэгдлийг цагт нь явуулна. (`NOTIFY_SECRET`
тохируулаагүй бол эндпойнт 404 буцаана — санамсаргүй нээлттэй үлдэхгүй.)

---

## Алхам 4 — APK бүтээх (локал, Expo cloud хэрэггүй)

APK-г **өөрийн компьютер дээр Gradle-ээр шууд** угсарна. Expo акаунт, EAS
build кредит, дараалалд хүлээх зүйл байхгүй.

### Юу хэрэгтэй вэ

| Хэрэгсэл | Тайлбар |
|---|---|
| Node.js 20+ | `node -v` |
| Android Studio | Android SDK болон JDK (JBR) дагалдана |

`frontend/android/` фолдер аль хэдийн бэлэн (prebuild хийгдсэн) тул
`expo prebuild` ажиллуулах шаардлагагүй.

### 1. Backend-ийн хаягаа тохируулах

`frontend/.env` доторх утгыг Render-ийн жинхэнэ хаягаараа солино
(эсвэл доорх скриптэд `-BackendUrl`-ээр дамжуулна):

```
EXPO_PUBLIC_BACKEND_URL=https://alkhaach2.onrender.com
```

> Энэ утга APK дотор шигтгэгддэг. Өөрчилсөн бол APK-г **дахин угсарна**.

### 2. (Заавал биш, гэхдээ зөвлөе) Өөрийн release түлхүүр үүсгэх

```powershell
cd frontend
powershell -ExecutionPolicy Bypass -File scripts\make-keystore.ps1
```

`android/alkhaach-release.jks` + `android/keystore.properties` үүснэ. Эдгээр нь
git-д ордоггүй — **сайн нөөцөлж хадгална уу**. Алдвал ижил багцын нэрээр
шинэчлэлт гаргаж чадахгүй. Алгассан ч болно — тэр үед debug түлхүүрээр гарын
үсэг зурагдах бөгөөд APK нь суулгахад асуудалгүй.

### 3. APK угсрах

```powershell
cd frontend
powershell -ExecutionPolicy Bypass -File scriptsuild-apk.ps1
```

Хаягийг шууд өгөх бол:

```powershell
powershell -ExecutionPolicy Bypass -File scriptsuild-apk.ps1 -BackendUrl https://alkhaach2.onrender.com
```

Скрипт нь дараалан: `.env` бичих → JDK олох (Android Studio-ийн JBR) →
`local.properties` бэлтгэх → `node_modules` шалгах → `gradlew assembleRelease`
ажиллуулна. Эхний удаа Gradle хамаарлаа татдаг тул 10–20 минут үргэлжилнэ,
дараа нь 2–4 минут.

Үр дүн: **`frontend/alkhaach.apk`**

### 4. Утсандаа суулгах

- Файлыг утас руугаа хуулаад нээнэ (Тохиргоо → «Үл мэдэгдэх эх сурвалж»-ийг зөвшөөрнө)
- эсвэл USB-тэй бол: `adb install -r frontendlkhaach.apk`

Найзууддаа энэ APK файлыг шууд илгээхэд тэд ч бас суулгана.

> **Санамж:** Gradle нь өөрийн daemon процесстой loopback (127.0.0.1) холболт
> үүсгэдэг. Хэрэв `Unable to establish loopback connection` гэж гарвал
> antivirus/firewall нь `java.exe`-г хааж байна — Android Studio-ийн JBR доторх
> `java.exe`-д зөвшөөрөл өгнө үү.

### Google Play дээр тавих бол (сонголт)

```powershell
cd frontend\android
.\gradlew.bat bundleRelease
```

→ `app/build/outputs/bundle/release/app-release.aab`. Энэ тохиолдолд Алхам 2
дээрх өөрийн release түлхүүр **заавал** хэрэгтэй (түлхүүргүй бол build зогсоно).

Play Console → **App content** дээр дараах declaration-уудыг бөглөнө:

- **Foreground service permissions** → `FOREGROUND_SERVICE_HEALTH`: «Хэрэглэгч
  асаасан үед апп хаалттай байхад утасны алхам мэдрэгчээр өдрийн алхамыг тоолно».
  Профайл → «Дэвсгэрт тоолох»-ыг асааж, мэдэгдлийн самбарт тоолуур гарч буйг
  харуулсан богино видео хавсаргана.
- **Health apps** ба **Health Connect** — зөвхөн алхамын тоог уншдаг гэж тайлбарлана.
- **Activity recognition** — алхам тоолоход ашиглана.

---

## Дууссаны дараа

Утсандаа APK суулгаад:

1. **Google-ээр нэвтрэх** дарна → Google-ийн дэлгэц гарна
2. Хаягаа сонгоно → апп руу буцаж орно
3. Нэр + өнгө сонгоно (onboarding)
4. Алхам тоолох зөвшөөрөл өгнө
5. Алхаж эхэлнэ 🚶

Хэрэглэгч бүр өөрөө юу ч deploy хийхгүй. APK татаад л ажиллана.

---

## Алдаа гарвал

| Шинж тэмдэг | Шалтгаан | Засвар |
|---|---|---|
| `redirect_uri_mismatch` | Google дээрх redirect URI Render-ийн хаягтай таарахгүй | Google Credentials дээрх URI-г яг `https://<render-хаяг>/api/auth/google/callback` болгоно |
| `Access blocked: app not verified` | Таны хаяг Test users-д алга | Google consent screen → Test users-д нэмнэ, эсвэл Publish app дарна |
| Нэвтрээд буцаж ирэхгүй | `scheme` таарахгүй | `app.json` дотор `"scheme": "alkhaach"` байгаа эсэхийг шалгаад дахин build хийнэ |
| Апп нээхэд удаан | Render free tier унтсан | 60 сек хүлээнэ, эсвэл Starter plan руу шилжинэ |
| `MONGO_URL` алдаа | Нууц үг буруу / IP хаагдсан | Atlas → Network Access `0.0.0.0/0` эсэхийг шалгана |
| Build дээр `pip install` унана | Хуучин requirements.txt | Шинэ `requirements.txt` push хийсэн эсэхээ шалгана |

Render дээрх алдааг **Logs** таб дээрээс харна.

---

## Локал дээр турших (заавал биш)

```bash
# Backend
cd backend
cp .env.example .env        # утгуудыг бөглөнө
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (өөр terminal дээр)
cd frontend
cp .env.example .env        # EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
yarn install && yarn start
```

---

## Тест ажиллуулах (заавал биш)

```bash
# Backend интеграцийн тест — асаалттай backend + ижил Mongo руу чиглэнэ.
cd backend
pip install -r requirements.txt -r requirements-dev.txt
MONGO_URL=... DB_NAME=alkhaach TEST_BASE_URL=http://localhost:8000 pytest tests
```

Тестийн хэрэглэгч/session-ийг `tests/conftest.py` өөрөө үүсгэдэг тул гараар
seed хийх шаардлагагүй. **Үйлдвэрлэлийн (production) сан дээр битгий ажиллуулаарай.**

```bash
# Frontend — цэвэр логикийн нэгж тест
cd frontend
yarn install && yarn test
```
