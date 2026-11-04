import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PERMISSIONS, ROLE_TEMPLATES } from "@hermes/permissions";
import { PrismaClient } from "../src/generated/client";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não foi configurada para o bootstrap de produção`);
  return value;
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL ou DATABASE_URL deve ser configurada para o bootstrap de produção");

const admin = {
  authId: requiredEnvironment("BOOTSTRAP_ADMIN_AUTH_ID"),
  email: requiredEnvironment("BOOTSTRAP_ADMIN_EMAIL").toLowerCase(),
  name: requiredEnvironment("BOOTSTRAP_ADMIN_NAME"),
};

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(admin.authId)) {
  throw new Error("BOOTSTRAP_ADMIN_AUTH_ID deve ser o UUID do usuário criado no Supabase Auth");
}

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

const roleDefinitions = [
  { code: "ADMIN", name: "Administrador", description: "Acesso completo e configuração do portal" },
  { code: "OPERATOR", name: "Operador", description: "Opera catálogo, contas e transferências" },
  { code: "READER", name: "Leitor", description: "Consulta e baixa os vídeos permitidos" },
] as const;

async function main() {
  const permissions = new Map<string, string>();
  for (const code of Object.values(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { description: permissionDescriptions[code] },
      create: { code, description: permissionDescriptions[code] },
    });
    permissions.set(code, permission.id);
  }

  let adminRoleId = "";
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: { name: definition.name, description: definition.description, isSystem: true },
      create: { ...definition, isSystem: true },
    });
    if (definition.code === "ADMIN") adminRoleId = role.id;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_TEMPLATES[definition.code].map((code) => ({ roleId: role.id, permissionId: permissions.get(code)! })),
      skipDuplicates: true,
    });
  }

  const user = await prisma.user.upsert({
    where: { email: admin.email },
    update: { authId: admin.authId, name: admin.name, status: "ACTIVE", deletedAt: null },
    create: { ...admin, status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRoleId } },
    update: {},
    create: { userId: user.id, roleId: adminRoleId },
  });

  console.info(`Bootstrap concluído: ${admin.email} está ativo como administrador.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
