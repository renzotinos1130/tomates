import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/kit/logo";
import { PixelText } from "@/components/kit/pixel-text";
import { PixelTomato } from "@/components/kit/pixel-tomato";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="gw-scope relative flex min-h-dvh items-center justify-center overflow-hidden bg-teal-200 p-4 sm:p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/backgrounds/potager.png"
        alt=""
        aria-hidden="true"
        className="pixelated pointer-events-none absolute inset-0 size-full object-cover object-bottom"
      />
      <div className="gw-glass relative grid w-full max-w-[860px] overflow-hidden rounded-[20px] md:min-h-[520px] md:grid-cols-[1fr_1.05fr]">
        {/* Brand panel: the tomato lands on its blocks. No feature list — partners know why they are here. */}
        <div className="pixel-night hidden flex-col items-center justify-between p-9 text-center text-white md:flex">
          <span />
          <div className="flex flex-col items-center">
            <div className="login-tomato">
              <PixelTomato size={128} decorative />
            </div>
            <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <i key={i} className="size-3 bg-white/[0.14]" />
              ))}
            </div>
            <PixelText text="Team Tomate HQ" unit={3} shadow="var(--color-tomato-700)" className="mt-8" />
            <p className="mt-4 text-sm leading-relaxed text-navy-200">
              Le QG de l&apos;équipe,
              <br />
              du mercredi au mardi.
            </p>
          </div>
          <p className="text-xs text-navy-300">Espace interne, réservé aux partenaires.</p>
        </div>

        {/* Form */}
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <Logo size={32} />
            <PixelText text="Team Tomate HQ" unit={2} className="text-navy-900" />
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-navy-900/[0.04]" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
