# Architecture UX/UI et design system

Ce document décrit *pourquoi* l'interface est construite ainsi : les principes, la structure des écrans, les règles métier visibles, puis le design system.

## 1. Principes

| Principe | Ce que ça donne concrètement |
|---|---|
| **Simplicité** | Huit écrans, une navigation à trois sections. Une seule façon de faire chaque chose. |
| **Clarté** | Chaque tâche montre toujours les mêmes informations, au même endroit. Avatar = qui. Glyphe = où ça en est. Étoile jaune = priorité de la semaine. |
| **Efficacité** | Créer et assigner une tâche : un titre, `Entrée`. Chaque propriété se modifie là où elle s'affiche, en un clic. `C` crée, `⌘K` trouve. |
| **Minimalisme** | Du texte, des filets, de l'air. Le contenu est presque monochrome : l'encre, des gris, et très peu de couleur. La matière, elle, est du verre posé sur un paysage : c'est lui qui donne la couleur, pas des aplats ni des capsules. Une information n'apparaît qu'une fois par écran. |

Ce qui a été volontairement laissé de côté : étiquettes, dépendances, estimation, automatisations réelles, vues personnalisées, tableaux de bord de graphiques (un seul petit graphique, sur le dashboard : les tâches terminées par semaine).

## 2. Structure des écrans

```
Espace de travail                    Projets                 Paramètres (administrateurs)
├─ Dashboard        /                ├─ Application          └─ Membres   /parametres
├─ Mes tâches       /mes-taches      ├─ Site Web
├─ Messages         /messages        └─ Médias sociaux       /projets/<slug>
│  └─ Conversation  /messages/<id>      (+ nouveaux projets)
├─ Meeting          /meeting
│  └─ Récapitulatif /meeting/<id>
├─ Workflows        /workflows
│  └─ Canevas       /workflows/<id>
└─ Équipe           /equipe
```

Le panneau de détail d'une tâche, la création rapide, la recherche et « Ajuster le verre » sont des calques globaux : on les ouvre depuis n'importe quel écran sans perdre sa place.

### Navigation — un rail qui s'ouvre sous la souris

Au repos, la navigation est un rail d'icônes : le contenu a toute la place. On approche la souris, elle s'ouvre par-dessus le contenu avec ses libellés, ses compteurs et les projets ; on choisit, elle se replie. L'épingle en haut à droite (ou `⌘B`) la garde ouverte pour qui préfère l'avoir sous les yeux. Le détail du comportement est dans [Forme et mouvement](#forme-et-mouvement).

![La navigation ouverte sous la souris](screenshots/navigation-ouverte.webp)

### Dashboard — « où en est-on ? »

Un bento de tuiles de verre posées **directement sur l'image** : pas de feuille derrière elles, jamais de verre sur du verre. Chaque tuile est le verre (son anneau, sa face claire, son ombre) ; la photo, givrée, se voit entre les tuiles comme à travers elles. Le bento occupe toute la zone à côté de la navigation et s'aligne sur elle : même haut, même bas, et le même écart de 14 px que la fenêtre des autres écrans. Sur un écran haut, la dernière rangée prend la place qui reste ; sur un écran plus court, le bento défile sous une navigation qui ne bouge pas.

**Chaque tuile a sa forme et sa façon de parler.** Un tableau de bord dont toutes les sections sont la même tuile contenant une liste se lit mal : rien n'y dit par où commencer. Ici, trois colonnes de lecture : moi et l'équipe à gauche, la semaine et les projets au milieu (deux fois plus large), le meeting et l'activité à droite. Quatre colonnes de grille à partir de 1280 px de place, deux en dessous, une sur téléphone.

Le bento reste régulier : les tuiles d'une rangée ont la même hauteur, les rangées se suivent sans trou, et aucune tuile n'est à moitié vide. Une tuile remplit la place qu'elle a avec son propre contenu : la liste des priorités donne sa hauteur à sa rangée, et les listes voisines montrent autant de lignes entières qu'il en tient (`.gw-fit`). Les lignes qui n'ont pas la place sont aussi hors du parcours clavier et des lecteurs d'écran.

1. **Salutation** : sur toute la largeur, avec le portrait de la personne, la date et la semaine, et « Ajuster le verre ».
2. **Vos tâches ouvertes** : un grand chiffre, ce qu'il contient (priorités, retards, blocages), les tâches à prendre en premier (priorités, puis retards, puis ce qui est en cours) et **Nouvelle tâche**, l'action principale de la page.
3. **La semaine de l'équipe**, la tuile autour de laquelle la page est construite. Elle se regarde de trois façons, par **trois onglets** qui portent chacun leur compte (la page les dit donc sans un clic), et chaque vue mène avec son grand chiffre :
   - **Priorités** : le score en très grand (« 1/10 »), puis le **potager** : une tomate par priorité, qui mûrit avec son statut (verte à faire, tournante en cours, orangée en validation, rouge terminée ; pâlie et marquée du glyphe « bloqué » quand elle n'avance plus), rangées de la plus mûre à la plus verte, ce qui en fait aussi une barre d'avancement. Chaque tomate est un bouton qui ouvre sa tâche. À côté, la légende et la liste : statut (le glyphe se clique pour le changer), titre, projet, échéance, responsable. Changer un statut dans la liste fait mûrir la tomate.
   - **À débloquer** : le nombre de tâches bloquées ou en retard dans toute l'équipe (le seul chiffre en rouge de la page : c'est celui qui demande quelque chose), ce dont il est fait, et les tâches, à un clic.
   - **Terminées** : le chiffre de la semaine, celui de la semaine dernière, une barre par semaine (de mercredi à mardi) sur six semaines, la semaine en cours en teal, et ce qui a été terminé.

   Les trois vues sont posées l'une sur l'autre et une seule se voit : la tuile garde la hauteur de la plus haute, et la page ne saute pas quand on change d'onglet. Sur une tuile étroite (téléphone), elles se suivent. Ces deux dernières vues ont d'abord été des tuiles à part ; réunies ici, elles laissent la page plus calme sans rien retirer.
4. **Meeting du mercredi** : dans combien de jours, une règle de la semaine (les sept jours qui y mènent, aujourd'hui en tomate, le meeting au bout), les points à discuter, et l'entrée. Pendant un meeting la tuile devient **sombre** (le sombre veut dire « en direct », ici comme sur la page du meeting) et montre l'horloge ; ensuite, « Terminé » et le chemin du récapitulatif.
5. **L'équipe** : un visage, un prénom, le nombre de tâches ouvertes ; un clic ouvre les tâches de la personne.
6. **Projets** : une tuile par projet, empilées sous la semaine, avec son pourcentage en grand et une longue barre : l'une sous l'autre, les barres se comparent d'un coup d'œil. Un clic ouvre le projet. Quand la fenêtre est plus étroite, les tuiles passent côte à côte et la barre devient un anneau.
7. **Activité** : qui a fait quoi, sur quelle tâche, et quand : un portrait, une phrase, l'heure. Elle montre autant d'événements que sa hauteur le permet.

Les chiffres comptent depuis zéro quand leur tuile arrive (et quand on change d'onglet), les tomates et les barres se posent l'une après l'autre, les barres des projets s'allongent ; rien de tout cela ne bouge avec « moins de mouvement ». Ce que montrent ces dessins existe aussi en mots : chaque tomate porte le titre, le statut et le responsable de sa tâche, chaque barre son compte, chaque projet « n tâches terminées sur m ». Les onglets sont de vrais onglets : les flèches passent de l'un à l'autre, et la vue qui n'est pas affichée est hors du parcours clavier et des lecteurs d'écran.

![Dashboard](screenshots/dashboard.webp)

![Les deux autres vues de la semaine : à débloquer, terminées](screenshots/dashboard-onglets.webp)

![Le dashboard pendant un meeting : la tuile sombre et son horloge](screenshots/dashboard-en-direct.webp)

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

Terminer une tâche — ici ou ailleurs, par la coche, le statut ou une carte glissée dans « Terminé » — fait tomber une courte averse de tomates sur l'écran. Deux secondes, par-dessus tout, sans rien bloquer.

![Une tâche terminée](screenshots/pluie-de-tomates.webp)

### Messages — se parler

Deux volets sur un grand écran : les conversations à gauche, le fil à droite.

- **Général**, le canal de toute l'équipe, puis les **messages directs** entre deux personnes, triés par dernière activité. Une recherche (sans égard aux accents) filtre la liste. « Nouveau message » ouvre la conversation avec la personne choisie, ou la crée.
- **Le fil** : séparateurs de jour, messages groupés par auteur (portrait et prénom une seule fois), les miens à droite en encre, ceux des autres sur du verre. Un trait « Nouveaux messages » marque l'endroit où je m'étais arrêté, et le fil s'ouvre là. Les adresses web sont des liens ; un message fait seulement d'émojis s'affiche en grand.
- **La saisie** : `Entrée` envoie, `Maj + Entrée` va à la ligne (sur un clavier tactile, `Entrée` va à la ligne et le bouton envoie). Une petite feuille d'émojis. Le brouillon de chaque conversation est gardé le temps de la visite.
- **Non-lus** : une pastille tomate sur la conversation et sur l'entrée « Messages » de la navigation (un point sur le rail). Lire, c'est avoir le fil à l'écran, la fin en vue, dans un onglet visible.
- **Supprimer** : seulement ses propres messages (survol, clic droit ou appui long). Le message reste à sa place, remplacé par « Message supprimé ».

Sur un téléphone, une vue à la fois : la liste, puis la conversation avec une flèche de retour.

![Messages](screenshots/messages.webp)

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

![Paramètres : les membres](screenshots/parametres-membres.webp)

### Connexion

Hors de l'espace de travail, la scène est nette : la ferme en plein écran. Dessus, une carte de verre sombre, comme un menu de jeu posé sur son paysage : la tomate, le nom en lettrage pixel, puis le formulaire. La carte s'incline en 3D sous la souris et des lumières parcourent ses bords. Lien magique par défaut ; « Utiliser un mot de passe » bascule de méthode, et « Mot de passe oublié ? » ramène au lien. Sans souris (téléphone) ou avec « moins de mouvement », la carte reste à plat.

![Connexion](screenshots/connexion.webp)

### Mobile

Un seul bouton de menu, en haut à gauche de chaque écran : trois traits qui se replient en croix. Il ouvre la navigation en plein écran, sur une feuille de verre givré, avec des lignes à la taille du doigt. Quand le libellé d'un bouton principal n'a pas sa place (« Nouveau message », « Envoyer », « Nouveau workflow »), il se réduit à un disque tomate. La fenêtre de verre garde une petite marge autour d'elle, les tuiles du dashboard s'empilent et les quatre chiffres passent en grille 2 × 2, le tableau ne garde que le titre, le statut et le responsable, le kanban défile horizontalement. Les titres passent sur deux lignes plutôt que d'être tronqués. Les lignes de tâche s'adaptent à la largeur de leur conteneur (et non de l'écran).

<img src="screenshots/mobile-dashboard.webp" alt="Dashboard sur téléphone" width="260" /> <img src="screenshots/mobile-menu.webp" alt="Le menu sur téléphone" width="260" /> <img src="screenshots/mobile-messages.webp" alt="Les messages sur téléphone" width="260" />

## 3. Règles métier visibles

- **Semaine** : du mercredi 00 h au mardi soir (`lib/dates.ts`).
- **Priorités de la semaine** : elles appartiennent à un meeting. L'étoile modifie celles du meeting en cours, sinon du dernier meeting tenu. Le dashboard affiche celles du dernier meeting tenu, puis celles du meeting en cours dès qu'il en définit.
- **Sans progrès** : tâche ouverte dont le statut n'a pas changé depuis le début du meeting précédent.
- **En retard** : échéance passée et tâche non terminée.
- **Progression d'un projet** : tâches terminées (archivées comprises) ÷ toutes les tâches.
- **Récapitulatif** : calculé en direct pendant le meeting, figé à la clôture. L'historique ne bouge plus, même si les tâches changent ensuite.
- **Points à discuter** non traités : ils réapparaissent au meeting suivant avec la mention « Reporté ».
- **Workflow** : enregistré d'un bloc ; en cas de modification simultanée, la dernière sauvegarde l'emporte.
- **Messages** : le canal « Général » est lu par tous les membres actifs ; une conversation directe n'existe que pour ses deux membres (la base ne la livre à personne d'autre, y compris en temps réel). Un message ne se modifie pas ; son auteur peut le supprimer. L'auteur, l'heure d'envoi et « lu jusqu'ici » sont fixés par le serveur.
- **Averse de tomates** : seulement pour une tâche que je termine moi-même, à l'instant. Rien pour ce que terminent les autres, ni quand on rouvre une tâche.

Ces règles vivent dans `lib/selectors.ts` (fonctions pures), pour que chaque écran raconte la même histoire.

## 4. Design system

Références : Linear pour la sobriété et les interactions, Things pour le calme, Monday pour la structure des tâches. Les jetons sont déclarés dans `src/app/globals.css`.

### Le parti pris

Du verre sur un paysage, et un contenu très sobre posé dessus. L'idée vient du tableau de bord « verre ajustable » qui a servi de référence (une image en fond, des feuilles et des tuiles translucides, des réglages) ; la matière, elle, est le **verre poli** de Koloc Cloud : un anneau métallique, une face translucide, une ombre en huit couches. Le verre est clair ; c'est la photo, derrière, qui est givrée. Les paysages sont à nous : **la ferme**, l'équipe au travail dans son champ de tomates, et **le yacht**, la même équipe au coucher du soleil, en blocs façon jeu de construction. Le contenu reste du texte, des filets et de l'espace. L'autre fantaisie est la tomate en pixel art : elle est le logo, elle fait un salto au chargement, elle mûrit à côté des priorités de la semaine, et il en pleut quelques-unes quand une tâche se termine.

| Élément de marque | Où | Règle |
|---|---|---|
| **Tomate** (`kit/pixel-tomato.tsx`) | Logo, préchargeur, connexion, potager des priorités de la semaine | Grille 16 × 16, dessinée en code, tailles multiples de 16. Dans le potager du dashboard il y en a une par priorité : elle **mûrit** en quatre étapes (verte → tournante → orangée → rouge) avec le statut de sa tâche. |
| **Lettrage pixel** (`kit/pixel-text.tsx`) | Le nom, sur l'écran de connexion seulement | Alphabet 5 × 7 dessiné pixel par pixel. Jamais dans l'espace de travail. |
| **Portraits** (`public/avatars`, `lib/avatars.ts`) | Partout où une personne apparaît : salutation, tâches, messages, équipe, navigation | Les portraits en pixel art des six partenaires, des carrés de 256 px. Un membre reçoit le sien par son nom (ou son prénom seul, quand le profil n'a que lui) ; sans portrait, l'avatar montre des initiales sur la couleur du membre. Six tailles, de 24 à 72 px : 28 px dans une ligne de tâche, 32 px dans un fil de messages, 56 à 64 px à côté de la salutation. |

![Préchargeur](screenshots/prechargeur.webp)

### Surfaces

| Couche | Classe | Rôle |
|---|---|---|
| **Scène** | `GlassBackdrop`, `.gw-scene` | La ferme (ou le yacht) en plein écran. Nette tant que le préchargeur est là, et sur l'écran de connexion. **Givrée** dès que l'application arrive : floutée (18 px), un peu plus saturée, sous un voile blanc de 40 %. C'est elle qui porte le givre, pas le verre. |
| **Feuilles** | `.gw-glass` | La navigation et, sur tous les écrans sauf le dashboard, la fenêtre principale, en verre poli : un **anneau** métallique de 2,5 px (un dégradé vertical, blanc en haut pour la lumière, foncé aux trois quarts pour l'épaisseur, blanc en bas pour le rebond, évidé en son centre par un masque), une **face** translucide à 58 % avec une très légère diagonale, sans flou propre (on voit à travers elle la même photo givrée qu'autour), et une **ombre** en huit couches dont le flou double presque à chaque cran. Coins de 24 et 27 px. |
| **Tuiles** | `.gw-panel` | Deux cas, pour ne jamais poser du verre sur du verre. **Sur le dashboard**, il n'y a pas de fenêtre : chaque tuile est le verre, posée sur l'image, avec le même anneau (2 px), la même face que les feuilles (58 % par défaut) et l'ombre en huit couches. **Dans une fenêtre** (messages, paramètres), une tuile n'est qu'une zone de la feuille : une face un peu plus pleine, une arête éclairée, une ombre à peine marquée, pas d'anneau. Coins de 17 px. |
| **Panneaux denses** | `.card-surface` | Tableaux, listes du meeting, colonnes du kanban : la même tuile, un peu plus remplie pour que le texte dense reste lisible. |
| **En-tête de page** | `.glass` | Colle en haut de la fenêtre et floute ce qui défile dessous. |
| **Sombre** | `.glass-dark`, `.gw-panel-live` | Réservé au meeting en direct : sa barre sur la page du meeting et sa tuile sur le dashboard. Le sombre veut dire « en direct ». |

Tout dérive de cinq variables (`--gw-blur`, `--gw-opacity`, `--gw-saturation`, `--gw-edge`, `--gw-tint`) et d'une sixième qui s'en déduit, `--gw-scene-veil`, le voile de la photo. « Ajuster le verre » — sur le dashboard et en bas de la navigation — les règle : la scène (la ferme ou le yacht, les deux images de l'équipe), quatre préréglages (**Clair** : givre 25 %, verre 34 % ; **Poli** : 45 % et 50 %, l'aspect par défaut ; **Givré** : 70 % et 64 % ; **Opaque** : 80 % et 86 %) et des réglages fins repliés : givre de la photo, opacité du verre, saturation, reflet des bords (il dose l'anneau), teinte. Choisir une scène lui donne le givre qui lui convient (le yacht, plus sombre que les champs, vient avec un verre à 56 %) ; les préréglages et les curseurs ajustent à partir de là. Le choix est propre à chaque navigateur.

**Givrer la photo est un seul geste** : le flou (jusqu'à 40 px) et le voile blanc montent ensemble (`sceneVeil`, dans `lib/glass.ts` : rien quand la photo est nette, 40 % au réglage par défaut, 50 % au plus). Le voile fait le travail que faisait un verre laiteux : il relève les parties sombres de la photo, et le verre posé dessus peut rester clair.

La recette vient de `ui/verre.css` de Koloc Cloud, portée sur ces variables. Là-bas le verre est posé sur une page grise et unie ; ici il est posé sur une photo chargée. Plutôt que d'épaissir le verre jusqu'à le rendre laiteux, c'est la photo qu'on givre. Quand la navigation s'ouvre par-dessus la page, elle prend la variante dense de la même matière (90 %, flou de 22 px) : c'est, avec l'en-tête de page, la seule surface qui floute ce qui est derrière elle.

**Encre sur verre.** Les gris ont été dessinés pour du papier. Sur un verre clair posé sur une photo, ils sont ramenés à un ton plus profond à l'intérieur de `.gw-scope` : `navy-500` et le texte atténué deviennent `navy-600`, `navy-400` s'en approche, et le rouge des retards comme le vert de « En ligne » passent à leur cran foncé. Les menus et les dialogues sont en papier, hors de cette portée : ils gardent les gris d'origine.

L'en-tête de page garde toujours au moins 18 px de flou, même quand le reste du verre est clair : du texte défile dessous.

Règle technique : deux surfaces qui floutent ce qui est derrière elles ne s'emboîtent jamais — un flou imbriqué est ignoré par Chrome, et un flou ne survit pas non plus à un parent en fondu. La feuille de la fenêtre est donc un calque à part, placé derrière la zone de défilement, pour que l'en-tête de page puisse flouter ce qui défile sous lui ; un écran demande à la coquille une fenêtre nue (`ui.setBareWindow`, ce que fait le dashboard) quand ses tuiles portent elles-mêmes le verre, et la zone de défilement va alors jusqu'aux bords de l'écran pour que les tuiles en sortent au lieu d'être coupées en plein vol. Autre règle : la face d'une surface est calculée sur la surface elle-même (une variable CSS est résolue là où elle est déclarée), et son opacité est une propriété enregistrée (`@property --verre-alpha`), ce qui lui permet de fondre d'une valeur à l'autre.

![Ajuster le verre](screenshots/reglage-verre.webp)

### Couleurs

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Encre | `navy-900` | `#0D1B33` | Texte |
| Gris | `navy-300` à `navy-600` | — | Texte secondaire, icônes, bordures. Peu saturés : le texte secondaire est gris, pas bleu. Sur le verre, le texte secondaire est en `navy-600` (voir « Encre sur verre »). |
| Papier | `--background` | `#F2F0EB` | Sous les écrans d'erreur, et là où le flou n'est pas pris en charge |
| Teal | `teal-500` | `#12948C` | L'avancement : la barre de la semaine en cours et celles des projets, sur le dashboard |
| Tomate | `tomato-600` | `#CC3320` | Le **bouton principal**, partout ; le repère « Nouvelle tâche » de la navigation ; la pastille des priorités de la semaine ; en `tomato-700`, le chiffre des tâches à débloquer du dashboard |
| Statuts | teal, jaune, corail, vert | — | Uniquement dans les glyphes de statut, l'étoile des priorités et les alertes (retard, blocage) |

Les couleurs d'identification restent discrètes : une petite icône au trait pour un projet ; pour un membre, son portrait, ou à défaut une pastille pâle avec ses initiales.

**Statuts** — un glyphe par statut (`kit/status-icon.tsx`), un anneau qui se remplit à mesure que le travail avance. Le glyphe porte la couleur, le libellé reste en encre.

| À faire | En cours | En validation | Bloqué | Terminé |
|---|---|---|---|---|
| anneau gris | demi-anneau teal | trois quarts jaune | disque corail barré | disque vert coché |

**Priorités** — barres de signal : trois (Haute, corail), deux (Normale), une (Basse).

### Typographie

Geist Sans. Chiffres tabulaires pour les compteurs et les dates. Une échelle courte, sans demi-tailles, en casse normale :

| Usage | Taille |
|---|---|
| Le score de la semaine (dashboard) | 76 – 118 px, 500 |
| Les grands chiffres du dashboard | 54 – 92 px, 500, selon la largeur de leur tuile |
| Pourcentage d'un projet | 34 – 46 px, 500 |
| Salutation du dashboard | 26 – 36 px, 500 |
| Titre du meeting | 22 – 26 px, 600 |
| Titre de page, de groupe | 15 px, 600 |
| Corps, lignes de tâche, contrôles, titres de section | 13 px (14 px dans les formulaires) |
| Métadonnées | 12 px |
| Compteurs, raccourcis | 11 px |

### Forme et mouvement

- **Rayons** : 7 px (petits contrôles), 10 px (lignes de liste et de navigation), 13 px (panneaux denses), 17 px (tuiles), 24 et 27 px (feuilles). Les boutons sont des pastilles.
- **Boutons** (`ui/button.tsx`) : un seul bouton principal dans toute l'application, une pastille tomate avec un disque blanc à droite. Au survol (ou sous le doigt), le disque inonde le bouton, les couleurs s'inversent et une icône neuve glisse dans le disque. Le disque porte une flèche par défaut ; une icône écrite dans le bouton (`<Plus /> Nouveau workflow`) y prend place. Les variantes discrètes (contour, secondaire, fantôme) sont de simples pastilles. Les très petites tailles et les boutons-icônes sont des pastilles tomate pleines, sans disque. Quand le libellé n'a pas sa place sur un téléphone, `max-sm:af-compact` réduit le bouton à ce même disque tomate (le libellé quitte la page : le bouton porte alors un `aria-label`).
- **Navigation** (`ui/sidebar.tsx`, `app/sidebar.tsx`) : au repos, un rail d'icônes à côté de la fenêtre. Elle **s'ouvre sous la souris**, par-dessus la fenêtre (qui ne bouge pas), sur un verre plus dense et une ombre plus profonde, et se replie quand la souris repart (240 ms). Quelques règles la rendent prévisible : il faut un pointeur qui bouge et qui s'attarde 90 ms (la traverser n'ouvre rien) ; elle attend 260 ms avant de se replier ; elle se replie aussitôt qu'on a choisi une destination, pour ne pas couvrir l'écran demandé ; elle ne se replie pas tant qu'un de ses menus est ouvert. Rien ne saute à l'ouverture : la tomate, les icônes et l'avatar gardent leur place. L'**épingle** en haut (ou `⌘B`) la garde ouverte, et la fenêtre lui fait alors place ; le choix est gardé dans le navigateur. Une pastille claire glisse d'une entrée à l'autre pour marquer l'écran courant.
- **Infobulle des avatars** (`ui/animated-tooltip.tsx`) : sur les groupes d'avatars et les filtres par membre, le nom et le rôle surgissent avec un ressort et penchent avec le pointeur. Elle est rendue dans un portail : un tableau ou un panneau défilant ne la coupe jamais.
- **Séparations** : des filets à 10 % d'encre entre les lignes d'une tuile. Les tuiles se détachent par leur arête éclairée et une ombre très courte, jamais par un contour.
- **Avancement** : un filet de 3 px, encre sur gris, dans les listes ; une barre de 5 px, teal sur teal pâle, sur le dashboard (`kit/progress.tsx`).
- **Grand chiffre** (`dashboard/figure.tsx`) : un par tuile, ce sur quoi l'œil se pose ; sa taille suit la largeur de la tuile (unités de conteneur), et il compte jusqu'à sa valeur.
- **Potager** (`dashboard/potager.tsx`) : une tomate de 32 px par priorité, cinq par rangée ; au survol elle se soulève et dit son titre.
- **Onglets de la semaine** (`dashboard/week-hero.tsx`) : un groupe de pastilles, l'onglet choisi en blanc ; chacun porte son compte, teinté de tomate quand quelque chose attend derrière.
- **Barres de la semaine** (`dashboard/week-bars.tsx`) : six barres, la semaine en cours en teal, les autres en gris ; le compte posé sur chaque barre, la date dessous.
- **Défilement** : seule la fenêtre principale défile.
- **Mouvement** : les tuiles se posent l'une après l'autre (elles montent de 12 px et deviennent nettes, 480 ms, 45 ms d'écart) ; la coche et l'étoile « rebondissent » une fois ; la carte glissée se soulève ; un message se pose dans le fil. Sur le dashboard, les chiffres comptent depuis zéro (900 ms) quand leur tuile arrive ou quand on change d'onglet, les tomates et les barres se posent l'une après l'autre, les barres des projets s'allongent. Tout est neutralisé avec `prefers-reduced-motion`.
- **Averse de tomates** (`app/tomato-rain.tsx`) : une tâche terminée fait tomber de huit à dix-huit tomates du logo, selon la largeur de l'écran. La largeur est découpée en tranches et chaque tomate tombe dans la sienne : jamais d'amas. Trois tailles (20, 28, 36 px), les petites plus lentes, une légère dérive et une rotation. Elles ne prennent aucun clic, et jusqu'à trois averses se superposent quand on enchaîne.
- **Arrivée et préchargeur** : à l'ouverture, la scène est seule à l'écran, nette ; ni navigation ni fenêtre. Par-dessus, une petite plaque de verre givré, haut dans le ciel pour ne cacher personne : la tomate y tombe, s'écrase, fait un salto (elle tourne autour d'elle-même, pas autour de sa base), puis alterne petit saut et salto tant que ça charge ; les sauts sont rythmés comme un vrai lancer (vite au départ, lent en haut). Elle reste au moins 3,25 s — la chute et deux tours de saut et de salto : le temps de regarder l'image. Puis la plaque s'en va, l'image reste et se givre (le flou et le voile arrivent en 900 ms), la navigation apparaît en fondu (500 ms) et les tuiles se posent l'une après l'autre. Tout est mesuré en « pixels de tomate » (7 px, 6 px sur téléphone), en CSS pur.

### Composants

| Dossier | Contenu |
|---|---|
| `components/ui` | Primitives shadcn/Radix restylées avec les jetons, et les composants repris des références (voir plus bas) |
| `components/kit` | Briques de l'application : `PixelTomato`, `PixelText`, `ProgressLine`, `StatusIcon`, `StatusLabel`, `PriorityIcon`, `MemberAvatar`, `DueLabel`, `PriorityStar`, `TaskCheck`, sélecteurs, `EmptyState` |
| `components/app` | Coquille : `GlassBackdrop`, `GlassScene`, `GlassSettingsButton`, `Preloader`, `TomatoRain`, navigation (bureau et téléphone), recherche |
| `components/chat` | Messages : `ChatPage` (les deux volets), `ConversationList`, `Thread`, `Composer`, `NewMessage`, `EmojiPicker` ; les règles pures sont dans `lib/chat.ts` |
| `components/auth` | `LoginScreen` (la scène et la carte), `LoginForm` (lien magique, mot de passe) |
| `components/settings` | Paramètres des administrateurs : tableau des membres, invitation, rôles |
| `components/tasks` | `TaskLine` (ligne compacte réutilisée partout), `TaskSheet`, menus contextuels, `QuickAdd` |
| `components/dashboard` | `Panel` (une tuile de verre), `Figure` (le grand chiffre qui compte) et les tuiles : `MyWeek`, `WeekHero` (la semaine en trois onglets, avec son `Potager` et ses `WeekBars`), `MeetingTile`, `TeamFaces`, `ProjectCards`, `ActivityFeed` |

Règle de composition : une information = un composant, réutilisé partout. Le statut d'une tâche a la même apparence dans le tableau, le kanban, le dashboard et le meeting.

### Références reprises

Plusieurs briques viennent de composants que l'équipe a choisis comme références. Chacun a été adapté à nos jetons, à nos icônes (lucide) et à nos données, plutôt que copié tel quel ; l'en-tête du fichier dit ce qui a changé.

| Référence | Ce que c'est devenu | Où |
|---|---|---|
| Adjustable glass dashboard | Le principe (une image, des feuilles et des tuiles de verre, des réglages) et la composition du dashboard | `globals.css`, `lib/glass.ts`, `components/dashboard` |
| Verre poli (Koloc Cloud, `ui/verre.css`) | La matière : anneau métallique évidé, face translucide, ombre en huit couches | `globals.css` (`.gw-glass`, `.gw-panel`) |
| Interactive workflow blueprint | Le canevas des workflows | `ui/interactive-workflow-blueprint.tsx` |
| Sidebar (Wensity) | La navigation repliable, sa pastille qui glisse | `ui/sidebar.tsx`, `app/sidebar.tsx` |
| Menu button (Origin UI) | Le bouton de menu du téléphone | `ui/menu-toggle.tsx` |
| Arrow fill button (Hyperiux) | Le bouton principal, en tomate | `ui/button.tsx` |
| Sign-in card 2 | La carte de connexion | `ui/sign-in-card-2.tsx`, `components/auth` |
| Animated tooltip (Aceternity) | L'infobulle des avatars | `ui/animated-tooltip.tsx` |
| Activity 1 | Le fil d'activité du dashboard | `dashboard/activity-feed.tsx` |
| Members 02 | Paramètres → Membres | `components/settings`, `ui/table.tsx` |
| Chat template | Messages : liste des conversations, fil, saisie | `components/chat` |

### Accessibilité

Navigation complète au clavier, focus visible (anneau teal), libellés pour les boutons-icônes, zones tactiles confortables sur mobile, états jamais portés par la couleur seule (glyphe + libellé). Le bouton de menu annonce son état (`aria-expanded`). La navigation ne dépend pas du survol : au clavier, le rail se parcourt tel quel (chaque entrée garde son nom, et son infobulle au focus) et la tomate, qui est alors un bouton, l'épingle ouverte ; sur un écran tactile, toucher la tomate fait de même. Le fil des messages est une région `log`, la saisie et chaque bouton ont un libellé, et l'averse de tomates est ignorée des lecteurs d'écran. Avec « moins de mouvement », la carte de connexion ne s'incline plus et ses lumières s'éteignent, la pastille de navigation et les infobulles apparaissent sans ressort, la navigation s'ouvre sans glisser, et aucune tomate ne tombe. L'avancement des projets, les barres de la semaine et les tomates du potager ont un équivalent textuel. Sur du verre, le contraste dépend de l'image derrière : il est donc mesuré, pas déduit des couleurs du thème. Chaque morceau de texte est comparé aux pixels réellement derrière lui, sur une capture où le texte est rendu transparent, et c'est le pire endroit du mot qui compte (le 5e centile de ses pixels), pas sa moyenne. Avec les réglages par défaut, sur les huit écrans (623 morceaux de texte par scène), tout dépasse le seuil AA de 4,5:1. Sur la ferme : 8:1 et plus pour le texte principal, 5,2:1 au plus bas pour le texte secondaire. Sur le yacht, plus sombre et servi avec un verre un peu plus plein : 7:1 et 4,9:1. Le blanc sur le bouton tomate est à 5,2:1. `e2e/readability.spec.ts` refait cette mesure à chaque passage des tests, sur quatre écrans et les deux scènes. Le préréglage « Clair » passe sous le seuil pour le texte secondaire : c'est un goût, pas le réglage de lecture. « Opaque » garantit le contraste en toutes circonstances.
