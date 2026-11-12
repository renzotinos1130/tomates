/**
 * Données de démonstration réalistes — utilisées UNIQUEMENT en mode démo
 * (aucune variable Supabase configurée) et par `npm run seed:local`.
 * Toutes les dates sont calculées par rapport à « maintenant » pour que la
 * démo reste vivante quel que soit le jour où on l'ouvre.
 */
import { addDays } from "date-fns";
import { directPair, GENERAL_CHANNEL_ID } from "../chat";
import { isMeetingDay, toDateOnly, weekStartOf } from "../dates";
import { buildMeetingSummary } from "../selectors";
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  Comment,
  ID,
  Meeting,
  MeetingItem,
  MeetingPriority,
  Member,
  MemberColor,
  Project,
  Snapshot,
  Subtask,
  Task,
  TaskEvent,
  TaskPriority,
  TaskStatus,
  Workflow,
  WorkflowDoc,
} from "../types";

export const DEMO_MEMBER_IDS = {
  camille: "11111111-1111-4111-8111-111111111111",
  mathieu: "22222222-2222-4222-8222-222222222222",
  lea: "33333333-3333-4333-8333-333333333333",
  olivier: "44444444-4444-4444-8444-444444444444",
  sophie: "55555555-5555-4555-8555-555555555555",
} as const;

type Who = keyof typeof DEMO_MEMBER_IDS;

const PEOPLE: { key: Who; name: string; color: MemberColor; role: Member["role"] }[] = [
  { key: "camille", name: "Camille Roy", color: "teal", role: "admin" },
  { key: "mathieu", name: "Mathieu Gagnon", color: "amber", role: "member" },
  { key: "lea", name: "Léa Tremblay", color: "indigo", role: "member" },
  { key: "olivier", name: "Olivier Bouchard", color: "rose", role: "member" },
  { key: "sophie", name: "Sophie Lavoie", color: "violet", role: "member" },
];

const PROJECTS: Omit<Project, "created_at" | "created_by" | "archived_at">[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    slug: "application",
    name: "Application",
    description: "Application mobile Prospero — produit, design et mise en marché.",
    color: "teal",
    icon: "smartphone",
    position: 1,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    slug: "site-web",
    name: "Site Web",
    description: "Site public prospero — contenu, design, SEO et conversion.",
    color: "indigo",
    icon: "globe",
    position: 2,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    slug: "medias-sociaux",
    name: "Médias sociaux",
    description: "Présence Instagram, LinkedIn et TikTok — contenu et communauté.",
    color: "amber",
    icon: "megaphone",
    position: 3,
  },
];

type ProjKey = "app" | "web" | "social";
const PROJ: Record<ProjKey, ID> = {
  app: PROJECTS[0].id,
  web: PROJECTS[1].id,
  social: PROJECTS[2].id,
};

interface SeedTask {
  key: string;
  p: ProjKey;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  who: Who | null;
  /** Échéance en jours par rapport à aujourd'hui. */
  due?: number;
  /** Création, en jours avant aujourd'hui. */
  created: number;
  /** Dernier changement de statut, en jours avant aujourd'hui (défaut : création). */
  moved?: number;
  /** Idem, mais en heures (prioritaire) — pour l'activité « de ce matin ». */
  movedHours?: number;
  description?: string;
  subtasks?: [string, boolean][];
  comments?: [Who, string, number][]; // auteur, texte, il y a N heures
  /** Créée pendant le meeting de la semaine précédente. */
  inLastMeeting?: boolean;
  priorityLast?: boolean;
  /** Priorité d'un meeting plus ancien : 2 = avant-dernier, 3 = antépénultième. */
  priorityBefore?: 2 | 3;
  archived?: boolean;
}

const TASKS: SeedTask[] = [
  /* ------------------------------ Application ----------------------------- */
  {
    key: "app-signup",
    p: "app",
    title: "Finaliser le parcours d'inscription",
    status: "in_progress",
    priority: "high",
    who: "mathieu",
    due: 2,
    created: 16,
    moved: 6,
    description:
      "Parcours complet : courriel → code de vérification → profil. Objectif : moins de 60 secondes pour créer un compte.",
    subtasks: [
      ["Écran de saisie du courriel", true],
      ["Vérification par code à 6 chiffres", true],
      ["Écran de profil (nom, photo)", false],
      ["Tests sur Android et iOS", false],
    ],
    comments: [
      ["lea", "Les maquettes de l'écran profil sont à jour dans Figma 👍", 30],
      ["mathieu", "Merci ! Je l'intègre demain matin.", 26],
    ],
    priorityLast: true,
  },
  {
    key: "app-push",
    p: "app",
    title: "Intégrer les notifications push (iOS et Android)",
    status: "todo",
    priority: "normal",
    who: "mathieu",
    due: 8,
    created: 9,
  },
  {
    key: "app-crash",
    p: "app",
    title: "Corriger le crash au démarrage sur Android 14",
    status: "blocked",
    priority: "high",
    who: "olivier",
    due: -1,
    created: 8,
    moved: 3,
    description:
      "Reproduit sur Samsung Galaxy S23 seulement. Il nous faut les journaux complets de l'appareil d'un bêta-testeur.",
    comments: [
      ["olivier", "Bloqué : j'attends les journaux de l'appareil de notre bêta-testeur. Je relance aujourd'hui.", 50],
      ["camille", "Je peux prêter mon S23 si ça aide à reproduire.", 20],
    ],
    priorityLast: true,
  },
  {
    key: "app-testflight",
    p: "app",
    title: "Préparer la build TestFlight 1.3",
    status: "review",
    priority: "high",
    who: "olivier",
    due: 0,
    created: 7,
    moved: 1,
    subtasks: [
      ["Notes de version", true],
      ["Build signée", true],
      ["Validation par l'équipe", false],
    ],
    priorityLast: true,
  },
  {
    key: "app-store-copy",
    p: "app",
    title: "Rédiger les textes de la fiche App Store",
    status: "review",
    priority: "normal",
    who: "sophie",
    due: 1,
    created: 10,
    moved: 2,
    comments: [["sophie", "Première version prête, j'aimerais vos commentaires mercredi.", 40]],
  },
  {
    key: "app-dashboard-mock",
    p: "app",
    title: "Maquettes du tableau de bord utilisateur",
    status: "done",
    priority: "normal",
    who: "lea",
    due: -2,
    created: 14,
    moved: 3,
  },
  {
    key: "app-iap",
    p: "app",
    title: "Tester le paiement intégré en environnement sandbox",
    status: "todo",
    priority: "high",
    who: "olivier",
    due: 5,
    created: 13,
  },
  {
    key: "app-privacy",
    p: "app",
    title: "Mettre à jour la politique de confidentialité",
    status: "todo",
    priority: "low",
    who: "camille",
    due: 12,
    created: 4,
  },
  {
    key: "app-analytics",
    p: "app",
    title: "Choisir l'outil d'analytique produit",
    status: "done",
    priority: "normal",
    who: "camille",
    created: 12,
    moved: 5,
    description: "Comparatif PostHog / Amplitude / Mixpanel. Décision : PostHog (hébergé au Canada).",
    priorityBefore: 2,
  },
  {
    key: "app-perf",
    p: "app",
    title: "Optimiser le temps de chargement de l'accueil",
    status: "in_progress",
    priority: "normal",
    who: "mathieu",
    due: 6,
    created: 15,
    moved: 11,
  },
  {
    key: "app-icon",
    p: "app",
    title: "Icône et écran de lancement — version finale",
    status: "done",
    priority: "low",
    who: "lea",
    created: 20,
    moved: 9,
    priorityBefore: 2,
  },
  {
    key: "app-beta-plan",
    p: "app",
    title: "Plan de tests bêta avec 20 utilisateurs",
    status: "todo",
    priority: "normal",
    who: "camille",
    due: 9,
    created: 7,
    inLastMeeting: true,
  },
  {
    key: "app-onboarding-old",
    p: "app",
    title: "Atelier de cadrage du MVP",
    status: "done",
    priority: "normal",
    who: "camille",
    created: 40,
    moved: 24,
    archived: true,
    priorityBefore: 3,
  },

  /* -------------------------------- Site Web ------------------------------ */
  {
    key: "web-home",
    p: "web",
    title: "Refonte de la page d'accueil",
    status: "in_progress",
    priority: "high",
    who: "lea",
    due: 3,
    created: 18,
    moved: 6,
    subtasks: [
      ["Section héros + appel à l'action", true],
      ["Témoignages clients", true],
      ["Section « Comment ça marche »", true],
      ["Version mobile", false],
      ["Relecture des textes", false],
    ],
    comments: [["camille", "Le nouveau héros est superbe. On garde le jaune pour le bouton ?", 22]],
    priorityLast: true,
  },
  {
    key: "web-about",
    p: "web",
    title: "Rédiger la page « À propos »",
    status: "review",
    priority: "normal",
    who: "sophie",
    due: -2,
    created: 12,
    moved: 4,
    priorityLast: true,
  },
  {
    key: "web-seo",
    p: "web",
    title: "Optimiser le SEO des pages services",
    status: "todo",
    priority: "normal",
    who: "mathieu",
    due: 10,
    created: 11,
  },
  {
    key: "web-contact",
    p: "web",
    title: "Intégrer le formulaire de contact avec validation",
    status: "done",
    priority: "normal",
    who: "mathieu",
    created: 13,
    moved: 2,
    priorityLast: true,
  },
  {
    key: "web-plausible",
    p: "web",
    title: "Mettre en place Plausible Analytics",
    status: "done",
    priority: "low",
    who: "camille",
    created: 9,
    moved: 4,
  },
  {
    key: "web-photos",
    p: "web",
    title: "Photos de l'équipe pour le site",
    status: "blocked",
    priority: "normal",
    who: "sophie",
    due: -3,
    created: 17,
    moved: 5,
    comments: [["sophie", "Le photographe a reporté la séance à la semaine prochaine.", 70]],
  },
  {
    key: "web-menu",
    p: "web",
    title: "Corriger l'affichage mobile du menu",
    status: "done",
    priority: "high",
    who: "lea",
    created: 5,
    movedHours: 1.5,
  },
  {
    key: "web-landing",
    p: "web",
    title: "Page de lancement de l'application",
    status: "todo",
    priority: "high",
    who: "lea",
    due: 7,
    created: 7,
    inLastMeeting: true,
  },
  {
    key: "web-english",
    p: "web",
    title: "Traduction anglaise des pages principales",
    status: "todo",
    priority: "low",
    who: "olivier",
    created: 21,
  },
  {
    key: "web-a11y",
    p: "web",
    title: "Audit d'accessibilité (contraste, navigation clavier)",
    status: "in_progress",
    priority: "normal",
    who: "camille",
    due: 4,
    created: 10,
    moved: 6,
    priorityLast: true,
  },
  {
    key: "web-legal",
    p: "web",
    title: "Mentions légales et politique de témoins",
    status: "todo",
    priority: "normal",
    who: "camille",
    due: 14,
    created: 3,
  },

  /* ---------------------------- Médias sociaux ---------------------------- */
  {
    key: "soc-calendar",
    p: "social",
    title: "Calendrier éditorial de décembre",
    status: "in_progress",
    priority: "high",
    who: "sophie",
    due: 2,
    created: 9,
    moved: 5,
    subtasks: [
      ["Thèmes de la semaine", true],
      ["Dates clés (lancement, Fêtes)", true],
      ["Répartition par réseau", false],
    ],
    priorityLast: true,
  },
  {
    key: "soc-video",
    p: "social",
    title: "Tourner la vidéo de présentation de Prospero",
    status: "todo",
    priority: "high",
    who: "olivier",
    due: 6,
    created: 12,
    subtasks: [
      ["Script", true],
      ["Repérage des lieux", false],
      ["Tournage", false],
      ["Montage", false],
    ],
  },
  {
    key: "soc-linkedin",
    p: "social",
    title: "Carrousel LinkedIn — annonce du lancement",
    status: "review",
    priority: "normal",
    who: "sophie",
    due: 0,
    created: 6,
    moved: 1,
  },
  {
    key: "soc-community",
    p: "social",
    title: "Répondre aux commentaires et messages Instagram",
    status: "in_progress",
    priority: "low",
    who: "mathieu",
    due: 1,
    created: 6,
    moved: 6,
  },
  {
    key: "soc-campaign",
    p: "social",
    title: "Visuels de la campagne de lancement",
    status: "in_progress",
    priority: "high",
    who: "lea",
    due: 5,
    created: 7,
    moved: 4,
    inLastMeeting: true,
    priorityLast: true,
  },
  {
    key: "soc-report",
    p: "social",
    title: "Rapport de performance d'octobre",
    status: "done",
    priority: "normal",
    who: "sophie",
    created: 11,
    moved: 6,
  },
  {
    key: "soc-tiktok",
    p: "social",
    title: "Créer la page TikTok de Prospero",
    status: "done",
    priority: "low",
    who: "olivier",
    created: 8,
    movedHours: 3,
  },
  {
    key: "soc-creators",
    p: "social",
    title: "Partenariat avec 3 créateurs locaux",
    status: "blocked",
    priority: "normal",
    who: "camille",
    due: 3,
    created: 14,
    moved: 6,
    comments: [["camille", "En attente de la validation du budget — on en parle mercredi.", 48]],
    priorityLast: true,
  },
  {
    key: "soc-reels",
    p: "social",
    title: "Série de 5 reels « coulisses »",
    status: "todo",
    priority: "normal",
    who: "olivier",
    due: 11,
    created: 5,
  },
  {
    key: "soc-tone",
    p: "social",
    title: "Charte de ton et de style pour les réseaux",
    status: "done",
    priority: "normal",
    who: "sophie",
    created: 15,
    moved: 8,
    priorityBefore: 2,
  },
  {
    key: "soc-schedule",
    p: "social",
    title: "Programmer les publications de la semaine",
    status: "todo",
    priority: "normal",
    who: "sophie",
    due: 1,
    created: 2,
  },
  {
    key: "soc-old-audit",
    p: "social",
    title: "Audit des comptes existants",
    status: "done",
    priority: "low",
    who: "sophie",
    created: 35,
    moved: 17,
    archived: true,
    priorityBefore: 3,
  },
];

/** Deterministic UUID-shaped ids from a key, so the seed is stable. */
function seedId(prefix: string, key: string): ID {
  let h = 2166136261;
  for (const c of prefix + key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (h.toString(16).padStart(8, "0") + key.length.toString(16).padStart(4, "0")).slice(0, 12);
  const p = prefix.padEnd(8, "0").slice(0, 8).replace(/[^0-9a-f]/g, "c");
  return `${p}-${hex.slice(0, 4)}-4${hex.slice(4, 7)}-8${hex.slice(7, 10)}-${hex.padEnd(12, "0")}`;
}

export function buildDemoSnapshot(now = new Date()): Snapshot {
  const hours = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const daysAgo = (d: number, hour = 10) => {
    const x = addDays(now, -d);
    x.setHours(hour, (d * 7) % 60, 0, 0);
    if (x.getTime() > now.getTime()) return new Date(now.getTime() - 60_000 * (d + 5)).toISOString();
    return x.toISOString();
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueIn = (d: number) => toDateOnly(addDays(today, d));
  const id = (w: Who) => DEMO_MEMBER_IDS[w];

  const members: Member[] = PEOPLE.map((p, i) => ({
    id: DEMO_MEMBER_IDS[p.key],
    email: `${p.key}@prospero.test`,
    full_name: p.name,
    color: p.color,
    avatar_url: null,
    role: p.role,
    active: true,
    created_at: daysAgo(60 - i),
  }));

  const projects: Project[] = PROJECTS.map((p) => ({
    ...p,
    archived_at: null,
    created_at: daysAgo(60),
    created_by: id("camille"),
  }));

  /* ------------------------------ meetings ----------------------------- */
  const w0 = weekStartOf(now);
  const meetingAt = (weekOffset: number, minutes = 0) => {
    const d = addDays(w0, weekOffset * 7);
    d.setHours(9, 30 + minutes, 0, 0);
    return d.toISOString();
  };
  const onMeetingDay = isMeetingDay(now);
  // Offsets (in weeks, relative to the current week) of meetings already held.
  const closedOffsets = onMeetingDay ? [-3, -2, -1] : [-3, -2, -1, 0];
  const plannedOffset = onMeetingDay ? 0 : 1;

  const meetings: Meeting[] = closedOffsets.map((o) => ({
    id: seedId("e0000000", `meeting${o}`),
    week_start: toDateOnly(addDays(w0, o * 7)),
    status: "closed",
    started_at: meetingAt(o),
    ended_at: meetingAt(o, 52),
    started_by: id("camille"),
    attendees: Object.values(DEMO_MEMBER_IDS),
    notes: "",
    summary: null,
    created_at: meetingAt(o, -60 * 24),
  }));
  meetings.push({
    id: seedId("e0000000", `meeting${plannedOffset}`),
    week_start: toDateOnly(addDays(w0, plannedOffset * 7)),
    status: "planned",
    started_at: null,
    ended_at: null,
    started_by: null,
    attendees: [],
    notes: "",
    summary: null,
    created_at: daysAgo(3),
  });
  const lastClosed = meetings[closedOffsets.length - 1];
  const planned = meetings[meetings.length - 1];

  /* -------------------------------- tasks ------------------------------ */
  const tasks: Task[] = [];
  const subtasks: Subtask[] = [];
  const comments: Comment[] = [];
  const events: TaskEvent[] = [];
  const priorities: MeetingPriority[] = [];
  const positions: Record<string, number> = {};
  const lastMeetingStart = lastClosed.started_at as string;

  for (const s of TASKS) {
    const taskId = seedId("b0000000", s.key);
    const createdAt = s.inLastMeeting ? new Date(new Date(lastMeetingStart).getTime() + 20 * 60_000).toISOString() : daysAgo(s.created, 9);
    const movedAt =
      s.movedHours !== undefined ? hours(s.movedHours) : s.moved !== undefined ? daysAgo(s.moved, 15) : createdAt;
    const col = `${s.p}:${s.status}`;
    positions[col] = (positions[col] ?? 0) + 1024;
    const task: Task = {
      id: taskId,
      project_id: PROJ[s.p],
      title: s.title,
      description: s.description ?? "",
      status: s.status,
      priority: s.priority,
      assignee_id: s.who ? id(s.who) : null,
      due_date: s.due !== undefined ? dueIn(s.due) : null,
      position: positions[col],
      meeting_id: s.inLastMeeting ? lastClosed.id : null,
      created_by: id("camille"),
      created_at: createdAt,
      updated_at: movedAt,
      status_changed_at: movedAt,
      completed_at: s.status === "done" ? movedAt : null,
      archived_at: s.archived ? daysAgo(Math.max(0, (s.moved ?? s.created) - 5)) : null,
    };
    tasks.push(task);

    events.push({
      id: seedId("f0000000", `${s.key}-created`),
      task_id: taskId,
      project_id: task.project_id,
      actor_id: id("camille"),
      kind: "created",
      old_value: null,
      new_value: task.title,
      created_at: createdAt,
    });
    if (s.status !== "todo") {
      const from: TaskStatus = s.status === "done" ? "in_progress" : s.status === "in_progress" ? "todo" : "in_progress";
      events.push({
        id: seedId("f0000000", `${s.key}-status`),
        task_id: taskId,
        project_id: task.project_id,
        actor_id: task.assignee_id,
        kind: "status",
        old_value: from,
        new_value: s.status,
        created_at: movedAt,
      });
    }
    if (task.archived_at) {
      events.push({
        id: seedId("f0000000", `${s.key}-arch`),
        task_id: taskId,
        project_id: task.project_id,
        actor_id: id("camille"),
        kind: "archived",
        old_value: null,
        new_value: null,
        created_at: task.archived_at,
      });
    }

    s.subtasks?.forEach(([title, done], i) =>
      subtasks.push({
        id: seedId("c0000000", `${s.key}-st${i}`),
        task_id: taskId,
        title,
        done,
        position: (i + 1) * 1024,
        created_at: createdAt,
      }),
    );
    s.comments?.forEach(([who, body, h], i) => {
      const cid = seedId("d0000000", `${s.key}-c${i}`);
      const at = hours(h);
      comments.push({ id: cid, task_id: taskId, author_id: id(who), body, created_at: at, updated_at: at });
      events.push({
        id: seedId("f0000000", `${s.key}-c${i}`),
        task_id: taskId,
        project_id: task.project_id,
        actor_id: id(who),
        kind: "commented",
        old_value: null,
        new_value: cid,
        created_at: at,
      });
    });

    const older = s.priorityBefore ? meetings[closedOffsets.length - s.priorityBefore] : null;
    if (older) {
      priorities.push({
        meeting_id: older.id,
        task_id: taskId,
        position: priorities.length * 1024 + 1024,
        created_by: id("camille"),
        created_at: older.started_at as string,
      });
    }
    if (s.priorityLast) {
      priorities.push({
        meeting_id: lastClosed.id,
        task_id: taskId,
        position: priorities.length * 1024 + 1024,
        created_by: id("camille"),
        created_at: lastMeetingStart,
      });
    }
  }

  /* ---------------------------- meeting items -------------------------- */
  const items: MeetingItem[] = [];
  const addItem = (
    meeting: Meeting,
    kind: MeetingItem["kind"],
    body: string,
    opts: { project?: ProjKey; who?: Who; done?: boolean } = {},
  ) => {
    items.push({
      id: seedId("90000000", `${meeting.week_start}-${kind}-${items.length}`),
      meeting_id: meeting.id,
      kind,
      body,
      project_id: opts.project ? PROJ[opts.project] : null,
      author_id: id(opts.who ?? "camille"),
      done: opts.done ?? kind === "decision",
      position: (items.length + 1) * 1024,
      created_at: meeting.started_at ?? meeting.created_at,
    });
  };
  const [m3, m2, m1] = meetings.slice(closedOffsets.length - 3, closedOffsets.length);
  addItem(m3, "decision", "On fixe la rencontre hebdomadaire au mercredi 9 h 30.");
  addItem(m3, "decision", "Léa pilote le design de l'application et du site.", { project: "app" });
  addItem(m3, "topic", "Répartition des rôles entre partenaires", { done: true });
  addItem(m2, "decision", "Lancement public visé pour début décembre.", { project: "app" });
  addItem(m2, "decision", "On publie au moins 3 fois par semaine sur Instagram.", { project: "social", who: "sophie" });
  addItem(m2, "topic", "Choix de l'outil d'analytique", { done: true, who: "mathieu" });
  addItem(m1, "decision", "On passe à Plausible pour l'analytique du site web.", { project: "web" });
  addItem(m1, "decision", "Budget de 1 500 $ réservé pour la campagne de lancement.", { project: "social" });
  addItem(m1, "decision", "La bêta fermée démarre avec 20 utilisateurs.", { project: "app", who: "mathieu" });
  addItem(m1, "topic", "Embaucher un pigiste pour le montage vidéo ?", { project: "social", who: "olivier" });
  if (!onMeetingDay) {
    const m0 = meetings[closedOffsets.length - 1];
    if (m0 !== m1) addItem(m0, "decision", "Revue de la build TestFlight vendredi avec toute l'équipe.", { project: "app" });
  }
  addItem(planned, "topic", "Date de lancement : on confirme le 2 décembre ?", { project: "app", who: "camille" });
  addItem(planned, "topic", "Retour sur les tests TestFlight 1.3", { project: "app", who: "olivier" });
  addItem(planned, "topic", "Budget pour les créateurs de contenu", { project: "social", who: "sophie" });
  addItem(planned, "topic", "Qui s'occupe de la séance photo reportée ?", { project: "web", who: "lea" });

  /* ------------------------ frozen recaps (history) -------------------- */
  const snapshotBase = {
    tasks,
    members,
    projects,
    items,
    priorities,
    meetings,
  };
  for (const m of meetings) {
    if (m.status === "closed" && m.ended_at) {
      m.summary = buildMeetingSummary(snapshotBase, m, m.ended_at);
    }
  }

  /* ------------------------------ workflows ---------------------------- */
  const chain = (ids: string[]): WorkflowDoc["edges"] =>
    ids.slice(1).map((target, i) => ({ id: `${ids[i]}-${target}`, source: ids[i], target }));
  const workflows: Workflow[] = [
    {
      id: seedId("70000000", "wf-contenu"),
      name: "Publication d'un contenu",
      project_id: PROJ.social,
      graph: {
        nodes: [
          {
            id: "idee",
            position: { x: 40, y: 60 },
            data: { label: "Idée de contenu", detail: "Une idée entre dans le calendrier éditorial.", kind: "trigger", tool: "Calendrier", logo: "lucide:lightbulb" },
          },
          {
            id: "redaction",
            position: { x: 290, y: 170 },
            data: { label: "Rédaction assistée", detail: "L'agent propose un texte et trois accroches.", kind: "agent", tool: "Agent IA", logo: "lucide:sparkles" },
          },
          {
            id: "visuels",
            position: { x: 540, y: 60 },
            data: { label: "Création des visuels", detail: "Le gabarit est décliné pour chaque réseau.", kind: "integration", tool: "Design", logo: "lucide:palette" },
          },
          {
            id: "validation",
            position: { x: 790, y: 170 },
            data: { label: "Validation de l'équipe", detail: "Relecture rapide avant de publier.", kind: "review", tool: "Team Tomate HQ", logo: "lucide:list-checks" },
          },
          {
            id: "publication",
            position: { x: 1040, y: 60 },
            data: { label: "Programmation", detail: "Publication programmée sur Instagram et LinkedIn.", kind: "delivery", tool: "Médias sociaux", logo: "lucide:megaphone" },
          },
        ],
        edges: chain(["idee", "redaction", "visuels", "validation", "publication"]),
      },
      created_by: id("sophie"),
      created_at: daysAgo(9),
      updated_at: hours(20),
      updated_by: id("sophie"),
    },
    {
      id: seedId("70000000", "wf-version"),
      name: "Sortie d'une version de l'application",
      project_id: PROJ.app,
      graph: {
        nodes: [
          {
            id: "build",
            position: { x: 40, y: 120 },
            data: { label: "Build prête", detail: "Une nouvelle build est disponible.", kind: "trigger", tool: "Application", logo: "lucide:smartphone" },
          },
          {
            id: "tests",
            position: { x: 290, y: 30 },
            data: { label: "Tests bêta", detail: "Vingt testeurs reçoivent la build.", kind: "integration", tool: "TestFlight", logo: "lucide:users" },
          },
          {
            id: "revue",
            position: { x: 540, y: 120 },
            data: { label: "Revue du mercredi", detail: "On décide ensemble : on publie ou on corrige.", kind: "review", tool: "Team Tomate HQ", logo: "lucide:calendar-check" },
          },
          {
            id: "store",
            position: { x: 790, y: 30 },
            data: { label: "Publication", detail: "Envoi à l'App Store et à Google Play.", kind: "delivery", tool: "Boutiques", logo: "lucide:rocket" },
          },
          {
            id: "annonce",
            position: { x: 790, y: 230 },
            data: { label: "Annonce", detail: "Courriel et publication de lancement.", kind: "delivery", tool: "Courriel", logo: "lucide:mail" },
          },
        ],
        edges: [...chain(["build", "tests", "revue", "store"]), { id: "revue-annonce", source: "revue", target: "annonce" }],
      },
      created_by: id("olivier"),
      created_at: daysAgo(6),
      updated_at: daysAgo(2),
      updated_by: id("mathieu"),
    },
  ];

  /* -------------------------------- chat ------------------------------- */
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const dayAt = (d: number, hour: number, minute: number) => {
    const x = addDays(now, -d);
    x.setHours(hour, minute, 0, 0);
    return x.toISOString();
  };
  const chat_conversations: ChatConversation[] = [
    { id: GENERAL_CHANNEL_ID, kind: "channel", name: "Général", member_a: null, member_b: null, created_by: null, created_at: daysAgo(60) },
  ];
  const chat_messages: ChatMessage[] = [];
  const say = (conversation: ID, who: Who, at: string, body: string) =>
    chat_messages.push({
      id: seedId("c2000000", `${conversation.slice(0, 8)}-${chat_messages.length}`),
      conversation_id: conversation,
      author_id: id(who),
      body,
      created_at: at,
      deleted_at: null,
    });
  const direct = (a: Who, b: Who, createdAt: string): ID => {
    const [member_a, member_b] = directPair(id(a), id(b));
    const row: ChatConversation = {
      id: seedId("c1000000", `dm-${a}-${b}`),
      kind: "direct",
      name: null,
      member_a,
      member_b,
      created_by: id(a),
      created_at: createdAt,
    };
    chat_conversations.push(row);
    return row.id;
  };

  say(GENERAL_CHANNEL_ID, "camille", dayAt(2, 9, 12), "Bon matin ! Petit rappel : le meeting de mercredi est à 9 h 30. Ajoutez vos points à discuter d'ici mardi soir.");
  say(GENERAL_CHANNEL_ID, "sophie", dayAt(2, 9, 20), "Noté. J'aurai une question sur le budget pour les créateurs de contenu.");
  say(GENERAL_CHANNEL_ID, "olivier", dayAt(2, 14, 5), "La build TestFlight 1.3 est partie en validation. Si quelqu'un a dix minutes pour la tester ce soir, ça m'aiderait beaucoup.");
  say(GENERAL_CHANNEL_ID, "lea", dayAt(2, 14, 11), "Je m'en occupe après le souper 👍");
  say(GENERAL_CHANNEL_ID, "mathieu", dayAt(1, 10, 32), "Le parcours d'inscription avance bien, il reste la vérification du courriel. Je vise vendredi.");
  say(GENERAL_CHANNEL_ID, "camille", dayAt(1, 10, 40), "Super. Dis-moi si tu bloques sur quelque chose.");
  say(GENERAL_CHANNEL_ID, "lea", dayAt(1, 16, 48), "Les maquettes de la page d'accueil sont dans le dossier partagé. Vos commentaires sont les bienvenus avant mercredi.");
  say(GENERAL_CHANNEL_ID, "olivier", minutesAgo(184), "Mauvaise nouvelle : le crash au démarrage sur Android 14 est revenu. Je creuse ça ce matin.");
  say(GENERAL_CHANNEL_ID, "mathieu", minutesAgo(176), "Je peux regarder les journaux avec toi vers 11 h si tu veux.");
  say(GENERAL_CHANNEL_ID, "sophie", minutesAgo(35), "Le carrousel LinkedIn pour l'annonce est prêt à valider. Qui a deux minutes ?");
  say(GENERAL_CHANNEL_ID, "lea", minutesAgo(12), "Je regarde ça tout de suite.");

  const withLea = direct("camille", "lea", dayAt(1, 11, 15));
  say(withLea, "lea", dayAt(1, 11, 15), "As-tu une minute pour regarder les couleurs de la page d'accueil ? J'hésite entre deux versions.");
  say(withLea, "camille", dayAt(1, 11, 22), "Oui, envoie-les-moi. Je regarde avant le dîner.");
  say(withLea, "lea", dayAt(1, 13, 40), "C'est dans le dossier « Accueil v2 ». La B est ma préférée.");
  say(withLea, "camille", dayAt(1, 13, 52), "La B aussi pour moi. On la montre à l'équipe mercredi.");
  say(withLea, "lea", minutesAgo(70), "Parfait, je prépare trois écrans pour le meeting.");

  const withOlivier = direct("camille", "olivier", dayAt(3, 15, 30));
  say(withOlivier, "camille", dayAt(3, 15, 30), "Est-ce que la bêta peut passer à 40 testeurs dès lundi ?");
  say(withOlivier, "olivier", dayAt(3, 15, 41), "Oui, tant que le crash Android est réglé d'ici là. Je te confirme vendredi.");
  say(withOlivier, "camille", dayAt(3, 15, 43), "Parfait, merci !");

  const mathieuSophie = direct("sophie", "mathieu", dayAt(1, 9, 5));
  say(mathieuSophie, "sophie", dayAt(1, 9, 5), "Peux-tu m'envoyer les chiffres d'inscription de la semaine pour le rapport ?");
  say(mathieuSophie, "mathieu", dayAt(1, 9, 30), "Je te les envoie cet après-midi.");

  // Everyone is up to date, except Camille (the default profile): two messages
  // wait for her in the channel, one from Léa.
  const upToDate = minutesAgo(1);
  const read = (conversation: ID, who: Who, at: string): ChatParticipant => ({
    conversation_id: conversation,
    member_id: id(who),
    last_read_at: at,
  });
  const chat_participants: ChatParticipant[] = [
    ...PEOPLE.map((p) => read(GENERAL_CHANNEL_ID, p.key, p.key === "camille" ? minutesAgo(40) : upToDate)),
    read(withLea, "camille", dayAt(1, 14, 0)),
    read(withLea, "lea", upToDate),
    read(withOlivier, "camille", upToDate),
    read(withOlivier, "olivier", upToDate),
    read(mathieuSophie, "mathieu", upToDate),
    read(mathieuSophie, "sophie", upToDate),
  ];

  return {
    members,
    invites: [],
    projects,
    tasks,
    subtasks,
    comments,
    task_events: events,
    meetings,
    meeting_items: items,
    meeting_priorities: priorities,
    workflows,
    chat_conversations,
    chat_participants,
    chat_messages,
  };
}

export const DEMO_DEFAULT_MEMBER = DEMO_MEMBER_IDS.camille;

