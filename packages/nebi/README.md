# Nebi Agent

An in-app toolkit for drawing motion and making prompt-driven code changes in Next.js. It provides headless stroke APIs, model-backed motion refinement, and a live-preview coding toolbar with **Keep Changes** and **Discard Changes** controls.

## Install

```sh
npm install nebi-agent
```

Add the toolbar to your root layout:

```tsx
// app/layout.tsx
import { NebiToolbar } from "nebi-agent";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <NebiToolbar />
      </body>
    </html>
  );
}
```

Create its server route:

```ts
// app/api/nebi/route.ts
import { createNebiRouteHandler } from "nebi-agent/next";

export const runtime = "nodejs";
export const POST = createNebiRouteHandler();
```

Set the API key in `.env.local`:

```sh
NEBIUS_API_KEY=...
```

Nebi is disabled automatically when `NODE_ENV=production`. If you deliberately expose it elsewhere, add your own authentication and pass `enabled: true` explicitly.

## Motion drawing

`nebi-agent/motion` provides a headless React hook and framework-independent motion helpers, so an app keeps full control over its UI:

```tsx
"use client";

import {
  cleanupPlan,
  playMotion,
  useStrokeCapture,
} from "nebi-agent/motion";

export function DrawingSurface() {
  const stroke = useStrokeCapture();

  return (
    <div {...stroke.bindings} style={{ touchAction: "none" }}>
      <button
        onClick={(event) => {
          const plan = cleanupPlan(stroke.cleanedPoints, false);
          playMotion(event.currentTarget, plan);
        }}
      >
        Draw here, then play
      </button>
    </div>
  );
}
```

The motion export also includes `cleanStroke`, `sampleForModel`, `strokeIsUsable`, `cleanupPlan`, `readingPlan`, motion types, and parsing helpers.

Create a Next.js route for model-backed motion readings:

```ts
// app/api/refine/route.ts
import { createMotionRouteHandlers } from "nebi-agent/motion/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createMotionRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
```

`createMotionRouteHandlers` reads `NEBIUS_API_KEY` and optional `NEBIUS_MODEL`. The client should POST `{ points: [{ x, y, t }] }`, where coordinates are normalized from 0 to 1 and `t` is elapsed milliseconds. Images are never sent.

## Preview and rollback model

- The agent builds a bounded in-memory draft, then applies it automatically for live preview.
- After writing, the toolbar waits briefly for the Next.js compiler and reloads once so the rendered preview cannot remain on a stale Fast Refresh result. The delay is configurable with `previewReloadDelayMs`.
- Only one preview may be active at a time. The patch remains visible while the app is being tried.
- **Keep Changes** accepts the current files; **Discard Changes** restores their original contents.
- Discarding fails rather than overwriting a target file changed by something else during the preview.
- `.env*`, dependencies, generated output, Git internals, symlinks, and paths outside the project are inaccessible.
- No shell tool is exposed to the model.
- Original contents are stored with owner-only permissions in the system temporary directory, so discard remains available across hot reloads and development-server restarts.
