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

export type NebiApiResponse =
  | { status: "previewing"; proposal: Proposal }
  | { status: "kept"; files: string[] }
  | { status: "discarded"; files: string[] }
  | { status: "idle" }
  | { status: "error"; error: string };
