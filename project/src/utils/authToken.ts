const TOKEN_KEY = "aceros_chile_auth_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignorar si localStorage no está disponible
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignorar
  }
}

/**
 * Wrapper de fetch que agrega automáticamente el header de autorización
 * y maneja el caso de sesión expirada (401) redirigiendo al login.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("aceros-chile-session-expired"));
  }
  return response;
}
