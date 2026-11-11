"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { DueLabel } from "@/components/kit/pills";
import { ProjectIcon } from "@/components/kit/project-icon";
import { STATUS_META, STATUSES } from "@/lib/constants";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMembersMap, useNow, useProjects } from "@/lib/hooks";
import { projectStats } from "@/lib/selectors";
import { ui } from "@/lib/store";
import type { Project, TaskStatus } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Tile } from "./bento";

const BAR_ORDER: TaskStatus[] = ["done", "review", "in_progress", "blocked", "todo"];

/** Thin stacked bar: how a project's tasks are distributed across statuses. */
export function StatusBar({ byStatus, total }: { byStatus: Record<TaskStatus, number>; total: number }) {
  if (total === 0) return <div className="h-1.5 rounded-full bg-navy-100" />;
  return (
    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Répartition par statut">
      {BAR_ORDER.filter((s) => byStatus[s] > 0).map((s) => (
        <div
          key={s}
          title={`${STATUS_META[s].label} : ${byStatus[s]}`}
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${(byStatus[s] / total) * 100}%`,
            background: s === "todo" ? "var(--color-navy-100)" : STATUS_META[s].hex,
          }}
        />
      ))}
    </div>
  );
}

function ProjectCard({ project, delay }: { project: Project; delay: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const members = useMembersMap();
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);
  const barTotal = STATUSES.reduce((n, s) => n + stats.byStatus[s], 0);

  return (
    <Tile delay={delay} className="card-interactive group/card relative flex flex-col p-5">
      <div className="flex items-center gap-3">
        <ProjectIcon project={project} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/projets/${project.slug}`}
            className="inline-flex max-w-full items-center gap-1 text-[14px] font-semibold text-navy-900 after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-teal-500/50"
          >
            <span className="truncate">{project.name}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-navy-300 transition-all group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 group-hover/card:text-teal-600" />
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {plural(stats.open, "tâche ouverte", "tâches ouvertes")}
            {stats.byStatus.blocked > 0 && (
              <span className="text-coral-600"> · {plural(stats.byStatus.blocked, "bloquée")}</span>
            )}
            {stats.overdue > 0 && <span className="text-coral-600"> · {stats.overdue} en retard</span>}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl leading-none font-semibold tracking-tight text-navy-900">{stats.progress}%</div>
          <div className="mt-1 text-[10.5px] text-navy-400">
            {stats.done}/{stats.total}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <StatusBar byStatus={stats.byStatus} total={barTotal} />
      </div>

      <div className="mt-4 border-t border-navy-900/[0.06] pt-3">
        <div className="mb-1.5 text-[11px] font-medium tracking-wide text-navy-400 uppercase">Prochaines échéances</div>
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
                  <DueLabel date={t.due_date} now={now} icon={false} />
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
