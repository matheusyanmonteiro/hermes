import { describe, expect, it } from "vitest";
import { campaignSchema, paginationSchema } from "./index";

describe("contratos compartilhados", () => {
  it("limita a paginação", () => {
    expect(paginationSchema.parse({ page: "2", pageSize: "50" })).toEqual({ page: 2, pageSize: 50 });
    expect(() => paginationSchema.parse({ pageSize: "101" })).toThrow();
  });

  it("recusa campanha com encerramento anterior à abertura", () => {
    expect(() => campaignSchema.parse({ name: "Campanha teste", startsAt: "2026-11-02T12:00:00.000Z", endsAt: "2026-11-01T12:00:00.000Z" })).toThrow();
  });
});
