import { describe, expect, it, vi } from "vitest";
import ModuleRoute from "./page";

const { notFound } = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error("not-found"); }) }));
vi.mock("next/navigation", () => ({ notFound }));

describe("module route", () => {
  it("renders a registered module", async () => {
    const view = await ModuleRoute({ params: Promise.resolve({ slug: "catalog" }) });
    expect(view.props.title).toBe("Catalog");
  });

  it("returns not found for an unknown module", async () => {
    await expect(ModuleRoute({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
