import { z } from "zod";

export const uuidSchema = z.uuid();
export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const userStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
  "INVITED",
]);

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  roleIds: z.array(uuidSchema).min(1).max(10),
  password: z.string().min(12).max(200),
});

export const updateUserRolesSchema = z.object({
  roleIds: z.array(uuidSchema).min(1).max(10),
});
export const updateUserAccessSchema = z
  .object({
    password: z.string().min(12).max(200).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => value.password || value.status, {
    message: "Informe uma alteração",
  });

export const googleDriveConfigurationSchema = z.object({
  clientId: z.string().trim().min(10).max(255),
  clientSecret: z.string().trim().min(8).max(500),
  redirectUri: z.url().max(500),
});

export const driveFolderSelectionSchema = z.object({
  folderIds: z.array(z.string().min(1).max(255)).min(1).max(1000),
});

export const createDriveFolderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: z.string().min(1).max(255).optional(),
});

export const updateDriveAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
});

export const videoListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  accountId: uuidSchema.optional(),
  folderId: uuidSchema.optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z
    .enum(["name", "size", "modifiedAt", "createdAt"])
    .default("modifiedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const transferTypeSchema = z.enum(["UPLOAD", "DOWNLOAD"]);
export const transferStatusSchema = z.enum([
  "PENDING",
  "REQUESTED",
  "AUTHORIZED",
  "STARTED",
  "IN_PROGRESS",
  "COMPLETED_CLIENT",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
]);

export const createDownloadSchema = z.object({
  videoIds: z.array(uuidSchema).min(1).max(100),
});

export const downloadEventSchema = z.object({
  eventType: z.enum([
    "STARTED",
    "PROGRESS",
    "COMPLETED_CLIENT",
    "FAILED",
    "CANCELLED",
    "UNKNOWN",
  ]),
  bytesTransferred: z.number().int().nonnegative().optional(),
  errorCode: z.string().trim().max(80).optional(),
  errorMessage: z.string().trim().max(500).optional(),
  occurredAt: z.iso.datetime().optional(),
});

export const createUploadSessionsSchema = z.object({
  accountId: uuidSchema,
  folderId: uuidSchema,
  tagIds: z.array(uuidSchema).max(10).default([]),
  files: z
    .array(
      z.object({
        clientId: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(255),
        sizeBytes: z.number().int().positive(),
        mimeType: z.string().trim().min(1).max(150),
      }),
    )
    .min(1)
    .max(100),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
});
export const applyTagToVideosSchema = z.object({
  videoIds: z.array(uuidSchema).min(1).max(100),
  tagId: uuidSchema,
});

export const completeUploadSchema = z.object({
  driveFileId: z.string().min(1).max(255),
  checksum: z.string().max(255).optional(),
});

export const transferListQuerySchema = paginationSchema.extend({
  type: transferTypeSchema.optional(),
  status: transferStatusSchema.optional(),
});

export const reportQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  userId: uuidSchema.optional(),
  videoId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  status: transferStatusSchema.optional(),
});

export const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
  })
  .refine((data) => new Date(data.startsAt) < new Date(data.endsAt), {
    message: "A data final deve ser posterior à data inicial",
    path: ["endsAt"],
  });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string(),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type VideoListQuery = z.infer<typeof videoListQuerySchema>;
export type CreateDownloadInput = z.infer<typeof createDownloadSchema>;
export type DownloadEventInput = z.infer<typeof downloadEventSchema>;
export type CreateUploadSessionsInput = z.infer<
  typeof createUploadSessionsSchema
>;
export type TransferStatus = z.infer<typeof transferStatusSchema>;
