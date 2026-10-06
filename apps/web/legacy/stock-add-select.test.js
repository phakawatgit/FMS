import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/stock-add-select.js");

afterEach(() => {
  vi.resetModules();
  document.body.replaceChildren();
});

it("enhances native selects with accessible custom controls and closes open menus", async () => {
  document.body.innerHTML = `<section class="details-grid"><label><select><option value="oral">Oral</option><option value="topical">Topical</option></select></label></section><button id="outside">outside</button>`;
  const select = document.querySelector("select");
  const changed = vi.fn();
  select.addEventListener("change", changed);
  await Object.values(scripts)[0]();
  const trigger = document.querySelector(".minimal-select-trigger");
  const wrapper = document.querySelector(".minimal-select");
  expect(select.hidden).toBe(true);
  expect(trigger.textContent).toBe("Oral");
  trigger.click();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  wrapper.querySelectorAll("[role='option']")[1].click();
  expect(select.value).toBe("topical");
  expect(changed).toHaveBeenCalledOnce();
  expect(trigger.textContent).toBe("Topical");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  trigger.click();
  document.getElementById("outside").click();
  expect(wrapper.classList.contains("is-open")).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("shows the fallback label for a select with no options", async () => {
  document.body.innerHTML = '<section class="details-grid"><select></select></section>';
  await Object.values(scripts)[0]();
  expect(document.querySelector(".minimal-select-trigger").textContent).toContain("");
});
