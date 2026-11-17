/**
 * Données de démonstration pour SCHOOL PAY.
 * Usage : npm run db:seed
 *
 * Crée une école complète (directeur, secrétaire, classes mensuelles, à
 * tranches libres et annuelles, élèves, paiements et frais d'inscription) pour
 * tester l'application sans saisir 200 lignes.
 * Le script est rejouable : l'école de démonstration est recréée à chaque fois.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
//  Environnement
// ---------------------------------------------------------------------------
function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    try {
      const contenu = readFileSync(resolve(process.cwd(), fichier), "utf8");
      for (const ligne of contenu.split(/\r?\n/)) {
        const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const valeur = m[2].replace(/^["']|["']$/g, "");
        if (!process.env[m[1]]) process.env[m[1]] = valeur;
      }
      break;
    } catch {
      /* fichier absent */
    }
  }
}

chargerEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquant. Copiez .env.example vers .env.local.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
//  Année scolaire et périodes (même logique que src/lib)
// ---------------------------------------------------------------------------
type Frequence = "MENSUEL" | "TRANCHES" | "ANNUEL";

function anneeScolaire(date = new Date()): string {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

function moisScolaireCourant(date = new Date()): number {
  const mois = date.getMonth() + 1;
  if (mois >= 9) return mois - 8;
  if (mois <= 6) return mois + 4;
  return 1;
}

function periodeCourante(frequence: Frequence, date = new Date()): number {
  if (frequence === "ANNUEL" || frequence === "TRANCHES") return 1;
  return moisScolaireCourant(date);
}

/** Date de paiement réaliste dans un mois scolaire donné (1 = septembre). */
function datePourMois(anneeDebut: number, moisScolaire: number, jour: number) {
  const moisCalendrier = moisScolaire + 8;
  const decalageAnnee = Math.floor((moisCalendrier - 1) / 12);
  const moisIndex = (moisCalendrier - 1) % 12;
  return new Date(Date.UTC(anneeDebut + decalageAnnee, moisIndex, jour));
}

/** Premier mois de chaque période, pour dater un paiement. */
function datePourPeriode(
  anneeDebut: number,
  frequence: Frequence,
  periode: number,
  jour: number,
) {
  if (frequence === "TRANCHES") {
    // Les tranches du Togo tombent plutôt en octobre, janvier et mars.
    return datePourMois(anneeDebut, Math.min(10, 9 + periode), jour);
  }
  if (frequence === "ANNUEL") {
    return datePourMois(anneeDebut, 9, jour);
  }
  return datePourMois(anneeDebut, periode, jour);
}

// ---------------------------------------------------------------------------
//  Jeu de données
// ---------------------------------------------------------------------------
const ECOLE = {
  nom: "École Les Palmiers",
  adresse: "Agoè-Nyivé, Lomé",
  telephone: "+228 90 12 34 56",
  email: "demo@ecolepay.tg",
};

const CLASSES: {
  nom: string;
  frequence: Frequence;
  montant: number;
  inscription: number;
  reinscription: number;
  ordre: number;
  tranches?: { nom: string; montant: number }[];
}[] = [
  {
    nom: "CP1 A",
    frequence: "MENSUEL",
    montant: 15_000,
    inscription: 10_000,
    reinscription: 5_000,
    ordre: 1,
  },
  {
    nom: "CM2 B",
    frequence: "MENSUEL",
    montant: 18_000,
    inscription: 10_000,
    reinscription: 5_000,
    ordre: 2,
  },
  {
    nom: "6ème A",
    frequence: "TRANCHES",
    montant: 0,
    inscription: 15_000,
    reinscription: 7_500,
    ordre: 3,
    tranches: [
      { nom: "Première tranche", montant: 60_000 },
      { nom: "Deuxième tranche", montant: 40_000 },
      { nom: "Troisième tranche", montant: 30_000 },
    ],
  },
  {
    nom: "Terminale D",
    frequence: "ANNUEL",
    montant: 350_000,
    inscription: 20_000,
    reinscription: 10_000,
    ordre: 4,
  },
];

const ELEVES = [
  ["Akouvi", "Mensah", "F"],
  ["Kossi", "Agbeko", "M"],
  ["Ama", "Dossou", "F"],
  ["Yao", "Kouassi", "M"],
  ["Akossiwa", "Adjo", "F"],
  ["Komlan", "Amegashie", "M"],
  ["Félicité", "Sossou", "F"],
  ["Kodjo", "Tetteh", "M"],
  ["Mawuli", "Kpodo", "M"],
  ["Akpé", "Nyavor", "F"],
  ["Sena", "Amouzou", "M"],
  ["Afiavi", "Gbedemah", "F"],
  ["Kokou", "Lawson", "M"],
  ["Adjoa", "Sika", "F"],
  ["Emmanuel", "Bodjona", "M"],
  ["Precious", "Amedome", "F"],
  ["Joseph", "Ativor", "M"],
  ["Grâce", "Kudzo", "F"],
  ["Christian", "Tchalla", "M"],
  ["Abla", "Wussah", "F"],
  ["Pierre", "Afanou", "M"],
  ["Esther", "Adjei", "F"],
  ["Didier", "Kougblenou", "M"],
  ["Ruth", "Akli", "F"],
];

const PARENTS = [
  "M. Kofi Mensah",
  "Mme Abla Agbeko",
  "M. Ségbé Dossou",
  "Mme Yawa Kouassi",
  "M. Komi Adjo",
  "Mme Afi Amegashie",
  "M. Kodjo Sossou",
  "Mme Akou Tetteh",
  "M. Messan Kpodo",
  "Mme Rosalie Nyavor",
  "M. Jean Amouzou",
  "Mme Cécile Gbedemah",
];

const PREFIXES = ["90", "91", "92", "93", "99", "70"];

function telephone(index: number): string {
  const prefixe = PREFIXES[index % PREFIXES.length];
  const suffixe = String(100_000 + index * 7_919).slice(0, 6);
  return `${prefixe}${suffixe}`;
}

// ---------------------------------------------------------------------------
//  Exécution
// ---------------------------------------------------------------------------
const ssl = /sslmode=(require|verify)/.test(url) || /neon\.tech|supabase\.co/.test(url)
  ? { rejectUnauthorized: false }
  : undefined;

/**
 * Mot de passe des comptes de démonstration.
 *
 * Aucune valeur n'est écrite dans le dépôt : par défaut, un mot de passe
 * aléatoire est généré et affiché en fin d'exécution. Une variable
 * d'environnement permet d'imposer une valeur connue pour des tests répétés.
 */
function motDePasseDemo(variable: string): string {
  const impose = process.env[variable]?.trim();
  if (impose && impose.length >= 8) return impose;
  return randomBytes(9).toString("base64url");
}

async function main() {
  const client = new Client({ connectionString: url, ssl });

  try {
    await client.connect();
    console.log("→ Connexion établie. Préparation de la démo…");

    const annee = anneeScolaire();
    const anneeDebut = Number.parseInt(annee.slice(0, 4), 10);

    // Aucun mot de passe n'est écrit dans le dépôt : chaque exécution génère
    // un mot de passe aléatoire, affiché à la fin du script. Pour imposer une
    // valeur connue (tests répétés), définissez SEED_MOT_DE_PASSE_DIRECTEUR,
    // SEED_MOT_DE_PASSE_SECRETAIRE ou SEED_MOT_DE_PASSE_COMPTABLE.
    const motDePasseDirecteur = motDePasseDemo("SEED_MOT_DE_PASSE_DIRECTEUR");
    const motDePasseSecretaire = motDePasseDemo("SEED_MOT_DE_PASSE_SECRETAIRE");
    const motDePasseComptable = motDePasseDemo("SEED_MOT_DE_PASSE_COMPTABLE");

    await client.query("begin");

    // Repartir d'une base propre pour la seule école de démonstration.
    await client.query(`delete from ecoles where lower(email) = lower($1)`, [
      ECOLE.email,
    ]);

    const ecole = await client.query<{ id: string }>(
      `insert into ecoles
         (nom, adresse, telephone, email, plan, offre, statut,
          date_fin_essai, date_fin_abonnement, recu_compteur)
       values ($1, $2, $3, $4, 'grosse', 'PREMIUM', 'ACTIF',
               current_date + interval '20 days',
               current_date + interval '365 days', 0)
       returning id`,
      [ECOLE.nom, ECOLE.adresse, ECOLE.telephone, ECOLE.email],
    );
    const ecoleId = ecole.rows[0].id;

    const hashDirecteur = await bcrypt.hash(motDePasseDirecteur, 12);
    const hashSecretaire = await bcrypt.hash(motDePasseSecretaire, 12);
    const hashComptable = await bcrypt.hash(motDePasseComptable, 12);

    const directeur = await client.query<{ id: string }>(
      `insert into users (ecole_id, nom, email, mot_de_passe, role)
       values ($1, $2, $3, $4, 'directeur')
       returning id`,
      [ecoleId, "Kafui Amevor", ECOLE.email, hashDirecteur],
    );
    const directeurId = directeur.rows[0].id;

    await client.query(
      `insert into users (ecole_id, nom, email, mot_de_passe, role)
       values ($1, $2, $3, $4, 'secretaire')`,
      [ecoleId, "Akouvi Mensah", "secretaire@ecolepay.tg", hashSecretaire],
    );

    await client.query(
      `insert into users (ecole_id, nom, email, mot_de_passe, role)
       values ($1, $2, $3, $4, 'comptable')`,
      [ecoleId, "Edem Kossi", "comptable@ecolepay.tg", hashComptable],
    );

    // Classes
    const classes: {
      id: string;
      frequence: Frequence;
      montant: number;
      inscription: number;
      reinscription: number;
    }[] = [];
    for (const classe of CLASSES) {
      const creee = await client.query<{ id: string }>(
        `insert into classes
           (ecole_id, nom, montant_periode, frequence_paiement,
            frais_inscription, frais_reinscription, ordre)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
          ecoleId,
          classe.nom,
          classe.montant,
          classe.frequence,
          classe.inscription,
          classe.reinscription,
          classe.ordre,
        ],
      );
      classes.push({ id: creee.rows[0].id, ...classe });

      if (classe.tranches) {
        const moisTranches = [2, 5, 7];
        for (let index = 0; index < classe.tranches.length; index += 1) {
          const tranche = classe.tranches[index];
          const dateLimite = datePourMois(
            anneeDebut,
            moisTranches[index] ?? Math.min(10, 2 + index),
            28,
          )
            .toISOString()
            .slice(0, 10);
          await client.query(
            `insert into tranches
               (ecole_id, classe_id, ordre, nom, montant, date_limite)
             values ($1, $2, $3, $4, $5, $6)`,
            [
              ecoleId,
              creee.rows[0].id,
              index + 1,
              tranche.nom,
              tranche.montant,
              dateLimite,
            ],
          );
        }
      }
    }

    // Élèves : le trigger crée les échéances + les frais d'entrée.
    const eleves: {
      id: string;
      classeIndex: number;
      frequence: Frequence;
      montant: number;
      typeInscription: "NOUVEAU" | "ANCIEN";
      inscription: number;
    }[] = [];
    for (let index = 0; index < ELEVES.length; index += 1) {
      const [prenom, nom, sexe] = ELEVES[index];
      const classeIndex = index % classes.length;
      const classe = classes[classeIndex];
      const nomParent = PARENTS[index % PARENTS.length];
      const typeInscription = index % 2 === 0 ? "NOUVEAU" : "ANCIEN";
      const inscription =
        typeInscription === "ANCIEN" ? classe.reinscription : classe.inscription;

      const cree = await client.query<{ id: string }>(
        `insert into eleves
           (ecole_id, classe_id, nom, prenom, sexe, nom_parent,
            telephone_parent, annee_scolaire, type_inscription, date_inscription)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, make_date($10, 9, 9))
         returning id`,
        [
          ecoleId,
          classe.id,
          nom,
          prenom,
          sexe,
          nomParent,
          telephone(index),
          annee,
          typeInscription,
          anneeDebut,
        ],
      );

      eleves.push({
        id: cree.rows[0].id,
        classeIndex,
        frequence: classe.frequence,
        montant: classe.montant,
        typeInscription,
        inscription,
      });
    }

    // -------------------------------------------------------------------------
    //  Paiements : profils réalistes pour le tableau de bord
    // -------------------------------------------------------------------------
    let compteurRecu = 0;

    async function encaisser(
      eleveId: string,
      typeFrais: "SCOLARITE" | "INSCRIPTION" | "REINSCRIPTION",
      periode: number,
      montant: number,
      mode: "ESPECES" | "FLOOZ" | "TMONEY",
      jour: number,
      frequence: Frequence,
    ) {
      if (montant <= 0) return;

      const frais = await client.query<{
        id: string;
        montant_du: number;
        montant_paye: number;
      }>(
        `select id, montant_du, montant_paye
           from frais
          where ecole_id = $1 and eleve_id = $2 and annee_scolaire = $3
            and type_frais = $4 and periode = $5`,
        [ecoleId, eleveId, annee, typeFrais, periode],
      );
      const ligne = frais.rows[0];
      if (!ligne) return;

      const reste = ligne.montant_du - ligne.montant_paye;
      const montantValide = Math.min(montant, reste);
      if (montantValide <= 0) return;

      compteurRecu += 1;
      const numero = `REC-${annee.slice(0, 4)}-${String(compteurRecu).padStart(5, "0")}`;
      const resteApres = reste - montantValide;

      // Ne jamais dater un paiement dans le futur.
      const maintenant = new Date();
      let datePaiement =
        typeFrais === "SCOLARITE"
          ? datePourPeriode(anneeDebut, frequence, periode, jour)
          : datePourMois(anneeDebut, 9, jour);
      if (datePaiement.getTime() > maintenant.getTime()) {
        datePaiement = new Date(
          maintenant.getTime() - ((jour % 8) + 1) * 86_400_000,
        );
      }

      await client.query(
        `insert into paiements
           (ecole_id, eleve_id, frais_id, montant, mode_paiement,
            numero_recu, reste_apres, date_paiement, enregistre_par)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          ecoleId,
          eleveId,
          ligne.id,
          montantValide,
          mode,
          numero,
          resteApres,
          datePaiement,
          directeurId,
        ],
      );
    }

    for (let index = 0; index < eleves.length; index += 1) {
      const eleve = eleves[index];
      const mode: "ESPECES" | "FLOOZ" | "TMONEY" =
        index % 3 === 0 ? "FLOOZ" : index % 3 === 1 ? "TMONEY" : "ESPECES";

      // 1. Frais d'inscription / réinscription.
      const profilInscription = index % 5;
      if (profilInscription === 0) {
        // impayé
      } else if (profilInscription === 1) {
        await encaisser(
          eleve.id,
          eleve.typeInscription === "ANCIEN" ? "REINSCRIPTION" : "INSCRIPTION",
          0,
          Math.round(eleve.inscription / 2),
          mode,
          9 + (index % 15),
          eleve.frequence,
        );
      } else if (eleve.inscription > 0) {
        await encaisser(
          eleve.id,
          eleve.typeInscription === "ANCIEN" ? "REINSCRIPTION" : "INSCRIPTION",
          0,
          eleve.inscription,
          mode,
          5 + (index % 10),
          eleve.frequence,
        );
      }

      // 2. Scolarité : six profils de paiement. On lit les échéances réelles
      //    créées par le trigger : montants différents pour chaque tranche.
      const lignesScolarite = await client.query<{
        periode: number;
        montant_du: number;
      }>(
        `select periode, montant_du
           from frais
          where ecole_id = $1 and eleve_id = $2 and annee_scolaire = $3
            and type_frais = 'SCOLARITE'
          order by periode`,
        [ecoleId, eleve.id, annee],
      );
      const echeances = lignesScolarite.rows;
      const max = echeances.length;
      if (max === 0) continue;

      const scenario = Math.floor(index / classes.length) % 6;
      const courante =
        eleve.frequence === "TRANCHES"
          ? Math.min(2, max)
          : Math.min(periodeCourante(eleve.frequence), max);

      const periodesSoldees =
        scenario === 1 || scenario === 5
          ? courante
          : scenario === 0 || scenario === 2 || scenario === 4
            ? courante - 1
            : Math.max(0, courante - 2);

      for (let position = 0; position < Math.min(periodesSoldees, max); position += 1) {
        const echeance = echeances[position];
        await encaisser(
          eleve.id,
          "SCOLARITE",
          echeance.periode,
          echeance.montant_du,
          mode,
          3 + ((index * 5 + position) % 22),
          eleve.frequence,
        );
      }

      if (scenario === 2 && courante >= 1 && courante <= max) {
        await encaisser(
          eleve.id,
          "SCOLARITE",
          echeances[courante - 1].periode,
          Math.round(echeances[courante - 1].montant_du / 2),
          "ESPECES",
          8 + (index % 15),
          eleve.frequence,
        );
      }

      if (scenario === 4 && courante >= 1 && courante <= max) {
        await encaisser(
          eleve.id,
          "SCOLARITE",
          echeances[courante - 1].periode,
          Math.round(echeances[courante - 1].montant_du * 0.6),
          "FLOOZ",
          10 + (index % 12),
          eleve.frequence,
        );
      }
    }

    await client.query(`update ecoles set recu_compteur = $1 where id = $2`, [
      compteurRecu,
      ecoleId,
    ]);

    await client.query("commit");

    console.log("");
    console.log("✅ Démo créée :");
    console.log(`   École       : ${ECOLE.nom}`);
    console.log(`   Année       : ${annee}`);
    console.log(
      `   Classes     : ${CLASSES.length} (mensuel, tranches libres, annuel)`,
    );
    console.log(`   Élèves      : ${ELEVES.length}`);
    console.log(`   Paiements   : ${compteurRecu}`);
    console.log("");
    console.log("   Connexion directeur  : demo@ecolepay.tg / " + motDePasseDirecteur);
    console.log("   Connexion secrétaire : secretaire@ecolepay.tg / " + motDePasseSecretaire);
    console.log("   Connexion comptable  : comptable@ecolepay.tg / " + motDePasseComptable);
    console.log("   Offre               : PREMIUM (active, toutes fonctions)");
    console.log("");
  } catch (erreur) {
    await client.query("rollback").catch(() => undefined);
    console.error("❌ Échec du seed :", (erreur as Error).message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((erreur) => {
  console.error("❌ Échec du seed :", (erreur as Error).message);
  process.exitCode = 1;
});
