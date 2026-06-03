import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        await api.post("/auth/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        await refresh();
        // Clean fragment
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFAF8]">
      <div className="font-serif-display text-2xl text-[#183021]" data-testid="auth-callback-loading">
        Connecting to your account…
      </div>
    </div>
  );
}
