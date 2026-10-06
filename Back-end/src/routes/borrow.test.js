import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { legacy } = require("./borrow.js");

describe("borrow legacy serializer", () => {
  it("maps borrow records and outstanding quantities to the frontend shape", () => {
    const serialized = legacy({
      id: "borrow-1",
      borrowerName: "Alex Student",
      borrowTypes: ["Student"],
      roles: ["Student", "Volunteer"],
      borrowedAt: new Date("2026-09-01T00:00:00.000Z"),
      dueAt: new Date("2026-09-10T00:00:00.000Z"),
      originalDueAt: new Date("2026-09-08T00:00:00.000Z"),
      extendedAt: new Date("2026-09-07T00:00:00.000Z"),
      returnedAt: null,
      status: "PARTIALLY_RETURNED",
      branch: "North",
      nickname: "Al",
      studentId: "S-1",
      phone: "555-0100",
      activity: "Event",
      reason: "Equipment use",
      items: [
        {
          itemName: "Bandage",
          catalogCode: "MED-1",
          quantityBorrowed: 5,
          quantityReturned: 2,
          returns: [
            { returnedAt: new Date("2026-09-05T00:00:00.000Z"), quantity: 2, condition: "Good", note: "" },
          ],
        },
      ],
    });

    expect(serialized).toMatchObject({
      id: "borrow-1",
      item: "Alex Student",
      fullName: "Alex Student",
      borrower: "Student",
      borrowerType: "Student",
      status: "borrowed",
      roles: ["Student", "Volunteer"],
      department: "North",
      extendedDue: expect.any(String),
      stockCommitted: true,
      items: [{ code: "MED-1", quantity: 3 }],
      borrowedItems: [{ code: "MED-1", quantity: 5 }],
      returnHistory: [
        { items: [{ code: "MED-1", quantity: 2, condition: "Good", note: "" }] },
      ],
    });
  });

  it("marks fully returned records and handles absent optional fields", () => {
    const serialized = legacy({
      id: "borrow-2",
      borrowerName: "Sam",
      borrowTypes: [],
      roles: [],
      borrowedAt: new Date("2026-09-01T00:00:00.000Z"),
      dueAt: new Date("2026-09-10T00:00:00.000Z"),
      originalDueAt: null,
      extendedAt: null,
      returnedAt: new Date("2026-09-09T00:00:00.000Z"),
      status: "RETURNED",
      branch: null,
      nickname: null,
      studentId: null,
      phone: null,
      activity: null,
      reason: null,
      items: [],
    });

    expect(serialized).toMatchObject({
      status: "returned",
      borrower: "",
      role: "",
      department: "",
      originalDue: "",
      returnedDate: expect.any(String),
      items: [],
      borrowedItems: [],
      returnHistory: [],
    });
  });
});
