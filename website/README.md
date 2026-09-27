# АЛХААЧ — апп татах вэбсайт

Статик landing хуудас: `index.html` + `assets/`. Build алхам байхгүй.

## Локалаар үзэх

```bash
cd website
python -m http.server 5500
```

→ http://localhost:5500

## APK-г нийтлэх

"Апп татах" товч нь GitHub-ийн **хамгийн сүүлийн release**-д хавсаргасан
`alkhaach.apk` файлыг татна:

```
https://github.com/saylosmn/alkhaach2/releases/latest/download/alkhaach.apk
```

Шинэ хувилбар гаргах бүрт:

1. `frontend/scripts/build-apk.ps1`-ээр APK угсарна → `frontend/alkhaach.apk`
2. GitHub → Releases → **Draft a new release**, tag: `v1.0.1` гэх мэт
3. `alkhaach.apk`-г **яг энэ нэрээр** хавсаргаад Publish дарна

Вэбсайтыг дахин deploy хийх шаардлагагүй — хуудас GitHub API-аас хувилбар,
хэмжээ, огноог автоматаар уншиж харуулна.

## Deploy (Render)

`render.yaml` дотор `alkhaach-web` нэртэй static site нэмэгдсэн. Render →
Blueprints → Sync хийхэд автоматаар үүснэ. GitHub Pages, Netlify, Vercel-д ч
`website/` хавтсыг шууд байршуулж болно.

## Дүрийн зураг

`assets/character/` нь `frontend/assets/character/`-ийн хуулбар. Тарвагыг
шинэчилбэл энд дахин хуулна.
