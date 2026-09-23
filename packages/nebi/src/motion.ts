export {
  DEFAULT_NEBIUS_MODEL,
  EASING_NAMES,
  MOTION_NAMES,
  motionLabel,
  parseMotionSpec,
  playingLine,
} from "./motion/motion-spec";
export type { EasingName, MotionName, MotionSpec } from "./motion/motion-spec";
export { cleanupPlan, playMotion, readingPlan, stopMotion } from "./motion/playback";
export type { PlaybackPlan } from "./motion/playback";
export {
  cleanStroke,
  sampleForModel,
  strokeIsUsable,
  strokeSpan,
  strokeVector,
} from "./motion/stroke";
export type { StrokePoint } from "./motion/stroke";
export { useStrokeCapture } from "./motion/use-stroke-capture";
export type {
  StrokeCaptureBindings,
  UseStrokeCaptureOptions,
} from "./motion/use-stroke-capture";
