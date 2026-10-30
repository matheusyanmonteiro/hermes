import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ApiError } from "./errors";

function encryptionKey(): Buffer {
  const configured = process.env.TOKEN_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length === 32) return key;
    throw new ApiError(500, "ENCRYPTION_CONFIGURATION_ERROR", "TOKEN_ENCRYPTION_KEY deve conter 32 bytes em Base64");
  }
  if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_SECRET) {
    return createHash("sha256").update(process.env.DEV_AUTH_SECRET).digest();
  }
  throw new ApiError(500, "ENCRYPTION_CONFIGURATION_ERROR", "A chave de criptografia de tokens não foi configurada");
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new ApiError(500, "INVALID_ENCRYPTED_VALUE", "Valor criptografado inválido");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new ApiError(500, "DECRYPTION_FAILED", "Não foi possível acessar a credencial protegida");
  }
}
