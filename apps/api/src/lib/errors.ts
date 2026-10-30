import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    return new ApiError(422, "VALIDATION_ERROR", "Os dados enviados são inválidos", error.issues);
  }
  console.error(error);
  return new ApiError(500, "INTERNAL_ERROR", "Não foi possível concluir a operação");
}
