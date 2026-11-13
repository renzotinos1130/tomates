"use client";

import { Info } from "@/components/kit/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const STEPS: { when: string; title: string; text: string }[] = [
  {
    when: "Avant",
    title: "La préparation se fait toute seule",
    text: "Cette page rassemble ce qui a été terminé depuis le dernier meeting, ce qui attend une validation, ce qui est bloqué, en retard ou sans progrès. Pendant la semaine, chacun y note ses points à discuter.",
  },
  {
    when: "Pendant",
    title: "« Démarrer le meeting » ouvre le mode réunion pour tout le monde",
    text: "Un chronomètre et des étapes : le tour d'horizon, un projet à la fois, les priorités, la clôture. On y crée des tâches, on les assigne d'un clic, on note les décisions, et l'étoile choisit les priorités de la semaine. Chacun voit la même chose, en même temps.",
  },
  {
    when: "Après",
    title: "« Terminer » fige le récapitulatif",
    text: "Les priorités par personne, les nouvelles tâches, ce qui a été accompli, les décisions et les points reportés : le compte rendu rejoint l'historique et se copie en un clic pour un courriel.",
  },
];

/**
 * What the meeting screen does, in three steps. The word « en direct » and its
 * clock can read as a recording: this says what is kept, and what is not.
 */
export function MeetingGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-navy-600">
          <Info /> Comment ça marche ?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Le meeting hebdomadaire, en trois temps</DialogTitle>
          <DialogDescription>Un seul écran, qui change avec le moment de la semaine.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.when} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white tabular">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-navy-900">
                  <span className="text-navy-500">{step.when} · </span>
                  {step.title}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-navy-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-[10px] bg-navy-900/[0.05] px-3 py-2.5 text-xs leading-5 text-navy-700">
          Rien n&apos;est capté en audio ni en vidéo. « En direct » veut dire que le meeting est ouvert : l&apos;application ne garde que ce
          que vous y écrivez.
        </p>
      </DialogContent>
    </Dialog>
  );
}
