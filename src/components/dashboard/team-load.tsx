"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StatusBlocks } from "@/components/kit/blocks";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { PriorityStar } from "@/components/kit/pills";
import { useAllTasks, useMe, useMembers, useWeekPriorities } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import type { TaskStatus } from "@/lib/types";
import { firstName } from "@/lib/utils";
import { Tile, TileHeader } from "./bento";

const ORDER: TaskStatus[] = ["blocked", "review", "in_progress", "todo"];

/** Who is carrying what — one line per partner. */
export function TeamLoad({ className, delay }: { className?: string; delay?: number }) {
  const members = useMembers();
  const me = useMe();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const presence = useApp((s) => s.presence);
  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);

  const rows = useMemo(() => {
    const data = members.map((m) => {
      const open = tasks.filter((t) => isOpen(t) && t.assignee_id === m.id);
      const by = { todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0 };
      for (const t of open) by[t.status]++;
      return { member: m, open: open.length, by, stars: open.filter((t) => priorityIds.has(t.id)).length };
    });
    return { data };
  }, [members, tasks, priorityIds]);

  return (
    <Tile className={className} delay={delay}>
      <TileHeader title="Qui fait quoi" hint="Tâches ouvertes par partenaire" />
      <ul className="px-2.5 pb-3">
        {rows.data.map(({ member, open, by, stars }) => (
          <li key={member.id}>
            <Link
              href={member.id === me?.id ? "/mes-taches" : `/mes-taches?membre=${member.id}`}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-navy-900/[0.035] focus-ring"
            >
              <MemberAvatar member={member} size="md" online={online.has(member.id) || member.id === me?.id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-navy-900">
                    {firstName(member.full_name)}
                    {member.id === me?.id && <span className="font-normal text-navy-400"> · vous</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular">
                    {stars > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-sun-700">
                        <PriorityStar active className="size-3" />
                        {stars}
                      </span>
                    )}
                    {open}
                  </span>
                </div>
                {/* One block per open task, the most urgent first. */}
                <StatusBlocks byStatus={by} order={ORDER} size="xs" max={36} className="mt-2" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Tile>
  );
}
