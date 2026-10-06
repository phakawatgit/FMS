import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/admin-audit.js");
const entries = new Map();

async function loadAudit() {
  vi.resetModules();
  entries.clear();
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  });
  const path = Object.keys(scripts)[0];
  await scripts[path]();
  return window.FMSAdminAudit;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("admin audit log", () => {
  it("logs user and admin activity and records deletions", async () => {
    const audit = await loadAudit();
    const userAction = audit.log("created", { id: 1 });
    expect(userAction).toMatchObject({ action: "created", actor: "User", detail: { id: 1 } });

    sessionStorage.setItem("fms-admin-session", JSON.stringify({ role: "admin" }));
    const deleted = { name: "Medicine" };
    audit.logDeleted("stock", deleted, "cleanup");
    expect(audit.read(audit.DELETED_KEY)[0]).toMatchObject({ collection: "stock", record: deleted, reason: "cleanup" });
    expect(audit.read(audit.ACTIVITY_KEY)[0]).toMatchObject({ action: "delete", actor: "Admin" });
  });

  it("ignores invalid saved values and caps stored logs at 500 records", async () => {
    const audit = await loadAudit();
    entries.set("broken", "not-json");
    entries.set("not-a-list", JSON.stringify({ item: 1 }));
    expect(audit.read("broken")).toEqual([]);
    expect(audit.read("not-a-list")).toEqual([]);

    entries.set(audit.ACTIVITY_KEY, JSON.stringify(Array.from({ length: 500 }, (_, id) => ({ id }))));
    audit.log("latest");
    expect(audit.read(audit.ACTIVITY_KEY)).toHaveLength(500);
    expect(audit.read(audit.ACTIVITY_KEY)[0].action).toBe("latest");
  });

  it("keeps the page working if audit storage writes fail", async () => {
    const audit = await loadAudit();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("FMSStorage", { getItem: () => "[]", setItem: () => { throw new Error("storage disabled"); } });
    expect(() => audit.write("key", [])).not.toThrow();
    expect(warning).toHaveBeenCalledOnce();
  });
});
