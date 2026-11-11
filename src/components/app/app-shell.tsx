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
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-sun-50 text-sun-600">
          {icon}
        </div>
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

/** Shortest time the tomato stays on screen, so the animation is never a flash. */
const PRELOADER_MIN_MS = 1100;

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
    <div className="gw-scope app-canvas relative h-dvh overflow-hidden" style={glass.vars}>
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
        The glass window. Its frost is a layer of its own, BEHIND the scroller: browsers ignore a
        backdrop-filter nested inside another one, and the sticky page headers need theirs to blur
        what scrolls under them.
      */}
      <div
        aria-hidden="true"
        className="gw-glass pointer-events-none absolute inset-0 z-10 lg:inset-y-2.5 lg:right-2.5 lg:left-[270px] lg:rounded-[26px]"
      />
      {/* The only scrolling surface of the app. */}
      <div
        id="app-scroll"
        className="relative z-10 h-full overflow-x-hidden overflow-y-auto lg:absolute lg:inset-y-2.5 lg:right-2.5 lg:left-[270px] lg:h-auto lg:rounded-[26px]"
      >
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
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10" aria-busy="true" aria-label="Chargement">
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
