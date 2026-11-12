"use client";

import { useEffect, useRef } from "react";

/**
 * For a `.gw-fit` list: it shows the rows that fit its height, whole rows only
 * (the others wrap into a column that is clipped). CSS decides what fits; this
 * takes the rows that are not on screen out of the tab order and out of the
 * accessibility tree, so the keyboard and a screen reader get what the eye gets.
 */
export function useFitRows<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => {
      const rows = Array.from(el.children) as HTMLElement[];
      const first = rows[0]?.offsetLeft ?? 0;
      for (const row of rows) row.inert = row.offsetLeft > first + 1;
    };
    mark();
    const resize = new ResizeObserver(mark);
    resize.observe(el);
    // Rows come and go with the data, and change height when their text wraps.
    const content = new MutationObserver(mark);
    content.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      resize.disconnect();
      content.disconnect();
    };
  }, []);

  return ref;
}
