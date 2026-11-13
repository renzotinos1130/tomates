"use client";

import { GlassSettingsPanel, useGlass } from "@/components/app/glass";

/**
 * How the app looks, for the person looking at it: a personal choice, kept in
 * this browser. Open to every member.
 */
export function AppearanceSection() {
  const glass = useGlass();
  return (
    <section className="gw-panel gw-reveal max-w-[720px]" aria-labelledby="settings-appearance">
      <header className="mb-5">
        <h2 id="settings-appearance" className="text-[17px] font-semibold tracking-tight text-navy-900">
          Apparence
        </h2>
        <p className="mt-1 text-[13px] text-navy-600">Un choix personnel, gardé dans ce navigateur. Personne d&apos;autre ne le voit.</p>
      </header>
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <GlassSettingsPanel settings={glass.settings} update={glass.update} reset={glass.reset} />
        <div className="text-[13px] leading-5 text-navy-600">
          <h3 className="mb-1 text-[13px] font-semibold text-navy-900">Le verre et la photo</h3>
          <p>
            L&apos;application est posée sur une image de l&apos;équipe. Choisissez la scène, puis un préréglage : « Poli » est l&apos;aspect
            par défaut, « Opaque » le plus lisible. Les réglages fins dosent le givre de la photo, l&apos;opacité du verre et le reflet de
            ses bords.
          </p>
        </div>
      </div>
    </section>
  );
}
