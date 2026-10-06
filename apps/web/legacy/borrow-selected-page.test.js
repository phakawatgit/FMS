import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-selected.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/borrow-selected.js");

async function load({ selected = {}, form = {} } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([
    ["fms-stock-records", JSON.stringify([{ code: "M1", name: "Bandage", total: 5, used: 1, image: "/bandage.png" }])],
    ["fms-borrow-products", JSON.stringify(selected)], ["fms-borrow-form", JSON.stringify(form)],
  ]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  vi.spyOn(window, "print").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); });

describe("selected borrow products", () => {
  it("renders products, clamps quantity controls and saves changes", async () => {
    const values = await load({ selected: { M1: { quantity: 1 }, MISSING: { quantity: 0 } }, form: { fullName: "Ava", item: "Personal" } });
    const cards = document.querySelectorAll(".selected-item");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector("img").src).toContain("bandage.png");
    expect(cards[1].textContent).toContain("MISSING");
    cards[0].querySelector("[data-delta='-1']").click();
    expect(JSON.parse(values.get("fms-borrow-products")).M1.quantity).toBe(1);
    document.querySelector(".selected-item [data-delta='1']").click();
    expect(JSON.parse(values.get("fms-borrow-products")).M1.quantity).toBe(2);
    const input = document.querySelector("[data-quantity='M1']");
    input.value = "0";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(values.get("fms-borrow-products")).M1.quantity).toBe(1);
    expect(document.getElementById("borrowerSummary").textContent).toContain("Ava");
  });

  it("renders empty state and supports language and print controls", async () => {
    await load();
    expect(document.querySelector(".empty-selected")).toBeTruthy();
    document.querySelector(".topbar .language").click();
    expect(document.documentElement.lang).toBe("en");
    document.querySelector(".topbar .export").click();
    expect(window.print).toHaveBeenCalledOnce();
  });
});
