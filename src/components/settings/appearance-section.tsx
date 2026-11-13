"use client";

import { GlassSettingsPanel, useGlass } from "@/components/app/glass";
import { useTheme, useThemeChoice } from "@/components/app/theme";
import { BACKDROPS } from "@/lib/glass";
import { EVENING_ENDS, EVENING_STARTS, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: "day", label: "Clair", hint: "Le verre, posé sur la photo de l'équipe." },
  { value: "night", label: "Soir", hint: "De l'encre mate : ni verre, ni photo." },
  { value: "auto", label: "Automatique", hint: `Clair le jour, soir de ${EVENING_STARTS} h à ${EVENING_ENDS} h.` },
];

/** What each theme looks like, in a few strokes: the picture under a pane, or the night sky and a slab. */
function Swatch({ theme, thumb }: { theme: ThemeChoice; thumb: string }) {
  const day = (
    <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${thumb})` }}>
      <span className="absolute inset-x-2 top-2.5 bottom-2 rounded-[5px] bg-white/70 shadow-[0_0_0_1px_rgb(255_255_255/0.8)]" />
    </span>
  );
  const night = (
    <span className="absolute inset-0 bg-[#0a1222]">
      <i className="absolute top-1.5 left-2 size-0.5 bg-[#f1efe8]/70" />
      <i className="absolute top-1 left-[46%] size-0.5 bg-[#fcdb8b]/80" />
      <i className="absolute top-2.5 right-2.5 size-0.5 bg-[#f1efe8]/50" />
      <span className="absolute inset-x-2 top-4 bottom-2 rounded-[5px] bg-[#16223a] shadow-[0_0_0_1px_rgb(170_185_215/0.16)]" />
    </span>
  );
  return (
    <span aria-hidden="true" className="relative block h-12 w-full overflow-hidden rounded-lg">
      {theme === "day" ? (
        day
      ) : theme === "night" ? (
        night
      ) : (
        <>
          {day}
          {/* The evening takes the other half of the same swatch. */}
          <span className="absolute inset-0 [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]">{night}</span>
        </>
      )}
    </span>
  );
}

function ThemePicker() {
  const [choice, setChoice] = useThemeChoice();
  const glass = useGlass();
  const thumb = (BACKDROPS.find((b) => b.id === glass.settings.background) ?? BACKDROPS[0]).thumb;
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-navy-900">Thème</legend>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {THEMES.map((t) => {
          const on = choice === t.value;
          return (
            <label
              key={t.value}
              className={cn(
                "grid cursor-pointer gap-2.5 rounded-xl border p-2.5 transition-colors",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                on ? "border-navy-900 bg-navy-900/[0.03]" : "border-navy-900/[0.13] hover:bg-navy-900/[0.03]",
              )}
            >
              <input type="radio" name="theme" value={t.value} checked={on} onChange={() => setChoice(t.value)} className="sr-only" />
              <Swatch theme={t.value} thumb={thumb} />
              <span className="px-0.5 pb-0.5">
                <span className="block text-[13px] font-medium text-navy-900">{t.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-navy-600">{t.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * How the app looks, for the person looking at it: a personal choice, kept in
 * this browser. Open to every member. The theme first (day, evening, or one
 * then the other with the clock); then the glass, which only the day theme has.
 */
export function AppearanceSection() {
  const glass = useGlass();
  const night = useTheme() === "night";
  return (
    <section className="gw-panel gw-reveal max-w-[720px]" aria-labelledby="settings-appearance">
      <header className="mb-5">
        <h2 id="settings-appearance" className="text-[17px] font-semibold tracking-tight text-navy-900">
          Apparence
        </h2>
        <p className="mt-1 text-[13px] text-navy-600">Un choix personnel, gardé dans ce navigateur. Personne d&apos;autre ne le voit.</p>
      </header>

      <ThemePicker />

      <div className="mt-7 border-t border-navy-900/[0.08] pt-6">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* The glass belongs to the day: in the evening its settings wait, untouched. */}
          <div inert={night} className={cn("transition-opacity", night && "opacity-45")}>
            <GlassSettingsPanel settings={glass.settings} update={glass.update} reset={glass.reset} />
          </div>
          <div className="text-[13px] leading-5 text-navy-600">
            <h3 className="mb-1 text-[13px] font-semibold text-navy-900">Le verre et la photo</h3>
            {night ? (
              <p role="note">
                Le thème du soir n&apos;a ni verre ni photo : ces réglages sont ceux du thème clair, et ils l&apos;attendent tels que vous
                les avez laissés.
              </p>
            ) : (
              <p>
                L&apos;application est posée sur une image de l&apos;équipe. Choisissez la scène, puis un préréglage : « Poli » est
                l&apos;aspect par défaut, « Opaque » le plus lisible. Les réglages fins dosent le givre de la photo, l&apos;opacité du
                verre et le reflet de ses bords.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
