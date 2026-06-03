import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import AnimatedNumber from "@/components/wattly/AnimatedNumber";
import { ArrowUpRight, Leaf, LineChart, ShieldCheck, Sparkles, Sun, Wind } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

const STATS = [
  { label: "Indian assets", value: "8", suffix: "" },
  { label: "Avg yield", value: "63", suffix: "%" },
  { label: "Min lot", value: "1", suffix: " kW" },
];

const VALUES = [
  {
    icon: Sun,
    title: "Own a slice of solar",
    body: "Buy fractional kW capacity in mega-scale Indian solar parks like Pavagada and Bhadla.",
  },
  {
    icon: Wind,
    title: "Capture coastal winds",
    body: "Jaisalmer, Muppandal and Chitradurga: industrial-grade turbines, fractionalised for you.",
  },
  {
    icon: LineChart,
    title: "Credits, applied",
    body: "Generation translates into kWh credits — applied automatically to your BESCOM bill.",
  },
  {
    icon: ShieldCheck,
    title: "Audited ledger",
    body: "Every credit, payout and donation is auditable with reference hashes — like a private utility.",
  },
];

export default function Landing() {
  const [kw, setKw] = useState(5);
  const [type, setType] = useState("solar");

  const estimate = useMemo(() => {
    const pricePerKw = type === "solar" ? 12500 : 14200;
    const dailyKwhPerKw = type === "solar" ? 6.5 : 8.0; // realistic high-yield Indian sites
    const annualKwh = kw * dailyKwhPerKw * 365;
    const annualSavings = annualKwh * 8.5; // BESCOM top-slab tariff
    const co2 = annualKwh * 0.82;
    const trees = co2 / 21;
    const investment = kw * pricePerKw;
    return {
      investment,
      annualKwh,
      annualSavings,
      co2,
      trees,
      paybackYears: investment / Math.max(annualSavings, 1),
    };
  }, [kw, type]);

  return (
    <div className="space-y-28">
      {/* Hero */}
      <section className="grid lg:grid-cols-12 gap-10 items-end pt-6" data-testid="landing-hero">
        <div className="lg:col-span-7 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F3ED] border border-[#E7E2D6] text-xs tracking-[0.18em] uppercase text-[#2C4A3B]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Virtual Net Metering · India
          </motion.div>
          <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] text-[#183021]">
            A private utility, <em className="italic">grown</em> on India's
            <br /> sunniest fields & windiest plateaus.
          </h1>
          <p className="text-lg text-[#4A5568] max-w-xl leading-relaxed">
            Wattly lets you buy a small slice of large clean-energy projects. The generation runs through your
            BESCOM meter as credits — or pays out in rupees.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={googleLogin}
              data-testid="hero-cta-signin"
              className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full px-7 py-6 text-base"
            >
              Sign in with Google
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              asChild
              data-testid="hero-cta-marketplace"
              className="rounded-full px-7 py-6 text-base text-[#183021] hover:bg-[#F5F3ED]"
            >
              <Link to="/marketplace">Browse marketplace →</Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 max-w-md pt-6 border-t border-[#E7E2D6]">
            {STATS.map((s) => (
              <div key={s.label} className="pt-5">
                <div className="font-serif-display text-3xl text-[#183021]">{s.value}{s.suffix}</div>
                <div className="text-xs uppercase tracking-[0.16em] text-[#6B7B70] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="lg:col-span-5"
        >
          <div className="rounded-2xl overflow-hidden border border-[#E7E2D6] bg-white relative">
            <img
              alt="Solar field"
              src="https://images.unsplash.com/photo-1509391366360-2e959784a276?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
              className="w-full h-72 object-cover"
            />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#6B7B70]">Live ROI</div>
                  <div className="font-serif-display text-xl text-[#183021]">Estimate your portfolio</div>
                </div>
                <div className="inline-flex rounded-full bg-[#F5F3ED] border border-[#E7E2D6] p-1 text-sm">
                  {["solar", "wind"].map((t) => (
                    <button
                      key={t}
                      data-testid={`hero-roi-${t}`}
                      onClick={() => setType(t)}
                      className={`px-3 py-1 rounded-full capitalize ${type === t ? "bg-[#183021] text-[#FCFAF8]" : "text-[#183021]/80"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-[#4A5568]">
                  <span>Your share</span>
                  <span className="font-mono-num text-[#183021] font-medium">
                    <AnimatedNumber value={kw} suffix=" kW" testId="hero-roi-kw" />
                  </span>
                </div>
                <Slider
                  data-testid="hero-roi-slider"
                  value={[kw]}
                  onValueChange={(v) => setKw(v[0])}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Cell label="Investment" testId="roi-investment">
                  <AnimatedNumber value={estimate.investment} prefix="₹" decimals={0} />
                </Cell>
                <Cell label="Annual savings" testId="roi-savings">
                  <AnimatedNumber value={estimate.annualSavings} prefix="₹" decimals={0} />
                </Cell>
                <Cell label="Annual generation" testId="roi-kwh">
                  <AnimatedNumber value={estimate.annualKwh} decimals={0} suffix=" kWh" />
                </Cell>
                <Cell label="Payback" testId="roi-payback">
                  <AnimatedNumber value={estimate.paybackYears} decimals={1} suffix=" yr" />
                </Cell>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Values */}
      <section data-testid="landing-values" className="space-y-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <h2 className="font-serif-display text-4xl lg:text-5xl text-[#183021] max-w-xl tracking-tight">
            A utility you actually own.
          </h2>
          <p className="text-sm uppercase tracking-[0.18em] text-[#6B7B70]">— Three quiet pillars</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {VALUES.map((v) => (
            <motion.div
              key={v.title}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="rounded-2xl border border-[#E7E2D6] bg-white p-6"
              data-testid={`value-card-${v.title.split(" ")[0].toLowerCase()}`}
            >
              <v.icon className="w-5 h-5 text-[#C25942]" />
              <h3 className="font-serif-display text-2xl text-[#183021] mt-4">{v.title}</h3>
              <p className="text-sm text-[#4A5568] leading-relaxed mt-2">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-3xl border border-[#E7E2D6] bg-[#F5F3ED] p-12 md:p-16 relative overflow-hidden grain" data-testid="landing-cta">
        <div className="max-w-2xl relative z-10 space-y-5">
          <Leaf className="w-6 h-6 text-[#2C4A3B]" />
          <h2 className="font-serif-display text-4xl sm:text-5xl text-[#183021] tracking-tight leading-[1.05]">
            Step in. Take a slice. Watch it generate.
          </h2>
          <p className="text-[#4A5568] leading-relaxed">
            Open an account in seconds with Google. Pick a farm. Track every kWh. Apply the credits to your bill
            or take an INR payout.
          </p>
          <Button
            size="lg"
            onClick={googleLogin}
            data-testid="cta-signin"
            className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full px-7 py-6 text-base"
          >
            Start with Google
          </Button>
        </div>
      </section>
    </div>
  );
}

function Cell({ label, children, testId }) {
  return (
    <div className="rounded-xl bg-[#F5F3ED] p-3" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7B70]">{label}</div>
      <div className="font-serif-display text-2xl text-[#183021] mt-0.5">{children}</div>
    </div>
  );
}
