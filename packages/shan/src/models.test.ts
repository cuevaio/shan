import { describe, expect, test } from "bun:test";
import { DEFAULT_SHAN_MODEL_ID, SHAN_MODELS } from "./models";

describe("model catalog", () => {
  test("has a valid default and unique Token Factory IDs", () => {
    const ids = SHAN_MODELS.map((model) => model.id);

    expect(ids).toContain(DEFAULT_SHAN_MODEL_ID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.includes("/"))).toBe(true);
  });
});
