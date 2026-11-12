"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProgressLine } from "@/components/kit/progress";
import { ProjectIcon } from "@/components/kit/project-icon";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Panel } from "./panel";

/** One project, one tile: where it stands, and a click away. */
function ProjectTile({ project, delay }: { project: Project; delay: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);

  return (
    <Link
      href={`/projets/${project.slug}`}
      className="gw-panel gw-reveal group/project min-w-[min(100%,240px)] flex-1 basis-[240px] focus-ring"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-[9px]">
        <span className="gw-chip size-[30px] rounded-[9px] transition-colors group-hover/project:bg-white/70">
          <ProjectIcon project={project} size="xs" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{project.name}</h3>
        <span className="text-xs text-navy-600 tabular">{stats.progress} %</span>
      </div>
      <ProgressLine
        className="mt-[13px] mb-2"
        tone="accent"
        done={stats.done}
        total={stats.total}
        label={`${stats.done} tâches terminées sur ${stats.total}`}
      />
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
 * How far each project is: a row of equal tiles. They wrap when the window is
 * narrow, and the last row always fills the width.
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
    <section aria-labelledby="dashboard-projects" className={cn("flex flex-wrap gap-3 @3xl/dash:gap-4", className)}>
      <h2 id="dashboard-projects" className="sr-only">
        Projets
      </h2>
      {projects.map((p, i) => (
        <ProjectTile key={p.id} project={p} delay={delay + i * 45} />
      ))}
    </section>
  );
}
