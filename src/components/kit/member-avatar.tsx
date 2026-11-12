"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";
import { AnimatedTooltip } from "@/components/ui/animated-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { memberPortrait } from "@/lib/avatars";
import { COLOR_META } from "@/lib/constants";
import type { Member } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

/** 24, 28, 32, 40, 56 and 72 px: large enough for a portrait to be recognised, even in a dense row. */
const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-[13px]",
  xl: "size-14 text-lg",
  "2xl": "size-[72px] text-2xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function MemberAvatar({
  member,
  size = "sm",
  tooltip = false,
  online,
  className,
}: {
  member: Member | null | undefined;
  size?: AvatarSize;
  /** `true`: the member's name on hover. `"animated"`: the springy name-and-role tooltip of avatar groups. */
  tooltip?: boolean | "animated";
  /** Shows a presence dot when defined. */
  online?: boolean;
  className?: string;
}) {
  const portrait = member ? memberPortrait(member) : null;
  // A picture that does not load gives way to the initials (remembered per address).
  const [broken, setBroken] = useState<string | null>(null);
  const body = member ? (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight",
        SIZES[size],
        COLOR_META[member.color]?.soft ?? COLOR_META.slate.soft,
        className,
      )}
      aria-label={member.full_name}
    >
      {portrait && portrait !== broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portrait}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setBroken(portrait)}
          // The hairline keeps a light portrait from melting into a light surface.
          className="size-full rounded-full object-cover outline outline-1 -outline-offset-1 outline-navy-900/10"
        />
      ) : (
        initials(member.full_name)
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card",
            online ? "bg-leaf-500" : "bg-navy-200",
          )}
        />
      )}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-navy-300 text-navy-300",
        SIZES[size],
        className,
      )}
      aria-label="Non assignée"
    >
      <UserRound className="size-[55%]" strokeWidth={2} />
    </span>
  );

  if (!tooltip) return body;
  if (tooltip === "animated" && member) {
    return (
      <AnimatedTooltip label={member.full_name} detail={member.role === "admin" ? "Administrateur" : "Partenaire"}>
        {body}
      </AnimatedTooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>{member ? member.full_name : "Non assignée"}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({
  members,
  size = "sm",
  max = 5,
  className,
}: {
  members: Member[];
  size?: AvatarSize;
  max?: number;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((m) => (
        <MemberAvatar
          key={m.id}
          member={m}
          size={size}
          tooltip="animated"
          // The one under the pointer steps forward, as in the group the tooltip comes from.
          className="ring-2 ring-card transition-transform duration-300 hover:z-10 hover:scale-110"
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-navy-100 font-medium text-navy-600 ring-2 ring-card",
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
