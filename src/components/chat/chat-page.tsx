"use client";

import { ArrowLeft, MessageCircleOff } from "@/components/kit/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { Button } from "@/components/ui/button";
import { CHAT_PATH, chatHref, GENERAL_CHANNEL_ID } from "@/lib/chat";
import { useConversations, useTwoPanes } from "@/lib/chat-hooks";
import { openDirectConversation } from "@/lib/store";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";
import { NewMessage } from "./new-message";
import { Thread } from "./thread";

/** The conversation named by the address: `/messages/<id>`. Null on `/messages` — and on any other screen. */
function conversationIn(pathname: string): ID | null {
  if (!pathname.startsWith(`${CHAT_PATH}/`)) return null;
  const id = pathname.slice(CHAT_PATH.length + 1).split("/")[0];
  return id ? decodeURIComponent(id) : null;
}

/**
 * Messages: the team channel and direct conversations. Two panes on a wide
 * screen (list, thread); one at a time on a phone, where `/messages` is the
 * list and `/messages/<id>` a thread.
 *
 * Rendered by the layout of `/messages`, so it stays in place from one
 * conversation to the next.
 */
export function ChatPage() {
  const router = useRouter();
  const routeId = conversationIn(usePathname());
  const twoPanes = useTwoPanes();
  const views = useConversations(routeId);
  const totalUnread = views.reduce((n, v) => n + v.unread, 0);

  // A wide screen always shows a thread: without one in the address, the team channel.
  const activeId = routeId ?? (views.some((v) => v.conversation.id === GENERAL_CHANNEL_ID) ? GENERAL_CHANNEL_ID : (views[0]?.conversation.id ?? null));
  const active = views.find((v) => v.conversation.id === activeId) ?? null;
  // A thread only exists while it is on screen: it reads what it shows, and places itself when it appears.
  const showThread = twoPanes || !!routeId;

  const startDirect = async (memberId: ID) => {
    const conversation = await openDirectConversation(memberId);
    if (conversation) router.push(chatHref(conversation.id));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        icon={
          routeId ? (
            <Button asChild variant="ghost" size="icon-sm" aria-label="Retour aux conversations" className="md:hidden">
              <Link href={CHAT_PATH}>
                <ArrowLeft />
              </Link>
            </Button>
          ) : undefined
        }
        title={
          routeId && active ? (
            <>
              <span className="md:hidden">{active.title}</span>
              <span className="hidden md:inline">Messages</span>
            </>
          ) : (
            "Messages"
          )
        }
        subtitle={totalUnread > 0 ? `${totalUnread} ${totalUnread >= 2 ? "non lus" : "non lu"}` : undefined}
        actions={<NewMessage onPick={(memberId) => void startDirect(memberId)} />}
      />

      <div className="flex min-h-0 flex-1 gap-3 p-2.5 sm:p-4 lg:gap-4 lg:px-8 lg:pt-5 lg:pb-6">
        {/* Always there, so a search or a scroll position survives a visit to a thread on a phone. */}
        <ConversationList views={views} activeId={activeId} explicit={!!routeId} className={cn(routeId && "hidden md:flex")} />

        {showThread && (
          <div className="flex min-h-0 min-w-0 flex-1">
            {active ? (
              // Keyed: each conversation gets its own scroll position and "new messages" mark.
              <Thread key={active.conversation.id} view={active} autoFocus={!!routeId} />
            ) : (
              <div className="gw-panel flex flex-1 items-center justify-center">
                <EmptyState
                  icon={<MessageCircleOff className="size-4" />}
                  title="Cette conversation n'existe pas"
                  hint="Elle a peut-être été supprimée, ou elle ne vous concerne pas."
                  action={
                    <Button asChild variant="outline">
                      <Link href={CHAT_PATH}>Retour aux messages</Link>
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
