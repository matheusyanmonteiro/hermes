import type { TransferStatus } from "@hermes/contracts";
import { ApiError } from "./errors";

const allowedTransitions: Record<TransferStatus, readonly TransferStatus[]> = {
  PENDING: ["AUTHORIZED", "STARTED", "CANCELLED", "FAILED"],
  REQUESTED: ["AUTHORIZED", "CANCELLED", "FAILED"],
  AUTHORIZED: ["STARTED", "CANCELLED", "FAILED", "UNKNOWN"],
  STARTED: ["IN_PROGRESS", "COMPLETED_CLIENT", "FAILED", "CANCELLED", "UNKNOWN"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED_CLIENT", "FAILED", "CANCELLED", "UNKNOWN"],
  COMPLETED_CLIENT: [],
  FAILED: [],
  CANCELLED: [],
  UNKNOWN: [],
};

export function assertTransferTransition(current: TransferStatus, next: TransferStatus): void {
  if (!allowedTransitions[current].includes(next)) {
    throw new ApiError(409, "INVALID_TRANSFER_TRANSITION", `Transição inválida de ${current} para ${next}`);
  }
}

export function isFinalStatus(status: TransferStatus): boolean {
  return ["COMPLETED_CLIENT", "FAILED", "CANCELLED", "UNKNOWN"].includes(status);
}
