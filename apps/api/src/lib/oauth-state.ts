import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { ApiError } from "./errors";

function stateSecret(): Uint8Array {
  const value = process.env.OAUTH_STATE_SECRET || (process.env.NODE_ENV !== "production" ? process.env.DEV_AUTH_SECRET : undefined);
  if (!value || value.length < 32) throw new ApiError(500, "OAUTH_CONFIGURATION_ERROR", "O segredo de estado OAuth não foi configurado");
  return createHash("sha256").update(value).digest();
}

export async function createOauthState(actorId: string): Promise<string> {
  return new SignJWT({ nonce: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actorId)
    .setIssuer("hermes-api")
    .setAudience("google-oauth")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret());
}

export async function verifyOauthState(state: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(state, stateSecret(), { issuer: "hermes-api", audience: "google-oauth" });
    if (!payload.sub) throw new Error("Estado sem ator");
    return payload.sub;
  } catch {
    throw new ApiError(400, "INVALID_OAUTH_STATE", "A tentativa de conexão expirou ou é inválida");
  }
}
