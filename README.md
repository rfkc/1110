# 11:10

Une petite app pour noter les jours où l'on tombe sur 11:10.
Site 100 % statique (HTML, CSS, JavaScript) : pas de serveur, pas de compte, rien à payer.
Les données restent uniquement sur le téléphone.

## Ce qu'il y a dans le dossier

| Fichier | À quoi il sert |
|---|---|
| `index.html` | La page : l'espace 11:10 (Accueil, Calendrier, Stats, Réglages) et l'espace Objectif 365 (Suivi, Sorties, Réglages) |
| `style.css` | Les couleurs, les 5 thèmes, le mode sombre |
| `app.js` | La logique de 11:10 : le bouton, le calendrier, les stats, l'export et l'import, le passage d'un espace à l'autre |
| `objectif.js` | Objectif 365 : tous les calculs (total, km/jour, semaine, projection, paliers), sans rien d'affichage |
| `objectif-ui.js` | Objectif 365 : l'écran, la saisie des sorties, la bienvenue, les fêtes des paliers |
| `tests/` | Les tests automatiques des calculs d'Objectif 365 (voir plus bas) |
| `sw.js` | Le « service worker » : fait marcher l'app hors ligne. **Contient le numéro de version.** |
| `manifest.json` | Le nom « 11:10 », l'icône, le mode plein écran |
| `icons/` | Les icônes (celle de l'iPhone est `apple-touch-icon.png`) |

La date d'anniversaire (11 octobre) et le message sont dans `app.js` (`BIRTHDAY`) et `index.html` (« Bon anniv ma vie »).

---

## 1. Tester sur ton ordi

Il faut passer par un petit serveur local : en ouvrant directement `index.html` par double-clic, certaines choses ne marchent pas.

1. Ouvre le dossier `1110` dans l'Explorateur Windows.
2. Clique dans la barre d'adresse du dossier, tape `powershell` puis Entrée : une fenêtre s'ouvre, déjà placée dans le bon dossier.
3. Tape :
   ```
   python -m http.server 8000
   ```
4. Ouvre **http://localhost:8000** dans ton navigateur.
5. Pour arrêter : `Ctrl + C` dans la fenêtre PowerShell.

**Voir l'écran d'anniversaire sans attendre le 11 octobre :** ouvre
**http://localhost:8000/?jour=2026-10-11**.
Un bandeau « Mode test » s'affiche, et tout ce que tu fais dans ce mode est rangé à part, sans toucher aux vraies données. Ça marche avec n'importe quelle date (`?jour=2026-12-25`…).

> ⚠️ **Si tu modifies un fichier et que rien ne change à l'écran**, c'est le cache hors ligne qui garde l'ancienne version. Augmente la version dans `sw.js` (voir la partie 5), puis recharge la page deux fois.

## 2. Tester sur ton iPhone (avant la mise en ligne)

1. L'ordi et l'iPhone doivent être sur le **même Wi-Fi**.
2. Lance le serveur comme ci-dessus. Si Windows demande l'autorisation du pare-feu, accepte pour les **réseaux privés**.
3. Trouve l'adresse de ton ordi : dans PowerShell, tape `ipconfig` et repère la ligne **Adresse IPv4** (par exemple `192.168.1.23`).
4. Sur l'iPhone, dans Safari : **http://192.168.1.23:8000** (avec ton adresse à toi).

C'est juste pour voir le rendu et essayer les boutons. Dans ce mode, le hors-ligne ne fonctionne pas (il faut une adresse en `https`), et c'est normal.
**N'ajoute pas l'app à l'écran d'accueil depuis cette adresse** : l'app installée garde ses données liées à l'adresse, donc il faut l'installer depuis l'adresse définitive (partie 4).

## 3. Mettre en ligne sur GitHub Pages (gratuit)

### a. Créer le compte et le dépôt
1. Crée un compte sur **https://github.com** (gratuit).
2. En haut à droite, **+** → **New repository**.
3. **Repository name** : par exemple `1110`. L'adresse de l'app sera `https://TON-PSEUDO.github.io/1110/`.
4. Coche **Public**. C'est obligatoire pour GitHub Pages gratuit.
   - Ça veut dire que le *code* est visible par qui trouve le dépôt (y compris le message d'anniversaire).
   - Ses *données* à elle restent sur son téléphone : personne d'autre ne les voit.
5. Clique **Create repository**.

### b. Envoyer les fichiers
1. Sur la page du dépôt, clique le lien **uploading an existing file**.
2. Glisse-dépose **le contenu** du dossier `1110` : `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.json`, `README.md` **et le dossier `icons`**.
   - Glisse depuis l'Explorateur avec Chrome ou Edge : le dossier `icons` passe avec son contenu.
   - Vérifie dans la liste que tu vois bien `icons/apple-touch-icon.png`.
3. En bas, clique **Commit changes**.

### c. Activer GitHub Pages
1. Dans le dépôt : **Settings** (onglet en haut) → **Pages** (menu de gauche).
2. **Source** : *Deploy from a branch*.
3. **Branch** : `main`, dossier `/ (root)` → **Save**.
4. Attends 1 à 2 minutes, puis recharge la page : l'adresse apparaît en haut (« Your site is live at… »).
5. Ouvre-la pour vérifier que l'app s'affiche.

## 4. Installer sur son iPhone

1. Sur l'iPhone, ouvre l'adresse dans **Safari**.
2. Touche le bouton **Partager** (le carré avec la flèche vers le haut).
3. Fais défiler et choisis **Sur l'écran d'accueil**.
4. Le nom « 11:10 » est déjà rempli : touche **Ajouter**.
5. L'icône rose « 11:10 » apparaît. L'app s'ouvre en plein écran, comme une vraie app.

**Important :** il faut toujours l'utiliser **depuis l'icône**, pas depuis Safari. Sur iPhone, l'app installée et Safari ont chacun leur propre stockage : des 11:10 notés dans Safari n'apparaîtraient pas dans l'app.

Idée cadeau : installe-la toi-même sur son téléphone la veille, ou envoie-lui le lien le 11 au matin. Le jour de son anniversaire, elle aura le message et une pluie de cœurs à la première ouverture.

## 5. Faire une mise à jour plus tard

1. Modifie les fichiers.
2. **Dans `sw.js`, augmente la version** : `const VERSION = 'v1';` → `'v2'` (puis `'v3'`, etc.).
   Sans ça, l'iPhone continue d'afficher l'ancienne version gardée en mémoire.
3. Sur GitHub, dans le dépôt : **Add file → Upload files**, puis glisse les fichiers modifiés (dont `sw.js`) et **Commit changes**.
4. Sur l'iPhone, ouvre l'app : elle se met à jour toute seule. Il faut parfois la fermer et la rouvrir une fois.
5. Pour vérifier : **Réglages**, tout en bas, affiche le numéro de version.

Les données ne sont **jamais** effacées par une mise à jour.

## 6. Sauvegarde

Dans **Réglages → Exporter mes données**, l'iPhone ouvre la feuille de partage : **Enregistrer dans Fichiers**, AirDrop, mail… Le fichier `.json` contient tous les jours et toutes les heures.
Sur un nouveau téléphone : installer l'app, puis **Réglages → Importer** et choisir le fichier. L'import **ajoute** les jours du fichier, il n'efface rien.

## 7. Objectif 365

Le deuxième espace de l'app (bouton « Objectif 365 » en haut) : 365 km de course dans l'année.

- **Premier lancement** : 3 petites étapes (son total Strava et sa date, l'objectif et l'année, le nombre de sorties par semaine). Tout se change ensuite dans l'onglet Réglages de l'espace.
- **Après chaque sortie** : elle tape les km en bas de l'écran Suivi, puis « Ajouter ». La pastille « auj. » permet de changer la date si elle a oublié une sortie.
- **Les chiffres** : tout est recalculé à partir du total de départ et de la liste des sorties. Corriger ou supprimer une sortie (onglet Sorties) met donc tout à jour.
- **Les données** sont dans leur propre case du téléphone (`1110.objectif365`). Celles de 11:10 ne sont jamais touchées. La sauvegarde (Exporter) contient les deux.
- **Le message de la fête des 365 km** est dans `objectif-ui.js` (cherche « Gros bisous »).

**Lancer les tests des calculs** (il faut Node, déjà installé) : dans PowerShell, dans le dossier `1110`, tape `node --test tests/`. Tout doit finir par `fail 0`.

## Les pièges iOS, et ce qui a été fait

- **Fuseau horaire** : « aujourd'hui » est calculé avec l'heure locale du téléphone, jamais en UTC. Un clic à 23 h 30 compte bien pour le bon jour. Les séries sont calculées sans être perturbées par les changements d'heure été/hiver.
- **Cache du service worker** : les fichiers sont gardés sous le nom `1110-v1`. Changer `VERSION` force l'iPhone à tout retélécharger et à supprimer l'ancienne copie. L'app se recharge alors toute seule.
- **Stockage** : les données sont dans le `localStorage` de l'app installée. iOS n'efface pas les données des apps ajoutées à l'écran d'accueil au bout de 7 jours (ce qu'il peut faire pour les sites visités dans Safari). Supprimer l'icône de l'écran d'accueil efface en revanche les données, d'où l'export.
- **Vibration** : Safari sur iPhone ne permet pas aux sites de faire vibrer le téléphone. Elle est prévue dans le code (elle marche sur Android), mais sur iPhone il n'y a que la pluie de cœurs.
- **Hors ligne** : après la première ouverture, l'app marche sans réseau, polices comprises.
