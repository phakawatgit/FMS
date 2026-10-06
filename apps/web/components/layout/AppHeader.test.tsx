import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it.each(["th", "en"] as const)("shows the %s language state", (language) => {
    const onLanguageChange = vi.fn();
    render(<AppHeader language={language} onLanguageChange={onLanguageChange} />);
    expect(screen.getByRole("img", { name: "FMS" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onLanguageChange).toHaveBeenCalledOnce();
    if (language === "en") expect(screen.getByText("English")).toBeInTheDocument();
  });
});
