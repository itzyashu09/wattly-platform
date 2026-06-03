import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/wattly/Layout";
import AuthCallback from "@/components/wattly/AuthCallback";
import ProtectedRoute from "@/components/wattly/ProtectedRoute";

import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Marketplace from "@/pages/Marketplace";
import BillCalculator from "@/pages/BillCalculator";
import Credits from "@/pages/Credits";
import MyShares from "@/pages/MyShares";
import FarmTelemetry from "@/pages/FarmTelemetry";

function Router() {
  const location = useLocation();
  // Handle OAuth callback synchronously to avoid race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Landing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/bill" element={<BillCalculator />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/my-shares" element={<ProtectedRoute><MyShares /></ProtectedRoute>} />
          <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
          <Route path="/telemetry/:farmId" element={<ProtectedRoute><FarmTelemetry /></ProtectedRoute>} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Router />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
