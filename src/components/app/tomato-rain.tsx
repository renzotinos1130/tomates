"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { useApp } from "@/lib/store";

/** How long a shower lasts at most (latest start + slowest fall), before it is removed from the page. */
const SHOWER_MS = 2600;
/** Finishing tasks in a row: no more than this many showers at once. */
const MAX_SHOWERS = 3;

interface Drop {
  /** Horizontal position, in % of the width. */
  x: number;
  /** 20, 28 or 36 px: small ones look farther away, and fall slower. */
  size: number;
  delay: number;
  duration: number;
  /** Sideways travel over the fall, in px. */
  drift: number;
  /** Rotation over the fall, in degrees. */
  spin: number;
}

/**
 * One shower. The width is cut into as many slices as there are tomatoes and
 * each falls somewhere in its own slice: spread out, never in a clump.
 */
function shower(width: number): Drop[] {
  const count = Math.max(8, Math.min(18, Math.round(width / 85)));
  const between = (min: number, max: number) => min + Math.random() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    const size = [20, 28, 28, 36][Math.floor(Math.random() * 4)];
    return {
      x: ((i + between(0.15, 0.85)) / count) * 100,
      size,
      delay: between(0, 450),
      duration: between(1500, 2000) - size * 10,
      drift: between(-36, 36),
      spin: between(-150, 150),
    };
  });
}

/**
 * A light shower of the team's tomato each time I finish a task: a second and
 * a half of them falling across the screen, over everything, in nobody's way
 * (they take no click). Nothing falls for someone who asked for less motion.
 */
export function TomatoRain() {
  const [showers, setShowers] = useState<{ id: number; drops: Drop[] }[]>([]);

  useEffect(() => {
    const timers = new Set<number>();
    const unsubscribe = useApp.subscribe((state, before) => {
      if (state.tasksFinished <= before.tasksFinished) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const id = state.tasksFinished;
      setShowers((list) => [...list.slice(1 - MAX_SHOWERS), { id, drops: shower(window.innerWidth) }]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setShowers((list) => list.filter((s) => s.id !== id));
      }, SHOWER_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (showers.length === 0) return null;
  return createPortal(
    <div className="tomato-rain" aria-hidden="true">
      {showers.map((s) =>
        s.drops.map((d, i) => (
          <span
            key={`${s.id}-${i}`}
            className="tomato-drop"
            style={
              {
                left: `${d.x}%`,
                "--fall": `${d.duration}ms`,
                "--wait": `${d.delay}ms`,
                "--drift": `${d.drift}px`,
                "--spin": `${d.spin}deg`,
              } as CSSProperties
            }
          >
            <PixelTomato size={d.size} decorative />
          </span>
        )),
      )}
    </div>,
    document.body,
  );
}
