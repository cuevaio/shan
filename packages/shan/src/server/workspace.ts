import { Effect, Schema } from "effect";
import fg from "fast-glob";
import { lstat, mkdir, readFile, realpath, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_FILE_BYTES = 1_000_000;
const MAX_PROPOSAL_BYTES = 4_000_000;
const MAX_PROPOSAL_FILES = 50;
const IGNORED_SEGMENTS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules"]);

export type DraftChange = {
  path: string;
  before: string | null;
  after: string | null;
};

export class WorkspaceError extends Schema.TaggedError<WorkspaceError>()("WorkspaceError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

function workspaceError(cause: unknown, fallback: string) {
  if (cause instanceof WorkspaceError) return cause;
  return new WorkspaceError({
    message: cause instanceof Error ? cause.message : fallback,
    cause,
  });
}

function attempt<A>(operation: () => Promise<A>, fallback: string) {
  return Effect.tryPromise({
    try: operation,
    catch: (cause) => workspaceError(cause, fallback),
  });
}

function isIgnored(path: string) {
  return path.split("/").some((segment) =>
    IGNORED_SEGMENTS.has(segment) || segment.startsWith(".env") || segment === ".npmrc" || segment === ".yarnrc",
  );
}

export class WorkspaceDraft {
  readonly root: string;
  private readonly changes = new Map<string, DraftChange>();

  private constructor(root: string) {
    this.root = root;
  }

  static async create(root: string) {
    return new WorkspaceDraft(await realpath(resolve(root)));
  }

  private normalize(path: string) {
    if (!path || isAbsolute(path)) throw new Error("Use a workspace-relative path.");
    const absolute = resolve(this.root, path);
    const local = relative(this.root, absolute);
    if (!local || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) {
      throw new Error(`Path is outside the workspace: ${path}`);
    }
    const normalized = local.split(sep).join("/");
    if (isIgnored(normalized)) throw new Error(`Path is not accessible: ${normalized}`);
    return { absolute, local: normalized };
  }

  private async assertNoSymlinks(absolute: string, allowMissing: boolean) {
    const local = relative(this.root, absolute);
    const parts = local.split(sep);
    let current = this.root;
    for (const part of parts) {
      current = resolve(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink()) {
          throw new Error(`Symbolic links are not accessible: ${relative(this.root, current)}`);
        }
      } catch (error) {
        if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }
  }

  private async readDisk(path: string, allowMissing = false): Promise<string | null> {
    const { absolute } = this.normalize(path);
    await this.assertNoSymlinks(absolute, allowMissing);
    try {
      const content = await readFile(absolute);
      if (content.byteLength > MAX_FILE_BYTES) throw new Error(`${path} exceeds ${MAX_FILE_BYTES} bytes.`);
      if (content.includes(0)) throw new Error(`${path} appears to be binary.`);
      return content.toString("utf8");
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async read(path: string) {
    const { local } = this.normalize(path);
    const pending = this.changes.get(local);
    if (pending) {
      if (pending.after === null) throw new Error(`${local} is marked for deletion.`);
      return pending.after;
    }
    const content = await this.readDisk(local);
    if (content === null) throw new Error(`${local} does not exist.`);
    return content;
  }

  async write(path: string, content: string) {
    const { local, absolute } = this.normalize(path);
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error(`Content exceeds ${MAX_FILE_BYTES} bytes.`);
    await this.assertNoSymlinks(absolute, true);
    const existing = this.changes.get(local);
    const before = existing ? existing.before : await this.readDisk(local, true);
    this.changes.set(local, { path: local, before, after: content });
    this.assertDraftLimits();
    return { path: local, bytes: Buffer.byteLength(content) };
  }

  async edit(path: string, oldText: string, newText: string, replaceAll = false) {
    if (!oldText) throw new Error("oldText cannot be empty.");
    const content = await this.read(path);
    const occurrences = content.split(oldText).length - 1;
    if (occurrences === 0) throw new Error("oldText was not found.");
    if (!replaceAll && occurrences !== 1) {
      throw new Error(`oldText occurs ${occurrences} times; provide more context or use replaceAll.`);
    }
    const updated = replaceAll ? content.replaceAll(oldText, newText) : content.replace(oldText, newText);
    await this.write(path, updated);
    return { path: this.normalize(path).local, replacements: replaceAll ? occurrences : 1 };
  }

  async remove(path: string) {
    const { local } = this.normalize(path);
    const existing = this.changes.get(local);
    if (existing?.before === null) {
      this.changes.delete(local);
      return { path: local };
    }
    const before = existing ? existing.before : await this.readDisk(local);
    if (before === null) throw new Error(`${local} does not exist.`);
    this.changes.set(local, { path: local, before, after: null });
    return { path: local };
  }

  async glob(pattern: string, limit = 200) {
    const normalizedPattern = pattern.replaceAll("\\", "/");
    if (isAbsolute(pattern) || normalizedPattern.split("/").includes("..")) {
      throw new Error("Glob patterns must stay inside the workspace.");
    }
    const matches = await fg(pattern, {
      cwd: this.root,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      ignore: ["**/.git/**", "**/.next/**", "**/.turbo/**", "**/coverage/**", "**/dist/**", "**/node_modules/**", "**/.env*", "**/.npmrc", "**/.yarnrc"],
    });
    return matches.sort().slice(0, limit);
  }

  getChanges() {
    return [...this.changes.values()].filter((change) => change.before !== change.after);
  }

  async currentDiskContent(path: string) {
    return this.readDisk(path, true);
  }

  private assertDraftLimits() {
    const changes = this.getChanges();
    if (changes.length > MAX_PROPOSAL_FILES) throw new Error(`A proposal cannot change more than ${MAX_PROPOSAL_FILES} files.`);
    const bytes = changes.reduce((total, change) => total + Buffer.byteLength(change.after ?? ""), 0);
    if (bytes > MAX_PROPOSAL_BYTES) throw new Error(`A proposal cannot exceed ${MAX_PROPOSAL_BYTES} bytes.`);
  }
}

async function writeAtomically(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.shan-${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function applyChange(root: string, change: DraftChange) {
  const absolute = resolve(root, change.path);
  return attempt(
    () => change.after === null ? unlink(absolute) : writeAtomically(absolute, change.after),
    `Could not apply ${change.path}.`,
  );
}

function restoreChange(root: string, change: DraftChange) {
  const absolute = resolve(root, change.path);
  return attempt(
    () => change.before === null ? rm(absolute, { force: true }) : writeAtomically(absolute, change.before),
    `Could not roll back ${change.path}.`,
  );
}

export const applyChangesEffect = Effect.fn("applyChangesEffect")(
  function*(root: string, changes: DraftChange[]) {
    const workspace = yield* attempt(() => WorkspaceDraft.create(root), "Could not open the workspace.");

    yield* Effect.forEach(changes, (change) =>
      Effect.gen(function*() {
        const current = yield* attempt(
          () => workspace.currentDiskContent(change.path),
          `Could not read ${change.path}.`,
        );
        if (current !== change.before) {
          return yield* new WorkspaceError({
            message: `${change.path} changed after this proposal was created. Ask the agent for a new proposal.`,
          });
        }
      }),
    );

    const applied: DraftChange[] = [];
    yield* Effect.forEach(changes, (change) =>
      applyChange(workspace.root, change).pipe(
        Effect.tap(() => Effect.sync(() => applied.push(change))),
      ),
    ).pipe(
      Effect.catch((applyError) =>
        Effect.forEach([...applied].reverse(), (change) => restoreChange(workspace.root, change)).pipe(
          Effect.catch((rollbackError) => Effect.fail(new WorkspaceError({
            message: `${applyError.message} Rollback also failed: ${rollbackError.message}`,
            cause: new AggregateError([applyError, rollbackError]),
          }))),
          Effect.andThen(Effect.fail(applyError)),
        ),
      ),
    );

    return changes.map((change) => change.path);
  },
);

export function applyChanges(root: string, changes: DraftChange[]) {
  return Effect.runPromise(applyChangesEffect(root, changes));
}
