# Team Tomate HQ

Le QG de l'équipe Prospero : nos projets, qui fait quoi, et le **meeting du mercredi** — dans un seul outil, simple et rapide.

![Dashboard](docs/screenshots/dashboard.webp)

## Ce que fait l'application

| | |
|---|---|
| **Dashboard** | L'état des projets en 30 secondes : ce qui vous attend, 4 chiffres pour l'équipe, priorités de la semaine, avancement par projet, qui fait quoi, activité récente. |
| **Projets** | Un tableau structuré (façon Monday) et un kanban (façon Linear) sur les mêmes données : édition en ligne, glisser-déposer, filtres, tri, archivage. |
| **Tâches** | Responsable, statut, priorité, échéance, description, sous-tâches, commentaires et historique des changements. |
| **Mes tâches** | La vue du matin : mes priorités, en retard, en cours, à venir, complétées récemment. |
| **Meeting du mercredi** | Préparation automatique → mode réunion en direct → récapitulatif figé → historique. |
| **Workflows** | Un canevas pour dessiner les processus de l'équipe : déclencheurs, étapes, agents IA, validations, livraisons. Enregistrement automatique, partagé en temps réel. |
| **Équipe** | Membres, couleur d'identification, charge de chacun, invitations (administrateurs). |
| **Apparence** | Une interface en verre dépoli sur un arrière-plan au choix (un paysage en pixel art dessiné pour le projet, ou des photos) ; chacun règle la matière (« Ajuster le verre »). |

La semaine de travail va **du mercredi au mardi**. Les priorités de la semaine sont celles choisies au dernier meeting.

Raccourcis : `C` nouvelle tâche · `⌘K` / `Ctrl K` recherche · clic droit sur une tâche pour le menu contextuel · double-clic sur un titre pour le renommer.

## Démarrer en 1 minute (mode démo)

```bash
npm install
```

```bash
npm run dev
```

Ouvrez http://localhost:3000. Sans configuration Supabase, l'application démarre en **mode démo** : des données réalistes, enregistrées dans le navigateur, synchronisées entre les onglets. Le menu en bas à gauche permet de changer de profil et de réinitialiser la démo. Aucune de ces données fictives n'existe en production.

## Passer en production (Supabase)

Avec les deux variables ci-dessous, l'application utilise Supabase : Postgres pour les données, Auth pour la connexion, Realtime pour la synchronisation entre partenaires.

1. **Créer un projet Supabase dédié** à l'outil interne (ne pas réutiliser la base du site public).
2. **Appliquer le schéma** — tables, règles de sécurité, déclencheurs et les trois projets (Application, Site Web, Médias sociaux) :

   ```bash
   npx supabase link --project-ref <ref-du-projet>
   ```

   ```bash
   npx supabase db push
   ```

   (ou coller les fichiers de `supabase/migrations/`, dans l'ordre, dans l'éditeur SQL).
3. **Authentication → URL Configuration** : `Site URL` = l'adresse de l'application ; ajouter `https://<votre-domaine>/auth/callback` aux *Redirect URLs*.
4. **Variables d'environnement** (voir `.env.example`) :

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```
5. **Première connexion** : la première personne qui se connecte devient administratrice. Elle invite les autres depuis **Équipe → Accès à l'espace** (par courriel). Une personne non invitée peut créer un compte, mais reste « en attente » et ne voit rien tant qu'un administrateur ne l'active pas.
6. **Déployer** sur Vercel (ou tout hébergeur Node) avec ces deux variables.

La connexion se fait par lien magique envoyé par courriel, ou par mot de passe si vous en définissez dans Supabase. Pour un usage régulier, configurez un fournisseur SMTP dans Supabase (l'envoi intégré est limité).

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

`db:reset` applique les migrations et crée cinq comptes de démonstration ; `seed:local` ajoute les tâches, meetings et workflows de démo (le script refuse toute base qui n'est pas locale). Les données sont datées par rapport à l'heure de la machine : si elle est en UTC, lancez-le dans le fuseau de l'équipe, par exemple `TZ=America/Toronto npm run seed:local`. Copiez ensuite dans `.env.local` l'URL et les clés affichées par `npx supabase status`, puis `npm run dev`.

Comptes locaux : `camille@prospero.test` (admin), `mathieu@`, `lea@`, `olivier@`, `sophie@prospero.test` — mot de passe `tomate-demo`. Les courriels (liens magiques) arrivent dans Mailpit : http://127.0.0.1:54324.

Si les styles semblent périmés après un redémarrage de `npm run dev`, supprimez le cache de développement :

```bash
rm -rf .next/dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm run test:e2e` | Tests Playwright de bout en bout, en mode démo (`npx playwright install chromium` la première fois) |
| `npm run db:start` / `db:stop` / `db:reset` | Supabase local |
| `npm run db:test` | Tests pgTAP du schéma et des règles de sécurité |
| `npm run seed:local` | Données de démonstration dans la base **locale** |

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Zustand · dnd-kit · React Flow · Supabase.

```
src/
  app/                      routes (pages minces : elles montent un composant)
    (app)/                  espace connecté : /, /mes-taches, /meeting, /workflows, /projets/[slug], /equipe
    login/, auth/callback/  connexion (lien magique, mot de passe)
  proxy.ts                  session Supabase + redirection vers /login
  lib/
    types.ts                modèle de données (identique aux colonnes Postgres)
    constants.ts            statuts, priorités, couleurs
    dates.ts                semaine mercredi → mardi, formats
    selectors.ts            dérivations pures : indicateurs, seaux du meeting, récapitulatif
    task-logic.ts           règles partagées client / démo (miroir des déclencheurs SQL)
    glass.ts                réglages du verre (préréglages, arrière-plans)
    workflow-apps.ts        pile d'actions du canevas de workflows
    store.ts                état global + actions optimistes
    data/                   frontière de persistance
      adapter.ts            interface commune
      supabase-adapter.ts   Postgres + Realtime + présence
      demo-adapter.ts       base locale (localStorage + BroadcastChannel)
      seed.ts               données de démonstration
  components/
    ui/                     primitives shadcn + interactive-workflow-blueprint (canevas React Flow)
    kit/                    design system maison : tomate et lettrage pixel, blocs, glyphes de statut, avatars, sélecteurs
    app/                    coquille en verre : navigation, recherche, réglages du verre, préchargeur
    tasks/                  ligne de tâche, panneau de détail, menus, création rapide
    board/                  tableau, kanban, filtres, glisser-déposer
    workflows/              liste, éditeur et enregistrement des canevas
    dashboard/ my-tasks/ meeting/ team/ auth/
public/backgrounds/         arrière-plans du verre
scripts/
  seed-local.ts             données de démonstration pour la base locale
  pixel-backdrop.py         dessine l'arrière-plan « Potager » (Python + Pillow)
supabase/
  migrations/               schéma, RLS, déclencheurs
  tests/database/           tests pgTAP
  seed.sql                  comptes de démo (local uniquement)
e2e/                        tests Playwright
```

**Flux de données.** L'interface ne parle jamais directement à Supabase : elle appelle une action du store, qui applique le changement tout de suite à l'écran (optimiste), le persiste par l'adaptateur, puis fusionne les changements des autres membres reçus en temps réel. En cas d'échec, l'écran revient à l'état précédent avec un message. Le mode démo et le mode Supabase partagent exactement la même interface.

**Ajouter un projet** : bouton « + » dans la navigation — aucun code. **Ajouter un statut ou une couleur** : `lib/constants.ts`, `lib/types.ts` et la contrainte correspondante dans une nouvelle migration. **Ajouter un outil à la pile des workflows** : `lib/workflow-apps.ts`.

## Sécurité

- Chaque table a la *Row Level Security* activée ; le rôle anonyme n'a aucun droit.
- Seuls les **membres actifs** lisent et modifient les données. Un compte non invité reste en attente.
- Les commentaires ne sont modifiables que par leur auteur ; l'historique (`task_events`) est écrit uniquement par des déclencheurs, jamais par le client.
- L'auteur et le dernier éditeur d'un workflow sont fixés par le serveur.
- Un membre ne peut changer que son propre profil ; rôles et accès sont réservés aux administrateurs, et il reste toujours au moins un administrateur.
- Seule la clé *publishable* est exposée au navigateur. En-têtes de sécurité de base dans `next.config.ts`.

## Vérifié

- `npm run lint`, `npm run typecheck`, `npm run build` : sans erreur ni avertissement.
- `npm run db:test` : 89 assertions pgTAP (droits, RLS, déclencheurs, invitations, workflows), sur une base vide comme avec les données de démonstration.
- `npm run test:e2e` : 8 scénarios (tableau, kanban, filtres/archivage, raccourcis et panneau de tâche, synchronisation entre onglets, meeting complet, workflows, réglages du verre).
- Contre une instance Supabase locale : connexion par mot de passe et par lien magique, persistance en base, propagation en temps réel entre deux navigateurs (statut, commentaire, glisser-déposer, meeting en direct, canevas de workflow), présence, compte non invité bloqué puis activé, déconnexion.

## Limites connues du MVP

- Pas de pièces jointes, de notifications par courriel ni d'intégrations externes — volontairement. Les étapes d'un workflow décrivent un processus ; elles ne déclenchent rien.
- Un workflow est enregistré d'un bloc : si deux personnes modifient le même canevas au même instant, la dernière sauvegarde l'emporte.
- L'espace entier est chargé en mémoire au démarrage : parfait pour une petite équipe (quelques milliers de tâches), à paginer au-delà.
- Les dates « jour » (échéances, début de semaine) suivent le fuseau horaire du navigateur : l'équipe est supposée partager le même fuseau.
- L'étape affichée en mode réunion et les réglages du verre sont propres à chaque navigateur.

## Crédits

- Arrière-plans : « Potager » est dessiné pour le projet par `scripts/pixel-backdrop.py` ; les trois photos viennent d'Unsplash (licence Unsplash), optimisées et servies depuis `public/backgrounds/`.
- Canevas de workflows : adapté du composant « interactive-workflow-blueprint » (21st.dev), construit sur [React Flow](https://reactflow.dev).
- Logo et lettrage : tomate et alphabet en pixel art dessinés pour le projet (`components/kit/pixel-tomato.tsx`, `pixel-text.tsx`).

Voir aussi : [architecture UX/UI, structure des écrans et design system](docs/DESIGN.md).
