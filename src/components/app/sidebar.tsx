"use client";

import {
  CalendarCheck2,
  CircleCheckBig,
  LayoutGrid,
  LogIn,
  LogOut,
  MessagesSquare,
  PanelLeftClose,
  Pin,
  Plus,
  RotateCcw,
  Search,
  UserCog,
  UserRoundPen,
  Users,
  Workflow,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/kit/logo";
import { AvatarStack, MemberAvatar } from "@/components/kit/member-avatar";
import { ProjectIcon } from "@/components/kit/project-icon";
import { useWaitingMembersCount } from "@/components/settings/members-section";
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
import { CHAT_PATH } from "@/lib/chat";
import { useChatUnread } from "@/lib/chat-hooks";
import { useAllTasks, useLocalState, useMe, useMeetings, useMembers, useProjects } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import { resetDemoData, signOut, switchDemoIdentity } from "./boot";
import { GlassSettingsButton, useGlass } from "./glass";
import { ProjectDialog } from "./project-dialog";

/** Widths of the navigation on large screens: open, and folded to a rail of icons. */
export const NAV_WIDTH = 248;
export const NAV_RAIL_WIDTH = 60;

/**
 * Whether the navigation is pinned open. Left alone (the default) it rests as a
 * rail of icons and opens under the pointer. A personal choice, kept in this browser.
 */
export function useNavPinned() {
  return useLocalState<boolean>("tthq:nav:pinned", false);
}

/** The pointer must rest this long on the rail before it opens: crossing it opens nothing. */
const PEEK_OPEN_MS = 90;
/** Grace after the pointer leaves, so brushing past the edge does not close it. */
const PEEK_CLOSE_MS = 260;

const ICON = { className: "size-[18px]", strokeWidth: 1.75 } as const;

/** A count after a label: open tasks, unread messages. */
function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-navy-900/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-navy-600 tabular">
      {children}
    </span>
  );
}

/** Messages that wait for me: the one count of the navigation that asks for attention. */
function Unread({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} ${count >= 2 ? "non lus" : "non lu"}`}
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-tomato-600 px-1.5 text-[11px] leading-none font-semibold text-white tabular"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** A keyboard shortcut after a label. */
function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] leading-none font-normal text-navy-500">{children}</span>;
}

/** What appears when the navigation opens and goes when it folds, at the pace of the labels. */
function Fade({ show, className, children }: { show: boolean; className?: string; children: React.ReactNode }) {
  const still = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: still ? 0 : 0.12 }}
          className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * The tomato and the name. On the rail only the tomato is left. The name is
 * laid over the header rather than in its flow: the tomato never moves when
 * the navigation opens or folds.
 */
function Brand() {
  const { collapsed } = useSidebar();
  return (
    <div className="relative flex items-center">
      <Logo size={28} />
      <Fade
        show={!collapsed}
        className="absolute top-1/2 left-[38px] -translate-y-1/2 text-[15px] font-semibold tracking-tight whitespace-nowrap text-navy-900"
      >
        Team Tomate
      </Fade>
    </div>
  );
}

/** Same box open or folded (52px high, the tomato 16px from the left): nothing jumps under the pointer. */
const headerClass = (collapsed: boolean, mobile?: boolean) =>
  mobile ? "h-[68px] pl-[66px]" : collapsed ? "mt-1 mb-1" : "px-4";

/** Static chrome shown while the workspace loads (and in the prerendered shell). */
function NavSkeleton({ mobile }: { mobile?: boolean }) {
  const { collapsed } = useSidebar();
  return (
    <div className="flex h-full flex-col" aria-hidden="true">
      <SidebarHeader className={headerClass(collapsed, mobile)}>
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
    // One row, open or folded: the avatar stays where it is, on the axis of the icons.
    <SidebarFooter className="justify-start gap-1 px-2.5 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? `Compte : ${me?.full_name ?? ""}` : undefined}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1.5 text-left transition-colors hover:bg-white/30 focus-ring"
          >
            <MemberAvatar member={me} size="md" online />
            <Fade show={!collapsed} className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-navy-900">{me?.full_name ?? "—"}</span>
              <span className="block truncate text-[11px] text-navy-500">
                {mode === "demo" ? "Mode démo" : me?.role === "admin" ? "Administrateur" : "Partenaire"}
              </span>
            </Fade>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
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
              {/* Nobody signs in to the demo: this is the way to look at the sign-in screen. */}
              <DropdownMenuItem asChild>
                <Link href="/login" onClick={onNavigate}>
                  <LogIn /> Écran de connexion
                </Link>
              </DropdownMenuItem>
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
      {/* On the rail there is only room for who I am: the look of the app waits for the navigation to open. */}
      <Fade show={!collapsed} className="flex shrink-0">
        <GlassSettingsButton settings={glass.settings} update={glass.update} reset={glass.reset} />
      </Fade>
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
  const waiting = useWaitingMembersCount();
  const unread = useChatUnread();
  const { collapsed } = useSidebar();
  const [pinned] = useNavPinned();

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
      <SidebarHeader className={headerClass(collapsed, mobile)} expandLabel="Garder le menu ouvert">
        <Brand />
        {!mobile && (
          // Open under the pointer, the pin keeps it there; pinned, the same button lets it go.
          <SidebarToggle
            className="ml-auto"
            aria-label="Garder le menu ouvert"
            aria-pressed={pinned}
            aria-expanded={undefined}
            title={pinned ? "Replier le menu (⌘B)" : "Garder le menu ouvert (⌘B)"}
          >
            {pinned ? (
              <PanelLeftClose className="size-[17px]" strokeWidth={1.75} />
            ) : (
              <Pin className="size-4" strokeWidth={1.75} />
            )}
          </SidebarToggle>
        )}
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
            href={CHAT_PATH}
            icon={
              <>
                <MessagesSquare {...ICON} />
                {/* On the rail the count has no room: a dot says there is something to read. */}
                {collapsed && unread > 0 && (
                  <span className="absolute -top-px -right-0.5 size-2 rounded-full bg-tomato-600 ring-2 ring-white/80" />
                )}
              </>
            }
            active={pathname.startsWith(CHAT_PATH)}
            badge={unread > 0 ? <Unread count={unread} /> : undefined}
            tooltip={unread > 0 ? `Messages (${unread} ${unread >= 2 ? "non lus" : "non lu"})` : "Messages"}
            onClick={onNavigate}
          >
            Messages
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
                  onClick={() => {
                    onNavigate?.();
                    setProjectDialog(true);
                  }}
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

        {/* Administrators only: who has access, and with which role. */}
        {me?.role === "admin" && (
          <SidebarSection label="Paramètres">
            <SidebarItem
              href="/parametres"
              icon={<UserCog {...ICON} />}
              active={pathname.startsWith("/parametres")}
              badge={waiting > 0 ? <Count>{waiting}</Count> : undefined}
              tooltip={waiting > 0 ? `Membres (${waiting} en attente)` : "Membres"}
              onClick={onNavigate}
            >
              Membres
            </SidebarItem>
          </SidebarSection>
        )}
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

/**
 * The navigation on large screens: a sheet of glass. Left alone it is a rail
 * of icons beside the window; it opens under the pointer, over the window,
 * and folds again when the pointer leaves. Pinned (the button in its header,
 * or ⌘B) it stays open and the window makes room for it.
 *
 * - Only a pointer that moves opens it: a page that loads, or folds, under a
 *   resting pointer does not.
 * - Choosing a destination folds it at once, and it stays folded until the
 *   pointer has left: the screen one asked for is not covered by the menu.
 * - It does not fold while one of its own menus is open (account, appearance).
 * - A finger does not hover: on a touch screen the tomato pins it open.
 */
export function Sidebar() {
  const [pinned, setPinned] = useNavPinned();
  const [peek, setPeek] = useState(false);
  const zone = useRef<HTMLDivElement | null>(null);
  /** `inside`: the pointer has moved over the zone since it came in. `muted`: folded by hand, wait for it to leave. */
  const hover = useRef({ inside: false, muted: false, peek: false, timer: null as number | null });

  /** Decides where the navigation should be, and gets there after the delay for that direction. */
  const settle = useCallback(() => {
    const h = hover.current;
    if (h.timer !== null) window.clearTimeout(h.timer);
    h.timer = null;
    const wanted = () =>
      !h.muted && (h.inside || !!zone.current?.querySelector('[aria-haspopup][aria-expanded="true"]'));
    const open = wanted();
    if (open === h.peek) return;
    h.timer = window.setTimeout(
      () => {
        h.timer = null;
        if (wanted() !== open) return;
        h.peek = open;
        setPeek(open);
      },
      open ? PEEK_OPEN_MS : PEEK_CLOSE_MS,
    );
  }, []);

  /** Folds now, and stays folded until the pointer has left. */
  const fold = useCallback(() => {
    const h = hover.current;
    if (h.timer !== null) window.clearTimeout(h.timer);
    h.timer = null;
    h.muted = h.inside;
    h.peek = false;
    setPeek(false);
  }, []);

  // Listened to on the element itself, not through React: the menus, tooltips and dialogs of the
  // navigation are drawn elsewhere in the page (portals) and must not count as "over the navigation".
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const h = hover.current;
    const move = (e: PointerEvent) => {
      if (h.inside || e.pointerType === "touch") return;
      h.inside = true;
      settle();
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      h.inside = false;
      h.muted = false;
      settle();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    // A menu of the navigation closing (a choice made, Escape) is the moment to fold, if the pointer is elsewhere.
    const observer = new MutationObserver(settle);
    observer.observe(el, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      observer.disconnect();
      if (h.timer !== null) window.clearTimeout(h.timer);
      h.timer = null;
    };
  }, [settle]);

  return (
    // The zone reaches the edges of the screen: throwing the pointer to the left edge stays inside.
    <div ref={zone} className="absolute inset-y-0 left-0 z-30 hidden py-3.5 pl-3.5 lg:block">
      <SidebarRoot
        variant="collapsible"
        bare
        collapsed={!pinned && !peek}
        onCollapsedChange={(collapse) => {
          // The tomato of the rail, or the pin of a navigation open under the pointer: keep it open.
          if (!collapse || !pinned) setPinned(true);
          else {
            setPinned(false);
            fold();
          }
        }}
        width={NAV_WIDTH}
        collapsedWidth={NAV_RAIL_WIDTH}
        aria-label="Navigation principale"
        data-peek={!pinned && peek ? "true" : undefined}
        className="gw-glass nav-glass rounded-[24px]"
      >
        <NavBody onNavigate={fold} />
      </SidebarRoot>
    </div>
  );
}
