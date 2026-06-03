import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sun, Wind } from "lucide-react";

export default function Marketplace() {
  const [farms, setFarms] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null); // farm being purchased
  const [kw, setKw] = useState(5);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const r = await api.get("/farms");
      setFarms(r.data);
    })();
  }, []);

  const filtered = filter === "all" ? farms : farms.filter((f) => f.farm_type === filter);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const purchase = async () => {
    if (!user) { googleLogin(); return; }
    setLoading(true);
    try {
      const r = await api.post("/shares/purchase", { farm_id: open.farm_id, capacity_kw: Number(kw) });
      toast.success(`Bought ${kw} kW of ${open.name} for ₹${r.data.total_inr.toLocaleString("en-IN")}`);
      // refresh inventory
      const f = await api.get("/farms");
      setFarms(f.data);
      setOpen(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10" data-testid="marketplace-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6B7B70]">Marketplace</p>
          <h1 className="font-serif-display text-5xl text-[#183021] tracking-tight">Indian clean-energy fields</h1>
        </div>
        <div className="inline-flex rounded-full bg-[#F5F3ED] border border-[#E7E2D6] p-1 text-sm relative">
          {["all", "solar", "wind"].map((t) => (
            <button
              key={t}
              data-testid={`filter-${t}`}
              onClick={() => setFilter(t)}
              className="relative px-4 py-1.5 rounded-full capitalize text-[#183021]"
            >
              {filter === t && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 bg-[#183021] rounded-full -z-0"
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                />
              )}
              <span className={`relative z-10 ${filter === t ? "text-[#FCFAF8]" : ""}`}>{t}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((f) => (
          <motion.article
            key={f.farm_id}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="rounded-2xl border border-[#E7E2D6] bg-white overflow-hidden flex flex-col"
            data-testid={`farm-card-${f.farm_id}`}
          >
            <div className="relative h-44">
              <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FCFAF8]/95 border border-[#E7E2D6] text-xs">
                {f.farm_type === "solar" ? <Sun className="w-3 h-3 text-[#C25942]" /> : <Wind className="w-3 h-3 text-[#2C4A3B]" />}
                <span className="uppercase tracking-[0.14em] text-[#183021]">{f.farm_type}</span>
              </div>
            </div>
            <div className="p-5 space-y-3 flex-1 flex flex-col">
              <div>
                <h3 className="font-serif-display text-2xl text-[#183021] leading-tight">{f.name}</h3>
                <p className="text-xs text-[#6B7B70] tracking-wide mt-0.5">{f.location}</p>
              </div>
              <p className="text-sm text-[#4A5568] line-clamp-2">{f.description}</p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Stat label="Capacity" value={`${f.total_capacity_mw.toLocaleString("en-IN")} MW`} />
                <Stat label="Available" value={`${f.available_kw.toLocaleString("en-IN")} kW`} />
                <Stat label="Per kW" value={`₹${f.price_per_kw_inr.toLocaleString("en-IN")}`} />
                {f.farm_type === "solar" && f.solar_detail && (
                  <Stat label="Panels" value={f.solar_detail.panel_type} />
                )}
                {f.farm_type === "wind" && f.wind_detail && (
                  <Stat label="Turbine" value={f.wind_detail.turbine_model} />
                )}
              </div>
              <div className="pt-3 mt-auto flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-[#6B7B70]">
                  {f.farm_type === "solar" && f.solar_detail?.tracking_system_type}
                  {f.farm_type === "wind" && f.wind_detail && `${f.wind_detail.hub_height_meters}m hub`}
                </div>
                <Button
                  onClick={() => { setOpen(f); setKw(5); }}
                  data-testid={`buy-button-${f.farm_id}`}
                  className="rounded-full bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B]"
                >
                  Buy shares
                </Button>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-white" data-testid="purchase-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-3xl text-[#183021]">{open?.name}</DialogTitle>
            <DialogDescription className="text-[#6B7B70]">
              {open?.location} · {open?.farm_type === "solar" ? "Solar" : "Wind"} ·
              ₹{open?.price_per_kw_inr?.toLocaleString("en-IN")}/kW
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="text-xs uppercase tracking-[0.18em] text-[#6B7B70]">Capacity (kW)</label>
            <Input
              type="number"
              min={1}
              max={open?.available_kw}
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              data-testid="purchase-kw-input"
              className="font-mono-num text-lg"
            />
            <div className="rounded-xl bg-[#F5F3ED] p-4 flex items-center justify-between">
              <span className="text-sm text-[#6B7B70] uppercase tracking-[0.16em]">Total</span>
              <span className="font-serif-display text-3xl text-[#183021]" data-testid="purchase-total">
                ₹{(Number(kw || 0) * (open?.price_per_kw_inr || 0)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)} data-testid="cancel-purchase">Cancel</Button>
            <Button
              onClick={purchase}
              disabled={loading || !kw || Number(kw) <= 0}
              data-testid="confirm-purchase"
              className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full"
            >
              {loading ? "Processing…" : user ? "Confirm purchase" : "Sign in to buy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-[#F5F3ED] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6B7B70]">{label}</div>
      <div className="font-mono-num text-sm text-[#183021] truncate">{value}</div>
    </div>
  );
}
