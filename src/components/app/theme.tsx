"use client";

import { useEffect } from "react";
import { useLocalState, useNow } from "@/lib/hooks";
import { normalizeThemeChoice, resolveTheme, THEME_COLOR, THEME_DEFAULT, THEME_KEY, type Theme, type ThemeChoice } from "@/lib/theme";

/** What the member chose (« Clair », « Soir », « Automatique ») and a setter. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [raw, setRaw] = useLocalState<string>(THEME_KEY, THEME_DEFAULT);
  return [normalizeThemeChoice(raw), setRaw];
}

/** The theme on screen right now. « Automatique » follows the clock (looked at again every 30 s). */
export function useTheme(): Theme {
  const [choice] = useThemeChoice();
  return resolveTheme(choice, useNow());
}

/** Keeps <html data-theme> (and the browser's own colour) in step with the choice and the clock. */
export function ThemeSync() {
  const theme = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "night") root.setAttribute("data-theme", "night");
    else root.removeAttribute("data-theme");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  }, [theme]);
  return null;
}
