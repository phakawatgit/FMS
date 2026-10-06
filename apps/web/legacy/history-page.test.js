import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/history.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/history.js");

async function render(records, { removeMenu = false, withBack = false, missingHistory = false } = {}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  if (removeMenu) document.querySelector(".page-tools .menu-button")?.remove();
  if (withBack) document.querySelector(".page-tools").insertAdjacentHTML("beforeend", '<button class="back" type="button">Back</button>');
  vi.stubGlobal("FMSStorage", { getItem: (key) => key === "fms-infirmary-history" ? (missingHistory ? null : JSON.stringify(records)) : null });
  await Object.values(scripts)[0]();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("completed infirmary history list", () => {
  it("renders recipient name, symptom, and completion time with escaped user data", async () => {
    await render([{ firstName: "A<", lastName: "B&", symptom: "Cut <skin>", completedAt: "2026-10-01T10:00:00.000Z" }]);
    const card = document.querySelector(".history-card");
    expect(card.querySelector("h2").innerHTML).toContain("A&lt; B&amp;");
    expect(card.innerHTML).toContain("Cut &lt;skin&gt;");
  });

  it("shows an empty state when no completed visits exist", async () => {
    await render([]);
    expect(document.querySelector(".empty")).not.toBeNull();
  });

  it("uses safe placeholders when a completed visit has no name, symptom, or completion date", async () => {
    await render([{}]);
    const card = document.querySelector(".history-card");
    expect(card.querySelector("h2").textContent).toBe("-");
    expect(card.querySelector("p").textContent).toContain("-");
  });

  it("adds the shared menu action and normalizes history topbar controls when needed", async () => {
    await render([], { removeMenu: true });
    expect(document.querySelector("header.topbar").classList.contains("dashboard-topbar")).toBe(true);
    expect(document.querySelector(".page-tools").classList.contains("actions")).toBe(true);
    expect(document.querySelector(".page-tools .menu-button").getAttribute("href")).toBe("./menu.html");
    expect(document.querySelector(".export-excel").classList.contains("export")).toBe(true);
    expect(document.querySelector(".export-pdf").classList.contains("export")).toBe(true);
    expect(document.querySelector(".language-tool").classList.contains("language")).toBe(true);
  });

  it("moves the back control into the page content", async () => {
    await render([], { withBack: true });
    expect(document.querySelector("main.page > .back")).not.toBeNull();
  });

  it("uses an empty history list before storage has been initialized", async () => {
    await render([], { missingHistory: true });
    expect(document.querySelector("#historyList .empty")).not.toBeNull();
  });

  it("returns safely when history markup has no topbar", async () => {
    document.body.innerHTML = '<main class="page"><div id="historyList"></div></main>';
    vi.stubGlobal("FMSStorage", { getItem: () => "[]" });
    await Object.values(scripts)[0]();
    expect(document.querySelector("#historyList .empty")).not.toBeNull();
  });

  it("returns safely when the topbar has no page-tools container", async () => {
    document.body.innerHTML = '<header class="topbar"></header><main class="page"><div id="historyList"></div></main>';
    vi.stubGlobal("FMSStorage", { getItem: () => "[]" });
    await Object.values(scripts)[0]();
    expect(document.querySelector("header.topbar").classList.contains("dashboard-topbar")).toBe(false);
  });
});
