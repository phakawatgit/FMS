import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiOverview } from "./api";

describe("getApiOverview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the overview without using a cached response", async () => {
    const overview = {
      success: true,
      data: {
        message: "API is ready",
        database: "connected" as const,
        counts: { users: 2, dutyShifts: 3 },
        modules: ["catalog"],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => overview,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApiOverview()).resolves.toEqual(overview);
    expect(fetchMock).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/overview`,
      { cache: "no-store" },
    );
  });

  it("throws the API message when the response is not successful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message: "Unavailable" }),
      }),
    );

    await expect(getApiOverview()).rejects.toThrow("Unavailable");
  });

  it("uses a fallback message when an unsuccessful response has no message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      }),
    );

    await expect(getApiOverview()).rejects.toThrow("API request failed");
  });
});
