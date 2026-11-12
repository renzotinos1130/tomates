import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PixelText } from "@/components/kit/pixel-text";
import { PixelTomato } from "@/components/kit/pixel-tomato";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="gw-scope app-canvas flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[380px]">
        {/* The brand, once: the tomato lands, its name in pixel lettering. */}
        <div className="mb-8 flex flex-col items-center">
          <div className="login-tomato">
            <PixelTomato size={64} decorative />
          </div>
          <PixelText text="Team Tomate HQ" unit={2} className="mt-5 text-navy-900" />
        </div>
        <div className="gw-glass rounded-[20px] p-7 sm:p-8">
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-navy-900/[0.04]" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-navy-400">Espace interne, réservé aux partenaires.</p>
      </div>
    </div>
  );
}
