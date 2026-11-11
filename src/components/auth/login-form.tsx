"use client";

import { ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Mode = "magic" | "password";

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Courriel ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirmez d'abord votre courriel à l'aide du lien reçu.";
  if (/rate limit|too many|security purposes/i.test(message))
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  if (/signups? not allowed|not allowed/i.test(message))
    return "Ce courriel n'est pas autorisé. Demandez une invitation à un administrateur.";
  if (/failed to fetch|network/i.test(message)) return "Connexion impossible. Vérifiez votre réseau.";
  return message;
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erreur") === "lien" ? "Ce lien n'est plus valide. Demandez-en un nouveau." : null,
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-sun-50 text-sun-600 ring-1 ring-sun-200/70 ring-inset">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Mode démo</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aucune base Supabase n&apos;est configurée : l&apos;application fonctionne avec des données de démonstration
            enregistrées dans ce navigateur. Aucune connexion n&apos;est requise.
          </p>
        </div>
        <Button asChild size="lg" className="h-10 w-full shadow-button">
          <Link href="/">
            Entrer dans l&apos;espace <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.assign(next);
        return;
      }
      const redirect = new URL("/auth/callback", window.location.origin);
      if (next !== "/") redirect.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : "Une erreur est survenue."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100 ring-inset">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Vérifiez vos courriels</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Un lien de connexion vient d&apos;être envoyé à <span className="font-medium text-navy-800">{email.trim()}</span>.
            Ouvrez-le sur cet appareil pour entrer dans l&apos;espace.
          </p>
        </div>
        <Button variant="outline" className="h-10 w-full" onClick={() => setSent(false)}>
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Connexion</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "magic"
            ? "Entrez votre courriel : nous vous envoyons un lien de connexion."
            : "Connectez-vous avec votre courriel et votre mot de passe."}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Courriel</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@exemple.com"
          className="h-10 bg-card"
        />
      </div>

      {mode === "password" && (
        <div className="grid gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 bg-card"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-coral-50 px-3 py-2 text-[13px] text-coral-700 ring-1 ring-coral-100 ring-inset">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="h-10 w-full shadow-button">
        {busy ? <Loader2 className="animate-spin" /> : mode === "magic" ? <Mail /> : <KeyRound />}
        {mode === "magic" ? "Recevoir un lien de connexion" : "Se connecter"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "magic" ? "password" : "magic");
          setError(null);
        }}
        className="mx-auto block rounded-md px-2 py-1 text-[13px] font-medium text-teal-700 hover:text-teal-600 focus-ring"
      >
        {mode === "magic" ? "Utiliser un mot de passe" : "Recevoir plutôt un lien par courriel"}
      </button>
    </form>
  );
}
