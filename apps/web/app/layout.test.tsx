import { describe, expect, it } from "vitest";
import { metadata, viewport, default as RootLayout } from "./layout";

describe("root layout", () => {
  it("provides Thai document language and page metadata", () => {
    const view = RootLayout({ children: <main>content</main> });
    expect(view.props.lang).toBe("th");
    expect(view.props.children.props.children.type).toBe("main");
    expect(metadata.title).toContain("FMS");
    expect(viewport.initialScale).toBe(1);
  });
});
