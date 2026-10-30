import { timingSafeEqual } from "node:crypto";
import { loginSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { createDevelopmentToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export const POST = apiRoute(async (request) => {
  if (process.env.AUTH_MODE === "supabase") {
    throw new ApiError(404, "NOT_FOUND", "Recurso não encontrado");
  }
  const input = loginSchema.parse(await parseJson(request));
  await enforceRateLimit(request, "auth.login", input.email, 10, 15 * 60);
  const expected = process.env.DEV_LOGIN_PASSWORD ?? "";
  const validPassword = expected.length > 0 && safeEquals(input.password, expected);
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!validPassword || !user || user.status !== "ACTIVE" || user.deletedAt) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos");
  }

  const token = await createDevelopmentToken(user.authId);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return json({ accessToken: token, expiresIn: 28_800, tokenType: "Bearer" });
});
