"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, RefreshCw } from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMAIL_PATTERN, generatePassword, PASSWORD_MIN, passwordProblem } from "@/lib/passwords";
import { createAccount, setMemberPassword, useApp } from "@/lib/store";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ROLE_META } from "./roles";

/**
 * A temporary password, in clear: the super administrator has to read it and
 * hand it over. « Générer » writes one that is easy to dictate.
 */
function TemporaryPassword({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Mot de passe temporaire</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          className="bg-card font-mono text-[13px] tracking-wide"
        />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())} className="shrink-0">
          <RefreshCw /> Générer
        </Button>
      </div>
      <p id={`${id}-hint`} aria-live="polite" className={cn("text-xs leading-relaxed", error ? "text-coral-700" : "text-navy-600")}>
        {error ?? `Au moins ${PASSWORD_MIN} caractères. La personne devra choisir le sien à sa première connexion.`}
      </p>
    </div>
  );
}

/** What to hand over, once the server has said yes: shown once, with a button to copy it. */
function Handover({ name, email, password, onDone }: { name: string; email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Courriel : ${email}\nMot de passe temporaire : ${password}`);
      setCopied(true);
    } catch {
      toast.error("Copie impossible : notez le mot de passe à la main.");
    }
  };
  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>C&apos;est prêt pour {name}</DialogTitle>
        <DialogDescription>
          Transmettez-lui ces deux lignes. À sa première connexion, l&apos;application lui demandera de choisir son propre mot de passe.
        </DialogDescription>
      </DialogHeader>
      <dl className="grid gap-2 rounded-xl bg-navy-900/[0.04] px-4 py-3.5 text-[13px]">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-navy-600">Courriel</dt>
          <dd className="truncate font-medium text-navy-900">{email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-navy-600">Mot de passe temporaire</dt>
          <dd className="font-mono font-medium tracking-wide break-all text-navy-900">{password}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-navy-600">Ce mot de passe ne sera plus affiché. S&apos;il se perd, vous en définirez un autre.</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />} {copied ? "Copié" : "Copier"}
        </Button>
        <Button type="button" onClick={onDone}>
          Terminé
        </Button>
      </DialogFooter>
    </div>
  );
}

function NewAccountForm({ onDone }: { onDone: () => void }) {
  const ids = useId();
  const mode = useApp((s) => s.mode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [password, setPassword] = useState(() => generatePassword());
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Member | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const nameProblem = fullName.trim().length < 2 ? "Indiquez le nom complet." : null;
  const emailProblem = EMAIL_PATTERN.test(cleanEmail) ? null : "Ce courriel n'est pas valide.";
  const pwProblem = passwordProblem(password);
  // What the server answered is about what was sent: it goes away as soon as a field changes.
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setError(null);
  };

  if (created) return <Handover name={created.full_name} email={created.email} password={password} onDone={onDone} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (busy || nameProblem || emailProblem || pwProblem) return;
    setBusy(true);
    setError(null);
    const out = await createAccount({ email: cleanEmail, fullName: fullName.trim(), role, password });
    setBusy(false);
    if (out.ok) setCreated(out.member);
    else setError(out.error);
  };

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Ajouter un membre</DialogTitle>
        <DialogDescription>
          Vous créez son compte et son mot de passe temporaire ; aucun courriel n&apos;est envoyé.
          {mode === "demo" && " En mode démo, le compte reste dans ce navigateur."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-name`}>Nom complet</Label>
          <Input
            id={`${ids}-name`}
            value={fullName}
            onChange={(e) => edit(setFullName)(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="Prénom Nom"
            aria-invalid={touched && nameProblem ? true : undefined}
            className="bg-card"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-email`}>Courriel</Label>
          <Input
            id={`${ids}-email`}
            type="email"
            value={email}
            onChange={(e) => edit(setEmail)(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            placeholder="prenom@exemple.com"
            aria-invalid={touched && emailProblem ? true : undefined}
            className="bg-card"
          />
        </div>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm leading-none font-medium text-navy-900">Rôle</legend>
        {(["member", "admin"] as const).map((value) => {
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
              <input type="radio" name={`${ids}-role`} value={value} checked={on} onChange={() => setRole(value)} className="sr-only" />
              <Icon className="mt-0.5 size-[18px] shrink-0 text-navy-600" strokeWidth={1.8} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-navy-900">{meta.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-navy-600">{meta.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <TemporaryPassword id={`${ids}-password`} value={password} onChange={edit(setPassword)} error={touched ? pwProblem : null} />

      <div aria-live="polite" className="-mt-1 min-h-0 text-[13px] text-coral-700">
        {(touched && (nameProblem ?? emailProblem)) || error}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Création…" : "Créer le compte"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Super administrator: a member is added with a name, an address, a role and a temporary password. */
export function NewAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">{open && <NewAccountForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function PasswordForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const id = useId();
  const [password, setPassword] = useState(() => generatePassword());
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const problem = passwordProblem(password);

  if (done) return <Handover name={member.full_name} email={member.email} password={password} onDone={onDone} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    const out = await setMemberPassword(member.id, password);
    setBusy(false);
    if (out.ok) setDone(true);
    else setError(out.error);
  };

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Définir un mot de passe pour {member.full_name}</DialogTitle>
        <DialogDescription>
          Son mot de passe actuel cessera de fonctionner. Celui-ci est temporaire : l&apos;application lui en fera choisir un autre dès
          sa prochaine connexion.
        </DialogDescription>
      </DialogHeader>
      <TemporaryPassword
        id={id}
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={touched ? problem : null}
      />
      {error && (
        <p aria-live="polite" className="-mt-1 text-[13px] text-coral-700">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : "Définir le mot de passe"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Super administrator: a new temporary password for a member who lost theirs, or never had one. */
export function PasswordDialog({ member, onOpenChange }: { member: Member | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">{member && <PasswordForm member={member} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}
