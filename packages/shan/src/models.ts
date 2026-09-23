export type ShanModelOption = {
  /** Case-sensitive Nebius Token Factory model ID. */
  id: string;
  label: string;
  description: string;
};

/** Code-capable models with strong multi-step tool use. */
export const SHAN_MODELS = [
  {
    id: "deepseek-ai/DeepSeek-V4.1-Flash",
    label: "DeepSeek V4.1 Flash",
    description: "Recommended — strongest coding performance and a 1M context window.",
  },
  {
    id: "zai-org/GLM-5.3",
    label: "GLM 5.3",
    description: "Best for complex, long-running implementation tasks.",
  },
  {
    id: "moonshotai/Kimi-K2.7-Code",
    label: "Kimi K2.7 Code",
    description: "Coding-specialized model with reliable agentic tool use.",
  },
  {
    id: "MiniMaxAI/MiniMax-M3",
    label: "MiniMax M3",
    description: "Strong full-stack coding with a 1M context window.",
  },
  {
    id: "Qwen/Qwen3.5-397B-A17B",
    label: "Qwen 3.5 397B",
    description: "Balanced reasoning and code generation for everyday changes.",
  },
] as const satisfies readonly ShanModelOption[];

export const DEFAULT_SHAN_MODEL_ID = SHAN_MODELS[0].id;
