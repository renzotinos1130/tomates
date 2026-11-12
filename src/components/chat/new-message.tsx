"use client";

import { SquarePen } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMe, useMembers } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { ID } from "@/lib/types";

/** « Nouveau message » : pick a teammate, the direct conversation opens (or is created). */
export function NewMessage({ onPick }: { onPick: (memberId: ID) => void }) {
  const [open, setOpen] = useState(false);
  // A screen one leaves is kept alive, hidden: it must not come back with this picker still open.
  useLayoutEffect(() => () => setOpen(false), []);
  const members = useMembers();
  const me = useMe();
  const presence = useApp((s) => s.presence);
  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);
  const others = members.filter((m) => m.id !== me?.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-label="Nouveau message" className="max-sm:af-compact">
          <SquarePen /> Nouveau message
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-0 rounded-xl p-0">
        {others.length === 0 ? (
          <p className="p-4 text-[13px] leading-relaxed text-muted-foreground">
            Vous êtes seul dans l&apos;équipe pour l&apos;instant. Invitez vos partenaires depuis la page Équipe, puis
            écrivez-leur ici.
          </p>
        ) : (
          <Command>
            <CommandInput placeholder="À qui écrire ?" />
            <CommandList className="max-h-72">
              <CommandEmpty>Personne à ce nom.</CommandEmpty>
              <CommandGroup heading="Équipe">
                {others.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.full_name} ${m.email}`}
                    onSelect={() => {
                      setOpen(false);
                      onPick(m.id);
                    }}
                    className="gap-2.5"
                  >
                    <MemberAvatar member={m} size="sm" online={online.has(m.id) ? true : undefined} />
                    <span className="truncate">{m.full_name}</span>
                    {online.has(m.id) && <span className="ml-auto shrink-0 text-xs text-muted-foreground">En ligne</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
