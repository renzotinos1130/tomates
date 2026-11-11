"use client";

import { Menu } from "lucide-react";
import { AvatarStack } from "@/components/kit/member-avatar";
import { useMe, useMembers } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/** Teammates currently online (excluding me). */
export function OnlineNow({ page, className }: { page?: string; className?: string }) {
  const presence = useApp((s) => s.presence);
  const members = useMembers();
  const me = useMe();
  const online = useMemo(() => {
    const ids = new Set(presence.filter((p) => !page || p.page.startsWith(page)).map((p) => p.member_id));
    return members.filter((m) => ids.has(m.id) && m.id !== me?.id);
  }, [presence, members, me?.id, page]);
  if (online.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-leaf-500" />
      </span>
      <AvatarStack members={online} size="sm" />
    </div>
  );
}

/**
 * Sticky page header (glass). Title on the left, actions on the right,
 * optional second row (`children`) for tabs / filters.
 */
export function PageHeader({
  title,
  icon,
  subtitle,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "glass sticky top-0 z-20 border-b border-navy-900/[0.06] px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => ui.setMobileNav(true)}
          className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-navy-600 hover:bg-navy-900/[0.06] lg:hidden focus-ring"
        >
          <Menu className="size-[18px]" />
        </button>
        {icon}
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="truncate text-[15px] font-semibold text-navy-900">{title}</h1>
          {subtitle && <span className="hidden truncate text-[13px] text-muted-foreground sm:inline">{subtitle}</span>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <OnlineNow className="hidden sm:flex" />
          {actions}
        </div>
      </div>
      {children}
    </header>
  );
}
