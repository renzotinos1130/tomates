"use client";

import { useMemo, useSyncExternalStore } from "react";
import { conversationViews, type ConversationView } from "./chat";
import { useApp } from "./store";
import type { ChatMessage, ID } from "./types";

/** Tailwind's `md`: from there on, the list and the thread sit side by side. */
const TWO_PANES = "(min-width: 768px)";
const subscribeTwoPanes = (cb: () => void) => {
  const query = window.matchMedia(TWO_PANES);
  query.addEventListener("change", cb);
  return () => query.removeEventListener("change", cb);
};

/** False on a phone, where the chat shows one pane at a time (the list, then a thread). */
export function useTwoPanes(): boolean {
  return useSyncExternalStore(
    subscribeTwoPanes,
    () => window.matchMedia(TWO_PANES).matches,
    () => true,
  );
}

/**
 * My conversations, as the list shows them (the channel first, then direct
 * conversations by last activity). `keepId` keeps a still-empty direct
 * conversation in the list while it is open.
 */
export function useConversations(keepId: ID | null = null): ConversationView[] {
  const conversations = useApp((s) => s.chat_conversations);
  const messages = useApp((s) => s.chat_messages);
  const participants = useApp((s) => s.chat_participants);
  const members = useApp((s) => s.members);
  const meId = useApp((s) => s.meId);
  return useMemo(
    () =>
      conversationViews({
        conversations: Object.values(conversations),
        messages: Object.values(messages),
        participants: Object.values(participants),
        members,
        meId,
        keepId,
      }),
    [conversations, messages, participants, members, meId, keepId],
  );
}

/** How many messages wait for me, all conversations together (the navigation badge). */
export function useChatUnread(): number {
  const views = useConversations();
  return useMemo(() => views.reduce((n, v) => n + v.unread, 0), [views]);
}

/** Messages of one conversation, oldest first. */
export function useThreadMessages(conversationId: ID | null): ChatMessage[] {
  const messages = useApp((s) => s.chat_messages);
  return useMemo(
    () =>
      conversationId
        ? Object.values(messages)
            .filter((m) => m.conversation_id === conversationId)
            .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
        : [],
    [messages, conversationId],
  );
}
