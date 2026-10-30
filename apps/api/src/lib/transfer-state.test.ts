import { describe, expect, it } from "vitest";
import { assertTransferTransition, isFinalStatus } from "./transfer-state";

describe("máquina de estados de transferência", () => {
  it("aceita progresso e conclusão informada pelo cliente", () => {
    expect(() => assertTransferTransition("STARTED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertTransferTransition("IN_PROGRESS", "COMPLETED_CLIENT")).not.toThrow();
  });

  it("impede reabrir uma transferência finalizada", () => {
    expect(() => assertTransferTransition("COMPLETED_CLIENT", "STARTED")).toThrow();
    expect(isFinalStatus("FAILED")).toBe(true);
  });
});
