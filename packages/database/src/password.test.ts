import { describe, expect, it } from "vitest";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "./password";

describe("password", () => {
  it("gera um hash versionado e valida somente a senha correta", async () => {
    const hash = await hashPassword("uma-senha-forte-e-unica");
    expect(hash).toMatch(/^scrypt\$32768\$8\$3\$/);
    await expect(verifyPassword("uma-senha-forte-e-unica", hash)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", hash)).resolves.toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it("identifica hashes legados para atualização após o login", () => {
    expect(passwordNeedsRehash("salt:hash-legado")).toBe(true);
    expect(passwordNeedsRehash(null)).toBe(true);
  });
});
