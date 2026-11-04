import { describe, expect, it } from "vitest";
import { campaignSchema, inviteUserSchema, paginationSchema } from "./index";

describe("contratos compartilhados", () => {
  it("limita a paginação", () => {
    expect(paginationSchema.parse({ page: "2", pageSize: "50" })).toEqual({ page: 2, pageSize: 50 });
    expect(() => paginationSchema.parse({ pageSize: "101" })).toThrow();
  });

  it("recusa campanha com encerramento anterior à abertura", () => {
    expect(() => campaignSchema.parse({ name: "Campanha teste", startsAt: "2026-11-02T12:00:00.000Z", endsAt: "2026-11-01T12:00:00.000Z" })).toThrow();
  });

  it("exige pelo menos 12 caracteres nas senhas de usuários novos", () => {
    const input = { name: "Usuário teste", email: "usuario@hermes.test", roleIds: ["019a4dc5-b945-76b1-a18f-057ca88bdbca"] };
    expect(() => inviteUserSchema.parse({ ...input, password: "curta-123" })).toThrow();
    expect(inviteUserSchema.parse({ ...input, password: "senha-segura-123" }).password).toBe("senha-segura-123");
  });
});
