import type { Metadata } from "next";
import { CalendarCheck2, Rows3, Users } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/kit/logo";

export const metadata: Metadata = { title: "Connexion" };

const POINTS = [
  { icon: Rows3, title: "Tous les projets, un seul endroit", text: "Application, Site Web, Médias sociaux." },
  { icon: Users, title: "Qui fait quoi, en un coup d'œil", text: "Responsables, priorités, échéances." },
  { icon: CalendarCheck2, title: "Le meeting du mercredi", text: "On décide, on assigne, on repart alignés." },
];

export default function LoginPage() {
  return (
    <div className="gw-scope relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy-900 p-4 sm:p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/backgrounds/vallee.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full object-cover object-[center_56%]"
      />
      <div className="gw-glass relative grid w-full max-w-[920px] overflow-hidden rounded-[28px] md:min-h-[560px] md:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <div className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden bg-navy-900/[0.88] p-9 text-white md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(520px 320px at 100% 0%, rgb(18 148 140 / 0.42), transparent 65%), radial-gradient(420px 300px at 0% 100%, rgb(244 179 49 / 0.2), transparent 70%)",
            }}
          />
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Team Tomate HQ</div>
              <div className="text-xs text-navy-200">Projet Prospero</div>
            </div>
          </div>
          <div>
            <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em]">
              Le QG de l&apos;équipe,
              <br />
              <span className="text-sun-300">du mercredi au mardi.</span>
            </h2>
            <ul className="mt-8 space-y-5">
              {POINTS.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-teal-200 ring-1 ring-white/10 ring-inset">
                    <p.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-[13px] text-navy-200">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-navy-300">Espace interne — réservé aux partenaires.</p>
        </div>

        {/* Form */}
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <Logo size={32} />
            <span className="text-[15px] font-semibold tracking-tight text-navy-900">Team Tomate HQ</span>
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-navy-900/[0.04]" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
