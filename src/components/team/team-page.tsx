"use client";

import { Check, MoreHorizontal, Pencil, ShieldCheck } from "@/components/kit/icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ColorSwatches } from "@/components/app/project-dialog";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAllTasks, useMe, useWeek, useWeekPriorities } from "@/lib/hooks";
import { updateMember, useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import type { Member, MemberColor } from "@/lib/types";


function ProfileForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const [name, setName] = useState(member.full_name);
  const [color, setColor] = useState<MemberColor>(member.color);
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await updateMember(member.id, { full_name: name.trim(), color });
        onDone();
      }}
    >
      <DialogHeader>
        <DialogTitle>Mon profil</DialogTitle>
        <DialogDescription>Votre nom et votre couleur vous identifient sur chaque tâche.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-4">
        <MemberAvatar member={{ ...member, full_name: name || member.full_name, color }} size="2xl" />
        <div className="grid flex-1 gap-2">
          <Label htmlFor="profile-name">Nom complet</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Couleur d&apos;identification</Label>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}

function ProfileDialog({ member, open, onOpenChange }: { member: Member; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open: the form always starts from the saved profile. */}
        <ProfileForm member={member} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MemberCard({ member, index }: { member: Member; index: number }) {
  const me = useMe();
  const { startIso } = useWeek();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const presence = useApp((s) => s.presence);
  const [editing, setEditing] = useState(false);
  const isMe = me?.id === member.id;
  const online = isMe || presence.some((p) => p.member_id === member.id);

  const stats = useMemo(() => {
    const mine = tasks.filter((t) => t.assignee_id === member.id);
    const open = mine.filter(isOpen);
    const by = { todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0 };
    for (const t of open) by[t.status]++;
    return {
      open: open.length,
      by,
      priorities: open.filter((t) => priorityIds.has(t.id)).length,
      doneWeek: mine.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= startIso).length,
    };
  }, [tasks, member.id, priorityIds, startIso]);

  return (
    <article
      className="card-surface card-interactive animate-fade-up relative flex flex-col p-5"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <MemberAvatar member={member} size="xl" online={online} />
        <div className="min-w-0 flex-1">
          <h2 className="flex h-6 items-center gap-2 truncate text-[15px] font-semibold text-navy-900">
            <span className="truncate">{member.full_name}</span>
            {isMe && <span className="text-[11px] font-medium text-navy-400">· vous</span>}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-navy-500">
            {member.role === "admin" && <ShieldCheck className="size-3 text-navy-400" />}
            {member.role === "admin" ? "Administrateur" : "Partenaire"}
            <span className="text-navy-200">·</span>
            <span className={online ? "text-leaf-600" : "text-navy-400"}>{online ? "En ligne" : "Hors ligne"}</span>
          </p>
        </div>
        {/* Roles and access are administered in Paramètres; here, each person edits their own profile. */}
        {isMe && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions pour ${member.full_name}`}
                className="relative z-10 -mt-1 -mr-1.5 flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-900/[0.05] hover:text-navy-800 focus-ring"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Modifier mon profil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <dl className="mt-5 flex divide-x divide-navy-900/[0.08] border-y border-navy-900/[0.06] py-3">
        {[
          { label: stats.open >= 2 ? "ouvertes" : "ouverte", value: stats.open },
          { label: stats.priorities >= 2 ? "priorités" : "priorité", value: stats.priorities },
          { label: stats.doneWeek >= 2 ? "terminées cette semaine" : "terminée cette semaine", value: stats.doneWeek },
        ].map((s) => (
          <div key={s.label} className="flex-1 px-3 first:pl-0 last:pr-0">
            <dd className="text-lg leading-none font-semibold text-navy-900 tabular">{s.value}</dd>
            <dt className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>

      <Link
        href={isMe ? "/mes-taches" : `/mes-taches?membre=${member.id}`}
        aria-label={`Voir les tâches de ${member.full_name}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:outline-none"
      />
      {isMe && <ProfileDialog member={member} open={editing} onOpenChange={setEditing} />}
    </article>
  );
}

export function TeamPage() {
  const me = useMe();
  const membersMap = useApp((s) => s.members);
  const active = useMemo(
    () =>
      Object.values(membersMap)
        .filter((m) => m.active)
        .sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.full_name.localeCompare(b.full_name, "fr"))),
    [membersMap, me?.id],
  );
  return (
    <>
      <PageHeader title="Équipe" subtitle={`${active.length} partenaires`} />
      <main className="w-full max-w-[1180px] space-y-4 px-4 pt-5 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {active.map((m, i) => (
            <MemberCard key={m.id} member={m} index={i} />
          ))}
        </div>
        <p className="flex items-center gap-2 px-1 text-xs text-navy-600">
          {me?.role === "admin" ? (
            <>
              <ShieldCheck className="size-3.5 shrink-0 text-navy-500" />
              <span>
                Les invitations, les rôles et les accès se gèrent dans les{" "}
                <Link
                  href="/parametres"
                  className="font-medium text-navy-900 underline decoration-navy-900/25 underline-offset-2 hover:decoration-navy-900 focus-ring"
                >
                  paramètres
                </Link>
                .
              </span>
            </>
          ) : (
            <>
              <Check className="size-3.5 shrink-0 text-navy-500" /> Seuls les administrateurs peuvent inviter de nouveaux
              membres.
            </>
          )}
        </p>
      </main>
    </>
  );
}
