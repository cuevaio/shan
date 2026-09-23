import {
  DEFAULT_NEBIUS_MODEL,
  messageText,
  NEBIUS_BASE_URL,
  parseMotionSpec,
} from "@/lib/motion-spec";
import type { StrokePoint } from "@/lib/stroke";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You name the motion a cursor stroke is asking for. You receive path coordinates only. You never receive an image.

Read the intent. Do not redraw the stroke.
- A closed loop, even when the points wobble, is an orbit.
- A pause, where time passes while the point barely moves, is a hold.
- A stroke that reverses along one axis is a sway.
- A mostly upward stroke is a rise.
- A stroke that stays in one place is a pulse.
- A one-way travel is a slide.

Return one JSON object and nothing else:
{"recognized":true,"name":"orbit","easing":"ease-in-out","durationMs":2400,"reading":"A closed loop. Read as an orbit."}

name is one of: orbit, hold, slide, sway, rise, pulse.
easing is one of: linear, ease-in, ease-out, ease-in-out.
durationMs is an integer from 600 to 4000.
recognized is false only when the stroke is too short or has no readable intent.
reading is one short sentence about the gesture.
Do not return points, paths, or code fences.`;

const WAITING_MESSAGE = "The model step is waiting on NEBIUS_API_KEY.";

type ChatResponse = {
  choices?: { message?: { content?: unknown } }[];
  error?: { message?: string };
};

function readPoints(body: unknown): StrokePoint[] | null {
  if (!body || typeof body !== "object" || !("points" in body)) return null;
  const points = (body as { points?: unknown }).points;
  if (!Array.isArray(points) || points.length < 2 || points.length > 80) return null;

  const parsed: StrokePoint[] = [];
  for (const point of points) {
    if (!point || typeof point !== "object") return null;
    const record = point as Record<string, unknown>;
    const { x, y, t } = record;
    if (typeof x !== "number" || typeof y !== "number" || typeof t !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return null;
    parsed.push({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      t: Math.max(0, t),
    });
  }

  return parsed;
}

async function complete(model: string, points: StrokePoint[], jsonMode: boolean) {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new Error("Missing NEBIUS_API_KEY");

  return fetch(`${NEBIUS_BASE_URL}chat/completions`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 220,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Stroke points. x and y are 0 to 1. t is milliseconds from the first point.\n${JSON.stringify(points)}`,
        },
      ],
    }),
  });
}

export function GET() {
  return Response.json({
    configured: Boolean(process.env.NEBIUS_API_KEY),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: "error", message: "The stroke needs coordinates." },
      { status: 400 },
    );
  }

  const points = readPoints(body);
  if (!points) {
    return Response.json(
      { status: "error", message: "The stroke needs coordinates." },
      { status: 400 },
    );
  }

  if (!process.env.NEBIUS_API_KEY) {
    return Response.json({ status: "waiting", message: WAITING_MESSAGE });
  }

  const model = process.env.NEBIUS_MODEL?.trim() || DEFAULT_NEBIUS_MODEL;
  const started = performance.now();

  try {
    let response = await complete(model, points, true);
    if (response.status === 400) response = await complete(model, points, false);
    const latencyMs = Math.round(performance.now() - started);

    if (!response.ok) {
      return Response.json({
        status: "error",
        message: `Token Factory returned ${response.status}. The cleaned stroke can still play.`,
        latencyMs,
      });
    }

    const payload = (await response.json()) as ChatResponse;
    const spec = parseMotionSpec(messageText(payload.choices?.[0]?.message?.content));
    if (!spec) {
      return Response.json({
        status: "error",
        message: "The model did not return a motion. The cleaned stroke can still play.",
        latencyMs,
      });
    }

    return Response.json({ status: "reading", spec, latencyMs, model });
  } catch {
    return Response.json({
      status: "error",
      message: "The model step did not answer. The cleaned stroke can still play.",
      latencyMs: Math.round(performance.now() - started),
    });
  }
}
