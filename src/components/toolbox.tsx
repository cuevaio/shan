"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import type { MotionSpec } from "@/lib/motion-spec";
import { motionLabel } from "@/lib/motion-spec";
import { PICTURES, type PictureId } from "@/lib/pictures";
import type { StrokePoint } from "@/lib/stroke";

export type RefineView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "waiting" }
  | { status: "reading"; spec: MotionSpec; latencyMs: number; model: string }
  | { status: "error"; message: string };

type ToolboxProps = {
  open: boolean;
  anchor: HTMLElement | null;
  configured: boolean | null;
  pictureId: PictureId | null;
  rawPoints: StrokePoint[];
  cleanedPoints: StrokePoint[];
  strokeReady: boolean;
  refineView: RefineView;
  onClose: () => void;
  onDrawStart: (point: StrokePoint) => void;
  onDrawMove: (point: StrokePoint) => void;
  onClear: () => void;
  onRefine: () => void;
  onPlayCleanup: () => void;
  onPlayReading: () => void;
  onExited: () => void;
};

function polyline(points: StrokePoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function StrokePreview({
  rawPoints,
  cleanedPoints,
}: {
  rawPoints: StrokePoint[];
  cleanedPoints: StrokePoint[];
}) {
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="h-16 w-full rounded-xl bg-black/[0.03]"
      role="img"
      aria-label="Local cleanup of the stroke"
    >
      {rawPoints.length > 1 ? (
        <polyline
          points={polyline(rawPoints)}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {cleanedPoints.length > 1 ? (
        <polyline
          points={polyline(cleanedPoints)}
          fill="none"
          stroke="black"
          strokeWidth="1.75"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function recognitionLine(recognized: boolean | null) {
  if (recognized === true) return "Gesture recognized";
  if (recognized === false) return "Gesture not recognized";
  return "Recognition was not reported";
}

export function Toolbox({
  open,
  anchor,
  configured,
  pictureId,
  rawPoints,
  cleanedPoints,
  strokeReady,
  refineView,
  onClose,
  onDrawStart,
  onDrawMove,
  onClear,
  onRefine,
  onPlayCleanup,
  onPlayReading,
  onExited,
}: ToolboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const startedAt = useRef(0);
  const lastPoint = useRef<StrokePoint | null>(null);
  const sampleTimer = useRef<number | null>(null);
  const wasOpen = useRef(false);
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null);
  const selected = PICTURES.find((picture) => picture.id === pictureId);

  useEffect(() => {
    if (open) setPresent(true);
  }, [open]);

  useEffect(() => {
    if (!present) return;
    if (!open) {
      setShown(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open, present]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      panelRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const panel = panelRef.current;
    const place = () => {
      const gap = 12;
      const margin = 12;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth || 352;
      const height = panel.offsetHeight || 420;
      let left = rect.right + gap;
      let top = rect.top;
      if (left + width > window.innerWidth - margin) {
        left = rect.left - gap - width;
      }
      if (left < margin) {
        left = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - width));
        top = rect.bottom + gap;
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - height));
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
      setPlaced({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, pictureId, present]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (sampleTimer.current !== null) window.clearInterval(sampleTimer.current);
    };
  }, []);

  function clearSampleTimer() {
    if (sampleTimer.current !== null) {
      window.clearInterval(sampleTimer.current);
      sampleTimer.current = null;
    }
  }

  function pointFrom(event: ReactPointerEvent<HTMLDivElement>): StrokePoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
    const y = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      t: performance.now() - startedAt.current,
    };
  }

  function beginDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pictureId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    startedAt.current = performance.now();
    clearSampleTimer();
    const first = { ...pointFrom(event), t: 0 };
    lastPoint.current = first;
    onDrawStart(first);
    sampleTimer.current = window.setInterval(() => {
      const last = lastPoint.current;
      if (!drawing.current || !last) return;
      const next = { x: last.x, y: last.y, t: performance.now() - startedAt.current };
      if (next.t - last.t < 30) return;
      lastPoint.current = next;
      onDrawMove(next);
    }, 40);
  }

  function moveDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing.current) return;
    const point = pointFrom(event);
    const last = lastPoint.current;
    if (
      last &&
      Math.hypot(last.x - point.x, last.y - point.y) < 0.004 &&
      point.t - last.t < 24
    ) {
      return;
    }
    lastPoint.current = point;
    onDrawMove(point);
  }

  function endDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    clearSampleTimer();
    const point = pointFrom(event);
    lastPoint.current = point;
    onDrawMove(point);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const waiting = configured === false || refineView.status === "waiting";
  const refineDisabled = !pictureId || !strokeReady || refineView.status === "loading";

  if (!present) return null;

  const chunks = ["0ms", "80ms", "160ms", "240ms"];

  return (
    <div
      ref={panelRef}
      id="shan-toolbox"
      role="dialog"
      aria-modal="false"
      aria-labelledby="shan-toolbox-title"
      tabIndex={-1}
      data-open={shown ? "true" : "false"}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget || open) return;
        setPresent(false);
        onExited();
      }}
      className="shan-toolbox fixed z-50 max-h-[min(36rem,calc(100dvh-1.5rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] bg-white p-4 text-black shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_40px_rgba(0,0,0,0.12)] outline-none"
      style={{
        top: placed?.top ?? 12,
        left: placed?.left ?? 12,
      }}
    >
      <div className="shan-toolbox-chunk flex items-center justify-between gap-3" style={{ transitionDelay: shown ? chunks[0] : "0ms" }}>
        <h2 id="shan-toolbox-title" className="text-sm font-medium">
          {selected?.label ?? "Toolbox"}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <p
        className="shan-toolbox-chunk mt-2 text-sm leading-5 text-pretty text-black/60"
        style={{ transitionDelay: shown ? chunks[1] : "0ms" }}
      >
        Draw on the pad. The picture stays on the page.
      </p>
      {configured === false ? (
        <p className="mt-1 text-sm leading-5 text-black/60">
          Nothing is sent while the key is missing.
        </p>
      ) : null}

      <div className="shan-toolbox-chunk mt-4" style={{ transitionDelay: shown ? chunks[2] : "0ms" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] tracking-[0.16em] text-black/40 uppercase">Cursor</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={rawPoints.length === 0}
          >
            Clear stroke
          </Button>
        </div>
        <div
          className="relative mt-2 h-32 touch-none rounded-xl bg-black/[0.03]"
          onPointerDown={beginDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          role="application"
          aria-label="Draw the motion"
        >
          {rawPoints.length > 1 ? (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <polyline
                points={polyline(rawPoints)}
                fill="none"
                stroke="black"
                strokeWidth="1.75"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-pretty text-black/45">
              Draw the motion.
            </p>
          )}
        </div>
        {pictureId && rawPoints.length > 1 && !strokeReady ? (
          <p className="mt-2 text-sm text-black/55">Draw a longer stroke.</p>
        ) : null}
        <div className="mt-4">
          <Button type="button" onClick={onRefine} disabled={refineDisabled}>
            {refineView.status === "loading" ? "Refining" : "Refine"}
          </Button>
        </div>
      </div>

      <div
        className="shan-toolbox-chunk mt-4 grid grid-cols-2 gap-3 pt-3"
        style={{ transitionDelay: shown ? chunks[3] : "0ms" }}
      >
        <div>
          <p className="text-[12px] tracking-[0.16em] text-black/40 uppercase">Local cleanup</p>
          <div className="mt-2">
            <StrokePreview rawPoints={rawPoints} cleanedPoints={cleanedPoints} />
          </div>
          <p className="mt-2 text-sm leading-5 text-pretty text-black/60">
            {cleanedPoints.length > 1
              ? "Smoothed polyline of this stroke."
              : "Draw a stroke to see the cleanup."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onPlayCleanup}
            disabled={!pictureId || !strokeReady}
          >
            Play cleanup
          </Button>
        </div>

        <div aria-live="polite">
          <p className="text-[12px] tracking-[0.16em] text-black/40 uppercase">Model reading</p>
          <div className="mt-2 text-sm leading-5">
            {refineView.status === "loading" ? (
              <p>Reading the stroke.</p>
            ) : refineView.status === "reading" ? (
              <div>
                <p className="text-base text-black">{motionLabel(refineView.spec.name)}</p>
                <dl className="mt-2 space-y-2">
                  <div>
                    <dt className="text-black/45">Easing</dt>
                    <dd>{refineView.spec.easing}</dd>
                  </div>
                  <div>
                    <dt className="text-black/45">Duration</dt>
                    <dd className="tabular-nums">
                      {(refineView.spec.durationMs / 1000).toFixed(1)} seconds
                    </dd>
                  </div>
                  <div>
                    <dt className="text-black/45">Gesture</dt>
                    <dd>{recognitionLine(refineView.spec.recognized)}</dd>
                  </div>
                  <div>
                    <dt className="text-black/45">Latency</dt>
                    <dd className="tabular-nums">{refineView.latencyMs} ms</dd>
                  </div>
                </dl>
                {refineView.spec.reading ? (
                  <p className="mt-2 text-pretty text-black/70">{refineView.spec.reading}</p>
                ) : null}
                <p className="mt-2 text-xs break-all text-black/45">{refineView.model}</p>
              </div>
            ) : refineView.status === "error" ? (
              <p>{refineView.message}</p>
            ) : waiting ? (
              <p>The model step is waiting on NEBIUS_API_KEY.</p>
            ) : (
              <p className="text-pretty text-black/60">Refine sends the stroke, not the picture.</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onPlayReading}
            disabled={refineView.status !== "reading" || !pictureId}
          >
            Play reading
          </Button>
        </div>
      </div>
    </div>
  );
}
