"use client";

import { Hash, Search, X } from "@/components/kit/icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { chatHref, listTime, previewText, type ConversationView } from "@/lib/chat";
import { useNow } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Accent- and case-insensitive: « lea » finds « Léa ». */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Row({
  view,
  active,
  explicit,
  online,
}: {
  view: ConversationView;
  active: boolean;
  /** The conversation is in the address: highlighted on every screen size, not only wide ones. */
  explicit: boolean;
  online: boolean;
}) {
  const now = useNow();
  const meId = useApp((s) => s.meId);
  const members = useApp((s) => s.members);
  const { conversation, unread } = view;
  const count = unread > 99 ? "99+" : String(unread);
  return (
    <Link
      href={chatHref(conversation.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 transition-colors focus-ring",
        !active && "hover:bg-glaze/30",
        // On a phone the list is a screen of its own: nothing is "open" until a row is tapped.
        active && explicit && "bg-glaze/55 shadow-[0_3px_8px_rgb(var(--shade-rgb)/0.07)]",
        active && !explicit && "hover:bg-glaze/30 md:bg-glaze/55 md:shadow-[0_3px_8px_rgb(var(--shade-rgb)/0.07)]",
      )}
    >
      {conversation.kind === "channel" ? (
        <span className="gw-chip size-10 rounded-xl text-navy-800" aria-hidden="true">
          <Hash className="size-[17px]" strokeWidth={2} />
        </span>
      ) : (
        // A dot only for who is there: a grey one on everybody else would say nothing.
        <MemberAvatar member={view.other} size="lg" online={online ? true : undefined} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("truncate text-[13px] text-navy-900", unread > 0 ? "font-semibold" : "font-medium")}>
            {view.title}
          </span>
          {view.last && (
            <span className="ml-auto shrink-0 text-[11px] text-navy-500 tabular">{listTime(view.last.created_at, now)}</span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("truncate text-xs", unread > 0 ? "text-navy-800" : "text-navy-600")}>
            {previewText(view, meId, members)}
          </span>
          {unread > 0 && (
            <span
              className="ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-tomato-600 px-1.5 text-[11px] leading-none font-semibold text-white tabular"
              aria-label={`${unread} ${unread >= 2 ? "non lus" : "non lu"}`}
            >
              {count}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

/** Left pane: search, the team channel, then direct conversations by last activity. */
export function ConversationList({
  views,
  activeId,
  explicit,
  className,
}: {
  views: ConversationView[];
  activeId: ID | null;
  explicit: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const presence = useApp((s) => s.presence);
  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);

  const q = fold(query.trim());
  const shown = q ? views.filter((v) => fold(v.title).includes(q)) : views;
  const channels = shown.filter((v) => v.conversation.kind === "channel");
  const directs = shown.filter((v) => v.conversation.kind === "direct");
  const row = (v: ConversationView) => (
    <li key={v.conversation.id}>
      <Row
        view={v}
        active={v.conversation.id === activeId}
        explicit={explicit}
        online={!!v.other && online.has(v.other.id)}
      />
    </li>
  );

  return (
    <nav
      className={cn("gw-panel flex min-h-0 w-full flex-col p-0 md:w-[300px] md:shrink-0 xl:w-[328px]", className)}
      aria-label="Conversations"
    >
      <div className="p-3 pb-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-500" aria-hidden="true" />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Rechercher"
            aria-label="Rechercher une conversation"
            className="h-9 w-full rounded-full bg-glaze/45 pr-9 pl-9 text-[13px] text-navy-900 shadow-[inset_0_1px_0_rgb(var(--glaze-rgb)/0.6)] outline-none placeholder:text-navy-500 focus-visible:bg-glaze/70 focus-visible:ring-2 focus-visible:ring-teal-500/50"
          />
          {query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-navy-500 hover:bg-navy-900/[0.06] hover:text-navy-900 focus-ring"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {channels.length > 0 && <ul className="space-y-0.5">{channels.map(row)}</ul>}

        {(directs.length > 0 || !q) && <p className="px-2.5 pt-4 pb-1.5 text-xs font-medium text-navy-600">Messages directs</p>}
        {directs.length > 0 ? (
          <ul className="space-y-0.5">{directs.map(row)}</ul>
        ) : (
          !q && (
            <p className="px-2.5 pb-3 text-xs leading-relaxed text-navy-600">
              Aucune conversation privée pour l&apos;instant. « Nouveau message » en ouvre une avec la personne de votre
              choix.
            </p>
          )
        )}

        {q && shown.length === 0 && (
          <p className="px-2.5 py-6 text-center text-xs text-navy-600">Aucune conversation ne correspond à « {query.trim()} ».</p>
        )}
      </div>
    </nav>
  );
}
