import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# Load .env if present
load_dotenv(BASE_DIR / ".env")

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()

# Admin IDs parsed as set of integers
ADMIN_IDS_RAW = os.getenv("ADMIN_IDS", "").strip()
ADMIN_IDS = set()
if ADMIN_IDS_RAW:
    for item in ADMIN_IDS_RAW.split(","):
        cleaned = item.strip()
        if cleaned.isdigit():
            ADMIN_IDS.add(int(cleaned))

# 4-digit PIN Code for Admin Panel
ADMIN_PIN = os.getenv("ADMIN_PIN", "7777").strip()

WEBAPP_URL = os.getenv("WEBAPP_URL", "http://localhost:8000").rstrip("/")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DATABASE_PATH_ENV = os.getenv("DATABASE_PATH", "").strip()
if DATABASE_PATH_ENV:
    DATABASE_PATH = Path(DATABASE_PATH_ENV)
else:
    DATABASE_PATH = BASE_DIR / "quiz_bot.db"
