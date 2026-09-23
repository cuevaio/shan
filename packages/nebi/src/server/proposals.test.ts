import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Either } from "effect";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyForPreview,
  discardProposal,
  getActiveProposal,
  keepProposal,
  keepProposalEffect,
} from "./proposals";
import { WorkspaceDraft } from "./workspace";

const roots: string[] = [];

async function changedProject() {
  const root = await mkdtemp(join(tmpdir(), "nebi-preview-test-"));
  roots.push(root);
  await writeFile(join(root, "page.tsx"), "before\n");
  const draft = await WorkspaceDraft.create(root);
  await draft.write("page.tsx", "after\n");
  return { root: draft.root, changes: draft.getChanges() };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("live previews", () => {
  test("applies immediately and can discard back to the original", async () => {
    const { root, changes } = await changedProject();
    const proposal = await applyForPreview(root, "Update the page", changes);

    expect(await readFile(join(root, "page.tsx"), "utf8")).toBe("after\n");
    expect((await getActiveProposal(root))?.id).toBe(proposal.id);

    await discardProposal(proposal.id, root);
    expect(await readFile(join(root, "page.tsx"), "utf8")).toBe("before\n");
    expect(await getActiveProposal(root)).toBeUndefined();
  });

  test("keeps the previewed files when approved", async () => {
    const { root, changes } = await changedProject();
    const proposal = await applyForPreview(root, "Update the page", changes);

    await keepProposal(proposal.id, root);
    expect(await readFile(join(root, "page.tsx"), "utf8")).toBe("after\n");
    expect(await getActiveProposal(root)).toBeUndefined();
  });

  test("does not discard over an unrelated edit", async () => {
    const { root, changes } = await changedProject();
    const proposal = await applyForPreview(root, "Update the page", changes);
    await writeFile(join(root, "page.tsx"), "edited during preview\n");

    expect(discardProposal(proposal.id, root)).rejects.toThrow("changed after");
    expect(await readFile(join(root, "page.tsx"), "utf8")).toBe("edited during preview\n");
    await keepProposal(proposal.id, root);
  });

  test("releases the preview reservation when applying fails", async () => {
    const { root, changes } = await changedProject();
    await writeFile(join(root, "page.tsx"), "stale\n");

    await expect(applyForPreview(root, "Update the page", changes)).rejects.toThrow("changed after");
    expect(await getActiveProposal(root)).toBeUndefined();
  });

  test("exposes typed proposal failures to Effect callers", async () => {
    const { root } = await changedProject();

    const result = await Effect.runPromise(Effect.either(keepProposalEffect("missing", root)));

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("ProposalError");
      expect(result.left.message).toContain("not found");
    }
  });
});
