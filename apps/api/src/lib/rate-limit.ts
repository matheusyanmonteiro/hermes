import { createHash } from "node:crypto";
import { prisma } from "@hermes/database";
import { ApiError } from "./errors";

type RateLimitIdentity = {
  kind: "ip" | "subject";
  value: string;
};

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 120);
}

function bucketKey(scope: string, identity: RateLimitIdentity, windowStart: number): string {
  const digest = createHash("sha256")
    .update(`${scope}:${identity.kind}:${identity.value}:${windowStart}`)
    .digest("hex");
  return `${scope.slice(0, 60)}:${identity.kind}:${digest}`;
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const now = Date.now();
  const windowMs = windowSeconds * 1_000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);
  const identities: RateLimitIdentity[] = [
    { kind: "ip", value: requestIp(request) },
    { kind: "subject", value: subject.toLowerCase().slice(0, 180) },
  ];

  await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  const buckets = await prisma.$transaction(
    identities.map((identity) =>
      prisma.rateLimitBucket.upsert({
        where: { key: bucketKey(scope, identity, windowStartMs) },
        create: {
          key: bucketKey(scope, identity, windowStartMs),
          count: 1,
          windowStart,
          expiresAt,
        },
        update: { count: { increment: 1 } },
      }),
    ),
  );

  if (buckets.some((bucket) => bucket.count > limit)) {
    throw new ApiError(429, "RATE_LIMITED", "Muitas tentativas. Aguarde antes de tentar novamente", {
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1_000)),
    });
  }
}
