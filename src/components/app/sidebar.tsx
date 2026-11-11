"use client";

import {
  CalendarCheck2,
  ChevronsUpDown,
  CircleCheckBig,
  LayoutGrid,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  UserRoundPen,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Logo } from "@/components/kit/logo";
import { AvatarStack, MemberAvatar } from "@/components/kit/member-avatar";
import { CountBadge, Kbd } from "@/components/kit/pills";
import { ProjectIcon } from "@/components/kit/project-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isMeetingDay } from "@/lib/dates";
import { useAllTasks, useMe, useMeetings, useMembers, useNow, useProjects } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import { cn } from "@/lib/utils";
import { resetDemoData, signOut, switchDemoIdentity } from "./boot";
import { GlassSettingsButton, useGlass } from "./glass";
import { ProjectDialog } from "./project-dialog";

function NavItem({
  href,
  icon,
  label,
  active,
  trailing,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  trailing?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13.5px] transition-all duration-150 focus-ring",
        active
          ? "bg-card font-medium text-navy-900 shadow-card"
          : "text-navy-600 hover:bg-white/45 hover:text-navy-900",
      )}
    >
      <span className={cn("flex size-5 items-center justify-center", active ? "text-tomato-600" : "text-navy-400 group-hover:text-navy-600")}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {trailing && <span className="ml-auto flex items-center">{trailing}</span>}
    </Link>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between px-2">
      <span className="text-[11px] font-medium tracking-wide text-navy-400 uppercase">{children}</span>
      {action}
    </div>
  );
}

/** Static chrome shown while the workspace loads (and in the prerendered shell). */
function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden="true">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-navy-900">Team Tomate HQ</div>
          <div className="truncate text-[11px] text-navy-400">Projet Prospero</div>
        </div>
      </div>
      <div className="px-3 pt-1 pb-3">
        <div className="h-8 rounded-lg bg-white/45" />
      </div>
      <div className="flex-1 space-y-2 px-5 pt-3">
        {[72, 56, 88, 0, 64, 52, 80].map((w, i) =>
          w === 0 ? (
            <div key={i} className="h-4" />
          ) : (
            <div key={i} className="h-4 animate-pulse rounded-md bg-navy-900/[0.06]" style={{ width: `${w}%` }} />
          ),
        )}
      </div>
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const ready = useApp((s) => s.status === "ready");
  if (!ready) return <SidebarSkeleton />;
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <SidebarNav onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const now = useNow();
  const me = useMe();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useAllTasks();
  const meetings = useMeetings();
  const mode = useApp((s) => s.mode);
  const presence = useApp((s) => s.presence);
  const [projectDialog, setProjectDialog] = useState(false);
  const glass = useGlass();

  const openByProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) if (isOpen(t)) map[t.project_id] = (map[t.project_id] ?? 0) + 1;
    return map;
  }, [tasks]);
  const myOpen = useMemo(() => tasks.filter((t) => isOpen(t) && t.assignee_id === me?.id).length, [tasks, me?.id]);
  const live = meetings.some((m) => m.status === "live");
  const online = useMemo(() => {
    const ids = new Set(presence.map((p) => p.member_id));
    return members.filter((m) => ids.has(m.id) && m.id !== me?.id);
  }, [presence, members, me?.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-navy-900">Team Tomate HQ</div>
          <div className="truncate text-[11px] text-navy-400">Projet Prospero</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 px-3 pt-1 pb-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            ui.setCommandOpen(true);
          }}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white/45 px-2.5 text-[13px] text-navy-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-colors hover:bg-white/70 hover:text-navy-700 focus-ring"
        >
          <Search className="size-3.5" />
          <span className="truncate">Rechercher…</span>
          <Kbd className="ml-auto bg-card">⌘K</Kbd>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Nouvelle tâche"
              onClick={() => {
                onNavigate?.();
                ui.openQuickAdd();
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tomato-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(134_35_22/0.4)] transition-colors hover:bg-tomato-700 focus-ring"
            >
              <Plus className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Nouvelle tâche <Kbd className="border-white/20 bg-white/10 text-white">C</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
        <div className="space-y-0.5">
          <SectionLabel>Vue d&apos;ensemble</SectionLabel>
          <NavItem
            href="/"
            icon={<LayoutGrid className="size-4" />}
            label="Dashboard"
            active={pathname === "/"}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/mes-taches"
            icon={<CircleCheckBig className="size-4" />}
            label="Mes tâches"
            active={pathname.startsWith("/mes-taches")}
            trailing={myOpen > 0 ? <CountBadge>{myOpen}</CountBadge> : null}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/meeting"
            icon={<CalendarCheck2 className="size-4" />}
            label="Meeting du mercredi"
            active={pathname.startsWith("/meeting")}
            trailing={
              live ? (
                <span title="Meeting en cours" className="flex size-4 items-center justify-center">
                  <span className="size-2 animate-pulse-ring rounded-full bg-coral-500 text-coral-500" />
                </span>
              ) : isMeetingDay(now) ? (
                <span title="C'est aujourd'hui" className="flex size-4 items-center justify-center">
                  <span className="size-2 rounded-full bg-sun-400 ring-[3px] ring-sun-100" />
                </span>
              ) : null
            }
            onNavigate={onNavigate}
          />
          <NavItem
            href="/workflows"
            icon={<Workflow className="size-4" />}
            label="Workflows"
            active={pathname.startsWith("/workflows")}
            onNavigate={onNavigate}
          />
        </div>

        <div className="space-y-0.5">
          <SectionLabel
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Nouveau projet"
                    onClick={() => setProjectDialog(true)}
                    className="flex size-5 items-center justify-center rounded-md text-navy-400 transition-colors hover:bg-white/55 hover:text-navy-700 focus-ring"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Nouveau projet</TooltipContent>
              </Tooltip>
            }
          >
            Projets
          </SectionLabel>
          {projects.map((p) => (
            <NavItem
              key={p.id}
              href={`/projets/${p.slug}`}
              icon={<ProjectIcon project={p} size="xs" />}
              label={p.name}
              active={pathname === `/projets/${p.slug}`}
              trailing={
                openByProject[p.id] ? (
                  <span className="text-[11.5px] text-navy-400 tabular">{openByProject[p.id]}</span>
                ) : null
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="space-y-0.5">
          <SectionLabel>Équipe</SectionLabel>
          <NavItem
            href="/equipe"
            icon={<Users className="size-4" />}
            label="Membres"
            active={pathname.startsWith("/equipe")}
            trailing={online.length > 0 ? <AvatarStack members={online} size="xs" max={3} /> : null}
            onNavigate={onNavigate}
          />
        </div>
      </nav>

      {/* Footer: appearance + who am I */}
      <div className="border-t border-navy-900/[0.07] p-2">
        <div className="px-1 pb-1.5">
          <GlassSettingsButton settings={glass.settings} update={glass.update} reset={glass.reset} />
        </div>
        {mode === "demo" && (
          <div className="mx-1 mb-2 rounded-lg bg-sun-50 px-2.5 py-2 text-[11.5px] leading-snug text-sun-800 ring-1 ring-sun-200/70 ring-inset">
            <span className="font-medium">Mode démo</span> — données fictives enregistrées dans ce navigateur.
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/45 focus-ring"
            >
              <MemberAvatar member={me} size="md" online />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-navy-900">{me?.full_name ?? "—"}</span>
                <span className="block truncate text-[11px] text-navy-400">
                  {me?.role === "admin" ? "Administrateur" : "Partenaire"}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-navy-300" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {me?.email}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/equipe" onClick={onNavigate}>
                <UserRoundPen /> Mon profil
              </Link>
            </DropdownMenuItem>
            {mode === "demo" ? (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Users /> Changer de profil (démo)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    {members.map((m) => (
                      <DropdownMenuItem key={m.id} onSelect={() => switchDemoIdentity(m.id)} className="gap-2">
                        <MemberAvatar member={m} size="xs" />
                        {m.full_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void resetDemoData()}>
                  <RotateCcw /> Réinitialiser la démo
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut /> Se déconnecter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProjectDialog open={projectDialog} onOpenChange={setProjectDialog} />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="gw-glass absolute inset-y-2.5 left-2.5 z-30 hidden w-[250px] overflow-hidden rounded-[26px] lg:block">
      <SidebarContent />
    </aside>
  );
}
