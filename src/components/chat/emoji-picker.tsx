"use client";

import { Smile } from "@/components/kit/icons";
import { useLayoutEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** The handful a team actually uses at work. The tomato comes first, of course. */
const EMOJI: [string, string][] = [
  ["🍅", "Tomate"],
  ["👍", "Pouce levé"],
  ["🙏", "Merci"],
  ["🎉", "Bravo"],
  ["✅", "Fait"],
  ["👀", "Je regarde"],
  ["🔥", "Feu"],
  ["🚀", "Fusée"],
  ["😀", "Sourire"],
  ["😂", "Rire"],
  ["😅", "Sourire gêné"],
  ["🤔", "Je réfléchis"],
  ["😬", "Grimace"],
  ["😎", "Lunettes de soleil"],
  ["🥳", "Fête"],
  ["😴", "Dodo"],
  ["❤️", "Cœur"],
  ["👏", "Applaudissements"],
  ["🙌", "Mains levées"],
  ["💪", "Biceps"],
  ["🤝", "Poignée de main"],
  ["👋", "Salut"],
  ["💡", "Idée"],
  ["✨", "Étincelles"],
  ["📌", "Épingle"],
  ["📅", "Calendrier"],
  ["⏰", "Réveil"],
  ["☕", "Café"],
  ["⚠️", "Attention"],
  ["❌", "Non"],
  ["❓", "Question"],
  ["💬", "Bulle"],
];

/** A small sheet of emoji; the choice is inserted where the caret is. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  /** After a choice the caret goes back to the text (the caller's job), not to this button. */
  const picked = useRef(false);
  // A screen one leaves is kept alive, hidden: it must not come back with this sheet still open.
  useLayoutEffect(() => () => setOpen(false), []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insérer un émoji"
          title="Insérer un émoji"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-navy-600 transition-colors hover:bg-navy-900/[0.06] hover:text-navy-900 focus-ring data-[state=open]:bg-navy-900/[0.07] data-[state=open]:text-navy-900"
        >
          <Smile className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-auto gap-0 rounded-2xl p-2"
        onCloseAutoFocus={(e) => {
          if (picked.current) e.preventDefault();
          picked.current = false;
        }}
      >
        <div role="group" aria-label="Émojis" className="grid grid-cols-8 gap-0.5">
          {EMOJI.map(([emoji, name]) => (
            <button
              key={emoji}
              type="button"
              aria-label={name}
              title={name}
              onClick={() => {
                picked.current = true;
                onPick(emoji);
                setOpen(false);
              }}
              className="flex size-8 items-center justify-center rounded-lg text-[18px] leading-none transition-transform hover:scale-125 hover:bg-navy-900/[0.05] focus-ring"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
