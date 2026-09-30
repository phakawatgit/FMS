import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("validates empty credentials without navigating", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(screen.getByText("กรุณากรอกอีเมลและรหัสผ่าน")).toBeInTheDocument();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it("navigates after valid credentials are entered", async () => {
    const user = userEvent.setup();
    const router = useRouter();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("อีเมล"), "user@example.com");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "secret");
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(router.push).toHaveBeenCalledWith("/");
  });
});
