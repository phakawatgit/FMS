import { getApiOverview } from "./api";

describe("getApiOverview", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
    });
  });

  afterEach(() => fetchMock.mockReset());

  it("returns the API overview for a successful response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
      success: true,
      data: { message: "ok", database: "connected", counts: { users: 2, dutyShifts: 3 }, modules: [] },
      }),
    });

    await expect(getApiOverview()).resolves.toMatchObject({ data: { database: "connected" } });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/overview", { cache: "no-store" });
  });

  it("throws the server message for an error response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: "API down" }),
    });
    await expect(getApiOverview()).rejects.toThrow("API down");
  });
});
