import { describe, expect, test } from "bun:test";
import { changedElementPaths, type PageSnapshot, type PageSnapshotNode } from "./change-preview";

function node(tag: string, text = "", children: PageSnapshotNode[] = [], styles = ""): PageSnapshotNode {
  return { tag, text, children, styles, attributes: "" };
}

function snapshot(root: PageSnapshotNode): PageSnapshot {
  return { version: 1, location: "/", root };
}

describe("Change Preview Element detection", () => {
  test("does not identify unchanged Elements", () => {
    const page = snapshot(node("body", "", [node("h1", "Hello")]));
    expect(changedElementPaths(page, page)).toEqual([]);
  });

  test("identifies the smallest Element whose text changed", () => {
    const before = snapshot(node("body", "", [node("main", "", [node("h1", "Before")])]));
    const after = snapshot(node("body", "", [node("main", "", [node("h1", "After")])]));
    expect(changedElementPaths(before, after)).toEqual([[0, 0]]);
  });

  test("identifies an added Element without marking unchanged siblings", () => {
    const existing = node("li", "Existing");
    const before = snapshot(node("body", "", [node("ul", "", [existing])]));
    const after = snapshot(node("body", "", [node("ul", "", [existing, node("li", "New")])]));
    expect(changedElementPaths(before, after)).toEqual([[0, 1]]);
  });

  test("identifies the visible parent when an Element was removed", () => {
    const before = snapshot(node("body", "", [node("section", "", [node("p", "Remove me")])]));
    const after = snapshot(node("body", "", [node("section")]));
    expect(changedElementPaths(before, after)).toEqual([[0]]);
  });

  test("identifies CSS-only changes", () => {
    const before = snapshot(node("body", "", [node("button", "Save", [], "blue")]));
    const after = snapshot(node("body", "", [node("button", "Save", [], "purple")]));
    expect(changedElementPaths(before, after)).toEqual([[0]]);
  });

  test("prefers a styled child over an ancestor with resulting geometry changes", () => {
    const before = snapshot(node("body", "", [node("div", "Card", [], "width:100")], "height:100"));
    const after = snapshot(node("body", "", [node("div", "Card", [], "width:200")], "height:200"));
    expect(changedElementPaths(before, after)).toEqual([[0]]);
  });
});
