import os
import re
import uuid
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone, date
from zoneinfo import ZoneInfo
from typing import Optional, List
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alkhaach")

CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # O 0 I 1 L хасагдсан
DEFAULT_TZ = "Asia/Ulaanbaatar"
STEP_FLAG_LIMIT = 60000
MAX_GROUPS_PER_USER = 10
MAX_MEMBERS_PER_GROUP = 50

# ---------- Google OAuth ----------
# Google Cloud Console → Credentials → OAuth client ID (Web application)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
# Энэ backend-ийн нийтийн хаяг, ж: https://alkhaach-api.onrender.com
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# Апп руу буцаах зөвшөөрөгдсөн redirect scheme-үүд (open-redirect-ээс хамгаална)
ALLOWED_REDIRECT_PREFIXES = [
    p.strip()
    for p in os.environ.get(
        "ALLOWED_REDIRECT_PREFIXES",
        "alkhaach://,exp://,http://localhost,http://127.0.0.1",
    ).split(",")
    if p.strip()
]

# ---------- Push (Expo-ийн үнэгүй push сервис) ----------
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_push_client = httpx.AsyncClient(timeout=15.0)

STAGES = [
    (0, 19, "Хийсгэлэн"),
    (20, 39, "Тамирчин"),
    (40, 59, "Хэвийн"),
    (60, 79, "Бүдүүн"),
    (80, 100, "Бөндгөр"),
]


def stage_name(weight: float) -> str:
    for lo, hi, name in STAGES:
        if lo <= weight <= hi:
            return name
    return "Хэвийн"


def safe_tz(tz: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(tz or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def local_today(tz: Optional[str]) -> date:
    return datetime.now(safe_tz(tz)).date()


def gen_code() -> str:
    return "".join(random.choices(CODE_CHARSET, k=6))


# ---------- Models ----------

class SessionIdBody(BaseModel):
    session_id: str


class MePatch(BaseModel):
    display_name: Optional[str] = None
    avatar_color: Optional[str] = None
    daily_goal: Optional[int] = None
    tz: Optional[str] = None
    notif_morning: Optional[bool] = None
    notif_evening: Optional[bool] = None


class StepDay(BaseModel):
    local_date: str
    steps: int
    source: str = "device"


class StepsSyncBody(BaseModel):
    tz: Optional[str] = None
    days: List[StepDay] = Field(default_factory=list)


class ManualStepsBody(BaseModel):
    local_date: str
    steps: int


class GroupCreateBody(BaseModel):
    name: str


class GroupJoinBody(BaseModel):
    code: str


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


# ---------- Auth ----------

def user_public(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "display_name": u.get("display_name"),
        "avatar_color": u.get("avatar_color"),
        "daily_goal": u.get("daily_goal", 8000),
        "weight": round(float(u.get("weight", 50.0)), 1),
        "stage": stage_name(float(u.get("weight", 50.0))),
        "tz": u.get("tz", DEFAULT_TZ),
        "onboarded": bool(u.get("onboarded", False)),
        "streak": u.get("streak", 0),
        "notif_morning": u.get("notif_morning", True),
        "notif_evening": u.get("notif_evening", True),
    }


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Нэвтрэх шаардлагатай")
    token = auth[7:].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Сесс хүчингүй байна")
    expires = session.get("expires_at")
    if isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Сессийн хугацаа дууссан")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Хэрэглэгч олдсонгүй")
    return user


def _redirect_allowed(url: str) -> bool:
    return any(url.startswith(p) for p in ALLOWED_REDIRECT_PREFIXES)


async def _get_or_create_user(email: str, name: Optional[str], picture: Optional[str]) -> dict:
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        return user
    yesterday = (local_today(DEFAULT_TZ) - timedelta(days=1)).isoformat()
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": name,
        "picture": picture,
        "display_name": None,
        "avatar_color": "#12A87E",
        "daily_goal": 8000,
        "weight": 50.0,
        "tz": DEFAULT_TZ,
        "onboarded": False,
        "streak": 0,
        "last_processed_date": yesterday,
        "notif_morning": True,
        "notif_evening": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one({**user})
    return user


@api_router.get("/auth/google/start")
async def google_start(redirect: str):
    """Апп энэ хаягийг браузараар нээнэ. Бид Google руу шилжүүлнэ."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not PUBLIC_BASE_URL:
        raise HTTPException(500, "Google OAuth тохируулаагүй байна (GOOGLE_CLIENT_ID / SECRET / PUBLIC_BASE_URL)")
    if not _redirect_allowed(redirect):
        raise HTTPException(400, "Зөвшөөрөгдөөгүй redirect хаяг")

    state = uuid.uuid4().hex
    await db.oauth_states.insert_one({
        "state": state,
        "app_redirect": redirect,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })

    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{PUBLIC_BASE_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}", status_code=302)


@api_router.get("/auth/google/callback")
async def google_callback(state: str, code: Optional[str] = None, error: Optional[str] = None):
    """Google эндээс буцна. Бид кодыг солиод аппын deep link руу шилжүүлнэ."""
    st = await db.oauth_states.find_one_and_delete({"state": state})
    if not st:
        raise HTTPException(400, "Нэвтрэлтийн сесс хүчингүй эсвэл хугацаа дууссан")
    app_redirect = st["app_redirect"]

    if error or not code:
        sep = "&" if "?" in app_redirect else "?"
        return RedirectResponse(f"{app_redirect}{sep}auth_error=1", status_code=302)

    async with httpx.AsyncClient(timeout=15) as hc:
        try:
            tok = await hc.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{PUBLIC_BASE_URL}/api/auth/google/callback",
                "grant_type": "authorization_code",
            })
            if tok.status_code != 200:
                logger.warning(f"google token exchange failed: {tok.status_code} {tok.text[:200]}")
                raise HTTPException(401, "Нэвтрэлт амжилтгүй")
            access_token = tok.json().get("access_token")

            ui = await hc.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
            if ui.status_code != 200:
                raise HTTPException(401, "Нэвтрэлт амжилтгүй")
            info = ui.json()
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"google oauth error: {e}")
            raise HTTPException(401, "Нэвтрэлт амжилтгүй. Дахин оролдоно уу.")

    email = info.get("email")
    if not email or not info.get("email_verified", True):
        raise HTTPException(401, "Имэйл баталгаажаагүй байна")

    user = await _get_or_create_user(email, info.get("name"), info.get("picture"))

    # Нэг удаа хэрэглэх богино хугацаат код — deep link-ээр дамжуулахад аюулгүй
    one_time = uuid.uuid4().hex
    await db.auth_codes.insert_one({
        "code": one_time,
        "user_id": user["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=2),
    })

    sep = "&" if "?" in app_redirect else "?"
    return RedirectResponse(f"{app_redirect}{sep}session_id={one_time}", status_code=302)


@api_router.post("/auth/session")
async def exchange_session(body: SessionIdBody):
    """Нэг удаагийн кодыг 7 хоногийн session token болгож солино."""
    rec = await db.auth_codes.find_one_and_delete({"code": body.session_id})
    if not rec:
        raise HTTPException(status_code=401, detail="Нэвтрэлт амжилтгүй. Дахин оролдоно уу.")
    expires = rec.get("expires_at")
    if isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Нэвтрэлтийн хугацаа дууслаа. Дахин оролдоно уу.")

    user = await db.users.find_one({"user_id": rec["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Хэрэглэгч олдсонгүй")

    session_token = uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return {"session_token": session_token, "user": user_public(user)}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api_router.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    token = request.headers.get("Authorization", "")[7:].strip()
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Profile ----------

@api_router.patch("/me")
async def patch_me(body: MePatch, user: dict = Depends(get_current_user)):
    updates = {}
    if body.display_name is not None:
        name = body.display_name.strip()
        if not (2 <= len(name) <= 16):
            raise HTTPException(status_code=422, detail="Нэр 2–16 тэмдэгт байх ёстой")
        updates["display_name"] = name
        updates["onboarded"] = True
    if body.avatar_color is not None:
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", body.avatar_color):
            raise HTTPException(status_code=422, detail="Өнгө буруу байна")
        updates["avatar_color"] = body.avatar_color
    if body.daily_goal is not None:
        if not (4000 <= body.daily_goal <= 20000):
            raise HTTPException(status_code=422, detail="Зорилго 4 000–20 000 хооронд байх ёстой")
        updates["daily_goal"] = body.daily_goal
    if body.tz is not None:
        try:
            ZoneInfo(body.tz)
            updates["tz"] = body.tz
        except Exception:
            pass
    if body.notif_morning is not None:
        updates["notif_morning"] = body.notif_morning
    if body.notif_evening is not None:
        updates["notif_evening"] = body.notif_evening
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_public(fresh)


@api_router.delete("/me")
async def delete_me(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    owned = await db.groups.find({"owner_id": uid}, {"_id": 0}).to_list(100)
    for g in owned:
        await db.group_members.delete_many({"group_id": g["group_id"]})
        await db.groups.delete_one({"group_id": g["group_id"]})
    await db.group_members.delete_many({"user_id": uid})
    await db.steps_daily.delete_many({"user_id": uid})
    await db.weight_daily.delete_many({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.join_fails.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


# ---------- Weight engine (cron-ийг орлох lazy боловсруулалт) ----------

async def process_weights(user: dict) -> dict:
    """Сүүлд боловсруулснаас хойшхи өдөр бүрийн жинг дарааллаар тооцно (өчигдрийг хүртэл)."""
    uid = user["user_id"]
    tz = user.get("tz", DEFAULT_TZ)
    today = local_today(tz)
    last_str = user.get("last_processed_date")
    try:
        last = date.fromisoformat(last_str) if last_str else today - timedelta(days=1)
    except Exception:
        last = today - timedelta(days=1)

    weight = float(user.get("weight", 50.0))
    streak = int(user.get("streak", 0))
    goal = int(user.get("daily_goal", 8000))
    changed = False

    d = last + timedelta(days=1)
    iterations = 0
    while d < today and iterations < 120:
        iterations += 1
        doc = await db.steps_daily.find_one({"user_id": uid, "local_date": d.isoformat()}, {"_id": 0})
        steps = min(int(doc["steps"]), STEP_FLAG_LIMIT) if doc else 0
        delta = (goal - steps) / goal
        change = max(-6.0, min(6.0, delta * 6))
        if steps >= 2 * goal:
            change -= 2
        if steps >= goal:
            streak += 1
            if streak % 7 == 0:
                change -= 4
        else:
            streak = 0
        weight = max(0.0, min(100.0, weight + change))
        await db.weight_daily.update_one(
            {"user_id": uid, "local_date": d.isoformat()},
            {"$set": {"weight": round(weight, 2), "delta": round(change, 2)}},
            upsert=True,
        )
        changed = True
        d += timedelta(days=1)

    if changed:
        await db.users.update_one(
            {"user_id": uid},
            {"$set": {
                "weight": round(weight, 2),
                "streak": streak,
                "last_processed_date": (d - timedelta(days=1)).isoformat(),
            }},
        )
        user = await db.users.find_one({"user_id": uid}, {"_id": 0})
    return user


# ---------- Steps ----------

async def upsert_step_day(uid: str, local_date_str: str, steps: int, source: str):
    steps = max(0, int(steps))
    flagged = 1 if steps > STEP_FLAG_LIMIT else 0
    existing = await db.steps_daily.find_one({"user_id": uid, "local_date": local_date_str}, {"_id": 0})
    # Гараар оруулсан утгыг төхөөрөмжийн бага утга дарж бичихгүй
    if existing and existing.get("source") == "manual" and source == "device" and steps < existing.get("steps", 0):
        return
    await db.steps_daily.update_one(
        {"user_id": uid, "local_date": local_date_str},
        {"$set": {
            "steps": steps,
            "source": source,
            "flagged": flagged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


async def build_summary(user: dict) -> dict:
    uid = user["user_id"]
    tz = user.get("tz", DEFAULT_TZ)
    goal = int(user.get("daily_goal", 8000))
    today = local_today(tz)

    dates = [(today - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    docs = await db.steps_daily.find(
        {"user_id": uid, "local_date": {"$in": dates}}, {"_id": 0}
    ).to_list(20)
    by_date = {d["local_date"]: d for d in docs}

    def day_info(ds: str) -> dict:
        doc = by_date.get(ds)
        steps = int(doc["steps"]) if doc else 0
        return {
            "local_date": ds,
            "steps": steps,
            "source": doc.get("source", "device") if doc else None,
            "flagged": bool(doc.get("flagged")) if doc else False,
            "goal_met": steps >= goal,
        }

    week = [day_info((today - timedelta(days=i)).isoformat()) for i in range(6, -1, -1)]
    today_info = week[-1]
    yesterday_info = day_info((today - timedelta(days=1)).isoformat())

    curve_docs = await db.weight_daily.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("local_date", -1).to_list(30)
    curve = [{"local_date": c["local_date"], "weight": c["weight"]} for c in reversed(curve_docs)]

    weight = round(float(user.get("weight", 50.0)), 1)
    last_delta = curve_docs[0]["delta"] if curve_docs else 0.0

    return {
        "today": today_info,
        "yesterday": yesterday_info,
        "goal": goal,
        "remaining": max(0, goal - today_info["steps"]),
        "goal_reached": today_info["steps"] >= goal,
        "week": week,
        "week_total": sum(d["steps"] for d in week),
        "weight": weight,
        "stage": stage_name(weight),
        "weight_delta": round(float(last_delta), 2),
        "streak": user.get("streak", 0),
        "weight_curve": curve,
        "local_date": today.isoformat(),
    }


@api_router.post("/steps/sync")
async def steps_sync(body: StepsSyncBody, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    if body.tz and body.tz != user.get("tz"):
        try:
            ZoneInfo(body.tz)
            await db.users.update_one({"user_id": uid}, {"$set": {"tz": body.tz}})
            user["tz"] = body.tz
        except Exception:
            pass
    for day in body.days[:20]:
        try:
            date.fromisoformat(day.local_date)
        except Exception:
            continue
        src = "manual" if day.source == "manual" else "device"
        await upsert_step_day(uid, day.local_date, day.steps, src)
    user = await process_weights(user)
    return await build_summary(user)


@api_router.post("/steps/manual")
async def steps_manual(body: ManualStepsBody, user: dict = Depends(get_current_user)):
    try:
        d = date.fromisoformat(body.local_date)
    except Exception:
        raise HTTPException(status_code=422, detail="Огноо буруу байна")
    today = local_today(user.get("tz"))
    if not (today - timedelta(days=14) <= d <= today):
        raise HTTPException(status_code=422, detail="Сүүлийн 14 хоногийн огноо байх ёстой")
    if body.steps < 0 or body.steps > 200000:
        raise HTTPException(status_code=422, detail="Алхамын тоо буруу байна")
    await upsert_step_day(user["user_id"], body.local_date, body.steps, "manual")
    user = await process_weights(user)
    return await build_summary(user)


@api_router.get("/me/summary")
async def me_summary(user: dict = Depends(get_current_user)):
    user = await process_weights(user)
    return await build_summary(user)


# ---------- Push мэдэгдэл ----------

@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    """Expo push токеныг хадгална (ExponentPushToken[...] хэлбэртэй)."""
    token = (body.device_token or "").strip()
    if not token:
        raise HTTPException(422, "device_token хоосон байна")
    await db.push_tokens.update_one(
        {"token": token},
        {"$set": {
            "token": token,
            "user_id": body.user_id,
            "platform": body.platform,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"status": "registered"}


async def send_push(
    recipients: List[str],
    data: dict,
    idempotency_key: Optional[str] = None,
) -> None:
    """Expo-ийн push сервисээр мэдэгдэл илгээнэ. Түлхүүр, төлбөр шаардлагагүй."""
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")

    docs = await db.push_tokens.find(
        {"user_id": {"$in": recipients}}, {"_id": 0, "token": 1}
    ).to_list(1000)
    tokens = [d["token"] for d in docs if d.get("token")]
    if not tokens:
        return

    messages = [{
        "to": t,
        "title": data["title"],
        "body": data["message"],
        "sound": "default",
        "data": {"action_url": data.get("action_url", "/(tabs)/home")},
    } for t in tokens]

    # Expo нэг хүсэлтэд 100 мэдэгдэл хүлээн авна
    for i in range(0, len(messages), 100):
        chunk = messages[i:i + 100]
        try:
            resp = await _push_client.post(EXPO_PUSH_URL, json=chunk)
            if resp.status_code >= 400:
                logger.warning(f"expo push failed: {resp.status_code} {resp.text[:200]}")
                continue
            # Устгагдсан/буруу токеныг цэвэрлэнэ
            for msg, res in zip(chunk, resp.json().get("data", [])):
                if res.get("status") == "error" and \
                        res.get("details", {}).get("error") == "DeviceNotRegistered":
                    await db.push_tokens.delete_one({"token": msg["to"]})
        except Exception as e:
            logger.warning(f"expo push chunk failed: {e}")


async def _notif_already_sent(uid: str, local_date_str: str, notif_type: str) -> bool:
    return bool(await db.notif_log.find_one(
        {"user_id": uid, "local_date": local_date_str, "type": notif_type}, {"_id": 0}
    ))


async def _mark_notif_sent(uid: str, local_date_str: str, notif_type: str):
    await db.notif_log.update_one(
        {"user_id": uid, "local_date": local_date_str, "type": notif_type},
        {"$set": {"ts": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def notification_tick():
    """Хэрэглэгч бүрийн цагийн бүсээр: 00:10+ жин боловсруулах,
    08:30–09:30 өглөөний илчлэлт (дүр өөрчлөгдсөн хүнд л),
    20:00–21:00 сануулга (зорилгын 80%-иас доош хүнд). Өдөрт дээд тал нь 2 push."""
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    for user in users:
        try:
            tz = safe_tz(user.get("tz"))
            now_local = datetime.now(tz)
            today = now_local.date().isoformat()
            minute = now_local.hour * 60 + now_local.minute

            # 00:10-аас хойш жин боловсруулах (cron-ийг орлоно)
            if minute >= 10:
                user = await process_weights(user)

            uid = user["user_id"]
            goal = int(user.get("daily_goal", 8000))

            # Өглөө 08:30–09:30: дүр өөрчлөгдсөн хүнд л
            if user.get("notif_morning", True) and 510 <= minute < 570:
                if not await _notif_already_sent(uid, today, "morning"):
                    yday = (now_local.date() - timedelta(days=1)).isoformat()
                    wd = await db.weight_daily.find_one(
                        {"user_id": uid, "local_date": yday}, {"_id": 0}
                    )
                    if wd and abs(float(wd.get("delta", 0))) >= 0.5:
                        direction = "хөнгөрлөө" if float(wd["delta"]) < 0 else "жаахан өргөслөө"
                        try:
                            await send_push(
                                [uid],
                                {
                                    "title": "АЛХААЧ",
                                    "message": f"Дүр чинь {direction} — орж хараарай",
                                    "action_url": "/(tabs)/home",
                                },
                                idempotency_key=f"morning_{uid}_{today}",
                            )
                        except Exception as e:
                            logger.warning(f"morning push failed (non-blocking): {e}")
                        await _mark_notif_sent(uid, today, "morning")

            # Орой 20:00–21:00: зорилгын 80%-иас доош байгаа хүнд
            if user.get("notif_evening", True) and 1200 <= minute < 1260:
                if not await _notif_already_sent(uid, today, "evening"):
                    sd = await db.steps_daily.find_one(
                        {"user_id": uid, "local_date": today}, {"_id": 0}
                    )
                    steps = int(sd["steps"]) if sd else 0
                    if steps < 0.8 * goal:
                        remaining = max(0, goal - steps)
                        try:
                            await send_push(
                                [uid],
                                {
                                    "title": "АЛХААЧ",
                                    "message": f"{remaining:,} алхам үлдлээ. Богино алхалт хийх үү?".replace(",", " "),
                                    "action_url": "/(tabs)/home",
                                },
                                idempotency_key=f"evening_{uid}_{today}",
                            )
                        except Exception as e:
                            logger.warning(f"evening push failed (non-blocking): {e}")
                        await _mark_notif_sent(uid, today, "evening")
        except Exception as e:
            logger.warning(f"notification tick user failed: {e}")


async def notification_scheduler():
    while True:
        try:
            await notification_tick()
        except Exception as e:
            logger.warning(f"notification scheduler tick failed: {e}")
        await asyncio.sleep(300)


# ---------- Groups ----------

async def membership(gid: str, uid: str) -> Optional[dict]:
    return await db.group_members.find_one({"group_id": gid, "user_id": uid}, {"_id": 0})


async def my_group_count(uid: str) -> int:
    return await db.group_members.count_documents({"user_id": uid})


async def unique_code() -> str:
    for _ in range(30):
        code = gen_code()
        if not await db.groups.find_one({"join_code": code}, {"_id": 0}):
            return code
    raise HTTPException(status_code=500, detail="Код үүсгэж чадсангүй. Дахин оролдоно уу.")


async def check_join_rate_limit(uid: str):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    fails = await db.join_fails.count_documents({"user_id": uid, "ts": {"$gte": cutoff}})
    if fails >= 5:
        raise HTTPException(status_code=429, detail="Хэт олон буруу оролдлого. 10 минутын дараа дахин оролдоно уу.")


async def record_join_fail(uid: str):
    await db.join_fails.insert_one({"user_id": uid, "ts": datetime.now(timezone.utc)})


@api_router.post("/groups")
async def create_group(body: GroupCreateBody, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not (2 <= len(name) <= 30):
        raise HTTPException(status_code=422, detail="Бүлгийн нэр 2–30 тэмдэгт байх ёстой")
    if await my_group_count(user["user_id"]) >= MAX_GROUPS_PER_USER:
        raise HTTPException(status_code=409, detail="Дээд тал нь 10 бүлэгт байж болно")
    code = await unique_code()
    gid = f"group_{uuid.uuid4().hex[:12]}"
    await db.groups.insert_one({
        "group_id": gid,
        "name": name,
        "join_code": code,
        "owner_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.group_members.insert_one({
        "group_id": gid,
        "user_id": user["user_id"],
        "role": "owner",
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"group_id": gid, "name": name, "join_code": code}


@api_router.get("/groups")
async def list_groups(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    mems = await db.group_members.find({"user_id": uid}, {"_id": 0}).to_list(20)
    result = []
    for m in mems:
        g = await db.groups.find_one({"group_id": m["group_id"]}, {"_id": 0})
        if not g:
            continue
        all_mems = await db.group_members.find({"group_id": g["group_id"]}, {"_id": 0}).to_list(60)
        member_ids = [x["user_id"] for x in all_mems]
        users = await db.users.find(
            {"user_id": {"$in": member_ids}},
            {"_id": 0, "user_id": 1, "display_name": 1, "avatar_color": 1, "weight": 1},
        ).to_list(60)
        result.append({
            "group_id": g["group_id"],
            "name": g["name"],
            "is_owner": g["owner_id"] == uid,
            "member_count": len(all_mems),
            "members": [
                {
                    "user_id": u["user_id"],
                    "display_name": u.get("display_name") or "Гишүүн",
                    "avatar_color": u.get("avatar_color", "#12A87E"),
                    "weight": round(float(u.get("weight", 50.0)), 1),
                    "is_me": u["user_id"] == uid,
                }
                for u in users
            ],
        })
    return result


@api_router.get("/groups/preview/{code}")
async def preview_group(code: str, user: dict = Depends(get_current_user)):
    await check_join_rate_limit(user["user_id"])
    code = code.strip().upper()
    g = await db.groups.find_one({"join_code": code}, {"_id": 0})
    if not g:
        await record_join_fail(user["user_id"])
        raise HTTPException(status_code=404, detail="Код буруу байна. Дахин шалгана уу.")
    count = await db.group_members.count_documents({"group_id": g["group_id"]})
    return {"name": g["name"], "member_count": count}


@api_router.post("/groups/join")
async def join_group(body: GroupJoinBody, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    await check_join_rate_limit(uid)
    code = body.code.strip().upper()
    g = await db.groups.find_one({"join_code": code}, {"_id": 0})
    if not g:
        await record_join_fail(uid)
        raise HTTPException(status_code=404, detail="Код буруу байна. Дахин шалгана уу.")
    if await membership(g["group_id"], uid):
        return {"group_id": g["group_id"], "name": g["name"], "already_member": True}
    if await my_group_count(uid) >= MAX_GROUPS_PER_USER:
        raise HTTPException(status_code=409, detail="Дээд тал нь 10 бүлэгт байж болно")
    count = await db.group_members.count_documents({"group_id": g["group_id"]})
    if count >= MAX_MEMBERS_PER_GROUP:
        raise HTTPException(status_code=409, detail="Энэ бүлэг дүүрсэн байна (50 гишүүн)")
    await db.group_members.insert_one({
        "group_id": g["group_id"],
        "user_id": uid,
        "role": "member",
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"group_id": g["group_id"], "name": g["name"], "already_member": False}


@api_router.get("/groups/{gid}")
async def group_detail(gid: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    mem = await membership(gid, uid)
    if not mem:
        raise HTTPException(status_code=403, detail="Та энэ бүлгийн гишүүн биш байна")
    g = await db.groups.find_one({"group_id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
    all_mems = await db.group_members.find({"group_id": gid}, {"_id": 0}).to_list(60)
    member_ids = [x["user_id"] for x in all_mems]
    users = await db.users.find({"user_id": {"$in": member_ids}}, {"_id": 0}).to_list(60)
    members = []
    for u in users:
        m_tz = u.get("tz", DEFAULT_TZ)
        m_today = local_today(m_tz).isoformat()
        sd = await db.steps_daily.find_one(
            {"user_id": u["user_id"], "local_date": m_today}, {"_id": 0}
        )
        flagged = bool(sd.get("flagged")) if sd else False
        steps = None if flagged else (int(sd["steps"]) if sd else 0)
        members.append({
            "user_id": u["user_id"],
            "display_name": u.get("display_name") or "Гишүүн",
            "avatar_color": u.get("avatar_color", "#12A87E"),
            "weight": round(float(u.get("weight", 50.0)), 1),
            "stage": stage_name(float(u.get("weight", 50.0))),
            "today_steps": steps,
            "flagged": flagged,
            "source": sd.get("source") if sd else None,
            "goal_met": (steps or 0) >= u.get("daily_goal", 8000),
            "is_owner": u["user_id"] == g["owner_id"],
            "is_me": u["user_id"] == uid,
        })
    members.sort(key=lambda m: (m["today_steps"] is None, -(m["today_steps"] or 0)))
    return {
        "group_id": gid,
        "name": g["name"],
        "join_code": g["join_code"],
        "owner_id": g["owner_id"],
        "is_owner": g["owner_id"] == uid,
        "member_count": len(members),
        "members": members,
    }


@api_router.delete("/groups/{gid}/members/{target_uid}")
async def remove_member(gid: str, target_uid: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    g = await db.groups.find_one({"group_id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
    if not await membership(gid, uid):
        raise HTTPException(status_code=403, detail="Та энэ бүлгийн гишүүн биш байна")
    is_owner = g["owner_id"] == uid
    if target_uid != uid and not is_owner:
        raise HTTPException(status_code=403, detail="Зөвхөн үүсгэгч гишүүн хасах эрхтэй")
    if target_uid == g["owner_id"]:
        raise HTTPException(status_code=409, detail="Үүсгэгч бүлгээс гарахын оронд бүлгээ устгана")
    result = await db.group_members.delete_one({"group_id": gid, "user_id": target_uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Гишүүн олдсонгүй")
    return {"ok": True}


@api_router.post("/groups/{gid}/code")
async def rotate_code(gid: str, user: dict = Depends(get_current_user)):
    g = await db.groups.find_one({"group_id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Зөвхөн үүсгэгч код солих эрхтэй")
    code = await unique_code()
    await db.groups.update_one({"group_id": gid}, {"$set": {"join_code": code}})
    return {"join_code": code}


@api_router.delete("/groups/{gid}")
async def delete_group(gid: str, user: dict = Depends(get_current_user)):
    g = await db.groups.find_one({"group_id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Бүлэг олдсонгүй")
    if g["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Зөвхөн үүсгэгч бүлэг устгах эрхтэй")
    await db.group_members.delete_many({"group_id": gid})
    await db.groups.delete_one({"group_id": gid})
    return {"ok": True}


PRIVACY_HTML = """<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>АЛХААЧ — Нууцлалын бодлого</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#EFEADC;color:#191F1B;max-width:720px;margin:0 auto;padding:32px 20px;line-height:1.6}
h1{font-size:28px}h2{font-size:18px;margin-top:28px}
.card{background:#FFFDF7;border:1.5px solid #191F1B;border-radius:20px;padding:24px;box-shadow:0 2px 0 #191F1B}
.muted{color:#6B6F68;font-size:13px}
</style>
</head>
<body>
<div class="card">
<h1>АЛХААЧ — Нууцлалын бодлого</h1>
<p class="muted">Сүүлд шинэчилсэн: 2026 оны 6-р сар</p>
<h2>1. Ямар мэдээлэл цуглуулдаг вэ</h2>
<p>АЛХААЧ дараах мэдээллийг л цуглуулна: Google дансны имэйл ба нэр (нэвтрэхэд), таны сонгосон дүрийн нэр ба өнгө, өдөр тутмын алхамын тоо, өдрийн зорилго, цагийн бүс. Өөр юу ч цуглуулахгүй.</p>
<h2>2. Эрүүл мэндийн өгөгдөл</h2>
<p>Апп нь Apple Health (iOS) болон Health Connect (Android)-оос зөвхөн алхамын тоог уншина. Зөвхөн унших эрхтэй — юу ч бичихгүй. Байршил, зүрхний цохилт, биеийн жин, унтлага зэрэг өөр ямар ч эрүүл мэндийн төрөлд хандахгүй. Зөвшөөрлөө хэдийд ч утасныхаа тохиргооноос цуцалж болно — апп гараар оруулах горимоор үргэлжлүүлэн ажиллана.</p>
<h2>3. Өгөгдөл хэрхэн ашиглагддаг вэ</h2>
<p>Алхамын тоо нь зөвхөн таны дүрийн жинг тооцоолох, өөрийн явцыг харуулах, таны нэгдсэн бүлгүүдэд харуулахад ашиглагдана. Өгөгдлийг зар сурталчилгаанд ашиглахгүй, гуравдагч этгээдэд зарахгүй, дамжуулахгүй.</p>
<h2>4. Бүлгийн нууцлал</h2>
<p>Таны дүр, өнөөдрийн алхалт зөвхөн таны нэгдсэн хаалттай бүлгийн гишүүдэд харагдана. Дэлхийн нээлттэй лидерборд байхгүй. Бүлгээс гарсан даруйд таны өгөгдөл тэр бүлэгт харагдахаа болино.</p>
<h2>5. Мэдэгдэл</h2>
<p>Апп өдөрт хамгийн ихдээ 2 push мэдэгдэл илгээнэ (өглөөний илчлэлт, оройн сануулга). Тус бүрийг аппын тохиргооноос унтраах боломжтой.</p>
<h2>6. Өгөгдөл хадгалалт ба устгал</h2>
<p>Өгөгдөл найдвартай серверт хадгалагдана. Апп доторх «Данс устгах» товчийг дарахад таны бүх өгөгдөл — дүр, алхалтын түүх, бүлгийн гишүүнчлэл — 30 хоногийн дотор бүрэн устана.</p>
<h2>7. Хүүхдийн нууцлал</h2>
<p>Апп 13-аас доош насны хүүхдэд зориулагдаагүй бөгөөд тэдний мэдээллийг санаатайгаар цуглуулдаггүй.</p>
<h2>8. Холбоо барих</h2>
<p>Нууцлалтай холбоотой асуулт байвал <a href="mailto:info@alkhaach.mn">info@alkhaach.mn</a> хаягаар холбогдоно уу.</p>
</div>
</body>
</html>"""


@api_router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse(content=PRIVACY_HTML)


@api_router.get("/")
async def root():
    return {"message": "АЛХААЧ API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    # Google OAuth — хугацаа дуусмагц автоматаар устана
    await db.oauth_states.create_index("state", unique=True)
    await db.oauth_states.create_index("expires_at", expireAfterSeconds=0)
    await db.auth_codes.create_index("code", unique=True)
    await db.auth_codes.create_index("expires_at", expireAfterSeconds=0)
    # Expo push токен
    await db.push_tokens.create_index("token", unique=True)
    await db.push_tokens.create_index("user_id")
    await db.steps_daily.create_index([("user_id", 1), ("local_date", 1)], unique=True)
    await db.weight_daily.create_index([("user_id", 1), ("local_date", 1)], unique=True)
    await db.groups.create_index("join_code", unique=True)
    await db.group_members.create_index([("group_id", 1), ("user_id", 1)], unique=True)
    await db.join_fails.create_index("ts", expireAfterSeconds=1200)
    await db.notif_log.create_index(
        [("user_id", 1), ("local_date", 1), ("type", 1)], unique=True
    )
    asyncio.create_task(notification_scheduler())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
