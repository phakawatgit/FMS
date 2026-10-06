import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageHtml = readFileSync(resolve(process.cwd(), "../../Front-end/infirmary-visit.html"), "utf8");
const facultyBranchScript = import.meta.glob("../../../Front-end/infirmary-visit-faculty-branch.js");
const stock = [
  { code: "MED-1", name: "Gauze", unit: "box", remaining: 4 },
  { code: "MED-2", name: "Empty stock", unit: "piece", remaining: 0 },
];

async function loadPage() {
  const page = new DOMParser().parseFromString(pageHtml, "text/html");
  document.documentElement.lang = page.documentElement.lang;
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  window.FMSStorage = {
    getItem: (key) => JSON.stringify(key === "fms-stock-records" ? stock : []),
    setItem: vi.fn(),
    saveInfirmaryVisit: vi.fn().mockRejectedValue(new Error("offline")),
  };
  await import("../../../Front-end/infirmary-visit.js");
  await Object.values(facultyBranchScript)[0]();
}

describe("Infirmary visit page", () => {
  beforeEach(async () => {
    vi.resetModules();
    await loadPage();
  });

  it("switches visitor type and disables student ID for external visitors", () => {
    const detail = document.getElementById("visitorDetail");
    const studentId = document.querySelector('[name="studentId"]');
    const student = document.querySelector('[data-type="student"] .visitor-check');
    const guest = document.querySelector('[data-type="guest"] .visitor-check');

    fireEvent.click(student);
    expect(detail.disabled).toBe(false);
    expect(studentId.disabled).toBe(false);

    fireEvent.click(guest);
    expect(student.checked).toBe(false);
    expect(guest.checked).toBe(true);
    expect(studentId.disabled).toBe(true);
  });

  it("requires a hospital name only for referral status", async () => {
    const hospital = document.querySelector('[name="hospitalName"]');
    const refer = document.querySelector('[name="status"][value="refer"]');
    const normal = document.querySelector('[name="status"][value="normal"]');

    fireEvent.click(refer);
    await waitFor(() => expect(hospital.required).toBe(true));
    expect(hospital.disabled).toBe(false);

    fireEvent.click(normal);
    await waitFor(() => expect(hospital.required).toBe(false));
    expect(hospital.disabled).toBe(true);
  });

  it("switches the page labels to English", () => {
    fireEvent.click(document.getElementById("languageButton"));

    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('[data-i18n="formTitle"]').textContent).toBe("Infirmary visit form");
  });

  it("offers in stock medicines and disables items with no stock", () => {
    fireEvent.click(document.getElementById("addMedicationButton"));
    const options = [...document.querySelectorAll("[data-medicine-code] option")];

    expect(options.some((option) => option.value === "MED-1" && !option.disabled)).toBe(true);
    expect(options.some((option) => option.value === "MED-2" && option.disabled)).toBe(true);
  });

  it("filters faculty branches, supports both custom selectors, and restores them on reset", () => {
    const faculty = document.getElementById("facultySelect");
    const branch = document.getElementById("branchSelect");
    faculty.value = "business";
    fireEvent.change(faculty);
    expect([...branch.options].length).toBe(3);
    expect(branch.value).toBe("all");
    fireEvent.click(faculty.closest(".custom-select").querySelector(".custom-select-trigger"));
    fireEvent.click(faculty.closest(".custom-select").querySelector('[data-custom-value="engineering"]'));
    expect(faculty.value).toBe("engineering");
    expect([...branch.options].length).toBe(8);
    fireEvent.click(branch.closest(".custom-select").querySelector(".custom-select-trigger"));
    fireEvent.click(branch.closest(".custom-select").querySelector('[data-custom-value="all"]'));
    expect(branch.value).toBe("all");

    fireEvent.click(document.querySelector('[data-type="guest"] .visitor-check'));
    expect(faculty.disabled).toBe(true);
    expect(branch.disabled).toBe(true);
    expect(faculty.closest(".custom-select").querySelector(".custom-select-trigger").disabled).toBe(true);
    fireEvent.click(document.querySelector('[data-type="student"] .visitor-check'));
    expect(faculty.disabled).toBe(false);
    fireEvent.reset(document.getElementById("visitForm"));
    return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(faculty.value).toBe("all");
      expect(branch.value).toBe("all");
    });
  });

  it("validates visitor type and status before attempting to save", () => {
    fireEvent.submit(document.getElementById("visitForm"));

    expect(document.getElementById("formMessage").textContent).not.toBe("");
    expect(window.FMSStorage.saveInfirmaryVisit).not.toHaveBeenCalled();
  });

  it("keeps the form available and shows an error when persistence fails", async () => {
    fireEvent.click(document.querySelector('[data-type="student"] .visitor-check'));
    fireEvent.click(document.querySelector('[name="status"][value="observe"]'));
    fireEvent.submit(document.getElementById("visitForm"));

    await waitFor(() => expect(window.FMSStorage.saveInfirmaryVisit).toHaveBeenCalledOnce());
    await waitFor(() => expect(document.querySelector('#visitForm [type="submit"]').disabled).toBe(false));
    expect(document.getElementById("formMessage").textContent).not.toBe("");
  });

  it("validates medicine rows, aggregates duplicate products, and enables referral details", async () => {
    const save = window.FMSStorage.saveInfirmaryVisit;
    save.mockResolvedValue({ ok: true });
    fireEvent.click(document.querySelector('[data-type="student"] .visitor-check'));
    fireEvent.click(document.querySelector('[name="status"][value="refer"]'));
    const hospital = document.querySelector('[name="hospitalName"]');
    expect(hospital.required).toBe(true);

    fireEvent.click(document.getElementById("addMedicationButton"));
    const rows = [...document.querySelectorAll(".medication-row")];
    rows[0].querySelector("[data-medicine-code]").value = "MED-1";
    rows[0].querySelector("[data-medicine-quantity]").value = "2";
    rows[1].querySelector("[data-medicine-code]").value = "MED-1";
    rows[1].querySelector("[data-medicine-quantity]").value = "3";
    fireEvent.submit(document.getElementById("visitForm"));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].medications).toEqual([{ code: "MED-1", name: "Gauze", unit: "box", quantity: 5 }]);
    expect(save.mock.calls[0][0].quantity).toContain("5 box");
  });

  it("prevents non-integer medication quantities and keeps one blank row", () => {
    fireEvent.click(document.querySelector('[data-type="student"] .visitor-check'));
    fireEvent.click(document.querySelector('[name="status"][value="normal"]'));
    fireEvent.click(document.getElementById("addMedicationButton"));
    const rows = [...document.querySelectorAll(".medication-row")];
    rows[0].querySelector("[data-medicine-code]").value = "MED-1";
    rows[0].querySelector("[data-medicine-quantity]").value = "1.5";
    fireEvent.submit(document.getElementById("visitForm"));
    expect(document.getElementById("formMessage").textContent).not.toBe("");
    expect(window.FMSStorage.saveInfirmaryVisit).not.toHaveBeenCalled();

    document.querySelectorAll(".medication-remove").forEach((button) => fireEvent.click(button));
    expect(document.querySelectorAll(".medication-row")).toHaveLength(1);
  });
});
