from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import asyncio
import logging

from config import BASE_DIR, ADMIN_IDS, BOT_TOKEN, ADMIN_PIN
import database as db
import bot as telegram_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("quiz_server")

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    logger.info("Database initialized with 25-question partitioning support.")

    bot_task = None
    if telegram_bot.bot and telegram_bot.dp:
        logger.info("Starting Telegram Bot polling in background...")
        bot_task = asyncio.create_task(telegram_bot.dp.start_polling(telegram_bot.bot))
    else:
        logger.warning("BOT_TOKEN is not configured. Running WebApp in standalone API mode.")

    yield

    if bot_task:
        bot_task.cancel()
        if telegram_bot.bot:
            await telegram_bot.bot.session.close()
        logger.info("Telegram Bot polling stopped.")

app = FastAPI(title="Quiz Telegram WebApp API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

@app.get("/", response_class=FileResponse)
async def serve_index():
    return FileResponse(BASE_DIR / "static" / "index.html")

# ----------------- Request Models -----------------

class UserInitRequest(BaseModel):
    telegram_id: int
    first_name: str
    last_name: Optional[str] = ""
    username: Optional[str] = ""

class SubscriptionUpdateRequest(BaseModel):
    telegram_id: int
    university: str
    faculty: str
    direction: str
    course: str
    subscribed_code: str

class ImportJsonQuizRequest(BaseModel):
    creator_id: int
    unique_code: str
    title: str
    description: Optional[str] = ""
    university: str
    faculty: str
    direction: str
    course: str
    time_limit: int = 30
    raw_questions: List[Dict[str, Any]]

class SubmitPartQuizRequest(BaseModel):
    quiz_id: int
    user_id: int
    part_num: int = 1
    answers: Dict[str, str]  # question_id -> chosen option text
    time_spent: int = 0

class BroadcastRequest(BaseModel):
    admin_id: int
    message: str

class VerifyPinRequest(BaseModel):
    admin_id: int
    pin: str

# ----------------- API Endpoints -----------------

@app.post("/api/user/init")
async def init_user(payload: UserInitRequest):
    user = await db.get_or_create_user(
        telegram_id=payload.telegram_id,
        first_name=payload.first_name,
        last_name=payload.last_name or "",
        username=payload.username or ""
    )
    return {"status": "ok", "user": user}

@app.post("/api/user/subscription")
async def update_subscription(payload: SubscriptionUpdateRequest):
    if not payload.subscribed_code.strip():
        raise HTTPException(status_code=400, detail="Unikal kod kiritilishi shart")
    
    updated_user = await db.update_user_subscription(
        telegram_id=payload.telegram_id,
        university=payload.university,
        faculty=payload.faculty,
        direction=payload.direction,
        course=payload.course,
        subscribed_code=payload.subscribed_code
    )
    return {"status": "ok", "user": updated_user}

@app.get("/api/quizzes")
async def list_quizzes(subscribed_code: Optional[str] = None):
    quizzes = await db.get_quizzes(subscribed_code=subscribed_code)
    return {"quizzes": quizzes}

# 25-question Partitions endpoints
@app.get("/api/quiz/{unique_code}/parts")
async def get_quiz_parts(unique_code: str, user_id: Optional[int] = None):
    quiz_meta = await db.get_quiz_meta_and_parts(unique_code, user_id=user_id)
    if not quiz_meta:
        raise HTTPException(status_code=404, detail="Quiz topilmadi")
    return {"quiz": quiz_meta}

@app.get("/api/quiz/{unique_code}/play")
async def play_quiz_part(unique_code: str, part: int = 1):
    part_data = await db.get_quiz_part_questions(unique_code, part_num=part)
    if not part_data:
        raise HTTPException(status_code=404, detail="Quiz yoki bo'lim topilmadi")
    return {"data": part_data}

@app.post("/api/quiz/import-json")
async def import_quiz_from_json(payload: ImportJsonQuizRequest):
    if not payload.raw_questions:
        raise HTTPException(status_code=400, detail="Savollar ro'yxati bo'sh bo'lishi mumkin emas")
    if not payload.unique_code.strip():
        raise HTTPException(status_code=400, detail="Unikal kod kiritilishi shart")

    try:
        res = await db.import_quiz_from_json(
            creator_id=payload.creator_id,
            unique_code=payload.unique_code,
            title=payload.title,
            description=payload.description or "",
            university=payload.university,
            faculty=payload.faculty,
            direction=payload.direction,
            course=payload.course,
            time_limit=payload.time_limit,
            raw_questions=payload.raw_questions
        )
        return {"status": "ok", "quiz": res}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail="Savollarni import qilishda xatolik yuz berdi")

@app.post("/api/quiz/submit-part")
async def submit_part_quiz(payload: SubmitPartQuizRequest):
    try:
        res = await db.submit_part_quiz(
            quiz_id=payload.quiz_id,
            user_id=payload.user_id,
            part_num=payload.part_num,
            answers=payload.answers,
            time_spent=payload.time_spent
        )
        return {"status": "ok", "result": res}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Submit part error: {e}")
        raise HTTPException(status_code=500, detail="Natijalarni saqlashda xatolik yuz berdi")

@app.get("/api/user/{telegram_id}/stats")
async def user_stats(telegram_id: int):
    stats = await db.get_user_stats(telegram_id)
    return {"stats": stats}

@app.get("/api/user/{telegram_id}/created-quizzes")
async def user_created_quizzes(telegram_id: int):
    quizzes = await db.get_user_created_quizzes(telegram_id)
    return {"created_quizzes": quizzes}

# ----------------- Admin Endpoints -----------------

def verify_admin(telegram_id: int):
    if telegram_id not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Sizda adminlik huquqi yo'q")

@app.post("/api/admin/verify-pin")
async def verify_admin_pin(payload: VerifyPinRequest):
    verify_admin(payload.admin_id)
    if payload.pin.strip() != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Noto'g'ri PIN kod kiritildi")
    return {"status": "ok", "message": "PIN kod to'g'ri"}

@app.get("/api/admin/stats")
async def admin_statistics(admin_id: int):
    verify_admin(admin_id)
    stats = await db.get_admin_stats()
    return {"stats": stats}

@app.get("/api/admin/users")
async def admin_users_list(admin_id: int, search: Optional[str] = ""):
    verify_admin(admin_id)
    users = await db.get_admin_users(search=search or "")
    return {"users": users}

@app.post("/api/admin/broadcast")
async def admin_broadcast(payload: BroadcastRequest):
    verify_admin(payload.admin_id)
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Xabar matni bo'sh bo'lishi mumkin emas")
    
    result = await telegram_bot.broadcast_message(payload.message)
    return {"status": "ok", "result": result}

@app.delete("/api/admin/quiz/{quiz_id}")
async def admin_delete_quiz(quiz_id: int, admin_id: int):
    verify_admin(admin_id)
    await db.delete_quiz(quiz_id)
    return {"status": "ok", "message": "Quiz muvaffaqiyatli o'chirildi"}
