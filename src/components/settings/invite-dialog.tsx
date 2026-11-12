"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inviteMember, useApp } from "@/lib/store";
import type { MemberRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ROLE_META } from "./roles";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@x.com, b@y.com\nc@z.com" → unique, lower-cased addresses. */
function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const mode = useApp((s) => s.mode);
  const members = useApp((s) => s.members);
  const invites = useApp((s) => s.invites);
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const { invalid, known, invited, fresh } = useMemo(() => {
    const memberEmails = new Set(Object.values(members).map((m) => m.email.toLowerCase()));
    const out = { invalid: [] as string[], known: [] as string[], invited: [] as string[], fresh: [] as string[] };
    for (const email of parseEmails(raw)) {
      if (!EMAIL.test(email)) out.invalid.push(email);
      else if (memberEmails.has(email)) out.known.push(email);
      else if (invites[email]) out.invited.push(email);
      else out.fresh.push(email);
    }
    return out;
  }, [raw, members, invites]);

  const canSubmit = fresh.length > 0 && invalid.length === 0 && !busy;
  const showInvalid = touched && invalid.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    const saved = (await Promise.all(fresh.map((email) => inviteMember(email, role)))).filter(Boolean).length;
    setBusy(false);
    if (saved > 0) {
      toast.success(saved >= 2 ? `${saved} invitations enregistrées` : "Invitation enregistrée", {
        description:
          saved >= 2
            ? "Ces personnes peuvent maintenant se connecter avec leur courriel."
            : "Cette personne peut maintenant se connecter avec ce courriel.",
      });
    }
    // A failed write already explained itself in a toast: keep the form open so nothing is lost.
    if (saved === fresh.length) onDone();
  };

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Inviter des membres</DialogTitle>
        <DialogDescription>
          Seules les personnes invitées peuvent voir les projets. Aucun courriel n&apos;est envoyé : donnez-leur
          l&apos;adresse de l&apos;espace, elles se connectent avec leur courriel et rejoignent l&apos;équipe aussitôt.
          {mode === "demo" && " En mode démo, les invitations restent dans ce navigateur."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="invite-emails">Courriels</Label>
        <Textarea
          id="invite-emails"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="prenom@exemple.com"
          rows={2}
          autoFocus
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={showInvalid || undefined}
          aria-describedby="invite-emails-hint"
          className="min-h-[60px] bg-card"
        />
        <div id="invite-emails-hint" aria-live="polite" className="grid gap-1 text-xs leading-relaxed text-navy-600">
          {showInvalid ? (
            <p className="text-coral-700">
              {invalid.length >= 2 ? "Adresses à corriger : " : "Adresse à corriger : "}
              {invalid.join(", ")}
            </p>
          ) : (
            <p>Plusieurs personnes ? Séparez les adresses par une virgule, un espace ou un retour à la ligne.</p>
          )}
          {known.length > 0 && <p>Déjà dans l&apos;équipe : {known.join(", ")}</p>}
          {invited.length > 0 && <p>Déjà invitée : {invited.join(", ")}</p>}
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium text-navy-900">Rôle</legend>
        {(Object.keys(ROLE_META) as MemberRole[]).map((value) => {
          const meta = ROLE_META[value];
          const Icon = meta.icon;
          const on = role === value;
          return (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                on ? "border-navy-900 bg-navy-900/[0.03]" : "border-input hover:bg-navy-900/[0.02]",
              )}
            >
              <input
                type="radio"
                name="invite-role"
                value={value}
                checked={on}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              <Icon
                className={cn("mt-0.5 size-[18px] shrink-0", on ? "text-navy-900" : "text-navy-500")}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[13px] leading-5 font-medium text-navy-900">{meta.label}</span>
                <span className="block text-xs leading-relaxed text-navy-600">{meta.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {fresh.length >= 2 ? `Inviter ${fresh.length} personnes` : "Inviter"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Adds one or several addresses to the allow-list, with the role they will receive on arrival. */
export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open: the form always starts empty. */}
        <InviteForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
