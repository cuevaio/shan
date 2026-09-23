"use client";

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import type { NebiApiResponse, Proposal } from "./types";

export type NebiToolbarProps = {
  endpoint?: string;
  className?: string;
  placeholder?: string;
  /** Time for the Next.js compiler to settle before reloading the preview. */
  previewReloadDelayMs?: number;
};

type ToolbarState =
  | { name: "idle" }
  | { name: "working" }
  | { name: "refreshing"; proposal: Proposal }
  | { name: "previewing"; proposal: Proposal }
  | { name: "deciding"; proposal: Proposal; action: "keep" | "discard" }
  | { name: "success"; message: string }
  | { name: "error"; message: string; proposal?: Proposal };

const styles: Record<string, CSSProperties> = {
  shell: {
    position: "fixed",
    zIndex: 2147483647,
    left: "50%",
    bottom: 20,
    width: "min(680px, calc(100vw - 28px))",
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
    padding: "8px 13px",
    color: "#e5e7eb",
    background: "transparent",
    font: "600 13px/1.4 inherit",
    cursor: "pointer",
  },
  proposal: {
    borderTop: "1px solid rgba(255,255,255,.1)",
    padding: "14px 16px 16px",
  },
  file: {
    borderTop: "1px solid rgba(255,255,255,.08)",
    padding: "7px 0",
  },
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

async function post(endpoint: string, body: unknown): Promise<NebiApiResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as NebiApiResponse;
  if (!response.ok || result.status === "error") {
    throw new Error(result.status === "error" ? result.error : `Request failed (${response.status})`);
  }
  return result;
}

export function NebiToolbar({
  endpoint = "/api/nebi",
  className,
  placeholder = "Describe a change…",
  previewReloadDelayMs = 500,
}: NebiToolbarProps) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<ToolbarState>({ name: "idle" });
  const busy = state.name === "working" || state.name === "refreshing" || state.name === "deciding";
  const proposal = state.name === "refreshing" || state.name === "previewing" || state.name === "deciding"
    ? state.proposal
    : state.name === "error"
      ? state.proposal
      : undefined;

  useEffect(() => {
    let cancelled = false;
    void post(endpoint, { action: "status" })
      .then((result) => {
        if (!cancelled && result.status === "previewing") {
          setState({ name: "previewing", proposal: result.proposal });
        }
      })
      .catch(() => {
        // The route may be disabled. A user-initiated request will show the error.
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  async function sendPrompt(event?: FormEvent) {
    event?.preventDefault();
    const value = prompt.trim();
    if (!value || busy || proposal) return;
    setState({ name: "working" });
    try {
      const result = await post(endpoint, { action: "prompt", prompt: value });
      if (result.status !== "previewing") throw new Error("The agent returned an unexpected response.");
      setState({ name: "refreshing", proposal: result.proposal });
      // A filesystem write completes before Next's development compiler has
      // necessarily produced the updated route. Reload after a short settle
      // period; the status request on mount restores this active preview.
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
      let fileCount: number;
      if (action === "keep") {
        if (result.status !== "kept") throw new Error("The agent returned an unexpected response.");
        fileCount = result.files.length;
      } else {
        if (result.status !== "discarded") throw new Error("The agent returned an unexpected response.");
        fileCount = result.files.length;
      }
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

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  }

  return (
    <aside className={className} style={styles.shell} aria-label="Nebi coding agent">
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
          {state.name === "working" ? "Working…" : "Send"}
        </button>
      </form>

      {proposal && (
        <section style={styles.proposal} aria-live="polite">
          <div style={{ marginBottom: 8, color: state.name === "refreshing" ? "#facc15" : "#86efac", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>
            {state.name === "refreshing" ? "Applying changes…" : "Changes are live — try the app now"}
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
              {state.name === "deciding" && state.action === "discard" ? "Discarding…" : "Discard Changes"}
            </button>
            <button type="button" style={styles.button} disabled={busy} onClick={() => void decide("keep")}>
              {state.name === "deciding" && state.action === "keep" ? "Keeping…" : "Keep Changes"}
            </button>
          </div>
        </section>
      )}

      {(state.name === "error" || state.name === "success") && (
        <div role="status" style={{ borderTop: "1px solid rgba(255,255,255,.1)", padding: "9px 16px", color: state.name === "error" ? "#fca5a5" : "#86efac" }}>
          {state.message}
        </div>
      )}
    </aside>
  );
}
