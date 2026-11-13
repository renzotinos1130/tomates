"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { RIPENESS, StatusTomato } from "@/components/kit/status-tomato";
import { useApp } from "@/lib/store";
import type { TaskStatus } from "@/lib/types";

/** How long the little scene lasts, before it is removed from the page. */
const RIPEN_MS = 1150;
/** Changing statuses in a row: no more than this many tomatoes at once. */
const MAX_AT_ONCE = 3;
/** The tomato is this many pixels wide: three screen pixels per pixel of the drawing. */
const SIZE = 48;
/** A gesture older than this did not cause the change: the tomato then appears low in the middle. */
const GESTURE_MS = 1500;

interface Ripening {
  id: number;
  x: number;
  y: number;
  from: TaskStatus;
  to: TaskStatus;
  /** What the tomato does: a happy jump when the work moves on, a shiver when it gets stuck, a small hop otherwise. */
  mood: "forward" | "stuck" | "back";
}

/** Where a few sparks fly to when the tomato lands in its new colour (px, from its centre). */
const SPARKS: [number, number][] = [
  [-30, -12],
  [-17, -30],
  [4, -36],
  [22, -26],
  [31, -8],
];

/** Where I last pressed, released or typed: that is where my eyes are when a status changes. */
const gesture = { x: 0, y: 0, at: 0 };
function watchGestures() {
  const point = (e: PointerEvent) => {
    gesture.x = e.clientX;
    gesture.y = e.clientY;
    gesture.at = performance.now();
  };
  const key = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body) return;
    const box = el.getBoundingClientRect();
    gesture.x = box.left + Math.min(box.width / 2, 120);
    gesture.y = box.top + box.height / 2;
    gesture.at = performance.now();
  };
  window.addEventListener("pointerdown", point, true);
  window.addEventListener("pointerup", point, true);
  window.addEventListener("keydown", key, true);
  return () => {
    window.removeEventListener("pointerdown", point, true);
    window.removeEventListener("pointerup", point, true);
    window.removeEventListener("keydown", key, true);
  };
}

/**
 * A tomato ripens where I change a status: it pops up in the colour of the
 * status the task leaves, jumps, and lands in the colour of the new one — green
 * to do, turning under way, orange in review, red when done. Moving on gets a
 * happy jump and a few sparks; getting blocked, a shiver. A second of it, small,
 * in nobody's way (it takes no click). Nothing for someone who asked for less
 * motion; what teammates change arrives quietly.
 */
export function TomatoRipen() {
  const [scenes, setScenes] = useState<Ripening[]>([]);

  useEffect(() => {
    const timers = new Set<number>();
    const unwatch = watchGestures();
    const unsubscribe = useApp.subscribe((state, before) => {
      const change = state.statusChanged;
      if (!change || change.n === before.statusChanged?.n) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const fresh = performance.now() - gesture.at < GESTURE_MS;
      // Above the pointer (a finger would hide it), and never cut by an edge of the screen.
      const x = Math.min(window.innerWidth - SIZE, Math.max(SIZE, fresh ? gesture.x : window.innerWidth / 2));
      const y = Math.min(window.innerHeight - SIZE, Math.max(SIZE * 1.6, (fresh ? gesture.y : window.innerHeight - 120) - 38));
      const mood = change.to === "blocked" ? "stuck" : RIPENESS[change.to] > RIPENESS[change.from] || change.from === "blocked" ? "forward" : "back";
      const scene: Ripening = { id: change.n, x, y, from: change.from, to: change.to, mood };
      setScenes((list) => [...list.slice(1 - MAX_AT_ONCE), scene]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setScenes((list) => list.filter((s) => s.id !== scene.id));
      }, RIPEN_MS);
      timers.add(timer);
    });
    return () => {
      unwatch();
      unsubscribe();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (scenes.length === 0) return null;
  return createPortal(
    <div className="tomato-ripen" aria-hidden="true">
      {scenes.map((s) => (
        <span key={s.id} className="ripen" data-mood={s.mood} data-from={s.from} data-to={s.to} style={{ left: s.x, top: s.y }}>
          <span className="ripen-body">
            <StatusTomato status={s.from} size={SIZE} className="ripen-from" />
            <StatusTomato status={s.to} size={SIZE} className="ripen-to" />
          </span>
          {s.mood === "forward" &&
            SPARKS.map(([dx, dy], i) => (
              <i key={i} className="ripen-spark" style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--i": i } as CSSProperties} />
            ))}
        </span>
      ))}
    </div>,
    document.body,
  );
}
