const SNAPSHOT_VERSION = 1;
const MAX_ELEMENTS = 1_500;

const trackedStyleProperties = [
  "display", "position", "top", "right", "bottom", "left", "inset",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "align-items", "align-self", "justify-content", "justify-self",
  "color", "background-color", "background-image", "background-position", "background-size",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-radius", "box-shadow", "outline", "opacity", "transform",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-align", "text-decoration", "text-transform", "white-space",
  "visibility", "overflow", "overflow-x", "overflow-y", "object-fit",
] as const;

export type PageSnapshotNode = {
  tag: string;
  attributes: string;
  text: string;
  styles: string;
  children: PageSnapshotNode[];
};

export type PageSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  location: string;
  root: PageSnapshotNode;
};

type LivePageSnapshot = {
  snapshot: PageSnapshot;
  elements: Map<string, Element>;
};

function pathKey(path: number[]) {
  return path.join(".");
}

function isEditorElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  return tag === "script"
    || tag === "style"
    || tag === "noscript"
    || tag === "template"
    || tag === "nextjs-portal"
    || element.hasAttribute("data-shan-editor");
}

function directText(element: Element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(element: Element) {
  return Array.from(element.attributes)
    .filter((attribute) => !attribute.name.startsWith("data-shan-"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((attribute) => `${attribute.name}=${JSON.stringify(attribute.value)}`)
    .join(";");
}

function computedStyles(element: Element) {
  const style = window.getComputedStyle(element);
  return trackedStyleProperties.map((property) => style.getPropertyValue(property)).join("\u001f");
}

export function capturePageSnapshot(root: Element): LivePageSnapshot {
  const elements = new Map<string, Element>();
  let count = 0;

  function capture(element: Element, path: number[]): PageSnapshotNode {
    count += 1;
    elements.set(pathKey(path), element);
    const children: PageSnapshotNode[] = [];
    if (count < MAX_ELEMENTS) {
      for (const child of Array.from(element.children).filter((candidate) => !isEditorElement(candidate))) {
        children.push(capture(child, [...path, children.length]));
        if (count >= MAX_ELEMENTS) break;
      }
    }
    return {
      tag: element.tagName.toLowerCase(),
      attributes: attributes(element),
      text: directText(element),
      styles: computedStyles(element),
      children,
    };
  }

  return {
    snapshot: {
      version: SNAPSHOT_VERSION,
      location: `${window.location.pathname}${window.location.search}`,
      root: capture(root, []),
    },
    elements,
  };
}

function markupSignature(node: PageSnapshotNode): string {
  return JSON.stringify({
    tag: node.tag,
    attributes: node.attributes,
    text: node.text,
    children: node.children.map(markupSignature),
  });
}

function ownMarkupSignature(node: PageSnapshotNode) {
  return `${node.tag}\u001e${node.attributes}\u001e${node.text}`;
}

function exactChildMatches(before: PageSnapshotNode[], after: PageSnapshotNode[]) {
  const beforeSignatures = before.map(markupSignature);
  const afterSignatures = after.map(markupSignature);
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));

  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      lengths[beforeIndex][afterIndex] = beforeSignatures[beforeIndex] === afterSignatures[afterIndex]
        ? lengths[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(lengths[beforeIndex + 1][afterIndex], lengths[beforeIndex][afterIndex + 1]);
    }
  }

  const matches: Array<[number, number]> = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length && afterIndex < after.length) {
    if (beforeSignatures[beforeIndex] === afterSignatures[afterIndex]) {
      matches.push([beforeIndex, afterIndex]);
      beforeIndex += 1;
      afterIndex += 1;
    } else if (lengths[beforeIndex + 1][afterIndex] >= lengths[beforeIndex][afterIndex + 1]) {
      beforeIndex += 1;
    } else {
      afterIndex += 1;
    }
  }
  return matches;
}

/** Find the smallest visible Elements that differ in the new Page tree. */
export function changedElementPaths(before: PageSnapshot, after: PageSnapshot) {
  if (before.version !== SNAPSHOT_VERSION || before.location !== after.location) return [];
  const changed = new Map<string, number[]>();

  function add(path: number[]) {
    changed.set(pathKey(path), path);
  }

  function compareStyles(beforeNode: PageSnapshotNode, afterNode: PageSnapshotNode, path: number[]): boolean {
    let descendantChanged = false;
    for (let index = 0; index < afterNode.children.length; index += 1) {
      descendantChanged = compareStyles(beforeNode.children[index], afterNode.children[index], [...path, index])
        || descendantChanged;
    }
    const ownStyleChanged = beforeNode.styles !== afterNode.styles;
    // Used geometry on an ancestor can change because one of its children
    // changed. Prefer the smallest visible Element in that case.
    if (ownStyleChanged && !descendantChanged) add(path);
    return ownStyleChanged || descendantChanged;
  }

  function compare(beforeNode: PageSnapshotNode, afterNode: PageSnapshotNode, path: number[]) {
    if (markupSignature(beforeNode) === markupSignature(afterNode)) {
      compareStyles(beforeNode, afterNode, path);
      return;
    }
    if (beforeNode.tag !== afterNode.tag || ownMarkupSignature(beforeNode) !== ownMarkupSignature(afterNode)) {
      add(path);
      return;
    }

    const exactMatches = exactChildMatches(beforeNode.children, afterNode.children);
    const anchors: Array<[number, number]> = [[-1, -1], ...exactMatches, [beforeNode.children.length, afterNode.children.length]];

    for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex += 1) {
      const [previousBefore, previousAfter] = anchors[anchorIndex];
      const [nextBefore, nextAfter] = anchors[anchorIndex + 1];
      const beforeIndexes = Array.from(
        { length: nextBefore - previousBefore - 1 },
        (_, index) => previousBefore + index + 1,
      );
      const afterIndexes = Array.from(
        { length: nextAfter - previousAfter - 1 },
        (_, index) => previousAfter + index + 1,
      );
      const pairedBefore = new Set<number>();

      for (const afterIndex of afterIndexes) {
        const beforeIndex = beforeIndexes.find((candidate) =>
          !pairedBefore.has(candidate)
          && beforeNode.children[candidate].tag === afterNode.children[afterIndex].tag,
        );
        if (beforeIndex === undefined) add([...path, afterIndex]);
        else {
          pairedBefore.add(beforeIndex);
          compare(beforeNode.children[beforeIndex], afterNode.children[afterIndex], [...path, afterIndex]);
        }
      }

      // A removed Element has no new box, so identify its nearest visible parent.
      if (pairedBefore.size < beforeIndexes.length) add(path);
    }

    for (const [beforeIndex, afterIndex] of exactMatches) {
      compare(beforeNode.children[beforeIndex], afterNode.children[afterIndex], [...path, afterIndex]);
    }
  }

  compare(before.root, after.root, []);
  return [...changed.values()];
}

export function changedElements(before: PageSnapshot, current: LivePageSnapshot) {
  return changedElementPaths(before, current.snapshot)
    .map((path) => current.elements.get(pathKey(path)))
    .filter((element): element is Element => !!element);
}

export function isPageSnapshot(value: unknown): value is PageSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PageSnapshot>;
  return candidate.version === SNAPSHOT_VERSION
    && typeof candidate.location === "string"
    && !!candidate.root
    && typeof candidate.root === "object";
}
