"""АЛХААЧ backend regression tests.

Covers auth, profile, steps sync/manual, summary, groups CRUD/privacy/rate-limit.
Тестийн хэрэглэгч/session-ийг tests/conftest.py өөрөө Mongo руу бичнэ
(MONGO_URL, DB_NAME шаардлагатай; TEST_BASE_URL дээр backend асаалттай байх).
"""
import os
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000") + "/api"
TOK1 = "test_session_token_alkhaach_1"  # user_test000001 owner
TOK2 = "test_session_token_alkhaach_2"  # user_test000002 member
H1 = {"Authorization": f"Bearer {TOK1}"}
H2 = {"Authorization": f"Bearer {TOK2}"}
UB = ZoneInfo("Asia/Ulaanbaatar")


def local_today_iso():
    return datetime.now(UB).date().isoformat()


# ---------- Auth ----------
class TestAuth:
    def test_session_invalid_id(self):
        r = requests.post(f"{BASE}/auth/session", json={"session_id": "invalid_xxx"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_without_token(self):
        r = requests.get(f"{BASE}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self):
        r = requests.get(f"{BASE}/auth/me", headers=H1)
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == "user_test000001"
        assert u["onboarded"] is True
        assert "stage" in u and u["stage"] in {
            "Хийсгэлэн", "Тамирчин", "Хэвийн", "Бүдүүн", "Бөндгөр"
        }

    def test_me_bad_token(self):
        r = requests.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer nope"})
        assert r.status_code == 401


# ---------- Profile ----------
class TestProfile:
    def test_patch_valid(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={
            "display_name": "Тест хэрэглэгч",
            "avatar_color": "#12A87E",
            "daily_goal": 8000,
        })
        assert r.status_code == 200
        u = r.json()
        assert u["display_name"] == "Тест хэрэглэгч"
        assert u["avatar_color"] == "#12A87E"
        assert u["daily_goal"] == 8000

    def test_patch_short_name(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={"display_name": "A"})
        assert r.status_code == 422

    def test_patch_long_name(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={"display_name": "X" * 17})
        assert r.status_code == 422

    def test_patch_bad_goal(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={"daily_goal": 1000})
        assert r.status_code == 422
        r = requests.patch(f"{BASE}/me", headers=H1, json={"daily_goal": 30000})
        assert r.status_code == 422

    def test_patch_bad_color(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={"avatar_color": "red"})
        assert r.status_code == 422

    def test_patch_notifications(self):
        r = requests.patch(f"{BASE}/me", headers=H1, json={"notif_morning": False, "notif_evening": True})
        assert r.status_code == 200
        # restore
        requests.patch(f"{BASE}/me", headers=H1, json={"notif_morning": True, "notif_evening": True})


# ---------- Steps ----------
class TestSteps:
    def test_sync_14day_batch_and_summary(self):
        today = datetime.now(UB).date()
        days = []
        for i in range(14):
            d = today - timedelta(days=i)
            days.append({"local_date": d.isoformat(), "steps": 5000 + i * 100, "source": "device"})
        r = requests.post(f"{BASE}/steps/sync", headers=H1, json={"tz": "Asia/Ulaanbaatar", "days": days})
        assert r.status_code == 200, r.text
        s = r.json()
        assert "today" in s and "yesterday" in s and "week" in s
        assert len(s["week"]) == 7
        assert "weight" in s and 0 <= s["weight"] <= 100
        assert "weight_curve" in s
        assert s["today"]["local_date"] == today.isoformat()
        # Sync overwrites (send a different steps value for yesterday)
        y = (today - timedelta(days=1)).isoformat()
        r2 = requests.post(f"{BASE}/steps/sync", headers=H1, json={
            "days": [{"local_date": y, "steps": 9999, "source": "device"}]
        })
        assert r2.status_code == 200
        yinfo = next(d for d in r2.json()["week"] if d["local_date"] == y)
        assert yinfo["steps"] == 9999

    def test_sync_flags_over_60000(self):
        today = datetime.now(UB).date()
        d = (today - timedelta(days=2)).isoformat()
        r = requests.post(f"{BASE}/steps/sync", headers=H1, json={
            "days": [{"local_date": d, "steps": 70000, "source": "device"}]
        })
        assert r.status_code == 200
        s = r.json()
        info = next((x for x in s["week"] if x["local_date"] == d), None)
        assert info is not None
        assert info["flagged"] is True
        # restore reasonable steps for downstream tests (device утга буурдаггүй тул гараар)
        requests.post(f"{BASE}/steps/manual", headers=H1, json={"local_date": d, "steps": 6000})

    def test_sync_skips_invalid_days(self):
        today = datetime.now(UB).date()
        r = requests.post(f"{BASE}/steps/sync", headers=H1, json={"days": [
            {"local_date": (today + timedelta(days=1)).isoformat(), "steps": 5000},
            {"local_date": (today - timedelta(days=30)).isoformat(), "steps": 5000},
            {"local_date": (today - timedelta(days=3)).isoformat(), "steps": 250000},
        ]})
        # Буруу өдрүүдийг алгасна — 422 буцаавал аппын офлайн дараалал гацна
        assert r.status_code == 200
        d3 = next(x for x in r.json()["week"] if x["local_date"] == (today - timedelta(days=3)).isoformat())
        assert d3["steps"] != 250000

    def test_device_never_lowers(self):
        d = (datetime.now(UB).date() - timedelta(days=4)).isoformat()
        requests.post(f"{BASE}/steps/sync", headers=H1, json={"days": [{"local_date": d, "steps": 7000}]})
        r = requests.post(f"{BASE}/steps/sync", headers=H1, json={"days": [{"local_date": d, "steps": 0}]})
        info = next(x for x in r.json()["week"] if x["local_date"] == d)
        assert info["steps"] >= 7000


class TestLateSyncRecompute:
    """Эцэслэгдсэн өдрийн алхам хожуу ирэхэд жин дахин тооцогдох ёстой."""

    UID = "user_test000003"
    TOK = "test_session_token_alkhaach_3"

    @pytest.fixture(autouse=True, scope="class")
    def seed_user(self):
        from pymongo import MongoClient
        mongo = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "alkhaach")]
        two_days_ago = (datetime.now(UB).date() - timedelta(days=2)).isoformat()
        for coll in ("steps_daily", "weight_daily", "users", "user_sessions"):
            mongo[coll].delete_many({"user_id": self.UID})
        mongo.users.insert_one({
            "user_id": self.UID, "email": f"{self.UID}@test.local", "display_name": "Тест Гурав",
            "daily_goal": 8000, "weight": 50.0, "tz": "Asia/Ulaanbaatar", "streak": 0,
            "onboarded": True, "last_processed_date": two_days_ago,
        })
        mongo.user_sessions.insert_one({
            "session_token": self.TOK, "user_id": self.UID,
            "expires_at": datetime.now(ZoneInfo("UTC")) + timedelta(days=7),
        })
        yield

    def test_evening_steps_recomputed_next_day(self):
        h = {"Authorization": f"Bearer {self.TOK}"}
        # Өчигдрийг 0 алхамаар эцэслэнэ (00:10-ийн tick эсвэл апп нээхтэй адил)
        s0 = requests.get(f"{BASE}/me/summary", headers=h).json()
        assert s0["weight"] == 56.0
        # Орой алхсан 10 000 алхам маргааш өглөө л синк хийгдэв
        y = (datetime.now(UB).date() - timedelta(days=1)).isoformat()
        s1 = requests.post(f"{BASE}/steps/sync", headers=h, json={
            "days": [{"local_date": y, "steps": 10000}]
        }).json()
        assert s1["weight"] == 48.5  # 50 - 1.5
        assert s1["streak"] == 1

    def test_manual_valid(self):
        today_iso = local_today_iso()
        r = requests.post(f"{BASE}/steps/manual", headers=H1, json={
            "local_date": today_iso, "steps": 7500
        })
        assert r.status_code == 200
        s = r.json()
        assert s["today"]["source"] == "manual"
        assert s["today"]["steps"] == 7500

    def test_manual_too_old(self):
        old = (datetime.now(UB).date() - timedelta(days=30)).isoformat()
        r = requests.post(f"{BASE}/steps/manual", headers=H1, json={"local_date": old, "steps": 1000})
        assert r.status_code == 422

    def test_manual_over_200k(self):
        r = requests.post(f"{BASE}/steps/manual", headers=H1, json={
            "local_date": local_today_iso(), "steps": 250000
        })
        assert r.status_code == 422

    def test_summary_shape(self):
        r = requests.get(f"{BASE}/me/summary", headers=H1)
        assert r.status_code == 200
        s = r.json()
        for k in ("today", "yesterday", "week", "weight", "weight_curve", "goal", "streak"):
            assert k in s


# ---------- Groups ----------
class TestGroups:
    grp = {}  # shared state

    def test_create_group(self):
        r = requests.post(f"{BASE}/groups", headers=H1, json={"name": "TEST_бүлэг_pytest"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "group_id" in d and "join_code" in d
        assert len(d["join_code"]) == 6
        forbidden = set("O0I1L")
        assert not (set(d["join_code"]) & forbidden), f"Code {d['join_code']} contains banned chars"
        TestGroups.grp["gid"] = d["group_id"]
        TestGroups.grp["code"] = d["join_code"]

    def test_create_short_name(self):
        r = requests.post(f"{BASE}/groups", headers=H1, json={"name": "A"})
        assert r.status_code == 422

    def test_preview_valid(self):
        code = TestGroups.grp["code"]
        r = requests.get(f"{BASE}/groups/preview/{code}", headers=H2)
        assert r.status_code == 200
        assert r.json()["member_count"] >= 1

    def test_preview_invalid_message_mongolian(self):
        r = requests.get(f"{BASE}/groups/preview/ZZZZZZ", headers=H2)
        assert r.status_code == 404
        assert "Код" in r.json()["detail"]

    def test_join_group(self):
        code = TestGroups.grp["code"]
        r = requests.post(f"{BASE}/groups/join", headers=H2, json={"code": code})
        assert r.status_code == 200
        assert r.json()["group_id"] == TestGroups.grp["gid"]

    def test_group_detail_member(self):
        gid = TestGroups.grp["gid"]
        r = requests.get(f"{BASE}/groups/{gid}", headers=H2)
        assert r.status_code == 200
        d = r.json()
        assert d["is_owner"] is False
        assert d["member_count"] >= 2
        # members list should have weight/today_steps
        for m in d["members"]:
            assert "weight" in m
            assert "today_steps" in m
            assert "flagged" in m

    def test_group_detail_nonmember_403(self):
        # Create a group with H1, don't add H2, then test 403
        r = requests.post(f"{BASE}/groups", headers=H1, json={"name": "TEST_private_grp"})
        assert r.status_code == 200
        gid = r.json()["group_id"]
        r2 = requests.get(f"{BASE}/groups/{gid}", headers=H2)
        assert r2.status_code == 403
        # cleanup
        requests.delete(f"{BASE}/groups/{gid}", headers=H1)

    def test_rotate_code_owner(self):
        gid = TestGroups.grp["gid"]
        old = TestGroups.grp["code"]
        r = requests.post(f"{BASE}/groups/{gid}/code", headers=H1)
        assert r.status_code == 200
        new = r.json()["join_code"]
        assert new != old
        TestGroups.grp["code"] = new
        # old code should be invalid now
        r2 = requests.get(f"{BASE}/groups/preview/{old}", headers=H2)
        assert r2.status_code == 404

    def test_rotate_code_member_403(self):
        gid = TestGroups.grp["gid"]
        r = requests.post(f"{BASE}/groups/{gid}/code", headers=H2)
        assert r.status_code == 403

    def test_remove_owner_409(self):
        gid = TestGroups.grp["gid"]
        r = requests.delete(f"{BASE}/groups/{gid}/members/user_test000001", headers=H1)
        assert r.status_code == 409

    def test_nonowner_cannot_remove_others(self):
        gid = TestGroups.grp["gid"]
        r = requests.delete(f"{BASE}/groups/{gid}/members/user_test000001", headers=H2)
        # H2 is a member; trying to remove owner => target is owner OR non-owner attempts
        # Server checks non-owner first: returns 403
        assert r.status_code == 403

    def test_self_leave(self):
        gid = TestGroups.grp["gid"]
        r = requests.delete(f"{BASE}/groups/{gid}/members/user_test000002", headers=H2)
        assert r.status_code == 200
        # verify no longer member
        r2 = requests.get(f"{BASE}/groups/{gid}", headers=H2)
        assert r2.status_code == 403

    def test_delete_group_nonowner_403(self):
        gid = TestGroups.grp["gid"]
        # rejoin H2
        requests.post(f"{BASE}/groups/join", headers=H2, json={"code": TestGroups.grp["code"]})
        r = requests.delete(f"{BASE}/groups/{gid}", headers=H2)
        assert r.status_code == 403

    def test_delete_group_owner(self):
        gid = TestGroups.grp["gid"]
        r = requests.delete(f"{BASE}/groups/{gid}", headers=H1)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{BASE}/groups/{gid}", headers=H1)
        assert r2.status_code in (403, 404)


class TestRateLimit:
    """Run last since it will lock out H2 for 10 min."""

    def test_join_rate_limit(self):
        # 5 failed attempts trigger 429
        codes_bad = ["ZZZZZ2", "ZZZZZ3", "ZZZZZ4", "ZZZZZ5", "ZZZZZ6", "ZZZZZ7"]
        statuses = []
        for c in codes_bad:
            r = requests.post(f"{BASE}/groups/join", headers=H2, json={"code": c})
            statuses.append(r.status_code)
        # Should see at least one 429 in the last calls
        assert 429 in statuses, f"Expected 429 in {statuses}"
