import {
  BarChart3,
  BookOpen,
  Folder,
  Globe,
  Megaphone,
  Palette,
  Rocket,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { COLOR_META } from "@/lib/constants";
import type { Project, ProjectIcon as IconName } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PROJECT_ICON_MAP: Record<IconName, LucideIcon> = {
  smartphone: Smartphone,
  globe: Globe,
  megaphone: Megaphone,
  folder: Folder,
  palette: Palette,
  rocket: Rocket,
  chart: BarChart3,
  users: Users,
  book: BookOpen,
};

const SIZES = {
  xs: { box: "size-5 rounded-md", icon: 12 },
  sm: { box: "size-6 rounded-md", icon: 14 },
  md: { box: "size-8 rounded-lg", icon: 16 },
  lg: { box: "size-10 rounded-xl", icon: 20 },
} as const;

export function ProjectIcon({
  project,
  size = "sm",
  className,
}: {
  project: Pick<Project, "icon" | "color">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = PROJECT_ICON_MAP[project.icon] ?? Folder;
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 ring-inset",
        s.box,
        COLOR_META[project.color]?.tile ?? COLOR_META.slate.tile,
        className,
      )}
    >
      <Icon size={s.icon} strokeWidth={2} />
    </span>
  );
}

/** Small coloured dot + name — used wherever a task shows its project. */
export function ProjectChip({ project, className }: { project: Project | undefined; className?: string }) {
  if (!project) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-[1px]", COLOR_META[project.color]?.solid)} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}
