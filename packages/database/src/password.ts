import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const CURRENT_PARAMETERS = { N: 2 ** 15, r: 8, p: 3 } as const;
const CURRENT_PREFIX = `scrypt$${CURRENT_PARAMETERS.N}$${CURRENT_PARAMETERS.r}$${CURRENT_PARAMETERS.p}`;
const MAX_MEMORY = 128 * 1024 * 1024;

function deriveKey(password: string, salt: string, options?: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const callback = (error: Error | null, derivedKey: Buffer) => error ? reject(error) : resolve(derivedKey);
    if (options) scrypt(password, salt, KEY_LENGTH, options, callback);
    else scrypt(password, salt, KEY_LENGTH, callback);
  });
}

function matches(candidate: Buffer, expectedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await deriveKey(password, salt, { ...CURRENT_PARAMETERS, maxmem: MAX_MEMORY });
  return `${CURRENT_PREFIX}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    if (stored.startsWith("scrypt$")) {
      const [algorithm, rawN, rawR, rawP, salt, expected] = stored.split("$");
      if (algorithm !== "scrypt" || !rawN || !rawR || !rawP || !salt || !expected) return false;
      const N = Number(rawN); const r = Number(rawR); const p = Number(rawP);
      if (![N, r, p].every(Number.isSafeInteger) || N < 2 || r < 1 || p < 1) return false;
      return matches(await deriveKey(password, salt, { N, r, p, maxmem: MAX_MEMORY }), expected);
    }

    const [salt, expected] = stored.split(":");
    if (!salt || !expected) return false;
    return matches(await deriveKey(password, salt), expected);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(stored?: string | null): boolean {
  return !stored?.startsWith(`${CURRENT_PREFIX}$`);
}
