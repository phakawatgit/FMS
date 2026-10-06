import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/assessment-detail-edit.js");
const historyScripts = import.meta.glob("../../../Front-end/assessment-detail-history.js");
const statusScripts = import.meta.glob("../../../Front-end/assessment-detail-status-edit.js");
const formViewScripts = import.meta.glob("../../../Front-end/assessment-detail-form-view.js");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it("opens only one edit panel and safely ignores a visit removed before save", async () => {
  const visit = { status: "observe", visitorType: "guest", createdAt: "removed-visit", firstName: "Rin" };
  document.body.innerHTML = '<main id="detail"></main>';
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("record", visit);
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? ""));
  await Object.values(scripts)[0]();

  const editButton = document.querySelector(".edit-button");
  editButton.click();
  editButton.click();
  expect(document.querySelectorAll(".edit-panel")).toHaveLength(1);
  expect(document.querySelector('.edit-panel input[name="visitorType"][value="guest"]').checked).toBe(true);
  document.querySelector(".edit-panel").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(storage.getItem).toHaveBeenCalledWith("fms-infirmary-visits");
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("does not add the observe edit form to a completed visit", async () => {
  document.body.innerHTML = '<main id="detail"></main>';
  vi.stubGlobal("FMSStorage", { getItem: () => "[]", setItem: vi.fn() });
  vi.stubGlobal("record", { status: "normal" });
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", String);
  await Object.values(scripts)[0]();
  expect(document.querySelector(".edit-button")).toBeNull();
});

it("saves editable fields when the original visit is still present and defaults its visitor type", async () => {
  const visit = { status: "observe", createdAt: "current-visit" };
  document.body.innerHTML = '<main id="detail"></main>';
  const storage = {
    getItem: vi.fn(() => JSON.stringify([visit])),
    setItem: vi.fn(),
  };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("record", visit);
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? ""));
  await Object.values(scripts)[0]();
  document.querySelector(".edit-button").click();
  const panel = document.querySelector(".edit-panel");
  expect(panel.querySelector('input[name="visitorType"][value="student"]').checked).toBe(true);
  panel.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(storage.setItem).toHaveBeenCalledWith("fms-infirmary-visits", expect.any(String));
  expect(JSON.parse(storage.setItem.mock.calls[0][1])[0].createdAt).toBe("current-visit");
});

it("ignores unrelated and in-progress submits and tolerates visits missing from storage", async () => {
  document.body.innerHTML = '<main id="detail"><form id="unrelated"></form><form class="edit-panel"><input name="status" value="observe" /></form></main>';
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("record", { createdAt: "removed-visit" });
  vi.stubGlobal("target", document.getElementById("detail"));
  await Object.values(historyScripts)[0]();

  const unrelated = document.getElementById("unrelated");
  unrelated.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const form = document.querySelector(".edit-panel");
  const inProgress = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(inProgress);
  expect(inProgress.defaultPrevented).toBe(false);

  form.elements.status.value = "normal";
  const completed = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(completed);
  expect(completed.defaultPrevented).toBe(true);
  expect(storage.getItem).toHaveBeenCalledWith("fms-infirmary-visits");
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("completes a stored visit and removes its old history copy", async () => {
  const visit = { createdAt: "current-visit", status: "observe" };
  document.body.innerHTML = '<main id="detail"><form class="edit-panel"><input name="status" value="normal" /></form></main>';
  const historyRecords = [visit, { createdAt: "older-visit", status: "normal" }];
  const values = new Map([
    ["fms-infirmary-visits", JSON.stringify([visit])],
    ["fms-infirmary-history", JSON.stringify(historyRecords)],
  ]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: vi.fn((key, value) => values.set(key, value)) };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("record", visit);
  vi.stubGlobal("target", document.getElementById("detail"));
  await Object.values(historyScripts)[0]();

  document.querySelector(".edit-panel").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(JSON.parse(values.get("fms-infirmary-history")).map(({ createdAt }) => createdAt)).toEqual(["current-visit", "older-visit"]);
  expect(JSON.parse(values.get("fms-infirmary-visits"))[0].status).toBe("normal");
});

it("does not install history completion handling without a selected visit", async () => {
  document.body.innerHTML = '<main id="detail"><form class="edit-panel"><input name="status" value="normal" /></form></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  delete globalThis.record;
  await Object.values(historyScripts)[0]();
  const event = new Event("submit", { bubbles: true, cancelable: true });
  document.querySelector(".edit-panel").dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

it("does not install status controls when the selected visit is unavailable", async () => {
  document.body.innerHTML = '<main id="detail"><button class="edit-button"></button></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  delete globalThis.record;
  await Object.values(statusScripts)[0]();
  document.querySelector(".edit-button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector(".status-readonly")).toBeNull();
});

it("skips status editing when the detail template has no status area", async () => {
  document.body.innerHTML = '<main id="detail"><button class="edit-button"></button></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("record", { status: "observe" });
  await Object.values(statusScripts)[0]();
  document.querySelector(".edit-button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector(".status-readonly")).toBeNull();
});

it("renders sparse guest records with empty and unknown-value fallbacks", async () => {
  document.body.innerHTML = '<main id="detail"></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("record", { status: "legacy", visitorType: "guest", createdAt: null, responsibleFromDutyShift: false, enteredByName: "Clerk", enteredByNickname: "C", hospitalName: "City" });
  vi.stubGlobal("escapeHtml", (value) => String(value ?? ""));
  await Object.values(formViewScripts)[0]();
  const detail = document.getElementById("detail");
  expect(detail.querySelector(".detail-visitor .guest")).toBeTruthy();
  expect(detail.querySelector(".detail-status").textContent).toContain("-");
  expect(detail.querySelectorAll(".detail-staff")[0].textContent).toContain("Clerk (C)");
  expect(detail.querySelectorAll(".detail-staff")[1].textContent).not.toContain("-");
});

it("skips the detail form view when no visit is available", async () => {
  document.body.innerHTML = '<main id="detail"></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? ""));
  delete globalThis.record;
  await Object.values(formViewScripts)[0]();
  expect(document.getElementById("detail").innerHTML).toBe("");
});

it("renders staff names without adding parentheses when no nickname was recorded", async () => {
  document.body.innerHTML = '<main id="detail"></main>';
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("record", { enteredByName: "Clerk", responsibleFromDutyShift: true });
  vi.stubGlobal("escapeHtml", (value) => String(value ?? ""));
  await Object.values(formViewScripts)[0]();
  expect(document.querySelectorAll(".detail-staff")[0].textContent).toContain("Clerk");
  expect(document.querySelectorAll(".detail-staff")[0].textContent).not.toContain("(");
});
