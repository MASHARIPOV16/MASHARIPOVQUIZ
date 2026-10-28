# 🎓 Telegram Quiz Bot & Mini App (Railway & GitHub Ready)

200+ talik savollar bazasini avtomatik **25 talik bo'limlarga** ajratuvchi, `.json` formatda savollarni qabul qiluvchi, vertikal **avtomatik scroll** va 2 bosqichli **Admin PIN kod (Raqamli klaviatura)** bilan himoyalangan zamonaviy Telegram Mini App va Bot tizimi.

---

## 📁 Loyiha Strukturasi

```
quiz-bot-webapp/
├── bot.py                  # aiogram 3 Telegram Bot (Start, Help, Admin, JSON yuklash)
├── server.py               # FastAPI REST API + Mini App static server
├── main.py                 # Yagona server va bot ishga tushiruvchi (Railway moslashgan)
├── database.py             # SQLite ma'lumotlar bazasi (25 talik bo'limlar bilan)
├── config.py               # Sozlamalar (.env va Railway o'zgaruvchilari)
├── requirements.txt        # Kerakli Python kutubxonalari
├── Procfile                # Railway / PaaS start buyrug'i
├── railway.json            # Railway native konfiguratsiya fayli
├── Dockerfile              # Docker orqali ishga tushirish fayli
├── .gitignore              # Maxfiy fayllarni GitHub'ga chiqarmaslik qoidalari
├── .env.example            # O'zgaruvchilar namunasi
├── static/                 # Telegram Mini App Frontend
│   ├── index.html          # Asosiy Mini App (Plus Jakarta Sans shrifti bilan)
│   ├── css/
│   │   └── style.css       # Telegram mavzusi, stikerlar va animatsiyalar
│   └── js/
│       ├── telegram.js     # Telegram SDK va haptics
│       ├── quiz.js         # 25 talik bo'limlar va vertikal scroll dvigateli
│       ├── stats.js        # Vizual diagrammalar (Chart.js)
│       ├── admin.js        # Admin PIN klaviaturasi va a'zolar ro'yxati
│       └── app.js          # Asosiy navigatsiya va JSON yuklash
└── data/
    ├── initial_quizzes.json # 200 ta savolli boshlang'ich test bazasi
    └── questions_sample.json# Sinov uchun 10 ta savolli namuna fayl
```

---

## 🐙 1-Qadam: GitHub Omboriga (Repo) Yuklash

Loyiha papkasida terminal (PowerShell yoki Git Bash) ochib, quyidagi buyruqlarni ketma-ket bajaring:

```bash
# 1. Git omborini ishga tushirish
git init

# 2. Barcha fayllarni tayyorlash (.env va *.db avtomatik tashlab ketiladi)
git add .

# 3. Commit qilish
git commit -m "feat: Telegram Quiz Mini App with 25-part scroll and admin pin pad"

# 4. Asosiy tarmoqni 'main' deb nomlash
git branch -M main

# 5. O'zingizning GitHub reponi bog'lash (USERNAME va REPO_NAME o'rniga o'zingiznikini qo'ying)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# 6. GitHub'ga push qilish
git push -u origin main
```

---

## 🚂 2-Qadam: Railway-da Ishga Tushirish (Deploy)

1. [railway.app](https://railway.app/) saytiga kiring va GitHub profilingiz orqali kiring (**Log in with GitHub**).
2. **"New Project"** tugmasini bosing.
3. **"Deploy from GitHub repo"** ni tanlang va yuqorida ochgan repongizni tanlang.
4. Railway avtomatik tarzda `railway.json` / `Procfile` ni aniqlaydi va dasturni qura boshlaydi.

### ⚙️ Railway O'zgaruvchilarini (Variables) Sozlash:
Loyihangiz ustiga bosib, **"Variables"** bo'limiga kiring va quyidagi o'zgaruvchilarni kiriting:

| O'zgaruvchi Nomi | Qiymat Namunasi | Izoh |
|---|---|---|
| `BOT_TOKEN` | `1234567890:ABCdef...` | [@BotFather](https://t.me/Botfather) dan olingan bot tokeni |
| `ADMIN_IDS` | `123456789,987654321` | Sizning Telegram ID raqamingiz |
| `ADMIN_PIN` | `7777` | Admin panelga kirish uchun 4 xonali PIN |
| `WEBAPP_URL` | `https://your-app.up.railway.app` | Railway bergan domen manzili |

### 🌐 Railway-da Bepul Domen Olish (Networking):
1. Loyiha sozlamalarida **"Settings"** bo'limiga o'ting.
2. **"Networking"** bo'limini topib, **"Generate Domain"** tugmasini bosing.
3. Railway sizga bepul HTTPS domen beradi (masalan: `https://quiz-app-production-xxxx.up.railway.app`).
4. Ushbu havolani nusxalab, yuqoridagi `WEBAPP_URL` o'zgaruvchisiga yozib qo'ying!

---

## 🤖 3-Qadam: Telegram @BotFather-da Mini App-ni Ulash

1. Telegramda [@BotFather](https://t.me/Botfather) ga kiring.
2. `/newapp` buyrug'ini yuboring.
3. Botingizni tanlang.
4. Ilova nomi va qisqacha tavsifini yozing.
5. **Web App URL** so'raganida Railway bergan `https://xxxx.up.railway.app` domenini yuboring!
6. Qisqa nom (short name) bering (masalan: `quiz`).
7. Tayyor! Havolangiz: `t.me/SizningBotingiz/quiz`.

---

## 🔒 Xavfsizlik Qoidalari:
- **Oddiy foydalanuvchilar:** Admin tugmasini umuman ko'ra olmaydi.
- **Admin:** Faqat `ADMIN_IDS` dagi foydalanuvchiga Admin tugmasi chiqadi va **4 xonali PIN kod (faqat raqamli klaviatura)** orqali kiriladi.
