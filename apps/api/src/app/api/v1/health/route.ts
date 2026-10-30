import { prisma } from "@hermes/database";
import { apiRoute, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => {
  const startedAt = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  return json({
    status: "ok",
    service: "hermes-api",
    database: "connected",
    responseTimeMs: Math.round(performance.now() - startedAt),
    timestamp: new Date().toISOString(),
  });
});
