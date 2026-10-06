import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/pending-assessment-detail-link.js");

async function loadPage() {
  history.replaceState({}, "", "/legacy/pending.html");
  document.body.innerHTML = `<div id="assessmentList"><article class="assessment-card" data-id="student 1"><span class="name">Name</span><button class="status">Status</button><span class="hospital-entry">Hospital</span></article><button id="outside">Outside</button></div>`;
  await Object.values(scripts)[0]();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("pending assessment card navigation", () => {
  it("opens the detail for a card while preserving its encoded ID", async () => {
    await loadPage();
    document.querySelector(".name").click();
    expect(window.location.pathname).toBe("/legacy/pending.html");
  });

  it("does not navigate for status, hospital controls, or outside clicks", async () => {
    await loadPage();
    document.querySelector(".status").click();
    document.querySelector(".hospital-entry").click();
    document.getElementById("outside").click();
    expect(window.location.pathname).toBe("/legacy/pending.html");
  });
});
