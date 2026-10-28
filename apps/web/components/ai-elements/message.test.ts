import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeImage } from "./message";

const render = (src: string) => renderToStaticMarkup(createElement(SafeImage, { src, alt: "chart" }));

describe("SafeImage", () => {
  it("doesn't load remote images until the user asks", () => {
    const html = render("https://evil.example/p.png?d=private-email-summary");
    expect(html).not.toContain("<img");
    expect(html).toContain("Load image from evil.example");
  });

  it("shows inline images directly", () => {
    expect(render("data:image/png;base64,iVBORw0KGgo=")).toContain("<img");
  });

  it("renders nothing for an unusable source", () => {
    expect(render("")).toBe("");
  });
});
