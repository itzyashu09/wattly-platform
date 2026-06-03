import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

export default function FarmTelemetry() {
  const { farmId } = useParams();
  const [farm, setFarm] = useState(null);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    (async () => {
      const [f, t] = await Promise.all([api.get(`/farms/${farmId}`), api.get(`/telemetry/${farmId}`)]);
      setFarm(f.data);
      setSeries(t.data);
    })();
  }, [farmId]);

  if (!farm) {
    return <div className="font-serif-display text-2xl text-[#183021]" data-testid="telemetry-loading">Loading telemetry…</div>;
  }

  const detail = farm.farm_type === "solar" ? farm.solar_detail : farm.wind_detail;

  return (
    <div className="space-y-10" data-testid="telemetry-page">
      <Link to="/my-shares" className="inline-flex items-center gap-2 text-sm text-[#6B7B70] hover:text-[#183021]">
        <ArrowLeft className="w-4 h-4" /> Back to portfolio
      </Link>
      <header className="grid lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">{farm.farm_type === "solar" ? "Solar park" : "Wind park"}</p>
          <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight leading-[1.05]">{farm.name}</h1>
          <p className="text-[#4A5568] mt-2">{farm.location} · {farm.total_capacity_mw.toLocaleString("en-IN")} MW installed</p>
        </div>
        <div className="rounded-2xl border border-[#E7E2D6] bg-white overflow-hidden">
          <img src={farm.image_url} alt={farm.name} className="w-full h-56 object-cover" />
        </div>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {detail && Object.entries(detail).filter(([k]) => k !== "farm_id").map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-[#E7E2D6] bg-white p-5" data-testid={`telemetry-detail-${k}`}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#6B7B70]">{k.replace(/_/g, " ")}</div>
            <div className="font-serif-display text-2xl text-[#183021] mt-1">{String(v)}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#E7E2D6] bg-white p-6">
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-serif-display text-3xl text-[#183021]">Daily generation · last {series.length}d</h2>
        </div>
        <Bars data={series} />
      </section>
    </div>
  );
}

function Bars({ data }) {
  if (!data?.length) return <div className="h-40 flex items-center justify-center text-[#6B7B70]">No telemetry yet.</div>;
  const max = Math.max(...data.map((d) => d.kwh_produced));
  return (
    <div className="flex items-end gap-[3px] h-44" data-testid="telemetry-bars">
      {data.map((d) => (
        <motion.div
          key={d.date}
          initial={{ height: 0 }}
          animate={{ height: `${(d.kwh_produced / max) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          title={`${d.date}: ${d.kwh_produced.toLocaleString("en-IN")} kWh`}
          className="flex-1 bg-[#2C4A3B] hover:bg-[#C25942] rounded-sm min-w-[4px] transition-colors"
        />
      ))}
    </div>
  );
}
