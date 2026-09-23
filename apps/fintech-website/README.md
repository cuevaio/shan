# Fintech website example

The Sable fintech page used to demonstrate Shan against a richer interface. The page itself contains presentation only; the `shan` package mounted in its root layout provides selection, drawing, animation, and code editing.

## Develop

```sh
cd ../..
bun install
cp apps/fintech-website/.env.example apps/fintech-website/.env.local
bun run dev --filter=fintech-website
```

Open http://127.0.0.1:4721.

Set `NEBIUS_API_KEY` to enable coding prompts and model-backed motion readings. Direct drawing playback works without a key.
