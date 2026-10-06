import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModulePage } from "./ModulePage";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));

describe("ModulePage", () => {
  it("renders module information and a link back home", () => {
    render(<ModulePage title="Stock" description="Manage medicine" />);
    expect(screen.getByRole("heading", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByText("Manage medicine")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
