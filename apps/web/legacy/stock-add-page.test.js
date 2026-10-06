import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/stock-add.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/stock-add.js");
const selectScripts = import.meta.glob("../../../Front-end/stock-add-select.js");
const existing = [{ code: "M0000004", name: "Existing", total: 8, used: 1, remaining: 7 }];

async function loadPage({ stock = existing, extras = {}, url = "/legacy/stock-add.html" } = {}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", url);
  const values = new Map([["fms-stock-records", JSON.stringify(stock)], ...Object.entries(extras)]);
  const addCatalogRecord = vi.fn((record) => {
    const saved = JSON.parse(values.get("fms-stock-records") || "[]");
    saved.push({ ...record, code: record.code });
    values.set("fms-stock-records", JSON.stringify(saved));
    return record;
  });
  const removeItem = vi.fn((key) => values.delete(key));
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem,
    addCatalogRecord,
  });
  await Object.values(scripts)[0]();
  await Object.values(selectScripts)[0]();
  return { values, addCatalogRecord, removeItem };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("stock add and edit page", () => {
  it("uses the custom dropdown for the requested medicine units and saves the selection", async () => {
    const { addCatalogRecord } = await loadPage();
    const unit = document.querySelector('[name="unit"]');
    expect([...unit.options].map((option) => option.textContent)).toEqual(["กล่อง", "แผง", "ขวด"]);
    const wrapper = unit.closest(".minimal-select");
    expect(wrapper.querySelector(".minimal-select-trigger").textContent).toContain("กล่อง");
    wrapper.querySelector(".minimal-select-trigger").click();
    [...wrapper.querySelectorAll(".minimal-select-list button")].find((option) => option.textContent === "ขวด").click();
    expect(unit.value).toBe("bottle");
    expect(wrapper.querySelector(".minimal-select-trigger").textContent).toBe("ขวด");
    document.querySelector('[name="name"]').value = "Unit test medicine";
    document.getElementById("medicineForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(addCatalogRecord).toHaveBeenCalledOnce());
    expect(addCatalogRecord.mock.calls[0][0].unit).toBe("bottle");
  });

  it("generates the next code, validates required names and image URLs, and adds numeric stock", async () => {
    const { addCatalogRecord } = await loadPage();
    const form = document.getElementById("medicineForm");
    const name = form.elements.name;
    const code = form.elements.code;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.getElementById("message").textContent).not.toBe("");
    expect(addCatalogRecord).not.toHaveBeenCalled();

    name.value = "Bandage";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(code.value).toBe("B0000005");
    form.elements.total.value = "10";
    form.elements.used.value = "12";
    document.getElementById("imageInput").value = "javascript:alert(1)";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.getElementById("message").textContent).toContain("HTTP/HTTPS");

    document.getElementById("imageInput").value = "https://example.test/bandage.png";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(addCatalogRecord).toHaveBeenCalledOnce());
    expect(addCatalogRecord.mock.calls[0][0]).toMatchObject({ code: "B0000005", total: 10, used: 10, remaining: 0, status: expect.any(String) });
  });

  it("loads an existing record for editing and updates the canonical stock record", async () => {
    const row = { code: "B0000002", name: "Bandage", total: 10, used: 2, remaining: 8, unit: "box", createdAt: "2025-01-01" };
    const { values, removeItem } = await loadPage({ stock: [row], url: "/legacy/stock-add.html?edit=B0000002" });
    const form = document.getElementById("medicineForm");
    expect(form.elements.name.value).toBe("Bandage");
    expect(form.elements.code.value).toBe("B0000002");
    form.elements.total.value = "12";
    form.elements.used.value = "3";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(JSON.parse(values.get("fms-stock-records"))[0].remaining).toBe(9));
    expect(JSON.parse(values.get("fms-stock-records"))[0].createdAt).toBe("2025-01-01");
    expect(removeItem).toHaveBeenCalledWith("fms-edit-stock-code");
  });

  it("previews supported image sources, rejects unsafe sources and clears preview on reset", async () => {
    await loadPage();
    const input = document.getElementById("imageInput");
    input.value = "https://example.test/photo.png";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#imagePreview img").src).toBe("https://example.test/photo.png");
    document.querySelector("#imagePreview img").onerror();
    expect(document.getElementById("imagePreview").textContent).not.toBe("");
    input.value = "javascript:alert(1)";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#imagePreview img")).toBeNull();
    const form = document.getElementById("medicineForm");
    form.elements.name.value = "Bandage";
    input.value = "data:image/svg+xml,<svg>";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.getElementById("message").textContent).toContain("HTTP/HTTPS");
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById("imagePreview").querySelector("img")).toBeNull();
  });

  it("loads an edit snapshot when the saved product has already been removed", async () => {
    const snapshot = { code: "SNAP-1", name: "Snapshot product", total: 5, used: 1, remaining: 4, image: "data:image/png;base64,abc" };
    const { values } = await loadPage({ extras: { "fms-edit-stock-record": JSON.stringify(snapshot) } });
    expect(document.getElementById("clearButton").hidden).toBe(true);
    expect(document.getElementById("medicineForm").elements.name.value).toBe("Snapshot product");
    expect(document.getElementById("medicineForm").elements.code.value).toBe("SNAP-1");
    document.getElementById("medicineForm").elements.total.value = "8";
    document.getElementById("medicineForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(JSON.parse(values.get("fms-stock-records")).find((item) => item.code === "SNAP-1")).toMatchObject({ code: "SNAP-1", total: 8 }));
  });

  it("accepts supported image uploads and rejects unsupported or oversized files", async () => {
    const { addCatalogRecord } = await loadPage();
    vi.stubGlobal("FileReader", class extends EventTarget {
      result = "data:image/png;base64,cGljdHVyZQ==";
      readAsDataURL() { this.dispatchEvent(new Event("load")); }
    });
    const fileInput = document.getElementById("imageFileInput");
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["image"], "image.png", { type: "image/png" })] });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.querySelector("#imagePreview img").src).toContain("data:image/png;base64");
    expect(document.getElementById("message").style.color).toBe("rgb(22, 130, 59)");
    document.getElementById("medicineForm").elements.name.value = "Upload test";
    document.getElementById("medicineForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(addCatalogRecord).toHaveBeenCalledOnce());
    expect(addCatalogRecord.mock.calls[0][0].image).toBe("data:image/png;base64,cGljdHVyZQ==");

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [oversized] });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("message").style.color).toBe("rgb(196, 58, 58)");
    const unsupported = new File(["x"], "image.gif", { type: "image/gif" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [unsupported] });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("message").textContent).toContain("JPG");
  });

  it("handles empty and unreadable uploads, clears URL selection, and restores page controls", async () => {
    await loadPage({ url: "/legacy/stock-add.html?from=catalog" });
    const fileInput = document.getElementById("imageFileInput");
    Object.defineProperty(fileInput, "files", { configurable: true, value: [] });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("message").textContent).toBe("");

    vi.stubGlobal("FileReader", class extends EventTarget {
      readAsDataURL() { this.dispatchEvent(new Event("error")); }
    });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["image"], "image.png", { type: "image/png" })] });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("message").textContent).not.toBe("");

    vi.stubGlobal("FileReader", class extends EventTarget {
      result = "data:image/webp;base64,aW1hZ2U=";
      readAsDataURL() { this.dispatchEvent(new Event("load")); }
    });
    fileInput.dispatchEvent(new Event("change"));
    expect(document.querySelector("#imagePreview img").src).toContain("data:image/webp");
    const imageInput = document.getElementById("imageInput");
    imageInput.value = "https://example.test/new.png";
    imageInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(fileInput.value).toBe("");

    const zeroInput = document.querySelector('.stock-input input[type="number"]');
    const selectSpy = vi.spyOn(zeroInput, "select");
    zeroInput.value = "0";
    zeroInput.dispatchEvent(new Event("focus"));
    expect(selectSpy).toHaveBeenCalledOnce();

    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("closeNotification").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    document.querySelector(".language").click();
    expect(document.documentElement.lang).toBe("en");
    document.querySelector(".language").click();
    expect(document.documentElement.lang).toBe("th");
    expect(document.querySelector(".back-stock").dataset.return).toBe("catalog");
  });
});
