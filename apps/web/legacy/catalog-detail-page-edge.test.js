import { afterEach, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/catalog-detail-page.js");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

it("exports a legacy catalog row using the documented empty-value defaults", async () => {
  document.body.innerHTML = '<button id="exportExcel"></button>';
  history.replaceState({}, "", "/legacy/catalog-detail.html");
  vi.stubGlobal("FMSStorage", { getItem: () => JSON.stringify([{}]) });
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:legacy-catalog"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  const downloadedFiles = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloadedFiles.push(this.download); });
  await Object.values(scripts)[0]();

  document.getElementById("exportExcel").click();
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  expect(downloadedFiles).toEqual(["catalog-item.csv"]);
  expect(await URLStub.createObjectURL.mock.calls[0][0].text()).toContain("Name,Code,Category,Total,Used,Remaining\n,,,0,0,0");
  expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
});

it("tolerates an uninitialized catalog cache and pages without optional controls", async () => {
  document.body.innerHTML = '<button id="exportExcel"></button>';
  history.replaceState({}, "", "/legacy/catalog-detail.html");
  vi.stubGlobal("FMSStorage", { getItem: () => null });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  document.getElementById("exportExcel").click();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});
