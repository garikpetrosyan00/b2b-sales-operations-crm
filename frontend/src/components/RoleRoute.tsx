import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import type { UserRole } from "../types/auth";

interface RoleRouteProps extends PropsWithChildren {
  roles: UserRole[];
}

export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

