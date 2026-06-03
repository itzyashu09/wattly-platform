import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";

const RANGES = [
  { id: 7, label: "Week" },
  { id: 30, label: "Month" },
  { id: 90, label: "Quarter" },
];

const METRICS = [
  { id: "inr", label: "₹ Earnings" },
  { id: "kwh", label: "kWh" },
];

export default function EarningsChart() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState("inr");
  const [data, setData] = useState({ series: [], total_inr: 0, total_kwh: 0, avg_daily_inr: 0, days: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoaded(false);
      try {
        const r = await api.get(`/credits/earnings?days=${days}`);
        setData(r.data);
      } finally {
        setLoaded(true);
      }
    })();
  }, [days]);

  const chart = useMemo(() => buildBars(data.series, metric), [data.series, metric]);
  const total = metric === "inr" ? data.total_inr : data.total_kwh;
  const totalPrefix = metric === "inr" ? "₹" : "";
  const totalSuffix = metric === "inr" ? "" : " kWh";

  return (
    <motion.div
      className="rounded-2xl border border-[#E7E2D6] bg-white p-6"
      data-testid="earnings-chart"
    >
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Live credit earnings</p>
          <h2 className="font-serif-display text-3xl text-[#183021] mt-1">
            <AnimatedNumber value={total} prefix={totalPrefix} suffix={totalSuffix} decimals={metric === "inr" ? 0 : 1} testId="earnings-total" />
          </h2>
          <p className="text-xs text-[#6B7B70] mt-1">
            Avg <span className="font-mono-num text-[#183021]">₹{data.avg_daily_inr.toLocaleString("en-IN")}</span>/day over {data.days || days} days
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full bg-[#F5F3ED] border border-[#E7E2D6] p-1 text-xs">
            {METRICS.map((m) => (
              <button
                key={m.id}
                data-testid={`earnings-metric-${m.id}`}
                onClick={() => setMetric(m.id)}
                className="relative px-3 py-1 rounded-full"
              >
                {metric === m.id && (
                  <motion.span layoutId="earnings-metric-pill" className="absolute inset-0 bg-[#183021] rounded-full -z-0"
                    transition={{ type: "spring", stiffness: 300, damping: 26 }} />
                )}
                <span className={`relative z-10 ${metric === m.id ? "text-[#FCFAF8]" : "text-[#183021]"}`}>{m.label}</span>
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full bg-[#F5F3ED] border border-[#E7E2D6] p-1 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.id}
                data-testid={`earnings-range-${r.id}`}
                onClick={() => setDays(r.id)}
                className="relative px-3 py-1 rounded-full"
              >
                {days === r.id && (
                  <motion.span layoutId="earnings-range-pill" className="absolute inset-0 bg-[#C25942] rounded-full -z-0"
                    transition={{ type: "spring", stiffness: 300, damping: 26 }} />
                )}
                <span className={`relative z-10 ${days === r.id ? "text-[#FCFAF8]" : "text-[#183021]"}`}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loaded ? (
        <div className="h-48 animate-pulse rounded-xl bg-[#F5F3ED]" />
      ) : chart.bars.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-[#6B7B70]" data-testid="earnings-empty">
          Buy your first share to start tracking credits.
        </div>
      ) : (
        <BarsChart chart={chart} metric={metric} />
      )}
    </motion.div>
  );
}

function buildBars(series, metric) {
  if (!series?.length) return { bars: [], max: 0, labels: [] };
  const max = Math.max(...series.map((s) => s[metric] || 0), 1);
  return {
    bars: series.map((s) => ({ ...s, height: ((s[metric] || 0) / max) * 100 })),
    max,
  };
}

function BarsChart({ chart, metric }) {
  return (
    <div data-testid="earnings-bars" className="space-y-2">
      <div className="flex items-end gap-[3px] h-48">
        {chart.bars.map((b, i) => (
          <motion.div
            key={b.date}
            initial={{ height: 0 }}
            animate={{ height: `${b.height}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: Math.min(i * 0.01, 0.2) }}
            title={`${b.date}: ₹${b.inr.toLocaleString("en-IN")} · ${b.kwh.toFixed(1)} kWh`}
            className="flex-1 bg-[#2C4A3B] hover:bg-[#C25942] rounded-sm min-w-[3px] transition-colors cursor-pointer"
            data-testid={`earnings-bar-${b.date}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#6B7B70] font-mono-num">
        <span>{chart.bars[0]?.date}</span>
        <span>{chart.bars[chart.bars.length - 1]?.date}</span>
      </div>
    </div>
  );
}
