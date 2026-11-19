/**
 * Vérifie la connexion à la base pointée par DATABASE_URL, sans rien écrire.
 * Usage : npm run db:check
 *
 * Contrôle : accès réseau, SSL, version PostgreSQL, présence des tables et des
 * colonnes du modèle « périodes », déclencheurs, cohérence des montants,
 * volumétrie, et éventuelle présence de la démo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

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
      /* fichier absent : on continue */
    }
  }
}

chargerEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquant. Copiez .env.example vers .env.local.");
  process.exit(1);
}

function afficherCible(valeur) {
  try {
    const u = new URL(valeur);
    return `${u.host}${u.pathname}${u.username ? ` (utilisateur ${u.username})` : ""}`;
  } catch {
    return "(URL illisible)";
  }
}

const TABLES = [
  "ecoles",
  "subscriptions",
  "users",
  "classes",
  "tranches",
  "eleves",
  "frais",
  "paiements",
  "password_resets",
  "essais_utilises",
  "inscriptions_audit",
  "login_attempts",
  "rate_limits",
  "matieres",
  "notes",
  "profs",
  "salaires",
  "versements_salaires",
  "bulletin_envois",
  "saisies_notes",
  "notes_echeances",
];

/** Colonnes indispensables au modèle « tranches libres » et frais d'inscription. */
const COLONNES = [
  ["subscriptions", "school_id"],
  ["subscriptions", "plan"],
  ["subscriptions", "status"],
  ["subscriptions", "date_debut"],
  ["subscriptions", "date_fin"],
  ["subscriptions", "dernier_paiement"],
  ["ecoles", "offre"],
  ["ecoles", "statut"],
  ["ecoles", "date_fin_essai"],
  ["ecoles", "date_fin_abonnement"],
  ["ecoles", "nom_normalise"],
  ["ecoles", "telephone_normalise"],
  ["ecoles", "whatsapp"],
  ["ecoles", "whatsapp_normalise"],
  ["ecoles", "ip_inscription"],
  ["ecoles", "appareil_inscription"],
  ["users", "derniere_activite"],
  ["essais_utilises", "nom_normalise"],
  ["essais_utilises", "telephone_normalise"],
  ["essais_utilises", "whatsapp_normalise"],
  ["essais_utilises", "actif"],
  ["inscriptions_audit", "type"],
  ["inscriptions_audit", "traite"],
  ["login_attempts", "email"],
  ["login_attempts", "ip"],
  ["login_attempts", "succes"],
  ["login_attempts", "bloque"],
  ["rate_limits", "cle"],
  ["rate_limits", "fenetre"],
  ["classes", "montant_periode"],
  ["classes", "frequence_paiement"],
  ["classes", "frais_inscription"],
  ["classes", "frais_reinscription"],
  ["tranches", "classe_id"],
  ["tranches", "ordre"],
  ["tranches", "nom"],
  ["tranches", "montant"],
  ["tranches", "date_limite"],
  ["eleves", "type_inscription"],
  ["frais", "type_frais"],
  ["frais", "frequence_paiement"],
  ["frais", "periode"],
  ["frais", "tranche_id"],
  ["frais", "libelle"],
  ["paiements", "frais_id"],
  ["paiements", "type_frais"],
  ["paiements", "frequence_paiement"],
  ["paiements", "periode"],
  ["paiements", "tranche_id"],
  ["paiements", "libelle"],
  ["matieres", "ecole_id"],
  ["matieres", "coefficient"],
  ["notes", "ecole_id"],
  ["notes", "eleve_id"],
  ["notes", "matiere_id"],
  ["notes", "annee_scolaire"],
  ["notes", "trimestre"],
  ["notes", "note"],
  ["profs", "ecole_id"],
  ["profs", "salaire_mensuel"],
  ["profs", "actif"],
  ["salaires", "ecole_id"],
  ["salaires", "prof_id"],
  ["salaires", "annee"],
  ["salaires", "mois"],
  ["salaires", "montant_du"],
  ["salaires", "montant_paye"],
  ["salaires", "reste"],
  ["salaires", "statut"],
  ["versements_salaires", "ecole_id"],
  ["versements_salaires", "salaire_id"],
  ["versements_salaires", "montant"],
  ["versements_salaires", "mode_paiement"],
  ["versements_salaires", "date_versement"],
  ["ecoles", "slug"],
  ["eleves", "masque_portail"],
  ["eleves", "photo_url"],
  ["bulletin_envois", "ecole_id"],
  ["bulletin_envois", "eleve_id"],
  ["bulletin_envois", "annee_scolaire"],
  ["bulletin_envois", "trimestre"],
  ["bulletin_envois", "telephone"],
  ["bulletin_envois", "statut"],
  ["bulletin_envois", "url_whatsapp"],
  ["bulletin_envois", "envoye_le"],
  ["users", "identifiant"],
  ["profs", "user_id"],
  ["notes", "devoir1"],
  ["notes", "devoir2"],
  ["notes", "composition"],
  ["saisies_notes", "ecole_id"],
  ["saisies_notes", "annee_scolaire"],
  ["saisies_notes", "trimestre"],
  ["saisies_notes", "classe_id"],
  ["saisies_notes", "matiere_id"],
  ["saisies_notes", "prof_id"],
  ["saisies_notes", "statut"],
  ["saisies_notes", "envoye_le"],
  ["saisies_notes", "valide_le"],
  ["saisies_notes", "libere_le"],
  ["notes_echeances", "ecole_id"],
  ["notes_echeances", "annee_scolaire"],
  ["notes_echeances", "trimestre"],
  ["notes_echeances", "date_limite"],
];

const ssl =
  /sslmode=(require|verify)/.test(url) || /neon\.tech|supabase\.co/.test(url)
    ? { rejectUnauthorized: false }
    : undefined;

const client = new Client({
  connectionString: url,
  ssl,
  connectionTimeoutMillis: 10_000,
});

let echec = false;

try {
  console.log(`→ Cible : ${afficherCible(url)}`);
  const debut = Date.now();
  await client.connect();
  console.log(`✅ Connexion établie en ${Date.now() - debut} ms`);

  const infos = await client.query(
    `select current_database() as base, current_user as utilisateur,
            current_setting('server_version') as version`,
  );
  const { base, utilisateur, version } = infos.rows[0];
  console.log(`   Base « ${base} » · utilisateur « ${utilisateur} »`);
  console.log(`   PostgreSQL ${version}`);

  try {
    const sslInfo = await client.query(
      `select coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as actif`,
    );
    console.log(`   SSL : ${sslInfo.rows[0].actif ? "actif" : "non"}`);
  } catch {
    console.log("   SSL : information indisponible");
  }

  const tables = await client.query(
    `select t.nom, to_regclass('public.' || t.nom) is not null as presente
       from unnest($1::text[]) as t(nom)`,
    [TABLES],
  );
  const presentes = tables.rows.filter((t) => t.presente);
  const manquantes = tables.rows.filter((t) => !t.presente);
  console.log(`   Tables : ${presentes.length}/${TABLES.length}`);

  if (manquantes.length > 0) {
    console.log(`⚠️  Manquantes : ${manquantes.map((t) => t.nom).join(", ")}`);
    console.log("   → Lancez « npm run db:push » pour appliquer le schéma.");
    echec = true;
  } else {
    const colonnes = await client.query(
      `select c.table_name, c.column_name
         from unnest($1::text[], $2::text[]) as c(table_name, column_name)
         left join information_schema.columns ic
           on ic.table_schema = 'public'
          and ic.table_name = c.table_name
          and ic.column_name = c.column_name
        where ic.column_name is null`,
      [COLONNES.map((c) => c[0]), COLONNES.map((c) => c[1])],
    );
    if (colonnes.rowCount > 0) {
      console.log(
        `⚠️  Colonnes absentes : ${colonnes.rows
          .map((c) => `${c.table_name}.${c.column_name}`)
          .join(", ")}`,
      );
      console.log("   → Lancez « npm run db:push » pour mettre à jour le schéma.");
      echec = true;
    } else {
      console.log(`   Colonnes du schéma : ${COLONNES.length}/${COLONNES.length}`);
    }

    const comptes = await client.query(
      `select (select count(*) from ecoles)::int as ecoles,
              (select count(*) from ecoles where statut = 'ESSAI')::int as essais,
              (select count(*) from ecoles where statut = 'ACTIF')::int as actives,
              (select count(*) from ecoles where statut = 'BLOQUE')::int as bloquees,
              (select count(*) from users)::int as utilisateurs,
              (select count(*) from classes)::int as classes,
              (select count(*) from tranches)::int as tranches,
              (select count(*) from eleves)::int as eleves,
              (select count(*) from frais)::int as frais,
              (select count(*) from paiements)::int as paiements,
              (select count(*) from matieres)::int as matieres,
              (select count(*) from notes)::int as notes,
              (select count(*) from profs)::int as profs,
              (select count(*) from salaires)::int as salaires,
              (select count(*) from versements_salaires)::int as versements,
              (select count(*) from saisies_notes)::int as saisies`,
    );
    const c = comptes.rows[0];
    console.log(
      `   Contenu : ${c.ecoles} école(s) · ${c.utilisateurs} utilisateur(s) · ` +
        `${c.classes} classe(s) · ${c.tranches} tranche(s) · ${c.eleves} élève(s) · ` +
        `${c.frais} échéance(s) · ${c.paiements} paiement(s)`,
    );
    console.log(
      `   Modules : ${c.matieres} matière(s) · ${c.notes} note(s) · ` +
        `${c.profs} professeur(s) · ${c.salaires} salaire(s) · ${c.versements} versement(s) · ` +
        `${c.saisies} saisie(s) de notes`,
    );
    console.log(
      `   Activation : ${c.essais} en essai · ${c.actives} active(s) · ${c.bloquees} bloquée(s)`,
    );

    const offres = await client.query(
      `select offre, count(*)::int as total
         from ecoles
        group by offre
        order by offre`,
    );
    console.log(
      `   Offres : ${offres.rows.map((o) => `${o.offre} ${o.total}`).join(" · ") || "aucune école"}`,
    );

    const roles = await client.query(
      `select role, count(*)::int as total
         from users
        group by role
        order by role`,
    );
    console.log(
      `   Rôles : ${roles.rows.map((r) => `${r.role} ${r.total}`).join(" · ") || "aucun utilisateur"}`,
    );

    const securite = await client.query(
      `select
         (select count(*) from essais_utilises where actif)::int as essais_actifs,
         (select count(*) from inscriptions_audit where type = 'REFUS')::int as refus,
         (select count(*) from inscriptions_audit
           where type = 'REFUS' and traite = false)::int as a_traiter,
         (select count(*) from inscriptions_audit where type = 'FORCE')::int as forces,
         (select count(*) from login_attempts
           where succes = false
             and date_creation > now() - interval '24 hours')::int as echecs_24h`,
    );
    const s = securite.rows[0];
    console.log(
      `   Sécurité : ${s.essais_actifs} essai(s) consommé(s) · ` +
        `${s.refus} refus (${s.a_traiter} à traiter) · ${s.forces} forcé(s) · ` +
        `${s.echecs_24h} échec(s) de connexion sur 24 h`,
    );

    const essaisSansIdentite = await client.query(
      `select count(*)::int as total
         from essais_utilises
        where actif = true
          and (nom_normalise is null or nom_normalise = '')`,
    );
    if (essaisSansIdentite.rows[0].total > 0) {
      console.log(
        `⚠️  ${essaisSansIdentite.rows[0].total} essai(s) actif(s) sans nom normalisé`,
      );
      echec = true;
    }

    const offresInvalides = await client.query(
      `select count(*)::int as total
         from ecoles
        where offre not in ('STARTER', 'PRO', 'PREMIUM')`,
    );
    if (offresInvalides.rows[0].total > 0) {
      console.log(
        `⚠️  ${offresInvalides.rows[0].total} école(s) avec une offre invalide (attendu STARTER, PRO ou PREMIUM)`,
      );
      echec = true;
    }

    const rolesInvalides = await client.query(
      `select count(*)::int as total
         from users
        where role not in ('directeur', 'secretaire', 'comptable', 'prof')`,
    );
    if (rolesInvalides.rows[0].total > 0) {
      console.log(
        `⚠️  ${rolesInvalides.rows[0].total} utilisateur(s) avec un rôle invalide (attendu directeur, secretaire, comptable ou prof)`,
      );
      echec = true;
    }

    const verrous = await client.query(
      `select count(*)::int as total
         from (
           select ecole_id, annee_scolaire, trimestre, classe_id, matiere_id
             from saisies_notes
            where statut in ('EN_COURS', 'ENVOYE', 'VALIDE')
            group by ecole_id, annee_scolaire, trimestre, classe_id, matiere_id
           having count(*) > 1
         ) as doublons`,
    );
    if (verrous.rows[0].total > 0) {
      console.log(
        `⚠️  ${verrous.rows[0].total} combinaison(s) Classe + Matière verrouillée(s) plusieurs fois`,
      );
      echec = true;
    }

    const triggers = await client.query(
      `select tgname from pg_trigger
        where not tgisinternal
          and tgrelid in ('public.ecoles'::regclass,
                          'public.eleves'::regclass,
                          'public.classes'::regclass,
                          'public.tranches'::regclass,
                          'public.paiements'::regclass)`,
    );
    console.log(`   Déclencheurs métier : ${triggers.rowCount}`);

    if (c.eleves > 0) {
      // 1. Chaque élève doit avoir une ligne INSCRIPTION ou REINSCRIPTION.
      const sansInscription = await client.query(
        `select count(*)::int as total
           from eleves e
          where not exists (
            select 1 from frais f
             where f.eleve_id = e.id
               and f.annee_scolaire = e.annee_scolaire
               and f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
          )`,
      );
      // 2. montant_paye doit correspondre à la somme des paiements valides.
      const montantsIncoherents = await client.query(
        `select count(*)::int as total
           from frais f
           left join (
             select frais_id, sum(montant)::int as total
               from paiements
              where annule = false
              group by frais_id
           ) p on p.frais_id = f.id
          where f.montant_paye <> coalesce(p.total, 0)`,
      );
      // 3. Aucun paiement ne doit dépasser son échéance.
      const depassements = await client.query(
        `select count(*)::int as total
           from frais
          where montant_paye > montant_du`,
      );
      // 4. Les paiements doivent porter un instantané complet.
      const snapshotsIncomplets = await client.query(
        `select count(*)::int as total
           from paiements
          where type_frais is null
             or frequence_paiement is null
             or periode is null
             or libelle is null`,
      );
      // 5. Une classe en tranches doit avoir au moins une tranche.
      const classesSansTranches = await client.query(
        `select count(*)::int as total
           from classes c
          where c.frequence_paiement = 'TRANCHES'
            and not exists (select 1 from tranches t where t.classe_id = c.id)`,
      );
      // 6. Chaque échéance de scolarité en tranches doit pointer sa tranche.
      const fraisSansTranche = await client.query(
        `select count(*)::int as total
           from frais
          where type_frais = 'SCOLARITE'
            and frequence_paiement = 'TRANCHES'
            and (tranche_id is null or libelle is null)`,
      );

      const anomalies = [
        [sansInscription.rows[0].total, "élève(s) sans frais d'inscription"],
        [montantsIncoherents.rows[0].total, "échéance(s) au montant payé incohérent"],
        [depassements.rows[0].total, "échéance(s) en dépassement"],
        [snapshotsIncomplets.rows[0].total, "paiement(s) sans instantané"],
        [classesSansTranches.rows[0].total, "classe(s) en tranches sans tranche"],
        [fraisSansTranche.rows[0].total, "échéance(s) sans tranche ou libellé"],
      ].filter(([total]) => total > 0);

      if (anomalies.length > 0) {
        console.log("⚠️  Anomalies de données :");
        for (const [total, libelle] of anomalies) {
          console.log(`   • ${total} ${libelle}`);
        }
        echec = true;
      } else {
        console.log(
          "   Cohérence : inscription, tranches, libellés, montants et instantanés OK",
        );
      }
    }

    if (c.salaires > 0 || c.versements > 0) {
      const salairesIncoherents = await client.query(
        `select count(*)::int as total
           from salaires s
           left join (
             select salaire_id, sum(montant)::int as total
               from versements_salaires
              group by salaire_id
           ) v on v.salaire_id = s.id
          where s.montant_paye <> coalesce(v.total, 0)`,
      );
      const salairesDepasses = await client.query(
        `select count(*)::int as total from salaires where montant_paye > montant_du`,
      );

      const anomaliesSalaires = [
        [salairesIncoherents.rows[0].total, "salaire(s) au montant payé incohérent"],
        [salairesDepasses.rows[0].total, "salaire(s) en dépassement"],
      ].filter(([total]) => total > 0);

      if (anomaliesSalaires.length > 0) {
        console.log("⚠️  Anomalies de paie :");
        for (const [total, libelle] of anomaliesSalaires) {
          console.log(`   • ${total} ${libelle}`);
        }
        echec = true;
      } else {
        console.log("   Paie : versements et salaires cohérents");
      }
    }

    const demo = await client.query(
      `select nom from ecoles where lower(nom) like '%palmiers%'`,
    );
    if (demo.rowCount > 0) {
      console.log(
        "⚠️  École de démonstration détectée (« École Les Palmiers »). " +
          "Supprimez-la avant d'ouvrir le service aux vraies écoles.",
      );
    }
  }
} catch (erreur) {
  console.error("❌ Échec :", erreur.message);
  echec = true;
} finally {
  await client.end().catch(() => {});
  process.exitCode = echec ? 1 : 0;
}
