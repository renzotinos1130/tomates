import type { WorkflowStep } from "./types";

/**
 * "Pile d'actions" of the workflow canvas: ready-made steps, grouped by the
 * kind of work. A group is not a project: a step of « Design » or « Courriel »
 * can belong to any project, and each step chooses its own (and its person).
 * Logos are icon keys (`lucide:<name>`), so the canvas never loads images from
 * another site.
 */
export interface WorkflowAppDef {
  id: string;
  name: string;
  logo: string;
  actions: WorkflowStep[];
}

export const WORKFLOW_APPS: WorkflowAppDef[] = [
  {
    id: "hq",
    name: "Étapes de base",
    logo: "lucide:list-checks",
    actions: [
      { label: "Tâche à faire", detail: "Décrivez ce qu'il y a à faire.", kind: "agent" },
      { label: "Valider au meeting", detail: "On tranche ensemble au meeting hebdomadaire.", kind: "review", logo: "lucide:calendar-check" },
      { label: "Priorité de la semaine", detail: "À boucler avant le prochain meeting.", kind: "delivery", logo: "lucide:star" },
    ],
  },
  {
    id: "social",
    name: "Médias sociaux",
    logo: "lucide:megaphone",
    actions: [
      { label: "Nouveau commentaire", detail: "Un abonné réagit à une publication.", kind: "trigger", tool: "Médias sociaux", logo: "lucide:message-square" },
      { label: "Programmer une publication", detail: "Planifie le contenu sur les réseaux.", kind: "delivery", tool: "Médias sociaux" },
      { label: "Publier une vidéo", detail: "Reel ou vidéo courte mise en ligne.", kind: "delivery", tool: "Médias sociaux", logo: "lucide:clapperboard" },
    ],
  },
  {
    id: "design",
    name: "Design",
    logo: "lucide:palette",
    actions: [
      { label: "Créer les visuels", detail: "Décline le gabarit pour chaque format.", kind: "integration", tool: "Design" },
      { label: "Valider la maquette", detail: "L'équipe approuve avant intégration.", kind: "review", tool: "Design" },
    ],
  },
  {
    id: "web",
    name: "Site Web",
    logo: "lucide:globe",
    actions: [
      { label: "Formulaire reçu", detail: "Une demande arrive par le site.", kind: "trigger", tool: "Site Web" },
      { label: "Mettre en ligne", detail: "La page est publiée.", kind: "delivery", tool: "Site Web", logo: "lucide:rocket" },
    ],
  },
  {
    id: "app",
    name: "Application",
    logo: "lucide:smartphone",
    actions: [
      { label: "Rapport de plantage", detail: "Un bogue est signalé par un testeur.", kind: "trigger", tool: "Application" },
      { label: "Envoyer aux testeurs", detail: "La build part en bêta.", kind: "integration", tool: "Application", logo: "lucide:users" },
      { label: "Publier la version", detail: "Envoi aux boutiques d'applications.", kind: "delivery", tool: "Application", logo: "lucide:rocket" },
    ],
  },
  {
    id: "mail",
    name: "Courriel",
    logo: "lucide:mail",
    actions: [
      { label: "Courriel reçu", detail: "Un message arrive dans la boîte de l'équipe.", kind: "trigger", tool: "Courriel" },
      { label: "Rédiger le texte", detail: "Objet, message et appel à l'action.", kind: "agent", tool: "Courriel" },
      { label: "Intégrer le courriel", detail: "Montage dans l'outil d'envoi, tests d'affichage.", kind: "integration", tool: "Courriel" },
      { label: "Envoyer un courriel", detail: "Informe un client ou un partenaire.", kind: "delivery", tool: "Courriel" },
    ],
  },
];

/** What « Ajouter une étape » starts from: a piece of work, to be named and given to someone. */
export const STEP_TEMPLATE: WorkflowStep = {
  label: "Nouvelle étape",
  detail: "Décrivez ce qu'il y a à faire.",
  kind: "agent",
};
