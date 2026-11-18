let accessToken: string | null = null;
const sessionClearListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token === null) sessionClearListeners.forEach((listener) => listener());
}

export function onSessionClear(listener: () => void): () => void {
  sessionClearListeners.add(listener);
  return () => sessionClearListeners.delete(listener);
}
