import type { MemberColor, ProjectIcon, TaskPriority, TaskStatus } from "./types";

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

export const STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"];

export interface StatusMeta {
  label: string;
  /** Short verb-ish description used in tooltips / empty states. */
  hint: string;
  /** Solid colour (icons, dots, progress). */
  solid: string;
  /** Colour of the label next to the status glyph. */
  text: string;
  /** Left accent for table groups / kanban column header. */
  accent: string;
  /** Raw CSS colour, for SVG strokes and inline bars. */
  hex: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    label: "À faire",
    hint: "Pas encore commencée",
    solid: "text-navy-300",
    text: "text-navy-600",
    accent: "bg-navy-300",
    hex: "#A2AEC9",
  },
  in_progress: {
    label: "En cours",
    hint: "Quelqu'un est dessus",
    solid: "text-teal-500",
    text: "text-navy-800",
    accent: "bg-teal-500",
    hex: "#12948C",
  },
  review: {
    label: "En validation",
    hint: "À valider ensemble",
    solid: "text-sun-500",
    text: "text-navy-800",
    accent: "bg-sun-400",
    hex: "#E89B17",
  },
  blocked: {
    label: "Bloqué",
    hint: "Besoin d'aide pour avancer",
    solid: "text-coral-500",
    text: "text-coral-700",
    accent: "bg-coral-500",
    hex: "#E2553F",
  },
  done: {
    label: "Terminé",
    hint: "C'est fait",
    solid: "text-leaf-500",
    text: "text-navy-500",
    accent: "bg-leaf-500",
    hex: "#2E9C5F",
  },
};

/* ------------------------------------------------------------------ */
/* Priorités                                                           */
/* ------------------------------------------------------------------ */

export const PRIORITIES: TaskPriority[] = ["high", "normal", "low"];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; bars: number; color: string; rank: number }
> = {
  high: {
    label: "Haute",
    bars: 3,
    color: "text-coral-500",
    rank: 0,
  },
  normal: {
    label: "Normale",
    bars: 2,
    color: "text-navy-500",
    rank: 1,
  },
  low: {
    label: "Basse",
    bars: 1,
    color: "text-navy-300",
    rank: 2,
  },
};

/* ------------------------------------------------------------------ */
/* Couleurs d'identification (membres & projets)                       */
/* ------------------------------------------------------------------ */

export const MEMBER_COLORS: MemberColor[] = [
  "teal",
  "amber",
  "indigo",
  "rose",
  "violet",
  "sky",
  "emerald",
  "orange",
  "slate",
];

export const COLOR_META: Record<
  MemberColor,
  { label: string; soft: string; solid: string; ring: string; hex: string; tile: string }
> = {
  teal: {
    label: "Sarcelle",
    soft: "bg-teal-100 text-teal-800",
    solid: "bg-teal-500",
    ring: "ring-teal-500/30",
    hex: "#12948C",
    tile: "bg-teal-50 text-teal-600 ring-teal-100",
  },
  amber: {
    label: "Soleil",
    soft: "bg-sun-100 text-sun-800",
    solid: "bg-sun-400",
    ring: "ring-sun-400/40",
    hex: "#F4B331",
    tile: "bg-sun-50 text-sun-600 ring-sun-100",
  },
  indigo: {
    label: "Indigo",
    soft: "bg-indigo-100 text-indigo-700",
    solid: "bg-indigo-500",
    ring: "ring-indigo-500/30",
    hex: "#6366F1",
    tile: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
  rose: {
    label: "Rose",
    soft: "bg-rose-100 text-rose-700",
    solid: "bg-rose-500",
    ring: "ring-rose-500/30",
    hex: "#F43F5E",
    tile: "bg-rose-50 text-rose-600 ring-rose-100",
  },
  violet: {
    label: "Violet",
    soft: "bg-violet-100 text-violet-700",
    solid: "bg-violet-500",
    ring: "ring-violet-500/30",
    hex: "#8B5CF6",
    tile: "bg-violet-50 text-violet-600 ring-violet-100",
  },
  sky: {
    label: "Ciel",
    soft: "bg-sky-100 text-sky-700",
    solid: "bg-sky-500",
    ring: "ring-sky-500/30",
    hex: "#0EA5E9",
    tile: "bg-sky-50 text-sky-600 ring-sky-100",
  },
  emerald: {
    label: "Émeraude",
    soft: "bg-emerald-100 text-emerald-700",
    solid: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    hex: "#10B981",
    tile: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  orange: {
    label: "Orange",
    soft: "bg-orange-100 text-orange-700",
    solid: "bg-orange-500",
    ring: "ring-orange-500/30",
    hex: "#F97316",
    tile: "bg-orange-50 text-orange-600 ring-orange-100",
  },
  slate: {
    label: "Ardoise",
    soft: "bg-navy-100 text-navy-700",
    solid: "bg-navy-500",
    ring: "ring-navy-500/30",
    hex: "#4F6391",
    tile: "bg-navy-50 text-navy-600 ring-navy-100",
  },
};

export const PROJECT_ICONS: ProjectIcon[] = [
  "smartphone",
  "globe",
  "megaphone",
  "rocket",
  "palette",
  "chart",
  "users",
  "book",
  "folder",
];

export const APP_NAME = "Team Tomate HQ";
