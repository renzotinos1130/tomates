import type { WorkflowStep } from "./types";

/**
 * "Pile d'actions" of the workflow canvas: the tools the team works with and
 * the steps each one offers. Logos are icon keys (`lucide:<name>`), so the
 * canvas never loads images from another site.
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
    name: "Team Tomate HQ",
    logo: "lucide:list-checks",
    actions: [
      { label: "Créer une tâche", detail: "Ajoute une tâche au bon projet.", kind: "integration", tool: "Team Tomate HQ" },
      { label: "Assigner un responsable", detail: "Quelqu'un prend le relais.", kind: "integration", tool: "Team Tomate HQ" },
      { label: "Valider au meeting", detail: "On tranche ensemble mercredi.", kind: "review", tool: "Team Tomate HQ", logo: "lucide:calendar-check" },
      { label: "Priorité de la semaine", detail: "À boucler avant mercredi prochain.", kind: "delivery", tool: "Team Tomate HQ", logo: "lucide:star" },
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
      { label: "Envoyer un courriel", detail: "Informe un client ou un partenaire.", kind: "delivery", tool: "Courriel" },
    ],
  },
];

export const AGENT_TEMPLATE: WorkflowStep = {
  label: "Nouvel agent IA",
  detail: "Décrivez ce que fait cet agent.",
  kind: "agent",
  tool: "Agent IA",
  logo: "lucide:sparkles",
};
