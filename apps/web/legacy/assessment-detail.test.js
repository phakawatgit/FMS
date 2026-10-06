import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const frontendPath = resolve(process.cwd(), "../../Front-end");
const scripts = import.meta.glob("../../../Front-end/assessment-detail*.js");
const record = {
  status: "observe", firstName: "Test", lastName: "Visitor", visitorType: "student",
  createdAt: "2026-10-04T10:00:00.000Z", responsibleFromDutyShift: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
  localStorage.clear();
});

it("renders the selected visit and supports editing status and visitor category", async () => {
  const html = readFileSync(resolve(frontendPath, "assessment-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  history.replaceState({}, "", `/legacy/assessment-detail.html?id=${encodeURIComponent(record.createdAt)}`);
  localStorage.setItem("fms-infirmary-visits", JSON.stringify([record]));
  const storage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("record", record);
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? "").replace(/[&<>\"']/g, ""));

  for (const name of ["assessment-detail", "assessment-detail-form-view", "assessment-detail-edit", "assessment-detail-visitor-role", "assessment-detail-status-edit", "assessment-detail-history"]) {
    const script = Object.keys(scripts).find((key) => key.endsWith(`/${name}.js`));
    await scripts[script]();
  }

  expect(document.querySelector("#detail h2").textContent).toContain("Test Visitor");
  document.querySelector("#detail .edit-button").click();
  await new Promise((done) => setTimeout(done, 0));
  document.querySelector("#detail .edit-button").click();
  await new Promise((done) => setTimeout(done, 0));

  const refer = document.querySelector('.status-readonly input[value="refer"]');
  expect(refer).toBeInTheDocument();
  refer.checked = true;
  refer.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector(".status-hospital").classList.contains("is-open")).toBe(true);

  const guest = document.querySelector('.visitor-summary input[value="guest"]');
  guest.checked = true;
  guest.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector(".role-input").name).toBe("visitorDetailExternal");

  document.querySelector("#detail .edit-panel button[type=button]").click();
  expect(document.querySelector("#detail .edit-panel")).toBeNull();

  document.querySelector("#detail .edit-button").click();
  await new Promise((done) => setTimeout(done, 0));
  const statusOptions = [...document.querySelectorAll('.status-readonly input[name="status"]')];
  statusOptions.forEach((option) => { option.checked = option.value === "normal"; });
  document.querySelector("#detail .edit-panel").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(JSON.parse(localStorage.getItem("fms-infirmary-visits"))[0].status).toBe("normal");
  expect(JSON.parse(localStorage.getItem("fms-infirmary-history"))[0].status).toBe("normal");
});

it("renders all visitor fields and both staff attribution fallbacks", async () => {
  const html = readFileSync(resolve(frontendPath, "assessment-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const fullRecord = {
    createdAt: "2026-10-04T10:00:00Z", firstName: "Mina", lastName: "Park", nickname: "Mi", age: 20,
    studentId: "S100", branch: "Science", gender: "female", blood: "O", weight: 55, height: 160,
    symptom: "Headache", medicine: "Tablet", quantity: 2, status: "refer", hospitalName: "Central",
    enteredByName: "Recorder", enteredByNickname: "Rec", responsibleFromDutyShift: false,
  };
  history.replaceState({}, "", `/legacy/assessment-detail.html?id=${encodeURIComponent(fullRecord.createdAt)}`);
  vi.stubGlobal("FMSStorage", { getItem: () => JSON.stringify([fullRecord]) });
  vi.stubGlobal("record", fullRecord);
  vi.stubGlobal("target", document.getElementById("detail"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? "").replace(/[&<>"']/g, ""));
  const path = Object.keys(scripts).find((key) => key.endsWith("/assessment-detail.js"));
  await scripts[path]();
  const detail = document.getElementById("detail").textContent;
  expect(detail).toContain("Mina Park");
  expect(detail).toContain("20 ปี");
  expect(detail).toContain("Central");
  expect(detail).toContain("Recorder (Rec)");
  expect(detail).toContain("ไม่พบข้อมูลเข้าเวร");
});

it("shows a not-found state when the requested visit no longer exists", async () => {
  const html = readFileSync(resolve(frontendPath, "assessment-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  history.replaceState({}, "", "/legacy/assessment-detail.html?id=missing");
  vi.stubGlobal("FMSStorage", { getItem: () => "[]" });
  const path = Object.keys(scripts).find((key) => key.endsWith("/assessment-detail.js"));
  await scripts[path]();
  expect(document.getElementById("detail").classList.contains("empty")).toBe(true);
  expect(document.getElementById("detail").textContent).not.toBe("");
});
