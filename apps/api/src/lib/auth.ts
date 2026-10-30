import { createClient } from "@supabase/supabase-js";
import { prisma, type UserStatus } from "@hermes/database";
import { type PermissionCode } from "@hermes/permissions";
import { jwtVerify, SignJWT } from "jose";
import { ApiError } from "./errors";

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

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "AUTH_REQUIRED", "Autenticação obrigatória");
  }
  return header.slice(7);
}

function developmentSecret(): Uint8Array {
  const secret = process.env.DEV_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, "AUTH_CONFIGURATION_ERROR", "DEV_AUTH_SECRET deve ter pelo menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

async function verifyDevelopmentToken(token: string): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "UNSAFE_AUTH_MODE", "O modo de autenticação local não pode ser usado em produção");
  }
  try {
    const { payload } = await jwtVerify(token, developmentSecret(), {
      issuer: "hermes-local",
      audience: "hermes-api",
    });
    if (!payload.sub) throw new Error("Token sem subject");
    return payload.sub;
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "Sessão inválida ou expirada");
  }
}

async function verifySupabaseToken(token: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new ApiError(500, "AUTH_CONFIGURATION_ERROR", "Supabase Auth não foi configurado");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new ApiError(401, "INVALID_TOKEN", "Sessão inválida ou expirada");
  }
  return data.claims.sub;
}

export async function authenticate(request: Request): Promise<AuthContext> {
  const token = bearerToken(request);
  const authId = process.env.AUTH_MODE === "supabase" ? await verifySupabaseToken(token) : await verifyDevelopmentToken(token);
  const user = await prisma.user.findUnique({
    where: { authId },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });

  if (!user || user.deletedAt) throw new ApiError(401, "USER_NOT_FOUND", "Usuário não cadastrado no portal");
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

export async function createDevelopmentToken(authId: string): Promise<string> {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_MODE === "supabase") {
    throw new ApiError(404, "NOT_FOUND", "Recurso não encontrado");
  }
  return new SignJWT({ mode: "development" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(authId)
    .setIssuer("hermes-local")
    .setAudience("hermes-api")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(developmentSecret());
}
