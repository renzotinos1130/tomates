"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatShortDate } from "@/lib/dates";
import { PUSH_TOPICS, deviceLabel, pushSupport, type PushPrefs, type PushState, type PushSupport } from "@/lib/push";
import { disablePush, enablePush, pushSubscription, showLocalNotification, syncPush } from "@/lib/push-client";
import { getAdapter, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const SCOPES: { value: PushPrefs["scope"]; label: string; hint: string }[] = [
  { value: "team", label: "Toute l'équipe", hint: "Chaque tâche créée, terminée ou bloquée." },
  { value: "mine", label: "Seulement les miennes", hint: "Les tâches dont vous êtes responsable, ou que vous avez créées." },
];

/** The demo published as a single page lives inside another page: no browser lets it receive anything. */
const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === "1";

const UNREADABLE = "Les notifications n'ont pas pu être lues. Réessayez dans un instant.";

/** What this device can do, and what it has: read from the browser, then from where my devices are kept. */
interface Here {
  support: PushSupport;
  permission: NotificationPermission;
  /** This device's subscription, if it has one. */
  endpoint: string | null;
  state: PushState;
}

async function look(): Promise<Here> {
  const support = pushSupport();
  const permission = support === "ok" ? Notification.permission : "default";
  // A device that is already subscribed is mine as soon as I am signed in on it: said to the server
  // before it is asked what I have, so this screen never shows « off » for a device that receives.
  if (support === "ok") await syncPush();
  const endpoint = support === "ok" ? ((await pushSubscription())?.endpoint ?? null) : null;
  return { support, permission, endpoint, state: await getAdapter().pushState(endpoint) };
}

function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-navy-900/[0.04] px-4 py-3 text-[13px] leading-5 text-navy-800", className)}>{children}</div>;
}

/** This device: on, off, or why it cannot be turned on here. */
function ThisDevice({ here, busy, onEnable, onDisable, onTest }: { here: Here; busy: boolean; onEnable: () => void; onDisable: () => void; onTest: () => void }) {
  const demo = useApp((s) => s.mode === "demo");
  const on = here.state.devices.some((d) => d.current);

  if (STANDALONE) {
    return (
      <Note>
        Cette page de démonstration ne peut pas recevoir de notifications. Dans l&apos;application, c&apos;est ici qu&apos;on les active sur chaque
        appareil, d&apos;un bouton, et qu&apos;on envoie un essai.
      </Note>
    );
  }

  if (here.support === "ios-install") {
    return (
      <Note>
        <p className="font-medium text-navy-900">Sur iPhone et iPad, les notifications arrivent dans l&apos;application installée.</p>
        <ol className="mt-2 grid list-decimal gap-1 pl-5">
          <li>Dans Safari, touchez « Partager », puis « Sur l&apos;écran d&apos;accueil ».</li>
          <li>Ouvrez Tomate HQ depuis l&apos;écran d&apos;accueil.</li>
          <li>Revenez ici, dans Paramètres → Notifications, et activez-les.</li>
        </ol>
      </Note>
    );
  }
  if (here.support === "unsupported") {
    return <Note>Ce navigateur ne peut pas recevoir de notifications. Elles fonctionnent dans Safari, Chrome, Edge et Firefox à jour.</Note>;
  }
  if (!here.state.configured || !here.state.publicKey) {
    return <Note>Les notifications ne sont pas configurées sur ce serveur : il lui manque ses clés d&apos;envoi (voir le README).</Note>;
  }
  if (here.permission === "denied") {
    return (
      <Note>
        <p className="font-medium text-navy-900">Les notifications sont bloquées pour Tomate HQ sur cet appareil.</p>
        <p className="mt-1">
          Autorisez-les dans les réglages, puis revenez ici. iPhone : Réglages → Notifications → Tomate HQ. Mac : Réglages Système →
          Notifications. Dans un navigateur : le cadenas de la barre d&apos;adresse.
        </p>
      </Note>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="flex min-w-0 items-center gap-2.5 text-[13px] text-navy-800" role="status">
          {on ? <Bell className="size-4 shrink-0 text-navy-900" aria-hidden="true" /> : <BellOff className="size-4 shrink-0 text-navy-500" aria-hidden="true" />}
          {on ? "Activées sur cet appareil." : "Désactivées sur cet appareil."}
        </p>
        {on ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onTest}>
              Envoyer un essai
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDisable}>
              Désactiver
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={busy} onClick={onEnable}>
            Activer sur cet appareil
          </Button>
        )}
      </div>
      {demo && (
        <p className="text-xs leading-relaxed text-navy-600" role="note">
          Mode démo : aucun serveur n&apos;envoie de notification. « Envoyer un essai » en affiche une depuis cette page.
        </p>
      )}
    </div>
  );
}

/**
 * Push notifications, for me: this device first (they are turned on device by
 * device, because each browser asks its own permission), then what I want to
 * hear about, then the devices that receive.
 */
export function NotificationsSection() {
  const ids = useId();
  const [here, setHere] = useState<Here | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setHere(await look());
    } catch {
      toast.error(UNREADABLE);
    }
  }, []);
  // What this device can do is only known once the page is in a browser.
  useEffect(() => {
    let alive = true;
    look()
      .then((found) => alive && setHere(found))
      .catch(() => alive && toast.error(UNREADABLE));
    return () => {
      alive = false;
    };
  }, []);

  /** One action at a time; whatever it did, the screen then shows what is really so. */
  const run = async (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await action();
      if (out.ok) {
        if (done) toast.success(done);
      } else toast.error(out.error);
    } catch {
      toast.error("Une erreur est survenue. Réessayez dans un instant.");
    }
    await refresh();
    setBusy(false);
  };

  const enable = () => {
    const key = here?.state.publicKey;
    if (key) void run(() => enablePush(key), "Notifications activées sur cet appareil.");
  };
  const disable = () => void run(disablePush, "Notifications désactivées sur cet appareil.");
  const test = () =>
    void run(async () => {
      const endpoint = here?.endpoint;
      if (!endpoint) return { ok: false as const, error: "Cet appareil n'est plus abonné : réactivez les notifications." };
      const out = await getAdapter().pushTest(endpoint);
      if (out.ok && out.local) {
        const shown = await showLocalNotification("Tomate HQ", "Les notifications fonctionnent sur cet appareil 🍅", "/parametres?section=notifications");
        if (!shown) return { ok: false as const, error: "L'essai n'a pas pu être affiché sur cet appareil." };
      }
      return out;
    }, "Essai envoyé : il arrive dans un instant.");

  const setPref = async (patch: Partial<PushPrefs>) => {
    if (!here) return;
    const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, here.state.prefs[key as keyof PushPrefs]])) as Partial<PushPrefs>;
    const apply = (values: Partial<PushPrefs>) =>
      setHere((now) => (now ? { ...now, state: { ...now.state, prefs: { ...now.state.prefs, ...values } } } : now));
    // The switch moves at once; it comes back, alone, if the choice could not be kept.
    apply(patch);
    const out = await getAdapter()
      .pushSetPrefs(patch)
      .catch(() => ({ ok: false as const, error: "Ce choix n'a pas pu être enregistré." }));
    if (!out.ok) {
      apply(previous);
      toast.error(out.error);
    }
  };

  const removeDevice = (id: string) => void run(() => getAdapter().pushRemoveDevice(id), "Appareil retiré.");

  const prefs = here?.state.prefs;
  const devices = here?.state.devices ?? [];
  const canChoose = !!here && here.state.configured;

  return (
    <section className="gw-panel gw-reveal max-w-[720px]" aria-labelledby="settings-notifications">
      <header className="mb-5">
        <h2 id="settings-notifications" className="text-[17px] font-semibold tracking-tight text-navy-900">
          Notifications
        </h2>
        <p className="mt-1 text-[13px] text-navy-600">
          Sur vos appareils, même quand l&apos;application est fermée : une tâche créée, terminée ou bloquée, un nouveau meneur à Tomato
          Tower. Elles s&apos;activent appareil par appareil.
        </p>
      </header>

      <div aria-busy={!here}>
        <h3 className="mb-2 text-[13px] font-semibold text-navy-900">Cet appareil</h3>
        {here ? (
          <ThisDevice here={here} busy={busy} onEnable={enable} onDisable={disable} onTest={test} />
        ) : (
          <p className="text-[13px] text-navy-600">Vérification…</p>
        )}
      </div>

      {canChoose && prefs && (
        <div className="mt-7 border-t border-navy-900/[0.08] pt-6">
          <h3 className="text-[13px] font-semibold text-navy-900">Me prévenir pour</h3>
          <p className="mt-1 text-xs leading-relaxed text-navy-600">Ces choix valent pour tous vos appareils. On ne vous prévient jamais de ce que vous faites vous-même.</p>
          <ul className="mt-3 grid gap-px overflow-hidden rounded-xl border border-navy-900/[0.1] bg-navy-900/[0.08]">
            {PUSH_TOPICS.map((topic) => (
              <li key={topic.key} className="flex items-center justify-between gap-4 bg-card px-4 py-3">
                <span className="min-w-0">
                  <span id={`${ids}-${topic.key}`} className="block text-[13px] font-medium text-navy-900">
                    {topic.label}
                  </span>
                  <span id={`${ids}-${topic.key}-hint`} className="mt-0.5 block text-xs leading-relaxed text-navy-600">
                    {topic.hint}
                  </span>
                </span>
                <Switch
                  checked={prefs[topic.key]}
                  onCheckedChange={(on) => void setPref({ [topic.key]: on })}
                  aria-labelledby={`${ids}-${topic.key}`}
                  aria-describedby={`${ids}-${topic.key}-hint`}
                />
              </li>
            ))}
          </ul>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[13px] font-semibold text-navy-900">Quelles tâches</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SCOPES.map((scope) => {
                const on = prefs.scope === scope.value;
                return (
                  <label
                    key={scope.value}
                    className={cn(
                      "grid cursor-pointer content-start gap-0.5 rounded-xl border px-3.5 py-3 transition-colors",
                      "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      on ? "border-navy-900 bg-navy-900/[0.03]" : "border-navy-900/[0.13] hover:bg-navy-900/[0.03]",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${ids}-scope`}
                      value={scope.value}
                      checked={on}
                      onChange={() => void setPref({ scope: scope.value })}
                      className="sr-only"
                    />
                    <span className="text-[13px] font-medium text-navy-900">{scope.label}</span>
                    <span className="text-xs leading-relaxed text-navy-600">{scope.hint}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-navy-600">Une tâche qu&apos;on vous confie vous est toujours annoncée.</p>
          </fieldset>
        </div>
      )}

      {canChoose && devices.length > 0 && (
        <div className="mt-7 border-t border-navy-900/[0.08] pt-6">
          <h3 className="mb-2 text-[13px] font-semibold text-navy-900">Mes appareils</h3>
          <ul className="grid gap-1.5" aria-label="Appareils qui reçoivent mes notifications">
            {devices.map((d) => (
              <li key={d.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-navy-900/[0.035] px-3.5 py-2">
                <span className="min-w-0 text-[13px] text-navy-900">
                  <span className="font-medium">{d.device || (d.current ? deviceLabel() : "") || "Appareil"}</span>
                  <span className="text-navy-600"> · depuis le {formatShortDate(new Date(d.created_at))}</span>
                  {d.current && <span className="ml-2 rounded-md bg-navy-900/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-navy-800">Cet appareil</span>}
                </span>
                {!d.current && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => removeDevice(d.id)} aria-label={`Retirer ${d.device || "cet appareil"}`}>
                    Retirer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
