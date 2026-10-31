const actions: Record<string, string> = {
  "users.invited": "Usuário cadastrado",
  "users.access.updated": "Acesso do usuário atualizado",
  "users.roles.updated": "Perfil do usuário atualizado",
  "campaign.updated": "Campanha atualizada",
  "campaign.closed": "Campanha encerrada",
  "uploads.batch.created": "Upload iniciado",
  "downloads.batch.created": "Download solicitado",
  "drive.account.connected": "Conta do Google Drive conectada",
  "drive.account.synced": "Conta do Google Drive sincronizada",
};

const resources: Record<string, string> = {
  user: "Usuário",
  campaign: "Campanha",
  transfer_batch: "Lote de transferência",
  drive_account: "Conta do Google Drive",
  video: "Vídeo",
  tag: "Etiqueta",
};

export function auditActionLabel(action: string): string {
  return actions[action] ?? action.replaceAll(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function auditResourceLabel(resource: string): string {
  return resources[resource] ?? resource.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
