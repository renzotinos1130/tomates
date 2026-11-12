"use client";

import { Gavel, MessagesSquare, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { CountBadge } from "@/components/kit/pills";
import { TaskCheck } from "@/components/kit/task-check";
import { COLOR_META } from "@/lib/constants";
import { useMeetings, useMembersMap, useProjectsMap } from "@/lib/hooks";
import { decisionsFor, topicsFor } from "@/lib/selectors";
import { addMeetingItem, deleteMeetingItem, updateMeetingItem, useApp } from "@/lib/store";
import type { ID, MeetingItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function AddLine({
  placeholder,
  onAdd,
  label,
}: {
  placeholder: string;
  label: string;
  onAdd: (body: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };
  return (
    <div className="-mx-1 flex items-center gap-2 rounded-lg px-2 transition-colors focus-within:bg-white/60 focus-within:ring-2 focus-within:ring-teal-500/40 hover:bg-navy-900/[0.04]">
      <Plus className="size-4 shrink-0 text-navy-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setValue("");
        }}
        placeholder={placeholder}
        aria-label={label}
        maxLength={2000}
        className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-navy-900 outline-none placeholder:text-navy-400"
      />
    </div>
  );
}

function ItemRow({
  item,
  carried,
  checkable,
}: {
  item: MeetingItem;
  carried?: boolean;
  checkable?: boolean;
}) {
  const members = useMembersMap();
  const projects = useProjectsMap();
  const project = item.project_id ? projects[item.project_id] : null;
  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-navy-900/[0.03]">
      {checkable ? (
        <TaskCheck
          done={item.done}
          size="sm"
          onToggle={() => void updateMeetingItem(item.id, { done: !item.done })}
          className="mt-[3px]"
        />
      ) : (
        <span className="mt-[9px] size-1 shrink-0 rounded-[1px] bg-navy-400" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-snug break-words",
            checkable && item.done ? "text-navy-400 line-through decoration-navy-200" : "text-navy-800",
          )}
        >
          {item.body}
        </p>
        {(project || carried) && (
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-navy-400">
            {project && (
              <span className="inline-flex items-center gap-1">
                <span className={cn("size-1.5 rounded-[1px]", COLOR_META[project.color]?.solid)} />
                {project.name}
              </span>
            )}
            {carried && <span className="text-navy-500">Reporté</span>}
          </p>
        )}
      </div>
      <MemberAvatar member={item.author_id ? members[item.author_id] : null} size="xs" tooltip className="mt-0.5" />
      <button
        type="button"
        aria-label="Supprimer"
        onClick={() => void deleteMeetingItem(item.id)}
        className="mt-0.5 flex size-5 items-center justify-center rounded text-navy-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-coral-50 hover:text-coral-600 focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** "Points à discuter" (always) and "Décisions prises" (once the meeting has started). */
export function Agenda({
  weekStart,
  meetingId,
  projectId = null,
  showDecisions,
  className,
}: {
  weekStart: string;
  meetingId: ID | null;
  /** When set, new items are tagged with this project. */
  projectId?: ID | null;
  showDecisions: boolean;
  className?: string;
}) {
  const meetings = useMeetings();
  const items = useApp((s) => s.meeting_items);
  const projects = useProjectsMap();
  const all = useMemo(() => Object.values(items), [items]);
  const topics = useMemo(
    () => topicsFor({ id: meetingId ?? "", week_start: weekStart }, meetings, all),
    [meetingId, weekStart, meetings, all],
  );
  const decisions = useMemo(() => (meetingId ? decisionsFor(meetingId, all) : []), [meetingId, all]);
  const open = topics.filter((t) => !t.done).length;
  const tag = projectId ? projects[projectId]?.name : null;

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      <section className="card-surface p-4">
        <header className="mb-2 flex items-center gap-2">
          <MessagesSquare className="size-4 text-navy-500" />
          <h3 className="text-[13px] font-semibold text-navy-900">Points à discuter</h3>
          <CountBadge>{open}</CountBadge>
        </header>
        {topics.length === 0 ? (
          <p className="px-2 pb-2 text-xs text-navy-400">
            Notez ici, au fil de la semaine, ce dont vous voulez parler mercredi.
          </p>
        ) : (
          <ul className="-mx-2 mb-2">
            {topics.map((t) => (
              <ItemRow key={t.id} item={t} checkable carried={!!meetingId && t.meeting_id !== meetingId} />
            ))}
          </ul>
        )}
        <AddLine
          label="Ajouter un point à discuter"
          placeholder={tag ? `Point à discuter — ${tag}` : "Ajouter un point à discuter"}
          onAdd={(body) => void addMeetingItem(weekStart, "topic", body, projectId)}
        />
      </section>

      {showDecisions && (
        <section className="card-surface p-4">
          <header className="mb-2 flex items-center gap-2">
            <Gavel className="size-4 text-navy-500" />
            <h3 className="text-[13px] font-semibold text-navy-900">Décisions prises</h3>
            <CountBadge>{decisions.length}</CountBadge>
          </header>
          {decisions.length === 0 ? (
            <p className="px-2 pb-2 text-xs text-navy-400">Consignez chaque décision au moment où elle est prise.</p>
          ) : (
            <ul className="-mx-2 mb-2">
              {decisions.map((d) => (
                <ItemRow key={d.id} item={d} />
              ))}
            </ul>
          )}
          <AddLine
            label="Ajouter une décision"
            placeholder={tag ? `Décision — ${tag}` : "Ajouter une décision"}
            onAdd={(body) => void addMeetingItem(weekStart, "decision", body, projectId)}
          />
        </section>
      )}
    </div>
  );
}
