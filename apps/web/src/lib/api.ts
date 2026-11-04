const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:3001/api/v1");

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function storedToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("hermes.accessToken");
}

export function saveToken(token: string): void {
  window.localStorage.setItem("hermes.accessToken", token);
}

export function clearToken(): void {
  window.localStorage.removeItem("hermes.accessToken");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storedToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("x-correlation-id", crypto.randomUUID());

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    let payload: { error?: { message?: string; code?: string; details?: unknown } } = {};
    try {
      payload = await response.json();
    } catch {
      // Respostas externas ou vazias não precisam ser JSON.
    }
    if (response.status === 401 && typeof window !== "undefined") {
      clearToken();
    }
    throw new ApiClientError(payload.error?.message ?? "Não foi possível concluir a operação", response.status, payload.error?.code, payload.error?.details);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function formatBytes(value: string | number | bigint): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("pt-BR", { maximumFractionDigits: index > 1 ? 1 : 0 })} ${units[index]}`;
}

export function formatDate(value?: string | Date | null, includeTime = true): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: includeTime ? "short" : undefined,
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
