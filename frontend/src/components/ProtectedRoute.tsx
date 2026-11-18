import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { FullPageLoader } from "./FullPageLoader";
import { SessionUnavailable } from "./SessionUnavailable";

export function ProtectedRoute() {
  const { user, isInitializing, initializationError, retryInitialization } = useAuth();
  const location = useLocation();

  if (isInitializing) return <FullPageLoader />;
  if (initializationError) {
    return <SessionUnavailable message={initializationError} onRetry={retryInitialization} />;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
