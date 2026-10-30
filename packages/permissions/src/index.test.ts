import { describe, expect, it } from "vitest";
import { hasEveryPermission, hasPermission, PERMISSIONS, ROLE_TEMPLATES } from "./index";

describe("políticas de permissão", () => {
  it("mantém o administrador com todas as permissões", () => {
    expect(ROLE_TEMPLATES.ADMIN).toEqual(Object.values(PERMISSIONS));
  });

  it("não concede uma permissão ausente", () => {
    expect(hasPermission(ROLE_TEMPLATES.READER, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasEveryPermission(ROLE_TEMPLATES.READER, [PERMISSIONS.VIDEOS_VIEW, PERMISSIONS.DOWNLOADS_CREATE])).toBe(true);
  });
});
