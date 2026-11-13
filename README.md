# Team Tomate HQ

Le QG de l'équipe Prospero : nos projets, qui fait quoi, et le **meeting hebdomadaire** — dans un seul outil, simple et rapide.

![Dashboard](docs/screenshots/dashboard.webp)

## Ce que fait l'application

| | |
|---|---|
| **Dashboard** | L'état des projets en 30 secondes, sur une page en trois bandes posée directement sur l'image, de la même hauteur que la navigation. En haut, une salutation en très grand à côté de votre portrait, où vous en êtes en une phrase, et vos trois tâches à prendre en premier. Au milieu, la semaine de l'équipe : la tomate de la semaine (elle mûrit avec le score) puis une carte par partenaire, son visage au-dessus, sa charge au pied ; trois onglets changent ce que montrent les cartes (les priorités et leur potager, une tomate par priorité ; ce qui est à débloquer ; ce qui a été terminé). En bas, le prochain meeting en billet, les projets en grands pourcentages, l'activité récente. |
| **Projets** | Un tableau structuré (façon Monday) et un kanban (façon Linear) sur les mêmes données : édition en ligne, glisser-déposer, filtres, tri, archivage. |
| **Tâches** | Responsable, statut, priorité, échéance, description, sous-tâches, commentaires et historique des changements. Une tâche terminée fait tomber une petite averse de tomates. |
| **Mes tâches** | La vue du matin : mes priorités, en retard, en cours, à venir, complétées récemment. |
| **Messages** | Le canal « Général » pour toute l'équipe et des conversations directes à deux : temps réel, non-lus, recherche, émojis, suppression de ses propres messages. |
| **Meeting hebdomadaire** | Préparation automatique → mode réunion en direct → récapitulatif figé → historique. |
| **Workflows** | Un canevas pour dessiner les processus de l'équipe : déclencheurs, étapes, agents IA, validations, livraisons. Enregistrement automatique, partagé en temps réel. |
| **Équipe** | Les partenaires, leur portrait en pixel art et la charge de chacun. |
| **Paramètres** | Pour chacun : l'apparence et son mot de passe. Pour les administrateurs : le tableau des membres, la recherche, les invitations, l'activation des comptes. Pour le super administrateur : les rôles, la création des comptes et leurs mots de passe. |
| **Navigation** | Un rail d'icônes en verre qui s'ouvre sous la souris et se referme quand elle repart ; une épingle (`⌘B`) le garde ouvert. Sur téléphone, un bouton de menu ouvre la navigation en plein écran. |
| **Apparence** | Du verre poli (celui de Koloc Cloud), clair, posé sur une image de l'équipe, et un contenu sobre par-dessus. À l'arrivée, on voit d'abord l'image, nette, avec la tomate qui saute ; puis l'image se givre (floue et pâlie) et l'application apparaît dessus. Chacun règle sa matière avec « Ajuster le verre » : la scène (la ferme ou le yacht), le givre de la photo, l'opacité du verre, la saturation, le reflet des bords et la teinte. |

La semaine de travail va **du mercredi au mardi**. Les priorités de la semaine sont celles choisies au dernier meeting.

Raccourcis : `C` nouvelle tâche · `⌘K` / `Ctrl K` recherche · clic sur le glyphe de statut pour le changer · clic droit sur une tâche pour le menu contextuel · double-clic sur un titre pour le renommer.

## Démarrer en 1 minute (mode démo)

```bash
npm install
```

```bash
npm run dev
```

Ouvrez http://localhost:3000. Sans configuration Supabase, l'application démarre en **mode démo** : des données réalistes, enregistrées dans le navigateur, synchronisées entre les onglets. Le menu en bas à gauche permet de changer de profil et de réinitialiser la démo. Aucune de ces données fictives n'existe en production.

## Passer en production (Vercel + Supabase)

Avec les deux variables ci-dessous, l'application utilise Supabase : Postgres pour les données, Auth pour la connexion, Realtime pour la synchronisation entre partenaires. Sans elles, elle reste en mode démo.

**L'installation en place.** Un projet Vercel relié à ce dépôt, et une base Supabase dédiée à l'outil interne (jamais celle du site public), créée par l'intégration Supabase de Vercel. L'intégration donne au projet Vercel ses variables d'environnement, dont les deux que l'application lit et l'adresse de la base (`POSTGRES_URL_NON_POOLING`) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
```

La troisième (ou son ancien nom, `SUPABASE_SERVICE_ROLE_KEY`) reste sur le serveur : elle ne sert qu'à créer les comptes et à définir les mots de passe (`src/lib/server/accounts.ts`). Sans elle, l'application fonctionne, mais « Ajouter un membre » et les mots de passe répondent que la gestion des comptes n'est pas configurée.

**Le schéma suit le code.** Chaque déploiement de production commence par `scripts/migrate-on-deploy.mjs` (voir `vercel.json`) : les fichiers de `supabase/migrations` que la base n'a pas encore vus sont appliqués dans l'ordre et inscrits dans l'historique des migrations, comme le ferait `supabase db push`. Si l'un d'eux échoue, le déploiement s'arrête et la version en place reste en ligne. Les déploiements de prévisualisation n'ont pas ces variables : ils tournent en mode démo et ne touchent jamais à la base. Pour changer le schéma : ajouter un fichier dans `supabase/migrations`, pousser.

Pour une autre installation (un autre hébergeur, une base créée à la main), le même schéma s'applique depuis un poste :

```bash
npx supabase link --project-ref <ref-du-projet>
```

```bash
npx supabase db push
```

**Premier compte.** Tant que l'équipe est vide, l'écran de connexion propose « Premier compte » : un nom, un courriel, un mot de passe. Cette personne devient **super administratrice**, sans qu'aucun courriel soit envoyé : le faire avant de communiquer l'adresse.

**Les autres comptes.** Dans **Paramètres → Membres**, le super administrateur choisit « Ajouter un membre » : nom, courriel, rôle (partenaire ou administrateur) et un mot de passe temporaire, proposé par l'application et affiché une fois pour être transmis. À sa première connexion, la personne ne voit qu'un écran, « Choisissez votre mot de passe » ; elle entre dès qu'elle a choisi le sien. Un mot de passe perdu se remplace au même endroit (« Définir un mot de passe… »), et chacun change le sien dans **Paramètres → Compte**, en donnant son mot de passe actuel.

**Par courriel, si vous le souhaitez.** La connexion par lien et les invitations par courriel existent toujours, à côté des mots de passe. Elles demandent deux réglages dans Supabase (tableau de bord du projet) :

1. **Authentication → URL Configuration** : `Site URL` = l'adresse où l'équipe ouvre l'application ; ajouter `https://<cette-adresse>/auth/callback` aux *Redirect URLs*. Un lien de connexion ne fonctionne que s'il ramène à l'adresse d'où il a été demandé.
2. **Authentication → Emails → SMTP** : brancher un service d'envoi (Resend, par exemple). L'envoi intégré de Supabase ne livre qu'aux membres de l'organisation Supabase et se limite à quelques courriels par heure.

Une personne qui crée son compte par courriel sans avoir été invitée reste « en attente » et ne voit rien tant qu'un administrateur ne l'active pas.

**Accès.** Sur Vercel, la protection des déploiements (« Vercel Authentication ») réserve par défaut les adresses `*.vercel.app` aux membres de l'équipe Vercel. Pour que les partenaires entrent, donner au projet un domaine à vous (les domaines personnalisés ne sont pas protégés) ou limiter la protection aux prévisualisations.

## Développer avec Supabase en local

Prérequis : Docker.

```bash
npm run db:start
```

```bash
npm run db:reset
```

```bash
npm run seed:local
```

`db:reset` applique les migrations et crée six comptes de démonstration ; `seed:local` ajoute les tâches, meetings, workflows et messages de démo (le script refuse toute base qui n'est pas locale). Les données sont datées par rapport à l'heure de la machine : si elle est en UTC, lancez-le dans le fuseau de l'équipe, par exemple `TZ=America/Toronto npm run seed:local`. Copiez ensuite dans `.env.local` l'URL et les deux clés (publishable et secret) affichées par `npx supabase status`, puis `npm run dev`. Pour essayer le premier compte d'une équipe vide : `npx supabase db reset --no-seed`.

Comptes locaux : `dominic@prospero.test` (super administrateur), `alexandre@`, `maya@`, `marco@`, `antoine@`, `jimmy@prospero.test` — mot de passe `tomate-demo`. Ce sont des adresses de test (domaine réservé), pas de vraies boîtes. Les courriels (liens magiques) arrivent dans Mailpit : http://127.0.0.1:54324.

Si les styles semblent périmés après un redémarrage de `npm run dev`, supprimez le cache de développement :

```bash
rm -rf .next/dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm run icons` | Régénère `src/components/kit/icons.tsx` à partir du jeu Nova (`design/`) ; `icons:check` vérifie qu'il est à jour |
| `npm run test:e2e` | Tests Playwright de bout en bout, en mode démo (`npx playwright install chromium` la première fois) |
| `npm run db:start` / `db:stop` / `db:reset` | Supabase local |
| `npm run db:test` | Tests pgTAP du schéma et des règles de sécurité |
| `npm run seed:local` | Données de démonstration dans la base **locale** |

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · icônes Nova · Zustand · dnd-kit · React Flow · Motion · Supabase.

```
src/
  app/                      routes (pages minces : elles montent un composant)
    (app)/                  espace connecté : /, /mes-taches, /messages, /meeting, /workflows, /projets/[slug], /equipe, /parametres
    login/, auth/callback/  connexion (lien magique, mot de passe)
  proxy.ts                  session Supabase + redirection vers /login
  lib/
    types.ts                modèle de données (identique aux colonnes Postgres)
    constants.ts            statuts, priorités, couleurs
    dates.ts                semaine mercredi → mardi, formats
    selectors.ts            dérivations pures : indicateurs, seaux du meeting, récapitulatif
    task-logic.ts           règles partagées client / démo (miroir des déclencheurs SQL)
    glass.ts                réglages du verre (préréglages, arrière-plans)
    chat.ts, chat-hooks.ts  règles de la messagerie (non-lus, regroupement du fil) et leurs hooks
    avatars.ts              portraits de l'équipe (attribués par le nom)
    workflow-apps.ts        pile d'actions du canevas de workflows
    store.ts                état global + actions optimistes
    data/                   frontière de persistance
      adapter.ts            interface commune
      supabase-adapter.ts   Postgres + Realtime + présence
      demo-adapter.ts       base locale (localStorage + BroadcastChannel)
      seed.ts               données de démonstration
  components/
    ui/                     primitives shadcn, et les composants repris des références : bouton « arrow fill »,
                            barre latérale, bouton de menu, infobulle animée, carte de connexion, tableau, canevas React Flow
    kit/                    design system maison : tomate et lettrage pixel, glyphes de statut, filet d'avancement, avatars, sélecteurs
    app/                    coquille en verre : navigation (bureau et téléphone), recherche, réglages du verre, préchargeur, averse de tomates
    tasks/                  ligne de tâche, panneau de détail, menus, création rapide
    board/                  tableau, kanban, filtres, glisser-déposer
    workflows/              liste, éditeur et enregistrement des canevas
    dashboard/ my-tasks/ meeting/ team/ auth/
    settings/               paramètres des administrateurs (membres)
    chat/                   messages : conversations, fil, saisie
public/backgrounds/         les deux scènes derrière le verre (la ferme, le yacht)
public/avatars/             portraits de l'équipe (carrés de 256 px)
scripts/
  seed-local.ts             données de démonstration pour la base locale
supabase/
  migrations/               schéma, RLS, déclencheurs
  tests/database/           tests pgTAP
  seed.sql                  comptes de démo (local uniquement)
e2e/                        tests Playwright
```

**Flux de données.** L'interface ne parle jamais directement à Supabase : elle appelle une action du store, qui applique le changement tout de suite à l'écran (optimiste), le persiste par l'adaptateur, puis fusionne les changements des autres membres reçus en temps réel. En cas d'échec, l'écran revient à l'état précédent avec un message. Le mode démo et le mode Supabase partagent exactement la même interface.

**Ajouter un projet** : bouton « + » dans la navigation — aucun code. **Ajouter le portrait d'un nouveau membre** : déposer `prenom-nom.webp` dans `public/avatars/` et ajouter une ligne dans `lib/avatars.ts` ; le portrait est attribué par le nom du profil, sans égard aux majuscules ni aux accents (le prénom seul suffit quand le profil n'a que lui, comme juste après une invitation). **Ajouter un statut ou une couleur** : `lib/constants.ts`, `lib/types.ts` et la contrainte correspondante dans une nouvelle migration. **Ajouter un outil à la pile des workflows** : `lib/workflow-apps.ts`.

## Sécurité

- Chaque table a la *Row Level Security* activée ; le rôle anonyme n'a aucun droit.
- Seuls les **membres actifs** lisent et modifient les données. Un compte non invité reste en attente.
- Les commentaires ne sont modifiables que par leur auteur ; l'historique (`task_events`) est écrit uniquement par des déclencheurs, jamais par le client.
- L'auteur et le dernier éditeur d'un workflow sont fixés par le serveur.
- Messages : une conversation directe n'est lisible que par ses deux membres, y compris par le temps réel, et un client ne peut pas en créer une entre deux autres personnes. On écrit sous son propre nom, à l'heure du serveur ; un message ne se modifie pas, seul son auteur peut le supprimer.
- Un membre ne peut changer que son propre profil. Les administrateurs gèrent l'accès des partenaires et les invitent ; les rôles, les comptes des administrateurs et les mots de passe sont au super administrateur, et il en reste toujours au moins un.
- Les comptes et les mots de passe se créent sur le serveur (`src/lib/server/accounts.ts`), avec une clé qui n'en sort jamais ; chaque fonction établit d'abord qui demande, d'après sa session et sa ligne en base. Aucun mot de passe n'est conservé ni journalisé par l'application.
- Un mot de passe défini par le super administrateur est temporaire : tant que la personne n'a pas choisi le sien, la base ne lui montre que sa propre ligne. Cette obligation est enregistrée dans la même transaction que le mot de passe, et seul le serveur peut la lever.
- Seule la clé *publishable* est exposée au navigateur. En-têtes de sécurité de base dans `next.config.ts`.

## Vérifié

- `npm run lint`, `npm run typecheck`, `npm run build` : sans erreur ni avertissement.
- `npm run db:test` : 161 assertions pgTAP (droits, RLS, déclencheurs, invitations, rôles et mots de passe, workflows, messagerie).
- `npm run test:e2e` : 51 scénarios en mode démo — tableau, kanban, filtres et archivage, raccourcis et panneau de tâche, synchronisation entre onglets, meeting complet, workflows, réglages du verre, navigation (survol, épingle, téléphone), connexion, paramètres (les membres vus par le super administrateur, un administrateur et un partenaire ; ajout d'un membre et mot de passe temporaire), messagerie (écrans et règles), portraits, averse de tomates, arrivée sur la scène, dashboard en trois bandes posé sur l'image (jamais de verre sur du verre) et aligné sur la navigation, semaine de l'équipe en cartes et en trois onglets (potager, à débloquer, terminées, barre de charge), salutation et actions du dashboard, billet du meeting (compte à rebours, puis horloge en direct), lisibilité du texte sur le verre (contraste mesuré sur les deux scènes).
- Contre une instance Supabase locale : premier compte d'une équipe vide, membre ajouté avec un mot de passe temporaire puis obligé d'en choisir un autre en entrant, mot de passe redéfini, ce qu'un administrateur peut et ne peut pas faire ; connexion par mot de passe et par lien magique, persistance en base, propagation en temps réel entre deux navigateurs (statut, commentaire, glisser-déposer, meeting en direct, canevas de workflow), présence, compte non invité bloqué puis activé depuis les paramètres, déconnexion ; messagerie à trois comptes (livraison en direct, conversation directe invisible pour un tiers dans l'interface, le temps réel et l'API, lecture persistée, suppression propagée).

## Limites connues du MVP

- Pas de pièces jointes, de notifications par courriel ni d'intégrations externes — volontairement. La messagerie est du texte : pas de fichiers, de fils de réponses, de mentions ni de modification d'un message envoyé. Chaque conversation charge ses 100 derniers messages, les précédents à la demande. Les étapes d'un workflow décrivent un processus ; elles ne déclenchent rien.
- Les portraits sont livrés avec l'application et attribués par le nom : il n'y a pas d'envoi de photo depuis le profil.
- Un workflow est enregistré d'un bloc : si deux personnes modifient le même canevas au même instant, la dernière sauvegarde l'emporte.
- L'espace entier est chargé en mémoire au démarrage : parfait pour une petite équipe (quelques milliers de tâches), à paginer au-delà.
- Les dates « jour » (échéances, début de semaine) suivent le fuseau horaire du navigateur : l'équipe est supposée partager le même fuseau.
- L'étape affichée en mode réunion et les réglages du verre sont propres à chaque navigateur.

## Crédits

- Arrière-plans : « La ferme » et « Le yacht » sont fournis par l'équipe, servis depuis `public/backgrounds/`.
- Verre : la recette « verre poli » vient de Koloc Cloud (`ui/verre.css`), portée sur les variables réglables de cette application.
- Canevas de workflows : adapté du composant « interactive-workflow-blueprint » (21st.dev), construit sur [React Flow](https://reactflow.dev).
- Composants adaptés de références publiées sur 21st.dev : le principe du verre réglable (« adjustable glass dashboard »), la barre latérale (Wensity), le bouton de menu (Origin UI), le bouton « arrow fill » (Hyperiux Vault), l'infobulle animée (Aceternity UI), la carte de connexion (« sign-in card 2 »), le fil d'activité (« activity 1 »), le tableau des membres (« members 02 ») et la messagerie (« chat template »). Le détail est dans [docs/DESIGN.md](docs/DESIGN.md#références-reprises). Animations : [Motion](https://motion.dev) (framer-motion).
- Icônes : le jeu « Nova Icon » (version 1.1, « Freebie »), un fichier de la communauté Figma, exporté dans `design/nova-icons.svg` ; neuf glyphes qui lui manquent sont dessinés dans le même style (`design/icons-complements.svg`). Les fichiers de la communauté Figma sont publiés par défaut sous licence CC BY 4.0 (mention de l'auteur) : à vérifier sur la page du fichier avant de diffuser l'application hors de l'équipe.
- Logo et lettrage : tomate et alphabet en pixel art dessinés pour le projet (`components/kit/pixel-tomato.tsx`, `pixel-text.tsx`).
- Portraits : fournis par l'équipe, recadrés en carrés de 256 px (`public/avatars/`).

Voir aussi : [architecture UX/UI, structure des écrans et design system](docs/DESIGN.md).
