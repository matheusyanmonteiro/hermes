import { normalizeError } from "./errors";

const allowedOrigin = process.env.WEB_URL ?? "http://localhost:3000";

export function correlationId(request: Request): string {
  return request.headers.get("x-correlation-id")?.slice(0, 80) || crypto.randomUUID();
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", allowedOrigin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "Origin");
  return new Response(serialize(data), { ...init, headers });
}

export function noContent(init: ResponseInit = {}): Response {
  return new Response(null, { ...init, status: init.status ?? 204 });
}

export type RouteHandler = (request: Request, context: unknown) => Promise<Response>;

export function apiRoute(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const requestId = correlationId(request);
    try {
      const response = await handler(request, context);
      response.headers.set("x-correlation-id", requestId);
      return response;
    } catch (error) {
      const normalized = normalizeError(error);
      return json(
        {
          error: {
            code: normalized.code,
            message: normalized.message,
            details: normalized.details,
            correlationId: requestId,
          },
        },
        { status: normalized.status, headers: { "x-correlation-id": requestId } },
      );
    }
  };
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    const { ApiError } = await import("./errors");
    throw new ApiError(400, "INVALID_JSON", "O corpo da requisição não é um JSON válido");
  }
}

export function queryObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
