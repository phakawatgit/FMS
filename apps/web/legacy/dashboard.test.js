import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/dashboard.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/dashboard.js");

async function load() {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  vi.stubGlobal("FMSStorage", { getItem: () => "[]" });
  vi.spyOn(window, "setInterval").mockReturnValue(0);
  vi.spyOn(window, "print").mockImplementation(() => {});
  await Object.values(scripts)[0]();
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); });

describe("dashboard UI controls", () => {
  it("renders calendar, refreshes ranges and faculty-dependent branches, and resets filters", async () => {
    await load();
    expect(document.getElementById("dutyCalendar")).toBeNull();
    const faculty = document.getElementById("facultySelect");
    const facultyWrapper = faculty.closest(".custom-select");
    facultyWrapper.querySelector(".custom-select-trigger").click();
    expect(facultyWrapper.classList.contains("is-open")).toBe(true);
    const option = facultyWrapper.querySelector("[data-custom-value]:not([data-custom-value='all'])");
    option.click();
    expect(faculty.value).not.toBe("all");
    expect(document.getElementById("branchInput").options.length).toBeGreaterThan(1);
    document.getElementById("startDate").value = "2026-10-01";
    document.getElementById("startDate").dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.getElementById("startDate").value).toBe("2026-10-01");
    document.getElementById("resetButton").click();
    expect(document.getElementById("startDate").value).toBe("");
    expect(faculty.value).toBe("all");
    expect(document.getElementById("branchInput").value).toBe("all");
  });

  it("switches language, marks notifications read, closes the panel and triggers print", async () => {
    await load();
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("markNotificationsRead").click();
    expect(document.getElementById("notificationBadge").hidden).toBe(true);
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.body.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.getElementById("exportExcel").click();
    document.getElementById("resetButton").click();
  });

  it("renders interactive pie and donut charts with tooltips and replaces an existing donut", async () => {
    await load();
    const pie = document.getElementById("symptomPie");
    window.renderInteractivePie("symptomPie", [
      { name: "Headache", percent: 100, color: "#f00" },
      { name: "Fever", percent: 60, color: "#0f0" },
    ]);
    const [full, large] = pie.querySelectorAll("path");
    expect(full.getAttribute("d")).toContain("A 50 50 0 1 1");
    expect(large.getAttribute("d")).toContain(" A 50 50 0 1 1 ");
    full.dispatchEvent(new PointerEvent("pointerenter", { clientX: 10, clientY: 20 }));
    expect(document.querySelector(".pie-tooltip").hidden).toBe(false);
    expect(document.querySelector(".pie-tooltip").textContent).toContain("Headache: 100%");
    full.dispatchEvent(new Event("pointerleave"));
    expect(document.querySelector(".pie-tooltip").hidden).toBe(true);
    full.focus();
    expect(document.querySelector(".pie-tooltip").hidden).toBe(false);
    full.blur();
    expect(document.querySelector(".pie-tooltip").hidden).toBe(true);

    window.renderInteractiveDonut("expiryDonut", [{ name: "Expired", percent: 55, count: 5, color: "#00f" }]);
    window.renderInteractiveDonut("expiryDonut", [{ name: "Soon", percent: 45, count: 4, color: "#0ff" }]);
    const donut = document.querySelector("#expiryDonut svg path");
    donut.dispatchEvent(new PointerEvent("pointermove", { clientX: 1, clientY: 2 }));
    expect(document.querySelector(".pie-tooltip").textContent).toContain("Soon: 4 รายการ (45%)");
  });

  it("covers empty chart data, date-range fallbacks, and custom-select dismissal edges", async () => {
    await load();
    const pie = document.getElementById("symptomPie");
    window.renderInteractivePie("symptomPie", []);
    expect(pie.querySelectorAll("path")).toHaveLength(0);
    window.renderInteractiveDonut("expiryDonut", []);
    expect(document.querySelectorAll("#expiryDonut svg path")).toHaveLength(0);

    const faculty = document.getElementById("facultySelect");
    faculty.value = "unknown-faculty";
    faculty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.getElementById("branchInput").value).toBe("all");
    faculty.closest(".custom-select").querySelector(".custom-select-trigger").click();
    document.body.click();
    expect(faculty.closest(".custom-select").classList.contains("is-open")).toBe(false);

    const notifications = document.getElementById("notificationButton");
    notifications.click();
    notifications.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });
});
