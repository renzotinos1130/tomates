# Architecture UX/UI et design system

Ce document décrit *pourquoi* l'interface est construite ainsi : les principes, la structure des écrans, les règles métier visibles, puis le design system.

## 1. Principes

| Principe | Ce que ça donne concrètement |
|---|---|
| **Simplicité** | Six écrans, une navigation à deux sections. Une seule façon de faire chaque chose. Pas de réglages. |
| **Clarté** | Chaque tâche montre toujours les mêmes cinq informations, au même endroit, avec les mêmes couleurs. Avatar = qui. Pastille = où ça en est. Étoile jaune = priorité de la semaine. |
| **Efficacité** | Créer et assigner une tâche : un titre, `Entrée`. Chaque propriété se modifie là où elle s'affiche, en un clic. `C` crée, `⌘K` trouve. |

Ce qui a été volontairement laissé de côté : étiquettes, dépendances, estimation, automatisations, vues personnalisées, graphiques. Dix fonctionnalités bien finies plutôt que cinquante.

## 2. Structure des écrans

```
Vue d'ensemble                    Projets                 Équipe
├─ Dashboard        /             ├─ Application          └─ Membres   /equipe
├─ Mes tâches       /mes-taches   ├─ Site Web
└─ Meeting          /meeting      └─ Médias sociaux       /projets/<slug>
   └─ Récapitulatif /meeting/<id>    (+ nouveaux projets)
```

Le panneau de détail d'une tâche, la création rapide et la recherche sont des calques globaux : on les ouvre depuis n'importe quel écran sans perdre sa place.

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

Toutes ces règles vivent dans `lib/selectors.ts` (fonctions pures), pour que chaque écran raconte la même histoire.

## 4. Design system

Références : Linear pour la sobriété et les interactions, Monday pour la gestion des tâches, Notion pour la structure, Apple pour le raffinement. Les jetons sont déclarés dans `src/app/globals.css`.

### Couleurs — identité Prospero

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Deep Navy | `navy-900` | `#0D1B33` | Texte, actions principales, carte et barre du meeting |
| Teal | `teal-500` | `#12948C` | Accent, focus, « en cours », liens |
| Jaune chaud | `sun-400` | `#F4B331` | Priorités de la semaine, meeting, « en validation » |
| Blanc cassé | `paper-100` | `#F6F5F1` | Fond de l'application |
| Surface | `card` | `#FFFFFF` | Tuiles et panneaux |
| Corail | `coral-500` | `#E2553F` | Bloqué, en retard, suppression |
| Vert | `leaf-500` | `#2E9C5F` | Terminé |

Chaque famille existe de 50 à 900. Le navy sert aussi de base aux gris, ce qui garde l'ensemble cohérent et chaleureux.

**Statuts** — une couleur et un glyphe chacun (`components/kit/status-icon.tsx`), un anneau qui se remplit à mesure que le travail avance :

| À faire | En cours | En validation | Bloqué | Terminé |
|---|---|---|---|---|
| anneau gris | demi-anneau teal | trois quarts jaune | disque corail barré | disque vert coché |

**Priorités** — barres de signal : trois (Haute, corail), deux (Normale), une (Basse).

**Membres et projets** — neuf couleurs d'identification discrètes (pastille pâle + initiales), jamais utilisées pour signifier un état.

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

- **Rayons** : 8 px (contrôles), 12 px (lignes, cartes kanban), 16 px (tuiles).
- **Ombres** : très légères et teintées navy — `shadow-card` (repos), `shadow-card-hover`, `shadow-pop` (menus, panneau), `shadow-drag` (glisser).
- **Verre** : uniquement sur la navigation, l'en-tête de page et la barre du meeting (`.glass`, `.glass-dark`). Jamais sur le contenu.
- **Halo de marque** : deux dégradés radiaux à peine visibles derrière l'application (`.app-canvas`), repris plus fort sur les surfaces navy.

### Mouvement

Transitions de 150 à 250 ms, courbe `ease-out-soft`. Les tuiles apparaissent en léger fondu décalé, la coche et l'étoile « rebondissent » une fois, la carte glissée se soulève et s'incline. Tout est neutralisé avec `prefers-reduced-motion`.

### Composants

| Dossier | Contenu |
|---|---|
| `components/ui` | Primitives shadcn/Radix (bouton, menu, dialogue, panneau, calendrier…) restylées avec les jetons |
| `components/kit` | Briques de l'application : `StatusIcon`, `PriorityIcon`, `MemberAvatar`, `StatusPill`, `DueLabel`, `PriorityStar`, `TaskCheck`, sélecteurs (`StatusPicker`, `AssigneePicker`, `DuePicker`…), `EmptyState`, `Logo` |
| `components/tasks` | `TaskLine` (ligne compacte réutilisée partout), `TaskSheet`, menus contextuels, `QuickAdd` |
| `components/dashboard` | `Tile` (tuile du bento) et les tuiles |

Règle de composition : une information = un composant, réutilisé partout. Le statut d'une tâche a la même apparence dans le tableau, le kanban, le dashboard et le meeting.

### Accessibilité

Navigation complète au clavier, focus visible (anneau teal), libellés pour les boutons-icônes, contrastes AA sur le texte, zones tactiles confortables sur mobile, états jamais portés par la couleur seule (glyphe + libellé).
