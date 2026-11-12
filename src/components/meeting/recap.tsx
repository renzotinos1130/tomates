"use client";

import { ClipboardCopy, Gavel, MessagesSquare, Plus, Star } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { DueLabel } from "@/components/kit/pills";
import { StatusIcon } from "@/components/kit/status-icon";
import { Button } from "@/components/ui/button";
import { COLOR_META } from "@/lib/constants";
import { formatLongDate, parseDateOnly } from "@/lib/dates";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { summaryToText } from "@/lib/selectors";
import { ui, useApp } from "@/lib/store";
import type { Meeting, MeetingSummary, SummaryTask } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One part of the minutes. Sections share a single sheet and are separated by hairlines. */
function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="px-3 py-3.5 sm:px-4">
      <header className="mb-1 flex items-center gap-2 px-1.5">
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
        <h3 className="text-[13px] font-semibold text-navy-900">{title}</h3>
        <span className="text-xs text-navy-400 tabular">{count}</span>
      </header>
      {children}
    </section>
  );
}

function Row({ task, showAssignee = true, done = false }: { task: SummaryTask; showAssignee?: boolean; done?: boolean }) {
  const now = useNow();
  const members = useMembersMap();
  const projects = useProjectsMap();
  const exists = useApp((s) => !!s.tasks[task.id]);
  const project = projects[task.project_id];
  const member = task.assignee_id ? members[task.assignee_id] : null;
  return (
    <li>
      <button
        type="button"
        disabled={!exists}
        onClick={() => ui.openTask(task.id)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-navy-900/[0.035] focus-ring"
      >
        <span className={cn("min-w-0 flex-1 truncate text-[13px]", done ? "text-navy-600" : "font-medium text-navy-900")}>
          {task.title}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-navy-400 sm:inline-flex">
          <span className={cn("size-1.5 rounded-[1px]", project ? COLOR_META[project.color]?.solid : "bg-navy-200")} />
          {task.project_name}
        </span>
        {!done && task.due_date && <DueLabel date={task.due_date} now={now} icon={false} className="shrink-0" />}
        {showAssignee && <MemberAvatar member={member} size="xs" tooltip />}
      </button>
    </li>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-2 py-2 text-xs text-navy-400">{children}</p>;

/**
 * "Après le meeting": what was accomplished, who does what next, what was
 * decided. Rendered from the frozen summary, so history never changes.
 */
export function Recap({
  meeting,
  summary,
  actions,
  showOpenTopics = true,
}: {
  meeting: Meeting;
  summary: MeetingSummary;
  actions?: React.ReactNode;
  /** Off where the next meeting's agenda, shown beside it, already lists the carried-over topics. */
  showOpenTopics?: boolean;
}) {
  const members = useMembersMap();

  const byMember = useMemo(() => {
    const groups = new Map<string, { name: string; tasks: SummaryTask[] }>();
    for (const t of summary.priorities) {
      const key = t.assignee_id ?? "none";
      if (!groups.has(key)) groups.set(key, { name: t.assignee_name ?? "Sans responsable", tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    return [...groups.entries()].sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].name.localeCompare(b[1].name, "fr")));
  }, [summary.priorities]);

  const copy = async () => {
    const title = `Meeting du ${formatLongDate(parseDateOnly(meeting.week_start)).toLowerCase()} — récapitulatif`;
    try {
      await navigator.clipboard.writeText(summaryToText(summary, title));
      toast.success("Récapitulatif copié", { description: "Collez-le dans un courriel ou une conversation." });
    } catch {
      toast.error("Copie impossible dans ce navigateur");
    }
  };

  const figure = (n: number, one: string, many: string) => ({ value: n, label: n >= 2 ? many : one });
  const stats = [
    figure(summary.completed.length, "accomplie", "accomplies"),
    figure(summary.priorities.length, "priorité", "priorités"),
    figure(summary.created.length, "nouvelle tâche", "nouvelles tâches"),
    figure(summary.decisions.length, "décision", "décisions"),
  ];

  return (
    <article className="card-surface">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-4 px-4 py-4 sm:px-5">
        <dl className="flex flex-wrap gap-y-3 divide-x divide-navy-900/[0.08]">
          {stats.map((s) => (
            <div key={s.label} className="px-5 first:pl-0">
              <dd className="text-2xl leading-none font-semibold text-navy-900 tabular">{s.value}</dd>
              <dt className="mt-1.5 text-xs text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copy}>
            <ClipboardCopy /> Copier le récapitulatif
          </Button>
          {actions}
        </div>
      </header>

      <div className="grid border-t border-navy-900/[0.06] lg:grid-cols-2 lg:divide-x lg:divide-navy-900/[0.06]">
        <div className="divide-y divide-navy-900/[0.06]">
          <Section
            title="Priorités de la semaine"
            icon={<Star className="size-4 fill-sun-400 text-sun-500" />}
            count={summary.priorities.length}
          >
            {byMember.length === 0 ? (
              <Empty>Aucune priorité définie pendant ce meeting.</Empty>
            ) : (
              <div className="space-y-2.5">
                {byMember.map(([id, g]) => (
                  <div key={id}>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <MemberAvatar member={id === "none" ? null : (members[id] ?? null)} size="sm" />
                      <span className="text-[13px] font-semibold text-navy-900">{g.name}</span>
                      <span className="text-xs text-navy-400 tabular">{g.tasks.length}</span>
                    </div>
                    <ul className="ml-4 border-l border-navy-900/[0.08] pl-2.5">
                      {g.tasks.map((t) => (
                        <Row key={t.id} task={t} showAssignee={false} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Nouvelles tâches"
            icon={<Plus className="size-4 text-navy-500" />}
            count={summary.created.length}
          >
            {summary.created.length === 0 ? (
              <Empty>Aucune tâche créée pendant ce meeting.</Empty>
            ) : (
              <ul>
                {summary.created.map((t) => (
                  <Row key={t.id} task={t} />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="divide-y divide-navy-900/[0.06] border-t border-navy-900/[0.06] lg:border-t-0">
          <Section title="Ce qui a été accompli" icon={<StatusIcon status="done" />} count={summary.completed.length}>
            {summary.completed.length === 0 ? (
              <Empty>Rien de terminé depuis le meeting précédent.</Empty>
            ) : (
              <ul>
                {summary.completed.map((t) => (
                  <Row key={t.id} task={t} done />
                ))}
              </ul>
            )}
          </Section>

          <Section title="Décisions" icon={<Gavel className="size-4 text-teal-600" />} count={summary.decisions.length}>
            {summary.decisions.length === 0 ? (
              <Empty>Aucune décision consignée.</Empty>
            ) : (
              <ul className="space-y-1.5 px-2 py-1">
                {summary.decisions.map((d) => (
                  <li key={d.id} className="flex items-start gap-2.5 text-[13px] leading-snug text-navy-800">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-teal-500" />
                    {d.body}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {showOpenTopics && summary.open_topics.length > 0 && (
            <Section
              title="Points reportés"
              icon={<MessagesSquare className="size-4 text-sun-600" />}
              count={summary.open_topics.length}
            >
              <ul className="space-y-1.5 px-2 py-1">
                {summary.open_topics.map((d) => (
                  <li key={d.id} className="flex items-start gap-2.5 text-[13px] leading-snug text-navy-800">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-[1px] bg-sun-400" />
                    {d.body}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </article>
  );
}
