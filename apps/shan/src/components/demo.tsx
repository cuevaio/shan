"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  cleanupPlan,
  cleanStroke,
  parseMotionSpec,
  playMotion,
  playingLine,
  readingPlan,
  sampleForModel,
  stopMotion,
  strokeIsUsable,
  strokePolyline,
  useStrokeCapture,
  type MotionSpec,
  type StrokePoint,
} from "nebi-agent/motion";
import { Toolbox, type RefineView } from "@/components/toolbox";
import { cn } from "@/lib/utils";
import { PICTURES, type PictureId } from "@/lib/pictures";

type Playback =
  | { kind: "cleanup" }
  | { kind: "reading"; spec: MotionSpec };

function stopAllMotion(nodes: Partial<Record<PictureId, HTMLDivElement | null>>) {
  for (const node of Object.values(nodes)) {
    stopMotion(node);
  }
}

export function Demo() {
  const [open, setOpen] = useState(false);
  const [pictureId, setPictureId] = useState<PictureId | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [refineView, setRefineView] = useState<RefineView>({ status: "idle" });
  const [playback, setPlayback] = useState<Playback | null>(null);
  const nodes = useRef<Partial<Record<PictureId, HTMLDivElement | null>>>({});
  const buttons = useRef<Partial<Record<PictureId, HTMLButtonElement | null>>>({});
  const returnFocus = useRef<PictureId | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pictureIdRef = useRef<PictureId | null>(null);
  const {
    points: rawPoints,
    cleanedPoints,
    ready: strokeReady,
    bindings: strokeBindings,
    clear: clearCapturedStroke,
    getPoints,
  } = useStrokeCapture({
    enabled: pictureId !== null,
    shouldIgnoreTarget: shouldIgnoreDrawTarget,
    onStart() {
      setRefineView({ status: "idle" });
      setPlayback(null);
      stopAllMotion(nodes.current);
    },
  });

  useEffect(() => {
    pictureIdRef.current = pictureId;
  }, [pictureId]);

  const close = useCallback(() => {
    returnFocus.current = pictureId;
    setOpen(false);
  }, [pictureId]);

  const finishClose = useCallback(() => {
    setPictureId(null);
    setAnchor(null);
  }, []);

  useLayoutEffect(() => {
    if (!pictureId) return;
    setAnchor(nodes.current[pictureId] ?? null);
  }, [pictureId]);

  useEffect(() => {
    if (pictureId || !returnFocus.current) return;
    buttons.current[returnFocus.current]?.focus();
    returnFocus.current = null;
  }, [pictureId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/refine")
      .then((response) => response.json())
      .then((body: { configured?: boolean }) => {
        if (!cancelled) setConfigured(body.configured === true);
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeNodes = nodes.current;
    return () => {
      stopAllMotion(activeNodes);
    };
  }, []);

  function play(next: Playback, points: StrokePoint[], targetId: PictureId) {
    setPlayback(next);
    stopAllMotion(nodes.current);
    const node = nodes.current[targetId];
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plan =
      next.kind === "cleanup"
        ? cleanupPlan(cleanStroke(points), reduced)
        : readingPlan(next.spec, points, reduced);
    if (!plan) return;

    playMotion(node, plan);
    node.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function openToolbox() {
    setOpen(true);
  }

  function selectPicture(id: PictureId) {
    if (id !== pictureId) {
      clearCapturedStroke();
      setRefineView(configured === false ? { status: "waiting" } : { status: "idle" });
      setPlayback(null);
      stopAllMotion(nodes.current);
    }
    setPictureId(id);
    setOpen(true);
  }

  function clearStroke() {
    clearCapturedStroke();
    setRefineView(configured === false ? { status: "waiting" } : { status: "idle" });
    setPlayback(null);
    stopAllMotion(nodes.current);
  }

  function shouldIgnoreDrawTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return true;
    if (target.closest("#shan-toolbox")) return true;
    if (target.closest("[data-shan-mark]")) return true;
    if (target.closest("a")) return true;
    const select = target.closest("[data-picture-id]");
    if (select instanceof HTMLElement) {
      const id = select.dataset.pictureId;
      if (id && id !== pictureIdRef.current) return true;
    }
    return false;
  }

  async function refine() {
    const points = getPoints();
    if (!pictureId || !strokeIsUsable(points)) return;
    const targetId = pictureId;
    setRefineView({ status: "loading" });

    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: sampleForModel(points) }),
      });
      const body = (await response.json()) as {
        status?: string;
        message?: string;
        spec?: unknown;
        latencyMs?: number;
        model?: string;
      };

      if (body.status === "waiting") {
        setConfigured(false);
        setRefineView({ status: "waiting" });
        play({ kind: "cleanup" }, points, targetId);
        return;
      }

      if (body.status === "reading") {
        const spec = parseMotionSpec(body.spec);
        if (!spec || typeof body.latencyMs !== "number" || typeof body.model !== "string") {
          setRefineView({
            status: "error",
            message: "The model did not return a motion. The cleaned stroke can still play.",
          });
          play({ kind: "cleanup" }, points, targetId);
          return;
        }
        setConfigured(true);
        setRefineView({
          status: "reading",
          spec,
          latencyMs: body.latencyMs,
          model: body.model,
        });
        play({ kind: "reading", spec }, points, targetId);
        return;
      }

      setRefineView({
        status: "error",
        message: body.message ?? "The model did not return a motion. The cleaned stroke can still play.",
      });
      play({ kind: "cleanup" }, points, targetId);
    } catch {
      setRefineView({
        status: "error",
        message: "The model step did not answer. The cleaned stroke can still play.",
      });
      play({ kind: "cleanup" }, points, targetId);
    }
  }

  return (
    <div className="min-h-dvh bg-[#f3f0e8] text-[#161616]">
      <a href="#account" className="landing-skip">
        Skip to the account
      </a>

      <div
        className={cn("relative", pictureId && "touch-none")}
        {...strokeBindings}
      >
        <header className="flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 sm:px-10">
          <p className="text-2xl tracking-tight" translate="no">
            Sable
          </p>
          <p className="text-sm text-[#161616]/50">Private account</p>
        </header>

        <main className="pb-28">
          <section className="px-6 pt-14 pb-10 sm:px-10 sm:pt-20">
            <h1 className="max-w-3xl text-5xl leading-[1.02] tracking-tight text-balance sm:text-7xl">
              Hold money quietly.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-7 text-[#161616]/60 text-pretty">
              A card, a transfer, and the member who holds them.
            </p>
            <div className="mt-8">
              <a
                href="#account"
                className="inline-flex h-10 items-center rounded-full bg-[#161616] px-4 text-sm text-[#f3f0e8] transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[#161616]/85 focus-visible:ring-2 focus-visible:ring-[#161616] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96]"
              >
                See the card
              </a>
            </div>
          </section>

          <section id="account" className="scroll-mt-6 px-6 py-8 sm:px-10">
            <h2 className="text-[12px] tracking-[0.16em] text-[#161616]/40 uppercase">
              The account
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PICTURES.map((picture) => {
                const selected = pictureId === picture.id;
                const playingHere = selected && playback !== null;
                const span = picture.id === "card" ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : "";
                return (
                  <li key={picture.id} className={span}>
                    <figure>
                      <div
                        ref={(node) => {
                          nodes.current[picture.id] = node;
                        }}
                        className="scroll-mt-4 will-change-transform"
                        style={{ transformOrigin: "center center" }}
                      >
                        <button
                          ref={(node) => {
                            buttons.current[picture.id] = node;
                          }}
                          type="button"
                          data-picture-id={picture.id}
                          aria-pressed={selected}
                          aria-label={`Select ${picture.label}`}
                          onClick={() => selectPicture(picture.id)}
                          className="block w-full rounded-[28px] p-0 transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[#161616] focus-visible:ring-offset-2"
                        >
                          <img
                            src={picture.src}
                            alt={picture.alt}
                            width={1200}
                            height={900}
                            className={cn(
                              "w-full rounded-[28px]",
                              picture.id === "card"
                                ? "aspect-[4/3] object-contain lg:aspect-[4/5] lg:h-full"
                                : "aspect-[4/5] object-cover outline outline-1 outline-black/10",
                              selected && "shadow-[0_0_0_2px_#161616]",
                            )}
                          />
                        </button>
                      </div>
                      <figcaption className="mt-3 text-sm leading-5">
                        <span className={selected ? "text-[#161616]" : "text-[#161616]/55"}>
                          {picture.label}
                        </span>
                        {playingHere ? (
                          <span className="mt-1 block text-[#161616]/55">
                            {playback.kind === "reading"
                              ? playingLine("reading", playback.spec.name)
                              : playingLine("cleanup")}
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        {rawPoints.length > 1 ? (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-40 h-full w-full"
            aria-hidden="true"
          >
            <polyline
              points={strokePolyline(rawPoints)}
              fill="none"
              stroke="#161616"
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
      </div>

      <button
        type="button"
        data-shan-mark
        aria-label="Open toolbox"
        aria-expanded={open}
        aria-controls="shan-toolbox"
        onClick={openToolbox}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 grid size-11 place-items-center rounded-full bg-black text-[15px] leading-none font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.08)] outline-none transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:scale-[0.96]"
      >
        S
      </button>

      <Toolbox
        open={open}
        anchor={anchor}
        configured={configured}
        pictureId={pictureId}
        rawPoints={rawPoints}
        cleanedPoints={cleanedPoints}
        strokeReady={strokeReady}
        refineView={
          refineView.status === "idle" && configured === false
            ? { status: "waiting" }
            : refineView
        }
        onClose={close}
        onExited={finishClose}
        onClear={clearStroke}
        onRefine={() => void refine()}
        onPlayCleanup={() => {
          const points = getPoints();
          if (!pictureId || !strokeIsUsable(points)) return;
          play({ kind: "cleanup" }, points, pictureId);
        }}
        onPlayReading={() => {
          if (!pictureId || refineView.status !== "reading") return;
          play(
            { kind: "reading", spec: refineView.spec },
            getPoints(),
            pictureId,
          );
        }}
      />
    </div>
  );
}
