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
import {
  Sidebar as SidebarRoot,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarToggle,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAllTasks, useLocalState, useMe, useMeetings, useMembers, useProjects } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import { cn } from "@/lib/utils";
import { resetDemoData, signOut, switchDemoIdentity } from "./boot";
import { GlassSettingsButton, useGlass } from "./glass";
import { ProjectDialog } from "./project-dialog";

/** Widths of the navigation on large screens: open, and folded to a rail of icons. */
export const NAV_WIDTH = 248;
export const NAV_RAIL_WIDTH = 60;

/** Whether the navigation is folded to its rail. A personal choice, kept in this browser. */
export function useNavCollapsed() {
  return useLocalState<boolean>("tthq:nav:collapsed", false);
}

const ICON = { className: "size-[18px]", strokeWidth: 1.75 } as const;

/** A count after a label: open tasks, unread messages. */
function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-navy-900/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-navy-600 tabular">
      {children}
    </span>
  );
}

/** A keyboard shortcut after a label. */
function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] leading-none font-normal text-navy-500">{children}</span>;
}

/** The tomato and the name. On the rail only the tomato is left, and it unfolds the navigation. */
function Brand() {
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo size={28} />
      {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight text-navy-900">Team Tomate</span>}
    </div>
  );
}

/** Static chrome shown while the workspace loads (and in the prerendered shell). */
function NavSkeleton({ mobile }: { mobile?: boolean }) {
  const { collapsed } = useSidebar();
  return (
    <div className="flex h-full flex-col" aria-hidden="true">
      <SidebarHeader className={cn(mobile && "h-[68px] pl-[66px]")}>
        <Brand />
      </SidebarHeader>
      <div className="h-[84px]" />
      <div className="flex-1 space-y-3 px-5 pt-3">
        {[72, 56, 88, 0, 64, 52, 80].map((w, i) =>
          w === 0 ? (
            <div key={i} className="h-4" />
          ) : (
            <div
              key={i}
              className="h-4 animate-pulse rounded-md bg-navy-900/[0.06]"
              style={{ width: collapsed ? 20 : `${w}%` }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function NavBody({ onNavigate, mobile }: { onNavigate?: () => void; mobile?: boolean }) {
  const ready = useApp((s) => s.status === "ready");
  if (!ready) return <NavSkeleton mobile={mobile} />;
  return (
    <Suspense fallback={<NavSkeleton mobile={mobile} />}>
      <Nav onNavigate={onNavigate} mobile={mobile} />
    </Suspense>
  );
}

/** Who am I, and how the app looks. */
function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { collapsed } = useSidebar();
  const me = useMe();
  const members = useMembers();
  const mode = useApp((s) => s.mode);
  const glass = useGlass();

  return (
    <SidebarFooter className={collapsed ? "flex-col gap-1.5 py-2.5" : "gap-1 px-2 py-2"}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? `Compte : ${me?.full_name ?? ""}` : undefined}
            className={cn(
              "flex items-center rounded-[10px] text-left transition-colors hover:bg-white/30 focus-ring",
              collapsed ? "size-9 justify-center" : "min-w-0 flex-1 gap-2.5 p-1.5",
            )}
          >
            <MemberAvatar member={me} size="md" online />
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-navy-900">{me?.full_name ?? "—"}</span>
                <span className="block truncate text-[11px] text-navy-500">
                  {mode === "demo" ? "Mode démo" : me?.role === "admin" ? "Administrateur" : "Partenaire"}
                </span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-60">
          <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{me?.email}</DropdownMenuLabel>
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
    </SidebarFooter>
  );
}

function Nav({ onNavigate, mobile }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const me = useMe();
  const members = useMembers();
  const projects = useProjects();
  const tasks = useAllTasks();
  const meetings = useMeetings();
  const presence = useApp((s) => s.presence);
  const [projectDialog, setProjectDialog] = useState(false);

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
    <>
      <SidebarHeader className={cn(mobile && "h-[68px] pl-[66px]")}>
        <Brand />
        {!mobile && <SidebarToggle className="ml-auto" />}
      </SidebarHeader>

      <SidebarNav>
        {/* The one tomato-coloured mark of the navigation: create a task, from anywhere. */}
        <SidebarSection>
          <SidebarItem
            icon={
              <span className="flex size-5 items-center justify-center rounded-full bg-tomato-600 text-white">
                <Plus className="size-3.5" strokeWidth={2.5} />
              </span>
            }
            badge={<Hint>C</Hint>}
            onClick={() => {
              onNavigate?.();
              ui.openQuickAdd();
            }}
          >
            Nouvelle tâche
          </SidebarItem>
          <SidebarItem
            icon={<Search {...ICON} />}
            badge={<Hint>⌘K</Hint>}
            onClick={() => {
              onNavigate?.();
              ui.setCommandOpen(true);
            }}
          >
            Rechercher
          </SidebarItem>
        </SidebarSection>

        <SidebarSection label="Espace de travail">
          <SidebarItem href="/" icon={<LayoutGrid {...ICON} />} active={pathname === "/"} onClick={onNavigate}>
            Dashboard
          </SidebarItem>
          <SidebarItem
            href="/mes-taches"
            icon={<CircleCheckBig {...ICON} />}
            active={pathname.startsWith("/mes-taches")}
            badge={myOpen > 0 ? <Count>{myOpen}</Count> : undefined}
            onClick={onNavigate}
          >
            Mes tâches
          </SidebarItem>
          <SidebarItem
            href="/meeting"
            icon={<CalendarCheck2 {...ICON} />}
            active={pathname.startsWith("/meeting")}
            badge={
              live ? (
                <span title="Meeting en cours" className="flex size-4 items-center justify-center">
                  <span className="size-2 animate-pulse-ring rounded-full bg-coral-500 text-coral-500" />
                </span>
              ) : undefined
            }
            onClick={onNavigate}
          >
            Meeting du mercredi
          </SidebarItem>
          <SidebarItem
            href="/workflows"
            icon={<Workflow {...ICON} />}
            active={pathname.startsWith("/workflows")}
            onClick={onNavigate}
          >
            Workflows
          </SidebarItem>
          <SidebarItem
            href="/equipe"
            icon={<Users {...ICON} />}
            active={pathname.startsWith("/equipe")}
            badge={online.length > 0 ? <AvatarStack members={online} size="xs" max={3} /> : undefined}
            onClick={onNavigate}
          >
            Équipe
          </SidebarItem>
        </SidebarSection>

        <SidebarSection
          label="Projets"
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Nouveau projet"
                  onClick={() => setProjectDialog(true)}
                  className="flex size-5 items-center justify-center rounded-md text-navy-500 transition-colors hover:bg-white/40 hover:text-navy-900 focus-ring"
                >
                  <Plus className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Nouveau projet</TooltipContent>
            </Tooltip>
          }
        >
          {projects.map((p) => (
            <SidebarItem
              key={p.id}
              href={`/projets/${p.slug}`}
              icon={<ProjectIcon project={p} size="md" />}
              active={pathname === `/projets/${p.slug}`}
              badge={openByProject[p.id] ? <Count>{openByProject[p.id]}</Count> : undefined}
              onClick={onNavigate}
            >
              {p.name}
            </SidebarItem>
          ))}
        </SidebarSection>
      </SidebarNav>

      <UserFooter onNavigate={onNavigate} />
      <ProjectDialog open={projectDialog} onOpenChange={setProjectDialog} />
    </>
  );
}

/** The navigation inside the phone menu: always open, as wide as its container. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <SidebarRoot variant="default" bare width="100%" aria-label="Navigation principale" className="nav-glass">
      <NavBody onNavigate={onNavigate} mobile />
    </SidebarRoot>
  );
}

/** The navigation on large screens: a sheet of glass that folds to a rail of icons. */
export function Sidebar() {
  const [collapsed, setCollapsed] = useNavCollapsed();
  return (
    <div className="absolute inset-y-3.5 left-3.5 z-30 hidden lg:block">
      <SidebarRoot
        variant="collapsible"
        bare
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        width={NAV_WIDTH}
        collapsedWidth={NAV_RAIL_WIDTH}
        aria-label="Navigation principale"
        className="gw-glass nav-glass rounded-[24px]"
      >
        <NavBody />
      </SidebarRoot>
    </div>
  );
}
