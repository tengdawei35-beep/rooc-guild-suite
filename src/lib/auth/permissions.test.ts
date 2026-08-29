import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("guild permissions", () => {
  it("grants ADMIN full access", () => {
    expect(hasPermission("ADMIN", "guild.manage")).toBe(true);
    expect(hasPermission("ADMIN", "users.manage")).toBe(true);
    expect(hasPermission("ADMIN", "allocation.view")).toBe(true);
  });

  it("keeps MANAGER out of guild settings", () => {
    expect(hasPermission("MANAGER", "guild.manage")).toBe(false);
    expect(hasPermission("MANAGER", "members.edit")).toBe(true);
    expect(hasPermission("MANAGER", "allocation.view")).toBe(true);
  });

  it("keeps OFFICER out of user administration", () => {
    expect(hasPermission("OFFICER", "users.view")).toBe(true);
    expect(hasPermission("OFFICER", "users.manage")).toBe(false);
  });

  it("keeps MEMBER read-only except own profile and leave", () => {
    expect(hasPermission("MEMBER", "members.view")).toBe(true);
    expect(hasPermission("MEMBER", "profile.editOwn")).toBe(true);
    expect(hasPermission("MEMBER", "leave.manageOwn")).toBe(true);
    expect(hasPermission("MEMBER", "members.edit")).toBe(false);
    expect(hasPermission("MEMBER", "rosters.edit")).toBe(false);
    expect(hasPermission("MEMBER", "allocation.view")).toBe(false);
  });
});
