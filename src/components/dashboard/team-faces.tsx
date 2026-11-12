"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { useAllTasks, useMe, useMembers } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import { cn, firstName, plural } from "@/lib/utils";
import { Panel } from "./panel";

/**
 * Who is on the team and how much each one carries: a face, a first name, the
 * number of open tasks. A click opens that partner's tasks.
 */
export function TeamFaces({ className, delay }: { className?: string; delay?: number }) {
  const me = useMe();
  const members = useMembers();
  const tasks = useAllTasks();
  const presence = useApp((s) => s.presence);
  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);
  const load = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) if (isOpen(t) && t.assignee_id) counts.set(t.assignee_id, (counts.get(t.assignee_id) ?? 0) + 1);
    return counts;
  }, [tasks]);
  const here = members.filter((m) => m.id === me?.id || online.has(m.id)).length;

  return (
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      title="L'équipe"
      aside={<span className="text-navy-600">{here} en ligne</span>}
    >
      <ul className="team-faces">
        {members.map((m) => {
          const open = load.get(m.id) ?? 0;
          const isMe = m.id === me?.id;
          return (
            <li key={m.id} className="min-w-0">
              <Link
                href={isMe ? "/mes-taches" : `/mes-taches?membre=${m.id}`}
                aria-label={`${m.full_name} : ${plural(open, "tâche ouverte", "tâches ouvertes")}. Voir ses tâches`}
                className="group/face flex h-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors hover:bg-white/35 focus-ring"
              >
                <MemberAvatar
                  member={m}
                  size="lg"
                  online={isMe || online.has(m.id)}
                  className="mb-1 size-12 ring-2 ring-white/75 transition-transform duration-300 group-hover/face:scale-[1.06] @[17rem]/panel:size-14 @[23rem]/panel:size-16"
                />
                <span className="max-w-full truncate text-[13px] leading-tight font-medium text-navy-900">{firstName(m.full_name)}</span>
                <span className="text-xs leading-tight text-navy-600 tabular">{plural(open, "tâche")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
