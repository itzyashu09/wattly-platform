import Navbar from "@/components/wattly/Navbar";
import { motion } from "framer-motion";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#FCFAF8]">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-7xl mx-auto px-6 lg:px-10 py-10"
      >
        {children}
      </motion.main>
      <footer className="border-t border-[#E7E2D6] mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="font-serif-display text-2xl text-[#183021]">Wattly</div>
          <p className="text-sm text-[#6B7B70] max-w-md">
            Virtual net metering for India. Fractional ownership of clean energy assets — credits, payouts and
            a measurable impact ledger.
          </p>
          <p className="text-xs text-[#A0AEC0] tracking-[0.18em] uppercase">© Wattly 2026</p>
        </div>
      </footer>
    </div>
  );
}
