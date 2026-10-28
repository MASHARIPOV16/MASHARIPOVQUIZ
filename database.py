import sqlite3
import json
import math
import random
import asyncio
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional
from config import DATABASE_PATH, ADMIN_IDS, BASE_DIR

QUESTIONS_PER_PART = 25

def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        is_admin BOOLEAN DEFAULT 0,
        university TEXT,
        faculty TEXT,
        direction TEXT,
        course TEXT,
        subscribed_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Quizzes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        university TEXT,
        faculty TEXT,
        direction TEXT,
        course TEXT,
        creator_id INTEGER NOT NULL,
        time_limit_per_question INTEGER DEFAULT 30,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Questions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL DEFAULT 'A',
        order_num INTEGER DEFAULT 1,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    # Attempts (Quiz submissions) table with part_num
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        part_num INTEGER DEFAULT 1,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        percentage REAL NOT NULL,
        time_spent_seconds INTEGER DEFAULT 0,
        answers_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Seed initial sample quizzes if empty
    cursor.execute("SELECT COUNT(*) as count FROM quizzes")
    count = cursor.fetchone()["count"]
    if count == 0:
        seed_sample_data(conn)

    conn.close()

def seed_sample_data(conn):
    sample_file = BASE_DIR / "data" / "initial_quizzes.json"
    if not sample_file.exists():
        return

    try:
        with open(sample_file, "r", encoding="utf-8") as f:
            quizzes_data = json.load(f)

        cursor = conn.cursor()
        for q in quizzes_data:
            cursor.execute("""
            INSERT OR IGNORE INTO quizzes 
            (unique_code, title, description, university, faculty, direction, course, creator_id, time_limit_per_question)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                q["unique_code"].strip().upper(),
                q["title"],
                q.get("description", ""),
                q.get("university", ""),
                q.get("faculty", ""),
                q.get("direction", ""),
                q.get("course", ""),
                q.get("creator_id", 0),
                q.get("time_limit_per_question", 30)
            ))
            quiz_id = cursor.lastrowid
            if quiz_id:
                for idx, quest in enumerate(q.get("questions", []), start=1):
                    cursor.execute("""
                    INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        quiz_id,
                        quest["question_text"],
                        quest["option_a"],
                        quest["option_b"],
                        quest["option_c"],
                        quest["option_d"],
                        quest.get("correct_option", "A").upper(),
                        idx
                    ))
        conn.commit()
    except Exception as e:
        print(f"Error seeding sample data: {e}")

# ----------------- User Management -----------------

def _sync_get_or_create_user(telegram_id: int, first_name: str, last_name: str = "", username: str = "") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    row = cursor.fetchone()

    is_admin = 1 if telegram_id in ADMIN_IDS else 0

    if not row:
        cursor.execute("""
        INSERT INTO users (telegram_id, first_name, last_name, username, is_admin, created_at, last_active)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """, (telegram_id, first_name, last_name, username, is_admin))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
    else:
        if is_admin != row["is_admin"] or first_name != row["first_name"] or username != row["username"]:
            cursor.execute("""
            UPDATE users SET first_name = ?, last_name = ?, username = ?, is_admin = ?, last_active = CURRENT_TIMESTAMP
            WHERE telegram_id = ?
            """, (first_name, last_name, username, is_admin or row["is_admin"], telegram_id))
        else:
            cursor.execute("UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?", (telegram_id,))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()

    user_dict = dict(row)
    conn.close()
    return user_dict

async def get_or_create_user(telegram_id: int, first_name: str, last_name: str = "", username: str = "") -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_get_or_create_user, telegram_id, first_name, last_name, username)

def _sync_update_user_subscription(telegram_id: int, university: str, faculty: str, direction: str, course: str, subscribed_code: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE users 
    SET university = ?, faculty = ?, direction = ?, course = ?, subscribed_code = ?, last_active = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
    """, (university.strip(), faculty.strip(), direction.strip(), course.strip(), subscribed_code.strip().upper(), telegram_id))
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

async def update_user_subscription(telegram_id: int, university: str, faculty: str, direction: str, course: str, subscribed_code: str):
    return await asyncio.to_thread(_sync_update_user_subscription, telegram_id, university, faculty, direction, course, subscribed_code)

# ----------------- Quiz & Parts Management -----------------

def _sync_get_quizzes(subscribed_code: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT q.*, 
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as questions_count,
           (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id) as attempts_count,
           u.first_name as creator_name,
           u.username as creator_username
    FROM quizzes q
    LEFT JOIN users u ON q.creator_id = u.telegram_id
    WHERE q.is_active = 1
    ORDER BY CASE WHEN q.unique_code = ? THEN 0 ELSE 1 END, q.created_at DESC
    """
    cursor.execute(query, (subscribed_code.strip().upper() if subscribed_code else "",))
    rows = cursor.fetchall()
    result = []
    for r in rows:
        item = dict(r)
        q_count = item["questions_count"] or 0
        item["parts_count"] = math.ceil(q_count / QUESTIONS_PER_PART) if q_count > 0 else 1
        result.append(item)

    conn.close()
    return result

async def get_quizzes(subscribed_code: Optional[str] = None) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_quizzes, subscribed_code)

def _sync_get_quiz_meta_and_parts(unique_code: str, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes WHERE unique_code = ? AND is_active = 1", (unique_code.strip().upper(),))
    quiz_row = cursor.fetchone()
    if not quiz_row:
        conn.close()
        return None

    quiz = dict(quiz_row)
    cursor.execute("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = ?", (quiz["id"],))
    total_questions = cursor.fetchone()["cnt"]

    quiz["total_questions"] = total_questions
    total_parts = math.ceil(total_questions / QUESTIONS_PER_PART) if total_questions > 0 else 1
    quiz["total_parts"] = total_parts

    # Build parts list with user's past attempts if user_id given
    parts = []
    for p in range(1, total_parts + 1):
        start_q = (p - 1) * QUESTIONS_PER_PART + 1
        end_q = min(p * QUESTIONS_PER_PART, total_questions)
        q_in_part = end_q - start_q + 1

        part_info = {
            "part_num": p,
            "title": f"{p}-qism",
            "range_text": f"{start_q} - {end_q} savollar",
            "questions_count": q_in_part,
            "is_completed": False,
            "best_score": 0,
            "best_percentage": 0.0
        }

        if user_id:
            cursor.execute("""
            SELECT score, total_questions, percentage 
            FROM attempts 
            WHERE quiz_id = ? AND user_id = ? AND part_num = ?
            ORDER BY percentage DESC LIMIT 1
            """, (quiz["id"], user_id, p))
            att = cursor.fetchone()
            if att:
                part_info["is_completed"] = True
                part_info["best_score"] = att["score"]
                part_info["best_percentage"] = att["percentage"]

        parts.append(part_info)

    quiz["parts"] = parts
    conn.close()
    return quiz

async def get_quiz_meta_and_parts(unique_code: str, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_quiz_meta_and_parts, unique_code, user_id)

def _sync_get_quiz_part_questions(unique_code: str, part_num: int = 1) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes WHERE unique_code = ? AND is_active = 1", (unique_code.strip().upper(),))
    quiz_row = cursor.fetchone()
    if not quiz_row:
        conn.close()
        return None

    quiz = dict(quiz_row)
    cursor.execute("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = ?", (quiz["id"],))
    total_questions = cursor.fetchone()["cnt"]
    total_parts = math.ceil(total_questions / QUESTIONS_PER_PART) if total_questions > 0 else 1

    # Clamp part_num
    if part_num < 1:
        part_num = 1
    if part_num > total_parts:
        part_num = total_parts

    offset = (part_num - 1) * QUESTIONS_PER_PART
    limit = QUESTIONS_PER_PART

    cursor.execute("""
    SELECT id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num
    FROM questions
    WHERE quiz_id = ?
    ORDER BY order_num ASC
    LIMIT ? OFFSET ?
    """, (quiz["id"], limit, offset))
    rows = cursor.fetchall()

    questions = []
    for r in rows:
        row_dict = dict(r)
        correct_key = row_dict["correct_option"].upper() # always 'A' in source JSON
        correct_text = row_dict[f"option_{correct_key.lower()}"]

        # All 4 options
        raw_options = [
            {"raw_key": "A", "text": row_dict["option_a"]},
            {"raw_key": "B", "text": row_dict["option_b"]},
            {"raw_key": "C", "text": row_dict["option_c"]},
            {"raw_key": "D", "text": row_dict["option_d"]}
        ]

        # Shuffle options so 'A' is NOT always first on student screen!
        random.shuffle(raw_options)

        # Re-label shuffled options as A, B, C, D for display
        display_options = []
        correct_display_key = "A"
        for idx, opt in enumerate(raw_options):
            lbl = ["A", "B", "C", "D"][idx]
            display_options.append({"key": lbl, "text": opt["text"]})
            if opt["text"] == correct_text:
                correct_display_key = lbl

        questions.append({
            "id": row_dict["id"],
            "order_num": row_dict["order_num"],
            "question_text": row_dict["question_text"],
            "options": display_options,
            # We pass correct_display_key so frontend can give instant feedback upon answer click
            "correct_key": correct_display_key
        })

    conn.close()
    return {
        "quiz_id": quiz["id"],
        "unique_code": quiz["unique_code"],
        "title": quiz["title"],
        "part_num": part_num,
        "total_parts": total_parts,
        "time_limit": quiz["time_limit_per_question"],
        "questions": questions
    }

async def get_quiz_part_questions(unique_code: str, part_num: int = 1) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_quiz_part_questions, unique_code, part_num)

def _sync_submit_part_quiz(quiz_id: int, user_id: int, part_num: int, answers: Dict[int, str], time_spent: int) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,))
    quiz = cursor.fetchone()
    if not quiz:
        conn.close()
        raise ValueError("Quiz topilmadi")

    offset = (part_num - 1) * QUESTIONS_PER_PART
    limit = QUESTIONS_PER_PART

    cursor.execute("""
    SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num
    FROM questions WHERE quiz_id = ? ORDER BY order_num ASC LIMIT ? OFFSET ?
    """, (quiz_id, limit, offset))
    questions = cursor.fetchall()

    total_questions = len(questions)
    correct_count = 0
    detailed_results = []

    for q in questions:
        q_id = q["id"]
        # In our database, option_a is the correct answer
        correct_answer_text = q[f"option_{q['correct_option'].lower()}"]

        user_choice_text = answers.get(str(q_id), answers.get(q_id, ""))
        is_correct = (user_choice_text.strip() == correct_answer_text.strip())
        if is_correct:
            correct_count += 1

        detailed_results.append({
            "question_id": q_id,
            "question_text": q["question_text"],
            "user_choice": user_choice_text,
            "correct_answer": correct_answer_text,
            "is_correct": is_correct
        })

    percentage = round((correct_count / total_questions) * 100, 1) if total_questions > 0 else 0.0

    cursor.execute("""
    INSERT INTO attempts (quiz_id, user_id, part_num, score, total_questions, percentage, time_spent_seconds, answers_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (quiz_id, user_id, part_num, correct_count, total_questions, percentage, time_spent, json.dumps(detailed_results, ensure_ascii=False)))
    attempt_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "attempt_id": attempt_id,
        "quiz_title": quiz["title"],
        "unique_code": quiz["unique_code"],
        "part_num": part_num,
        "score": correct_count,
        "total_questions": total_questions,
        "percentage": percentage,
        "time_spent_seconds": time_spent,
        "details": detailed_results
    }

async def submit_part_quiz(quiz_id: int, user_id: int, part_num: int, answers: Dict[int, str], time_spent: int) -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_submit_part_quiz, quiz_id, user_id, part_num, answers, time_spent)

# ----------------- Bulk Import From JSON -----------------

def _sync_import_quiz_from_json(creator_id: int, unique_code: str, title: str, description: str,
                                university: str, faculty: str, direction: str, course: str,
                                time_limit: int, raw_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    code = unique_code.strip().upper()
    cursor.execute("SELECT id FROM quizzes WHERE unique_code = ?", (code,))
    if cursor.fetchone():
        conn.close()
        raise ValueError(f"Ushbu kod ({code}) allaqachon mavjud! Boshqa kod tanlang.")

    cursor.execute("""
    INSERT INTO quizzes (unique_code, title, description, university, faculty, direction, course, creator_id, time_limit_per_question)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (code, title.strip(), description.strip(), university.strip(), faculty.strip(), direction.strip(), course.strip(), creator_id, time_limit))
    quiz_id = cursor.lastrowid

    inserted = 0
    for idx, item in enumerate(raw_questions, start=1):
        # Support various JSON formats:
        # question / question_text / savol
        # a / option_a / A -> Correct option
        # b / option_b / B
        # c / option_c / C
        # d / option_d / D
        q_text = item.get("question") or item.get("question_text") or item.get("savol") or ""
        opt_a = item.get("a") or item.get("option_a") or item.get("A") or ""
        opt_b = item.get("b") or item.get("option_b") or item.get("B") or ""
        opt_c = item.get("c") or item.get("option_c") or item.get("C") or ""
        opt_d = item.get("d") or item.get("option_d") or item.get("D") or ""

        # If options array provided
        if not opt_a and "options" in item and isinstance(item["options"], list) and len(item["options"]) >= 4:
            opt_a = item["options"][0]
            opt_b = item["options"][1]
            opt_c = item["options"][2]
            opt_d = item["options"][3]

        if not q_text.strip() or not opt_a.strip():
            continue

        cursor.execute("""
        INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num)
        VALUES (?, ?, ?, ?, ?, ?, 'A', ?)
        """, (
            quiz_id,
            q_text.strip(),
            opt_a.strip(),
            opt_b.strip() or "B javob",
            opt_c.strip() or "C javob",
            opt_d.strip() or "D javob",
            idx
        ))
        inserted += 1

    conn.commit()
    conn.close()

    total_parts = math.ceil(inserted / QUESTIONS_PER_PART) if inserted > 0 else 1
    return {
        "id": quiz_id,
        "unique_code": code,
        "title": title,
        "questions_count": inserted,
        "total_parts": total_parts
    }

async def import_quiz_from_json(creator_id: int, unique_code: str, title: str, description: str,
                                university: str, faculty: str, direction: str, course: str,
                                time_limit: int, raw_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_import_quiz_from_json, creator_id, unique_code, title, description,
                                   university, faculty, direction, course, time_limit, raw_questions)

# ----------------- User Stats & Created Quizzes -----------------

def _sync_get_user_stats(telegram_id: int) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT a.*, q.title as quiz_title, q.unique_code, q.university, q.faculty
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
    """, (telegram_id,))
    attempts = [dict(r) for r in cursor.fetchall()]

    total_attempts = len(attempts)
    total_correct = sum(a["score"] for a in attempts)
    total_questions = sum(a["total_questions"] for a in attempts)
    total_incorrect = total_questions - total_correct
    avg_percentage = round(sum(a["percentage"] for a in attempts) / total_attempts, 1) if total_attempts > 0 else 0.0
    highest_score = max((a["percentage"] for a in attempts), default=0.0)

    recent_attempts = list(reversed(attempts[:7]))
    chart_labels = [f"{a['quiz_title'][:10]}.. (Q{a.get('part_num', 1)})" for a in recent_attempts]
    chart_scores = [a["percentage"] for a in recent_attempts]

    conn.close()
    return {
        "total_attempts": total_attempts,
        "total_correct": total_correct,
        "total_incorrect": total_incorrect,
        "avg_percentage": avg_percentage,
        "highest_score": highest_score,
        "chart_data": {
            "labels": chart_labels,
            "scores": chart_scores,
            "pie": {
                "correct": total_correct,
                "incorrect": total_incorrect
            }
        },
        "history": attempts
    }

async def get_user_stats(telegram_id: int) -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_get_user_stats, telegram_id)

def _sync_get_user_created_quizzes(telegram_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT q.*,
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as questions_count,
           (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id) as attempts_count
    FROM quizzes q
    WHERE q.creator_id = ?
    ORDER BY q.created_at DESC
    """, (telegram_id,))
    quizzes = [dict(r) for r in cursor.fetchall()]

    for q in quizzes:
        q["parts_count"] = math.ceil((q["questions_count"] or 0) / QUESTIONS_PER_PART)

    conn.close()
    return quizzes

async def get_user_created_quizzes(telegram_id: int) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_user_created_quizzes, telegram_id)

# ----------------- Admin Queries -----------------

def _sync_get_admin_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total_users FROM users")
    total_users = cursor.fetchone()["total_users"]

    today_str = date.today().isoformat()
    cursor.execute("SELECT COUNT(*) as users_today FROM users WHERE DATE(created_at) = DATE(?)", (today_str,))
    users_today = cursor.fetchone()["users_today"]

    cursor.execute("SELECT COUNT(*) as total_quizzes FROM quizzes WHERE is_active = 1")
    total_quizzes = cursor.fetchone()["total_quizzes"]

    cursor.execute("SELECT COUNT(*) as total_attempts FROM attempts")
    total_attempts = cursor.fetchone()["total_attempts"]

    cursor.execute("""
    SELECT university, faculty, COUNT(*) as count 
    FROM users 
    WHERE university IS NOT NULL AND university != ''
    GROUP BY university, faculty 
    ORDER BY count DESC 
    LIMIT 5
    """)
    top_faculties = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
    SELECT u.telegram_id, u.first_name, u.last_name, u.username, u.university, u.faculty,
           COUNT(a.id) as attempts_count,
           AVG(a.percentage) as avg_score,
           SUM(a.score) as total_points
    FROM users u
    JOIN attempts a ON u.telegram_id = a.user_id
    GROUP BY u.telegram_id
    ORDER BY total_points DESC, avg_score DESC
    LIMIT 10
    """)
    leaderboard = [dict(r) for r in cursor.fetchall()]
    for item in leaderboard:
        item["avg_score"] = round(item["avg_score"], 1) if item["avg_score"] else 0.0

    conn.close()
    return {
        "total_users": total_users,
        "users_today": users_today,
        "total_quizzes": total_quizzes,
        "total_attempts": total_attempts,
        "top_faculties": top_faculties,
        "leaderboard": leaderboard
    }

async def get_admin_stats() -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_get_admin_stats)

def _sync_get_admin_users(search: str = "") -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    query = """
    SELECT u.id, u.telegram_id, u.first_name, u.last_name, u.username, 
           u.university, u.faculty, u.direction, u.course, u.subscribed_code,
           u.created_at, u.last_active, u.is_admin,
           (SELECT COUNT(*) FROM attempts WHERE user_id = u.telegram_id) as attempts_count,
           (SELECT COUNT(*) FROM quizzes WHERE creator_id = u.telegram_id) as created_quizzes_count
    FROM users u
    """
    params = []
    if search:
        query += " WHERE u.first_name LIKE ? OR u.last_name LIKE ? OR u.username LIKE ? OR u.telegram_id LIKE ?"
        term = f"%{search.strip()}%"
        params.extend([term, term, term, term])

    query += " ORDER BY u.last_active DESC LIMIT 200"
    cursor.execute(query, params)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return users

async def get_admin_users(search: str = "") -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_admin_users, search)

def _sync_get_all_user_ids() -> List[int]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT telegram_id FROM users")
    ids = [r["telegram_id"] for r in cursor.fetchall()]
    conn.close()
    return ids

async def get_all_user_ids() -> List[int]:
    return await asyncio.to_thread(_sync_get_all_user_ids)

def _sync_delete_quiz(quiz_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
    cursor.execute("DELETE FROM attempts WHERE quiz_id = ?", (quiz_id,))
    conn.commit()
    conn.close()
    return True

async def delete_quiz(quiz_id: int) -> bool:
    return await asyncio.to_thread(_sync_delete_quiz, quiz_id)
