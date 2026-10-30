import { reportQuerySchema } from "@hermes/contracts";
import { prisma, type Prisma } from "@hermes/database";

export async function downloadReport(rawQuery: Record<string, string>) {
  const query = reportQuerySchema.parse(rawQuery);
  const where: Prisma.DownloadEventWhereInput = {
    occurredAt: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined,
    userId: query.userId,
    eventType: query.status,
    transfer: {
      videoId: query.videoId,
      video: query.accountId ? { accountId: query.accountId } : undefined,
    },
  };
  const events = await prisma.downloadEvent.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      transfer: { include: { video: { select: { id: true, name: true, account: { select: { email: true } } } }, batch: { select: { id: true } } } },
    },
  });

  const byUser = new Map<string, { userId: string; name: string; email: string; requests: number; completions: number; firstAt: Date; lastAt: Date; videos: Set<string> }>();
  const byVideo = new Map<string, { videoId: string; name: string; source: string; sizeBytes: bigint; requests: number; completions: number }>();
  for (const event of events) {
    const user = byUser.get(event.userId) ?? { userId: event.userId, name: event.user.name, email: event.user.email, requests: 0, completions: 0, firstAt: event.occurredAt, lastAt: event.occurredAt, videos: new Set<string>() };
    if (event.eventType === "AUTHORIZED") user.requests++;
    if (event.eventType === "COMPLETED_CLIENT") user.completions++;
    if (event.transfer.videoId) user.videos.add(event.transfer.videoId);
    if (event.occurredAt < user.firstAt) user.firstAt = event.occurredAt;
    if (event.occurredAt > user.lastAt) user.lastAt = event.occurredAt;
    byUser.set(event.userId, user);

    const videoKey = event.transfer.videoId ?? `snapshot:${event.transfer.id}`;
    const video = byVideo.get(videoKey) ?? {
      videoId: event.transfer.videoId ?? "removido",
      name: event.transfer.fileNameSnapshot,
      source: event.transfer.video?.account.email ?? event.transfer.sourceSnapshot,
      sizeBytes: event.transfer.fileSizeSnapshot,
      requests: 0,
      completions: 0,
    };
    if (event.eventType === "AUTHORIZED") video.requests++;
    if (event.eventType === "COMPLETED_CLIENT") video.completions++;
    byVideo.set(videoKey, video);
  }

  const users = [...byUser.values()].map(({ videos, ...user }) => ({ ...user, distinctVideos: videos.size }));
  const videos = [...byVideo.values()];
  const requested = events.filter((event) => event.eventType === "AUTHORIZED").length;
  const completed = events.filter((event) => event.eventType === "COMPLETED_CLIENT").length;
  const failed = events.filter((event) => event.eventType === "FAILED").length;
  return {
    summary: { users: users.length, videos: videos.length, requested, completed, failed, unknown: events.filter((event) => event.eventType === "UNKNOWN").length },
    users,
    videos,
    events,
  };
}

export function confirmationLevel(status: string): string {
  if (status === "COMPLETED_CLIENT") return "Recebimento completo informado pelo cliente";
  if (["AUTHORIZED", "REQUESTED"].includes(status)) return "Solicitação registrada";
  if (status === "UNKNOWN") return "Resultado desconhecido";
  return "Evento operacional";
}
