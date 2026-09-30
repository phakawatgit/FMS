import { render, screen } from "@testing-library/react";
import { MenuCard } from "./MenuCard";

describe("MenuCard", () => {
  it("renders the title, description, image and destination", () => {
    render(<MenuCard title="คลังยา" description="จัดการยา" image="7.png" href="/stock" />);

    expect(screen.getByRole("link", { name: /คลังยา จัดการยา/i })).toHaveAttribute("href", "/stock");
    expect(screen.getByRole("img", { name: "คลังยา" })).toHaveAttribute("src", "/assets/7.png");
    expect(screen.getByText("จัดการยา")).toBeInTheDocument();
  });
});
