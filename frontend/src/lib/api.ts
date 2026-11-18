import type { ApiErrorBody, SessionResponse } from "../types/auth";
import { getAccessToken, setAccessToken } from "./session";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<SessionResponse | null> | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
  throw new ApiError(body?.error?.message ?? "The request could not be completed", response.status, body);
}

export async function refreshAccessToken(): Promise<SessionResponse | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          setAccessToken(null);
          return null;
        }
        const session = (await response.json()) as SessionResponse;
        setAccessToken(session.access_token);
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && allowRefresh && path !== "/auth/refresh") {
    const session = await refreshAccessToken();
    if (session) return apiFetch<T>(path, init, false);
  }

  return parseResponse<T>(response);
}

