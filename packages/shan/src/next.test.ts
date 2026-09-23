import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SHAN_MODEL_ID, SHAN_MODELS } from "./models";
import { createShanRouteHandler } from "./next";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeHandler(options: Parameters<typeof createShanRouteHandler>[0] = {}) {
  const root = await mkdtemp(join(tmpdir(), "shan-route-test-"));
  roots.push(root);
  return createShanRouteHandler({ root, enabled: true, ...options });
}

function request(body: unknown) {
  return new Request("http://localhost/api/shan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Shan route model selection", () => {
  test("returns the curated catalog and default model", async () => {
    const handler = await makeHandler();
    const response = await handler(request({ action: "status" }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("idle");
    expect(body.defaultModelId).toBe(DEFAULT_SHAN_MODEL_ID);
    expect(body.models).toEqual(SHAN_MODELS);
  });

  test("rejects model IDs that the route did not expose", async () => {
    const handler = await makeHandler();
    const response = await handler(request({
      action: "prompt",
      prompt: "Change the page",
      modelId: "unknown/model",
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toEqual({ status: "error", error: "The selected model is not available." });
  });

  test("supports restricting the selector to configured models", async () => {
    const models = [SHAN_MODELS[2]];
    const handler = await makeHandler({ models, modelId: models[0].id });
    const response = await handler(request({ action: "status" }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.models).toEqual(models);
    expect(body.defaultModelId).toBe(models[0].id);
  });

  test("rejects unavailable models for motion readings too", async () => {
    const handler = await makeHandler();
    const response = await handler(request({
      action: "motion",
      points: [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 100 }],
      modelId: "unknown/model",
    }));

    expect(response.status).toBe(400);
  });
});
