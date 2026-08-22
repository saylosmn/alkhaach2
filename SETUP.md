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
     https://alkhaach-api.onrender.com/api/auth/google/callback
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
git commit -m "Emergent-ийн хамаарлыг арилгаж, Google OAuth + Expo push нэмэв"
git push
```

Дараа нь:

1. https://dashboard.render.com → **New → Web Service**
2. GitHub repo `saylosmn/alkhaach`-ыг холбож сонгоно
3. Тохиргоо:

   | Талбар | Утга |
   |---|---|
   | Name | `alkhaach-api` |
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
   | `PUBLIC_BASE_URL` | `https://alkhaach-api.onrender.com` ← Render өгсөн жинхэнэ хаяг, **сүүлийн `/` байхгүй** |
   | `PYTHON_VERSION` | `3.11.9` |

5. **Create Web Service** → build дуусахыг хүлээнэ (3–5 мин)

6. **Ажиллаж байгааг шалгана:**
   ```
   https://alkhaach-api.onrender.com/api/
   ```
   `{"message":"АЛХААЧ API"}` гарвал амжилттай. ✅

7. 🔁 **Алхам 2 руу буцаж** Google Credentials дээрх redirect URI-г
   Render-ийн жинхэнэ хаягаар засна.

### ⚠️ Render Free tier-ийн онцлог
15 минут хэрэглээгүй бол сервер унтдаг. Дараагийн хүсэлт **40–60 секунд**
хүлээлгэнэ. Хэрэглэгч апп нээхэд "гацсан" мэт санагдана. Мөн шөнийн
мэдэгдэл (push) сервер унтарсан үед явахгүй.

Засах арга: сард **$7**-ийн Starter plan руу шилжих. Энэ нь унтахгүй.
(Сарын $7 төлөхгүй бол мэдэгдлийн функц найдваргүй ажиллана гэдгийг мэдэж байгаарай.)

---

## Алхам 4 — APK бүтээх (15 мин)

Энэ алхмыг **өөрийн компьютер дээр** гүйцэтгэнэ. Node.js 20+ хэрэгтэй.

```bash
cd alkhaach/frontend

# 1. Expo акаунт (үнэгүй) — байхгүй бол expo.dev дээр бүртгүүлнэ
npm install -g eas-cli
eas login

# 2. Хамаарал суулгах
yarn install

# 3. EAS project үүсгэх (app.json дотор projectId автоматаар бичигдэнэ)
eas init
```

Дараа нь **`eas.json` файлыг нээж** `EXPO_PUBLIC_BACKEND_URL`-ийн утгыг
Render-ийн жинхэнэ хаягаараа солино (2 газар байгаа):

```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://alkhaach-api.onrender.com"
}
```

Одоо APK бүтээнэ:

```bash
eas build --platform android --profile preview
```

- Signing key-ийн талаар асуувал **"Generate new keystore"** сонгоно
- Build нь Expo-ийн cloud дээр 10–20 минут ажиллана
- Дуусмагц татах холбоос гарна → **APK** файл

Энэ APK-г утсандаа шууд суулгаж болно (Тохиргоо → "Үл мэдэгдэх эх сурвалж"-ийг зөвшөөрөх).
Холбоосыг найзууддаа илгээхэд тэд ч бас суулгаж болно.

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
