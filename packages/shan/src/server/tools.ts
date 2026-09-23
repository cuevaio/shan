import { jsonSchema, tool, type ToolSet } from "ai";
import { WorkspaceDraft } from "./workspace";

const truncate = (value: string, limit = 80_000) =>
  value.length <= limit ? value : `${value.slice(0, limit)}\n… truncated`;

export function createAgentTools(workspace: WorkspaceDraft): ToolSet {
  return {
    read: tool({
      description: "Read a UTF-8 project file. The response includes line numbers.",
      inputSchema: jsonSchema<{ path: string; offset?: number; limit?: number }>({
        type: "object",
        properties: {
          path: { type: "string" },
          offset: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 2000 },
        },
        required: ["path"],
        additionalProperties: false,
      }),
      execute: async ({ path, offset = 1, limit = 500 }) => {
        const content = await workspace.read(path);
        const lines = content.split("\n");
        return {
          path,
          totalLines: lines.length,
          content: truncate(lines.slice(offset - 1, offset - 1 + limit).map((line, index) => `${offset + index}: ${line}`).join("\n")),
        };
      },
    }),
    glob: tool({
      description: "List project files matching a glob such as **/*.tsx.",
      inputSchema: jsonSchema<{ pattern: string; limit?: number }>({
        type: "object",
        properties: {
          pattern: { type: "string", minLength: 1 },
          limit: { type: "integer", minimum: 1, maximum: 500 },
        },
        required: ["pattern"],
        additionalProperties: false,
      }),
      execute: async ({ pattern, limit = 200 }) => ({ matches: await workspace.glob(pattern, limit) }),
    }),
    grep: tool({
      description: "Search text files for a JavaScript regular expression.",
      inputSchema: jsonSchema<{ pattern: string; glob?: string; limit?: number }>({
        type: "object",
        properties: {
          pattern: { type: "string", minLength: 1 },
          glob: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["pattern"],
        additionalProperties: false,
      }),
      execute: async ({ pattern, glob = "**/*", limit = 100 }) => {
        const expression = new RegExp(pattern);
        const matches: Array<{ path: string; line: number; text: string }> = [];
        for (const path of await workspace.glob(glob, 500)) {
          let content: string;
          try { content = await workspace.read(path); } catch { continue; }
          for (const [index, line] of content.split("\n").entries()) {
            expression.lastIndex = 0;
            if (expression.test(line)) matches.push({ path, line: index + 1, text: line.slice(0, 500) });
            if (matches.length >= limit) return { matches, truncated: true };
          }
        }
        return { matches, truncated: false };
      },
    }),
    write: tool({
      description: "Propose creating or replacing a UTF-8 project file. This only updates the draft; it does not touch disk.",
      inputSchema: jsonSchema<{ path: string; content: string }>({
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
        additionalProperties: false,
      }),
      execute: ({ path, content }) => workspace.write(path, content),
    }),
    edit: tool({
      description: "Propose replacing exact text in a project file. This only updates the draft; it does not touch disk.",
      inputSchema: jsonSchema<{ path: string; oldText: string; newText: string; replaceAll?: boolean }>({
        type: "object",
        properties: {
          path: { type: "string" }, oldText: { type: "string", minLength: 1 }, newText: { type: "string" }, replaceAll: { type: "boolean" },
        },
        required: ["path", "oldText", "newText"],
        additionalProperties: false,
      }),
      execute: ({ path, oldText, newText, replaceAll }) => workspace.edit(path, oldText, newText, replaceAll),
    }),
    remove: tool({
      description: "Propose deleting a project file. This only updates the draft; it does not touch disk.",
      inputSchema: jsonSchema<{ path: string }>({
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      }),
      execute: ({ path }) => workspace.remove(path),
    }),
  };
}
