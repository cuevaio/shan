# Shan

Shan is a Bun/Turborepo workspace for in-app drawing and prompt-driven editing.

## Workspace

- [`packages/nebi`](packages/nebi) — the publishable `nebi-agent` npm package
- [`apps/shan`](apps/shan) — the Shan motion-drawing example
- [`apps/nebi`](apps/nebi) — the Nebi live code-editing example

The package owns the reusable functionality used by the examples:

- pointer-stroke capture, cleanup, sampling, and playback plans
- model-backed motion refinement for Next.js route handlers
- prompt-driven code edits with live preview, keep, and discard

## Develop

```sh
bun install
cp apps/shan/.env.example apps/shan/.env.local
cp apps/nebi/.env.example apps/nebi/.env.local
# Add NEBIUS_API_KEY to the examples you want to run.
bun run dev
```

- Nebi example: [http://localhost:3000](http://localhost:3000)
- Shan example: [http://localhost:4721](http://localhost:4721)

Run one example with a Turbo filter:

```sh
bun run dev --filter=shan-example
bun run dev --filter=nebi-example
```

## Verify

```sh
bun run test
bun run typecheck
bun run build
```

See the [package README](packages/nebi/README.md) for installation and API details.
