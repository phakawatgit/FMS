import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { normalize } = require("./catalog.js");

const validRecord = {
  code: "MED-001",
  name: "Bandage",
  category: "First aid",
  unit: "box",
  total: 20,
  used: 3,
  remaining: 999,
  storageLocation: " Cabinet A ",
};

describe("catalog record normalization", () => {
  it("trims text fields and derives remaining stock from total and used", () => {
    const normalized = normalize(validRecord);

    expect(normalized).toMatchObject({
      code: "MED-001",
      name: "Bandage",
      storageLocation: "Cabinet A",
      total: 20,
      used: 3,
      remaining: 17,
    });
  });

  it("caps used stock at total and defaults empty unit and status", () => {
    const normalized = normalize({ ...validRecord, used: 30, unit: "", status: "" });

    expect(normalized).toMatchObject({ used: 20, remaining: 0, unit: "unit" });
    expect(normalized.status).toBeTruthy();
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid inventory amount %s", (amount) => {
    expect(() => normalize({ ...validRecord, total: amount })).toThrow("invalid inventory amount");
  });

  it("rejects overlong storage locations and malformed expiry dates", () => {
    expect(() => normalize({ ...validRecord, storageLocation: "x".repeat(201) })).toThrow("storage location too long");
    expect(() => normalize({ ...validRecord, expiry: "04-10-2026" })).toThrow("invalid expiry");
  });
});
