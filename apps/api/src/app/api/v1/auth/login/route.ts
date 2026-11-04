import { timingSafeEqual } from "node:crypto";
import { loginSchema } from "@hermes/contracts";
import { hashPassword, passwordNeedsRehash, prisma, verifyPassword } from "@hermes/database";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const dummyPasswordHash = hashPassword("credencial-inexistente-para-comparacao-constante");

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export const POST = apiRoute(async (request) => {
  const input = loginSchema.parse(await parseJson(request));
  await enforceRateLimit(request, "auth.login", input.email, 10, 15 * 60);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const developmentMode = (process.env.AUTH_MODE ?? "development") === "development" && process.env.NODE_ENV !== "production";
  const validStoredPassword = await verifyPassword(input.password, user?.passwordHash ?? await dummyPasswordHash);
  const developmentPassword = process.env.DEV_LOGIN_PASSWORD ?? "";
  const validDevelopmentFallback = developmentMode && !user?.passwordHash && developmentPassword.length > 0 && safeEquals(input.password, developmentPassword);

  if ((!validStoredPassword && !validDevelopmentFallback) || !user || user.status !== "ACTIVE" || user.deletedAt) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos");
  }

  const shouldRehash = validStoredPassword && passwordNeedsRehash(user.passwordHash);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), ...(shouldRehash ? { passwordHash: await hashPassword(input.password) } : {}) },
  });
  const token = await createSessionToken(updated.authId, updated.sessionVersion);
  return attachSessionCookie(json({ expiresIn: 28_800 }), token);
});
