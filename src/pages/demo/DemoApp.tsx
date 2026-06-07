import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DemoLayout } from "./DemoLayout";

/**
 * Route entry for the /demo Design Lab.
 * Mirrors ProtectedRoute's auth gate but renders DemoLayout instead of AppLayout
 * (so the production sidebar / old mobile nav never appear).
 */
export default function DemoApp() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <DemoLayout />;
}
