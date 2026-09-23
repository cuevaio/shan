"use client";

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  cleanStroke,
  cleanupPlan,
  parseMotionSpec,
  playMotion,
  readingPlan,
  sampleForModel,
  stopMotion,
  strokeIsUsable,
  strokePolyline,
  useStrokeCapture,
} from "./motion";
import type {
  Proposal,
  SelectedElementContext,
  ShanApiResponse,
  ShanPromptContext,
} from "./types";

export type ShanEditorProps = {
  endpoint?: string;
  className?: string;
  placeholder?: string;
  /** Time for the Next.js compiler to settle before reloading the preview. */
  previewReloadDelayMs?: number;
};

type EditorMode = "idle" | "select" | "draw";
type EditorState =
  | { name: "idle" }
  | { name: "working" }
  | { name: "refreshing"; proposal: Proposal }
  | { name: "previewing"; proposal: Proposal }
  | { name: "deciding"; proposal: Proposal; action: "keep" | "discard" }
  | { name: "success"; message: string }
  | { name: "error"; message: string; proposal?: Proposal };

type Box = { top: number; left: number; width: number; height: number };

const styles: Record<string, CSSProperties> = {
  shell: {
    position: "fixed",
    zIndex: 2147483647,
    left: "50%",
    bottom: 20,
    width: "min(720px, calc(100vw - 28px))",
    transform: "translateX(-50%)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 18,
    background: "rgba(15, 17, 22, .96)",
    boxShadow: "0 24px 70px rgba(0,0,0,.35)",
    color: "#f7f7f8",
    font: "500 14px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    overflow: "hidden",
    backdropFilter: "blur(16px)",
  },
  tools: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, padding: "10px 10px 0" },
  composer: { display: "flex", alignItems: "flex-end", gap: 10, padding: 10 },
  textarea: {
    flex: 1,
    minHeight: 24,
    maxHeight: 120,
    resize: "vertical",
    border: 0,
    outline: 0,
    padding: "10px 11px",
    color: "inherit",
    background: "transparent",
    font: "inherit",
  },
  button: {
    border: 0,
    borderRadius: 10,
    padding: "9px 14px",
    color: "#101114",
    background: "#f4f4f5",
    font: "600 13px/1.4 inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  mutedButton: {
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: 10,
    padding: "8px 11px",
    color: "#e5e7eb",
    background: "transparent",
    font: "600 12px/1.4 inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  activeButton: {
    border: "1px solid #a78bfa",
    color: "#ede9fe",
    background: "rgba(124,58,237,.32)",
  },
  context: {
    minWidth: 0,
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  proposal: { borderTop: "1px solid rgba(255,255,255,.1)", padding: "14px 16px 16px" },
  file: { borderTop: "1px solid rgba(255,255,255,.08)", padding: "7px 0" },
  patch: {
    maxHeight: 220,
    overflow: "auto",
    margin: "8px 0 2px",
    padding: 10,
    borderRadius: 8,
    color: "#d1d5db",
    background: "#090a0d",
    font: "11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
    whiteSpace: "pre",
  },
};

async function post(endpoint: string, body: unknown): Promise<ShanApiResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as ShanApiResponse;
  if (!response.ok || result.status === "error") {
    throw new Error(result.status === "error"
      ? result.error ?? result.message ?? "Shan request failed."
      : `Request failed (${response.status})`);
  }
  return result;
}

function escaped(value: string) {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function selectorFor(element: Element) {
  if (element.id) return `#${escaped(element.id)}`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && parts.length < 6) {
    let part = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
  }
  return parts.join(" > ");
}

function elementContext(element: Element): SelectedElementContext {
  const rect = element.getBoundingClientRect();
  return {
    selector: selectorFor(element),
    tagName: element.tagName.toLowerCase(),
    ...(element.id ? { id: element.id } : {}),
    classNames: (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 30),
    text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1_000),
    html: element.outerHTML.slice(0, 4_000),
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

function boxFor(element: Element | null): Box | null {
  if (!element?.isConnected) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function ShanEditor({
  endpoint = "/api/shan",
  className,
  placeholder = "Describe a change…",
  previewReloadDelayMs = 500,
}: ShanEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<EditorState>({ name: "idle" });
  const [mode, setMode] = useState<EditorMode>("idle");
  const [selected, setSelected] = useState<SelectedElementContext | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [motionMessage, setMotionMessage] = useState("");
  const selectedNode = useRef<Element | null>(null);
  const stroke = useStrokeCapture({
    enabled: mode === "draw",
    onStart: () => setMotionMessage("Drawing note captured."),
  });
  const busy = state.name === "working" || state.name === "refreshing" || state.name === "deciding";
  const proposal = state.name === "refreshing" || state.name === "previewing" || state.name === "deciding"
    ? state.proposal
    : state.name === "error"
      ? state.proposal
      : undefined;

  const updateSelectedBox = useCallback(() => setSelectedBox(boxFor(selectedNode.current)), []);

  useEffect(() => {
    let cancelled = false;
    void post(endpoint, { action: "status" })
      .then((result) => {
        if (!cancelled && result.status === "previewing") setState({ name: "previewing", proposal: result.proposal });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [endpoint]);

  useEffect(() => {
    if (!selected) return;
    updateSelectedBox();
    window.addEventListener("resize", updateSelectedBox);
    window.addEventListener("scroll", updateSelectedBox, true);
    return () => {
      window.removeEventListener("resize", updateSelectedBox);
      window.removeEventListener("scroll", updateSelectedBox, true);
    };
  }, [selected, updateSelectedBox]);

  useEffect(() => {
    if (mode !== "select") {
      setHoverBox(null);
      return;
    }
    const candidate = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      return element?.closest("[data-shan-editor]") ? null : element;
    };
    const onMove = (event: PointerEvent) => setHoverBox(boxFor(candidate(event.target)));
    const onClick = (event: MouseEvent) => {
      const element = candidate(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      selectedNode.current = element;
      setSelected(elementContext(element));
      setSelectedBox(boxFor(element));
      setHoverBox(null);
      setMode("idle");
      setMotionMessage("");
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [mode]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMode("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function promptContext(): ShanPromptContext | undefined {
    const drawing = sampleForModel(stroke.getPoints());
    if (!selected && drawing.length === 0) return undefined;
    return {
      ...(selected ? { selectedElement: selected } : {}),
      ...(drawing.length ? { drawing } : {}),
    };
  }

  async function sendPrompt(event?: FormEvent) {
    event?.preventDefault();
    const value = prompt.trim();
    if (!value || busy || proposal) return;
    setState({ name: "working" });
    try {
      const result = await post(endpoint, { action: "prompt", prompt: value, context: promptContext() });
      if (result.status !== "previewing") throw new Error("The agent returned an unexpected response.");
      setState({ name: "refreshing", proposal: result.proposal });
      window.setTimeout(() => window.location.reload(), Math.max(0, previewReloadDelayMs));
    } catch (error) {
      setState({ name: "error", message: error instanceof Error ? error.message : "Agent request failed." });
    }
  }

  async function decide(action: "keep" | "discard") {
    if (!proposal || busy) return;
    setState({ name: "deciding", proposal, action });
    try {
      const result = await post(endpoint, { action, proposalId: proposal.id });
      if (action === "keep" && result.status !== "kept") throw new Error("The agent returned an unexpected response.");
      if (action === "discard" && result.status !== "discarded") throw new Error("The agent returned an unexpected response.");
      const fileCount = result.status === "kept" || result.status === "discarded" ? result.files.length : 0;
      setPrompt("");
      setState({
        name: "success",
        message: action === "keep"
          ? `Kept ${fileCount} changed file${fileCount === 1 ? "" : "s"}.`
          : `Discarded changes in ${fileCount} file${fileCount === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      setState({ name: "error", message: error instanceof Error ? error.message : `Could not ${action} changes.`, proposal });
    }
  }

  function playDrawing() {
    const points = stroke.getPoints();
    if (!selectedNode.current || !strokeIsUsable(points)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playMotion(selectedNode.current, cleanupPlan(cleanStroke(points), reduced));
    setMotionMessage("Playing the drawing on the selected element.");
  }

  async function refineMotion() {
    const points = stroke.getPoints();
    if (!selectedNode.current || !strokeIsUsable(points)) return;
    setMotionMessage("Reading the drawing…");
    try {
      const result = await post(endpoint, { action: "motion", points: sampleForModel(points) });
      if (result.status === "waiting") {
        setMotionMessage(result.message);
        playDrawing();
        return;
      }
      if (result.status !== "reading") throw new Error("The model did not return a motion.");
      const spec = parseMotionSpec(result.spec);
      if (!spec) throw new Error("The model did not return a motion.");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      playMotion(selectedNode.current, readingPlan(spec, points, reduced));
      setMotionMessage(spec.reading || `Playing ${spec.name}.`);
    } catch (error) {
      setMotionMessage(error instanceof Error ? error.message : "Could not read the drawing.");
    }
  }

  function clearContext() {
    stopMotion(selectedNode.current);
    selectedNode.current = null;
    setSelected(null);
    setSelectedBox(null);
    stroke.clear();
    setMode("idle");
    setMotionMessage("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  }

  const drawingReady = strokeIsUsable(stroke.points);
  const contextLabel = selected
    ? `${selected.selector}${stroke.points.length ? ` · drawing ${stroke.points.length} points` : ""}`
    : stroke.points.length
      ? `Drawing note · ${stroke.points.length} points`
      : "No element selected — prompt applies globally";

  return (
    <>
      {mode === "draw" ? (
        <div
          {...stroke.bindings}
          aria-label="Draw a note over the page"
          style={{ position: "fixed", inset: 0, zIndex: 2147483645, cursor: "crosshair", touchAction: "none" }}
        />
      ) : null}
      {stroke.points.length > 1 ? (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 2147483646, width: "100%", height: "100%", pointerEvents: "none" }}>
          <polyline points={strokePolyline(stroke.points)} fill="none" stroke="#7c3aed" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {hoverBox ? <Highlight box={hoverBox} color="#60a5fa" /> : null}
      {selectedBox ? <Highlight box={selectedBox} color="#a78bfa" /> : null}

      <aside data-shan-editor className={className} style={styles.shell} aria-label="Shan visual editor">
        <div style={styles.tools}>
          <button type="button" style={{ ...styles.mutedButton, ...(mode === "select" ? styles.activeButton : {}) }} onClick={() => setMode(mode === "select" ? "idle" : "select")}>
            {selected ? "Change selection" : "Select element"}
          </button>
          <button type="button" style={{ ...styles.mutedButton, ...(mode === "draw" ? styles.activeButton : {}) }} onClick={() => setMode(mode === "draw" ? "idle" : "draw")}>
            Draw note
          </button>
          <button type="button" style={styles.mutedButton} disabled={!selected || !drawingReady} onClick={playDrawing}>Play drawing</button>
          <button type="button" style={styles.mutedButton} disabled={!selected || !drawingReady} onClick={() => void refineMotion()}>Refine motion</button>
          <button type="button" style={styles.mutedButton} disabled={!selected && stroke.points.length === 0} onClick={clearContext}>Clear context</button>
          <div title={contextLabel} style={styles.context}>{contextLabel}</div>
        </div>
        {motionMessage ? <div role="status" style={{ padding: "7px 14px 0", color: "#c4b5fd", fontSize: 12 }}>{motionMessage}</div> : null}

        <form style={styles.composer} onSubmit={sendPrompt}>
          <textarea
            aria-label="Change prompt"
            value={prompt}
            disabled={busy || !!proposal}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={state.name === "working" || state.name === "refreshing" ? "Applying changes…" : proposal ? "Keep or discard the current changes first" : placeholder}
            rows={1}
            style={styles.textarea}
          />
          <button disabled={!prompt.trim() || busy || !!proposal} type="submit" style={{ ...styles.button, opacity: !prompt.trim() || busy || proposal ? .5 : 1 }}>
            {state.name === "working" ? "Working…" : "Apply"}
          </button>
        </form>

        {proposal ? (
          <section style={styles.proposal} aria-live="polite">
            <div style={{ marginBottom: 8, color: state.name === "refreshing" ? "#facc15" : "#86efac", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>
              {state.name === "refreshing" ? "Applying changes…" : "Changes are live — try the page now"}
            </div>
            <div style={{ marginBottom: 9 }}>{proposal.summary}</div>
            <div>
              {proposal.files.map((file) => (
                <details key={file.path} style={styles.file}>
                  <summary style={{ cursor: "pointer" }}>
                    <span style={{ opacity: .65, marginRight: 7 }}>{file.status}</span>
                    {file.path}
                    <span style={{ marginLeft: 8, color: "#86efac" }}>+{file.additions}</span>
                    <span style={{ marginLeft: 4, color: "#fca5a5" }}>−{file.deletions}</span>
                  </summary>
                  <pre style={styles.patch}>{file.patch}</pre>
                </details>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button type="button" style={styles.mutedButton} disabled={busy} onClick={() => void decide("discard")}>
                {state.name === "deciding" && state.action === "discard" ? "Discarding…" : "Discard changes"}
              </button>
              <button type="button" style={styles.button} disabled={busy} onClick={() => void decide("keep")}>
                {state.name === "deciding" && state.action === "keep" ? "Keeping…" : "Keep changes"}
              </button>
            </div>
          </section>
        ) : null}

        {state.name === "error" || state.name === "success" ? (
          <div role="status" style={{ borderTop: "1px solid rgba(255,255,255,.1)", padding: "9px 16px", color: state.name === "error" ? "#fca5a5" : "#86efac" }}>
            {state.message}
          </div>
        ) : null}
      </aside>
    </>
  );
}

function Highlight({ box, color }: { box: Box; color: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        zIndex: 2147483644,
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        border: `2px solid ${color}`,
        borderRadius: 4,
        background: `${color}18`,
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
