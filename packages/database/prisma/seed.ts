import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransferStatus, TransferType } from "../src/generated/client";
import { PERMISSIONS, ROLE_TEMPLATES } from "@hermes/permissions";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não foi configurada para o seed");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const permissionDescriptions: Record<string, string> = {
  [PERMISSIONS.DASHBOARD_VIEW]: "Visualizar indicadores do painel",
  [PERMISSIONS.VIDEOS_VIEW]: "Visualizar o catálogo de vídeos",
  [PERMISSIONS.VIDEOS_MANAGE]: "Editar metadados e classificações",
  [PERMISSIONS.DOWNLOADS_CREATE]: "Solicitar downloads",
  [PERMISSIONS.UPLOADS_CREATE]: "Enviar arquivos ao Drive",
  [PERMISSIONS.TRANSFERS_VIEW_OWN]: "Visualizar as próprias transferências",
  [PERMISSIONS.TRANSFERS_VIEW_ALL]: "Visualizar todas as transferências",
  [PERMISSIONS.DRIVE_VIEW]: "Visualizar contas do Google Drive",
  [PERMISSIONS.DRIVE_MANAGE]: "Conectar e sincronizar contas do Google Drive",
  [PERMISSIONS.USERS_VIEW]: "Visualizar usuários e perfis",
  [PERMISSIONS.USERS_MANAGE]: "Convidar, bloquear e alterar perfis",
  [PERMISSIONS.REPORTS_VIEW]: "Visualizar relatórios",
  [PERMISSIONS.REPORTS_EXPORT]: "Exportar relatórios",
  [PERMISSIONS.CAMPAIGN_VIEW]: "Visualizar o período operacional",
  [PERMISSIONS.CAMPAIGN_MANAGE]: "Configurar e encerrar campanhas",
  [PERMISSIONS.AUDIT_VIEW]: "Visualizar auditoria administrativa",
};

async function seedPermissionsAndRoles() {
  const permissions = new Map<string, string>();
  for (const code of Object.values(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { description: permissionDescriptions[code] },
      create: { code, description: permissionDescriptions[code] },
    });
    permissions.set(code, permission.id);
  }

  const templates = [
    { code: "ADMIN", name: "Administrador", description: "Acesso completo e configuração do portal" },
    { code: "OPERATOR", name: "Operador", description: "Opera catálogo, contas e transferências" },
    { code: "READER", name: "Leitor", description: "Consulta e baixa os vídeos permitidos" },
  ] as const;

  const roles = new Map<string, string>();
  for (const template of templates) {
    const role = await prisma.role.upsert({
      where: { code: template.code },
      update: { name: template.name, description: template.description, isSystem: true },
      create: { ...template, isSystem: true },
    });
    roles.set(template.code, role.id);

    const codes = ROLE_TEMPLATES[template.code];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({ roleId: role.id, permissionId: permissions.get(code)! })),
      skipDuplicates: true,
    });
  }

  return roles;
}

async function seedUsers(roles: Map<string, string>) {
  const entries = [
    { authId: "dev-admin", name: "Ana Administradora", email: "admin@hermes.local", role: "ADMIN" },
    { authId: "dev-operator", name: "Otávio Operador", email: "operador@hermes.local", role: "OPERATOR" },
    { authId: "dev-reader", name: "Lívia Leitora", email: "leitor@hermes.local", role: "READER" },
  ];

  const users = new Map<string, string>();
  for (const entry of entries) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: { authId: entry.authId, name: entry.name, status: "ACTIVE" },
      create: { authId: entry.authId, name: entry.name, email: entry.email, status: "ACTIVE" },
    });
    users.set(entry.role, user.id);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles.get(entry.role)! } },
      update: {},
      create: { userId: user.id, roleId: roles.get(entry.role)! },
    });
  }
  return users;
}

async function seedCatalog() {
  const account = await prisma.driveAccount.upsert({
    where: { email: "acervo@instituto.local" },
    update: { displayName: "Acervo pedagógico", status: "CONNECTED" },
    create: { email: "acervo@instituto.local", displayName: "Acervo pedagógico", status: "CONNECTED" },
  });

  const folder = await prisma.driveFolder.upsert({
    where: { accountId_driveFolderId: { accountId: account.id, driveFolderId: "demo-folder-aulas" } },
    update: { name: "Aulas 2026", syncEnabled: true },
    create: { accountId: account.id, driveFolderId: "demo-folder-aulas", name: "Aulas 2026" },
  });

  const tagData = [
    { name: "Formação", color: "#2563eb" },
    { name: "Ensino médio", color: "#7c3aed" },
    { name: "Ciências", color: "#059669" },
  ];
  const tags = new Map<string, string>();
  for (const data of tagData) {
    const tag = await prisma.tag.upsert({ where: { name: data.name }, update: data, create: data });
    tags.set(data.name, tag.id);
  }

  const now = Date.now();
  const videos = [
    { driveFileId: "demo-001", name: "Formação de professores — abertura.mp4", sizeBytes: 1_284_280_832n, mimeType: "video/mp4", durationSeconds: 2840, tag: "Formação", daysAgo: 1 },
    { driveFileId: "demo-002", name: "Biologia — ecossistemas brasileiros.mp4", sizeBytes: 842_006_528n, mimeType: "video/mp4", durationSeconds: 1934, tag: "Ciências", daysAgo: 3 },
    { driveFileId: "demo-003", name: "Matemática — funções e gráficos.webm", sizeBytes: 526_385_152n, mimeType: "video/webm", durationSeconds: 2387, tag: "Ensino médio", daysAgo: 5 },
    { driveFileId: "demo-004", name: "Metodologias ativas em sala de aula.mp4", sizeBytes: 1_047_576_576n, mimeType: "video/mp4", durationSeconds: 3150, tag: "Formação", daysAgo: 8 },
    { driveFileId: "demo-005", name: "Física — movimento e energia.mp4", sizeBytes: 735_051_776n, mimeType: "video/mp4", durationSeconds: 2105, tag: "Ciências", daysAgo: 11 },
    { driveFileId: "demo-006", name: "Literatura brasileira — modernismo.mp4", sizeBytes: 618_659_840n, mimeType: "video/mp4", durationSeconds: 1850, tag: "Ensino médio", daysAgo: 14 },
  ];

  const created = [];
  for (const item of videos) {
    const { tag, daysAgo, ...data } = item;
    const video = await prisma.video.upsert({
      where: { accountId_driveFileId: { accountId: account.id, driveFileId: data.driveFileId } },
      update: { ...data, driveModifiedAt: new Date(now - daysAgo * 86_400_000) },
      create: { ...data, accountId: account.id, folderId: folder.id, driveModifiedAt: new Date(now - daysAgo * 86_400_000) },
    });
    await prisma.videoTag.upsert({
      where: { videoId_tagId: { videoId: video.id, tagId: tags.get(tag)! } },
      update: {},
      create: { videoId: video.id, tagId: tags.get(tag)! },
    });
    created.push(video);
  }
  return { account, videos: created };
}

async function seedCampaign() {
  const current = await prisma.campaign.findFirst({ orderBy: { createdAt: "desc" } });
  const startsAt = new Date(Date.now() - 15 * 86_400_000);
  const endsAt = new Date(Date.now() + 15 * 86_400_000);
  if (current) {
    return prisma.campaign.update({
      where: { id: current.id },
      data: { name: "Campanha educacional 2026", startsAt, endsAt, status: "ACTIVE", closedAt: null },
    });
  }
  return prisma.campaign.create({
    data: { name: "Campanha educacional 2026", startsAt, endsAt, status: "ACTIVE" },
  });
}

async function seedTransfers(userId: string, accountId: string, videos: { id: string; name: string; sizeBytes: bigint; mimeType: string }[]) {
  const batch = await prisma.transferBatch.upsert({
    where: { userId_idempotencyKey: { userId, idempotencyKey: "seed-downloads" } },
    update: {},
    create: {
      userId,
      accountId,
      type: TransferType.DOWNLOAD,
      status: TransferStatus.COMPLETED_CLIENT,
      idempotencyKey: "seed-downloads",
      totalFiles: 3,
      totalBytes: videos.slice(0, 3).reduce((sum, video) => sum + video.sizeBytes, 0n),
    },
    include: { transfers: true },
  });

  if (batch.transfers.length === 0) {
    for (const [index, video] of videos.slice(0, 3).entries()) {
      const status = index === 2 ? TransferStatus.FAILED : TransferStatus.COMPLETED_CLIENT;
      const transfer = await prisma.transfer.create({
        data: {
          batchId: batch.id,
          videoId: video.id,
          status,
          fileNameSnapshot: video.name,
          fileSizeSnapshot: video.sizeBytes,
          sourceSnapshot: "acervo@instituto.local",
          mimeTypeSnapshot: video.mimeType,
          bytesTransferred: status === TransferStatus.COMPLETED_CLIENT ? video.sizeBytes : video.sizeBytes / 3n,
          startedAt: new Date(Date.now() - (index + 1) * 86_400_000),
          finishedAt: new Date(Date.now() - (index + 1) * 86_400_000 + 300_000),
          errorCode: status === TransferStatus.FAILED ? "NETWORK_INTERRUPTED" : null,
        },
      });
      await prisma.downloadEvent.create({
        data: {
          transferId: transfer.id,
          userId,
          eventType: status,
          bytesTransferred: transfer.bytesTransferred,
          correlationId: `seed-${index + 1}`,
          occurredAt: transfer.finishedAt!,
        },
      });
    }
  }
}

async function main() {
  const roles = await seedPermissionsAndRoles();
  const users = await seedUsers(roles);
  const catalog = await seedCatalog();
  await seedCampaign();
  await seedTransfers(users.get("READER")!, catalog.account.id, catalog.videos);
  console.info("Seed concluído: perfis, usuários, campanha e catálogo de demonstração prontos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
