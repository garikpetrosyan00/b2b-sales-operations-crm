import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { apiFetch, refreshAccessToken } from "../lib/api";
import { onSessionClear, setAccessToken } from "../lib/session";
import type { SessionResponse, User } from "../types/auth";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionClear(() => {
      if (active) setUser(null);
    });
    void (async () => {
      try {
        const session = await refreshAccessToken();
        if (active) setUser(session?.user ?? null);
      } catch {
        setAccessToken(null);
        if (active) {
          setUser(null);
          setInitializationError(
            "We could not reach the CRM service. Check that the API is running, then try again.",
          );
        }
      } finally {
        if (active) setIsInitializing(false);
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [initializationAttempt]);

  const retryInitialization = useCallback(() => {
    setIsInitializing(true);
    setInitializationError(null);
    setInitializationAttempt((attempt) => attempt + 1);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiFetch<SessionResponse>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    );
    setAccessToken(session.access_token);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ message: string }>("/auth/logout", { method: "POST" }, false);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isInitializing, initializationError, retryInitialization, login, logout }),
    [user, isInitializing, initializationError, retryInitialization, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
