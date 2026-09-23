import { describe, expect, test } from "bun:test";
import { normalizePromptContext, promptWithContext } from "./context";

describe("visual prompt context", () => {
  test("bounds and normalizes selected-element and drawing data", () => {
    const context = normalizePromptContext({
      selectedElement: {
        selector: "#hero",
        tagName: "section",
        classNames: ["hero", 4],
        text: "Welcome",
        html: "<section id=\"hero\">Welcome</section>",
        bounds: { x: 10, y: 20, width: -5, height: 300 },
      },
      drawing: [
        { x: -2, y: 3, t: -10 },
        { x: "bad", y: 0, t: 1 },
      ],
    });

    expect(context?.selectedElement).toMatchObject({
      selector: "#hero",
      tagName: "section",
      classNames: ["hero"],
      bounds: { x: 10, y: 20, width: 0, height: 300 },
    });
    expect(context?.drawing).toEqual([{ x: 0, y: 1, t: 0 }]);
  });

  test("adds visual context to the coding request", () => {
    const context = normalizePromptContext({
      selectedElement: {
        selector: "main > h1",
        tagName: "h1",
        classNames: [],
        text: "Hello",
        html: "<h1>Hello</h1>",
        bounds: {},
      },
      drawing: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.8, y: 0.2, t: 300 }],
    });
    const result = promptWithContext("Move it right", context);

    expect(result).toContain("Requested change:\nMove it right");
    expect(result).toContain("Selected element context");
    expect(result).toContain("main > h1");
    expect(result).toContain("Drawing note over the viewport");
  });
});
