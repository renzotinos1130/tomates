"use client";

import { useEffect, useRef, useState } from "react";
import { TowerAudio } from "./audio";
import { Director } from "./director";
import type { FreeArea, TowerScene } from "./scene/scene";

export interface StageHandle {
  scene: TowerScene;
  audio: TowerAudio;
  director: Director;
}

const WHOLE: FreeArea = { x: 0, y: 0, w: 1, h: 1 };

/**
 * The part of the stage no panel is laid over: the widest band above, below,
 * left or right of the panels (those marked `data-tower-panel`). The scene
 * frames its subject there, so that a board or a result never hides the tower.
 */
function freeArea(stage: HTMLElement): FreeArea {
  const box = stage.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return WHOLE;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const panel of stage.querySelectorAll<HTMLElement>("[data-tower-panel]")) {
    const r = panel.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    x0 = Math.min(x0, r.left - box.left);
    y0 = Math.min(y0, r.top - box.top);
    x1 = Math.max(x1, r.right - box.left);
    y1 = Math.max(y1, r.bottom - box.top);
  }
  if (x0 === Infinity) return WHOLE;
  const part = (n: number, of: number) => Math.min(1, Math.max(0, n / of));
  const left = part(x0, box.width);
  const right = part(x1, box.width);
  const top = part(y0, box.height);
  const bottom = part(y1, box.height);
  const bands: FreeArea[] = [
    { x: 0, y: 0, w: 1, h: top },
    { x: 0, y: 0, w: left, h: 1 },
    { x: right, y: 0, w: 1 - right, h: 1 },
    { x: 0, y: bottom, w: 1, h: 1 - bottom },
  ];
  const best = bands.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  // Too little left to show anything in: the picture stays where it was, behind the panel.
  return best.w < 0.22 || best.h < 0.22 ? WHOLE : best;
}

/**
 * Where the game is drawn: the sky (a few gradients, one per part of the day
 * the tower climbs through), the 3D scene on top of it, and whatever the
 * screens lay over both. The scene and three.js are loaded here, on demand:
 * the rest of the app never pays for them.
 *
 * The loop lives here too: one frame asks the director to advance the game,
 * then the scene to draw. It stops with the component, and everything the
 * scene allocated is released.
 */
export function Stage({
  zone,
  onReady,
  onPress,
  children,
}: {
  /** 0 to 4: which sky is shown. */
  zone: number;
  onReady: (handle: StageHandle | null) => void;
  /** A tap or a click on the picture itself (not on a button laid over it). */
  onPress: () => void;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const ready = useRef(onReady);
  const live = useRef<StageHandle | null>(null);
  useEffect(() => {
    ready.current = onReady;
  });

  useEffect(() => {
    let gone = false;
    let frame = 0;
    let handle: StageHandle | null = null;
    let observer: ResizeObserver | null = null;
    let panels: MutationObserver | null = null;
    let measuring = 0;
    // The panels come, go and grow: the free part of the picture is measured again, once per frame at most.
    const measure = () => {
      cancelAnimationFrame(measuring);
      measuring = requestAnimationFrame(() => {
        if (handle && stage.current) handle.scene.setFree(freeArea(stage.current));
      });
    };

    void (async () => {
      try {
        const { TowerScene } = await import("./scene/scene");
        if (gone || !host.current) return;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const scene = new TowerScene(host.current, { calm });
        const audio = new TowerAudio();
        handle = { scene, audio, director: new Director(scene, audio) };
        live.current = handle;
        observer = new ResizeObserver(() => {
          scene.resize();
          measure();
        });
        observer.observe(host.current);
        if (stage.current) {
          panels = new MutationObserver(measure);
          panels.observe(stage.current, { childList: true, subtree: true, characterData: true });
          stage.current.addEventListener("animationend", measure);
          scene.setFree(freeArea(stage.current));
        }

        let last = performance.now();
        const loop = (now: number) => {
          // A long gap (the tab was hidden) is not played back: the director caps it too.
          const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
          last = now;
          handle!.director.tick(dt);
          scene.frame(dt);
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        setState("ready");
        ready.current(handle);
      } catch {
        // No WebGL here (an old device, a locked-down browser): the boards still work.
        if (!gone) setState("failed");
      }
    })();

    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measuring);
      observer?.disconnect();
      panels?.disconnect();
      ready.current(null);
      live.current = null;
      handle?.director.idle();
      handle?.audio.dispose();
      handle?.scene.dispose();
    };
  }, []);

  return (
    <div ref={stage} className="tower-stage" data-zone={zone} data-state={state}>
      <div className="tower-sky" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="tower-stars" aria-hidden="true" />
      <div className="tower-sun" aria-hidden="true" />
      {/* The picture takes the taps: a button laid over it keeps its own. */}
      <div
        ref={host}
        className="absolute inset-0"
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          e.preventDefault();
          onPress();
        }}
        // A finger lifted is the gesture a phone accepts to let a page make sound.
        onPointerUp={() => live.current?.audio.unlock()}
      />
      {state === "failed" && (
        <p className="absolute inset-x-6 top-1/3 mx-auto max-w-sm rounded-2xl bg-popover p-5 text-center text-sm leading-relaxed text-navy-800 shadow-pop">
          Ce navigateur n&apos;a pas pu afficher la scène en 3D. Les classements restent consultables ; pour jouer, essayez un autre
          navigateur ou un autre appareil.
        </p>
      )}
      {children}
    </div>
  );
}
