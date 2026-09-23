"use client";

import {
  cleanupPlan,
  parseMotionSpec,
  playMotion,
  readingPlan,
  sampleForModel,
  stopMotion,
  strokeIsUsable,
  strokePolyline,
  useStrokeCapture,
  type MotionSpec,
  type StrokePoint,
} from "shan/motion";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SLIDE_COUNT = 9;

const sampleOrbit = Array.from({ length: 25 }, (_, index) => {
  const progress = index / 24;
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: 0.5 + Math.cos(angle) * 0.2,
    y: 0.5 + Math.sin(angle) * 0.28,
    t: progress * 1_600,
  };
});

type DemoResult = {
  spec: MotionSpec;
  latencyMs: number;
  model: string;
  pointCount: number;
};

type MotionResponse =
  | { status: "reading"; spec: unknown; latencyMs?: number; model?: string }
  | { status: "waiting" | "error"; message?: string; latencyMs?: number };

function Slide({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className={`pitch-enter flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-[#f4f0e8] px-[clamp(1.5rem,5vw,5rem)] py-[clamp(1.5rem,4vw,4rem)] text-[#161616] ${className}`}
    >
      {children}
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[clamp(0.72rem,1vw,0.9rem)] font-semibold tracking-[0.16em] text-[#161616]/45 uppercase">
      {children}
    </p>
  );
}

function BigTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`max-w-[15ch] text-[clamp(3.25rem,8.5vw,8.5rem)] leading-[0.9] font-medium tracking-[-0.065em] text-balance ${className}`}
    >
      {children}
    </h1>
  );
}

function DemoSlide({
  onResult,
}: {
  onResult: (result: DemoResult) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [sample, setSample] = useState<StrokePoint[] | null>(null);
  const [status, setStatus] = useState("Draw a loop around the element.");
  const [busy, setBusy] = useState(false);
  const stroke = useStrokeCapture({
    enabled: !busy,
    onStart: () => {
      setSample(null);
      setStatus("Drawing captured. Play it literally or ask the model to read it.");
    },
  });
  const points = sample ?? stroke.points;
  const ready = strokeIsUsable(points);

  const clear = useCallback(() => {
    stopMotion(targetRef.current);
    stroke.clear();
    setSample(null);
    setStatus("Draw a loop around the element.");
  }, [stroke]);

  const useSample = useCallback(() => {
    stopMotion(targetRef.current);
    stroke.clear();
    setSample(sampleOrbit);
    setStatus("Sample loaded. Compare the literal path with the model reading.");
  }, [stroke]);

  const playLiteral = useCallback(() => {
    if (!ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playMotion(targetRef.current, cleanupPlan(points, reduced));
    setStatus(`Local geometry is replaying ${points.length} path points.`);
  }, [points, ready]);

  const readIntent = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    setStatus("Token Factory is reading the motion intent…");

    try {
      const response = await fetch("/api/motion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: sampleForModel(points) }),
      });
      const payload = (await response.json()) as MotionResponse;

      if (payload.status !== "reading") {
        setStatus(payload.message ?? "Token Factory did not return a motion.");
        return;
      }

      const spec = parseMotionSpec(payload.spec);
      if (!spec) {
        setStatus("Token Factory returned an invalid motion.");
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      playMotion(targetRef.current, readingPlan(spec, points, reduced));
      const result = {
        spec,
        latencyMs: payload.latencyMs ?? 0,
        model: payload.model ?? "Token Factory",
        pointCount: sampleForModel(points).length,
      };
      onResult(result);
      setStatus(spec.reading || `Read as ${spec.name}.`);
    } catch {
      setStatus("The model did not answer. The local path still works.");
    } finally {
      setBusy(false);
    }
  }, [busy, onResult, points, ready]);

  function keepSlideKeys(event: ReactKeyboardEvent) {
    if (event.key === " " || event.key.startsWith("Arrow")) event.stopPropagation();
  }

  return (
    <Slide label="Live product demonstration" className="gap-5">
      <div className="flex items-end justify-between gap-8">
        <div>
          <Kicker>Live demo</Kicker>
          <h1 className="mt-3 text-[clamp(2.5rem,5vw,5.5rem)] leading-[0.94] font-medium tracking-[-0.055em]">
            Point. Draw. Refine.
          </h1>
        </div>
        <p className="hidden max-w-xs text-right text-[clamp(0.9rem,1.2vw,1.1rem)] leading-relaxed text-[#161616]/55 xl:block">
          Draw the motion directly on the page. Only normalized coordinates go to the model.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-[clamp(1rem,3vw,3rem)] lg:grid-cols-[1fr_18rem] lg:items-center">
        <div
          {...stroke.bindings}
          onKeyDown={keepSlideKeys}
          className="relative min-h-[48vh] touch-none overflow-hidden rounded-[2rem] bg-[#161616] select-none"
          aria-label="Draw a motion path around the selected element"
        >
          <div className="absolute inset-0 grid place-items-center">
            <div
              ref={targetRef}
              className="grid aspect-[4/5] w-[clamp(5rem,12vw,9rem)] place-items-center rounded-[1.6rem] bg-[#6d4aff] text-sm font-semibold tracking-[0.14em] text-[#f4f0e8] uppercase"
            >
              Element
            </div>
          </div>
          {points.length > 1 ? (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <polyline
                points={strokePolyline(points)}
                fill="none"
                stroke="#f4f0e8"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>

        <div className="flex flex-col justify-center gap-3">
          <button
            type="button"
            onClick={useSample}
            className="h-12 rounded-full bg-[#161616]/8 px-5 text-left text-sm font-semibold transition-colors hover:bg-[#161616]/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4aff]"
          >
            Use sample orbit
          </button>
          <button
            type="button"
            onClick={playLiteral}
            disabled={!ready || busy}
            className="h-12 rounded-full bg-[#161616]/8 px-5 text-left text-sm font-semibold transition-colors hover:bg-[#161616]/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4aff] disabled:opacity-35"
          >
            Play literal path
          </button>
          <button
            type="button"
            onClick={() => void readIntent()}
            disabled={!ready || busy}
            className="h-12 rounded-full bg-[#6d4aff] px-5 text-left text-sm font-semibold text-[#f4f0e8] transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4aff] active:scale-[0.98] disabled:opacity-35"
          >
            {busy ? "Reading intent…" : "Read with Token Factory"}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!ready && points.length === 0}
            className="h-12 rounded-full px-5 text-left text-sm font-semibold text-[#161616]/55 transition-colors hover:bg-[#161616]/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4aff] disabled:opacity-35"
          >
            Clear
          </button>
          <p aria-live="polite" className="min-h-16 pt-3 text-sm leading-relaxed text-[#161616]/55">
            {status}
          </p>
        </div>
      </div>
    </Slide>
  );
}

function AdvantageSlide({ result }: { result: DemoResult | null }) {
  return (
    <Slide label="Measurable model advantage">
      <div>
        <Kicker>Model advantage</Kicker>
        <BigTitle className="mt-5">Geometry replays. The model understands.</BigTitle>
      </div>

      <div className="grid gap-8 pb-[clamp(1rem,3vw,3rem)] md:grid-cols-2">
        <div className="bg-[#161616]/6 p-[clamp(1.5rem,3vw,3rem)]">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#161616]/45 uppercase">
            Local geometry
          </p>
          <p className="mt-5 text-[clamp(2rem,5vw,5rem)] leading-none font-medium tracking-[-0.05em]">
            {result ? result.pointCount : "≤80"} points
          </p>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-[#161616]/55">
            Replays every wobble in the captured path.
          </p>
        </div>

        <div className="bg-[#6d4aff] p-[clamp(1.5rem,3vw,3rem)] text-[#f4f0e8]">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#f4f0e8]/65 uppercase">
            Token Factory
          </p>
          <p className="mt-5 text-[clamp(2rem,5vw,5rem)] leading-none font-medium tracking-[-0.05em] capitalize">
            {result?.spec.name ?? "1 intent"}
          </p>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-[#f4f0e8]/75">
            {result
              ? `${result.spec.durationMs} ms motion. ${result.latencyMs} ms model latency.`
              : "Returns one named, validated, portable motion spec."}
          </p>
        </div>
      </div>
    </Slide>
  );
}

export function PitchDeck() {
  const [slide, setSlide] = useState(0);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const hasMounted = useRef(false);

  const goTo = useCallback((next: number) => {
    setSlide(Math.min(SLIDE_COUNT - 1, Math.max(0, next)));
  }, []);

  useEffect(() => {
    document.body.classList.add("pitch-active");
    const fromHash = Number.parseInt(window.location.hash.slice(1), 10);
    if (Number.isFinite(fromHash)) {
      goTo(fromHash - 1);
    } else {
      window.history.replaceState(null, "", "#1");
    }
    return () => document.body.classList.remove("pitch-active");
  }, [goTo]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    window.history.replaceState(null, "", `#${slide + 1}`);
  }, [slide]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        goTo(slide + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goTo(slide - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(SLIDE_COUNT - 1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, slide]);

  const content = useMemo(() => {
    switch (slide) {
      case 0:
        return (
          <Slide label="Shan title">
            <p className="text-[clamp(1rem,1.5vw,1.35rem)] font-medium tracking-[-0.02em]">
              Shan for Next.js
            </p>
            <div>
              <BigTitle>Draw the change.</BigTitle>
              <p className="mt-8 max-w-2xl text-[clamp(1.15rem,2vw,1.65rem)] leading-relaxed text-[#161616]/55">
                A visual agent editor that turns what you point at and draw into a change you can try.
              </p>
            </div>
            <p className="font-mono text-sm text-[#161616]/45">npm install shan</p>
          </Slide>
        );
      case 1:
        return (
          <Slide label="User problem">
            <Kicker>Product value</Kicker>
            <BigTitle>Text drops visual intent.</BigTitle>
            <div className="grid gap-8 pb-[clamp(1rem,3vw,3rem)] md:grid-cols-[1fr_1.3fr] md:items-end">
              <p className="text-[clamp(1.1rem,2vw,1.7rem)] leading-relaxed text-[#161616]/55">
                Founders and design engineers can see the motion they want. Describing path, timing, and easing in prose turns a quick idea into a slow handoff.
              </p>
              <p className="text-[clamp(2rem,4vw,4.5rem)] leading-[1.02] font-medium tracking-[-0.045em] text-[#6d4aff]">
                “Make this feel more alive.”
              </p>
            </div>
          </Slide>
        );
      case 2:
        return (
          <Slide label="Product workflow">
            <Kicker>The product</Kicker>
            <div className="grid flex-1 content-center gap-[clamp(1rem,2vw,2rem)]">
              {[
                ["01", "Select the element."],
                ["02", "Draw the motion."],
                ["03", "Try the change live."],
              ].map(([number, line]) => (
                <div key={number} className="grid grid-cols-[3rem_1fr] items-baseline gap-5 md:grid-cols-[5rem_1fr]">
                  <span className="font-mono text-sm text-[#6d4aff]">{number}</span>
                  <p className="text-[clamp(2.3rem,6vw,6.5rem)] leading-[0.94] font-medium tracking-[-0.055em]">
                    {line}
                  </p>
                </div>
              ))}
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-[#161616]/55">
              The page becomes the interface for prompting, previewing, keeping, or discarding the result.
            </p>
          </Slide>
        );
      case 3:
        return <DemoSlide onResult={setDemoResult} />;
      case 4:
        return <AdvantageSlide result={demoResult} />;
      case 5:
        return (
          <Slide label="Token Factory architecture">
            <div>
              <Kicker>Architecture</Kicker>
              <BigTitle className="mt-5">Token Factory is in the critical path.</BigTitle>
            </div>
            <div className="grid gap-8 pb-[clamp(1rem,3vw,3rem)] md:grid-cols-3">
              <div>
                <p className="font-mono text-sm text-[#6d4aff]">Browser</p>
                <p className="mt-4 text-[clamp(1.5rem,3vw,3rem)] leading-tight font-medium tracking-[-0.035em]">
                  Selection and normalized drawing
                </p>
              </div>
              <div>
                <p className="font-mono text-sm text-[#6d4aff]">Nebius</p>
                <p className="mt-4 text-[clamp(1.5rem,3vw,3rem)] leading-tight font-medium tracking-[-0.035em]">
                  Llama 3.3 70B reads intent
                </p>
              </div>
              <div>
                <p className="font-mono text-sm text-[#6d4aff]">Browser</p>
                <p className="mt-4 text-[clamp(1.5rem,3vw,3rem)] leading-tight font-medium tracking-[-0.035em]">
                  MotionSpec plays immediately
                </p>
              </div>
            </div>
          </Slide>
        );
      case 6:
        return (
          <Slide label="Company potential">
            <div>
              <Kicker>Company potential</Kicker>
              <BigTitle className="mt-5">The wedge is motion. The platform is visual context.</BigTitle>
            </div>
            <div className="grid gap-8 pb-[clamp(1rem,3vw,3rem)] md:grid-cols-3">
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-[#161616]/45 uppercase">User</p>
                <p className="mt-4 text-2xl leading-tight font-medium">Next.js founders and product teams</p>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-[#161616]/45 uppercase">Entry</p>
                <p className="mt-4 text-2xl leading-tight font-medium">An open package installed once</p>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.14em] text-[#161616]/45 uppercase">Expansion</p>
                <p className="mt-4 text-2xl leading-tight font-medium">Paid team review and production controls</p>
              </div>
            </div>
          </Slide>
        );
      case 7:
        return (
          <Slide label="Responsible design">
            <div>
              <Kicker>Responsible design</Kicker>
              <BigTitle className="mt-5">For motion reading, the page stays private.</BigTitle>
            </div>
            <div className="grid gap-8 pb-[clamp(1rem,3vw,3rem)] md:grid-cols-2">
              <div className="bg-[#6d4aff] p-[clamp(1.5rem,3vw,3rem)] text-[#f4f0e8]">
                <p className="text-sm font-semibold tracking-[0.14em] text-[#f4f0e8]/65 uppercase">Sent</p>
                <p className="mt-5 text-[clamp(1.8rem,4vw,4rem)] leading-tight font-medium tracking-[-0.045em]">
                  x, y, and time
                </p>
              </div>
              <div className="bg-[#161616]/6 p-[clamp(1.5rem,3vw,3rem)]">
                <p className="text-sm font-semibold tracking-[0.14em] text-[#161616]/45 uppercase">Never sent</p>
                <p className="mt-5 text-[clamp(1.8rem,4vw,4rem)] leading-tight font-medium tracking-[-0.045em]">
                  Screenshots, source, and secrets
                </p>
              </div>
            </div>
            <p className="max-w-3xl text-lg leading-relaxed text-[#161616]/55">
              Responses are validated against six allowed motions, bounded timing, and known easing values before playback.
            </p>
          </Slide>
        );
      default:
        return (
          <Slide label="Closing">
            <Kicker>Shan</Kicker>
            <BigTitle>The interface becomes the prompt.</BigTitle>
            <div className="flex flex-wrap items-end justify-between gap-8">
              <p className="max-w-xl text-[clamp(1.1rem,2vw,1.5rem)] leading-relaxed text-[#161616]/55">
                Show the intent. Try the change. Keep what works.
              </p>
              <a
                href="https://github.com/shiarauzo/shan"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#161616] px-6 py-3 text-sm font-semibold text-[#f4f0e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4aff]"
              >
                github.com/shiarauzo/shan
              </a>
            </div>
          </Slide>
        );
    }
  }, [demoResult, slide]);

  return (
    <main className="pitch-deck" aria-live="polite">
      {content}
    </main>
  );
}
