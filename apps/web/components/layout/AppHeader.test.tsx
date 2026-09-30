import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows Thai controls and calls the language handler", async () => {
    const onLanguageChange = jest.fn();
    const user = userEvent.setup();
    render(<AppHeader language="th" onLanguageChange={onLanguageChange} />);

    const button = screen.getByRole("button", { name: "เปลี่ยนเป็นภาษาอังกฤษ" });
    expect(screen.getByText("ไทย")).toBeInTheDocument();
    await user.click(button);
    expect(onLanguageChange).toHaveBeenCalledTimes(1);
  });
});
