import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";
import EarningsChart from "@/components/wattly/EarningsChart";
import { Button } from "@/components/ui/button";
import { Leaf, TreePine, Wallet, Activity, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [tele, setTele] = useState({ series: [], total_kwh: 0, co2_saved_kg: 0, trees_equivalent: 0, inr_value: 0 });
  const [ledger, setLedger] = useState({ events: [], summary: { balance_kwh: 0, balance_inr: 0, total_earned_kwh: 0, total_applied_kwh: 0, total_donated_kwh: 0 } });
  const [shares, setShares] = useState([]);
  const [, setLoaded] = useState(false);
  const [accruing, setAccruing] = useState(false);

  const loadAll = async () => {
    const [t, l, s] = await Promise.all([
      api.get("/telemetry/user/me"),
      api.get("/credits/ledger"),
      api.get("/shares/mine"),
    ]);
    setTele(t.data);
    setLedger(l.data);
    setShares(s.data);
  };

  useEffect(() => {
    (async () => {
      try {
        // Auto-accrue credits on dashboard load (idempotent per share+date)
        await api.post("/credits/accrue").catch(() => {});
        await loadAll();
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const accrueNow = async () => {
    setAccruing(true);
    try {
      const r = await api.post("/credits/accrue");
      await loadAll();
      if (r.data.created > 0) {
        toast.success(`+${r.data.kwh.toLocaleString("en-IN")} kWh credited (₹${r.data.inr.toLocaleString("en-IN")})`);
      } else {
        toast.info("Ledger already up to date");
      }
    } finally {
      setAccruing(false);
    }
  };

  const cards = [
    { id: "balance-inr", label: "Credit value", value: ledger.summary.balance_inr ?? 0, prefix: "₹", icon: Wallet },
    { id: "balance", label: "Credit balance", value: ledger.summary.balance_kwh, suffix: " kWh", icon: Activity },
    { id: "co2", label: "CO₂ avoided (30d)", value: tele.co2_saved_kg, suffix: " kg", icon: Leaf },
    { id: "trees", label: "Trees equivalent", value: tele.trees_equivalent, suffix: "", icon: TreePine, decimals: 1 },
  ];

  return (
    <div className="space-y-12" data-testid="dashboard-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Command center</p>
          <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight">Your green grid</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={accrueNow}
            disabled={accruing}
            data-testid="accrue-credits-btn"
            className="text-[#183021] hover:bg-[#F5F3ED] rounded-full"
          >
            <RefreshCcw className={`w-4 h-4 mr-1 ${accruing ? "animate-spin" : ""}`} />
            {accruing ? "Updating…" : "Sync credits"}
          </Button>
          <Link
            to="/marketplace"
            data-testid="dashboard-cta-marketplace"
            className="text-sm font-medium text-[#183021] underline-offset-4 hover:underline"
          >
            Buy more capacity →
          </Link>
        </div>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="rounded-2xl border border-[#E7E2D6] bg-white p-6"
            data-testid={`dashboard-card-${c.id}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-[#6B7B70]">{c.label}</span>
              <c.icon className="w-4 h-4 text-[#C25942]" />
            </div>
            <div className="font-serif-display text-5xl text-[#183021] mt-3 tracking-tight">
              <AnimatedNumber value={c.value} prefix={c.prefix ?? ""} suffix={c.suffix ?? ""} decimals={c.decimals ?? 0} testId={`dashboard-${c.id}-value`} />
            </div>
          </motion.div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <EarningsChart />
        </div>

        <div className="rounded-2xl border border-[#E7E2D6] bg-white p-6 space-y-4" data-testid="dashboard-shares">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-2xl text-[#183021]">Active holdings</h3>
            <Link to="/my-shares" className="text-sm text-[#C25942] hover:underline">All →</Link>
          </div>
          {shares.length === 0 ? (
            <p className="text-sm text-[#6B7B70]">No shares yet. <Link to="/marketplace" className="underline">Buy one</Link>.</p>
          ) : (
            <ul className="space-y-3">
              {shares.slice(0, 4).map((s) => (
                <li key={s.share_id} className="flex items-center justify-between border-b border-[#F5F3ED] pb-2 last:border-0" data-testid={`dash-share-${s.share_id}`}>
                  <div>
                    <div className="text-[#183021] font-medium text-sm">{s.farm?.name}</div>
                    <div className="text-xs text-[#6B7B70]">{s.farm?.location}</div>
                  </div>
                  <div className="font-mono-num text-sm text-[#183021]">{s.capacity_kw} kW</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
