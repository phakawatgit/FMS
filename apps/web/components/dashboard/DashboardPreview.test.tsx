import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPreview } from "./DashboardPreview";

describe("DashboardPreview", () => {
  it.each([[true, "Duty shift"], [false, "Duty shift"]])("renders the calendar and color options (%s)", (thai) => {
    render(<DashboardPreview thai={thai} />);
    expect(screen.getByRole("heading", { name: thai ? "การเข้าเวร" : "Duty shift" })).toBeInTheDocument();
    expect(screen.getByText(thai ? "เลือกแถบสี" : "Choose a color")).toBeInTheDocument();
    expect(document.querySelectorAll("div.grid.grid-cols-5 span[style]")).toHaveLength(20);
  });
});
