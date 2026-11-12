"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { capitalize, formatDayDate, formatShortDate, parseDateOnly, WEEK_START_DAY } from "@/lib/dates";
import type { FlowPoint } from "@/lib/selectors";
import { cn } from "@/lib/utils";

/** Plot height, and the room kept around it (the right margin holds the end values). */
const HEIGHT = 132;
const PAD = { top: 10, right: 30, bottom: 6, left: 2 };

/** Finished is the point of the chart; created is the context it is read against. */
const DONE = "var(--color-teal-500)";
const CREATED = "var(--color-navy-400)";

/** Smallest "clean" axis top at or above the data: twice a round step. */
function axisTop(max: number): number {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (step * 2 >= max) return step * 2;
  return Math.ceil(max / 1000) * 1000;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fires once on observe, then on every resize.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Tasks created against tasks finished, cumulative, one point per day. Two
 * thin lines on one axis; the gap between them is the open work. Hover, tap
 * or focus and use the arrow keys to read any day; the same figures are in a
 * table for screen readers.
 */
export function FlowChart({ points, className }: { points: FlowPoint[]; className?: string }) {
  const id = useId();
  const [plot, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const last = points.length - 1;
  const top = useMemo(() => axisTop(Math.max(1, ...points.map((p) => p.created))), [points]);
  const ticks = useMemo(
    () => points.map((p, i) => ({ i, date: p.date })).filter((t) => parseDateOnly(t.date).getDay() === WEEK_START_DAY),
    [points],
  );

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (last > 0 ? (i / last) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + (1 - v / top) * innerH;
  const line = (key: "created" | "done") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const baseline = y(0);

  const end = points[last];
  if (!end) return null;
  // End values sit beside their line; when the two lines finish too close, only the upper one is labelled.
  const apart = Math.abs(y(end.created) - y(end.done)) >= 13;
  const shown = active !== null ? (points[active] ?? null) : null;

  const pick = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || last < 1 || innerW <= 0) return;
    const ratio = (clientX - box.left - PAD.left) / innerW;
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  return (
    <div className={cn("relative", className)}>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-600">
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-3 rounded-full" style={{ background: DONE }} />
          Terminées
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-3 rounded-full" style={{ background: CREATED }} />
          Créées
        </span>
        <span className="ml-auto text-navy-500">Cumul sur 5 semaines</span>
      </div>

      <div className="relative pl-7">
        {/* Axis values: they carry what is not labelled on the lines. */}
        <div
          aria-hidden="true"
          className="absolute left-0 flex flex-col justify-between text-right text-[10px] leading-none text-navy-500 tabular"
          style={{ top: PAD.top - 5, height: innerH + 10, width: 20 }}
        >
          <span>{top}</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>

        <div
          ref={plot}
          role="group"
          tabIndex={0}
          aria-label={`Tâches créées et terminées, cumul sur 5 semaines. Aujourd'hui : ${end.created} créées, ${end.done} terminées. Flèches gauche et droite pour lire un autre jour.`}
          aria-describedby={`${id}-table`}
          // touch-pan-y: a finger scrubs the chart sideways and still scrolls the page vertically.
          className="relative touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
          style={{ height: HEIGHT }}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => pick(e.clientX)}
          // A mouse reads on hover and lets go on leave; a finger's choice stays until it taps elsewhere.
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
          onFocus={() => setActive((a) => a ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -last, End: last };
            if (e.key === "Escape") return setActive(null);
            if (!(e.key in move)) return;
            e.preventDefault();
            setActive((a) => Math.min(last, Math.max(0, (a ?? last) + move[e.key])));
          }}
        >
          {width > 0 && (
            <svg width={width} height={HEIGHT} aria-hidden="true" className="block overflow-visible">
              <defs>
                <linearGradient id={`${id}-wash`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={DONE} stopOpacity="0.2" />
                  <stop offset="1" stopColor={DONE} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[top, top / 2, 0].map((v) => (
                <path key={v} d={`M${PAD.left} ${y(v)} H${PAD.left + innerW}`} stroke="currentColor" strokeOpacity="0.1" />
              ))}
              <path d={`${line("done")} L${x(last)} ${baseline} L${x(0)} ${baseline} Z`} fill={`url(#${id}-wash)`} />
              <path d={line("created")} fill="none" stroke={CREATED} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <path d={line("done")} fill="none" stroke={DONE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

              {shown && active !== null && (
                <path d={`M${x(active)} ${PAD.top - 4} V${baseline}`} stroke="currentColor" strokeOpacity="0.28" />
              )}
              {/* A dot at the end of each line, or on the day being read. */}
              {(["created", "done"] as const).map((key) => {
                const at = active ?? last;
                return (
                  <circle
                    key={key}
                    cx={x(at)}
                    cy={y(points[at][key])}
                    r="4"
                    fill={key === "done" ? DONE : CREATED}
                    stroke="#ffffff"
                    strokeOpacity="0.92"
                    strokeWidth="2"
                  />
                );
              })}
              {active === null && (
                <g className="fill-navy-900 text-[11px] font-medium tabular">
                  <text x={x(last) + 9} y={y(end.created) + 4}>
                    {end.created}
                  </text>
                  {apart && (
                    <text x={x(last) + 9} y={y(end.done) + 4}>
                      {end.done}
                    </text>
                  )}
                </g>
              )}
            </svg>
          )}

          {shown && active !== null && width > 0 && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[132px] rounded-[10px] bg-paper-50/95 px-2.5 py-2 text-xs whitespace-nowrap text-navy-600 shadow-pop"
              style={x(active) > width / 2 ? { right: width - x(active) + 12 } : { left: x(active) + 12 }}
            >
              <div className="mb-1 text-[11px] text-navy-500">{capitalize(formatDayDate(parseDateOnly(shown.date)))}</div>
              <div className="flex items-center gap-1.5">
                <i className="h-0.5 w-2.5 rounded-full" style={{ background: DONE }} />
                <strong className="font-semibold text-navy-900 tabular">{shown.done}</strong>
                {shown.done >= 2 ? "terminées" : "terminée"}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <i className="h-0.5 w-2.5 rounded-full" style={{ background: CREATED }} />
                <strong className="font-semibold text-navy-900 tabular">{shown.created}</strong>
                {shown.created >= 2 ? "créées" : "créée"}
              </div>
            </div>
          )}
        </div>

        {/* One tick per meeting day. */}
        <div aria-hidden="true" className="relative mt-1.5 h-4 text-[10px] leading-4 text-navy-500">
          {width > 0 &&
            ticks.map((t) => (
              <span
                key={t.date}
                className="absolute whitespace-nowrap"
                style={{
                  left: x(t.i),
                  transform: t.i === 0 ? "none" : t.i === last ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {formatShortDate(parseDateOnly(t.date))}
              </span>
            ))}
        </div>
      </div>

      <table id={`${id}-table`} className="sr-only">
        <caption>Tâches créées et terminées, cumul par semaine</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Créées</th>
            <th scope="col">Terminées</th>
          </tr>
        </thead>
        <tbody>
          {[...ticks.map((t) => t.i).filter((i) => i !== last), last].map((i) => (
            <tr key={points[i].date}>
              <th scope="row">{formatShortDate(parseDateOnly(points[i].date))}</th>
              <td>{points[i].created}</td>
              <td>{points[i].done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
