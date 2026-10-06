import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/assessment-detail.js");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it("escapes visitor fields and renders missing name and date fallbacks", async () => {
  const record = {
    createdAt: null,
    nickname: '<script>&"',
    responsibleFromDutyShift: true,
    responsibleName: "Nurse",
    status: "unknown",
  };
  document.body.innerHTML = '<main id="detail"></main>';
  history.replaceState({}, "", "/legacy/assessment-detail.html");
  vi.stubGlobal("FMSStorage", { getItem: () => JSON.stringify([record]) });
  await Object.values(scripts)[0]();

  const detail = document.getElementById("detail");
  expect(detail.querySelector("h2").textContent).not.toBe("");
  expect(detail.querySelector(".date").textContent.trim().endsWith("-")).toBe(true);
  expect(detail.innerHTML).toContain('&lt;script&gt;&amp;"');
  expect(detail.textContent).toContain("Nurse");
});

it("shows the missing-visit view when the storage key is not initialized", async () => {
  document.body.innerHTML = '<main id="detail"></main>';
  history.replaceState({}, "", "/legacy/assessment-detail.html?id=missing");
  vi.stubGlobal("FMSStorage", { getItem: () => null });
  await Object.values(scripts)[0]();
  expect(document.getElementById("detail").className).toBe("empty");
});
