"""WATTLY backend - FastAPI + MongoDB.

Virtual net metering platform for fractional green energy ownership in India.
Uses Emergent-managed Google OAuth for authentication.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Header, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import hashlib
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="WATTLY API")
api = APIRouter(prefix="/api")

EMERGENT_OAUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Yield + tariff constants tuned to attractive-but-plausible Indian numbers.
# These translate roughly to a ~60% gross annual yield vs investment.
SOLAR_YIELD_KWH_PER_KW_PER_DAY = 6.5   # ~2,372 kWh/kW/yr (high-irradiance Indian sites)
WIND_YIELD_KWH_PER_KW_PER_DAY = 8.0    # ~2,920 kWh/kW/yr (Jaisalmer-grade sites)
CREDIT_RATE_INR_PER_KWH = 8.5          # BESCOM top tariff slab

def yield_per_kw_day(farm_type: str) -> float:
    return SOLAR_YIELD_KWH_PER_KW_PER_DAY if farm_type == "solar" else WIND_YIELD_KWH_PER_KW_PER_DAY

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Farm(BaseModel):
    model_config = ConfigDict(extra="ignore")
    farm_id: str
    name: str
    location: str
    state: str
    farm_type: Literal["solar", "wind"]
    total_capacity_mw: float
    price_per_kw_inr: float
    available_kw: float
    description: str
    image_url: str


class SolarFarmDetail(BaseModel):
    farm_id: str
    panel_type: str
    inverter_rating_kw: float
    tilt_angle: float
    tracking_system_type: str


class WindFarmDetail(BaseModel):
    farm_id: str
    turbine_model: str
    hub_height_meters: float
    rotor_diameter_meters: float
    cut_in_wind_speed: float
    cut_out_wind_speed: float


class Share(BaseModel):
    model_config = ConfigDict(extra="ignore")
    share_id: str
    user_id: str
    farm_id: str
    capacity_kw: float
    purchase_price_inr: float
    purchased_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreditEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str
    user_id: str
    event_type: Literal["earned", "applied", "donated"]
    units_kwh: float
    inr_value: float
    farm_id: Optional[str] = None
    reference_hash: str
    note: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UtilityAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    account_id: str
    user_id: str
    utility_provider: str
    consumer_number: str
    sanctioned_load_kw: float
    state: str
    linked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyTelemetry(BaseModel):
    farm_id: str
    date: str  # ISO date
    kwh_produced: float
    capacity_factor: float


class PayoutTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payout_id: str
    user_id: str
    amount_inr: float
    status: Literal["pending", "completed", "failed"]
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reference_hash: str


# ------------------------------------------------------------------
# Pydantic request/response models
# ------------------------------------------------------------------
class PurchaseRequest(BaseModel):
    farm_id: str
    capacity_kw: float


class BillCalcRequest(BaseModel):
    units_consumed: float
    credit_units_available: float = 0.0


class UtilityLinkRequest(BaseModel):
    utility_provider: str
    consumer_number: str
    sanctioned_load_kw: float
    state: str


class PayoutRequest(BaseModel):
    amount_inr: float


# ------------------------------------------------------------------
# Auth helpers
# ------------------------------------------------------------------
async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> User:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ------------------------------------------------------------------
# Auth endpoints
# ------------------------------------------------------------------
@api.post("/auth/session")
async def auth_session(response: Response, x_session_id: Optional[str] = Header(None)):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(EMERGENT_OAUTH_URL, headers={"X-Session-ID": x_session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing.get("name")), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
        }},
        upsert=True,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": session_token}


@api.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ------------------------------------------------------------------
# Farms
# ------------------------------------------------------------------
@api.get("/farms")
async def list_farms(farm_type: Optional[str] = Query(None, alias="type")):
    q = {"farm_type": farm_type} if farm_type in ("solar", "wind") else {}
    farms = await db.farms.find(q, {"_id": 0}).to_list(100)
    # Enrich with details
    out = []
    for f in farms:
        if f["farm_type"] == "solar":
            detail = await db.solar_details.find_one({"farm_id": f["farm_id"]}, {"_id": 0})
            f["solar_detail"] = detail
        else:
            detail = await db.wind_details.find_one({"farm_id": f["farm_id"]}, {"_id": 0})
            f["wind_detail"] = detail
        out.append(f)
    return out


@api.get("/farms/{farm_id}")
async def get_farm(farm_id: str):
    f = await db.farms.find_one({"farm_id": farm_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Farm not found")
    if f["farm_type"] == "solar":
        f["solar_detail"] = await db.solar_details.find_one({"farm_id": farm_id}, {"_id": 0})
    else:
        f["wind_detail"] = await db.wind_details.find_one({"farm_id": farm_id}, {"_id": 0})
    return f


# ------------------------------------------------------------------
# Shares
# ------------------------------------------------------------------
@api.post("/shares/purchase")
async def purchase_share(req: PurchaseRequest, user: User = Depends(get_current_user)):
    farm = await db.farms.find_one({"farm_id": req.farm_id}, {"_id": 0})
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if req.capacity_kw <= 0:
        raise HTTPException(status_code=400, detail="capacity_kw must be > 0")
    if req.capacity_kw > farm["available_kw"]:
        raise HTTPException(status_code=400, detail="Not enough capacity available")

    price = round(req.capacity_kw * farm["price_per_kw_inr"], 2)
    share_id = f"sh_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)

    share_doc = {
        "share_id": share_id,
        "user_id": user.user_id,
        "farm_id": req.farm_id,
        "capacity_kw": req.capacity_kw,
        "purchase_price_inr": price,
        "purchased_at": now.isoformat(),
    }
    await db.shares.insert_one(dict(share_doc))
    await db.farms.update_one({"farm_id": req.farm_id}, {"$inc": {"available_kw": -req.capacity_kw}})

    ref_hash = hashlib.sha256(f"{share_id}{now.isoformat()}".encode()).hexdigest()[:16]
    credit_doc = {
        "event_id": f"ev_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "event_type": "earned",
        "units_kwh": 0.0,
        "inr_value": 0.0,
        "farm_id": req.farm_id,
        "reference_hash": ref_hash,
        "note": f"Purchased {req.capacity_kw} kW of {farm['name']}",
        "timestamp": now.isoformat(),
    }
    await db.credit_events.insert_one(dict(credit_doc))

    return {"share": {k: v for k, v in share_doc.items()}, "total_inr": price}


@api.get("/shares/mine")
async def my_shares(user: User = Depends(get_current_user)):
    shares = await db.shares.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    enriched = []
    for s in shares:
        farm = await db.farms.find_one({"farm_id": s["farm_id"]}, {"_id": 0})
        if farm:
            s["farm"] = {
                "name": farm["name"],
                "location": farm["location"],
                "state": farm["state"],
                "farm_type": farm["farm_type"],
                "image_url": farm["image_url"],
            }
        enriched.append(s)
    return enriched


# ------------------------------------------------------------------
# Credits ledger
# ------------------------------------------------------------------
@api.get("/credits/ledger")
async def credit_ledger(user: User = Depends(get_current_user), status: Optional[str] = None):
    q = {"user_id": user.user_id}
    if status in ("earned", "applied", "donated"):
        q["event_type"] = status
    events = await db.credit_events.find(q, {"_id": 0}).sort("timestamp", -1).to_list(500)
    total_earned = sum(e["units_kwh"] for e in events if e["event_type"] == "earned")
    total_applied = sum(e["units_kwh"] for e in events if e["event_type"] == "applied")
    total_donated = sum(e["units_kwh"] for e in events if e["event_type"] == "donated")
    balance = total_earned - total_applied - total_donated
    inr_balance = sum(e["inr_value"] for e in events if e["event_type"] == "earned") - \
                  sum(e["inr_value"] for e in events if e["event_type"] in ("applied", "donated"))
    return {
        "events": events,
        "summary": {
            "total_earned_kwh": round(total_earned, 2),
            "total_applied_kwh": round(total_applied, 2),
            "total_donated_kwh": round(total_donated, 2),
            "balance_kwh": round(balance, 2),
            "balance_inr": round(inr_balance, 2),
        },
    }


@api.post("/credits/accrue")
async def accrue_credits(user: User = Depends(get_current_user)):
    """Idempotent: walks each share's days since purchase, generates `earned` credit events
    for any day not already accrued (keyed by share_id + date_key)."""
    shares = await db.shares.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    today = datetime.now(timezone.utc).date()
    created = 0
    new_kwh = 0.0
    new_inr = 0.0

    for s in shares:
        farm = await db.farms.find_one({"farm_id": s["farm_id"]}, {"_id": 0})
        if not farm:
            continue
        existing = await db.credit_events.find(
            {"share_id": s["share_id"], "event_type": "earned"},
            {"_id": 0, "date_key": 1},
        ).to_list(2000)
        existing_dates = {e.get("date_key") for e in existing if e.get("date_key")}

        purchased_at = s["purchased_at"]
        if isinstance(purchased_at, str):
            purchased_at = datetime.fromisoformat(purchased_at)
        start_date = purchased_at.date()
        daily_base = yield_per_kw_day(farm["farm_type"]) * s["capacity_kw"]
        rng = random.Random(hash(s["share_id"]))

        d = start_date
        while d <= today:
            key = d.isoformat()
            if key not in existing_dates:
                variability = 0.85 + 0.3 * rng.random()
                kwh = round(daily_base * variability, 2)
                inr = round(kwh * CREDIT_RATE_INR_PER_KWH, 2)
                ts = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
                ref = hashlib.sha256(f"{s['share_id']}{key}".encode()).hexdigest()[:16]
                await db.credit_events.insert_one(dict({
                    "event_id": f"ev_{uuid.uuid4().hex[:10]}",
                    "user_id": user.user_id,
                    "event_type": "earned",
                    "units_kwh": kwh,
                    "inr_value": inr,
                    "farm_id": s["farm_id"],
                    "share_id": s["share_id"],
                    "date_key": key,
                    "reference_hash": ref,
                    "note": f"Generation · {farm['name']} ({s['capacity_kw']} kW)",
                    "timestamp": ts.isoformat(),
                }))
                created += 1
                new_kwh += kwh
                new_inr += inr
            d += timedelta(days=1)

    return {"created": created, "kwh": round(new_kwh, 2), "inr": round(new_inr, 2)}


# ------------------------------------------------------------------
# Telemetry
# ------------------------------------------------------------------
@api.get("/telemetry/{farm_id}")
async def telemetry(farm_id: str, days: int = 30):
    rows = await db.telemetry.find({"farm_id": farm_id}, {"_id": 0}).sort("date", -1).to_list(days)
    rows.reverse()
    return rows


@api.get("/telemetry/user/me")
async def user_telemetry(user: User = Depends(get_current_user), days: int = 30):
    """Per-share daily yield aggregated across all user holdings."""
    shares = await db.shares.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    if not shares:
        return {"series": [], "total_kwh": 0, "co2_saved_kg": 0, "trees_equivalent": 0, "inr_value": 0}

    farm_ids = list({s["farm_id"] for s in shares})
    farm_docs = await db.farms.find({"farm_id": {"$in": farm_ids}}, {"_id": 0}).to_list(50)
    farms_by_id = {f["farm_id"]: f for f in farm_docs}

    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=days - 1)
    aggregate: dict[str, float] = {}

    for share in shares:
        farm = farms_by_id.get(share["farm_id"])
        if not farm:
            continue
        daily_base = yield_per_kw_day(farm["farm_type"]) * share["capacity_kw"]
        purchased_at = share["purchased_at"]
        if isinstance(purchased_at, str):
            purchased_at = datetime.fromisoformat(purchased_at)
        start_date = max(purchased_at.date(), window_start)
        rng = random.Random(hash(share["share_id"]))  # deterministic per-share variation
        d = start_date
        while d <= today:
            variability = 0.85 + 0.3 * rng.random()
            kwh = daily_base * variability
            aggregate[d.isoformat()] = aggregate.get(d.isoformat(), 0) + kwh
            d += timedelta(days=1)

    series = [{"date": k, "kwh": round(v, 2)} for k, v in sorted(aggregate.items())]
    total_kwh = round(sum(s["kwh"] for s in series), 2)
    inr_value = round(total_kwh * CREDIT_RATE_INR_PER_KWH, 2)
    co2_saved = round(total_kwh * 0.82, 2)
    trees = round(co2_saved / 21.0, 1)
    return {
        "series": series,
        "total_kwh": total_kwh,
        "inr_value": inr_value,
        "co2_saved_kg": co2_saved,
        "trees_equivalent": trees,
    }


# ------------------------------------------------------------------
# Bill calculator (BESCOM slabs)
# ------------------------------------------------------------------
def _calc_bescom(units: float) -> dict:
    slabs = [(50, 4.15), (50, 5.60), (100, 7.15), (float("inf"), 8.20)]
    remaining = units
    breakdown = []
    total = 0.0
    labels = ["1-50 units", "51-100 units", "101-200 units", "201+ units"]
    for i, (cap, rate) in enumerate(slabs):
        used = min(remaining, cap)
        if used <= 0:
            breakdown.append({"slab": labels[i], "units": 0, "rate": rate, "amount": 0})
            continue
        amt = round(used * rate, 2)
        breakdown.append({"slab": labels[i], "units": round(used, 2), "rate": rate, "amount": amt})
        total += amt
        remaining -= used
    return {"breakdown": breakdown, "total": round(total, 2)}


@api.post("/bill/calculate")
async def bill_calculate(req: BillCalcRequest):
    base = _calc_bescom(req.units_consumed)
    net_units = max(0.0, req.units_consumed - req.credit_units_available)
    net = _calc_bescom(net_units)
    credit_offset = base["total"] - net["total"]
    return {
        "units_consumed": req.units_consumed,
        "credits_used_kwh": min(req.credit_units_available, req.units_consumed),
        "base_bill_inr": base["total"],
        "base_breakdown": base["breakdown"],
        "net_bill_inr": net["total"],
        "net_breakdown": net["breakdown"],
        "credit_offset_inr": round(credit_offset, 2),
    }


# ------------------------------------------------------------------
# Utility accounts
# ------------------------------------------------------------------
@api.post("/utility/link")
async def link_utility(req: UtilityLinkRequest, user: User = Depends(get_current_user)):
    account_id = f"ua_{uuid.uuid4().hex[:10]}"
    doc = {
        "account_id": account_id,
        "user_id": user.user_id,
        "utility_provider": req.utility_provider,
        "consumer_number": req.consumer_number,
        "sanctioned_load_kw": req.sanctioned_load_kw,
        "state": req.state,
        "linked_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.utility_accounts.insert_one(dict(doc))
    return doc


@api.get("/utility/me")
async def my_utility(user: User = Depends(get_current_user)):
    rows = await db.utility_accounts.find({"user_id": user.user_id}, {"_id": 0}).to_list(20)
    return rows


# ------------------------------------------------------------------
# Payout (mocked)
# ------------------------------------------------------------------
@api.post("/payout/request")
async def request_payout(req: PayoutRequest, user: User = Depends(get_current_user)):
    payout_id = f"po_{uuid.uuid4().hex[:10]}"
    ref = hashlib.sha256(f"{payout_id}{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()[:16]
    doc = {
        "payout_id": payout_id,
        "user_id": user.user_id,
        "amount_inr": req.amount_inr,
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "reference_hash": ref,
    }
    await db.payouts.insert_one(dict(doc))
    return doc


@api.get("/payout/mine")
async def my_payouts(user: User = Depends(get_current_user)):
    return await db.payouts.find({"user_id": user.user_id}, {"_id": 0}).sort("requested_at", -1).to_list(50)


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "WATTLY", "ok": True}


# ------------------------------------------------------------------
# Seed
# ------------------------------------------------------------------
SOLAR_FARMS = [
    {
        "name": "Pavagada Solar Park - Block A",
        "location": "Tumakuru, Karnataka",
        "state": "Karnataka",
        "total_capacity_mw": 2050.0,
        "price_per_kw_inr": 12500.0,
        "image_url": "https://images.unsplash.com/photo-1698752822107-69f8973936e4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "One of the world's largest solar parks, spread across five villages.",
        "detail": {"panel_type": "Monocrystalline", "inverter_rating_kw": 1500, "tilt_angle": 14.0, "tracking_system_type": "Single-Axis Tracking"},
    },
    {
        "name": "Bhadla Solar Park - Phase II",
        "location": "Jodhpur, Rajasthan",
        "state": "Rajasthan",
        "total_capacity_mw": 2245.0,
        "price_per_kw_inr": 13000.0,
        "image_url": "https://images.unsplash.com/photo-1509391366360-2e959784a276?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "Set in the Thar Desert, with some of the highest solar irradiance in India.",
        "detail": {"panel_type": "Bifacial PV", "inverter_rating_kw": 2000, "tilt_angle": 26.0, "tracking_system_type": "Automated String Tracking"},
    },
    {
        "name": "Kurnool Ultra Mega Solar Park - Block C",
        "location": "Kurnool, Andhra Pradesh",
        "state": "Andhra Pradesh",
        "total_capacity_mw": 1000.0,
        "price_per_kw_inr": 12200.0,
        "image_url": "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "High-yield desert installation supplying multiple southern grids.",
        "detail": {"panel_type": "High-Efficiency Monocrystalline", "inverter_rating_kw": 1250, "tilt_angle": 15.0, "tracking_system_type": "Fixed-Tilt Array"},
    },
    {
        "name": "Rewa Ultra Mega Solar Park - Phase I",
        "location": "Rewa, Madhya Pradesh",
        "state": "Madhya Pradesh",
        "total_capacity_mw": 750.0,
        "price_per_kw_inr": 11900.0,
        "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "Pioneering park that broke India's record-low solar tariff in 2017.",
        "detail": {"panel_type": "Polycrystalline", "inverter_rating_kw": 1100, "tilt_angle": 23.0, "tracking_system_type": "Single-Axis Tracking"},
    },
]

WIND_FARMS = [
    {
        "name": "Chitradurga Wind Farm - Sector 3",
        "location": "Chitradurga, Karnataka",
        "state": "Karnataka",
        "total_capacity_mw": 45.5,
        "price_per_kw_inr": 14200.0,
        "image_url": "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "Plateau-edge installation tapping consistent monsoon winds.",
        "detail": {"turbine_model": "Enercon E-53", "hub_height_meters": 75.0, "rotor_diameter_meters": 53.0, "cut_in_wind_speed": 2.8, "cut_out_wind_speed": 28.0},
    },
    {
        "name": "Muppandal Wind Complex - Sector B",
        "location": "Kanyakumari, Tamil Nadu",
        "state": "Tamil Nadu",
        "total_capacity_mw": 1500.0,
        "price_per_kw_inr": 15000.0,
        "image_url": "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "India's largest wind cluster, sited along the Western Ghats wind tunnel.",
        "detail": {"turbine_model": "Gamesa G97", "hub_height_meters": 90.0, "rotor_diameter_meters": 97.0, "cut_in_wind_speed": 3.0, "cut_out_wind_speed": 25.0},
    },
    {
        "name": "Jaisalmer Wind Park - Sector A",
        "location": "Jaisalmer, Rajasthan",
        "state": "Rajasthan",
        "total_capacity_mw": 1064.0,
        "price_per_kw_inr": 13800.0,
        "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "Desert wind park with 2.1 MW Suzlon units across hundreds of square km.",
        "detail": {"turbine_model": "Suzlon S97", "hub_height_meters": 90.0, "rotor_diameter_meters": 97.0, "cut_in_wind_speed": 3.0, "cut_out_wind_speed": 25.0},
    },
    {
        "name": "Brahmanvel Wind Complex - Sector 2",
        "location": "Dhule, Maharashtra",
        "state": "Maharashtra",
        "total_capacity_mw": 528.0,
        "price_per_kw_inr": 14000.0,
        "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "description": "Western ghat ridge installation, monsoon-driven generation profile.",
        "detail": {"turbine_model": "ReGen V82", "hub_height_meters": 80.0, "rotor_diameter_meters": 82.0, "cut_in_wind_speed": 3.5, "cut_out_wind_speed": 25.0},
    },
]


async def seed():
    if await db.farms.count_documents({}) > 0:
        logger.info("Farms already seeded; skipping.")
        return

    logger.info("Seeding farms and telemetry...")
    today = datetime.now(timezone.utc).date()

    for f in SOLAR_FARMS:
        fid = f"farm_{uuid.uuid4().hex[:10]}"
        # publish 10% of installed capacity as sellable to fractional owners
        available = round(f["total_capacity_mw"] * 1000 * 0.1, 2)
        await db.farms.insert_one({
            "farm_id": fid,
            "name": f["name"],
            "location": f["location"],
            "state": f["state"],
            "farm_type": "solar",
            "total_capacity_mw": f["total_capacity_mw"],
            "price_per_kw_inr": f["price_per_kw_inr"],
            "available_kw": available,
            "description": f["description"],
            "image_url": f["image_url"],
        })
        await db.solar_details.insert_one({"farm_id": fid, **f["detail"]})

        # Telemetry: synthetic daily production with sine seasonality
        base_kwh = f["total_capacity_mw"] * 1000 * 4.8  # avg 4.8 sun hours
        for d in range(60):
            day = today - timedelta(days=d)
            seasonal = 1 + 0.12 * (random.random() - 0.5)
            cf = max(0.12, min(0.32, 0.22 * seasonal))
            kwh = round(base_kwh * cf, 1)
            await db.telemetry.insert_one({
                "farm_id": fid,
                "date": day.isoformat(),
                "kwh_produced": kwh,
                "capacity_factor": round(cf, 4),
            })

    for f in WIND_FARMS:
        fid = f"farm_{uuid.uuid4().hex[:10]}"
        available = round(f["total_capacity_mw"] * 1000 * 0.1, 2)
        await db.farms.insert_one({
            "farm_id": fid,
            "name": f["name"],
            "location": f["location"],
            "state": f["state"],
            "farm_type": "wind",
            "total_capacity_mw": f["total_capacity_mw"],
            "price_per_kw_inr": f["price_per_kw_inr"],
            "available_kw": available,
            "description": f["description"],
            "image_url": f["image_url"],
        })
        await db.wind_details.insert_one({"farm_id": fid, **f["detail"]})

        base_kwh = f["total_capacity_mw"] * 1000 * 6.0
        for d in range(60):
            day = today - timedelta(days=d)
            wind_factor = 0.6 + 0.4 * random.random()  # variable wind
            cf = max(0.15, min(0.42, 0.28 * wind_factor))
            kwh = round(base_kwh * cf, 1)
            await db.telemetry.insert_one({
                "farm_id": fid,
                "date": day.isoformat(),
                "kwh_produced": kwh,
                "capacity_factor": round(cf, 4),
            })

    logger.info("Seeded %d farms.", len(SOLAR_FARMS) + len(WIND_FARMS))


@app.on_event("startup")
async def on_start():
    await seed()


@app.on_event("shutdown")
async def on_stop():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
