"use client";

import { Clock, RefreshCw, TriangleAlert } from "@/components/kit/icons";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { Logo } from "@/components/kit/logo";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { MenuToggle } from "@/components/ui/menu-toggle";
import { useHotkey, useMe } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { boot, retryBoot, signOut, syncPresence } from "./boot";
import { CommandMenu } from "./command-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { GlassBackdrop, useGlass } from "./glass";
import { Preloader } from "./preloader";
import { NAV_RAIL_WIDTH, NAV_WIDTH, Sidebar, SidebarContent, useNavPinned } from "./sidebar";
import { TomatoRain } from "./tomato-rain";

function FullPageMessage({
  icon,
  title,
  children,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <Logo size={48} />
        </div>
        <div className="mx-auto mb-2 flex justify-center text-navy-400">{icon}</div>
        <h1 className="text-lg font-semibold text-navy-900">{title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
        {actions && <div className="mt-6 flex justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Keeps presence in sync with the page being looked at (and the demo identity). */
function PresenceSync() {
  const status = useApp((s) => s.status);
  const meId = useApp((s) => s.meId);
  const pathname = usePathname();
  useEffect(() => {
    if (status === "ready") syncPresence(pathname);
  }, [status, pathname, meId]);
  return null;
}

/** The page scrolls inside the glass window: start each screen at the top. */
function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Where the window sits: a small margin on phones, beside the navigation on large screens.
 * It makes room for the navigation when it is pinned open (--nav-w), at the same pace; a
 * navigation that only opens under the pointer passes over it instead. It fades in once the
 * preloader leaves (see `data-preloading`).
 */
const WINDOW =
  "absolute inset-1.5 rounded-[20px] [transition:opacity_500ms_ease] lg:inset-y-3.5 lg:right-3.5 lg:left-[calc(var(--nav-w)+28px)] lg:rounded-[27px] lg:[transition:opacity_500ms_ease,left_240ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

/**
 * The same place without a sheet (the dashboard): the tiles are glass themselves, laid on the
 * scene, never glass on glass. The scroller reaches the edges of the screen, so the tiles slide
 * off them instead of being cut in mid-air, and keeps the margins of the window as padding
 * (which also leaves the shadows their room).
 */
const BARE =
  "absolute inset-0 p-1.5 lg:left-[calc(var(--nav-w)+14px)] lg:p-3.5 lg:[transition:left_240ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

/**
 * The cross inside the phone menu. It sits exactly over the menu button and is drawn as three
 * lines for one frame, so the lines are seen folding into the cross as the menu appears.
 */
function MobileNavClose({ open }: { open: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <MenuToggle
      open={drawn && open}
      onToggle={() => ui.setMobileNav(false)}
      className="absolute top-4 left-[18px] z-10 bg-white/70"
    />
  );
}

/**
 * Shortest time the tomato stays on screen: the drop, then two full rounds of hop and salto
 * (0.45 s + 2 × 1.4 s, see globals.css) — long enough to take the picture in. The app comes in
 * as it lands.
 */
const PRELOADER_MIN_MS = 3250;

/**
 * Loads the workspace, then renders the navigation, the page and the global
 * overlays. While data loads, the chrome is already there and pages show
 * their skeleton (see `WhenReady`), so the first paint is immediate.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const mobileNav = useApp((s) => s.mobileNavOpen);
  const bare = useApp((s) => s.bareWindow);
  const me = useMe();
  const glass = useGlass();
  const [navPinned, setNavPinned] = useNavPinned();
  const [minElapsed, setMinElapsed] = useState(false);
  const [preloaderGone, setPreloaderGone] = useState(false);
  const leaving = status !== "booting" && minElapsed;

  useEffect(() => {
    void boot();
    const timer = window.setTimeout(() => setMinElapsed(true), PRELOADER_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setPreloaderGone(true), 450);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useHotkey(
    "c",
    useCallback((e: KeyboardEvent) => {
      const s = useApp.getState();
      if (s.status !== "ready" || s.quickAdd.open || s.commandOpen || s.confirm) return;
      e.preventDefault();
      ui.openQuickAdd();
    }, []),
  );
  useHotkey(
    "k",
    useCallback((e: KeyboardEvent) => {
      if (useApp.getState().status !== "ready") return;
      e.preventDefault();
      ui.setCommandOpen(!useApp.getState().commandOpen);
    }, []),
    { meta: true },
  );
  // ⌘B pins the navigation open, or lets it go back to its rail.
  useHotkey(
    "b",
    useCallback(
      (e: KeyboardEvent) => {
        e.preventDefault();
        setNavPinned(!navPinned);
      },
      [navPinned, setNavPinned],
    ),
    { meta: true },
  );

  if (status === "error") {
    return (
      <FullPageMessage
        icon={<TriangleAlert className="size-5" />}
        title="Impossible de charger l'espace de travail"
        actions={
          <Button onClick={retryBoot}>
            <RefreshCw /> Réessayer
          </Button>
        }
      >
        {error ?? "Vérifiez votre connexion, puis réessayez."}
      </FullPageMessage>
    );
  }

  if (status === "pending-access") {
    return (
      <FullPageMessage
        icon={<Clock className="size-5" />}
        title="Accès en attente d'approbation"
        actions={
          <>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw /> Actualiser
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Se déconnecter
            </Button>
          </>
        }
      >
        Votre compte{me?.email ? ` (${me.email})` : ""} est créé, mais un administrateur de l&apos;équipe doit
        l&apos;activer avant que vous puissiez voir les projets.
      </FullPageMessage>
    );
  }

  return (
    <div
      className="gw-scope app-canvas relative h-dvh overflow-hidden"
      style={{ ...glass.vars, "--nav-w": `${navPinned ? NAV_WIDTH : NAV_RAIL_WIDTH}px` } as CSSProperties}
      // While the tomato is up, the panels wait on their first frame (see .gw-reveal).
      data-preloading={leaving ? undefined : ""}
      // The dashboard lays its tiles straight on the scene: no sheet of glass behind them.
      data-bare={bare ? "" : undefined}
    >
      <GlassBackdrop settings={glass.settings} />
      <Sidebar />
      {/* Phones: one button opens the navigation as a sheet of frosted glass over everything. */}
      <MenuToggle
        open={false}
        onToggle={() => ui.setMobileNav(true)}
        className="app-menu-toggle absolute top-4 left-[18px] z-30 bg-white/70 lg:hidden"
      />
      <DialogPrimitive.Root open={mobileNav} onOpenChange={ui.setMobileNav}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="gw-veil fixed inset-0 z-50 duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <MobileNavClose open={mobileNav} />
            <SidebarContent onNavigate={() => ui.setMobileNav(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {/*
        The glass window floats over the scene, with the picture showing all around it. It is a
        layer of its own, BEHIND the scroller: the sticky page headers blur what scrolls under
        them, and must not sit inside another glass surface to do so.
      */}
      {!bare && <div aria-hidden="true" className={cn("app-window gw-glass pointer-events-none z-10", WINDOW)} />}
      {/* The only scrolling surface of the app. */}
      <div id="app-scroll" className={cn("z-10 overflow-x-hidden overflow-y-auto", bare ? BARE : WINDOW)}>
        {children}
      </div>
      <Suspense fallback={null}>
        <PresenceSync />
        <ScrollReset />
        {status === "ready" && (
          <>
            <TaskSheet />
            <QuickAdd />
            <CommandMenu />
            <ConfirmDialog />
            <TomatoRain />
          </>
        )}
      </Suspense>
      {!preloaderGone && <Preloader leaving={leaving} />}
    </div>
  );
}

/** Page-level gate: skeleton until the workspace is loaded. */
export function WhenReady({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const ready = useApp((s) => s.status === "ready");
  if (!ready) return <>{fallback ?? <PageSkeleton />}</>;
  return <Suspense fallback={fallback ?? <PageSkeleton />}>{children}</Suspense>;
}

export function PageSkeleton() {
  return (
    <div className="w-full max-w-[1280px] px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10" aria-busy="true" aria-label="Chargement">
      <div className="h-4 w-56 animate-pulse rounded-md bg-navy-900/[0.06]" />
      <div className="mt-4 h-9 w-72 animate-pulse rounded-lg bg-navy-900/[0.07]" />
      <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card-surface h-28 animate-pulse opacity-70" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card-surface h-72 animate-pulse opacity-70 xl:col-span-2" />
        <div className="card-surface h-72 animate-pulse opacity-70" />
      </div>
    </div>
  );
}
