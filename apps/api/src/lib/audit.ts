import { prisma, type Prisma } from "@hermes/database";
import { correlationId } from "./http";

export async function audit(
  request: Request,
  input: {
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      ...input,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64),
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
      correlationId: correlationId(request),
    },
  });
}
