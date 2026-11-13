"use client";

/**
 * Application bootstrap: picks the adapter (Supabase or demo), loads the
 * workspace, wires realtime + presence. Runs once per browser tab.
 */
import { presencePath } from "@/lib/chat";
import type { DataAdapter, PresenceHandle } from "@/lib/data/adapter";
import { DEMO_DEFAULT_MEMBER } from "@/lib/data/seed";
import { applyChange, attachAdapter, hydrate, refreshTowerChampion, setPresence, towerChanged, useApp } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const DEMO_ME_KEY = "tthq:demo:me";

/**
 * Leaving the workspace is a full page load on purpose: it drops every piece
 * of team data held in memory (store, realtime channels) before the login
 * screen is shown.
 */
export function leaveTo(path: string) {
  window.location.assign(path);
}

let started = false;
let adapter: DataAdapter | null = null;
let presence: PresenceHandle | null = null;
let unsubscribe: (() => void) | null = null;
let unsubscribeTower: (() => void) | null = null;

async function resync() {
  if (!adapter) return;
  try {
    hydrate(await adapter.load());
  } catch {
    /* next realtime event or reload will catch up */
  }
}

export async function boot() {
  if (started) return;
  started = true;
  try {
    if (isSupabaseConfigured) {
      const [{ SupabaseAdapter }, { getSupabaseBrowserClient }] = await Promise.all([
        import("@/lib/data/supabase-adapter"),
        import("@/lib/supabase/client"),
      ]);
      const sb = getSupabaseBrowserClient();
      const { data } = await sb.auth.getUser();
      if (!data.user) {
        leaveTo("/login");
        return;
      }
      const userId = data.user.id;
      adapter = new SupabaseAdapter();
      attachAdapter(adapter);
      useApp.setState({ meId: userId });
      const snapshot = await adapter.load();
      hydrate(snapshot);
      const me = snapshot.members.find((m) => m.id === userId);
      useApp.setState({ status: !me?.active ? "pending-access" : me.must_change_password ? "password-change" : "ready" });
      sb.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") leaveTo("/login");
      });
    } else {
      const { DemoAdapter } = await import("@/lib/data/demo-adapter");
      adapter = new DemoAdapter(() => useApp.getState().meId);
      attachAdapter(adapter);
      const snapshot = await adapter.load();
      hydrate(snapshot);
      let meId: string | null = null;
      try {
        meId = localStorage.getItem(DEMO_ME_KEY);
      } catch {
        meId = null;
      }
      if (!meId || !snapshot.members.some((m) => m.id === meId)) meId = DEMO_DEFAULT_MEMBER;
      useApp.setState({ meId, status: "ready" });
    }
    unsubscribe = adapter.subscribe(applyChange, resync);
    // The game: who wears the crown this week (shown on their face everywhere),
    // and its scores as they change, wherever in the app one happens to be.
    if (useApp.getState().status === "ready") {
      refreshTowerChampion();
      unsubscribeTower = adapter.subscribeTower(towerChanged);
    }
    // Coming back to a tab after a while: make sure nothing was missed, the game's scores included.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || adapter?.mode !== "supabase") return;
      void resync();
      if (useApp.getState().status === "ready") towerChanged();
    });
  } catch (err) {
    started = false;
    useApp.setState({
      status: "error",
      error: err instanceof Error ? err.message : "Impossible de charger l'espace de travail.",
    });
  }
}

export function retryBoot() {
  unsubscribe?.();
  unsubscribe = null;
  unsubscribeTower?.();
  unsubscribeTower = null;
  started = false;
  useApp.setState({ status: "booting", error: null });
  void boot();
}

export function syncPresence(pathname: string) {
  const { meId, status } = useApp.getState();
  if (!adapter || !meId || status !== "ready") return;
  // Presence is sent to the whole team: it says "in the messages", never in which conversation.
  const page = presencePath(pathname);
  const state = { member_id: meId, page, at: Date.now() };
  if (!presence) presence = adapter.joinPresence(state, setPresence);
  else presence.update(state);
}

/* ------------------------------ demo tools --------------------------- */

export function switchDemoIdentity(memberId: string) {
  try {
    localStorage.setItem(DEMO_ME_KEY, memberId);
  } catch {
    /* ignore */
  }
  presence?.leave();
  presence = null;
  useApp.setState({ meId: memberId, presence: [] });
}

export async function resetDemoData() {
  if (!adapter || adapter.mode !== "demo") return;
  const { DemoAdapter } = await import("@/lib/data/demo-adapter");
  if (adapter instanceof DemoAdapter) hydrate(adapter.reset());
  useApp.setState({ openTaskId: null });
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
  presence?.leave();
  await getSupabaseBrowserClient().auth.signOut();
  leaveTo("/login");
}
