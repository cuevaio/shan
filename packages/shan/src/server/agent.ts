import { createOpenAI } from "@ai-sdk/openai";
import { generateText, isStepCount, type LanguageModel } from "ai";
import { applyForPreview, assertNoActivePreview } from "./proposals";
import { createAgentTools } from "./tools";
import { WorkspaceDraft } from "./workspace";
import { promptWithContext } from "./context";
import type { ShanPromptContext } from "../types";

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash";

export type AgentOptions = {
  root: string;
  prompt: string;
  context?: ShanPromptContext;
  apiKey?: string;
  model?: LanguageModel;
  modelId?: string;
  instructions?: string;
  maxSteps?: number;
};

export async function runCodingAgent(options: AgentOptions) {
  const workspace = await WorkspaceDraft.create(options.root);
  await assertNoActivePreview(workspace.root);
  const apiKey = options.apiKey ?? process.env.NEBIUS_API_KEY;
  if (!options.model && !apiKey) {
    throw new Error("Set NEBIUS_API_KEY in your Next.js server environment.");
  }
  const model = options.model ?? createOpenAI({
    baseURL: "https://api.tokenfactory.nebius.com/v1/",
    apiKey,
  }).chat(options.modelId ?? DEFAULT_MODEL);

  const result = await generateText({
    model,
    system: `You are a careful coding agent working in a Next.js project.
Inspect the relevant files before editing. Make a focused, complete implementation of the user's request.
The write, edit, and remove tools build a draft. After you finish, the draft is automatically applied so the user can try it in their running app, then keep or discard it.
Never try to access secrets, generated output, dependencies, or paths outside the project. Do not add secrets to code.
You cannot run commands, so do not claim that tests or builds passed. End with a concise summary of what your draft changes.
${options.instructions ?? ""}`,
    prompt: promptWithContext(options.prompt, options.context),
    tools: createAgentTools(workspace),
    stopWhen: isStepCount(Math.min(Math.max(options.maxSteps ?? 24, 1), 40)),
  });

  return applyForPreview(workspace.root, result.text, workspace.getChanges());
}
