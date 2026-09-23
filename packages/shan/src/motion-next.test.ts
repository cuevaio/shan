import { describe, expect, test } from "bun:test";
import { createMotionRouteHandlers } from "./motion-next";

const points = [
  { x: 0.1, y: 0.2, t: 0 },
  { x: 0.8, y: 0.7, t: 300 },
];

describe("motion route handlers", () => {
  test("reports an unconfigured model without making a request", async () => {
    const handlers = createMotionRouteHandlers({ apiKey: "" });
    expect(await handlers.GET().json()).toEqual({ configured: false });

    const response = await handlers.POST(new Request("http://localhost/api/refine", {
      method: "POST",
      body: JSON.stringify({ points }),
    }));
    expect(await response.json()).toMatchObject({ status: "waiting" });
  });

  test("returns the parsed model reading", async () => {
    const handlers = createMotionRouteHandlers({
      apiKey: "test-key",
      modelId: "test-model",
      fetch: async () => Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              name: "slide",
              easing: "linear",
              durationMs: 1200,
              recognized: true,
              reading: "A one-way stroke.",
            }),
          },
        }],
      }),
    });

    const response = await handlers.POST(new Request("http://localhost/api/refine", {
      method: "POST",
      body: JSON.stringify({ points }),
    }));
    expect(await response.json()).toMatchObject({
      status: "reading",
      model: "test-model",
      spec: { name: "slide", durationMs: 1200 },
    });
  });

  test("rejects malformed stroke data", async () => {
    const handlers = createMotionRouteHandlers({ apiKey: "test-key" });
    const response = await handlers.POST(new Request("http://localhost/api/refine", {
      method: "POST",
      body: JSON.stringify({ points: [{ x: "bad" }] }),
    }));
    expect(response.status).toBe(400);
  });
});
