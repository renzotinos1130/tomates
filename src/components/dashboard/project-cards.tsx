"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProgressLine } from "@/components/kit/progress";
import { ProjectIcon } from "@/components/kit/project-icon";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Panel } from "./panel";

function ProjectRow({ project }: { project: Project }) {
  const now = useNow();
  const tasks = useAllTasks();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);

  return (
    <li>
      <Link href={`/projets/${project.slug}`} className="group/project block rounded-xl focus-ring">
        <div className="flex items-center gap-[9px]">
          <span className="gw-chip size-[30px] rounded-[9px] transition-colors group-hover/project:bg-white/70">
            <ProjectIcon project={project} size="xs" />
          </span>
          <strong className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{project.name}</strong>
          <span className="text-xs text-navy-600 tabular">{stats.progress} %</span>
        </div>
        <ProgressLine
          className="mt-[11px] mb-1.5"
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
    </li>
  );
}

/** How far each project is. */
export function ProjectCards({ className, delay = 0 }: { className?: string; delay?: number }) {
  const projects = useProjects();
  return (
    <Panel
      className={className}
      delay={delay}
      title="Projets"
      aside={projects.length > 0 ? <span>{plural(projects.length, "actif")}</span> : undefined}
    >
      {projects.length === 0 ? (
        <p className="py-2 text-[13px] text-navy-600">Aucun projet pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-[22px]">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
