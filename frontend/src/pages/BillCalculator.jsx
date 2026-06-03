import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";

export default function BillCalculator() {
  const [units, setUnits] = useState(220);
  const [credits, setCredits] = useState(80);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.post("/bill/calculate", { units_consumed: units, credit_units_available: credits });
      setResult(r.data);
    }, 150);
    return () => clearTimeout(t);
  }, [units, credits]);

  const slabs = result?.base_breakdown ?? [];
  const netSlabs = result?.net_breakdown ?? [];

  return (
    <div className="space-y-10" data-testid="bill-calculator-page">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">BESCOM Tariff Simulator</p>
        <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight">What's your real bill?</h1>
        <p className="text-[#4A5568] mt-3 max-w-xl">
          Karnataka residential slabs: 1-50 @₹4.15, 51-100 @₹5.60, 101-200 @₹7.15, 201+ @₹8.20. Apply
          your Wattly credits to see how much you actually pay.
        </p>
      </header>

      <section className="grid lg:grid-cols-2 gap-6">
        <motion.div className="rounded-2xl border border-[#E7E2D6] bg-white p-7 space-y-7" whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <SliderRow label="Monthly consumption" suffix=" kWh" value={units} onChange={setUnits} max={600} testId="bill-units" />
          <SliderRow label="Available credits" suffix=" kWh" value={credits} onChange={setCredits} max={Math.max(600, units)} testId="bill-credits" />
        </motion.div>

        <motion.div className="rounded-2xl border border-[#E7E2D6] bg-white p-7 space-y-4" whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B7B70]">Net bill</p>
              <div className="font-serif-display text-6xl text-[#183021] tracking-tight" data-testid="bill-net">
                <AnimatedNumber value={result?.net_bill_inr ?? 0} prefix="₹" decimals={0} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B7B70]">You saved</p>
              <div className="font-serif-display text-3xl text-[#C25942]" data-testid="bill-saved">
                <AnimatedNumber value={result?.credit_offset_inr ?? 0} prefix="-₹" decimals={0} />
              </div>
            </div>
          </div>
          <div className="text-sm text-[#6B7B70]">
            Base bill before credits: <span className="text-[#183021] font-mono-num">₹{(result?.base_bill_inr ?? 0).toLocaleString("en-IN")}</span>
          </div>
        </motion.div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <Table title="Base breakdown" rows={slabs} testId="base-breakdown" />
        <Table title="With Wattly credits" rows={netSlabs} testId="net-breakdown" highlight />
      </section>
    </div>
  );
}

function SliderRow({ label, value, onChange, max, suffix, testId }) {
  return (
    <div className="space-y-3" data-testid={`${testId}-row`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#4A5568] uppercase tracking-[0.16em]">{label}</span>
        <span className="font-mono-num text-lg text-[#183021] font-medium">
          <AnimatedNumber value={value} suffix={suffix} testId={`${testId}-value`} />
        </span>
      </div>
      <Slider value={[value]} max={max} step={1} onValueChange={(v) => onChange(v[0])} data-testid={`${testId}-slider`} />
    </div>
  );
}

function Table({ title, rows, testId, highlight }) {
  return (
    <div className="rounded-2xl border border-[#E7E2D6] bg-white overflow-hidden" data-testid={testId}>
      <div className="px-6 py-4 border-b border-[#E7E2D6] flex items-center justify-between">
        <h3 className="font-serif-display text-2xl text-[#183021]">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-[#F5F3ED] text-[#6B7B70] uppercase text-xs tracking-[0.16em]">
          <tr>
            <th className="text-left px-6 py-3">Slab</th>
            <th className="text-right px-6 py-3">Units</th>
            <th className="text-right px-6 py-3">Rate</th>
            <th className="text-right px-6 py-3">Amount</th>
          </tr>
        </thead>
        <tbody className="font-mono-num">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#F5F3ED] last:border-0">
              <td className="px-6 py-3 text-[#183021]">{r.slab}</td>
              <td className="px-6 py-3 text-right text-[#4A5568]">{r.units}</td>
              <td className="px-6 py-3 text-right text-[#4A5568]">₹{r.rate}</td>
              <td className={`px-6 py-3 text-right ${highlight ? "text-[#C25942] font-medium" : "text-[#183021]"}`}>
                ₹{r.amount.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
