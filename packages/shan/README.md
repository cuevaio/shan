# Shan

A visual agent editor for Next.js. Shan owns element selection, drawing notes, direct motion previews, element-aware prompting, live code changes, and keep/discard review.

## Install

```sh
npm install shan
```

Mount the floating editor once in the root layout:

```tsx
// app/layout.tsx
import { ShanEditor } from "shan";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ShanEditor />
      </body>
    </html>
  );
}
```

Create its server route:

```ts
// app/api/shan/route.ts
import { createShanRouteHandler } from "shan/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createShanRouteHandler();
```

Set the API key in `.env.local`:

```sh
NEBIUS_API_KEY=...
```

Shan is disabled automatically when `NODE_ENV=production`. If you deliberately expose it elsewhere, add authentication and pass `enabled: true` explicitly.

## Visual context

The floating editor can:

- apply a prompt globally when no context is selected
- inspect and select any element on the rendered page
- capture a drawing note over the viewport
- play that drawing directly on the selected element
- ask the model to read the drawing as a named motion and preview it
- include the selected element metadata and sampled drawing with a coding prompt
- show the resulting patch and keep or discard it

The selected element's selector, tag, classes, text, bounded HTML, and browser bounds are sent as locator context. Drawing coordinates are normalized from 0 to 1. Images and screenshots are not sent.

## Lower-level motion APIs

`shan/motion` exports the same capture and animation primitives used by the editor: `useStrokeCapture`, `cleanStroke`, `sampleForModel`, `strokeIsUsable`, `cleanupPlan`, `readingPlan`, `playMotion`, and the motion types.

## Preview and rollback model

- The agent builds a bounded in-memory draft, then applies it for live preview.
- After writing, the editor waits briefly for Next.js to compile and reloads once.
- Only one preview may be active at a time.
- **Keep changes** accepts the current files; **Discard changes** restores their original contents.
- Discarding fails rather than overwriting a target changed by something else during preview.
- `.env*`, dependencies, generated output, Git internals, symlinks, and paths outside the project are inaccessible.
- No shell tool is exposed to the model.
- Original contents are stored with owner-only permissions in the system temporary directory.
