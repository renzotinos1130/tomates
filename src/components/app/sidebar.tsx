"use client";

import {
  CalendarCheck2,
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
import { useAllTasks, useMe, useMeetings, useMembers, useProjects } from "@/lib/hooks";
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
        "group flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors duration-150 focus-ring",
        // The current page is a lighter pane laid on the glass, as on the reference's rail.
        active
          ? "bg-white/50 font-medium text-navy-900 shadow-[0_3px_8px_rgb(13_27_51/0.07)]"
          : "text-navy-700 hover:bg-white/25 hover:text-navy-900",
      )}
    >
      <span className={cn("flex size-5 items-center justify-center", active ? "text-navy-900" : "text-navy-500 group-hover:text-navy-700")}>
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
      <span className="text-xs font-medium text-navy-500">{children}</span>
      {action}
    </div>
  );
}

/** The tomato and the name. The pixel tomato is the only ornament of the workspace. */
function Brand() {
  return (
    <>
      <Logo size={32} />
      <span className="truncate text-[15px] font-semibold tracking-tight text-navy-900">Team Tomate</span>
    </>
  );
}

/** A sidebar action that looks like a navigation row (search, new task). */
function ActionRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-navy-700 transition-colors hover:bg-white/25 hover:text-navy-900 focus-ring"
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[11px] text-navy-500">{hint}</span>
    </button>
  );
}

/** Static chrome shown while the workspace loads (and in the prerendered shell). */
function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden="true">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Brand />
      </div>
      <div className="h-[84px]" />
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
        <Brand />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {/* The one tomato-coloured control of the workspace: create a task, from anywhere. */}
        <div className="space-y-0.5 pb-4">
          <ActionRow
            label="Nouvelle tâche"
            hint="C"
            icon={
              <span className="flex size-5 items-center justify-center rounded-md bg-tomato-600 text-white">
                <Plus className="size-3.5" strokeWidth={2.5} />
              </span>
            }
            onClick={() => {
              onNavigate?.();
              ui.openQuickAdd();
            }}
          />
          <ActionRow
            label="Rechercher"
            hint="⌘K"
            icon={<Search className="size-4 text-navy-500 group-hover:text-navy-700" />}
            onClick={() => {
              onNavigate?.();
              ui.setCommandOpen(true);
            }}
          />
        </div>

        <div className="space-y-0.5">
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
            trailing={myOpen > 0 ? <span className="text-xs text-navy-500 tabular">{myOpen}</span> : null}
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
          <NavItem
            href="/equipe"
            icon={<Users className="size-4" />}
            label="Équipe"
            active={pathname.startsWith("/equipe")}
            trailing={online.length > 0 ? <AvatarStack members={online} size="xs" max={3} /> : null}
            onNavigate={onNavigate}
          />
        </div>

        <div className="mt-5 space-y-0.5">
          <SectionLabel
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Nouveau projet"
                    onClick={() => setProjectDialog(true)}
                    className="flex size-5 items-center justify-center rounded-md text-navy-500 transition-colors hover:bg-white/30 hover:text-navy-800 focus-ring"
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
                  <span className="text-xs text-navy-500 tabular">{openByProject[p.id]}</span>
                ) : null
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      {/* Footer: who am I, and how the app looks */}
      <div className="flex items-center gap-1 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/25 focus-ring"
            >
              <MemberAvatar member={me} size="md" online />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-navy-900">{me?.full_name ?? "—"}</span>
                <span className="block truncate text-[11px] text-navy-500">
                  {mode === "demo" ? "Mode démo" : me?.role === "admin" ? "Administrateur" : "Partenaire"}
                </span>
              </span>
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
        <GlassSettingsButton settings={glass.settings} update={glass.update} reset={glass.reset} />
      </div>

      <ProjectDialog open={projectDialog} onOpenChange={setProjectDialog} />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="gw-glass absolute inset-y-3.5 left-3.5 z-30 hidden w-[248px] overflow-hidden rounded-[24px] lg:block">
      <SidebarContent />
    </aside>
  );
}
