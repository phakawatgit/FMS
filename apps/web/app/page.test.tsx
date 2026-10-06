import { describe, expect, it, vi } from "vitest";
import Home from "./page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn((path: string) => path) }));
vi.mock("next/navigation", () => ({ redirect }));

describe("home route", () => {
  it("redirects to the legacy application", async () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/legacy/index.html");
  });
});
