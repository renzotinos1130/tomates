# Architecture UX/UI et design system

Ce document décrit *pourquoi* l'interface est construite ainsi : les principes, la structure des écrans, les règles métier visibles, puis le design system.

## 1. Principes

| Principe | Ce que ça donne concrètement |
|---|---|
| **Simplicité** | Sept écrans, une navigation à trois sections. Une seule façon de faire chaque chose. |
| **Clarté** | Chaque tâche montre toujours les mêmes cinq informations, au même endroit, avec les mêmes couleurs. Avatar = qui. Pastille = où ça en est. Étoile jaune = priorité de la semaine. |
| **Efficacité** | Créer et assigner une tâche : un titre, `Entrée`. Chaque propriété se modifie là où elle s'affiche, en un clic. `C` crée, `⌘K` trouve. |

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

Composition en *bento* : chaque tuile répond à une seule question.

1. **En-tête** : salutation, date, semaine en cours (mer. → mar.), et une phrase qui résume la semaine.
2. **Quatre indicateurs** : à compléter · en cours · bloquées ou en retard · complétées cette semaine. Chacun porte un détail utile (ce qui me concerne, qui travaille, répartition, rythme par jour) plutôt qu'un graphique.
3. **Priorités de la semaine** (avec responsable, statut, échéance) à côté de la **carte Meeting** (navy), toujours à un clic.
4. **Trois cartes projet** : progression, répartition par statut, prochaines échéances.
5. **Qui fait quoi** et **Activité récente**, discrets, en bas.

![Dashboard](screenshots/dashboard.webp)

### Projet — tableau et kanban

Un même jeu de données, deux lectures. Les filtres, le tri et le glisser-déposer sont partagés : une tâche modifiée dans une vue l'est dans l'autre.

- **Tableau** (inspiration Monday) : groupes par statut avec liseré de couleur, colonnes Tâche · Responsable · Statut · Priorité · Échéance, chaque cellule éditable sur place, ligne « Ajouter une tâche » au pied de chaque groupe, poignée de réorganisation au survol.
- **Kanban** (inspiration Linear) : une colonne par statut, cartes compactes, déplacement par glisser-déposer.
- **Barre d'outils** : bascule de vue · avatars cliquables pour filtrer par responsable · filtre statut/priorité · recherche · tri (manuel, échéance, priorité) · tâches archivées.

![Tableau](screenshots/projet-tableau.webp)
![Kanban](screenshots/projet-kanban.webp)

### Détail d'une tâche

Panneau latéral : titre, cinq propriétés, description, sous-tâches avec progression, puis un fil unique qui mêle commentaires et historique des changements. Le champ de commentaire reste accessible en bas.

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

L'étape **Priorités** range les engagements par personne et rappelle les priorités de la semaine précédente restées ouvertes, à reconduire d'un clic.

![Priorités](screenshots/meeting-priorites.webp)

**Après.** La clôture enregistre un récapitulatif figé : accompli, priorités par responsable, nouvelles tâches avec échéances, décisions, points reportés. Il rejoint l'historique et se copie en texte pour un courriel.

![Récapitulatif](screenshots/meeting-recapitulatif.webp)

### Workflows — dessiner un processus

Une liste de canevas, chacun avec son aperçu miniature, puis un éditeur.

- **Étapes** de cinq natures : déclencheur, agent IA, intégration, validation, livraison — chacune avec son nom, ce qu'elle fait et l'outil concerné.
- **Pile d'actions** à droite : les outils de l'équipe (Team Tomate HQ, médias sociaux, design, site, application, courriel). Un clic ajoute l'action après l'étape sélectionnée et la relie.
- **Liens** par glisser d'un port à l'autre ou par formulaire ; les boucles et les doublons sont refusés. Tout est utilisable au clavier.
- **Enregistrement automatique** une demi-seconde après chaque modification, et à la sortie de la page. Les modifications d'un coéquipier arrivent en direct.

Un workflow décrit un processus ; il ne déclenche aucune action réelle.

![Workflows](screenshots/workflows.webp)
![Canevas](screenshots/workflow-canevas.webp)

### Mobile

La navigation devient un tiroir, les tuiles s'empilent, le tableau ne garde que le titre, le statut et le responsable, le kanban défile horizontalement. Les lignes de tâche s'adaptent à la largeur de leur conteneur (et non de l'écran) : dans une carte étroite, projet et échéance passent sous le titre.

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

Références : Linear pour la sobriété et les interactions, Monday pour la gestion des tâches, Notion pour la structure, Apple pour le raffinement. Les jetons sont déclarés dans `src/app/globals.css`.

### Le verre

Toute l'application est en verre dépoli, posée sur un arrière-plan.

| Couche | Rôle |
|---|---|
| **Arrière-plan** | Une scène plein écran : trois photos (Vallée, Lac, Rivage), un dégradé de marque (Aurore) ou le papier d'origine. |
| **Fenêtres** (`.gw-glass`) | La navigation et la fenêtre principale flottent, coins arrondis, et floutent l'arrière-plan. |
| **Barres** (`.glass`) | L'en-tête de page et la barre du meeting restent en haut et floutent le contenu qui défile dessous. |
| **Panneaux** (`.card-surface`) | Les cartes sont des voiles translucides posés sur la fenêtre, avec un reflet clair sur le bord supérieur. |
| **Surfaces sombres** | La carte et la barre du meeting sont en navy presque opaque : le rituel se distingue du reste. |

Règle technique : deux surfaces floutées ne s'emboîtent jamais — un flou imbriqué est ignoré par Chrome. Le givre de la fenêtre est donc un calque à part, placé derrière la zone de défilement.

Cinq variables pilotent toute la matière : flou, opacité, saturation, reflet des bords, teinte. « Ajuster le verre » (en bas de la navigation) les règle en direct, avec trois préréglages — Clair, Givré, Opaque. Le choix est propre à chaque navigateur. Le réglage par défaut privilégie la lisibilité ; « Opaque » sur fond « Papier » redonne une interface classique.

![Ajuster le verre](screenshots/reglage-verre.webp)

### Couleurs

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Deep Navy | `navy-900` | `#0D1B33` | Texte, actions courantes, carte et barre du meeting |
| Teal | `teal-500` | `#12948C` | Focus, « en cours », liens |
| Jaune chaud | `sun-400` | `#F4B331` | Priorités de la semaine, meeting, « en validation » |
| Tomate | `tomato-600` | `#CC3320` | Accent de marque : boutons de création, repère de la page active, liens du canevas |
| Blanc cassé | `paper-100` | `#F6F5F1` | Fond « Papier », surfaces claires |
| Corail | `coral-500` | `#E2553F` | Bloqué, en retard, suppression |
| Vert | `leaf-500` | `#2E9C5F` | Terminé |

L'accent tomate reste rare : un bouton par écran (celui qui crée), l'icône de la page active et le logo. Les états « bloqué » et « en retard » gardent le corail, en pastilles teintées, pour ne pas se confondre avec un bouton.

**Statuts** — une couleur et un glyphe chacun (`components/kit/status-icon.tsx`), un anneau qui se remplit à mesure que le travail avance :

| À faire | En cours | En validation | Bloqué | Terminé |
|---|---|---|---|---|
| anneau gris | demi-anneau teal | trois quarts jaune | disque corail barré | disque vert coché |

**Priorités** — barres de signal : trois (Haute, corail), deux (Normale), une (Basse).

**Membres et projets** — neuf couleurs d'identification discrètes (pastille pâle + initiales), jamais utilisées pour signifier un état.

### Logo et préchargeur

Le logo est une tomate en pixel art sur une grille de 16 × 16, dans l'esprit des sprites de jeux à blocs : contour sombre, ombre en bas à droite, reflet en haut à gauche, feuilles en trois verts. Elle est dessinée en code (`components/kit/pixel-tomato.tsx`) et reste nette aux tailles multiples de 16.

Au chargement, la tomate tombe, rebondit en s'écrasant, fait une pirouette un saut sur deux, au-dessus d'une rangée de blocs qui s'allument. L'animation est en CSS pur : elle bouge dès la première image, avant tout script.

![Préchargeur](screenshots/prechargeur.webp)

### Typographie

Geist Sans, corps de 14 px. Titres en graisse 600 avec un interlettrage resserré. Chiffres tabulaires pour les compteurs et les dates.

| Usage | Taille |
|---|---|
| Salutation | 38 px |
| Titre de tuile ou de section | 14 px, 600 |
| Corps, lignes de tâche | 13,5 px |
| Métadonnées | 12 px |
| Sur-titres | 11 px, capitales |

### Forme et profondeur

- **Rayons** : 8 px (contrôles), 12 px (lignes, cartes kanban), 16 px (panneaux), 26 px (fenêtres).
- **Ombres** : légères et teintées navy ; les fenêtres portent une ombre large et diffuse, les panneaux un simple reflet.
- **Défilement** : seule la fenêtre principale défile ; la navigation et l'arrière-plan restent fixes.

### Mouvement

Transitions de 150 à 250 ms. Les panneaux arrivent avec une courte mise au point (léger flou, 12 px de montée, décalage de 45 ms entre eux), la coche et l'étoile « rebondissent » une fois, la carte glissée se soulève et s'incline. Tout est neutralisé avec `prefers-reduced-motion`.

### Composants

| Dossier | Contenu |
|---|---|
| `components/ui` | Primitives shadcn/Radix (bouton, menu, dialogue, panneau, calendrier…) restylées avec les jetons, et le canevas de workflows |
| `components/kit` | Briques de l'application : `PixelTomato`, `StatusIcon`, `PriorityIcon`, `MemberAvatar`, `StatusPill`, `DueLabel`, `PriorityStar`, `TaskCheck`, sélecteurs (`StatusPicker`, `AssigneePicker`, `DuePicker`…), `EmptyState` |
| `components/app` | Coquille : `GlassBackdrop`, `GlassSettingsButton`, `Preloader`, navigation, recherche |
| `components/tasks` | `TaskLine` (ligne compacte réutilisée partout), `TaskSheet`, menus contextuels, `QuickAdd` |
| `components/dashboard` | `Tile` (tuile du bento) et les tuiles |

Règle de composition : une information = un composant, réutilisé partout. Le statut d'une tâche a la même apparence dans le tableau, le kanban, le dashboard et le meeting.

### Accessibilité

Navigation complète au clavier, focus visible (anneau teal), libellés pour les boutons-icônes, zones tactiles confortables sur mobile, états jamais portés par la couleur seule (glyphe + libellé). Le texte respecte un contraste AA sur les surfaces claires ; sur le verre, le contraste dépend de l'arrière-plan et des réglages choisis — le préréglage « Opaque » le garantit en toutes circonstances.
