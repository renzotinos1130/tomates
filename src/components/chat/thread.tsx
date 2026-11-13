"use client";

import { ArrowDown, Copy, Hash, Trash2 } from "@/components/kit/icons";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/kit/empty-state";
import { MemberAvatar } from "@/components/kit/member-avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatClock, participantKey, readPosition, threadItems, type ConversationView, type ThreadItem } from "@/lib/chat";
import { useThreadMessages } from "@/lib/chat-hooks";
import { useMembers, useNow } from "@/lib/hooks";
import { deleteChatMessage, loadOlderChatMessages, markChatRead, ui, useApp, type AppState } from "@/lib/store";
import type { ID, Member } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";
import { Composer } from "./composer";
import "./chat.css";

/** One to three emoji and nothing else: shown large, without a bubble. */
const EMOJI_ONLY = new RegExp("^(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic})*\\s*){1,3}$", "u");
const LINK = /(https?:\/\/[^\s<]+[^\s<.,:;!?"')\]}»])/g;

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
/** False while the tab is in the background: what arrives then has not been read. */
function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** What is not on screen has not been read (a thread inside a hidden part of the page, for instance). */
const isOnScreen = (el: HTMLElement | null) => !!el && el.offsetParent !== null;

/** How far I have read a conversation, as the store knows it now. */
const myReadPosition = (s: AppState, conversationId: ID) =>
  s.meId ? readPosition(s.chat_participants[participantKey(conversationId, s.meId)], s.members[s.meId]) : null;

/** Message text, with web addresses turned into links. */
function Body({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(LINK);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            // A link keeps the browser's own menu (open in a tab, copy the address), not the message's.
            onContextMenu={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn("underline underline-offset-2", mine ? "decoration-white/50 hover:decoration-white" : "decoration-navy-900/30 hover:decoration-navy-900")}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Divider({ children, tone = "quiet" }: { children: React.ReactNode; tone?: "quiet" | "new" }) {
  return (
    <div
      role="separator"
      className={cn("flex items-center gap-3 pt-5 pb-1 text-[11px] font-medium", tone === "new" ? "text-tomato-800" : "text-navy-600")}
      {...(tone === "new" ? { "data-unread-divider": "" } : {})}
    >
      <span className={cn("h-px flex-1", tone === "new" ? "bg-tomato-500/35" : "bg-[var(--gw-line)]")} />
      {children}
      <span className={cn("h-px flex-1", tone === "new" ? "bg-tomato-500/35" : "bg-[var(--gw-line)]")} />
    </div>
  );
}

function MessageRow({ item, author }: { item: Extract<ThreadItem, { type: "message" }>; author: Member | null }) {
  const { message: m, mine, head, tail } = item;
  const deleted = !!m.deleted_at;
  const big = !deleted && EMOJI_ONLY.test(m.body.trim());
  const clock = formatClock(m.created_at);

  const bubble = deleted ? (
    <p className="rounded-[18px] border border-dashed border-navy-900/20 px-3.5 py-2 text-[13px] text-navy-600 italic">
      Message supprimé
    </p>
  ) : big ? (
    <p className="px-1 text-[34px] leading-tight">{m.body.trim()}</p>
  ) : (
    <p
      className={cn(
        "chat-text rounded-[18px] px-3.5 py-2 text-[13.5px] leading-[1.45]",
        mine
          ? "bg-navy-900 text-white shadow-[0_1px_2px_rgb(13_27_51/0.25)]"
          : "bg-white/70 text-navy-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.75),0_1px_2px_rgb(13_27_51/0.06)]",
        // The corners on the speaker's side tighten inside a block of messages.
        mine ? !head && "rounded-tr-[6px]" : !head && "rounded-tl-[6px]",
        mine ? !tail && "rounded-br-[6px]" : !tail && "rounded-bl-[6px]",
      )}
    >
      <Body text={m.body} mine={mine} />
    </p>
  );

  const askDelete = () =>
    ui.confirm({
      title: "Supprimer ce message ?",
      description: "Il sera remplacé par « Message supprimé » pour tout le monde.",
      confirmLabel: "Supprimer",
      destructive: true,
      onConfirm: () => deleteChatMessage(m.id),
    });
  const copy = () =>
    navigator.clipboard.writeText(m.body).then(
      () => toast.success("Texte copié"),
      () => toast.error("Copie impossible dans ce navigateur"),
    );
  // Right-click, or a long press on a touch screen.
  const withMenu = deleted ? (
    bubble
  ) : (
    <ContextMenu>
      <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => void copy()}>
          <Copy /> Copier le texte
        </ContextMenuItem>
        {mine && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={askDelete}>
              <Trash2 /> Supprimer
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  if (mine) {
    return (
      <div className={cn("chat-row group/msg flex flex-col items-end", head ? "mt-3" : "mt-[3px]")} data-message-id={m.id}>
        <div className="flex max-w-[min(34rem,86%)] items-center gap-1">
          {!deleted && (
            // With a mouse the bin shows on hover; on a touch screen it lives in the long-press menu.
            <button
              type="button"
              aria-label="Supprimer ce message"
              title="Supprimer"
              onClick={askDelete}
              className="hidden size-7 shrink-0 items-center justify-center rounded-full text-navy-500 opacity-0 transition-opacity group-hover/msg:opacity-100 hover:bg-navy-900/[0.06] hover:text-coral-600 focus-ring focus-visible:opacity-100 md:flex"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          {withMenu}
        </div>
        {tail && (
          <time dateTime={m.created_at} className="mt-1 pr-1 text-[11px] leading-none text-navy-500 tabular">
            {clock}
          </time>
        )}
      </div>
    );
  }

  return (
    <div className={cn("chat-row flex gap-2.5", head ? "mt-3" : "mt-[3px]")} data-message-id={m.id}>
      <div className="w-8 shrink-0 pt-[18px]">{head && <MemberAvatar member={author} size="md" />}</div>
      <div className="min-w-0 max-w-[min(34rem,86%)]">
        {head && (
          <p className="mb-1 flex items-baseline gap-2 pl-1 leading-none">
            <span className="text-xs font-medium text-navy-900">{author ? firstName(author.full_name) : "Ancien membre"}</span>
            <time dateTime={m.created_at} className="text-[11px] text-navy-500 tabular">
              {clock}
            </time>
          </p>
        )}
        <div className="flex">{withMenu}</div>
      </div>
    </div>
  );
}

/** Right pane: who we are talking to, the messages, and where to write. */
export function Thread({ view, autoFocus = false }: { view: ConversationView; autoFocus?: boolean }) {
  const { conversation, other } = view;
  const id = conversation.id;
  const channel = conversation.kind === "channel";
  const now = useNow();
  const pageVisible = usePageVisible();
  const meId = useApp((s) => s.meId);
  const membersMap = useApp((s) => s.members);
  const presence = useApp((s) => s.presence);
  const hasOlder = useApp((s) => !!s.chatHasOlder[id]);
  const team = useMembers();
  const messages = useThreadMessages(id);
  const myRead = useApp((s) => myReadPosition(s, id));
  // Where I had stopped when the thread opened: the divider stays there while I catch up.
  const [readUpTo, setReadUpTo] = useState(myRead);
  // The router keeps a screen alive (hidden) when one leaves it, state included.
  // Coming back is a new reading: the mark moves to where I have stopped since.
  useLayoutEffect(() => () => setReadUpTo(myReadPosition(useApp.getState(), id)), [id]);
  const items = useMemo(() => threadItems(messages, meId, readUpTo, now), [messages, meId, readUpTo, now]);

  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);
  const onlineCount = team.filter((m) => online.has(m.id)).length;
  const sub = channel
    ? `${plural(team.length, "membre")}${onlineCount > 0 ? ` · ${onlineCount} en ligne` : ""}`
    : !other
      ? "N'est plus dans l'équipe"
      : !other.active
        ? "N'a plus accès à l'espace · conversation privée"
        : `${online.has(other.id) ? "En ligne" : other.role === "admin" ? "Administrateur" : "Partenaire"} · conversation privée`;

  /* ----------------------------- scrolling ---------------------------- */
  const scroller = useRef<HTMLDivElement | null>(null);
  /** Was the reader at the bottom before the last change? Then follow new messages. */
  const stick = useRef(true);
  /** Distance from the bottom to keep when older messages are added on top. */
  const keepFromBottom = useRef<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    stick.current = near;
    setAtBottom(near);
  };
  const toBottom = (smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // On opening — and each time the screen comes back: start at the first unread
  // message if there is one, at the end otherwise.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const divider = el.querySelector<HTMLElement>("[data-unread-divider]");
    el.scrollTop = divider ? Math.max(0, divider.offsetTop - 72) : el.scrollHeight;
    onScroll();
  }, []);

  const count = messages.length;
  const lastMine = count > 0 && messages[count - 1].author_id === meId;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (stick.current || lastMine) {
      el.scrollTop = el.scrollHeight;
    }
    // Only when a message is added: `lastMine` is read for that message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  /* ------------------------------ reading ----------------------------- */
  // Opening a conversation reads it.
  useEffect(() => {
    if (!pageVisible) return;
    const timer = window.setTimeout(() => {
      if (isOnScreen(scroller.current)) void markChatRead(id);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [id, pageVisible]);

  // So does a message that arrives while the end of the thread is in view.
  const unread = view.unread;
  useEffect(() => {
    if (unread === 0 || !pageVisible || !atBottom) return;
    const timer = window.setTimeout(() => {
      if (isOnScreen(scroller.current)) void markChatRead(id);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [id, unread, pageVisible, atBottom]);

  const loadOlder = async () => {
    const el = scroller.current;
    if (el) keepFromBottom.current = el.scrollHeight - el.scrollTop;
    setLoadingOlder(true);
    await loadOlderChatMessages(id);
    setLoadingOlder(false);
  };

  return (
    <section className="gw-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0" aria-label={`Conversation : ${view.title}`}>
      <header className="hidden h-[60px] shrink-0 items-center gap-3 border-b border-[var(--gw-line)] px-4 md:flex">
        {channel ? (
          <span className="gw-chip size-10 rounded-xl text-navy-800" aria-hidden="true">
            <Hash className="size-[17px]" strokeWidth={2} />
          </span>
        ) : (
          <MemberAvatar member={other} size="lg" online={other && online.has(other.id) ? true : undefined} />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-[-0.01em] text-navy-900">{view.title}</h2>
          <p className="truncate text-xs text-navy-600">{sub}</p>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          role="log"
          aria-label={`Messages, ${view.title}`}
          // A log announces what is added to it: new messages, yes; a page of old ones, no.
          aria-live={loadingOlder ? "off" : undefined}
          tabIndex={0}
          className="chat-scroll relative h-full overflow-y-auto px-3 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-inset sm:px-4"
        >
          {hasOlder && (
            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
                className="h-8 rounded-full bg-white/50 px-3.5 text-xs font-medium text-navy-800 transition-colors hover:bg-white/75 focus-ring disabled:opacity-60"
              >
                {loadingOlder ? "Chargement…" : "Voir les messages précédents"}
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <EmptyState
              className="h-full"
              title={channel ? "Le canal est encore silencieux" : other ? `Dites bonjour à ${firstName(other.full_name)}` : "Conversation vide"}
              hint={
                channel
                  ? "Écrivez le premier message : toute l'équipe le verra."
                  : "Cette conversation n'est visible que par vous deux."
              }
            />
          ) : (
            items.map((item) =>
              item.type === "day" ? (
                <Divider key={item.key} tone={item.fresh ? "new" : "quiet"}>
                  {item.fresh ? `${item.label} · nouveaux messages` : item.label}
                </Divider>
              ) : item.type === "unread" ? (
                <Divider key={item.key} tone="new">
                  Nouveaux messages
                </Divider>
              ) : (
                <MessageRow
                  key={item.key}
                  item={item}
                  author={item.message.author_id ? (membersMap[item.message.author_id] ?? null) : null}
                />
              ),
            )
          )}
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={() => toBottom(true)}
            className={cn(
              "absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full px-3 text-xs font-medium shadow-pop transition-colors focus-ring",
              unread > 0 ? "bg-tomato-600 text-white hover:bg-tomato-700" : "bg-paper-50 text-navy-800 hover:bg-white",
            )}
          >
            <ArrowDown className="size-3.5" />
            {unread > 0 ? plural(unread, "nouveau message", "nouveaux messages") : "Derniers messages"}
          </button>
        )}
      </div>

      <Composer conversationId={id} to={view.title} autoFocus={autoFocus} />
    </section>
  );
}
