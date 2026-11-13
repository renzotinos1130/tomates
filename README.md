# Team Tomate HQ

Le QG de l'équipe Prospero : nos projets, qui fait quoi, et le **meeting hebdomadaire** — dans un seul outil, simple et rapide.

![Dashboard](docs/screenshots/dashboard.webp)

## Ce que fait l'application

| | |
|---|---|
| **Dashboard** | L'état des projets en 30 secondes, sur une page en trois bandes posée directement sur l'image, de la même hauteur que la navigation. En haut, une salutation en très grand à côté de votre portrait, où vous en êtes en une phrase, et vos trois tâches à prendre en premier. Au milieu, la semaine de l'équipe : la tomate de la semaine (elle mûrit avec le score) puis une carte par partenaire, son visage au-dessus, sa charge au pied ; trois onglets changent ce que montrent les cartes (les priorités et leur potager, une tomate par priorité ; ce qui est à débloquer ; ce qui a été terminé). En bas, le prochain meeting en billet, les projets en grands pourcentages, l'activité récente. |
| **Projets** | Un tableau structuré (façon Monday) et un kanban (façon Linear) sur les mêmes données : édition en ligne, glisser-déposer, filtres, tri, archivage. |
| **Tâches** | Responsable, statut, priorité, échéance, description, sous-tâches, fichiers joints (photos, vidéos, n'importe quel fichier, jusqu'à 100 Mo), commentaires et historique des changements. Une tâche terminée fait tomber une petite averse de tomates. |
| **Mes tâches** | La vue du matin : mes priorités, en retard, en cours, à venir, complétées récemment. |
| **Messages** | Le canal « Général » pour toute l'équipe et des conversations directes à deux : temps réel, non-lus, recherche, émojis, suppression de ses propres messages. |
| **Meeting hebdomadaire** | Préparation automatique → mode réunion en direct → récapitulatif figé → historique. |
| **Workflows** | Un livrable découpé en étapes, chacune donnée à quelqu'un (une automatisation courriel : le design à l'un, le texte à l'autre, l'intégration à un troisième). Le projet et la personne se choisissent d'un clic sur l'étape ; « Créer les tâches » en fait de vraies tâches, une par étape, chez chacun, et le canevas montre où en est chacune. Enregistrement automatique, partagé en temps réel. |
| **Équipe** | Les partenaires, leur portrait en pixel art et la charge de chacun. |
| **Arcade — Tomato Tower** | Le jeu de l'équipe : empiler des caisses de tomates le plus haut possible, dans une petite ferme en blocs où chaque partenaire a son personnage. Parfaits, combos, bonus, ciel qui change avec la hauteur ; classements de la semaine (remis à zéro le lundi à 0 h, heure de Montréal), de tous les temps, et ses propres chiffres ; une couronne pour le champion de la semaine, partout où son visage apparaît ; et la **Team Tower**, une seule tour pour toute l'équipe, une caisse par personne et par jour. |
| **Paramètres** | Pour chacun : l'apparence et son mot de passe. Pour les administrateurs : le tableau des membres, la recherche, les invitations, l'activation des comptes. Pour le super administrateur : les rôles, la création des comptes, leurs courriels de connexion et leurs mots de passe. |
| **Navigation** | Un rail d'icônes en verre qui s'ouvre sous la souris et se referme quand elle repart ; une épingle (`⌘B`) le garde ouvert. Sur téléphone, un bouton de menu ouvre la navigation en plein écran. |
| **Apparence** | Du verre poli (celui de Koloc Cloud), clair, posé sur une image de l'équipe, et un contenu sobre par-dessus. À l'arrivée, on voit d'abord l'image, nette, avec la tomate qui saute ; puis l'image se givre (floue et pâlie) et l'application apparaît dessus. Chacun règle sa matière dans Paramètres → Apparence : la scène (la ferme ou le yacht), le givre de la photo, l'opacité du verre, la saturation, le reflet des bords et la teinte. Et un **thème du soir**, sans verre ni photo : de l'encre mate sous un ciel de pixels, à choisir ou à laisser venir tout seul de 19 h à 6 h. |

La semaine de travail va **du mercredi au mardi**. Les priorités de la semaine sont celles choisies au dernier meeting.

Raccourcis : `C` nouvelle tâche · `⌘K` / `Ctrl K` recherche · clic sur le glyphe de statut pour le changer · clic droit sur une tâche pour le menu contextuel · double-clic sur un titre pour le renommer. Dans le jeu : `Espace`, un clic ou un toucher lâche la caisse · `P` pause · `M` son · `Entrée` rejoue.

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

La troisième (ou son ancien nom, `SUPABASE_SERVICE_ROLE_KEY`) reste sur le serveur : elle sert à créer les comptes et à définir les mots de passe (`src/lib/server/accounts.ts`), et à inscrire les scores du jeu une fois recomptés (`src/lib/server/tower.ts`). Sans elle, l'application fonctionne, mais « Ajouter un membre » et les mots de passe répondent que la gestion des comptes n'est pas configurée, et les parties de Tomato Tower se jouent hors classement.

**Le schéma suit le code.** Chaque déploiement de production commence par `scripts/migrate-on-deploy.mjs` (voir `vercel.json`) : les fichiers de `supabase/migrations` que la base n'a pas encore vus sont appliqués dans l'ordre et inscrits dans l'historique des migrations, comme le ferait `supabase db push`. Si l'un d'eux échoue, le déploiement s'arrête et la version en place reste en ligne. Les déploiements de prévisualisation n'ont pas ces variables : ils tournent en mode démo et ne touchent jamais à la base. Pour changer le schéma : ajouter un fichier dans `supabase/migrations`, pousser.

Pour une autre installation (un autre hébergeur, une base créée à la main), le même schéma s'applique depuis un poste :

```bash
npx supabase link --project-ref <ref-du-projet>
```

```bash
npx supabase db push
```

**Premier compte.** Tant que l'équipe est vide, l'écran de connexion propose « Premier compte » : un nom, un courriel, un mot de passe. Cette personne devient **super administratrice**, sans qu'aucun courriel soit envoyé : le faire avant de communiquer l'adresse.

**Les autres comptes.** Dans **Paramètres → Membres**, le super administrateur choisit « Ajouter un membre » : nom, courriel, rôle (partenaire ou administrateur) et un mot de passe temporaire, proposé par l'application et affiché une fois pour être transmis. À sa première connexion, la personne ne voit qu'un écran, « Choisissez votre mot de passe » ; elle entre dès qu'elle a choisi le sien. Un mot de passe perdu se remplace au même endroit (« Définir un mot de passe… »), et chacun change le sien dans **Paramètres → Compte**, en donnant son mot de passe actuel. Un courriel mal saisi se corrige là aussi (« Modifier le courriel… ») : c'est l'adresse avec laquelle la personne se connecte ; son mot de passe ne change pas et aucun message n'est envoyé.

**Par courriel, si vous le souhaitez.** La connexion par lien et les invitations par courriel existent toujours, à côté des mots de passe. Elles demandent deux réglages dans Supabase (tableau de bord du projet) :

1. **Authentication → URL Configuration** : `Site URL` = l'adresse où l'équipe ouvre l'application ; ajouter `https://<cette-adresse>/auth/callback` aux *Redirect URLs*. Un lien de connexion ne fonctionne que s'il ramène à l'adresse d'où il a été demandé.
2. **Authentication → Emails → SMTP** : brancher un service d'envoi (Resend, par exemple). L'envoi intégré de Supabase ne livre qu'aux membres de l'organisation Supabase et se limite à quelques courriels par heure.

Une personne qui crée son compte par courriel sans avoir été invitée reste « en attente » et ne voit rien tant qu'un administrateur ne l'active pas.

**Fichiers joints.** Ils vont dans Supabase Storage, dans un bucket privé (`task-files`) que la migration crée avec ses règles d'accès : rien à régler. Une limite à connaître : sur le forfait gratuit de Supabase, un fichier ne peut pas dépasser 50 Mo (et le stockage total 1 Go), quoi que dise le bucket. L'application accepte jusqu'à 100 Mo ; entre 50 et 100 Mo, c'est le stockage qui refuse, et l'application le dit. Pour aller jusqu'à 100 Mo : un forfait payant, puis **Storage → Settings → Global file size limit**.

**Accès : l'adresse à donner à l'équipe.** C'est le domaine du projet, celui de *Settings → Domains* sur Vercel (par exemple `tomatehq.vercel.app`, ou un domaine à vous) : il ouvre l'écran de connexion de l'application. Les autres adresses que Vercel affiche, une par déploiement (`<projet>-<code>-<équipe>.vercel.app`), sont réservées par défaut aux membres de l'équipe Vercel (« Vercel Authentication ») : qui les ouvre tombe sur la page de connexion de Vercel, qui propose de créer un compte Vercel. Ce n'est pas l'application ; ne pas les envoyer.

**Installer l'application.** Elle s'installe comme une app, sans passer par une boutique : sur iPhone, dans Safari, *Partager → Sur l'écran d'accueil* ; sur Mac, dans Safari, *Fichier → Ajouter au Dock* ; dans Chrome ou Edge, *Installer* dans la barre d'adresse. Elle s'ouvre alors seule, en plein écran, sous l'icône de la tomate, et s'appelle « Tomate HQ ». On s'y connecte une fois ; la session y est gardée à part de celle du navigateur. Il n'y a pas encore de notifications poussées.

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

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · icônes Nova · Zustand · dnd-kit · React Flow · Motion · three.js (le jeu, chargé à la demande) · Supabase.

```
src/
  app/                      routes (pages minces : elles montent un composant)
    (app)/                  espace connecté : /, /mes-taches, /messages, /meeting, /workflows, /projets/[slug], /equipe, /arcade, /parametres
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
    tower/                  Tomato Tower, sans écran
      engine.ts             les règles, en arithmétique entière : le même code joue dans le navigateur et recompte sur le serveur
      boards.ts             la semaine (lundi 0 h, Montréal), les classements, les phrases du jeu
      demo.ts               le « serveur » du jeu en mode démo
    server/                 ce qui ne s'exécute que sur le serveur, avec la clé de service
      accounts.ts           comptes et mots de passe
      tower.ts              ouvrir une partie, la rejouer pour en compter le score, poser une caisse sur la tour d'équipe
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
    arcade/                 Tomato Tower : la page et ses écrans (accueil, partie, fin, classements, tour d'équipe),
                            le metteur en scène (director.ts : le temps, pas fixe de 1/60 s), les sons (audio.ts, synthétisés)
      scene/                la scène three.js : la ferme, la tour, les caisses, les personnages, les textures en pixels (dessinées par le code)
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

**Le jeu.** Tomato Tower suit la même frontière (store → adaptateur), mais ses écritures passent par le serveur : le navigateur demande une partie et reçoit une graine ; il joue avec `lib/tower/engine.ts` et, à la fin, envoie le journal de la partie (pour chaque caisse, l'instant où elle a été lâchée, en soixantièmes de seconde) ; le serveur rejoue ce journal avec le même fichier et inscrit le score qu'il a compté lui-même. Les classements sont calculés par la base (`tower_boards()`), la semaine est une colonne (rien n'est effacé le lundi), et une caisse de la tour d'équipe est posée par une seule fonction SQL, sous verrou. La scène (three.js) n'est téléchargée qu'à l'ouverture du jeu et libère tout en le quittant.

**Ajouter un projet** : bouton « + » dans la navigation — aucun code. **Ajouter le portrait d'un nouveau membre** : déposer `prenom-nom.webp` dans `public/avatars/` et ajouter une ligne dans `lib/avatars.ts` ; le portrait est attribué par le nom du profil, sans égard aux majuscules ni aux accents (le prénom seul suffit quand le profil n'a que lui, comme juste après une invitation). **Ajouter un statut ou une couleur** : `lib/constants.ts`, `lib/types.ts` et la contrainte correspondante dans une nouvelle migration. **Ajouter un outil à la pile des workflows** : `lib/workflow-apps.ts`.

## Sécurité

- Chaque table a la *Row Level Security* activée ; le rôle anonyme n'a aucun droit.
- Seuls les **membres actifs** lisent et modifient les données. Un compte non invité reste en attente.
- Les commentaires ne sont modifiables que par leur auteur ; l'historique (`task_events`) est écrit uniquement par des déclencheurs, jamais par le client.
- L'auteur et le dernier éditeur d'un workflow sont fixés par le serveur.
- Messages : une conversation directe n'est lisible que par ses deux membres, y compris par le temps réel, et un client ne peut pas en créer une entre deux autres personnes. On écrit sous son propre nom, à l'heure du serveur ; un message ne se modifie pas, seul son auteur peut le supprimer.
- Un membre ne peut changer que son propre profil. Les administrateurs gèrent l'accès des partenaires et les invitent ; les rôles, les comptes des administrateurs et les mots de passe sont au super administrateur, et il en reste toujours au moins un.
- Le courriel d'un membre est celui de son compte : seul le super administrateur le change, sur le serveur, et la ligne du membre suit le compte dans la même transaction. Aucun client de l'API ne peut réécrire cette colonne.
- Les comptes et les mots de passe se créent sur le serveur (`src/lib/server/accounts.ts`), avec une clé qui n'en sort jamais ; chaque fonction établit d'abord qui demande, d'après sa session et sa ligne en base. Aucun mot de passe n'est conservé ni journalisé par l'application.
- Un mot de passe défini par le super administrateur est temporaire : tant que la personne n'a pas choisi le sien, la base ne lui montre que sa propre ligne. Cette obligation est enregistrée dans la même transaction que le mot de passe, et seul le serveur peut la lever.
- Les fichiers joints sont dans un bucket privé : aucun n'a d'adresse publique. Un membre actif les lit par une adresse signée qui expire au bout d'une heure ; un compte en attente ne lit, ne signe et n'envoie rien. La taille est limitée trois fois : dans le navigateur, sur le bucket et sur la ligne en base.
- Tomato Tower : un score n'est jamais accepté du navigateur. Les tables du jeu sont en lecture seule pour les membres actifs (et fermées aux autres) ; seul le serveur écrit, après avoir établi qui demande. Il rejoue chaque partie depuis son journal, avec la graine qu'il a lui-même tirée, et refuse un journal qui n'a pas pu être joué, une partie déjà enregistrée, la partie de quelqu'un d'autre, et une partie qui prétend avoir duré plus longtemps en jeu que sur l'horloge. Le nombre de parties ouvertes par personne est plafonné. Sur la tour d'équipe, la caisse est placée par la base, d'un seul geste : deux caisses lâchées au même instant ne peuvent pas occuper le même étage, et nul n'en pose deux le même jour.
- Seule la clé *publishable* est exposée au navigateur. En-têtes de sécurité de base dans `next.config.ts`.

## Vérifié

- `npm run lint`, `npm run typecheck`, `npm run build` : sans erreur ni avertissement.
- `npm run db:test` : 236 assertions pgTAP (droits, RLS, déclencheurs, invitations, rôles, courriels et mots de passe, tâches nées d'un workflow, fichiers joints et leur stockage, workflows, messagerie, Tomato Tower : la semaine de Montréal été comme hiver, qui lit et qui écrit, les classements, la fermeture d'une partie, la tour d'équipe et ses caisses simultanées).
- `npm run test:e2e` : 85 scénarios en mode démo — l'installation (manifeste et icônes), tableau, kanban, filtres et archivage, raccourcis et panneau de tâche, fichiers joints (choisir, déposer, coller, ouvrir, retirer, annuler un envoi, refus au-delà de 100 Mo), synchronisation entre onglets, meeting complet, workflows (le canevas ; un projet et une personne par étape, choisis sur l'étape même ou dans son formulaire ; « Créer les tâches » et le lien entre l'étape et sa tâche ; l'ordre du dessin, sans écran), réglages du verre, navigation (survol, épingle, téléphone), connexion, paramètres (les membres vus par le super administrateur, un administrateur et un partenaire ; ajout d'un membre et mot de passe temporaire ; courriel de connexion corrigé), messagerie (écrans et règles), portraits, averse de tomates, arrivée sur la scène, dashboard en trois bandes posé sur l'image (jamais de verre sur du verre) et aligné sur la navigation, semaine de l'équipe en cartes et en trois onglets (potager, à débloquer, terminées, barre de charge), salutation et actions du dashboard, billet du meeting (compte à rebours, puis horloge en direct), lisibilité du texte sur le verre (contraste mesuré sur les deux scènes) et dans le thème du soir (huit écrans), thème du soir (choix, automatique selon l'heure, surfaces opaques et sans flou, couleurs du jour retrouvées là où elles sont gardées), Tomato Tower : les règles sans écran (parfait, coupe, raté, combos, bonus, tolérance, rejeu d'un journal, tour d'équipe) et le jeu dans le navigateur, joué au soixantième de seconde près et comparé aux règles (une partie de quinze étages et son enregistrement, pause, reprise, « Recommencer », « Arrêter là », PLAY AGAIN, BEAT THIS SCORE, le son, l'avis quand quelqu'un prend la tête, la remise à zéro du lundi et la couronne, la tour d'équipe : une caisse par jour, la chute, la tour du lendemain ; au téléphone en portrait, au doigt, sans défilement).
- Contre une instance Supabase locale : Tomato Tower (la graine vient du serveur, le score inscrit est celui que le serveur a recompté, le navigateur n'envoie que des instants ; refus d'un second enregistrement, de la partie d'un autre, d'un journal impossible, d'un journal parfait calculé par un script et envoyé trop tôt ; tour d'équipe à quatre comptes : la caisse arrive en direct chez les autres, deux caisses au même instant pour le même étage donnent une caisse posée et un « visez de nouveau », une seule caisse par jour, la chute vue en direct, rien de posable ensuite) ; fichiers joints par envoi reprenable (un fichier de 13 Mo en trois parties, un de 60 Mo), miniatures d'une photo et d'une vidéo, nom accentué rendu au téléchargement, arrivée en direct chez un coéquipier, bucket sans adresse publique, envoi annulé ou coupé puis repris sans rien laisser derrière, refus du stockage dit en clair, compte en attente tenu dehors, octets retirés avec le fichier ou avec la tâche ; premier compte d'une équipe vide, membre ajouté avec un mot de passe temporaire puis obligé d'en choisir un autre en entrant, mot de passe redéfini, courriel de connexion changé (la nouvelle adresse ouvre le compte avec le même mot de passe, l'ancienne plus ; une adresse déjà prise est refusée ; un partenaire ne peut pas le faire), ce qu'un administrateur peut et ne peut pas faire ; connexion par mot de passe et par lien magique, persistance en base, propagation en temps réel entre deux navigateurs (statut, commentaire, glisser-déposer, meeting en direct, canevas de workflow), présence, compte non invité bloqué puis activé depuis les paramètres, déconnexion ; messagerie à trois comptes (livraison en direct, conversation directe invisible pour un tiers dans l'interface, le temps réel et l'API, lecture persistée, suppression propagée).

## Limites connues du MVP

- Pas de notifications par courriel ni d'intégrations externes — volontairement. Les fichiers se joignent aux tâches, pas aux messages : la messagerie est du texte, sans fils de réponses, mentions ni modification d'un message envoyé. Chaque conversation charge ses 100 derniers messages, les précédents à la demande. Un workflow crée des tâches quand on le lance, toutes d'un coup ; rien ne s'enchaîne tout seul ensuite (terminer une étape ne démarre pas la suivante), et il n'y a ni agent IA ni automatisation derrière une étape : c'est l'équipe qui fait le travail.
- Les portraits sont livrés avec l'application et attribués par le nom : il n'y a pas d'envoi de photo depuis le profil.
- Fichiers joints : la miniature d'une photo ou d'une vidéo est faite par le navigateur au moment de l'envoi ; un format qu'il ne sait pas lire (HEIC hors Safari, certaines vidéos) est joint quand même, sans miniature. Si un envoi est interrompu par la fermeture de l'onglet, ses octets peuvent rester dans le stockage sans être rattachés à rien : invisibles, sans conséquence.
- Tomato Tower : le serveur vérifie qu'une partie a pu être jouée et qu'elle a pris le temps qu'elle prétend, pas qui tenait la souris ; un programme qui jouerait à vitesse réelle ne se distingue pas d'un très bon joueur. La scène demande WebGL : sans lui, les classements restent consultables. La semaine et le jour du jeu sont ceux de Montréal, quel que soit le fuseau du navigateur. Quitter la page pendant une partie l'abandonne.
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
- Tomato Tower : un jeu d'empilement original, dans l'univers en blocs de l'application. La scène est rendue avec [three.js](https://threejs.org) (licence MIT). Les textures, les personnages (tirés des portraits de l'équipe) et les sons sont produits par le code du projet (`components/arcade/scene/pixels.ts`, `cast.ts`, `audio.ts`) : aucun fichier d'image ou de son d'un autre jeu.

Voir aussi : [architecture UX/UI, structure des écrans et design system](docs/DESIGN.md).
