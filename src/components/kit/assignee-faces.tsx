"use client";

import { listed } from "@/lib/activity";
import { useMembersMap } from "@/lib/hooks";
import type { ID, Member } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";
import { MemberAvatar, type AvatarSize } from "./member-avatar";

/** The members behind a list of ids, in its order. Someone who no longer exists is left out. */
export function usePeople(ids: ID[]): Member[] {
  const members = useMembersMap();
  return ids.map((id) => members[id]).filter((m): m is Member => !!m);
}

/**
 * How the people of a task are named in a line of text: the full name when
 * there is one person, first names when there are several (« Maya et Antoine »).
 */
export function peopleNames(people: Member[], { short = false }: { short?: boolean } = {}): string {
  if (people.length === 1) return short ? firstName(people[0].full_name) : people[0].full_name;
  return listed(people.map((m) => firstName(m.full_name)));
}

const MORE: Record<"xs" | "sm" | "md", string> = {
  xs: "size-6 text-[9.5px]",
  sm: "size-7 text-[10px]",
  md: "size-8 text-[11px]",
};

/**
 * The faces of the people a task is given to, side by side and overlapping.
 * Nobody: the empty silhouette. More than `max`: the first ones, then « +2 ».
 */
export function AssigneeFaces({
  ids,
  size = "sm",
  max = 3,
  tooltip = false,
  className,
}: {
  ids: ID[];
  size?: Extract<AvatarSize, "xs" | "sm" | "md">;
  max?: number;
  tooltip?: boolean;
  className?: string;
}) {
  const people = usePeople(ids);
  if (people.length === 0) return <MemberAvatar member={null} size={size} className={className} />;
  if (people.length === 1) return <MemberAvatar member={people[0]} size={size} tooltip={tooltip} className={className} />;
  // With more faces than room, the last place says how many are not shown.
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const hidden = people.length - shown.length;
  return (
    <span className={cn("inline-flex shrink-0 items-center -space-x-2", className)} aria-label={listed(people.map((m) => m.full_name))} role="img">
      {shown.map((m) => (
        <MemberAvatar key={m.id} member={m} size={size} tooltip={tooltip} className="ring-2 ring-card" />
      ))}
      {hidden > 0 && (
        <span
          className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-700 ring-2 ring-card tabular", MORE[size])}
          title={listed(people.slice(shown.length).map((m) => m.full_name))}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}
