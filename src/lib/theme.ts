/**
 * Day and evening. « Clair » is the app on its picture, under glass; « Soir » is
 * the same app with the picture put away: matte ink, no glass. Like the glass
 * settings, a personal choice kept in the browser.
 *
 * The theme is one attribute on <html> (`data-theme="night"`); everything else
 * is CSS (see « Le soir » in globals.css). It is set before the first paint by
 * a small inline script (components/app/theme.tsx), then kept up to date here.
 */
export type ThemeChoice = "day" | "night" | "auto";
export type Theme = "day" | "night";

export const THEME_KEY = "tthq:theme";
export const THEME_DEFAULT: ThemeChoice = "day";

/** « Automatique »: the evening starts at 19 h and ends at 6 h, on the clock of the device. */
export const EVENING_STARTS = 19;
export const EVENING_ENDS = 6;

export function isEvening(at: Date): boolean {
  const hour = at.getHours();
  return hour >= EVENING_STARTS || hour < EVENING_ENDS;
}

export function resolveTheme(choice: ThemeChoice, at: Date): Theme {
  if (choice === "auto") return isEvening(at) ? "night" : "day";
  return choice;
}

export function normalizeThemeChoice(value: unknown): ThemeChoice {
  return value === "night" || value === "auto" || value === "day" ? value : THEME_DEFAULT;
}

/** What the browser's own surfaces (address bar on a phone) take: the canvas of each theme. */
export const THEME_COLOR: Record<Theme, string> = { day: "#f6f5f1", night: "#0a1222" };

/**
 * The same decision as `resolveTheme`, as text, for the script that runs before
 * React: the first paint is already in the right theme. Kept next to the rule it
 * repeats, and compared to it in the tests.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)})||'"${THEME_DEFAULT}"');var h=new Date().getHours();if(c==="night"||(c==="auto"&&(h>=${EVENING_STARTS}||h<${EVENING_ENDS})))document.documentElement.setAttribute("data-theme","night")}catch(e){}})()`;
