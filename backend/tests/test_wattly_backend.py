"""WATTLY backend pytest suite covering farms, bill, auth gating, shares, credits, utility."""
import os
import time
import pytest
import requests
import subprocess

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wattly-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --- Fixtures ---

@pytest.fixture(scope="session")
def session_token():
    """Create a test user+session directly in Mongo via mongosh and return the token."""
    ts = int(time.time() * 1000)
    user_id = f"test-user-pytest-{ts}"
    token = f"test_session_pytest_{ts}"
    cmd = f"""
use('test_database');
db.users.insertOne({{user_id: '{user_id}', email: 'test.user.{ts}@example.com', name: 'Test PyUser', picture: null, created_at: new Date().toISOString()}});
db.user_sessions.insertOne({{user_id: '{user_id}', session_token: '{token}', expires_at: new Date(Date.now()+7*24*60*60*1000).toISOString()}});
"""
    subprocess.run(["mongosh", "--quiet", "--eval", cmd], check=True, capture_output=True)
    yield {"token": token, "user_id": user_id}
    # teardown - remove user data
    cleanup = f"""
use('test_database');
db.user_sessions.deleteMany({{user_id: '{user_id}'}});
db.users.deleteMany({{user_id: '{user_id}'}});
db.shares.deleteMany({{user_id: '{user_id}'}});
db.credit_events.deleteMany({{user_id: '{user_id}'}});
db.utility_accounts.deleteMany({{user_id: '{user_id}'}});
"""
    subprocess.run(["mongosh", "--quiet", "--eval", cleanup], capture_output=True)


@pytest.fixture
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token['token']}"}


# --- Health ---

def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# --- Farms ---

class TestFarms:
    def test_list_all_farms_returns_8(self):
        r = requests.get(f"{API}/farms")
        assert r.status_code == 200
        farms = r.json()
        assert isinstance(farms, list)
        assert len(farms) == 8, f"Expected 8 farms, got {len(farms)}"
        # required fields
        for f in farms:
            assert "farm_id" in f and "name" in f and "farm_type" in f
            assert "image_url" in f and "available_kw" in f
            assert "_id" not in f  # mongo _id excluded

    def test_filter_solar_returns_4_with_detail(self):
        r = requests.get(f"{API}/farms?type=solar")
        assert r.status_code == 200
        farms = r.json()
        assert len(farms) == 4
        for f in farms:
            assert f["farm_type"] == "solar"
            assert f.get("solar_detail") is not None
            assert "panel_type" in f["solar_detail"]

    def test_filter_wind_returns_4_with_detail(self):
        r = requests.get(f"{API}/farms?type=wind")
        assert r.status_code == 200
        farms = r.json()
        assert len(farms) == 4
        for f in farms:
            assert f["farm_type"] == "wind"
            assert f.get("wind_detail") is not None
            assert "turbine_model" in f["wind_detail"]

    def test_get_farm_by_id(self):
        farms = requests.get(f"{API}/farms").json()
        fid = farms[0]["farm_id"]
        r = requests.get(f"{API}/farms/{fid}")
        assert r.status_code == 200
        assert r.json()["farm_id"] == fid

    def test_get_farm_not_found(self):
        r = requests.get(f"{API}/farms/does-not-exist")
        assert r.status_code == 404


# --- Bill calc ---

class TestBill:
    def test_bill_calculate_220_with_80_credits(self):
        r = requests.post(f"{API}/bill/calculate", json={"units_consumed": 220, "credit_units_available": 80})
        assert r.status_code == 200
        data = r.json()
        assert "base_bill_inr" in data and "net_bill_inr" in data
        assert "base_breakdown" in data and "net_breakdown" in data
        assert len(data["base_breakdown"]) == 4
        assert len(data["net_breakdown"]) == 4
        assert data["net_bill_inr"] < data["base_bill_inr"]
        assert data["credit_offset_inr"] > 0
        # Verify slab math for base: 50*4.15 + 50*5.6 + 100*7.15 + 20*8.2
        expected = round(50 * 4.15 + 50 * 5.60 + 100 * 7.15 + 20 * 8.20, 2)
        assert abs(data["base_bill_inr"] - expected) < 0.01

    def test_bill_zero_units(self):
        r = requests.post(f"{API}/bill/calculate", json={"units_consumed": 0, "credit_units_available": 0})
        assert r.status_code == 200
        assert r.json()["base_bill_inr"] == 0


# --- Auth gating ---

class TestAuthGating:
    def test_auth_me_without_token_returns_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_shares_mine_unauthenticated(self):
        r = requests.get(f"{API}/shares/mine")
        assert r.status_code == 401

    def test_credits_unauthenticated(self):
        r = requests.get(f"{API}/credits/ledger")
        assert r.status_code == 401

    def test_auth_me_with_valid_token(self, auth_headers, session_token):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == session_token["user_id"]
        assert "email" in data

    def test_auth_me_invalid_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bogus_token_xyz"})
        assert r.status_code == 401


# --- Shares ---

class TestShares:
    def test_shares_mine_empty_for_new_user(self, auth_headers):
        r = requests.get(f"{API}/shares/mine", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) == 0

    def test_purchase_share_and_verify(self, auth_headers):
        farms = requests.get(f"{API}/farms").json()
        farm = farms[0]
        farm_id = farm["farm_id"]
        avail_before = farm["available_kw"]

        r = requests.post(
            f"{API}/shares/purchase",
            headers=auth_headers,
            json={"farm_id": farm_id, "capacity_kw": 5},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["share"]["farm_id"] == farm_id
        assert data["share"]["capacity_kw"] == 5
        assert data["total_inr"] == round(5 * farm["price_per_kw_inr"], 2)

        # Verify farm available_kw decremented
        farm_after = requests.get(f"{API}/farms/{farm_id}").json()
        assert abs(farm_after["available_kw"] - (avail_before - 5)) < 0.01

        # Verify share appears in mine
        mine = requests.get(f"{API}/shares/mine", headers=auth_headers).json()
        assert any(s["farm_id"] == farm_id for s in mine)
        # Enriched with farm info
        s = [x for x in mine if x["farm_id"] == farm_id][0]
        assert "farm" in s and s["farm"]["name"] == farm["name"]

        # Verify credit_event created
        ledger = requests.get(f"{API}/credits/ledger", headers=auth_headers).json()
        assert any(e["farm_id"] == farm_id for e in ledger["events"])

    def test_purchase_invalid_farm(self, auth_headers):
        r = requests.post(
            f"{API}/shares/purchase",
            headers=auth_headers,
            json={"farm_id": "nonexistent", "capacity_kw": 1},
        )
        assert r.status_code == 404

    def test_purchase_invalid_capacity(self, auth_headers):
        farms = requests.get(f"{API}/farms").json()
        r = requests.post(
            f"{API}/shares/purchase",
            headers=auth_headers,
            json={"farm_id": farms[0]["farm_id"], "capacity_kw": 0},
        )
        assert r.status_code == 400


# --- Credits ---

class TestCredits:
    def test_credit_ledger_structure(self, auth_headers):
        r = requests.get(f"{API}/credits/ledger", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "events" in data and isinstance(data["events"], list)
        assert "summary" in data
        for k in ("balance_kwh", "total_earned_kwh", "total_applied_kwh", "total_donated_kwh"):
            assert k in data["summary"]


# --- Utility accounts ---

class TestUtility:
    def test_link_and_get_utility(self, auth_headers):
        payload = {
            "utility_provider": "BESCOM",
            "consumer_number": "TEST_123456",
            "sanctioned_load_kw": 5.0,
            "state": "Karnataka",
        }
        r = requests.post(f"{API}/utility/link", headers=auth_headers, json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["utility_provider"] == "BESCOM"
        assert data["consumer_number"] == "TEST_123456"
        assert "account_id" in data

        r2 = requests.get(f"{API}/utility/me", headers=auth_headers)
        assert r2.status_code == 200
        rows = r2.json()
        assert any(row["consumer_number"] == "TEST_123456" for row in rows)


# --- Telemetry ---

class TestTelemetry:
    def test_telemetry_public(self):
        farms = requests.get(f"{API}/farms").json()
        r = requests.get(f"{API}/telemetry/{farms[0]['farm_id']}?days=30")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) > 0
        assert "kwh_produced" in rows[0] and "date" in rows[0]

    def test_user_telemetry_authenticated(self, auth_headers):
        r = requests.get(f"{API}/telemetry/user/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "series" in data and "total_kwh" in data
        assert "co2_saved_kg" in data and "trees_equivalent" in data
