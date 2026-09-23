"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
} from "react";
import { cleanStroke, strokeIsUsable, type StrokePoint } from "./stroke";

export type UseStrokeCaptureOptions = {
  enabled?: boolean;
  minDistance?: number;
  sampleIntervalMs?: number;
  shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
  onStart?: () => void;
  onEnd?: (points: StrokePoint[]) => void;
};

export type StrokeCaptureBindings = {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
};

/** Captures a pointer stroke as normalized x/y coordinates and elapsed milliseconds. */
export function useStrokeCapture(options: UseStrokeCaptureOptions = {}) {
  const [points, setPoints] = useState<StrokePoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const pointsRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef(false);
  const startedAt = useRef(0);
  const lastPoint = useRef<StrokePoint | null>(null);
  const sampleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const remember = useCallback((next: StrokePoint[]) => {
    pointsRef.current = next;
    setPoints(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (sampleTimer.current !== null) {
      clearInterval(sampleTimer.current);
      sampleTimer.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    drawingRef.current = false;
    lastPoint.current = null;
    setDrawing(false);
    remember([]);
  }, [clearTimer, remember]);

  const append = useCallback((point: StrokePoint) => {
    const current = pointsRef.current;
    const last = current[current.length - 1];
    const minDistance = optionsRef.current.minDistance ?? 0.004;
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < minDistance && point.t - last.t < 24) {
      return;
    }
    remember([...current, point]);
  }, [remember]);

  const pointFromEvent = useCallback((element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      t: performance.now() - startedAt.current,
    } satisfies StrokePoint;
  }, []);

  const onPointerDown: PointerEventHandler<HTMLElement> = useCallback((event) => {
    const current = optionsRef.current;
    if (current.enabled === false || current.shouldIgnoreTarget?.(event.target) || event.button !== 0) return;
    const firstPoint = pointFromEvent(event.currentTarget, event.clientX, event.clientY);
    if (!firstPoint) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setDrawing(true);
    startedAt.current = performance.now();
    clearTimer();
    const first = { ...firstPoint, t: 0 };
    lastPoint.current = first;
    current.onStart?.();
    remember([first]);

    sampleTimer.current = setInterval(() => {
      const last = lastPoint.current;
      if (!drawingRef.current || !last) return;
      const next = { x: last.x, y: last.y, t: performance.now() - startedAt.current };
      if (next.t - last.t < 30) return;
      lastPoint.current = next;
      append(next);
    }, current.sampleIntervalMs ?? 40);
  }, [append, clearTimer, pointFromEvent, remember]);

  const onPointerMove: PointerEventHandler<HTMLElement> = useCallback((event) => {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    lastPoint.current = point;
    append(point);
  }, [append, pointFromEvent]);

  const end: PointerEventHandler<HTMLElement> = useCallback((event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setDrawing(false);
    clearTimer();
    const point = pointFromEvent(event.currentTarget, event.clientX, event.clientY);
    if (point) {
      lastPoint.current = point;
      append(point);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    queueMicrotask(() => optionsRef.current.onEnd?.(pointsRef.current.slice()));
  }, [append, clearTimer, pointFromEvent]);

  useEffect(() => clearTimer, [clearTimer]);

  const bindings = useMemo<StrokeCaptureBindings>(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
  }), [end, onPointerDown, onPointerMove]);

  return {
    points,
    cleanedPoints: useMemo(() => cleanStroke(points), [points]),
    ready: strokeIsUsable(points),
    drawing,
    bindings,
    clear,
    getPoints: useCallback(() => pointsRef.current.slice(), []),
  };
}
