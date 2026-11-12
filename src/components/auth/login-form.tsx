"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeClosed, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SignInAltButton,
  SignInDivider,
  SignInError,
  SignInField,
  SignInFieldAction,
  SignInHeading,
  SignInTextButton,
} from "@/components/ui/sign-in-card-2";
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

/**
 * What goes inside the sign-in card: a link by email (the default) or a
 * password, the confirmation once the link is sent, and the demo notice when
 * no backend is configured.
 */
export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("erreur") === "lien" ? "Ce lien n'est plus valide. Demandez-en un nouveau." : null,
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-5">
        <SignInHeading title="Mode démo">
          Cette démo fonctionne avec des données fictives, gardées dans ce navigateur. Aucune connexion n&apos;est
          requise.
        </SignInHeading>
        <Button asChild size="lg" className="w-full">
          <Link href="/">Entrer dans l&apos;espace</Link>
        </Button>
      </div>
    );
  }

  const switchTo = (to: Mode) => {
    setMode(to);
    setError(null);
  };

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
        <SignInHeading title="Vérifiez vos courriels">
          Un lien de connexion vient d&apos;être envoyé à <span className="font-medium text-white">{email.trim()}</span>.
          Ouvrez-le sur cet appareil pour entrer dans l&apos;espace.
        </SignInHeading>
        <SignInAltButton onClick={() => setSent(false)}>Utiliser une autre adresse</SignInAltButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SignInHeading title="Connexion">
        {mode === "magic"
          ? "Entrez votre courriel : nous vous envoyons un lien de connexion."
          : "Connectez-vous avec votre courriel et votre mot de passe."}
      </SignInHeading>

      <div className="space-y-3 pt-1">
        <SignInField
          label="Courriel"
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="Adresse courriel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AnimatePresence initial={false}>
          {mode === "password" && (
            // The side padding leaves room for the field to grow a hair when it takes the focus.
            <motion.div
              key="password"
              className="-mx-1.5 overflow-hidden px-1.5"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="space-y-2 py-0.5">
                <SignInField
                  label="Mot de passe"
                  icon={Lock}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  trailing={
                    // Named without the words of the field, so "Mot de passe" designates one control only.
                    <SignInFieldAction
                      aria-label={showPassword ? "Masquer la saisie" : "Afficher la saisie"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? <Eye /> : <EyeClosed />}
                    </SignInFieldAction>
                  }
                />
                <div className="flex justify-end">
                  {/* There is no reset flow: the link by email is the way back in. */}
                  <SignInTextButton onClick={() => switchTo("magic")}>Mot de passe oublié ?</SignInTextButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <SignInError>{error}</SignInError>}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        {mode === "magic" ? "Recevoir un lien de connexion" : "Se connecter"}
      </Button>

      <SignInDivider />

      <SignInAltButton onClick={() => switchTo(mode === "magic" ? "password" : "magic")}>
        {mode === "magic" ? (
          <>
            <KeyRound /> Utiliser un mot de passe
          </>
        ) : (
          <>
            <Mail /> Recevoir un lien par courriel
          </>
        )}
      </SignInAltButton>
    </form>
  );
}
