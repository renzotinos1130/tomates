"use client";

import { format } from "date-fns";
import { Clock, Dot, Mail, MoreHorizontal, Search, ShieldCheck, ShieldOff, UserCheck, UserPlus, UserX, X } from "@/components/kit/icons";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { locale, relativeTime } from "@/lib/dates";
import { useMe, useNow } from "@/lib/hooks";
import { revokeInvite, ui, updateMember, useApp } from "@/lib/store";
import type { Member, MemberInvite, MemberRole } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { InviteDialog } from "./invite-dialog";
import { isLastActiveAdmin, LAST_ADMIN_MESSAGE, ROLE_META } from "./roles";

/** "léa" finds "Léa": compare without accents or case. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** « 12 oct. 2026 » */
const joinedOn = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale });

/** Accounts that exist but cannot open the workspace yet: the nav can badge them. */
export function useWaitingMembersCount(): number {
  return useApp((s) => Object.values(s.members).reduce((n, m) => n + (m.active ? 0 : 1), 0));
}

/*
 * The columns follow the width of the table, not of the screen. On a phone only the name and
 * the actions remain; the role and the address fold under the name (see `Folded`).
 * `w-full max-w-0` lets the name cell take what is left and truncate instead of widening the table.
 */
const NAME_CELL = "w-full max-w-0 ps-5";
const ROLE_CELL = "hidden @lg/members:table-cell";
const EMAIL_CELL = "hidden max-w-[260px] truncate text-navy-700 @[40rem]/members:table-cell";
const JOINED_CELL = "hidden whitespace-nowrap @4xl/members:table-cell";

/** Second line of the name cell: whatever no longer has a column of its own. */
function Folded({ role, email }: { role: string; email: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-xs text-navy-600 @[40rem]/members:hidden">
      <span className="shrink-0 @lg/members:hidden">{role} ·</span>
      <span className="truncate">{email}</span>
    </p>
  );
}

function RoleLabel({ role, waiting = false, quiet = false }: { role: MemberRole; waiting?: boolean; quiet?: boolean }) {
  const Icon = waiting ? Clock : ROLE_META[role].icon;
  return (
    <span className={cn("flex items-center gap-2 whitespace-nowrap", quiet && "text-navy-600")}>
      <Icon
        className={cn("size-[18px] shrink-0", waiting ? "text-sun-600" : "text-navy-500")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {waiting ? "En attente" : ROLE_META[role].label}
    </span>
  );
}

function MemberRow({ member, all, isMe }: { member: Member; all: Member[]; isMe: boolean }) {
  const admin = member.role === "admin";
  const locked = isLastActiveAdmin(member, all);

  const toggleRole = () => {
    if (admin && locked) return void toast.error(LAST_ADMIN_MESSAGE);
    void updateMember(member.id, { role: admin ? "member" : "admin" });
  };
  const activate = () => void updateMember(member.id, { active: true });
  const deactivate = () => {
    if (locked) return void toast.error(LAST_ADMIN_MESSAGE);
    ui.confirm({
      title: `Désactiver l'accès de ${member.full_name} ?`,
      description:
        "Cette personne ne pourra plus ouvrir l'espace. Ses tâches et ses commentaires restent en place, et vous pourrez réactiver son accès ici.",
      confirmLabel: "Désactiver l'accès",
      destructive: true,
      onConfirm: () => updateMember(member.id, { active: false }),
    });
  };

  return (
    <TableRow data-member={member.id}>
      <TableCell className={NAME_CELL}>
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberAvatar member={member} size="md" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 font-medium text-navy-900">
              <span className="truncate">{member.full_name}</span>
              {isMe && <span className="shrink-0 text-[11px] font-medium text-navy-500">vous</span>}
            </p>
            <Folded role={member.active ? ROLE_META[member.role].label : "En attente"} email={member.email} />
          </div>
        </div>
      </TableCell>
      <TableCell className={EMAIL_CELL}>{member.email}</TableCell>
      <TableCell className={ROLE_CELL}>
        <RoleLabel role={member.role} waiting={!member.active} />
      </TableCell>
      <TableCell className={cn(JOINED_CELL, "text-navy-700 tabular")}>{joinedOn(member.created_at)}</TableCell>
      <TableCell className="ps-0 pe-3">
        {/* No administration of your own row: you cannot demote or lock yourself out. */}
        {!isMe && (
          <div className="flex items-center justify-end gap-1.5">
            {!member.active && (
              <>
                {/* One tap to approve. On a narrow table the label goes, so the names keep their room. */}
                <Button
                  size="sm"
                  aria-label={`Activer l'accès de ${member.full_name}`}
                  onClick={activate}
                  className="hidden @lg/members:inline-flex"
                >
                  <UserCheck /> Activer
                </Button>
                <Button
                  size="icon"
                  aria-label={`Activer l'accès de ${member.full_name}`}
                  onClick={activate}
                  className="@lg/members:hidden"
                >
                  <UserCheck />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions pour ${member.full_name}`} className="text-navy-500">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {!member.active && (
                  <DropdownMenuItem onSelect={activate}>
                    <UserCheck /> Activer l&apos;accès
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={toggleRole}>
                  {admin ? <ShieldOff /> : <ShieldCheck />}
                  {admin ? "Retirer le rôle d'administrateur" : "Nommer administrateur"}
                </DropdownMenuItem>
                {member.active && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={deactivate}>
                      <UserX /> Désactiver l&apos;accès
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function InviteRow({ invite, now }: { invite: MemberInvite; now: Date }) {
  return (
    <TableRow data-invite={invite.email}>
      <TableCell className={NAME_CELL}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-navy-300 text-navy-500">
            <Mail className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-navy-700">
              Invitation envoyée <span className="text-navy-500">· {relativeTime(invite.created_at, now)}</span>
            </p>
            <Folded role={ROLE_META[invite.role].label} email={invite.email} />
          </div>
        </div>
      </TableCell>
      <TableCell className={EMAIL_CELL}>{invite.email}</TableCell>
      <TableCell className={ROLE_CELL}>
        <RoleLabel role={invite.role} quiet />
      </TableCell>
      <TableCell className={cn(JOINED_CELL, "text-navy-500")}>
        <span aria-label="Pas encore connectée">—</span>
      </TableCell>
      <TableCell className="ps-0 pe-3">
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retirer l'invitation de ${invite.email}`}
                onClick={() => void revokeInvite(invite.email)}
                className="text-navy-500 hover:text-coral-600"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retirer l&apos;invitation</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Who has access to the workspace, and in which role. Laid out like the
 * "members" block it is modelled on: a header tile (title, count, search,
 * invite), then one table for everybody: members, accounts waiting for
 * approval, and invitations nobody has used yet.
 */
export function MembersSection() {
  const titleId = useId();
  const me = useMe();
  const now = useNow();
  const membersMap = useApp((s) => s.members);
  const invitesMap = useApp((s) => s.invites);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);

  const all = useMemo(() => Object.values(membersMap), [membersMap]);
  const { active, waiting, invites } = useMemo(() => {
    const byName = (a: Member, b: Member) => a.full_name.localeCompare(b.full_name, "fr");
    return {
      active: all.filter((m) => m.active).sort(byName),
      waiting: all.filter((m) => !m.active).sort(byName),
      invites: Object.values(invitesMap).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    };
  }, [all, invitesMap]);

  const q = fold(query.trim());
  const matches = (...fields: string[]) => !q || fields.some((f) => fold(f).includes(q));
  // Members first, then the accounts that still need a decision, then unused invitations.
  const members = [...active, ...waiting].filter((m) => matches(m.full_name, m.email));
  const pendingInvites = invites.filter((i) => matches(i.email));
  const waitingCount = waiting.length + invites.length;

  const closeSearch = () => {
    setQuery("");
    setSearching(false);
  };

  return (
    <section aria-labelledby={titleId}>
      <div className="gw-panel gw-reveal flex justify-between gap-4 max-[32rem]:flex-col min-[32rem]:items-center">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[17px] leading-6 font-medium tracking-[-0.02em] text-navy-900">
            Membres
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center text-[13px] text-navy-600">
            <span>Team Tomate</span>
            <Dot className="size-5 text-navy-400" aria-hidden="true" />
            <span>{plural(active.length, "membre")}</span>
            {waitingCount > 0 && (
              <>
                <Dot className="size-5 text-navy-400" aria-hidden="true" />
                <span>{waitingCount} en attente</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {searching ? (
            <div className="relative min-w-0 flex-1 min-[32rem]:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-navy-500" aria-hidden="true" />
              <Input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                onBlur={() => !query && setSearching(false)}
                placeholder="Nom ou courriel"
                aria-label="Rechercher par nom ou courriel"
                className="h-8 w-full bg-white/70 pr-8 pl-8 min-[32rem]:w-56 [&::-webkit-search-cancel-button]:hidden"
              />
              <button
                type="button"
                aria-label="Fermer la recherche"
                // Keep the field focused until the click lands: its blur would unmount this button first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeSearch}
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-navy-500 hover:bg-navy-900/[0.06] hover:text-navy-900 focus-ring"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Rechercher un membre" onClick={() => setSearching(true)}>
                  <Search />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rechercher</TooltipContent>
            </Tooltip>
          )}
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> Inviter des membres
          </Button>
        </div>
      </div>

      <div className="card-surface gw-reveal @container/members mt-4 overflow-hidden" style={{ animationDelay: "60ms" }}>
        <Table aria-labelledby={titleId}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-full ps-5">Nom</TableHead>
              <TableHead className={EMAIL_CELL}>Courriel</TableHead>
              <TableHead className={ROLE_CELL}>Rôle</TableHead>
              <TableHead className={JOINED_CELL}>Arrivée</TableHead>
              <TableHead className="w-px ps-0 pe-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} all={all} isMe={m.id === me?.id} />
            ))}
            {pendingInvites.map((i) => (
              <InviteRow key={i.email} invite={i} now={now} />
            ))}
            {members.length + pendingInvites.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-navy-600">
                  Personne ne correspond à « {query.trim()} ».
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="gw-reveal mt-3 px-1 text-xs leading-relaxed text-navy-600" style={{ animationDelay: "120ms" }}>
        Un partenaire voit et modifie les projets, les tâches et les meetings. Un administrateur gère aussi les membres
        et les accès.
      </p>

      <InviteDialog open={inviting} onOpenChange={setInviting} />
    </section>
  );
}
