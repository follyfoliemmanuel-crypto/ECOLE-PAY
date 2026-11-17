# SCHOOL PAY

Gestion des frais de scolarité pour les écoles privées du Togo.

SCHOOL PAY est un SaaS multi-école : chaque établissement gère ses classes, ses
élèves, ses encaissements et ses relances WhatsApp dans un espace totalement
isolé. L'interface est en français, les montants en FCFA et les numéros au
format togolais.

---

## Ce que fait la V1

- **Tableau de bord lisible en 5 secondes** : encaissé, restant, taux de
  paiement, situation par classe, top des impayés, évolution de l'année.
- **Élèves** : liste filtrable par classe et par mois, fiche détaillée avec les
  10 mois de frais, historique complet et reçus.
- **Encaissement en 3 clics** : recherche de l'élève, choix du mois, montant.
  Paiement partiel accepté, surpaiement refusé.
- **Reçus WhatsApp** : message pré-rempli avec le nom de l'école, l'élève, la
  classe, le mois, le montant et le reste à payer. Aucune API payante.
- **Relances d'impayés** : liste regroupée par classe, message WhatsApp prêt,
  export PDF.
- **Exports PDF** : liste des impayés et bilan mensuel par classe.
- **Rôles** : le directeur gère tout ; la secrétaire encaisse et consulte, mais
  ne peut ni annuler un paiement ni supprimer un élève.
- **Offres** : essai gratuit de 30 jours avec toutes les fonctions PREMIUM,
  puis STARTER (15 000 F), PRO (25 000 F) ou PREMIUM (40 000 F) par mois,
  payées par Flooz ou TMoney. Le super admin active l'offre à distance et les
  fonctionnalités apparaissent ou se masquent immédiatement, sans perte de
  données.

La V1 ne contient volontairement pas : paiement en ligne par les parents,
inscription en ligne, notes, emploi du temps, application parent. Le schéma et
les écrans sont prévus pour les accueillir plus tard sans refonte.

---

## Stack

| Élément | Choix |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Actions) + React 19 |
| Styles | Tailwind CSS v4 |
| Base de données | PostgreSQL (Neon, Supabase ou local) avec le driver `pg` |
| Authentification | Sessions JWT httpOnly + mots de passe bcrypt |
| PDF | jsPDF + jspdf-autotable (générés dans le navigateur) |
| Déploiement | Vercel |
| Application Windows | Electron + `electron-updater` (coque mince, mises à jour automatiques) |
| Mobile | PWA installable (manifeste + icônes) |

Aucune dépendance à un fournisseur d'authentification : l'application fonctionne
de la même façon sur Neon, Supabase ou un PostgreSQL classique.

---

## Démarrage local

### 1. Prérequis

- Node.js 20 ou plus récent
- Une base PostgreSQL accessible (locale ou distante)

### 2. Installation

```bash
npm install
cp .env.example .env.local
```

Renseignez ensuite `.env.local` :

```env
DATABASE_URL="postgresql://utilisateur:motdepasse@127.0.0.1:5432/ecolepay?sslmode=disable"
AUTH_SECRET="une-chaine-aleatoire-de-32-caracteres-minimum"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

Générer une clé de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Base de données

```bash
npm run db:push    # applique db/schema.sql
npm run db:seed    # crée l'école de démonstration
```

Le schéma est idempotent : `db:push` peut être relancé sans perdre les données.

### 4. Lancer l'application

```bash
npm run dev
```

Ouvrir <http://localhost:3000>.

### Données de démonstration

`npm run db:seed` crée une école de démonstration (4 classes, 24 élèves, une
soixantaine de paiements répartis sur l'année en cours) et les comptes de test
associés. Les identifiants sont affichés par le script à la fin de son
exécution : ils ne sont volontairement pas écrits dans ce dépôt.

Ne lancez jamais `db:seed` sur la base de production.

---

## Déploiement sur Vercel + Neon

1. **Créer la base** sur [Neon](https://neon.tech) et copier la chaîne de
   connexion « Pooled connection ».
2. **Importer le dépôt** dans Vercel.
3. **Renseigner les variables** dans Vercel → Settings → Environment Variables :
   - `DATABASE_URL` (Neon, avec `?sslmode=require`)
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_SITE_URL` (ex. `https://app.schoolpay.tg`)
   - `RESEND_API_KEY` et `EMAIL_FROM` si vous activez les emails
4. **Appliquer le schéma** une fois depuis votre machine, en pointant
   `DATABASE_URL` vers Neon :

   ```bash
   npm run db:push
   ```

5. **Déployer.** Vercel exécute `next build`.

> Les fonctions serverless réutilisent un petit pool (`max: 5`). Avec Neon,
> utilisez impérativement la connexion *pooled*.

### Activer réellement les emails (Resend)

Une clé API valide ne suffit pas : Resend refuse l'envoi si le **domaine de
`EMAIL_FROM` n'est pas vérifié**, avec une erreur `403 The domain is not
verified`. Marche à suivre :

1. Resend → **Domains** → *Add domain* → `schoolpay.tg`.
2. Recopier chez le registrar les enregistrements **SPF**, **DKIM** et
   **DMARC** fournis, puis attendre le statut *Verified*.
3. Garder `EMAIL_FROM="SCHOOL PAY <noreply@schoolpay.tg>"` : l'envoi fonctionne
   alors vers n'importe quel destinataire.

Sans domaine vérifié, seul le **domaine sandbox** `onboarding@resend.dev`
fonctionne, et **uniquement vers l'adresse du titulaire du compte Resend** :

```env
EMAIL_FROM="SCHOOL PAY <onboarding@resend.dev>"
```

L'inscription sur Resend doit donc être faite avec l'adresse qui recevra les
tests. L'application vérifie cette configuration avant l'envoi et affiche un
message clair au lieu de faire croire que l'email est parti.

### Bascule vers schoolpay.tg

Le code utilise déjà `schoolpay.tg` par défaut. Tant que le domaine n'est pas
configuré, les liens du portail parent et les emails pointeront dans le vide :
gardez `NEXT_PUBLIC_SITE_URL` et `EMAIL_FROM` sur l'ancien domaine en production
jusqu'à la fin de la bascule.

1. **Domaine** : réserver `schoolpay.tg`, puis ajouter dans Vercel les domaines
   `schoolpay.tg`, `app.schoolpay.tg` et `maj.schoolpay.tg` (CNAME vers Vercel
   pour les deux sous-domaines).
2. **Application** : mettre `NEXT_PUBLIC_SITE_URL=https://schoolpay.tg` dans
   Vercel, puis redéployer. Les liens du portail, le QR code et les emails de
   réinitialisation utilisent cette valeur.
3. **Emails** : dans Resend, ajouter le domaine `schoolpay.tg` et recopier les
   enregistrements SPF, DKIM et DMARC. Une fois le statut *Verified*, passer
   `EMAIL_FROM="SCHOOL PAY <noreply@schoolpay.tg>"`.
4. **Anciens liens** : garder `ecolepay.tg` actif et le rediriger en 301 vers
   `schoolpay.tg`. Les QR codes et messages WhatsApp déjà envoyés aux parents
   continueront de fonctionner.
5. **Application Windows** : republier un `.exe` (le nom du fichier devient
   `SCHOOL-PAY-<version>-setup.exe`) et mettre à jour
   `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL`.
6. **Ce qui ne change pas** : le nom de la base PostgreSQL, les noms de cookies
   (`__Host-ecolepay_session`), l'`appId` Electron et les emails de démonstration
   déjà en base. Les garder évite de déconnecter tous les utilisateurs et de
   casser les mises à jour automatiques.

---

## Architecture multi-école

L'isolation est garantie à deux niveaux :

1. **Requêtes applicatives** : chaque fonction de `src/lib/data/*` reçoit
   `ecoleId` depuis la session et l'ajoute dans le `WHERE`. Aucun identifiant
   d'école ne vient du navigateur.
2. **Base de données** : les clés étrangères composites `(id, ecole_id)`
   empêchent de rattacher un élève, une classe ou un paiement à une autre école,
   même en cas de bug applicatif.

Conséquences pratiques :

- une URL d'élève d'une autre école renvoie `404` ;
- un paiement ne peut jamais dépasser le reste dû (trigger PostgreSQL) ;
- un paiement n'est jamais supprimé : il est marqué `annule = true` avec un
  motif et l'auteur de l'annulation ;
- changer le tarif d'une classe ne modifie que les mois non entamés ;
- changer un élève de classe réajuste ses mois non payés.

### Rôles

| Action | Directeur | Comptable | Secrétaire |
| --- | --- | --- | --- |
| Voir le tableau de bord, les élèves, les paiements | Oui | Oui | Oui |
| Encaisser un paiement | Oui | Oui | Oui |
| Annuler un paiement | Oui | Non | Non |
| Supprimer un élève | Oui | Non | Non |
| Gérer les classes | Oui | Non | Non |
| Modifier l'école et les modèles WhatsApp | Oui | Non | Non |
| Ajouter / désactiver un compte | Oui | Non | Non |

Le comptable et la secrétaire partagent les droits d'encaissement et de
consultation ; seul le directeur administre l'école. Les trois comptes ne sont
disponibles qu'à partir de l'offre PRO (STARTER = un seul utilisateur).

---

## Offres et déblocage à distance

L'offre est stockée sur l'école (`ecoles.offre`), à côté du statut
(`ESSAI`, `ACTIF`, `BLOQUE`) et de la date de fin. Elle est appliquée à chaque
requête : nul besoin de réinstaller le site ni l'application Windows.

| Offre | Prix / mois | Élèves | Utilisateurs | Fonctions clés |
| --- | --- | --- | --- | --- |
| STARTER | 15 000 F | 150 | 1 (directeur) | Élèves, inscriptions, tranches libres, paiements, reçu WhatsApp, impayés par tranche |
| PRO | 25 000 F | 500 | 3 (directeur, comptable, secrétaire) | Tout STARTER + relances WhatsApp, exports Excel/PDF, historique complet, totaux du tableau de bord |
| PREMIUM | 40 000 F | illimité | illimité | Tout PRO + notes et bulletins, profs et salaires, multi-écoles, statistiques avancées, sauvegarde automatique, support prioritaire |

Règles appliquées :

- **Inscription** : 30 jours d'essai avec toutes les fonctions PREMIUM.
- **Un seul essai gratuit** : par nom d'école (normalisé), par téléphone
  principal et par WhatsApp. Changer d'email ne suffit pas. Une nouvelle
  inscription avec l'une de ces identités est refusée avec le message commercial
  (15 000 F STARTER, 25 000 F PRO, 40 000 F PREMIUM, +228 70309744,
  `follyfoliemmanuel@gmail.com`) et journalisée pour le super admin.
- **Fin d'essai ou d'abonnement** : l'école est redirigée vers `/blocage`, qui
  affiche les trois offres, les prix et les instructions de paiement Flooz /
  TMoney (+228 70309744, WhatsApp ou `follyfoliemmanuel@gmail.com`).
- **Changement d'offre** : le super admin active STARTER, PRO ou PREMIUM pour
  1 mois (30 jours) ou 3 mois (90 jours). L'activation remplace l'offre
  immédiatement et rouvre une école bloquée.
- **Retour à une offre inférieure** : les modules en trop disparaissent de la
  navigation et affichent un écran « Offre supérieure requise ». Élèves,
  paiements, notes, reçus et comptes restent en base.
- **Contrôles serveur** : les limites d'élèves, de classes et d'utilisateurs
  sont vérifiées dans les Server Actions, pas seulement dans l'interface.
- **Masquage** : la navigation et les boutons d'export/relance sont filtrés
  selon l'offre ; les pages notes, profs, statistiques et multi-écoles sont
  verrouillées côté serveur.

### Super admin

Un seul compte ouvre `/super-admin`, défini par `SUPER_ADMIN_EMAIL` et
`SUPER_ADMIN_PASSWORD` (voir `.env.example`). Il ne fait pas partie de la table
`users` : il ne peut ni encaisser ni consulter les données d'une école. Il voit
pour chaque école le nom, le téléphone, l'offre, le statut et la date de fin, et
dispose des boutons ACTIVER STARTER/PRO/PREMIUM 1 MOIS ou 3 MOIS et BLOQUER.

Il voit aussi le **journal d'audit des inscriptions refusées** par l'anti-triche
(nom d'école demandé, téléphone, WhatsApp, email utilisé, IP, motif et date).
Le bouton **FORCER UN NOUVEL ESSAI** neutralise les essais actifs de cette
identité (`essais_utilises.actif = false`) et journalise l'action avec l'email du
super admin. L'historique n'est jamais supprimé : le vrai directeur peut alors se
réinscrire et obtenir 30 nouveaux jours.

Les définitions des offres, limites et fonctionnalités vivent dans un seul
fichier : `src/lib/offres.ts`.

---

## Règles de gestion

- **Année scolaire** : septembre → juin, 10 mois numérotés de 1 à 10.
- **Frais** : une ligne par élève et par mois, créée automatiquement à
  l'inscription à partir du tarif de la classe.
- **Paiements** : plusieurs encaissements possibles pour un même mois.
  `montant_paye`, `reste` et `statut` sont recalculés par trigger.
- **Statuts** : `PAYE`, `PARTIEL`, `NON_PAYE`.
- **Modes** : espèces, Flooz, TMoney.
- **Reçus** : numérotation séquentielle par école (`REC-2026-00001`).
- **Annulation** : trace conservée, totaux recalculés.
- **Téléphones** : normalisés sur 8 chiffres, préfixes `90`, `91`, `92`, `93`,
  `70`, `99`. Le lien WhatsApp ajoute l'indicatif `228`.

---

## Structure du projet

```
db/
  schema.sql                 Schéma PostgreSQL, triggers et index
desktop/
  main.js                    Fenêtre Electron, sécurité, mises à jour
  preload.js                 Pont sécurisé page ↔ Electron
  hors-ligne.html            Écran « connexion interrompue »
  electron-builder.yml       Configuration du .exe Windows (NSIS)
  preparer-build.cjs         Correctif NSIS (contourne « spawn UNKNOWN »)
  build/icon.png             Icône Windows (générée depuis le logo)
public/
  logo-school-pay.png         Logo complet officiel
  marque-school-pay.png       Emblème seul (interface)
  icons/                     Icônes PWA 192 / 512 / maskable
scripts/
  push-schema.mjs            Applique le schéma
  seed-demo.ts               École de démonstration
src/
  app/
    (auth)/                  Connexion, inscription, mot de passe
    app/                     Application protégée
      page.tsx               Tableau de bord
      eleves/                Liste, fiche, création, modification
      paiements/             Liste, encaissement
      impayes/               Relances du mois
      classes/               Gestion des classes
      notes/ profs/          Modules PREMIUM (notes, bulletins, salaires)
      statistiques/          Statistiques avancées (PREMIUM)
      etablissements/        Multi-écoles (PREMIUM)
      parametres/            École, équipe, abonnement, mot de passe
    super-admin/             Liste des écoles et activation des offres
    blocage/                 Écran affiché quand l'essai ou l'abonnement expire
    api/eleves/              Recherche et frais d'un élève (JSON)
    icon.png                 Favicon / icône Android
    apple-icon.png           Icône iOS
    manifest.ts              Manifeste PWA
  components/                UI, formulaires, navigation, verrous d'offre
  lib/
    actions/                 Server Actions (écritures)
    data/                    Requêtes de lecture
    auth.ts                  Sessions, bcrypt, JWT
    activation.ts            Accès, motifs de blocage, compte super admin
    offres.ts                Prix, limites et fonctionnalités des 3 offres
    config.ts                Coordonnées commerciales
    db.ts                    Pool PostgreSQL et transactions
    whatsapp.ts              Modèles de messages et liens wa.me
    pdf.ts                   Exports PDF
```

---

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:push` | Applique `db/schema.sql` |
| `npm run db:seed` | Recrée l'école de démonstration |
| `npm run desktop:dev` | Ouvre la coque Electron sur le serveur local |
| `npm run desktop:pack` | Construit un dossier Windows non installable (test) |
| `npm run desktop:build` | Génère l'installateur `.exe` dans `release/` |
| `npm run desktop:publish` | Publie le `.exe` et les fichiers de mise à jour |

---

## Application Windows (.exe) et mises à jour automatiques

L'application de bureau est une **coque Electron mince** : elle affiche le site
SCHOOL PAY hébergé, avec sa propre fenêtre, son icône et son menu. Elle ne
contient ni base de données ni logique métier.

Conséquence importante pour la V2 : **le site continue d'être mis à jour sur
Vercel**. Les nouveaux écrans, les corrections et les évolutions de la V2 sont
donc visibles dès le déploiement, sans réinstaller quoi que ce soit. Seule la
coque Windows (fenêtre, menu, écran hors-ligne) peut nécessiter un nouvel
`.exe` ; `electron-updater` s'en charge en arrière-plan.

### Tester en local

```bash
npm run dev                 # terminal 1 : le site sur http://localhost:3000
set SCHOOLPAY_APP_URL=http://localhost:3000
npm run desktop:dev         # terminal 2 : la fenêtre Electron
```

Sous PowerShell, utilisez `$env:SCHOOLPAY_APP_URL="http://localhost:3000"` avant
`npm run desktop:dev`.

### Construire l'installateur

```bash
npm run desktop:build
```

Le fichier `release/SCHOOL-PAY-1.0.0-setup.exe` est généré avec :

- un installeur NSIS (choix du dossier d'installation, raccourcis menu et
  bureau, désinstallation propre) ;
- `latest.yml` et le `.blockmap` nécessaires aux mises à jour différentielles.

Aucun `next build` n'est nécessaire dans cette étape : le site n'est pas
embarqué dans le `.exe`.

> **Note Windows.** `desktop:build` applique d'abord un correctif local à
> electron-builder (`desktop/preparer-build.cjs`). Il extrait l'uninstaller
> directement du binaire NSIS au lieu d'exécuter l'installateur intermédiaire,
> ce qui évite l'erreur `spawn UNKNOWN` provoquée par l'antivirus qui verrouille
> un exécutable fraîchement écrit. Le correctif est automatique et sans effet
> sur les autres plateformes ; il suffit de relancer `npm install` puis
> `npm run desktop:build` si `node_modules` est réinstallé.

### Publier une mise à jour

1. Modifiez `version` dans `package.json` (par exemple `1.0.1`).
2. Lancez `npm run desktop:publish` (ou `desktop:build` puis déposez les
   fichiers à la main).
3. Envoyez sur le serveur de mise à jour **le même dossier** que celui indiqué
   dans `desktop/electron-builder.yml` (`publish.url`) :
   - `SCHOOL-PAY-1.0.1-setup.exe`
   - `latest.yml`
   - `SCHOOL-PAY-1.0.1-setup.exe.blockmap`

Les postes déjà installés téléchargent la mise à jour en arrière-plan. Un
bandeau « mise à jour prête » apparaît dans l'application ; elle s'installe au
prochain redémarrage (ou immédiatement via le bouton). Personne n'a besoin de
retélécharger l'installeur.

> Pour utiliser GitHub Releases à la place d'un serveur classique, remplacez
> le bloc `publish` par :
>
> ```yaml
> publish:
>   provider: github
>   owner: VOTRE_COMPTE
>   repo: SCHOOL-PAY
> ```
>
> puis publiez avec un jeton `GH_TOKEN`.

### Sécurité de la coque

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Préchargement minimal : uniquement les fonctions de mise à jour et de
  connexion, jamais d'accès au système de fichiers.
- Navigation limitée à l'origine du site ; les liens WhatsApp, `mailto:` et
  externes s'ouvrent dans le navigateur du système.
- Permissions (caméra, micro, géolocalisation…) refusées par défaut.
- Téléchargement des mises à jour uniquement depuis l'URL HTTPS configurée.

### Avant de distribuer

- **Signature de code** : sans certificat, Windows SmartScreen affiche un
  avertissement au premier lancement. Un certificat de signature (OV/EV)
  supprime cet avertissement et protège les mises à jour.
- **URL de mise à jour** : remplacez `https://maj.schoolpay.tg/desktop` dans
  `desktop/electron-builder.yml` par votre hébergement réel.
- **Lien de téléchargement** : renseignez
  `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` pour afficher le bouton « Télécharger le
  .exe » dans Paramètres → Application bureau.

### Mobile

Le site est une PWA installable : sur Android, « Ajouter à l'écran
d'accueil » ; sur iPhone, Partager → « Sur l'écran d'accueil ». L'application
s'ouvre alors en plein écran avec l'icône SCHOOL PAY, sans passer par un store.

---

## Personnalisation commerciale

Avant une mise en production réelle :

- **Coordonnées commerciales** : un seul fichier, `src/lib/config.ts`
  (email, WhatsApp, numéros Flooz / TMoney, bénéficiaire). Peut aussi être
  piloté par les variables `NEXT_PUBLIC_*` documentées dans `.env.example`.
- **Tarifs, limites et fonctionnalités** : un seul fichier,
  `src/lib/offres.ts`. Modifier un prix, une limite d'élèves ou la liste des
  fonctions d'une offre se répercute sur la page de blocage, les paramètres, la
  navigation et les contrôles serveur. La page Paramètres ne fait qu'afficher
  ces définitions.
- **Compte super admin** : `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` dans
  `.env.local` (ou dans les variables de l'hébergeur). Ce compte n'existe pas
  dans la base et n'a accès qu'à `/super-admin`.
- **Modèles WhatsApp** : modifiables par chaque directeur depuis
  Paramètres. Les valeurs par défaut sont dans `db/schema.sql`.
- **Logo** : le logo officiel est dans `public/logo-school-pay.png`, l'emblème
  seul dans `public/marque-school-pay.png`. Pour le remplacer, régénérez aussi
  `desktop/build/icon.png`, `src/app/icon.png`, `src/app/apple-icon.png` et
  `public/icons/` (192, 512, maskable).
- **Identité de chaque école** : chaque école téléverse son propre logo depuis
  Paramètres.

---

## Sécurité

- Mots de passe hachés avec bcrypt (coût 12).
- **Politique de mot de passe** (création, réinitialisation, profs) : 10 caractères
  minimum, 72 octets maximum (limite bcrypt), refus des mots de passe les plus
  courants et des suites trop simples.
- Session JWT signée, cookie `httpOnly`, `sameSite=lax`, `secure` en production.
  En production, les cookies portent le préfixe `__Host-` (`__Host-ecolepay_session`),
  qui interdit au navigateur de les accepter sans `Secure` ni avec un domaine
  parent : un sous-domaine compromis ne peut pas les écraser.
- **Double authentification (2FA) du super admin** : TOTP compatible Google
  Authenticator / Authy / Microsoft Authenticator, activable depuis
  `/super-admin/securite` (QR code + 8 codes de secours hachés). Le secret TOTP
  est stocké en base (`super_admin_2fa`) : la base doit donc être protégée.
  - La connexion se fait en deux étapes : mot de passe, puis code. Le défi de
    5 minutes est signé (HMAC) et porte l'email, donc l'étape 2 n'affiche ni
    email ni mot de passe et ne peut pas être détournée vers un autre compte.
  - Un code TOTP déjà utilisé est refusé (anti-rejeu par compteur de 30 s), et
    chaque code de secours ne sert qu'une fois.
  - Limite dédiée : 8 codes par email et par quart d'heure, 20 par IP.
  - Secours si téléphone **et** codes perdus : `npm run 2fa:desactiver -- email@…`
    (`scripts/desactiver-2fa.mjs`) sur le serveur, avec `DATABASE_URL` défini.
- **Journal d'audit** (`journal_actions`) : connexion super admin, activation ou
  désactivation de la 2FA, changement d'offre, blocage/déblocage d'école, essai
  forcé, création de comptes, changements de mot de passe, suppressions d'élèves
  et annulations de paiement. L'écriture est « au mieux » : une panne du journal
  ne fait jamais échouer l'action métier.
- **Comparaison à temps constant** pour le mot de passe du super admin (stocké en
  variable d'environnement) et hachage factice quand le compte n'existe pas :
  la durée de réponse ne révèle pas l'existence d'un email.
- **Rôle PostgreSQL dédié** (`db/roles.sql`) : rôle applicatif sans `SUPERUSER`,
  sans `CREATEDB`, sans `CREATEROLE`, avec les seuls droits nécessaires sur le
  schéma `public`. À exécuter une fois sur la base de production puis à utiliser
  dans `DATABASE_URL`.
- `token_version` invalide les sessions après changement de mot de passe ou
  désactivation d'un compte.
- Le middleware protège `/app`, mais chaque page et chaque action revérifient la
  session et l'appartenance à l'école.
- Limitation des tentatives de connexion et des demandes de réinitialisation.
- **Anti-brute-force serveur** : chaque tentative est enregistrée dans
  `login_attempts` (email, IP, appareil, date, succès/échec). Après 5 échecs sur
  le même email ou la même IP, le blocage dure 5 minutes ; après 10 échecs,
  10 minutes (plafond volontaire). Le message affiché reste toujours
  « Email ou mot de passe incorrect. » pour ne pas révéler si l'email existe.
- **Captcha** arithmétique signé (HMAC `AUTH_SECRET`, 10 minutes) affiché à
  partir du 3e échec de connexion.
- **Rate limiting global** stocké en base (`rate_limits`, fenêtres fixes) sur la
  connexion, l'inscription, la demande de réinitialisation et le nouveau mot de
  passe. Il fonctionne aussi en multi-instance, contrairement à un compteur en
  mémoire.
- **Déconnexion automatique** après 24 h d'inactivité : `users.derniere_activite`
  est vérifiée à chaque requête et rafraîchie au plus toutes les 5 minutes.
- **Anti-triche des essais** : le registre `essais_utilises` conserve le nom
  normalisé, le téléphone, le WhatsApp, l'IP et l'appareil. Trois index uniques
  partiels empêchent deux essais actifs pour la même identité, même en cas de
  requêtes simultanées.
- En-têtes de sécurité sur toutes les réponses (`nosniff`, `DENY` en
  frame-ancestors, `Referrer-Policy`, `Permissions-Policy`, HSTS en production).
- L'application Windows n'expose aucune API Node à la page, refuse les
  permissions sensibles et n'autorise que les mises à jour HTTPS.
- Aucune donnée n'est envoyée à un service tiers pour les reçus WhatsApp : le
  lien `wa.me` ouvre simplement l'application avec le message pré-rempli.

---

## Limites connues de la V1

- Les reçus WhatsApp ne sont pas envoyés automatiquement : l'utilisateur appuie
  sur « Envoyer » dans WhatsApp (choix assumé pour éviter les coûts d'API).
- L'abonnement est activé manuellement après réception du paiement Flooz/TMoney.
- Les emails de réinitialisation nécessitent une clé Resend ; sans clé, le lien
  s'affiche à l'écran en développement.
- Pas encore de paiement en ligne, d'inscription parent ou de notes : voir la
  feuille de route V2.
