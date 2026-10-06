import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/borrow-order-activity.js");
const source = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-order-activity.js"), "utf8");
const activityTypes = [...source.matchAll(/summaryTypes\.includes\("([^"]+)"\)/g)].map((match) => match[1]);

async function renderSummary(form, { withAnchor = true, missingStorage = false } = {}) {
  vi.resetModules();
  document.body.innerHTML = `<main id="borrowerDetails">${withAnchor ? '<div class="date-row"></div>' : ""}</main>`;
  vi.stubGlobal("FMSStorage", { getItem: () => missingStorage ? null : JSON.stringify(form) });
  await Object.values(scripts)[0]();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it("supports legacy item arrays and scalar item values with missing detail fallbacks", async () => {
  await renderSummary({ item: [activityTypes[0]] });
  let rows = document.querySelectorAll(".activity-detail");
  expect(rows).toHaveLength(1);
  expect(rows[0].querySelector(".detail-value").textContent).not.toBe("");

  await renderSummary({ item: activityTypes[1], reason: "Personal use" });
  rows = document.querySelectorAll(".activity-detail");
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain("Personal use");
});

it("skips unrelated activity types and safely handles a missing summary anchor", async () => {
  await renderSummary({ items: ["other"] });
  expect(document.querySelectorAll(".activity-detail")).toHaveLength(0);

  await renderSummary({ items: [activityTypes[0]] }, { withAnchor: false });
  expect(document.querySelectorAll(".activity-detail")).toHaveLength(0);
});

it("uses an empty list when a saved borrow form has no item selection", async () => {
  await renderSummary({});
  expect(document.querySelectorAll(".activity-detail")).toHaveLength(0);
  await renderSummary({}, { missingStorage: true });
  expect(document.querySelectorAll(".activity-detail")).toHaveLength(0);
});
