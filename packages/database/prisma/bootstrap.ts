import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PERMISSIONS, ROLE_TEMPLATES } from "@hermes/permissions";
import { PrismaClient } from "../src/generated/client";
import { hashPassword } from "../src/password";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não foi configurada para o bootstrap de produção`);
  return value;
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL ou DATABASE_URL deve ser configurada para o bootstrap de produção");

const admin = {
  email: requiredEnvironment("BOOTSTRAP_ADMIN_EMAIL").toLowerCase(),
  name: requiredEnvironment("BOOTSTRAP_ADMIN_NAME"),
  password: requiredEnvironment("BOOTSTRAP_ADMIN_PASSWORD"),
};

if (admin.password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres");

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
  [PERMISSIONS.USERS_MANAGE]: "Criar usuários, redefinir senhas e alterar perfis",
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
  const passwordHash = await hashPassword(admin.password);
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

  const existingUser = await prisma.user.findUnique({ where: { email: admin.email } });
  const user = await prisma.user.upsert({
    where: { email: admin.email },
    update: { name: admin.name, passwordHash, status: "ACTIVE", deletedAt: null, sessionVersion: { increment: 1 } },
    create: { authId: `local-${crypto.randomUUID()}`, email: admin.email, name: admin.name, passwordHash, status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRoleId } },
    update: {},
    create: { userId: user.id, roleId: adminRoleId },
  });

  console.info(`Bootstrap concluído: ${admin.email} está ativo como administrador${existingUser ? " e teve a senha atualizada" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
