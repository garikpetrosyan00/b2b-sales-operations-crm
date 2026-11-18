import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<ComingSoonPage title="Leads" />} />
          <Route path="pipeline" element={<ComingSoonPage title="Pipeline" />} />
          <Route path="tasks" element={<ComingSoonPage title="Tasks" />} />
          <Route path="reports" element={<ComingSoonPage title="Reports" />} />
          <Route
            path="team"
            element={
              <RoleRoute roles={["admin", "manager"]}>
                <ComingSoonPage title="Team" />
              </RoleRoute>
            }
          />
          <Route
            path="settings"
            element={
              <RoleRoute roles={["admin"]}>
                <ComingSoonPage title="Settings" />
              </RoleRoute>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
