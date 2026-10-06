import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/pending-assessment.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/pending-assessment.js");
const visit = { createdAt: "2026-10-01T10:00:00.000Z", firstName: "Ava", lastName: "Nurse", symptom: "Headache", status: "observe", enteredByName: "Admin" };

async function loadPage(visits = [visit]) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([["fms-infirmary-visits", JSON.stringify(visits)]]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("pending assessment queue", () => {
  it("shows only observation visits and changes a visit to normal", async () => {
    const values = await loadPage([visit, { ...visit, createdAt: "other", status: "normal" }]);
    expect(document.querySelectorAll(".assessment-card")).toHaveLength(1);
    expect(document.querySelector(".assessment-card h2").textContent).toBe("Ava Nurse");
    document.querySelector(".status input[value='normal']").checked = true;
    document.querySelector(".status input[value='normal']").dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(values.get("fms-infirmary-visits"))[0].status).toBe("normal");
    expect(document.querySelectorAll(".assessment-card")).toHaveLength(0);
  });

  it("requires a hospital name for referral and saves a completed referral", async () => {
    const values = await loadPage();
    const refer = document.querySelector(".status input[value='refer']");
    refer.checked = true;
    refer.dispatchEvent(new Event("change", { bubbles: true }));
    const hospital = document.querySelector(".hospital-entry");
    expect(hospital.classList.contains("is-open")).toBe(true);
    hospital.querySelector("button").click();
    expect(JSON.parse(values.get("fms-infirmary-visits"))[0].status).toBe("observe");
    hospital.querySelector("input").value = "City Hospital";
    hospital.querySelector("button").click();
    expect(JSON.parse(values.get("fms-infirmary-visits"))[0]).toMatchObject({ status: "refer", hospitalName: "City Hospital" });
    expect(document.querySelectorAll(".assessment-card")).toHaveLength(0);
  });

  it("renders an empty state if no visits need observation", async () => {
    await loadPage([]);
    expect(document.querySelector(".empty")).not.toBeNull();
  });
});
