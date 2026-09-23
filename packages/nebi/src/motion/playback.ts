import type { EasingName, MotionSpec } from "./motion-spec";
import { strokeSpan, strokeVector, type StrokePoint } from "./stroke";

const TRAVEL = 180;

const EASING_CSS: Record<EasingName, string> = {
  linear: "linear",
  "ease-in": "cubic-bezier(0.55, 0, 1, 0.45)",
  "ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
  "ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
};

export type PlaybackPlan = {
  frames: Keyframe[];
  duration: number;
  easing: string;
  iterations: number;
  fill: FillMode;
};

export function stopMotion(element: Element | null) {
  if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return;
  for (const animation of element.getAnimations()) animation.cancel();
  element.style.transform = "";
}

export function playMotion(element: Element | null, plan: PlaybackPlan | null) {
  if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement) || !plan) return null;
  stopMotion(element);
  return element.animate(plan.frames, {
    duration: plan.duration,
    easing: plan.easing,
    iterations: plan.iterations,
    fill: plan.fill,
  });
}

function monotonic(frames: Keyframe[]) {
  if (frames.length === 0) return frames;
  let previous = -0.0001;

  return frames.map((frame, index) => {
    const raw = typeof frame.offset === "number" ? frame.offset : index / Math.max(1, frames.length - 1);
    const offset = index === frames.length - 1 ? 1 : Math.min(0.999, Math.max(previous + 0.0001, raw));
    previous = offset;
    return { ...frame, offset };
  });
}

export function cleanupPlan(points: StrokePoint[], reducedMotion: boolean): PlaybackPlan | null {
  if (points.length < 2) return null;
  const origin = points[0];
  const elapsed = Math.max(1, points[points.length - 1].t - origin.t);
  const frames = monotonic(
    points.map((point) => ({
      transform: `translate(${(point.x - origin.x) * TRAVEL}px, ${(point.y - origin.y) * TRAVEL}px)`,
      offset: (point.t - origin.t) / elapsed,
    })),
  );

  return {
    frames,
    duration: Math.min(4000, Math.max(900, elapsed)),
    easing: "linear",
    iterations: reducedMotion ? 1 : Number.POSITIVE_INFINITY,
    fill: "none",
  };
}

function shift(x: number, y: number) {
  return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function circleFrames(radius: number) {
  const steps = 24;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2 - Math.PI / 2;
    return {
      transform: shift(Math.cos(angle) * radius, Math.sin(angle) * radius),
      offset: index / steps,
    };
  });
}

export function readingPlan(
  spec: MotionSpec,
  points: StrokePoint[],
  reducedMotion: boolean,
): PlaybackPlan {
  const span = strokeSpan(points);
  const vector = strokeVector(points);
  const distance = Math.hypot(vector.dx, vector.dy);
  const travelX = distance < 0.04 ? 72 : (vector.dx / distance) * Math.max(56, distance * TRAVEL);
  const travelY = distance < 0.04 ? 0 : (vector.dy / distance) * Math.max(56, distance * TRAVEL);
  const radius = Math.max(26, Math.max(span.width, span.height) * 90);
  let frames: Keyframe[];
  let iterations = reducedMotion ? 1 : Number.POSITIVE_INFINITY;
  let fill: FillMode = "none";

  switch (spec.name) {
    case "orbit":
      frames = circleFrames(Math.min(radius, 72));
      break;
    case "hold":
      frames = [
        { transform: shift(0, 0), offset: 0 },
        { transform: shift(travelX * 0.35, travelY * 0.35), offset: 0.2 },
        { transform: shift(travelX * 0.35, travelY * 0.35), offset: 1 },
      ];
      iterations = 1;
      fill = "forwards";
      break;
    case "sway": {
      const horizontal = Math.abs(vector.dx) >= Math.abs(vector.dy);
      const amount = Math.max(36, (horizontal ? span.width : span.height) * TRAVEL);
      frames = [
        { transform: shift(0, 0), offset: 0 },
        { transform: horizontal ? shift(amount, 0) : shift(0, amount), offset: 0.5 },
        { transform: shift(0, 0), offset: 1 },
      ];
      break;
    }
    case "rise":
      frames = [
        { transform: shift(0, 0), offset: 0 },
        { transform: shift(0, -Math.max(48, span.height * TRAVEL)), offset: 1 },
      ];
      break;
    case "pulse":
      frames = [
        { transform: "scale(1)", offset: 0 },
        { transform: "scale(1.08)", offset: 0.5 },
        { transform: "scale(1)", offset: 1 },
      ];
      break;
    case "slide":
      frames = [
        { transform: shift(0, 0), offset: 0 },
        { transform: shift(travelX, travelY), offset: 1 },
      ];
      break;
  }

  return {
    frames: monotonic(frames),
    duration: spec.durationMs,
    easing: EASING_CSS[spec.easing],
    iterations,
    fill,
  };
}
