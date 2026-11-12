"use client";

import { Suspense } from "react";
import { GlassScene } from "@/components/app/glass";
import { PixelText } from "@/components/kit/pixel-text";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { SignInCard } from "@/components/ui/sign-in-card-2";
import { LoginForm } from "./login-form";

/**
 * The sign-in screen: the member's scene (the pixel garden by default), and on
 * it a card of dark glass, like a game menu over its landscape. Kept free of
 * anything page-specific so it can be mounted outside the Next route.
 */
export function LoginScreen() {
  return (
    <GlassScene className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <main className="relative z-10 flex w-full justify-center">
        <SignInCard>
          {/* The tomato lands, its name in pixel lettering. */}
          <div className="mb-6 flex flex-col items-center">
            <div className="login-tomato">
              <PixelTomato size={64} decorative />
            </div>
            <PixelText text="Team Tomate HQ" unit={2} className="mt-4 text-white" />
          </div>
          <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-white/[0.06]" />}>
            <LoginForm />
          </Suspense>
          <p className="mt-5 text-center text-xs text-white/60">Espace interne, réservé aux partenaires.</p>
        </SignInCard>
      </main>
    </GlassScene>
  );
}
