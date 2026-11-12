# Architecture UX/UI et design system

Ce document décrit *pourquoi* l'interface est construite ainsi : les principes, la structure des écrans, les règles métier visibles, puis le design system.

## 1. Principes

| Principe | Ce que ça donne concrètement |
|---|---|
| **Simplicité** | Sept écrans, une navigation à trois sections. Une seule façon de faire chaque chose. |
| **Clarté** | Chaque tâche montre toujours les mêmes informations, au même endroit. Avatar = qui. Glyphe = où ça en est. Étoile jaune = priorité de la semaine. |
| **Efficacité** | Créer et assigner une tâche : un titre, `Entrée`. Chaque propriété se modifie là où elle s'affiche, en un clic. `C` crée, `⌘K` trouve. |
| **Minimalisme** | Du texte, des filets, de l'air. Le contenu est presque monochrome : l'encre, des gris, et très peu de couleur. La matière, elle, est du verre posé sur un paysage : c'est lui qui donne la couleur, pas des aplats ni des capsules. Une information n'apparaît qu'une fois par écran. |

Ce qui a été volontairement laissé de côté : étiquettes, dépendances, estimation, automatisations réelles, vues personnalisées, tableaux de bord de graphiques (un seul graphique, sur le dashboard).

## 2. Structure des écrans

```
Vue d'ensemble                    Projets                 Équipe
├─ Dashboard        /             ├─ Application          └─ Membres   /equipe
├─ Mes tâches       /mes-taches   ├─ Site Web
├─ Meeting          /meeting      └─ Médias sociaux       /projets/<slug>
│  └─ Récapitulatif /meeting/<id>    (+ nouveaux projets)
└─ Workflows        /workflows
   └─ Canevas       /workflows/<id>
```

Le panneau de détail d'une tâche, la création rapide, la recherche et « Ajuster le verre » sont des calques globaux : on les ouvre depuis n'importe quel écran sans perdre sa place.

### Dashboard — « où en est-on ? »

Des tuiles de verre posées sur la fenêtre, dans la composition du tableau de bord de référence (une tuile étroite et une large, puis une large et une étroite). Les deux colonnes suivent la largeur de la fenêtre, pas celle de l'écran.

1. **En-tête** : la date et la semaine, la salutation, et « Ajuster le verre ».
2. **Vos tâches ouvertes** : le seul grand chiffre de la page, ce qu'il contient (priorités, retards, blocages) et, en dessous, le prochain **meeting du mercredi** à un clic.
3. **L'équipe** : les quatre chiffres (à compléter · en cours · bloquées ou en retard · complétées cette semaine), puis le **rythme** : tâches créées et terminées, cumulées sur cinq semaines. L'écart entre les deux courbes est le travail ouvert ; on voit d'un coup d'œil si l'équipe ferme les tâches aussi vite qu'elle en ajoute.
4. **Priorités de la semaine** : statut (le glyphe se clique pour le changer), titre, projet, échéance, responsable. La tomate mûrit à mesure qu'elles se terminent.
5. **Projets** : une barre d'avancement par projet.
6. **Activité** : qui a fait quoi, sur quelle tâche, et quand : un avatar, une phrase, l'heure.

Le graphique se lit au survol ou au clavier (flèches gauche et droite, un jour à la fois) et ses chiffres existent aussi dans un tableau pour les lecteurs d'écran.

![Dashboard](screenshots/dashboard.webp)

### Projet — tableau et kanban

Un même jeu de données, deux lectures. Les filtres, le tri et le glisser-déposer sont partagés : une tâche modifiée dans une vue l'est dans l'autre.

- **Tableau** (inspiration Monday) : groupes par statut, colonnes Tâche · Responsable · Statut · Priorité · Échéance, chaque cellule éditable sur place, ligne « Ajouter une tâche » au pied de chaque groupe, poignée de réorganisation au survol.
- **Kanban** (inspiration Linear) : une colonne par statut, cartes compactes, déplacement par glisser-déposer.
- **Barre d'outils** : bascule de vue · avatars cliquables pour filtrer par responsable · filtre statut/priorité · recherche · tri (manuel, échéance, priorité) · tâches archivées.

![Tableau](screenshots/projet-tableau.webp)
![Kanban](screenshots/projet-kanban.webp)

### Détail d'une tâche

Panneau latéral : titre, cinq propriétés, description, sous-tâches, puis un fil unique qui mêle commentaires et historique des changements. Le champ de commentaire reste accessible en bas.

![Détail](screenshots/tache-detail.webp)

### Mes tâches — la vue du matin

Sections dans l'ordre de l'attention : priorités de la semaine → en retard → en cours → à venir → complétées récemment. Une tâche n'apparaît qu'une fois, dans la première section qui la concerne. On peut consulter la vue d'un autre partenaire.

![Mes tâches](screenshots/mes-taches.webp)

### Meeting du mercredi — le rituel

Trois états, un seul écran.

**Avant.** Un titre, un bouton. L'application prépare la rencontre toute seule : complétées depuis mercredi dernier · à valider ensemble · bloquées · en retard · sans progrès. Chacun peut noter des *points à discuter* pendant la semaine.

![Préparation](screenshots/meeting-preparation.webp)

**Pendant.** « Démarrer le meeting » ouvre le mode réunion pour tout le monde, en temps réel. Une barre sombre porte le chronomètre et les étapes : tour d'horizon → un projet à la fois → priorités → clôture. Dans chaque projet, une ligne d'ajout permet de créer une tâche et de l'assigner d'un clic sur un avatar, sans quitter le meeting. L'étoile marque les priorités. À droite, toujours visibles : points à discuter et décisions prises.

![En direct](screenshots/meeting-en-direct.webp)

L'étape **Priorités** est une seule liste, groupée par personne. Elle rappelle les priorités de la semaine précédente restées ouvertes, à reconduire d'un clic.

![Priorités](screenshots/meeting-priorites.webp)

**Après.** La clôture enregistre un récapitulatif figé, présenté comme un compte rendu sur une seule feuille : priorités par responsable, nouvelles tâches, accompli, décisions, points reportés. Il rejoint l'historique et se copie en texte simple pour un courriel.

![Récapitulatif](screenshots/meeting-recapitulatif.webp)

### Workflows — dessiner un processus

Une liste de canevas, chacun avec son aperçu miniature, puis un éditeur.

- **Étapes** de cinq natures : déclencheur, agent IA, intégration, validation, livraison — chacune avec son nom, ce qu'elle fait et l'outil concerné. Le canevas est en un seul ton : les natures se distinguent par leur glyphe.
- **Pile d'actions** à droite : les outils de l'équipe. Un clic ajoute l'action après l'étape sélectionnée et la relie.
- **Liens** par glisser d'un port à l'autre ; les boucles et les doublons sont refusés. Un formulaire replié permet de tout faire au clavier.
- **Enregistrement automatique** une demi-seconde après chaque modification, et à la sortie de la page. Les modifications d'un coéquipier arrivent en direct. L'export JSON est dans le menu « … » de la page.

Un workflow décrit un processus ; il ne déclenche aucune action réelle.

![Workflows](screenshots/workflows.webp)
![Canevas](screenshots/workflow-canevas.webp)

### Paramètres — les membres (administrateurs)

Une section « Paramètres » n'apparaît dans la navigation que pour les administrateurs. Son écran, `/parametres`, tient en une tuile d'en-tête (le nombre de membres, une recherche par nom ou courriel, « Inviter des membres ») et un tableau : nom, courriel, rôle, date d'arrivée, et un menu d'actions par ligne (changer le rôle, activer ou désactiver l'accès, retirer une invitation). Un compte en attente d'approbation s'active d'un clic. Le dernier administrateur actif ne peut pas être rétrogradé, et on n'agit pas sur sa propre ligne. La page Équipe redevient la vue d'ensemble de tout le monde : les cartes des membres et leur charge.

### Connexion

Hors de l'espace de travail, la scène est nette : le potager en plein écran. Dessus, une carte de verre sombre, comme un menu de jeu posé sur son paysage : la tomate, le nom en lettrage pixel, puis le formulaire. La carte s'incline en 3D sous la souris et des lumières parcourent ses bords. Lien magique par défaut ; « Utiliser un mot de passe » bascule de méthode, et « Mot de passe oublié ? » ramène au lien. Sans souris (téléphone) ou avec « moins de mouvement », la carte reste à plat.

### Mobile

Un seul bouton de menu, en haut à gauche de chaque écran : trois traits qui se replient en croix. Il ouvre la navigation en plein écran, sur une feuille de verre givré, avec des lignes à la taille du doigt. La fenêtre de verre garde une petite marge autour d'elle, les tuiles du dashboard s'empilent et les quatre chiffres passent en grille 2 × 2, le tableau ne garde que le titre, le statut et le responsable, le kanban défile horizontalement. Les titres passent sur deux lignes plutôt que d'être tronqués. Les lignes de tâche s'adaptent à la largeur de leur conteneur (et non de l'écran).

<img src="screenshots/mobile-dashboard.webp" alt="Dashboard mobile" width="320" />

## 3. Règles métier visibles

- **Semaine** : du mercredi 00 h au mardi soir (`lib/dates.ts`).
- **Priorités de la semaine** : elles appartiennent à un meeting. L'étoile modifie celles du meeting en cours, sinon du dernier meeting tenu. Le dashboard affiche celles du dernier meeting tenu, puis celles du meeting en cours dès qu'il en définit.
- **Sans progrès** : tâche ouverte dont le statut n'a pas changé depuis le début du meeting précédent.
- **En retard** : échéance passée et tâche non terminée.
- **Progression d'un projet** : tâches terminées (archivées comprises) ÷ toutes les tâches.
- **Récapitulatif** : calculé en direct pendant le meeting, figé à la clôture. L'historique ne bouge plus, même si les tâches changent ensuite.
- **Points à discuter** non traités : ils réapparaissent au meeting suivant avec la mention « Reporté ».
- **Workflow** : enregistré d'un bloc ; en cas de modification simultanée, la dernière sauvegarde l'emporte.

Ces règles vivent dans `lib/selectors.ts` (fonctions pures), pour que chaque écran raconte la même histoire.

## 4. Design system

Références : Linear pour la sobriété et les interactions, Things pour le calme, Monday pour la structure des tâches. Les jetons sont déclarés dans `src/app/globals.css`.

### Le parti pris

Du verre sur un paysage, et un contenu très sobre posé dessus. La matière vient du tableau de bord « verre ajustable » qui a servi de référence : une image en fond, des feuilles givrées dont on voit les bords accrocher la lumière, des tuiles translucides. Le paysage, lui, est à nous : le **Potager**, un champ de tomates en pixel art sous des collines, dessiné pour le projet. Le contenu reste du texte, des filets et de l'espace. L'autre fantaisie est la tomate en pixel art : elle est le logo, elle fait un salto au chargement, et elle mûrit à côté des priorités de la semaine.

| Élément de marque | Où | Règle |
|---|---|---|
| **Tomate** (`kit/pixel-tomato.tsx`) | Logo, préchargeur, connexion, à côté de « Priorités de la semaine » | Grille 16 × 16, dessinée en code, tailles multiples de 16. À côté des priorités, elle **mûrit** en quatre étapes (verte → tournante → orangée → rouge) à mesure qu'elles se terminent. |
| **Lettrage pixel** (`kit/pixel-text.tsx`) | Le nom, sur l'écran de connexion seulement | Alphabet 5 × 7 dessiné pixel par pixel. Jamais dans l'espace de travail. |

![Préchargeur](screenshots/prechargeur.webp)

### Surfaces

| Couche | Classe | Rôle |
|---|---|---|
| **Scène** | `GlassBackdrop` | Le Potager en plein écran, légèrement éclairci, agrandi sans lissage (chaque pixel reste un carré). Il se voit net tout autour des feuilles, et adouci à travers elles. |
| **Feuilles** | `.gw-glass` | La navigation et la fenêtre principale : du verre, un reflet sur l'arête du haut, un liseré clair, une ombre douce. Coins de 24 et 27 px. Sur le Potager le givre est léger (flou 5 px, 36 % d'opacité) : on reconnaît encore les nuages, le soleil, les sapins et les plants de tomates. |
| **Tuiles** | `.gw-panel` | Les panneaux du dashboard : un peu plus de matière que la fenêtre (16 % + la moitié de l'opacité), arête éclairée, coins de 17 px. Pas de flou propre : elles héritent de celui de la fenêtre. |
| **Panneaux denses** | `.card-surface` | Tableaux, listes du meeting, colonnes du kanban : la même tuile, un peu plus remplie pour que le texte dense reste lisible. |
| **En-tête de page** | `.glass` | Colle en haut de la fenêtre et floute ce qui défile dessous. |
| **Sombre** | `.glass-dark` | Réservé à la barre du meeting en direct : le sombre veut dire « en direct ». |

Tout dérive de cinq variables (`--gw-blur`, `--gw-opacity`, `--gw-saturation`, `--gw-edge`, `--gw-tint`). « Ajuster le verre » — sur le dashboard et en bas de la navigation — les règle : un arrière-plan (le Potager, trois photos, ou un papier uni), trois préréglages repris de la référence (**Clair** 8 px / 12 %, **Givré** 22 px / 30 %, **Opaque** 32 px / 86 %) et des réglages fins repliés. Chaque arrière-plan vient avec le givre qui lui convient, appliqué quand on le choisit : léger pour le pixel art, appuyé pour une photo (22 px / 30 %, les valeurs de la référence : elle devient de la lumière et de la couleur), presque opaque sur le papier. Les préréglages et les curseurs ajustent à partir de là. Le choix est propre à chaque navigateur. Les photos sombres reçoivent un voile clair plus appuyé, pour que le texte reste lisible.

L'en-tête de page garde toujours au moins 18 px de flou, même quand le reste du verre est clair : du texte défile dessous.

Règle technique : deux surfaces floutées ne s'emboîtent jamais — un flou imbriqué est ignoré par Chrome. Le givre de la fenêtre est donc un calque à part, placé derrière la zone de défilement, et les tuiles n'ont qu'un fond translucide.

![Ajuster le verre](screenshots/reglage-verre.webp)

### Couleurs

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Encre | `navy-900` | `#0D1B33` | Texte |
| Gris | `navy-300` à `navy-600` | — | Texte secondaire, icônes, bordures. Peu saturés : le texte secondaire est gris, pas bleu. |
| Papier | `--background` | `#F2F0EB` | Le fond quand on choisit l'arrière-plan « Papier », et sous les écrans d'erreur |
| Teal | `teal-500` | `#12948C` | L'avancement : la courbe des tâches terminées et les barres des projets, sur le dashboard |
| Tomate | `tomato-600` | `#CC3320` | Le **bouton principal**, partout ; le repère « Nouvelle tâche » de la navigation ; la pastille des priorités de la semaine |
| Statuts | teal, jaune, corail, vert | — | Uniquement dans les glyphes de statut, l'étoile des priorités et les alertes (retard, blocage) |

Les couleurs d'identification (membres, projets) restent discrètes : une pastille pâle avec des initiales, une petite icône au trait.

**Statuts** — un glyphe par statut (`kit/status-icon.tsx`), un anneau qui se remplit à mesure que le travail avance. Le glyphe porte la couleur, le libellé reste en encre.

| À faire | En cours | En validation | Bloqué | Terminé |
|---|---|---|---|---|
| anneau gris | demi-anneau teal | trois quarts jaune | disque corail barré | disque vert coché |

**Priorités** — barres de signal : trois (Haute, corail), deux (Normale), une (Basse).

### Typographie

Geist Sans. Chiffres tabulaires pour les compteurs et les dates. Une échelle courte, sans demi-tailles, en casse normale :

| Usage | Taille |
|---|---|
| Le chiffre du dashboard | 38 – 48 px, 500 |
| Salutation du dashboard | 25 – 31 px, 500 |
| Titre du meeting | 22 – 26 px, 600 |
| Chiffres de l'équipe | 21 px, 500 |
| Titre de page, de groupe | 15 px, 600 |
| Corps, lignes de tâche, contrôles, titres de section | 13 px (14 px dans les formulaires) |
| Métadonnées | 12 px |
| Compteurs, raccourcis | 11 px |

### Forme et mouvement

- **Rayons** : 7 px (petits contrôles), 10 px (lignes de liste et de navigation), 13 px (panneaux denses), 17 px (tuiles), 24 et 27 px (feuilles). Les boutons sont des pastilles.
- **Boutons** (`ui/button.tsx`) : un seul bouton principal dans toute l'application, une pastille tomate avec un disque blanc à droite. Au survol (ou sous le doigt), le disque inonde le bouton, les couleurs s'inversent et une icône neuve glisse dans le disque. Le disque porte une flèche par défaut ; une icône écrite dans le bouton (`<Plus /> Nouveau workflow`) y prend place. Les variantes discrètes (contour, secondaire, fantôme) sont de simples pastilles. Les très petites tailles et les boutons-icônes sont des pastilles tomate pleines, sans disque. Quand le libellé n'a pas sa place sur un téléphone, `max-sm:af-compact` réduit le bouton à ce même disque tomate (le libellé quitte la page : le bouton porte alors un `aria-label`).
- **Navigation** (`ui/sidebar.tsx`) : une feuille de verre qui se replie en rail d'icônes (bouton en haut, ou `⌘B`) ; la fenêtre suit, au même rythme (240 ms). Une pastille claire glisse d'une entrée à l'autre pour marquer l'écran courant ; sur le rail, chaque icône a son infobulle. Le choix déplié / replié est gardé dans le navigateur.
- **Infobulle des avatars** (`ui/animated-tooltip.tsx`) : sur les groupes d'avatars et les filtres par membre, le nom et le rôle surgissent avec un ressort et penchent avec le pointeur. Elle est rendue dans un portail : un tableau ou un panneau défilant ne la coupe jamais.
- **Séparations** : des filets à 10 % d'encre entre les lignes d'une tuile. Les tuiles se détachent par leur arête éclairée et une ombre très courte, jamais par un contour.
- **Avancement** : un filet de 3 px, encre sur gris, dans les listes ; une barre de 5 px, teal sur teal pâle, sur le dashboard (`kit/progress.tsx`).
- **Graphique** (`dashboard/flow-chart.tsx`) : deux courbes de 2 px sur un seul axe, la série qui compte en teal, l'autre en gris ; grille en filets pleins, valeur au bout de chaque courbe, légende, lecture au survol.
- **Défilement** : seule la fenêtre principale défile.
- **Mouvement** : les tuiles se posent l'une après l'autre (elles montent de 12 px et deviennent nettes, 480 ms, 45 ms d'écart) ; la coche et l'étoile « rebondissent » une fois ; la carte glissée se soulève. Tout est neutralisé avec `prefers-reduced-motion`.
- **Préchargeur** : une feuille de verre givré couvre toute la scène. La tomate tombe, s'écrase, fait un salto (elle tourne autour d'elle-même, pas autour de sa base), puis alterne petit saut et salto tant que ça charge ; les sauts sont rythmés comme un vrai lancer (vite au départ, lent en haut). Elle reste au moins 1,15 s — la chute et un salto complet — puis le verre s'éclaircit pendant que les tuiles se posent. Tout est mesuré en « pixels de tomate » (8 px, 6 px sur téléphone), en CSS pur.

### Composants

| Dossier | Contenu |
|---|---|
| `components/ui` | Primitives shadcn/Radix restylées avec les jetons, et les composants repris des références (voir plus bas) |
| `components/kit` | Briques de l'application : `PixelTomato`, `PixelText`, `ProgressLine`, `StatusIcon`, `StatusLabel`, `PriorityIcon`, `MemberAvatar`, `DueLabel`, `PriorityStar`, `TaskCheck`, sélecteurs, `EmptyState` |
| `components/app` | Coquille : `GlassBackdrop`, `GlassScene`, `GlassSettingsButton`, `Preloader`, navigation (bureau et téléphone), recherche |
| `components/auth` | `LoginScreen` (la scène et la carte), `LoginForm` (lien magique, mot de passe) |
| `components/settings` | Paramètres des administrateurs : tableau des membres, invitation, rôles |
| `components/tasks` | `TaskLine` (ligne compacte réutilisée partout), `TaskSheet`, menus contextuels, `QuickAdd` |
| `components/dashboard` | `Panel` (une tuile de verre) et ses contenus : `MyWeek`, `TeamPulse` et son `FlowChart`, `WeekPriorities`, `ProjectCards`, `ActivityFeed` |

Règle de composition : une information = un composant, réutilisé partout. Le statut d'une tâche a la même apparence dans le tableau, le kanban, le dashboard et le meeting.

### Références reprises

Plusieurs briques viennent de composants que l'équipe a choisis comme références. Chacun a été adapté à nos jetons, à nos icônes (lucide) et à nos données, plutôt que copié tel quel ; l'en-tête du fichier dit ce qui a changé.

| Référence | Ce que c'est devenu | Où |
|---|---|---|
| Adjustable glass dashboard | La matière (verre, tuiles, réglages) et la composition du dashboard | `globals.css`, `lib/glass.ts`, `components/dashboard` |
| Interactive workflow blueprint | Le canevas des workflows | `ui/interactive-workflow-blueprint.tsx` |
| Sidebar (Wensity) | La navigation repliable, sa pastille qui glisse | `ui/sidebar.tsx`, `app/sidebar.tsx` |
| Menu button (Origin UI) | Le bouton de menu du téléphone | `ui/menu-toggle.tsx` |
| Arrow fill button (Hyperiux) | Le bouton principal, en tomate | `ui/button.tsx` |
| Sign-in card 2 | La carte de connexion | `ui/sign-in-card-2.tsx`, `components/auth` |
| Animated tooltip (Aceternity) | L'infobulle des avatars | `ui/animated-tooltip.tsx` |
| Activity 1 | Le fil d'activité du dashboard | `dashboard/activity-feed.tsx` |
| Members 02 | Paramètres → Membres | `components/settings`, `ui/table.tsx` |

### Accessibilité

Navigation complète au clavier, focus visible (anneau teal), libellés pour les boutons-icônes, zones tactiles confortables sur mobile, états jamais portés par la couleur seule (glyphe + libellé). Le bouton de menu annonce son état (`aria-expanded`) ; sur le rail, chaque entrée garde son nom. Avec « moins de mouvement », la carte de connexion ne s'incline plus et ses lumières s'éteignent, la pastille de navigation et les infobulles apparaissent sans ressort. L'avancement, le graphique et la tomate qui mûrit ont un équivalent textuel. Sur du verre, le contraste dépend de l'image derrière : l'arrière-plan par défaut est clair et chaque image reçoit un voile dosé pour elle, mais le préréglage « Clair » sur une photo sombre peut passer sous le seuil AA pour le texte secondaire. « Opaque » (ou l'arrière-plan « Papier ») le garantit en toutes circonstances.
