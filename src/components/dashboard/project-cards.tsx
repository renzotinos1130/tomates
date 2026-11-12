"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { ProjectIcon } from "@/components/kit/project-icon";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { Panel } from "./panel";

const RADIUS = 21;
const LENGTH = 2 * Math.PI * RADIUS;

/** How far a project is, as a ring: the arc is the share of its tasks that are finished. */
function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="block shrink-0"
    >
      <svg width="54" height="54" viewBox="0 0 54 54" fill="none" aria-hidden="true">
        <circle cx="27" cy="27" r={RADIUS} strokeWidth="6" className="stroke-teal-500/[0.2]" />
        {ratio > 0 && (
          <circle
            cx="27"
            cy="27"
            r={RADIUS}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH * (1 - ratio)}
            transform="rotate(-90 27 27)"
            className="ring-arc stroke-teal-500"
            style={{ "--ring": LENGTH } as CSSProperties}
          />
        )}
      </svg>
    </span>
  );
}

/** One project, one tile: where it stands, and a click away. */
function ProjectTile({ project, delay }: { project: Project; delay: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);

  return (
    <Link
      href={`/projets/${project.slug}`}
      className="gw-panel gw-reveal group/project @container/panel flex min-w-0 flex-col focus-ring"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-[9px]">
        <span className="gw-chip size-[30px] rounded-[9px] transition-colors group-hover/project:bg-white/70">
          <ProjectIcon project={project} size="xs" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{project.name}</h3>
      </div>
      <div className="mt-3 mb-2.5 flex flex-1 items-end justify-between gap-3">
        <p className="flex items-baseline gap-1">
          <Figure value={stats.progress} className="project-figure" />
          <span className="text-[15px] font-medium text-navy-600">%</span>
        </p>
        <ProgressRing done={stats.done} total={stats.total} label={`${stats.done} tâches terminées sur ${stats.total}`} />
      </div>
      <p className="flex justify-between gap-3 text-xs text-navy-600">
        <span className="truncate">
          {plural(stats.open, "ouverte")}
          {stats.byStatus.blocked > 0 && <> · {plural(stats.byStatus.blocked, "bloquée")}</>}
          {stats.overdue > 0 && <> · {stats.overdue} en retard</>}
        </span>
        <span className="shrink-0 tabular">
          <span className="font-medium text-navy-900">{stats.done}</span> sur {stats.total}
        </span>
      </p>
    </Link>
  );
}

/**
 * How far each project is: a row of equal tiles, each with its percentage and
 * its ring. They wrap when the window is narrow.
 */
export function ProjectCards({ className, delay = 0 }: { className?: string; delay?: number }) {
  const projects = useProjects();
  if (projects.length === 0) {
    return (
      <Panel className={className} delay={delay} title="Projets">
        <p className="py-2 text-[13px] text-navy-600">Aucun projet pour l&apos;instant.</p>
      </Panel>
    );
  }
  return (
    <section aria-labelledby="dashboard-projects" className={cn("dash-projects", className)}>
      <h2 id="dashboard-projects" className="sr-only">
        Projets
      </h2>
      {projects.map((p, i) => (
        <ProjectTile key={p.id} project={p} delay={delay + i * 45} />
      ))}
    </section>
  );
}
