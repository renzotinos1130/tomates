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

const SIZES = { xs: 15, sm: 16, md: 18, lg: 20 } as const;

/** A project's mark: its icon, drawn in its colour. No tile behind it. */
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
  return (
    <Icon
      size={SIZES[size]}
      strokeWidth={1.9}
      aria-hidden="true"
      className={cn("shrink-0", COLOR_META[project.color]?.ink ?? COLOR_META.slate.ink, className)}
    />
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
