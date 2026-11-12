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
import { Section } from "./section";

function ProjectRow({ project }: { project: Project }) {
  const now = useNow();
  const tasks = useAllTasks();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);

  return (
    <li>
      <Link
        href={`/projets/${project.slug}`}
        className="block rounded-lg px-2.5 py-2.5 transition-colors hover:bg-navy-900/[0.035] focus-ring"
      >
        <div className="flex items-center gap-2">
          <ProjectIcon project={project} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy-900">{project.name}</span>
          <span className="text-[13px] text-navy-900 tabular">{stats.progress} %</span>
        </div>
        <ProgressLine
          className="mt-2.5"
          done={stats.done}
          total={stats.total}
          label={`${stats.done} tâches terminées sur ${stats.total}`}
        />
        <p className="mt-2 text-xs text-navy-500">
          {plural(stats.open, "ouverte")}
          {stats.byStatus.blocked > 0 && <> · {plural(stats.byStatus.blocked, "bloquée")}</>}
          {stats.overdue > 0 && <> · {stats.overdue} en retard</>}
        </p>
      </Link>
    </li>
  );
}

/** How far each project is. */
export function ProjectCards({ className, delay = 0 }: { className?: string; delay?: number }) {
  const projects = useProjects();
  return (
    <Section className={className} delay={delay} title="Projets">
      <ul className="-mx-2.5 space-y-1">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </ul>
    </Section>
  );
}
