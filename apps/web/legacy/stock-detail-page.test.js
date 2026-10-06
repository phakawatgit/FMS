import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/stock-detail.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/stock-detail.js");
const product = {
  code: "M-1", name: "Bandage <test>", genericName: "Gauze", category: "equipment", total: 10, used: 3,
  unit: "box", storageLocation: "Cabinet A", status: "Available", benefit: "First aid",
};

async function loadPage(records = [product], code = "M-1", options = {}) {
  const { includeMenu = false, hideHeaderControls = false, storedRecords } = options;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  if (includeMenu) document.querySelector(".topbar").insertAdjacentHTML("afterbegin", '<button class="menu-button" type="button"></button>');
  if (hideHeaderControls) document.querySelector(".topbar .actions").replaceChildren();
  document.documentElement.lang = "th";
  history.replaceState({}, "", `/legacy/stock-detail.html?code=${encodeURIComponent(code)}`);
  const values = new Map([["fms-stock-records", Object.hasOwn(options, "storedRecords") ? storedRecords : JSON.stringify(records)]]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("print", vi.fn());
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("stock detail page", () => {
  it("escapes product data and updates stock using controls and direct entry", async () => {
    const values = await loadPage();
    const detail = document.getElementById("detail");
    expect(detail.querySelector("h1").innerHTML).toContain("&lt;test&gt;");
    expect(detail.textContent).toContain("box");
    expect(detail.querySelector(".remaining strong").textContent).toBe("7");

    detail.querySelector("[data-field='used'][data-delta='1']").click();
    expect(detail.querySelector(".used strong").textContent).toBe("4");
    expect(JSON.parse(values.get("fms-stock-records"))[0].remaining).toBe(6);
    detail.querySelector("[data-field='used'][data-delta='-1']").click();
    const total = detail.querySelector(".total strong");
    total.textContent = "12 units";
    total.dispatchEvent(new Event("blur"));
    expect(total.textContent).toBe("12");
    expect(JSON.parse(values.get("fms-stock-records"))[0]).toMatchObject({ total: 12, remaining: 9 });
    detail.querySelector(".inventory").click();
    const used = detail.querySelector(".used strong");
    fireEvent.focus(used);
    used.textContent = "bad input";
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    fireEvent(used, enter);
    expect(enter.defaultPrevented).toBe(true);
    const otherKey = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    fireEvent(used, otherKey);
    expect(otherKey.defaultPrevented).toBe(false);
    fireEvent.blur(used);
    expect(used.textContent).toBe("0");
    expect(JSON.parse(values.get("fms-stock-records"))[0].used).toBe(0);
  });

  it("handles notifications, print, language, edit handoff, and delete cancellation", async () => {
    const values = await loadPage([product], "M-1", { includeMenu: true });
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("closeNotification").click();
    document.querySelector(".topbar .export").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.querySelector(".topbar .language").click();
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector(".menu-button svg")).not.toBeNull();

    document.querySelector(".detail-edit").click();
    expect(values.get("fms-edit-stock-code")).toBe("M-1");
    expect(JSON.parse(values.get("fms-edit-stock-record"))).toMatchObject({ code: "M-1" });
  });

  it("renders an explicit empty result for an unknown product", async () => {
    await loadPage([], "unknown");
    expect(document.getElementById("detail").textContent).not.toBe("");
    expect(document.querySelector(".inventory")).toBeNull();
  });

  it("cancels deletion on backdrop and removes the selected item after confirmation", async () => {
    const values = await loadPage([product, { name: "Legacy record without a code" }]);
    document.querySelector(".detail-delete").click();
    await vi.waitFor(() => expect(document.querySelector(".fms-confirm-overlay")).toBeTruthy());
    document.querySelector(".fms-confirm-overlay").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(values.get("fms-stock-records"))).toHaveLength(2);

    document.querySelector(".detail-delete").click();
    await vi.waitFor(() => expect(document.querySelector(".fms-confirm-cancel")).toBeTruthy());
    document.querySelector(".fms-confirm-cancel").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(values.get("fms-stock-records"))).toHaveLength(2);

    document.querySelector(".detail-delete").click();
    await vi.waitFor(() => expect(document.querySelector(".fms-confirm-delete")).toBeTruthy());
    document.querySelector(".fms-confirm-delete").click();
    await vi.waitFor(() => expect(JSON.parse(values.get("fms-stock-records"))).toEqual([{ name: "Legacy record without a code" }]));
  });

  it("renders image and product-name fallbacks for a fully described item", async () => {
    await loadPage([{
      code: "ALT", productName: "Antiseptic", image: "/antiseptic.png", category: "oral",
      total: 0, used: 0, form: "liquid", size: "100 ml", unit: "bottle", warning: "External use",
    }], "ALT", { includeMenu: true });
    const detail = document.getElementById("detail");
    expect(detail.querySelector("h1").textContent).toContain("Antiseptic");
    expect(detail.querySelector(".detail-image img").getAttribute("src")).toBe("/antiseptic.png");
    expect(detail.textContent).toContain("100 ml");
    expect(detail.querySelector(".remaining strong").textContent).toBe("0");
  });

  it("supports legacy records without codes and absent storage values", async () => {
    const legacy = { name: "Legacy supply", category: "unlisted", total: 0, used: 0 };
    const values = await loadPage([legacy], "");
    const detail = document.getElementById("detail");
    expect(detail.querySelector("h1").textContent).toContain("Legacy supply");
    expect(detail.textContent).toContain("unlisted");
    const total = detail.querySelector(".total strong");
    fireEvent.focus(total);
    fireEvent.blur(total);
    detail.querySelector("[data-field='total'][data-delta='-1']").click();
    detail.querySelector("[data-field='total'][data-delta='1']").click();
    expect(JSON.parse(values.get("fms-stock-records"))[0]).toMatchObject({ total: 1, remaining: 1 });
    document.querySelector(".detail-edit").click();
    expect(values.get("fms-edit-stock-code")).toBe("");
    document.querySelector(".topbar .language").click();
    document.querySelector(".topbar .language").click();
    expect(document.documentElement.lang).toBe("th");

    vi.resetModules();
    await loadPage([], "missing", { storedRecords: null, hideHeaderControls: true });
    expect(document.querySelector(".detail-card h1")).not.toBeNull();
    expect(document.querySelector(".menu-button")).toBeNull();
    expect(document.querySelector(".inventory")).toBeNull();
  });

  it("uses fallback labels when deleting a legacy item without a name or code", async () => {
    const values = await loadPage([{ total: 1, used: 0 }], "");
    document.querySelector(".detail-delete").click();
    await vi.waitFor(() => expect(document.querySelector(".fms-confirm-dialog")).toBeTruthy());
    expect(document.querySelector(".fms-confirm-dialog").textContent).toContain("นี้");
    document.querySelector(".fms-confirm-delete").click();
    await vi.waitFor(() => expect(JSON.parse(values.get("fms-stock-records"))).toEqual([]));
  });
});
