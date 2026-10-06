import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/page-tools.js");

async function loadPage(path, { visits = [], historyRecords = [], record, controls = true, existingPanel = false, omitVisits = false, omitHistory = false } = {}) {
  document.body.innerHTML = `<main class="page"><h1>Initial</h1></main>${controls ? `<button class="export-excel"></button><button class="export-pdf"></button><button class="language-tool"><span>ไทย</span></button><button id="notificationButton"></button>` : ""}${existingPanel ? `<aside id="notificationPanel"></aside>` : ""}`;
  document.documentElement.lang = "th";
  history.replaceState({}, "", path);
  const values = new Map([
    ["fms-infirmary-visits", JSON.stringify(visits)],
    ["fms-infirmary-history", JSON.stringify(historyRecords)],
  ]);
  if (omitVisits) values.delete("fms-infirmary-visits");
  if (omitHistory) values.delete("fms-infirmary-history");
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null });
  if (record === undefined) delete globalThis.record;
  else vi.stubGlobal("record", record);
  vi.stubGlobal("print", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:page-tools"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.resetModules();
  await Object.values(scripts)[0]();
  return { values, URLStub };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("shared infirmary assessment page tools", () => {
  it("exports history as quoted CSV, prints, translates, and toggles its shared notification panel", async () => {
    const { URLStub } = await loadPage("/legacy/infirmary-history.html", {
      historyRecords: [{ firstName: 'A "quoted" patient', lastName: "Doe" }],
    });
    document.querySelector(".export-excel").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
    document.querySelector(".export-pdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.querySelector(".language-tool").click();
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector(".page h1").textContent).toBe("History");
    document.querySelector(".language-tool").click();
    expect(document.documentElement.lang).toBe("th");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("closeNotification").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });

  it("exports only pending assessment records and translates the pending title", async () => {
    const { values, URLStub } = await loadPage("/legacy/pending.html", {
      visits: [{ firstName: "Observe", status: "observe" }, { firstName: "Done", status: "complete" }],
      existingPanel: true,
    });
    document.querySelector(".export-excel").click();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(document.getElementById("notificationPanel").querySelector("strong")).toBeNull();
    document.querySelector(".language-tool").click();
    expect(document.querySelector(".page h1").textContent).toBe("Pending assessment");
    expect(values.get("fms-infirmary-visits")).toContain("Observe");
  });

  it("uses the active visitor record for detail export and handles pages without optional controls", async () => {
    const activeRecord = { firstName: "Ava", lastName: "Nurse", symptom: 'pain, "mild"' };
    const { URLStub } = await loadPage("/legacy/assessment-detail.html", { record: activeRecord });
    document.querySelector(".export-excel").click();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    document.querySelector(".language-tool").click();
    expect(document.querySelector(".page h1").textContent).toBe("Visitor details");
    document.querySelector(".language-tool").click();
    expect(document.documentElement.lang).toBe("th");

    await loadPage("/legacy/assessment-detail.html", { record: activeRecord, controls: false });
    expect(document.getElementById("notificationPanel")).toBeNull();
    await loadPage("/legacy/assessment-detail.html", { omitVisits: true });
    document.querySelector(".export-excel").click();
    await loadPage("/legacy/infirmary-history.html", { omitHistory: true });
    document.querySelector(".language-tool").click();
    expect(document.querySelector(".page h1").textContent).toBe("History");
    await loadPage("/legacy/pending.html");
    document.querySelector(".language-tool").click();
    expect(document.querySelector(".page h1").textContent).toBe("Pending assessment");
    document.querySelector(".language-tool").click();
    expect(document.documentElement.lang).toBe("th");
  });
});
