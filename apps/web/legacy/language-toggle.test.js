import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/language-toggle.js");

async function load({ saved = "", storageThrows = false, english = false } = {}) {
  vi.resetModules();
  document.head.replaceChildren();
  document.documentElement.lang = english ? "en" : "th";
  document.body.innerHTML = `<header class="topbar"><a href="#"><span>กลับหน้าเมนู</span></a><button id="languageButton" class="language"><svg></svg><span>ไทย</span></button></header><main><p id="copy">${english ? "No data yet" : "ยังไม่มีข้อมูล"}</p><input id="search" placeholder="ค้นหา" aria-label="ค้นหา" title="ค้นหา" /><textarea>ยังไม่มีข้อมูล</textarea><script>ยังไม่มีข้อมูล</script></main>`;
  const values = new Map([["fms-language", saved]]);
  const storage = {
    getItem: storageThrows ? () => { throw new Error("storage unavailable"); } : (key) => values.get(key) ?? null,
    setItem: storageThrows ? () => { throw new Error("storage unavailable"); } : (key, value) => values.set(key, value),
  };
  vi.stubGlobal("FMSStorage", storage);
  await Object.values(scripts)[0]();
  return { values, storage };
}

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); document.head.replaceChildren();
});

describe("shared language switcher", () => {
  it("translates text and accessible attributes both ways and persists the choice", async () => {
    const { values } = await load();
    const button = document.getElementById("languageButton");
    expect(document.querySelector("a span").textContent).toBe("กลับหน้าเมนู");
    expect(document.querySelector("textarea").value).toBe("ยังไม่มีข้อมูล");
    expect(document.querySelector("script").textContent).toBe("ยังไม่มีข้อมูล");
    button.click();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(document.querySelector("a span").textContent).toBe("Back to menu");
    expect(document.getElementById("copy").textContent).toBe("No data yet");
    expect(document.getElementById("search").placeholder).toBe("Search");
    expect(document.getElementById("search").getAttribute("aria-label")).toBe("Search");
    expect(values.get("fms-language")).toBe("en");

    const late = document.createElement("p");
    late.textContent = "ยังไม่มีข้อมูล";
    const lateInput = document.createElement("input");
    lateInput.setAttribute("placeholder", "ค้นหา");
    document.body.append(late, lateInput);
    await vi.waitFor(() => {
      expect(late.textContent).toBe("No data yet");
      expect(lateInput.placeholder).toBe("Search");
    });

    button.click();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("th"));
    expect(document.querySelector("a span").textContent).toBe("กลับเมนู");
    expect(values.get("fms-language")).toBe("th");
  });

  it("applies a saved language to late content and animates pointer interaction", async () => {
    await load({ saved: "en" });
    const button = document.getElementById("languageButton");
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    const late = document.createElement("p");
    late.textContent = "ยังไม่มีข้อมูล";
    document.body.append(late);
    await vi.waitFor(() => expect(late.textContent).toBe("No data yet"));
    const lateInput = document.createElement("input");
    document.body.append(lateInput);
    lateInput.setAttribute("placeholder", "ค้นหา");
    await vi.waitFor(() => {
      expect(late.textContent).toBe("No data yet");
      expect(lateInput.placeholder).toBe("Search");
    });
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(button.classList.contains("language-pop")).toBe(true);
    expect(button.dataset.languageShared).toBe("true");
    expect(button.querySelector("svg")).toBeNull();
  });

  it("continues to work when the shared storage read or write fails", async () => {
    await load({ storageThrows: true });
    document.getElementById("languageButton").click();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(document.getElementById("copy").textContent).toBe("No data yet");
  });
});
