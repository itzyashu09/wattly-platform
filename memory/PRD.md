# Wattly — PRD

## Original problem statement
Build a high-fidelity production web app called **Wattly** — a Virtual Net Metering platform for fractional green energy ownership in India. Premium light theme, Google Sign-in, full marketplace + dashboard + tariff calculator + ledger + portfolio. Originally specified PostgreSQL + SQLAlchemy + Supabase; user opted to adapt to MongoDB.

## User personas
- **Eco-conscious urban household** (Bengaluru / Chennai / Pune): wants to offset their electricity bill by buying small kW slices of operating Indian solar / wind farms.
- **Small business owner**: wants visibility into credits, payouts, and ROI; needs an audited ledger.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + Shadcn UI + `react-router-dom`. Fonts: Cormorant Garamond (serif display) + Outfit (sans). Light theme tokens defined in `/app/frontend/src/index.css`.
- **Backend**: FastAPI + Motor (MongoDB async driver). Single-file server at `/app/backend/server.py`. Idempotent seed on startup for 8 Indian farms + 60d telemetry.
- **Auth**: Emergent-managed Google OAuth → `/api/auth/session` endpoint exchanges `X-Session-ID` for a `session_token` httpOnly cookie (7-day expiry).
- **Database collections**: `users`, `user_sessions`, `farms`, `solar_details`, `wind_details`, `shares`, `credit_events`, `utility_accounts`, `telemetry`, `payouts`.

## Implemented (2026-02)
- Landing page with hero, ROI slider (animated counters), value cards, CTA.
- Marketplace with filterable solar/wind grid, tech badges, purchase dialog.
- Bill calculator with debounced BESCOM tariff slabs.
- Dashboard with 4 KPI cards + animated SVG generation curve.
- Credits ledger with summary + sortable table + filter pills.
- My Shares (portfolio) with linked utility accounts dialog.
- Farm telemetry detail page with animated bar chart.
- Backend: 12+ API endpoints, 21/21 backend pytest tests pass, ObjectId-mutation safety patched.
- Mocked: `POST /api/payout/request` (bank payout simulation).

## Backlog (post-MVP)
- **P0**: Real authenticated state on Marketplace "Buy" CTA (currently dialog opens even when unauthenticated — should redirect to OAuth immediately).
- **P1**: Daily cron / endpoint to convert telemetry into actual `credit_events` (earned) per user share, so the ledger fills up automatically over time.
- **P1**: Apply credit flow (consume balance against simulated bill).
- **P1**: Payout flow UI on `/credits` (request INR payout for balance).
- **P2**: Real BESCOM API integration / Razorpay payout rails.
- **P2**: Email digest of generation + savings.
- **P2**: Admin panel to monitor seed data.

## Next tasks
- Add a payout dialog on Credits page.
- Add a scheduled credit-accrual endpoint + a "Generate credits" manual button on Dashboard for demo purposes.
