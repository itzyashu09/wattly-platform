import { NavLink, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

const links = [
  { to: "/marketplace", label: "Marketplace" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/my-shares", label: "Portfolio" },
  { to: "/credits", label: "Credits" },
  { to: "/bill", label: "Tariff" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  return (
    <header className="sticky top-0 z-40 wattly-nav-blur border-b border-[#E7E2D6]" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-full bg-[#183021] flex items-center justify-center">
            <span className="font-serif-display text-[#FCFAF8] text-lg leading-none">W</span>
          </div>
          <span className="font-serif-display text-2xl text-[#183021] tracking-tight">Wattly</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 relative" data-testid="nav-links">
          {links.map((l) => {
            const active = loc.pathname.startsWith(l.to);
            return (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase()}`}
                className="relative px-4 py-2 text-sm tracking-wide text-[#183021]/80 hover:text-[#183021]"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-[#D1DCD3] rounded-full -z-0"
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm text-[#183021]/80" data-testid="nav-user">
                {user.picture ? (
                  <img alt={user.name} src={user.picture} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="font-medium">{user.name?.split(" ")[0]}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                data-testid="logout-button"
                className="text-[#183021] hover:bg-[#F5F3ED]"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Sign out
              </Button>
            </>
          ) : (
            <Button
              onClick={googleLogin}
              data-testid="login-button"
              className="bg-[#183021] text-[#FCFAF8] hover:bg-[#2C4A3B] rounded-full px-5"
            >
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
