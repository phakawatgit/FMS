import { redirect } from "next/navigation";
import Home from "./page";

describe("Home page", () => {
  it("opens the real Front-end entry page", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/legacy/index.html");
    expect(redirect).toHaveBeenCalledWith("/legacy/index.html");
  });
});
