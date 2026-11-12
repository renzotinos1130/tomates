"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProjectIcon } from "@/components/kit/project-icon";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";

/** One project: its percentage, large, over a bar, and what is left under it. A click opens it. */
function ProjectColumn({ project }: { project: Project }) {
  const now = useNow();
  const tasks = useAllTasks();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);
  const ratio = stats.total > 0 ? Math.min(1, Math.max(0, stats.done / stats.total)) : 0;

  return (
    <Link href={`/projets/${project.slug}`} className="group/project project-col focus-ring">
      <div className="flex min-w-0 items-center gap-2">
        <ProjectIcon project={project} size="sm" />
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{project.name}</h3>
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <Figure value={stats.progress} className="project-figure" />
        <span className="text-lg font-medium text-navy-600">%</span>
        {/* What the percentage is made of, above the end of the bar. */}
        <span className="ml-auto shrink-0 pl-2 text-xs text-navy-600 tabular">
          <span className="font-medium text-navy-900">{stats.done}</span> sur {stats.total}
        </span>
      </p>
      <span
        role="progressbar"
        aria-label={`${stats.done} tâches terminées sur ${stats.total}`}
        aria-valuemin={0}
        aria-valuemax={stats.total}
        aria-valuenow={stats.done}
        className="project-bar"
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      {/* What is left, and what is in its way. On a narrow column the line wraps; nothing is cut. */}
      <p className="dot-list text-xs leading-5 text-navy-600">
        <span>{plural(stats.open, "ouverte")}</span>
        {stats.byStatus.blocked > 0 && <span>{plural(stats.byStatus.blocked, "bloquée")}</span>}
        {stats.overdue > 0 && <span>{stats.overdue} en retard</span>}
      </p>
    </Link>
  );
}

/**
 * How far each project is: one sheet, a column per project, each led by its
 * percentage. Side by side, the three bars compare at a glance.
 */
export function ProjectCards({ className, delay = 0 }: { className?: string; delay?: number }) {
  const projects = useProjects();
  return (
    <section
      className={cn("gw-panel gw-reveal @container/panel flex flex-col", className)}
      style={{ animationDelay: `${delay}ms` }}
      aria-labelledby="dashboard-projects"
    >
      <header className="gw-panel-title">
        <h2 id="dashboard-projects" className="gw-panel-label">
          Projets
        </h2>
      </header>
      {projects.length === 0 ? (
        <p className="py-2 text-[13px] text-navy-600">Aucun projet pour l&apos;instant.</p>
      ) : (
        <div className="project-cols">
          {projects.map((p) => (
            <ProjectColumn key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}
