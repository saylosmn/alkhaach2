"""Тестийн орчны бэлтгэл.

Өмнө нь тестүүд репод байхгүй `memory/test_credentials.md` доторх seed токеноос
хамаардаг байсан тул цэвэр орчинд огт ажиллахгүй байв. Одоо энэ fixture өөрөө
хоёр хэрэглэгч ба session-ийг Mongo руу бичиж, тест дууссаны дараа цэвэрлэнэ.

Шаардлага:
  MONGO_URL, DB_NAME  — тестийн ажиллаж буй backend-тэй ИЖИЛ өгөгдлийн сан
  TEST_BASE_URL       — асаалттай backend (default http://localhost:8000)
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
from pymongo import MongoClient

UID1 = "user_test000001"
UID2 = "user_test000002"
TOK1 = "test_session_token_alkhaach_1"
TOK2 = "test_session_token_alkhaach_2"

DEFAULT_TZ = "Asia/Ulaanbaatar"


def _user(uid: str, name: str) -> dict:
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    return {
        "user_id": uid,
        "email": f"{uid}@test.local",
        "name": name,
        "picture": None,
        "display_name": name,
        "avatar_color": "#12A87E",
        "daily_goal": 8000,
        "weight": 50.0,
        "tz": DEFAULT_TZ,
        "onboarded": True,
        "streak": 0,
        "last_processed_date": yesterday,
        "notif_morning": True,
        "notif_evening": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _session(uid: str, token: str) -> dict:
    return {
        "session_token": token,
        "user_id": uid,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    }


@pytest.fixture(scope="session", autouse=True)
def seed_test_users():
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        pytest.skip("MONGO_URL тохируулаагүй — интеграцийн тест алгаслаа")
    db = MongoClient(mongo_url)[os.environ.get("DB_NAME", "alkhaach")]

    for uid, name, tok in ((UID1, "Тест Нэг", TOK1), (UID2, "Тест Хоёр", TOK2)):
        db.users.replace_one({"user_id": uid}, _user(uid, name), upsert=True)
        db.user_sessions.replace_one(
            {"session_token": tok}, _session(uid, tok), upsert=True
        )

    # Өмнөх ажиллагааны 10 минутын join-түгжээг цэвэрлэнэ (TestRateLimit үлдээдэг)
    db.join_fails.delete_many({"user_id": {"$in": [UID1, UID2]}})

    # Устгах цэвэрлэгээг ЭНД хийхгүй: pytest-xdist 2 worker-тэй ажилладаг тул
    # (pytest.ini: -n 2) session fixture worker бүрт тусдаа ажиллана — эрт дуусах
    # worker нөгөөгийнх нь хэрэглэж буй хэрэглэгчийг устгаж тестийг унагаана.
    # Seed нь idempotent (replace_one upsert) тул дараагийн ажиллагаа шинээр бичнэ.
    yield
