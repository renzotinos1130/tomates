# Architecture UX/UI et design system

Ce document décrit *pourquoi* l'interface est construite ainsi : les principes, la structure des écrans, les règles métier visibles, puis le design system.

## 1. Principes

| Principe | Ce que ça donne concrètement |
|---|---|
| **Simplicité** | Sept écrans, une navigation à trois sections. Une seule façon de faire chaque chose. |
| **Clarté** | Chaque tâche montre toujours les mêmes informations, au même endroit. Avatar = qui. Glyphe = où ça en est. Étoile jaune = priorité de la semaine. |
| **Efficacité** | Créer et assigner une tâche : un titre, `Entrée`. Chaque propriété se modifie là où elle s'affiche, en un clic. `C` crée, `⌘K` trouve. |
| **Rien de décoratif** | Pas de halo, pas de dégradé d'ambiance, pas d'icône dans une pastille, pas de capsule colorée. Un élément est là parce qu'il dit quelque chose ; une information n'apparaît qu'une fois par écran. |

Ce qui a été volontairement laissé de côté : étiquettes, dépendances, estimation, automatisations réelles, vues personnalisées, graphiques.

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

1. **Une phrase** : la salutation, puis ce qui attend la personne (tâches ouvertes, priorités, retards). Au-dessus, la date et la semaine en sept blocs — aujourd'hui en tomate.
2. **Quatre chiffres sur une bande** : à compléter · en cours · bloquées ou en retard · complétées cette semaine. Ils parlent de l'équipe ; la phrase parle de soi. Aucun ne répète l'autre.
3. **Priorités de la semaine** (responsable, statut, échéance) à côté de la **carte Meeting** (navy), toujours à un clic. La tomate de l'en-tête mûrit à mesure que les priorités se terminent.
4. **Trois cartes projet** : avancement en blocs — un bloc par tâche —, prochaines échéances.
5. **Qui fait quoi** et **Activité récente** (un journal, une ligne par événement), discrets, en bas.

![Dashboard](screenshots/dashboard.webp)

### Projet — tableau et kanban

Un même jeu de données, deux lectures. Les filtres, le tri et le glisser-déposer sont partagés : une tâche modifiée dans une vue l'est dans l'autre.

- **Tableau** (inspiration Monday) : groupes par statut avec liseré de couleur, colonnes Tâche · Responsable · Statut · Priorité · Échéance, chaque cellule éditable sur place, ligne « Ajouter une tâche » au pied de chaque groupe, poignée de réorganisation au survol.
- **Kanban** (inspiration Linear) : une colonne par statut, cartes compactes, déplacement par glisser-déposer.
- **Barre d'outils** : bascule de vue · avatars cliquables pour filtrer par responsable · filtre statut/priorité · recherche · tri (manuel, échéance, priorité) · tâches archivées.

![Tableau](screenshots/projet-tableau.webp)
![Kanban](screenshots/projet-kanban.webp)

### Détail d'une tâche

Panneau latéral : titre, cinq propriétés, description, sous-tâches (un bloc par sous-tâche), puis un fil unique qui mêle commentaires et historique des changements. Le champ de commentaire reste accessible en bas.

![Détail](screenshots/tache-detail.webp)

### Mes tâches — la vue du matin

Sections dans l'ordre de l'attention : priorités de la semaine → en retard → en cours → à venir → complétées récemment. Une tâche n'apparaît qu'une fois, dans la première section qui la concerne. On peut consulter la vue d'un autre partenaire.

![Mes tâches](screenshots/mes-taches.webp)

### Meeting du mercredi — le rituel

Trois états, un seul écran.

**Avant.** L'application prépare la rencontre toute seule : complétées depuis mercredi dernier · à valider ensemble · bloquées · en retard · sans progrès. Chacun peut noter des *points à discuter* pendant la semaine.

![Préparation](screenshots/meeting-preparation.webp)

**Pendant.** « Démarrer le meeting » ouvre le mode réunion pour tout le monde, en temps réel. Une barre sombre porte le chronomètre et les étapes : tour d'horizon → un projet à la fois → priorités → clôture. Dans chaque projet, une ligne d'ajout permet de créer une tâche et de l'assigner d'un clic sur un avatar, sans quitter le meeting. L'étoile marque les priorités. À droite, toujours visibles : points à discuter et décisions prises.

![En direct](screenshots/meeting-en-direct.webp)

L'étape **Priorités** est une seule liste, groupée par personne. Elle rappelle les priorités de la semaine précédente restées ouvertes, à reconduire d'un clic.

![Priorités](screenshots/meeting-priorites.webp)

**Après.** La clôture enregistre un récapitulatif figé, présenté comme un compte rendu sur une seule feuille : priorités par responsable, nouvelles tâches, accompli, décisions, points reportés. Il rejoint l'historique et se copie en texte simple pour un courriel.

![Récapitulatif](screenshots/meeting-recapitulatif.webp)

### Workflows — dessiner un processus

Une liste de canevas, chacun avec son aperçu miniature, puis un éditeur.

- **Étapes** de cinq natures : déclencheur, agent IA, intégration, validation, livraison — chacune avec son nom, ce qu'elle fait et l'outil concerné.
- **Pile d'actions** à droite : les outils de l'équipe. Un clic ajoute l'action après l'étape sélectionnée et la relie.
- **Liens** par glisser d'un port à l'autre ; les boucles et les doublons sont refusés. Un formulaire replié permet de tout faire au clavier.
- **Enregistrement automatique** une demi-seconde après chaque modification, et à la sortie de la page. Les modifications d'un coéquipier arrivent en direct. L'export JSON est dans le menu « … » de la page.

Un workflow décrit un processus ; il ne déclenche aucune action réelle.

![Workflows](screenshots/workflows.webp)
![Canevas](screenshots/workflow-canevas.webp)

### Mobile

La navigation devient un tiroir, les quatre chiffres passent en grille 2 × 2, le tableau ne garde que le titre, le statut et le responsable, le kanban défile horizontalement. Les titres passent sur deux lignes plutôt que d'être tronqués. Les lignes de tâche s'adaptent à la largeur de leur conteneur (et non de l'écran).

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

Références : Linear pour la sobriété et les interactions, Monday pour la gestion des tâches, Notion pour la structure. Les jetons sont déclarés dans `src/app/globals.css`.

### La signature : le pixel

La marque est une tomate en pixel art. Trois éléments la prolongent, et seulement eux.

| Élément | Où | Règle |
|---|---|---|
| **Tomate** (`kit/pixel-tomato.tsx`) | Logo, préchargeur, connexion, états vides marquants | Grille 16 × 16, dessinée en code, tailles multiples de 16. Dans « Priorités de la semaine », elle **mûrit** en quatre étapes (verte → tournante → orangée → rouge) à mesure que les priorités se terminent. |
| **Lettrage** (`kit/pixel-text.tsx`) | Le nom « Team Tomate HQ », nulle part ailleurs | Alphabet 5 × 7 dessiné pixel par pixel ; ombre d'un pixel sur fond sombre. Jamais pour du texte courant. |
| **Blocs** (`kit/blocks.tsx`) | Avancement d'un projet, charge d'une personne, priorités, sous-tâches, tâches terminées par jour, jours de la semaine | **Un bloc = une chose qui se compte.** On lit la quantité d'un coup d'œil, la couleur donne le statut. Au-delà de 48 éléments, les blocs deviennent une barre proportionnelle. |

Les petits repères (projet, puce de liste, jour de meeting) sont des carrés, pas des ronds. Les grandes surfaces restent arrondies : le pixel est un accent, pas un déguisement.

![Préchargeur](screenshots/prechargeur.webp)

### Le verre

| Couche | Rôle |
|---|---|
| **Arrière-plan** | Une scène plein écran : « Potager », un paysage en pixel art dessiné pour le projet (`scripts/pixel-backdrop.py`), trois photos (Vallée, Lac, Rivage) ou le papier uni. |
| **Fenêtres** (`.gw-glass`) | La navigation et la fenêtre principale flottent, coins arrondis, et floutent l'arrière-plan. |
| **Barres** (`.glass`) | L'en-tête de page et la barre du meeting restent en haut et floutent le contenu qui défile dessous. |
| **Panneaux** (`.card-surface`) | Les surfaces de contenu sont plus proches du papier que du verre : le texte y reste net quel que soit le fond. |
| **Surfaces sombres** | La carte et la barre du meeting, en navy presque opaque et sans effet. |

Règle technique : deux surfaces floutées ne s'emboîtent jamais — un flou imbriqué est ignoré par Chrome. Le givre de la fenêtre est donc un calque à part, placé derrière la zone de défilement.

« Ajuster le verre » (en bas de la navigation) propose l'arrière-plan et trois préréglages — Clair, Givré, Opaque ; les réglages fins (flou, opacité, saturation, reflet, teinte) sont repliés. Le choix est propre à chaque navigateur. « Opaque » sur fond « Papier » redonne une interface classique.

![Ajuster le verre](screenshots/reglage-verre.webp)

### Couleurs : une teinte, un rôle

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Encre | `navy-900` | `#0D1B33` | Texte, boutons secondaires, surfaces du meeting |
| Tomate | `tomato-600` | `#CC3320` | **L'action principale de l'écran** (créer une tâche, démarrer le meeting, se connecter) et le repère de la page active. Une seule par écran. |
| Teal | `teal-500` | `#12948C` | Statut « en cours », focus, liens |
| Jaune chaud | `sun-400` | `#F4B331` | Priorités de la semaine, statut « en validation » |
| Corail | `coral-500` | `#E2553F` | Bloqué, en retard, suppression |
| Vert | `leaf-500` | `#2E9C5F` | Terminé |
| Blanc cassé | `paper-100` | `#F6F5F1` | Fond « Papier » |

Sur une surface sombre, l'action est un bouton blanc. Les chiffres sont en encre ; seul un chiffre qui demande de l'attention prend le corail.

**Statuts** — un glyphe par statut (`kit/status-icon.tsx`), un anneau qui se remplit à mesure que le travail avance. Le glyphe porte la couleur, le libellé reste en encre : pas de capsule colorée sur chaque ligne.

| À faire | En cours | En validation | Bloqué | Terminé |
|---|---|---|---|---|
| anneau gris | demi-anneau teal | trois quarts jaune | disque corail barré | disque vert coché |

**Priorités** — barres de signal : trois (Haute, corail), deux (Normale), une (Basse).

**Membres et projets** — neuf couleurs d'identification (pastille pâle + initiales, petite tuile d'icône pour un projet), jamais utilisées pour signifier un état.

### Typographie

Geist Sans. Chiffres tabulaires pour les compteurs et les dates. Une échelle courte, sans demi-tailles :

| Usage | Taille |
|---|---|
| Phrase d'accueil, grands chiffres | 28 – 32 px |
| Titres de section du meeting | 18 – 20 px |
| Titre de page, de panneau | 15 px, 600 |
| Corps, lignes de tâche, contrôles | 13 px (14 px dans les formulaires) |
| Métadonnées | 12 px |
| Compteurs, raccourcis | 11 px |

Les libellés sont en casse normale : pas de petites capitales espacées.

### Forme et profondeur

- **Rayons** : 7 px (petits contrôles), 10 px (lignes, boutons), 13 px (panneaux), 20 px (fenêtres). Les repères et les blocs sont carrés (1 – 2 px).
- **Conteneurs** : deux niveaux au plus — la fenêtre et un panneau. Pas de carte dans une carte, pas de carte pour un simple titre ; des filets séparent les listes.
- **Ombres** : légères et teintées navy ; aucune lueur colorée.
- **Défilement** : seule la fenêtre principale défile ; la navigation et l'arrière-plan restent fixes.

### Mouvement

Transitions de 150 à 250 ms. Les panneaux arrivent avec une courte mise au point, la coche et l'étoile « rebondissent » une fois, la carte glissée se soulève et s'incline. Au chargement, la tomate tombe, rebondit en s'écrasant et fait une pirouette un saut sur deux — en CSS pur, dès la première image. Tout est neutralisé avec `prefers-reduced-motion`.

### Composants

| Dossier | Contenu |
|---|---|
| `components/ui` | Primitives shadcn/Radix restylées avec les jetons, et le canevas de workflows |
| `components/kit` | Briques de l'application : `PixelTomato`, `PixelText`, `Blocks`, `StatusIcon`, `StatusLabel`, `PriorityIcon`, `MemberAvatar`, `DueLabel`, `PriorityStar`, `TaskCheck`, sélecteurs, `EmptyState` |
| `components/app` | Coquille : `GlassBackdrop`, `GlassSettingsButton`, `Preloader`, navigation, recherche |
| `components/tasks` | `TaskLine` (ligne compacte réutilisée partout), `TaskSheet`, menus contextuels, `QuickAdd` |
| `components/dashboard` | `Tile` (panneau) et ses contenus |

Règle de composition : une information = un composant, réutilisé partout. Le statut d'une tâche a la même apparence dans le tableau, le kanban, le dashboard et le meeting.

### Accessibilité

Navigation complète au clavier, focus visible (anneau teal), libellés pour les boutons-icônes, zones tactiles confortables sur mobile, états jamais portés par la couleur seule (glyphe + libellé). Les blocs et la tomate qui mûrit ont un équivalent textuel. Le texte respecte un contraste AA sur les panneaux ; avec le préréglage « Clair », le contraste dépend de l'arrière-plan — « Opaque » le garantit en toutes circonstances.
