"use client";

import { useState } from "react";
import { toast } from "sonner";
import { OwnPasswordForm } from "@/components/auth/own-password-form";
import { useMe } from "@/lib/hooks";
import { useApp } from "@/lib/store";

/**
 * My account: for now, my password. Anyone can change their own at any time,
 * with the one they have now; a password someone has lost is set again by the
 * super administrator, from the members.
 */
export function AccountSection() {
  const me = useMe();
  const mode = useApp((s) => s.mode);
  const [changes, setChanges] = useState(0);
  return (
    <section className="gw-panel gw-reveal max-w-[520px]" aria-labelledby="settings-account">
      <header className="mb-5">
        <h2 id="settings-account" className="text-[17px] font-semibold tracking-tight text-navy-900">
          Mot de passe
        </h2>
        <p className="mt-1 text-[13px] text-navy-600">
          {me?.email ? `Le mot de passe du compte ${me.email}.` : "Le mot de passe de votre compte."} Vous resterez connecté sur cet
          appareil ; les autres appareils devront se reconnecter. Oublié ? Le super administrateur en définit un nouveau
          depuis les membres.
        </p>
      </header>
      {mode === "demo" ? (
        <p className="rounded-xl bg-navy-900/[0.04] px-4 py-3 text-[13px] leading-5 text-navy-700">
          En mode démo personne ne se connecte : il n&apos;y a pas de mot de passe à changer.
        </p>
      ) : (
        <OwnPasswordForm
          // A new form after each change: the fields empty themselves.
          key={`${me?.id}:${changes}`}
          email={me?.email ?? ""}
          askCurrent
          submitLabel="Changer mon mot de passe"
          onChanged={() => {
            setChanges((n) => n + 1);
            toast.success("Mot de passe changé");
          }}
        />
      )}
    </section>
  );
}
