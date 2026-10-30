export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  VIDEOS_VIEW: "videos:view",
  VIDEOS_MANAGE: "videos:manage",
  DOWNLOADS_CREATE: "downloads:create",
  UPLOADS_CREATE: "uploads:create",
  TRANSFERS_VIEW_OWN: "transfers:view-own",
  TRANSFERS_VIEW_ALL: "transfers:view-all",
  DRIVE_VIEW: "drive:view",
  DRIVE_MANAGE: "drive:manage",
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  CAMPAIGN_VIEW: "campaign:view",
  CAMPAIGN_MANAGE: "campaign:manage",
  AUDIT_VIEW: "audit:view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_TEMPLATES = {
  ADMIN: Object.values(PERMISSIONS),
  OPERATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.VIDEOS_VIEW,
    PERMISSIONS.VIDEOS_MANAGE,
    PERMISSIONS.DOWNLOADS_CREATE,
    PERMISSIONS.UPLOADS_CREATE,
    PERMISSIONS.TRANSFERS_VIEW_ALL,
    PERMISSIONS.DRIVE_VIEW,
    PERMISSIONS.DRIVE_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.CAMPAIGN_VIEW,
  ],
  READER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.VIDEOS_VIEW,
    PERMISSIONS.DOWNLOADS_CREATE,
    PERMISSIONS.TRANSFERS_VIEW_OWN,
    PERMISSIONS.CAMPAIGN_VIEW,
  ],
} satisfies Record<string, readonly PermissionCode[]>;

export function hasPermission(granted: readonly string[], required: PermissionCode): boolean {
  return granted.includes(required);
}

export function hasEveryPermission(granted: readonly string[], required: readonly PermissionCode[]): boolean {
  return required.every((permission) => granted.includes(permission));
}
