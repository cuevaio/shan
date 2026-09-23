import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Result } from "effect";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyChanges, applyChangesEffect, WorkspaceDraft } from "./workspace";

const roots: string[] = [];

async function project() {
  const root = await mkdtemp(join(tmpdir(), "shan-test-"));
  roots.push(root);
  await writeFile(join(root, "page.tsx"), "export default function Page() { return <p>Before</p> }\n");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkspaceDraft", () => {
  test("keeps edits off disk until they are applied", async () => {
    const root = await project();
    const draft = await WorkspaceDraft.create(root);
    await draft.edit("page.tsx", "Before", "After");

    expect(await readFile(join(root, "page.tsx"), "utf8")).toContain("Before");
    await applyChanges(root, draft.getChanges());
    expect(await readFile(join(root, "page.tsx"), "utf8")).toContain("After");
  });

  test("refuses traversal and secret files", async () => {
    const root = await project();
    const draft = await WorkspaceDraft.create(root);

    expect(draft.read("../outside.txt")).rejects.toThrow("outside");
    expect(draft.write(".env.local", "SECRET=x")).rejects.toThrow("not accessible");
    expect(draft.glob("../**/*")).rejects.toThrow("inside the workspace");
  });

  test("refuses to apply a stale proposal", async () => {
    const root = await project();
    const draft = await WorkspaceDraft.create(root);
    await draft.edit("page.tsx", "Before", "After");
    await writeFile(join(root, "page.tsx"), "someone else changed this\n");

    expect(applyChanges(root, draft.getChanges())).rejects.toThrow("changed after");
    expect(await readFile(join(root, "page.tsx"), "utf8")).toBe("someone else changed this\n");
  });

  test("exposes typed failures to Effect callers", async () => {
    const root = await project();
    const draft = await WorkspaceDraft.create(root);
    await draft.edit("page.tsx", "Before", "After");
    await writeFile(join(root, "page.tsx"), "someone else changed this\n");

    const result = await Effect.runPromise(Effect.result(applyChangesEffect(root, draft.getChanges())));

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("WorkspaceError");
      expect(result.failure.message).toContain("changed after");
    }
  });

  test("rolls back files already applied when a later write fails", async () => {
    const root = await project();
    const readOnly = join(root, "read-only");
    await mkdir(readOnly);
    await writeFile(join(readOnly, "second.ts"), "second before\n");
    const draft = await WorkspaceDraft.create(root);
    await draft.write("page.tsx", "first after\n");
    await draft.write("read-only/second.ts", "second after\n");
    const changes = draft.getChanges();

    await chmod(readOnly, 0o500);
    await expect(applyChanges(root, changes)).rejects.toThrow();
    await chmod(readOnly, 0o700);
    expect(await readFile(join(root, "page.tsx"), "utf8")).toContain("Before");
    expect(await readFile(join(readOnly, "second.ts"), "utf8")).toBe("second before\n");
  });
});
