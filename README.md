# Shan

Shan is a visual agent editor for Next.js. Select an element, draw a motion note, preview the animation, and ask the coding agent to change the page with that visual context.

## Workspace

- [`packages/shan`](packages/shan) — the publishable `shan` npm package
- [`apps/marketing-website`](apps/marketing-website) — a minimal marketing-site example
- [`apps/fintech-website`](apps/fintech-website) — the Sable fintech-site example

Both examples are UI-only sites. Element selection, drawing capture, direct animation, model-backed motion reading, prompt context, live code changes, and keep/discard are implemented by the package.

## Develop

```sh
bun install
cp apps/marketing-website/.env.example apps/marketing-website/.env.local
cp apps/fintech-website/.env.example apps/fintech-website/.env.local
# Add NEBIUS_API_KEY to the examples you want to run.
bun run dev
```

- Marketing website: [http://localhost:3000](http://localhost:3000)
- Fintech website: [http://localhost:4721](http://localhost:4721)

Run one example with a Turbo filter:

```sh
bun run dev --filter=marketing-website
bun run dev --filter=fintech-website
```

## Verify

```sh
bun run test
bun run typecheck
bun run build
```

See the [package README](packages/shan/README.md) for installation and API details.
