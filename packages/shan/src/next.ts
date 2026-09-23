import type { LanguageModel } from "ai";
import { createMotionRouteHandlers } from "./motion-next";
import { runCodingAgent } from "./server/agent";
import { normalizePromptContext } from "./server/context";
import { discardProposal, getActiveProposal, keepProposal } from "./server/proposals";
import { WorkspaceDraft } from "./server/workspace";

export type ShanRouteOptions = {
  /** Project directory the agent may inspect. Defaults to process.cwd(). */
  root?: string;
  /** Disabled by default when NODE_ENV is production. */
  enabled?: boolean;
  apiKey?: string;
  model?: LanguageModel;
  modelId?: string;
  instructions?: string;
  maxSteps?: number;
  /** Additional accepted request origins, for proxied local development. */
  allowedOrigins?: string[];
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function sameOrigin(request: Request, allowed: string[]) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export function createShanRouteHandler(options: ShanRouteOptions = {}) {
  const enabled = options.enabled ?? process.env.NODE_ENV !== "production";
  const rootPromise = WorkspaceDraft.create(options.root ?? process.cwd()).then((workspace) => workspace.root);
  const motionHandlers = createMotionRouteHandlers({
    apiKey: options.apiKey,
    modelId: options.modelId,
  });

  return async function POST(request: Request): Promise<Response> {
    if (!enabled) return json({ status: "error", error: "Not found." }, 404);
    if (!sameOrigin(request, options.allowedOrigins ?? [])) {
      return json({ status: "error", error: "Cross-origin requests are not allowed." }, 403);
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return json({ status: "error", error: "Request is too large." }, 413);

    try {
      const body = await request.json() as Record<string, unknown>;
      const root = await rootPromise;
      if (body.action === "status") {
        const proposal = await getActiveProposal(root);
        return proposal ? json({ status: "previewing", proposal }) : json({ status: "idle" });
      }
      if (body.action === "prompt") {
        if (typeof body.prompt !== "string" || !body.prompt.trim()) {
          return json({ status: "error", error: "A prompt is required." }, 400);
        }
        if (body.prompt.length > 10_000) {
          return json({ status: "error", error: "The prompt cannot exceed 10,000 characters." }, 400);
        }
        const proposal = await runCodingAgent({
          root,
          prompt: body.prompt.trim(),
          context: normalizePromptContext(body.context),
          apiKey: options.apiKey,
          model: options.model,
          modelId: options.modelId,
          instructions: options.instructions,
          maxSteps: options.maxSteps,
        });
        return json({ status: "previewing", proposal });
      }

      if (body.action === "motion") {
        return motionHandlers.POST(new Request(request.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ points: body.points }),
        }));
      }

      if (body.action === "keep" || body.action === "discard") {
        if (typeof body.proposalId !== "string" || !body.proposalId) {
          return json({ status: "error", error: "A proposal ID is required." }, 400);
        }
        if (body.action === "keep") {
          const files = await keepProposal(body.proposalId, root);
          return json({ status: "kept", files });
        }
        const files = await discardProposal(body.proposalId, root);
        return json({ status: "discarded", files });
      }

      return json({ status: "error", error: "Unknown action." }, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shan request failed.";
      return json({ status: "error", error: message }, 500);
    }
  };
}
