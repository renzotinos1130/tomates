"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** The first count, when the tile comes in, and the shorter one when the figure changes. */
const ARRIVE_MS = 900;
const CHANGE_MS = 380;

/**
 * Counts up to `value`: from zero the first time, as the tile that holds it
 * comes in, then from the figure on screen whenever the value changes. The
 * markup always holds the real number; only what is painted moves, and nothing
 * moves for someone who asked for less motion.
 */
export function useCountUp<T extends HTMLElement>(value: number) {
  const ref = useRef<T | null>(null);
  /** The number painted right now, and whether the first count has begun. */
  const shown = useRef(0);
  const begun = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = (n: number) => {
      shown.current = n;
      // The text node React wrote is kept: only its value changes.
      if (el.firstChild) el.firstChild.nodeValue = String(n);
      else el.textContent = String(n);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      begun.current = true;
      paint(value);
      return;
    }

    let frame = 0;
    const count = (duration: number) => {
      const from = shown.current;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        paint(Math.round(from + (value - from) * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      paint(from);
      if (from !== value) frame = requestAnimationFrame(step);
    };

    if (begun.current) {
      count(CHANGE_MS);
      return () => cancelAnimationFrame(frame);
    }

    // First time: zero until the tile starts its entrance (it waits under the preloader).
    paint(0);
    const begin = () => {
      begun.current = true;
      count(ARRIVE_MS);
    };
    const tile = el.closest<HTMLElement>(".gw-reveal");
    const entrance = tile?.getAnimations().find((a) => a instanceof CSSAnimation && a.animationName === "gw-reveal");
    const delay = Number(entrance?.effect?.getTiming().delay ?? 0);
    const waiting = !!entrance && entrance.playState !== "finished" && Number(entrance.currentTime ?? 0) < delay;
    if (!tile || !waiting) {
      begin();
      return () => cancelAnimationFrame(frame);
    }
    const onStart = (e: AnimationEvent) => {
      if (e.target !== tile || e.animationName !== "gw-reveal") return;
      tile.removeEventListener("animationstart", onStart);
      begin();
    };
    tile.addEventListener("animationstart", onStart);
    return () => {
      tile.removeEventListener("animationstart", onStart);
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return ref;
}

/**
 * The large figure a tile leads with. One per tile: it is what the eye lands
 * on, and the label beside it says what is counted.
 */
export function Figure({ value, className }: { value: number; className?: string }) {
  const ref = useCountUp<HTMLSpanElement>(value);
  return (
    <span ref={ref} className={cn("gw-figure", className)}>
      {value}
    </span>
  );
}
