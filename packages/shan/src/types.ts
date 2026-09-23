import type { ShanModelOption } from "./models";

export type ProposedFile = {
  path: string;
  status: "created" | "modified" | "deleted";
  additions: number;
  deletions: number;
  patch: string;
};

export type Proposal = {
  id: string;
  summary: string;
  files: ProposedFile[];
  createdAt: string;
};

export type SelectedElementContext = {
  selector: string;
  tagName: string;
  id?: string;
  classNames: string[];
  text: string;
  html: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export type ShanPromptContext = {
  selectedElement?: SelectedElementContext;
  drawing?: { x: number; y: number; t: number }[];
};

export type ShanApiResponse =
  | { status: "previewing"; proposal: Proposal; models?: ShanModelOption[]; defaultModelId?: string }
  | { status: "kept"; files: string[] }
  | { status: "discarded"; files: string[] }
  | { status: "idle"; models?: ShanModelOption[]; defaultModelId?: string }
  | { status: "waiting"; message: string }
  | { status: "reading"; spec: unknown; latencyMs: number; model: string }
  | { status: "error"; error?: string; message?: string };
