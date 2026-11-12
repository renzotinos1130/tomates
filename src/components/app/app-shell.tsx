"use client";

import { Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/kit/logo";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useHotkey, useMe } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { boot, retryBoot, signOut, syncPresence } from "./boot";
import { CommandMenu } from "./command-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { GlassBackdrop, useGlass } from "./glass";
import { Preloader } from "./preloader";
import { Sidebar, SidebarContent } from "./sidebar";

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

/** Where the window sits: a small margin on phones, beside the navigation on large screens. */
const WINDOW = "absolute inset-1.5 rounded-[20px] lg:inset-y-3.5 lg:right-3.5 lg:left-[276px] lg:rounded-[27px]";

/**
 * Shortest time the tomato stays on screen: the drop and one full salto (0.45 s + 0.7 s, see
 * globals.css). The glass clears as it lands.
 */
const PRELOADER_MIN_MS = 1150;

/**
 * Loads the workspace, then renders the navigation, the page and the global
 * overlays. While data loads, the chrome is already there and pages show
 * their skeleton (see `WhenReady`), so the first paint is immediate.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const mobileNav = useApp((s) => s.mobileNavOpen);
  const me = useMe();
  const glass = useGlass();
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
      style={glass.vars}
      // While the tomato is up, the panels wait on their first frame (see .gw-reveal).
      data-preloading={leaving ? undefined : ""}
    >
      <GlassBackdrop settings={glass.settings} />
      <Sidebar />
      <Sheet open={mobileNav} onOpenChange={ui.setMobileNav}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 gap-0 border-r-0 bg-paper-50/85 p-0 backdrop-blur-2xl data-[side=left]:w-72"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Menu principal</SheetDescription>
          <SidebarContent onNavigate={() => ui.setMobileNav(false)} />
        </SheetContent>
      </Sheet>
      {/*
        The glass window floats over the scene, with the picture showing all around it. Its frost
        is a layer of its own, BEHIND the scroller: browsers ignore a backdrop-filter nested inside
        another one, and the sticky page headers need theirs to blur what scrolls under them.
      */}
      <div aria-hidden="true" className={cn("gw-glass pointer-events-none z-10", WINDOW)} />
      {/* The only scrolling surface of the app. */}
      <div id="app-scroll" className={cn("z-10 overflow-x-hidden overflow-y-auto", WINDOW)}>
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
