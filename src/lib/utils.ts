export { cn } from "cn";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (very old browsers) — RFC4122 v4-ish.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n > 1 || n === 0 ? (many ?? one + "s") : one}`;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position;
}

/** Fractional index between two neighbours (undefined = open end). */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1024;
  if (before === undefined) return (after as number) - 1024;
  if (after === undefined) return before + 1024;
  return (before + after) / 2;
}
