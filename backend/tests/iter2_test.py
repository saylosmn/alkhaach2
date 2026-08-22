"""Iteration 2 additions: privacy endpoint, push registration, scheduler safety,
plus quick regression on core APIs from iter 1."""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000") + "/api"
TOK1 = "test_session_token_alkhaach_1"
TOK2 = "test_session_token_alkhaach_2"
H1 = {"Authorization": f"Bearer {TOK1}"}
H2 = {"Authorization": f"Bearer {TOK2}"}
UB = ZoneInfo("Asia/Ulaanbaatar")


# ---------- NEW: privacy ----------
class TestPrivacy:
    def test_privacy_returns_200_html_no_auth(self):
        r = requests.get(f"{BASE}/privacy")
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "html" in ctype.lower()
        body = r.text
        assert "АЛХААЧ" in body
        assert "Нууцлалын бодлого" in body
        # 8 numbered sections
        for i in range(1, 9):
            assert f"<h2>{i}." in body, f"section {i} missing"


# ---------- NEW: push register ----------
class TestPush:
    def test_register_push_returns_500_with_placeholder_key(self):
        r = requests.post(f"{BASE}/register-push", json={
            "user_id": "user_test000001",
            "platform": "android",
            "device_token": "ExponentPushToken[TESTfake]"
        })
        # Placeholder key => upstream 401 => our handler raises 500 with specific detail.
        assert r.status_code == 500, f"expected 500, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "EMERGENT_PUSH_KEY" in detail

    def test_register_push_validates_body(self):
        r = requests.post(f"{BASE}/register-push", json={"user_id": "x"})
        assert r.status_code == 422


# ---------- REGRESSION ----------
class TestRegression:
    def test_auth_me(self):
        r = requests.get(f"{BASE}/auth/me", headers=H1)
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == "user_test000001"
        # new fields still present
        assert "notif_morning" in u and "notif_evening" in u

    def test_steps_sync(self):
        today = datetime.now(UB).date()
        r = requests.post(f"{BASE}/steps/sync", headers=H1, json={
            "tz": "Asia/Ulaanbaatar",
            "days": [{"local_date": today.isoformat(), "steps": 5500, "source": "device"}]
        })
        assert r.status_code == 200
        s = r.json()
        assert s["today"]["local_date"] == today.isoformat()

    def test_me_summary(self):
        r = requests.get(f"{BASE}/me/summary", headers=H1)
        assert r.status_code == 200
        s = r.json()
        for k in ("today", "yesterday", "week", "weight", "streak", "goal"):
            assert k in s

    def test_groups_create_403_join(self):
        # create
        r = requests.post(f"{BASE}/groups", headers=H1, json={"name": "TEST_iter2_grp"})
        assert r.status_code == 200
        gid = r.json()["group_id"]
        code = r.json()["join_code"]
        try:
            # 403 for non-member
            r2 = requests.get(f"{BASE}/groups/{gid}", headers=H2)
            assert r2.status_code == 403
            # join
            r3 = requests.post(f"{BASE}/groups/join", headers=H2, json={"code": code})
            assert r3.status_code == 200
            assert r3.json()["group_id"] == gid
            # now accessible
            r4 = requests.get(f"{BASE}/groups/{gid}", headers=H2)
            assert r4.status_code == 200
        finally:
            requests.delete(f"{BASE}/groups/{gid}", headers=H1)


# ---------- Profile notification persistence ----------
class TestNotifTogglePersist:
    def test_toggle_off_then_on_persists(self):
        # off
        r = requests.patch(f"{BASE}/me", headers=H1, json={"notif_morning": False, "notif_evening": False})
        assert r.status_code == 200
        u = r.json()
        assert u["notif_morning"] is False
        assert u["notif_evening"] is False
        # reload
        r2 = requests.get(f"{BASE}/auth/me", headers=H1)
        assert r2.json()["notif_morning"] is False
        assert r2.json()["notif_evening"] is False
        # restore on
        r3 = requests.patch(f"{BASE}/me", headers=H1, json={"notif_morning": True, "notif_evening": True})
        assert r3.status_code == 200
        assert r3.json()["notif_morning"] is True
