import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";
import { Sun, Wind, Plug, Activity } from "lucide-react";

export default function MyShares() {
  const [shares, setShares] = useState([]);
  const [utilities, setUtilities] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ utility_provider: "BESCOM", consumer_number: "", sanctioned_load_kw: 5, state: "Karnataka" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, u] = await Promise.all([api.get("/shares/mine"), api.get("/utility/me")]);
      setShares(s.data);
      setUtilities(u.data);
      setLoaded(true);
    })();
  }, []);

  const totalKw = shares.reduce((a, b) => a + b.capacity_kw, 0);
  const totalInvested = shares.reduce((a, b) => a + b.purchase_price_inr, 0);

  const linkUtility = async () => {
    try {
      const r = await api.post("/utility/link", form);
      setUtilities([...utilities, r.data]);
      toast.success("Utility account linked");
      setOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not link utility");
    }
  };

  return (
    <div className="space-y-10" data-testid="my-shares-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Portfolio</p>
          <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight">Your green holdings</h1>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="link-utility-button" className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full">
          <Plug className="w-4 h-4 mr-1" /> Link utility account
        </Button>
      </header>

      <section className="grid md:grid-cols-3 gap-5">
        <Stat label="Holdings" value={shares.length} testId="stat-holdings" decimals={0} />
        <Stat label="Total capacity" value={totalKw} suffix=" kW" testId="stat-kw" decimals={1} />
        <Stat label="Capital deployed" value={totalInvested} prefix="₹" testId="stat-inr" decimals={0} />
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3" data-testid="shares-list">
          {!loaded && (
            <div className="h-40 rounded-2xl animate-pulse bg-[#F5F3ED]" />
          )}
          {loaded && shares.length === 0 && (
            <div className="rounded-2xl border border-[#E7E2D6] bg-white p-10 text-center" data-testid="shares-empty">
              <p className="text-[#4A5568]">No holdings yet.</p>
              <Link to="/marketplace" className="inline-block mt-3 text-[#C25942] underline">Visit the marketplace →</Link>
            </div>
          )}
          {shares.map((s) => (
            <motion.div
              key={s.share_id}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-2xl border border-[#E7E2D6] bg-white p-5 flex items-center gap-5"
              data-testid={`share-${s.share_id}`}
            >
              <img src={s.farm?.image_url} alt={s.farm?.name} className="w-28 h-20 object-cover rounded-xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-[#6B7B70] uppercase tracking-[0.16em]">
                  {s.farm?.farm_type === "solar" ? <Sun className="w-3 h-3" /> : <Wind className="w-3 h-3" />}
                  {s.farm?.farm_type}
                </div>
                <div className="font-serif-display text-2xl text-[#183021] leading-tight">{s.farm?.name}</div>
                <div className="text-xs text-[#6B7B70]">{s.farm?.location}</div>
              </div>
              <div className="text-right">
                <div className="font-serif-display text-3xl text-[#183021]">{s.capacity_kw} kW</div>
                <div className="text-xs text-[#6B7B70]">₹{s.purchase_price_inr.toLocaleString("en-IN")}</div>
                <Link to={`/telemetry/${s.farm_id}`} className="text-xs text-[#C25942] inline-flex items-center mt-1">
                  <Activity className="w-3 h-3 mr-1" /> View telemetry
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#E7E2D6] bg-white p-6 space-y-4" data-testid="utility-card">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-2xl text-[#183021]">Linked utilities</h3>
          </div>
          {utilities.length === 0 ? (
            <p className="text-sm text-[#6B7B70]">No utility accounts linked. Connect your BESCOM consumer number to apply credits automatically.</p>
          ) : (
            <ul className="space-y-3">
              {utilities.map((u) => (
                <li key={u.account_id} className="border-b border-[#F5F3ED] pb-3 last:border-0" data-testid={`utility-${u.account_id}`}>
                  <div className="text-sm text-[#183021] font-medium">{u.utility_provider}</div>
                  <div className="text-xs text-[#6B7B70]">Consumer #{u.consumer_number} · {u.state}</div>
                  <div className="text-xs text-[#6B7B70]">Sanctioned load: {u.sanctioned_load_kw} kW</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white" data-testid="utility-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-3xl text-[#183021]">Link a utility account</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Utility">
              <Input value={form.utility_provider} onChange={(e) => setForm({ ...form, utility_provider: e.target.value })} data-testid="utility-input-provider" />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} data-testid="utility-input-state" />
            </Field>
            <Field label="Consumer number" full>
              <Input value={form.consumer_number} onChange={(e) => setForm({ ...form, consumer_number: e.target.value })} data-testid="utility-input-number" />
            </Field>
            <Field label="Sanctioned load (kW)" full>
              <Input type="number" value={form.sanctioned_load_kw} onChange={(e) => setForm({ ...form, sanctioned_load_kw: Number(e.target.value) })} data-testid="utility-input-load" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="utility-cancel">Cancel</Button>
            <Button onClick={linkUtility} data-testid="utility-confirm" className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full">Link account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, suffix = "", prefix = "", testId, decimals }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl border border-[#E7E2D6] bg-white p-6" data-testid={testId}>
      <div className="text-xs uppercase tracking-[0.18em] text-[#6B7B70]">{label}</div>
      <div className="font-serif-display text-4xl text-[#183021] mt-2">
        <AnimatedNumber value={value} suffix={suffix} prefix={prefix} decimals={decimals ?? 0} />
      </div>
    </motion.div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block space-y-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-xs uppercase tracking-[0.16em] text-[#6B7B70]">{label}</span>
      {children}
    </label>
  );
}
