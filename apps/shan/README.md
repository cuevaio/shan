# Shan

Draw a motion with the cursor. Shan reads the gesture and plays it on a picture.

A shaky circle is an orbit. A pause is a hold. Refine asks a model for a named motion with easing and duration. A local cleanup of the same stroke sits beside that reading: a smoothed polyline, not a guess at the gesture.

Only the path coordinates are sent. The picture stays in the browser.

## Develop

```bash
cd ../..
bun install
cp apps/shan/.env.example apps/shan/.env.local
bun run dev --filter=shan-example
```

Open http://127.0.0.1:4721

The mark at the bottom of the page opens the toolbox. Pick a picture, draw, then refine.

## Model

Refine calls [Nebius Token Factory](https://tokenfactory.nebius.com) when `NEBIUS_API_KEY` is set. The API is OpenAI-compatible.

```bash
NEBIUS_API_KEY=your_key bun run dev -- --hostname 127.0.0.1 --port 4721
```

Optional: `NEBIUS_MODEL`. The default is `meta-llama/Llama-3.3-70B-Instruct`.

Without the key, capture still works and the picture follows the cleaned stroke. The toolbox says the model step is waiting on the key.

Copy `apps/shan/.env.example` to `apps/shan/.env.local` if you want the key loaded for you. `.env.local` stays out of git.

## Privacy

The refine request body is a list of `{ x, y, t }` points. It does not include the picture.
