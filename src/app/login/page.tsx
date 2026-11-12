import type { Metadata } from "next";
import { Suspense } from "react";
import { GlassScene } from "@/components/app/glass";
import { LoginForm } from "@/components/auth/login-form";
import { PixelText } from "@/components/kit/pixel-text";
import { PixelTomato } from "@/components/kit/pixel-tomato";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <GlassScene className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      {/* One sheet of glass over the scene: the brand, then the form. */}
      <div className="gw-glass relative z-10 w-full max-w-[400px] rounded-[27px] px-7 pt-9 pb-7 sm:px-9 sm:pt-10 sm:pb-8">
        {/* The tomato lands, its name in pixel lettering. */}
        <div className="mb-8 flex flex-col items-center">
          <div className="login-tomato">
            <PixelTomato size={64} decorative />
          </div>
          <PixelText text="Team Tomate HQ" unit={2} className="mt-5 text-navy-900" />
        </div>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-navy-900/[0.04]" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-7 text-center text-xs text-navy-600">Espace interne, réservé aux partenaires.</p>
      </div>
    </GlassScene>
  );
}
