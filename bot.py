import asyncio
import json
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    MenuButtonWebApp
)
from config import BOT_TOKEN, WEBAPP_URL, ADMIN_IDS
import database as db

logger = logging.getLogger(__name__)

bot: Bot = None
dp: Dispatcher = None

if BOT_TOKEN:
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

def get_webapp_keyboard(unique_code: str = "") -> InlineKeyboardMarkup:
    url = f"{WEBAPP_URL}?quiz={unique_code}" if unique_code else WEBAPP_URL
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Quiz Mini App-ni ochish",
                    web_app=WebAppInfo(url=url)
                )
            ]
        ]
    )

if dp:
    @dp.message(CommandStart())
    async def command_start_handler(message: types.Message):
        user = message.from_user
        if not user:
            return

        db_user = await db.get_or_create_user(
            telegram_id=user.id,
            first_name=user.first_name or "",
            last_name=user.last_name or "",
            username=user.username or ""
        )

        try:
            await bot.set_chat_menu_button(
                chat_id=user.id,
                menu_button=MenuButtonWebApp(
                    text="📱 Quiz App",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            )
        except Exception as e:
            logger.warning(f"Failed to set menu button: {e}")

        full_name = f"{user.first_name} {user.last_name or ''}".strip()
        faculty_text = f"📍 Sizning fakultetingiz: <b>{db_user.get('subscribed_code')}</b>" if db_user.get('subscribed_code') else "💡 <i>Hali fakultet kodi kiritilmagan. Mini App-da 1 marta kod kiriting.</i>"

        text = (
            f"Assalomu alaykum, <b>{full_name}</b>! 👋\n\n"
            f"🎓 <b>Talabalar va O'qituvchilar Quiz Tizimiga xush kelibsiz!</b>\n\n"
            f"• 200+ talik savollar bazasi <b>25 talik bo'limlarga</b> ajratilgan;\n"
            f"• Javob berilgach, keyingi savol pastidan paydo bo'lib, avtomatik scroll bo'ladi;\n"
            f"• Yangi testlarni to'g'ridan-to'g'ri <b>.json</b> fayl ko'rinishida yuborishingiz mumkin (to'g'ri javob doim A variantda).\n\n"
            f"{faculty_text}\n\n"
            f"Testlarni boshlash uchun quyidagi tugmani bosing 👇"
        )

        await message.answer(text, parse_mode="HTML", reply_markup=get_webapp_keyboard())

    # Handle .json file documents sent directly to bot
    @dp.message(F.document)
    async def document_handler(message: types.Message):
        doc = message.document
        if not doc.file_name.lower().endswith(".json"):
            await message.answer("Iltimos, faqat <b>.json</b> formatidagi savollar faylini yuboring.", parse_mode="HTML")
            return

        user_id = message.from_user.id
        await message.answer("📥 Fayl qabul qilinmoqda va tahlil qilinmoqda...")

        try:
            file_info = await bot.get_file(doc.file_id)
            file_bytes = await bot.download_file(file_info.file_path)
            content = file_bytes.read().decode("utf-8")
            raw_questions = json.loads(content)

            if not isinstance(raw_questions, list):
                await message.answer("❌ Xatolik: JSON fayl massiv (array) formatida bo'lishi kerak: [ {question, a, b, c, d}, ... ]")
                return

            count = len(raw_questions)
            import math
            parts_count = math.ceil(count / 25)

            # Auto create unique code from filename
            clean_name = "".join(c for c in doc.file_name if c.isalnum()).upper()[:6] or "TEST"
            random_pin = f"{clean_name}-{message.message_id % 9000 + 1000}"

            res = await db.import_quiz_from_json(
                creator_id=user_id,
                unique_code=random_pin,
                title=doc.file_name.rsplit(".", 1)[0].replace("_", " "),
                description=f"{count} ta savolli test bazasi ({parts_count} ta 25 talik qism)",
                university="Umumiy",
                faculty="Barcha yo'nalishlar",
                direction="Yo'nalish",
                course="Barcha kurslar",
                time_limit=30,
                raw_questions=raw_questions
            )

            success_text = (
                f"✅ <b>Fayl muvaffaqiyatli yuklandi!</b>\n\n"
                f"📝 Jami savollar soni: <b>{res['questions_count']} ta</b>\n"
                f"📦 25 talik bo'limlar: <b>{res['total_parts']} ta</b>\n"
                f"🔑 Unikal test kodi: <code>{res['unique_code']}</code>\n\n"
                f"<i>(To'g'ri javoblar A variantdan olinib, talabalar yechayotganda avtomatik aralashtiriladi).</i>\n\n"
                f"Ushbu testni hoziroq yechish uchun tugmani bosing 👇"
            )
            await message.answer(success_text, parse_mode="HTML", reply_markup=get_webapp_keyboard(res["unique_code"]))

        except Exception as e:
            logger.error(f"Error parsing json file from telegram: {e}")
            await message.answer(f"❌ Faylni o'qishda xatolik: {str(e)}")

    @dp.message(Command("help"))
    async def command_help_handler(message: types.Message):
        help_text = (
            "📖 <b>Quiz Bot qo'llanmasi:</b>\n\n"
            "1️⃣ <b>Savollarni yuklash:</b>\n"
            "Botga to'g'ridan-to'g'ri <code>.json</code> fayl yuborishingiz mumkin. Savollar soni 200+ bo'lsa, tizim o'zi ularni 25 talik bo'limchalarga ajratadi.\n"
            "<i>(Diqqat: JSON faylda to'g'ri javob doim A variantda bo'lishi kerak).</i>\n\n"
            "2️⃣ <b>Scroll rejimida yechish:</b>\n"
            "Mini App-da har bir savolga javob berganingizda, keyingi savol pastidan paydo bo'lib, sahifa avtomatik scroll bo'ladi.\n\n"
            "3️⃣ <b>Unikal kod:</b>\n"
            "O'z fakultetingiz unikal kodini kiritib, barcha qismlarni bosqichma-bosqich yechishingiz mumkin."
        )
        await message.answer(help_text, parse_mode="HTML", reply_markup=get_webapp_keyboard())

    @dp.message(Command("admin"))
    async def command_admin_handler(message: types.Message):
        user_id = message.from_user.id
        if user_id not in ADMIN_IDS:
            await message.answer("⛔ Sizda admin huquqlari mavjud emas.")
            return

        stats = await db.get_admin_stats()
        text = (
            "🛡 <b>Admin boshqaruv paneli:</b>\n\n"
            f"👥 Jami foydalanuvchilar: <b>{stats['total_users']}</b>\n"
            f"📈 Bugun qo'shilganlar: <b>{stats['users_today']}</b>\n"
            f"📝 Jami quizlar: <b>{stats['total_quizzes']}</b>\n"
            f"🎯 Jami topshirilgan testlar: <b>{stats['total_attempts']}</b>\n"
        )
        admin_kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🛡 Admin Panelni ochish",
                        web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=admin")
                    )
                ]
            ]
        )
        await message.answer(text, parse_mode="HTML", reply_markup=admin_kb)

async def broadcast_message(text: str) -> dict:
    if not bot:
        return {"status": "error", "message": "Bot token sozlanmagan"}

    user_ids = await db.get_all_user_ids()
    sent = 0
    failed = 0

    for uid in user_ids:
        try:
            await bot.send_message(chat_id=uid, text=text, parse_mode="HTML")
            sent += 1
            await asyncio.sleep(0.05)
        except Exception:
            failed += 1

    return {"status": "ok", "sent": sent, "failed": failed, "total": len(user_ids)}
