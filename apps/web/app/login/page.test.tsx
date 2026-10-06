import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));

describe("login page", () => {
  beforeEach(() => push.mockClear());

  it("shows validation feedback when credentials are missing", () => {
    render(<LoginPage />);
    fireEvent.submit(document.querySelector("form")!);
    expect(document.querySelector("form")?.querySelector("p")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("routes to the home page after credentials are entered", () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "nurse@example.com" } });
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "secret" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(push).toHaveBeenCalledWith("/");
  });
});
