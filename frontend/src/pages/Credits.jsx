import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "applied", label: "Applied" },
  { id: "donated", label: "Donated" },
];

export default function Credits() {
  const [data, setData] = useState({ events: [], summary: { balance_kwh: 0, total_earned_kwh: 0, total_applied_kwh: 0, total_donated_kwh: 0 } });
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "timestamp", dir: "desc" });

  useEffect(() => {
    (async () => {
      const r = await api.get("/credits/ledger");
      setData(r.data);
    })();
  }, []);

  const rows = useMemo(() => {
    let r = data.events.slice();
    if (filter !== "all") r = r.filter((e) => e.event_type === filter);
    r.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [data.events, filter, sort]);

  return (
    <div className="space-y-10" data-testid="credits-page">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Credits ledger</p>
        <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight">Audited credit history</h1>
      </header>

      <section className="grid md:grid-cols-4 gap-5">
        {[
          { id: "balance", label: "Balance", value: data.summary.balance_kwh },
          { id: "earned", label: "Earned", value: data.summary.total_earned_kwh },
          { id: "applied", label: "Applied", value: data.summary.total_applied_kwh },
          { id: "donated", label: "Donated", value: data.summary.total_donated_kwh },
        ].map((s) => (
          <motion.div key={s.id} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="rounded-2xl border border-[#E7E2D6] bg-white p-6" data-testid={`credits-summary-${s.id}`}>
            <div className="text-xs uppercase tracking-[0.18em] text-[#6B7B70]">{s.label}</div>
            <div className="font-serif-display text-4xl text-[#183021] mt-2">
              <AnimatedNumber value={s.value} suffix=" kWh" decimals={1} />
            </div>
          </motion.div>
        ))}
      </section>

      <div className="inline-flex rounded-full bg-[#F5F3ED] border border-[#E7E2D6] p-1 text-sm relative">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`credit-filter-${f.id}`}
            className="relative px-4 py-1.5 rounded-full"
          >
            {filter === f.id && (
              <motion.span layoutId="credit-pill" className="absolute inset-0 bg-[#183021] rounded-full -z-0"
                transition={{ type: "spring", stiffness: 300, damping: 26 }} />
            )}
            <span className={`relative z-10 ${filter === f.id ? "text-[#FCFAF8]" : "text-[#183021]"}`}>{f.label}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[#E7E2D6] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F3ED] text-[#6B7B70] uppercase text-xs tracking-[0.16em]">
            <tr>
              <Th k="timestamp" sort={sort} setSort={setSort}>Date</Th>
              <Th k="event_type" sort={sort} setSort={setSort}>Type</Th>
              <Th k="units_kwh" sort={sort} setSort={setSort} align="right">Units</Th>
              <Th k="inr_value" sort={sort} setSort={setSort} align="right">Value</Th>
              <th className="text-left px-6 py-3">Reference</th>
              <th className="text-left px-6 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="font-mono-num">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[#6B7B70]" data-testid="credits-empty">
                  No credit events yet. Buy a share to start earning.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.event_id} className="border-b border-[#F5F3ED] last:border-0" data-testid={`credit-row-${e.event_id}`}>
                <td className="px-6 py-3 text-[#4A5568]">{new Date(e.timestamp).toLocaleDateString("en-IN")}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs uppercase tracking-[0.14em] ${badgeClass(e.event_type)}`}>
                    {e.event_type}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-[#183021]">{e.units_kwh.toFixed(1)}</td>
                <td className="px-6 py-3 text-right text-[#183021]">₹{e.inr_value.toLocaleString("en-IN")}</td>
                <td className="px-6 py-3 text-[#6B7B70] text-xs">{e.reference_hash}</td>
                <td className="px-6 py-3 text-[#4A5568]">{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ k, sort, setSort, children, align = "left" }) {
  const active = sort.key === k;
  return (
    <th
      className={`px-6 py-3 cursor-pointer text-${align} select-none`}
      onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
      data-testid={`credit-sort-${k}`}
    >
      <span className={active ? "text-[#183021]" : ""}>{children}{active ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}</span>
    </th>
  );
}

function badgeClass(t) {
  if (t === "earned") return "bg-[#D1DCD3] text-[#2C4A3B]";
  if (t === "applied") return "bg-[#F5E2DC] text-[#C25942]";
  return "bg-[#F5F3ED] text-[#183021]";
}
