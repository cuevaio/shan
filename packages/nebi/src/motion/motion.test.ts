import { describe, expect, test } from "bun:test";
import { parseMotionSpec } from "./motion-spec";
import { cleanupPlan, readingPlan } from "./playback";
import { cleanStroke, sampleForModel, strokeIsUsable, type StrokePoint } from "./stroke";

const stroke: StrokePoint[] = [
  { x: 0.1, y: 0.2, t: 0 },
  { x: 0.4, y: 0.3, t: 180 },
  { x: 0.8, y: 0.4, t: 360 },
];

describe("motion tools", () => {
  test("validates and normalizes model motion specs", () => {
    expect(parseMotionSpec("```json\n{\"name\":\"slide\",\"easing\":\"ease-out\",\"durationMs\":9000,\"recognized\":true,\"reading\":\"A long slide.\"}\n```"))
      .toEqual({
        name: "slide",
        easing: "ease-out",
        durationMs: 6000,
        recognized: true,
        reading: "A long slide.",
      });
    expect(parseMotionSpec({ name: "unknown", easing: "linear", durationMs: 1000 })).toBeNull();
  });

  test("cleans, samples, and checks captured strokes", () => {
    expect(strokeIsUsable(stroke)).toBe(true);
    expect(cleanStroke(stroke)).toHaveLength(3);
    expect(sampleForModel(stroke, 2)).toEqual([stroke[0], stroke[2]]);
  });

  test("builds cleanup and named-motion playback plans", () => {
    const cleanup = cleanupPlan(stroke, true);
    expect(cleanup?.iterations).toBe(1);
    expect(cleanup?.frames).toHaveLength(3);

    const reading = readingPlan({
      name: "slide",
      easing: "ease-out",
      durationMs: 1200,
      recognized: true,
      reading: "A slide.",
    }, stroke, false);
    expect(reading.duration).toBe(1200);
    expect(reading.iterations).toBe(Number.POSITIVE_INFINITY);
  });
});
