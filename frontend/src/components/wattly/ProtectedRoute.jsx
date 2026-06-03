import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAF8]">
        <div className="font-serif-display text-xl text-[#183021]" data-testid="protected-route-loading">
          Loading…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}
