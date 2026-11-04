import { prisma, type UserStatus } from "@hermes/database";
import { type PermissionCode } from "@hermes/permissions";
import { jwtVerify, SignJWT } from "jose";
import { ApiError } from "./errors";

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SESSION_COOKIE_PRODUCTION = "__Host-hermes-session";
const SESSION_COOKIE_DEVELOPMENT = "hermes-session";

export interface AuthContext {
  user: {
    id: string;
    authId: string;
    name: string;
    email: string;
    status: UserStatus;
  };
  roles: string[];
  permissions: string[];
}

function authMode(): "development" | "local" {
  const mode = process.env.AUTH_MODE ?? "development";
  if (mode !== "development" && mode !== "local") {
    throw new ApiError(500, "AUTH_CONFIGURATION_ERROR", "AUTH_MODE deve ser development ou local");
  }
  if (process.env.NODE_ENV === "production" && mode !== "local") {
    throw new ApiError(500, "UNSAFE_AUTH_MODE", "A produção exige AUTH_MODE=local");
  }
  return mode;
}

function sessionSecret(): Uint8Array {
  const mode = authMode();
  const secret = mode === "local" ? process.env.AUTH_SECRET : process.env.DEV_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, "AUTH_CONFIGURATION_ERROR", `${mode === "local" ? "AUTH_SECRET" : "DEV_AUTH_SECRET"} deve ter pelo menos 32 caracteres`);
  }
  return new TextEncoder().encode(secret);
}

function cookieName(): string {
  return process.env.NODE_ENV === "production" ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_DEVELOPMENT;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return undefined;
}

function requestToken(request: Request): string {
  const fromCookie = cookieValue(request, cookieName());
  if (fromCookie) return fromCookie;
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  throw new ApiError(401, "AUTH_REQUIRED", "Autenticação obrigatória");
}

function sessionCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function attachSessionCookie(response: Response, token: string): Response {
  response.headers.append("set-cookie", sessionCookie(token, SESSION_DURATION_SECONDS));
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export function clearSessionCookie(response: Response): Response {
  response.headers.append("set-cookie", sessionCookie("", 0));
  response.headers.set("clear-site-data", '"cache"');
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function createSessionToken(authId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(authId)
    .setIssuer("hermes")
    .setAudience("hermes-api")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret());
}

async function verifySessionToken(token: string): Promise<{ authId: string; sessionVersion: number }> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      issuer: "hermes",
      audience: "hermes-api",
    });
    if (!payload.sub || !Number.isSafeInteger(payload.sessionVersion)) throw new Error("Sessão incompleta");
    return { authId: payload.sub, sessionVersion: Number(payload.sessionVersion) };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "INVALID_TOKEN", "Sessão inválida ou expirada");
  }
}

export async function authenticate(request: Request): Promise<AuthContext> {
  const session = await verifySessionToken(requestToken(request));
  const user = await prisma.user.findUnique({
    where: { authId: session.authId },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });

  if (!user || user.deletedAt) throw new ApiError(401, "USER_NOT_FOUND", "Usuário não cadastrado no portal");
  if (user.sessionVersion !== session.sessionVersion) throw new ApiError(401, "SESSION_REVOKED", "A sessão foi revogada; entre novamente");
  if (user.status !== "ACTIVE") throw new ApiError(403, "USER_INACTIVE", "Este usuário não está ativo");

  const roles = user.roles.map(({ role }) => role.code);
  const permissions = [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))];

  return {
    user: { id: user.id, authId: user.authId, name: user.name, email: user.email, status: user.status },
    roles,
    permissions,
  };
}

export function requirePermission(auth: AuthContext, permission: PermissionCode): void {
  if (!auth.permissions.includes(permission)) {
    throw new ApiError(403, "PERMISSION_DENIED", "Você não possui permissão para esta operação");
  }
}
