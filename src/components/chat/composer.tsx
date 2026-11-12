"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AutoTextarea } from "@/components/kit/auto-textarea";
import { Button } from "@/components/ui/button";
import { CHAT_BODY_MAX } from "@/lib/chat";
import { sendChatMessage } from "@/lib/store";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./emoji-picker";

/**
 * What is being typed in each conversation, kept while moving between them
 * (this visit only). One shared place rather than a state per composer: the
 * same conversation can be on screen in more than one spot over time (the
 * router keeps left screens alive), and a sent message must not come back as
 * a draft somewhere else.
 */
const drafts = new Map<ID, string>();
const draftListeners = new Set<() => void>();
const subscribeDrafts = (cb: () => void) => {
  draftListeners.add(cb);
  return () => {
    draftListeners.delete(cb);
  };
};
function setDraft(conversationId: ID, value: string) {
  if (value) drafts.set(conversationId, value);
  else drafts.delete(conversationId);
  for (const listener of draftListeners) listener();
}
function useDraft(conversationId: ID): string {
  return useSyncExternalStore(
    subscribeDrafts,
    () => drafts.get(conversationId) ?? "",
    () => "",
  );
}

const number = new Intl.NumberFormat("fr-CA");

/**
 * Where a message is written. Enter sends, Shift + Enter starts a new line; on
 * a touch keyboard Enter is a new line and the button sends.
 */
export function Composer({
  conversationId,
  to,
  autoFocus = false,
}: {
  conversationId: ID;
  to: string;
  /** The conversation was just opened on purpose: ready to type (not on a touch screen, where it would raise the keyboard). */
  autoFocus?: boolean;
}) {
  const text = useDraft(conversationId);
  const setText = (value: string) => setDraft(conversationId, value);
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) field.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const body = text.trim();
  const tooLong = body.length > CHAT_BODY_MAX;
  const canSend = body.length > 0 && !tooLong && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setText("");
    const ok = await sendChatMessage(conversationId, body);
    setSending(false);
    // Not sent: give the text back rather than losing it (unless something new was typed meanwhile).
    if (!ok && !drafts.get(conversationId)) setText(body);
    field.current?.focus();
  };

  const insert = (emoji: string) => {
    const el = field.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <form
      className="shrink-0 px-2.5 pt-1 pb-2.5 sm:px-3.5 sm:pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-[24px] bg-white/60 p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_1px_2px_rgb(13_27_51/0.05)] transition-colors focus-within:bg-white/80",
          tooLong && "ring-2 ring-coral-500/60",
        )}
      >
        <EmojiPicker onPick={insert} />
        <AutoTextarea
          ref={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            // On a phone the Enter key belongs to the text; the button sends.
            if (window.matchMedia("(pointer: coarse)").matches) return;
            e.preventDefault();
            void send();
          }}
          placeholder={`Écrire à ${to}`}
          aria-label={`Message à ${to}`}
          aria-invalid={tooLong || undefined}
          enterKeyHint="enter"
          className="max-h-40 min-w-0 flex-1 self-center overflow-y-auto py-2 text-[13.5px] leading-[1.45] text-navy-900 placeholder:text-navy-500"
        />
        {/* On a phone the label leaves room for the text: the disc alone sends. */}
        <Button type="submit" size="lg" aria-label="Envoyer" disabled={!canSend} icon={<ArrowUp />} className="max-sm:af-compact">
          Envoyer
        </Button>
      </div>
      {/* On a phone this line only exists when there is a count to show. */}
      <div
        className={cn(
          "mt-1.5 items-center justify-between gap-3 px-3 text-[11px] leading-4 text-navy-500",
          body.length > CHAT_BODY_MAX - 400 ? "flex" : "hidden md:flex",
        )}
      >
        <span className="hidden md:inline">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</span>
        {body.length > CHAT_BODY_MAX - 400 && (
          <span className={cn("ml-auto tabular", tooLong && "font-medium text-coral-600")} role={tooLong ? "alert" : undefined}>
            {number.format(body.length)} / {number.format(CHAT_BODY_MAX)}
          </span>
        )}
      </div>
    </form>
  );
}
