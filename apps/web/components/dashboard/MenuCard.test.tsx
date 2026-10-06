import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuCard } from "./MenuCard";

describe("MenuCard", () => {
  it("shows its title and description and links to its destination", () => {
    render(
      <MenuCard
        title="Medicine catalog"
        description="Browse available medicine"
        image="catalog.png"
        href="/catalog"
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("heading", { name: "Medicine catalog" })).toBeInTheDocument();
    expect(screen.getByText("Browse available medicine")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Medicine catalog" })).toBeInTheDocument();
  });
});
