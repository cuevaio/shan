# Shan pitch

Target: 4:40, leaving 20 seconds of buffer.

## 1. Draw the change — 0:00–0:20

Shan is a visual agent editor for Next.js. It turns what you point at and draw
into a change you can try on the page.

## 2. Product value — 0:20–0:50

Founders and design engineers can see the motion they want, but their coding
agent only gets text. Describing path, timing, and easing turns a quick visual
idea into a slow handoff.

## 3. Product — 0:50–1:15

With Shan, you select the element, draw the motion, and try the change live.
The page itself becomes the prompting and review surface.

## 4. Live demo — 1:15–2:40

1. Load the sample orbit or draw a rough circle.
2. Play the literal path. Point out that local geometry preserves every wobble.
3. Read it with Token Factory. Point out the named motion and immediate
   playback.
4. Move to the next slide while the measured result is still on screen.

## 5. Model advantage — 2:40–3:10

Local code can clean or replay coordinates. It cannot decide what the person
meant. Token Factory turns up to 80 sampled points into one named, validated
MotionSpec. Read the point count, model latency, motion, and duration collected
by the live demo.

## 6. Architecture — 3:10–3:40

Selection and drawing happen in the browser. Only normalized x, y, and time
reach Llama 3.3 70B through Nebius Token Factory. The validated MotionSpec
returns to the browser and plays with the Web Animations API. Token Factory is
in the critical path.

## 7. Company potential — 3:40–4:10

The first users are Next.js founders, design engineers, and product teams. The
open package is the distribution wedge. Paid team review, shared visual
context, and production controls are the expansion.

## 8. Responsible design — 4:10–4:30

For motion reading, screenshots, source, and secrets never leave the browser.
The model sees normalized coordinates. Its response must match six allowed
motions, bounded timing, and known easing values before anything plays.

## 9. Close — 4:30–4:40

Shan makes the interface the prompt. Show the intent, try the change, and keep
what works.

## Criterion coverage

- Product value and functionality, 25%: slides 2–4
- Business potential, 20%: slide 7
- Measurable model advantage, 20%: slides 4–5
- Architecture and Token Factory, 20%: slide 6
- Demo clarity, 10%: slide 4 and the timed flow
- Responsible design, 5%: slide 8
