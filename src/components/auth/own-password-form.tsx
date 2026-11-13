"use client";

import { useId, useState } from "react";
import { leaveTo } from "@/components/app/boot";
import { Eye, EyeClosed } from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN, passwordProblem } from "@/lib/passwords";
import { changeOwnPassword } from "@/lib/server/accounts";
import { cn } from "@/lib/utils";

/**
 * Choosing my own password: twice, to catch a slip of the finger. The server
 * sets it (and clears the « must change » flag). Supabase then ends every
 * session of the account, so the form signs me in again with the new password
 * before saying it is done.
 *
 * `askCurrent`: a change I decide myself (Paramètres → Compte) also asks for
 * the password I have now; the one I am made to do on the way in does not.
 */
export function OwnPasswordForm({
  email,
  submitLabel,
  onChanged,
  askCurrent = false,
  className,
}: {
  /** My address: needed to sign in again once the password has changed. */
  email: string;
  submitLabel: string;
  onChanged: () => void;
  askCurrent?: boolean;
  className?: string;
}) {
  const ids = useId();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem =
    (askCurrent && !current ? "Indiquez votre mot de passe actuel." : null) ??
    passwordProblem(password) ??
    (again !== password ? "Les deux mots de passe ne sont pas identiques." : null);
  // What the server answered is about what was sent: it goes away as soon as a field changes.
  const message = touched && problem ? problem : error;
  const edit = (set: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    try {
      const out = await changeOwnPassword(askCurrent ? { password, current } : { password });
      if (!out.ok) {
        setError(out.error);
        return;
      }
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const signedIn = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (signedIn.error) {
        // The password is changed; only the automatic sign-in failed.
        leaveTo("/login");
        return;
      }
      onChanged();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau, puis réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} noValidate className={cn("grid gap-4 text-left", className)}>
      {askCurrent && (
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-current`}>Mot de passe actuel</Label>
          <Input
            id={`${ids}-current`}
            type={type}
            value={current}
            onChange={edit(setCurrent)}
            autoComplete="current-password"
            aria-invalid={message ? true : undefined}
            aria-describedby={`${ids}-hint`}
            className="bg-card"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-new`}>Nouveau mot de passe</Label>
        <div className="relative">
          <Input
            id={`${ids}-new`}
            type={type}
            value={password}
            onChange={edit(setPassword)}
            autoComplete="new-password"
            autoFocus={!askCurrent}
            aria-invalid={message ? true : undefined}
            aria-describedby={`${ids}-hint`}
            className="bg-card pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Masquer les mots de passe" : "Afficher les mots de passe"}
            aria-pressed={show}
            className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-navy-500 hover:text-navy-900 focus-ring"
          >
            {show ? <EyeClosed className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-again`}>Encore une fois</Label>
        <Input
          id={`${ids}-again`}
          type={type}
          value={again}
          onChange={edit(setAgain)}
          autoComplete="new-password"
          aria-invalid={message ? true : undefined}
          className="bg-card"
        />
      </div>
      <p id={`${ids}-hint`} aria-live="polite" className={cn("text-xs leading-relaxed", message ? "text-coral-700" : "text-navy-600")}>
        {message ?? `Au moins ${PASSWORD_MIN} caractères. Une phrase que vous seul connaissez fait un bon mot de passe.`}
      </p>
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
