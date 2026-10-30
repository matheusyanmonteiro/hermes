export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "INVITED";
export type TransferStatus = "PENDING" | "REQUESTED" | "AUTHORIZED" | "STARTED" | "IN_PROGRESS" | "COMPLETED_CLIENT" | "FAILED" | "CANCELLED" | "UNKNOWN";

export interface CurrentUser {
  user: { id: string; authId: string; name: string; email: string; status: UserStatus };
  roles: string[];
  permissions: string[];
}

export interface Campaign {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED";
  closedAt?: string | null;
}

export interface DriveAccount {
  id: string;
  email: string;
  displayName?: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING";
  lastSyncedAt?: string | null;
  lastError?: string | null;
  _count?: { folders: number; videos: number };
}

export interface Video {
  id: string;
  name: string;
  sizeBytes: string;
  mimeType: string;
  durationSeconds?: number | null;
  driveModifiedAt: string;
  account: { id: string; email: string; displayName?: string | null };
  folder?: { id: string; name: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
}

export interface Transfer {
  id: string;
  status: TransferStatus;
  fileNameSnapshot: string;
  fileSizeSnapshot: string;
  bytesTransferred: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  batch: { type: "UPLOAD" | "DOWNLOAD"; user: { id: string; name: string; email: string } };
}
