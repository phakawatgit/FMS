import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/header-controls.js");

afterEach(() => {
  vi.resetModules();
  document.body.replaceChildren();
  document.head.replaceChildren();
});

it("removes the menu link on stock-add and adds missing notification and stylesheet controls", async () => {
  document.head.replaceChildren();
  document.body.innerHTML = '<header class="topbar"><nav class="actions"><a class="menu-link" href="./menu.html">Menu</a><button class="bell"></button></nav></header>';
  history.replaceState({}, "", "/legacy/stock-add.html");
  await Object.values(scripts)[0]();
  expect(document.querySelector(".menu-link")).toBeNull();
  expect(document.querySelector(".bell .notification-badge").textContent).toBe("0");
  expect(document.querySelector("link[data-fms-header-controls]").getAttribute("href")).toBe("./dashboard-topbar.css?v=3");
});

it("keeps existing menu, notification badge, and header stylesheet controls", async () => {
  document.head.innerHTML = '<link data-fms-header-controls rel="stylesheet" href="existing.css">';
  document.body.innerHTML = '<header class="topbar"><nav class="actions"><a class="menu-link" href="./menu.html">Menu</a><button class="bell"><b>4</b></button></nav></header>';
  history.replaceState({}, "", "/legacy/dashboard.html");
  await Object.values(scripts)[0]();
  expect(document.querySelectorAll(".menu-link")).toHaveLength(1);
  expect(document.querySelector(".bell .notification-badge")).toBeNull();
  expect(document.querySelectorAll("link[data-fms-header-controls]")).toHaveLength(1);
});

it("returns safely when a page does not have the shared topbar", async () => {
  document.body.innerHTML = "";
  await Object.values(scripts)[0]();
  expect(document.querySelector(".dashboard-topbar")).toBeNull();
});

it("returns safely when the topbar has no controls container", async () => {
  document.body.innerHTML = '<header class="topbar"></header>';
  await Object.values(scripts)[0]();
  expect(document.querySelector("header").classList.contains("dashboard-topbar")).toBe(true);
});

it("adds a menu shortcut to dashboard pages that do not already have one", async () => {
  document.body.innerHTML = '<header class="topbar"><nav class="actions"></nav></header>';
  history.replaceState({}, "", "/legacy/dashboard.html");
  await Object.values(scripts)[0]();
  expect(document.querySelector(".actions .menu-link").getAttribute("href")).toBe("./menu.html");
});
