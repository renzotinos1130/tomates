"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StatusBlocks } from "@/components/kit/blocks";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { DueLabel } from "@/components/kit/pills";
import { ProjectIcon } from "@/components/kit/project-icon";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMembersMap, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import { ui } from "@/lib/store";
import type { Project } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Tile } from "./bento";

function ProjectCard({ project, delay }: { project: Project; delay: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const members = useMembersMap();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);

  return (
    <Tile delay={delay} className="card-interactive relative flex flex-col p-5">
      <div className="flex items-baseline gap-3">
        <Link
          href={`/projets/${project.slug}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-navy-900 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-teal-500/50"
        >
          <ProjectIcon project={project} size="xs" />
          <span className="truncate">{project.name}</span>
        </Link>
        <div className="shrink-0 text-xl leading-none font-semibold tracking-tight text-navy-900 tabular">
          {stats.progress}
          <span className="ml-0.5 text-[13px] font-medium text-navy-500">%</span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {plural(stats.open, "tâche ouverte", "tâches ouvertes")}
        {stats.byStatus.blocked > 0 && <span className="text-coral-600"> · {plural(stats.byStatus.blocked, "bloquée")}</span>}
        {stats.overdue > 0 && <span className="text-coral-600"> · {stats.overdue} en retard</span>}
      </p>

      {/* One block per task, coloured by status: progress you can count. */}
      <div className="mt-3.5 flex items-center gap-3">
        <StatusBlocks byStatus={stats.byStatus} className="min-w-0 flex-1" />
        <span className="shrink-0 text-[11px] text-navy-400 tabular">
          {stats.done} sur {stats.total}
        </span>
      </div>

      <div className="mt-4 border-t border-navy-900/[0.06] pt-3">
        <div className="mb-1 text-xs font-medium text-navy-500">Prochaines échéances</div>
        {stats.upcoming.length === 0 ? (
          <p className="py-1.5 text-xs text-muted-foreground">Aucune échéance à venir.</p>
        ) : (
          <ul className="relative z-10 -mx-1.5">
            {stats.upcoming.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => ui.openTask(t.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-navy-900/[0.04] focus-ring"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-navy-800">{t.title}</span>
                  <DueLabel date={t.due_date} now={now} />
                  <MemberAvatar member={t.assignee_id ? members[t.assignee_id] : null} size="xs" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Tile>
  );
}

export function ProjectCards({ delay = 0 }: { delay?: number }) {
  const projects = useProjects();
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((p, i) => (
        <ProjectCard key={p.id} project={p} delay={delay + i * 50} />
      ))}
    </div>
  );
}
