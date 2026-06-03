import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";
import { Leaf, TreePine, Wallet, Activity } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [tele, setTele] = useState({ series: [], total_kwh: 0, co2_saved_kg: 0, trees_equivalent: 0 });
  const [ledger, setLedger] = useState({ events: [], summary: { balance_kwh: 0, total_earned_kwh: 0, total_applied_kwh: 0, total_donated_kwh: 0 } });
  const [shares, setShares] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, l, s] = await Promise.all([
          api.get("/telemetry/user/me"),
          api.get("/credits/ledger"),
          api.get("/shares/mine"),
        ]);
        setTele(t.data);
        setLedger(l.data);
        setShares(s.data);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const chart = useMemo(() => buildSparkline(tele.series), [tele.series]);

  const cards = [
    { id: "balance", label: "Credit balance", value: ledger.summary.balance_kwh, suffix: " kWh", icon: Wallet },
    { id: "generation", label: "30-day generation", value: tele.total_kwh, suffix: " kWh", icon: Activity },
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
        <Link
          to="/marketplace"
          data-testid="dashboard-cta-marketplace"
          className="text-sm font-medium text-[#183021] underline-offset-4 hover:underline"
        >
          Buy more capacity →
        </Link>
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
              <AnimatedNumber value={c.value} suffix={c.suffix} decimals={c.decimals ?? 0} testId={`dashboard-${c.id}-value`} />
            </div>
          </motion.div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="lg:col-span-2 rounded-2xl border border-[#E7E2D6] bg-white p-6"
          data-testid="dashboard-chart"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Generation</p>
              <h2 className="font-serif-display text-3xl text-[#183021]">30-day kWh stream</h2>
            </div>
            <div className="font-mono-num text-sm text-[#6B7B70]">{tele.series.length} days</div>
          </div>
          <Sparkline data={chart} loaded={loaded} />
        </motion.div>

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

function buildSparkline(series) {
  if (!series?.length) return { points: "", area: "", min: 0, max: 0, w: 600, h: 180, labels: [] };
  const w = 600;
  const h = 180;
  const pad = 10;
  const xs = series.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1));
  const ys = series.map((s) => s.kwh);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = Math.max(max - min, 1);
  const points = ys.map((y, i) => {
    const yy = h - pad - ((y - min) / range) * (h - pad * 2);
    return `${xs[i]},${yy}`;
  });
  const linePath = "M" + points.join(" L");
  const areaPath = `${linePath} L${xs[xs.length - 1]},${h - pad} L${xs[0]},${h - pad} Z`;
  return { line: linePath, area: areaPath, min, max, w, h, count: series.length };
}

function Sparkline({ data, loaded }) {
  if (!loaded) return <div className="h-40 animate-pulse rounded-xl bg-[#F5F3ED]" />;
  if (!data.line) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-[#6B7B70]" data-testid="dashboard-chart-empty">
        Buy a share to see your live generation curve.
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${data.w} ${data.h}`} className="w-full h-44" data-testid="dashboard-svg-chart">
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C25942" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#C25942" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={data.area} fill="url(#grad)" />
      <motion.path
        d={data.line}
        stroke="#183021"
        strokeWidth={1.6}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}
