import { sql, uneLigne } from "./db";
import { construireContenuRapport } from "./data/annees";
import { donneesBulletin } from "./data/notes";
import {
  echouerTache,
  recyclerTachesBloquees,
  reserverTaches,
  terminerTache,
  type Tache,
} from "./file-attente";
import { construirePdfBulletin } from "./pdf-bulletin";
import type { Trimestre } from "./types";
import { envoyerBulletinWhatsApp } from "./whatsapp-cloud";

/**
 * Cœur du worker de la file d'attente.
 *
 * Appelé par deux chemins :
 *   • `/api/taches` (cron Vercel + déclenchement manuel) ;
 *   • `after()` dans l'action de publication des bulletins, pour que l'envoi
 *     démarre tout de suite sans faire attendre le directeur.
 *
 * Aucun de ces chemins n'est dans le rendu d'une page : une école ne subit
 * jamais la latence d'un envoi WhatsApp ni d'un PDF.
 */

/** Nombre de tâches traitées par passage : borne la durée du worker. */
export const TACHES_PAR_PASSAGE = 10;

export type ResultatWorker = {
  traitees: number;
  reussies: number;
  echouees: number;
  recyclees: number;
  purge?: Record<string, number>;
};

type ChargeBulletin = {
  eleve_id: string;
  telephone: string;
  annee: string;
  trimestre: Trimestre;
  message: string;
};

function lireCharge(charge: Record<string, unknown>): ChargeBulletin | null {
  const eleveId = charge.eleve_id;
  const telephone = charge.telephone;
  const annee = charge.annee;
  const trimestre = Number(charge.trimestre);
  const message = charge.message;

  if (
    typeof eleveId !== "string" ||
    typeof telephone !== "string" ||
    typeof annee !== "string" ||
    typeof message !== "string" ||
    (trimestre !== 1 && trimestre !== 2 && trimestre !== 3)
  ) {
    return null;
  }

  return {
    eleve_id: eleveId,
    telephone,
    annee,
    trimestre: trimestre as Trimestre,
    message,
  };
}

/** Journalise le résultat dans `bulletin_envois` (une ligne par élève/trimestre). */
async function journaliserBulletin(
  ecoleId: string,
  charge: ChargeBulletin,
  statut: "ENVOYE" | "ECHEC",
  erreur: string | null,
): Promise<void> {
  await sql(
    `update bulletin_envois
        set statut = $4,
            erreur = $5,
            envoye_le = case when $4 = 'ENVOYE' then now() else envoye_le end
      where ecole_id = $1
        and eleve_id = $2
        and annee_scolaire = $3
        and trimestre = $6`,
    [
      ecoleId,
      charge.eleve_id,
      charge.annee,
      statut,
      erreur,
      charge.trimestre,
    ],
  );
}

async function traiterBulletin(tache: Tache): Promise<void> {
  if (!tache.ecole_id) throw new Error("École absente de la tâche.");
  const charge = lireCharge(tache.charge);
  if (!charge) throw new Error("Charge de tâche invalide.");

  const eleve = await uneLigne<{ classe_id: string }>(
    `select coalesce(i.classe_id, e.classe_id) as classe_id
       from eleves e
       left join inscriptions i
         on i.eleve_id = e.id
        and i.ecole_id = e.ecole_id
        and i.annee_scolaire = $3
      where e.id = $1 and e.ecole_id = $2`,
    [charge.eleve_id, tache.ecole_id, charge.annee],
  );
  if (!eleve) throw new Error("Élève introuvable.");

  const bulletin = await donneesBulletin(
    tache.ecole_id,
    charge.annee,
    eleve.classe_id,
    charge.trimestre,
  );
  if (!bulletin) throw new Error("Bulletin indisponible.");

  const eleveBulletin = bulletin.eleves.find((e) => e.id === charge.eleve_id);
  if (!eleveBulletin) throw new Error("Aucune note publiée pour cet élève.");

  const pdf = construirePdfBulletin({
    ecole: bulletin.ecole,
    eleve: { nom: eleveBulletin.nom, prenom: eleveBulletin.prenom },
    classe: bulletin.classe.nom,
    annee: charge.annee,
    trimestre: charge.trimestre,
    lignes: eleveBulletin.lignes,
    total_coefficients: eleveBulletin.total_coefficients,
    total_points: eleveBulletin.total_points,
    moyenne: eleveBulletin.moyenne,
    rang: eleveBulletin.rang,
    effectif: bulletin.eleves.length,
    mention: eleveBulletin.mention,
  });

  const resultat = await envoyerBulletinWhatsApp({
    telephone: charge.telephone,
    pdf,
    nomFichier: `bulletin-${eleveBulletin.nom.toLowerCase()}-${charge.trimestre}.pdf`,
    legende: charge.message,
  });

  if (!resultat.ok) {
    const erreur = resultat.erreur ?? "Envoi WhatsApp impossible.";
    await journaliserBulletin(tache.ecole_id, charge, "ECHEC", erreur);
    throw new Error(erreur);
  }

  await journaliserBulletin(tache.ecole_id, charge, "ENVOYE", null);
}

/**
 * Génère le contenu consolidé d'un rapport demandé (trimestriel ou annuel).
 * Le PDF n'est pas stocké : le contenu JSON suffit et le fichier est reconstruit
 * à chaque téléchargement. La tâche peut donc être rejouée sans doublon.
 */
async function traiterRapport(tache: Tache): Promise<void> {
  if (!tache.ecole_id) throw new Error("École absente de la tâche.");
  const rapportId = tache.charge.rapport_id;
  if (typeof rapportId !== "string") throw new Error("Charge de tâche invalide.");

  const rapport = await uneLigne<{
    annee_scolaire: string;
    type: "TRIMESTRIEL" | "ANNUEL";
    trimestre: number;
    statut: string;
  }>(
    `select annee_scolaire, type, trimestre, statut
       from rapports
      where id = $1 and ecole_id = $2`,
    [rapportId, tache.ecole_id],
  );
  if (!rapport) throw new Error("Rapport introuvable.");
  if (rapport.statut === "PRET") return;

  await sql(
    `update rapports
        set statut = 'EN_COURS', erreur = null, updated_at = now()
      where id = $1 and ecole_id = $2`,
    [rapportId, tache.ecole_id],
  );

  try {
    const contenu = await construireContenuRapport(
      tache.ecole_id,
      rapport.annee_scolaire,
      rapport.type,
      rapport.trimestre,
    );
    await sql(
      `update rapports
          set statut = 'PRET',
              contenu = $3::jsonb,
              erreur = null,
              date_generation = now(),
              updated_at = now()
        where id = $1 and ecole_id = $2`,
      [rapportId, tache.ecole_id, JSON.stringify(contenu)],
    );
  } catch (erreur) {
    const message =
      erreur instanceof Error ? erreur.message : "Génération impossible.";
    await sql(
      `update rapports
          set statut = 'ECHEC', erreur = left($3, 500), updated_at = now()
        where id = $1 and ecole_id = $2`,
      [rapportId, tache.ecole_id, message],
    );
    throw erreur;
  }
}

/**
 * Purge des tables techniques qui grossissent sans limite. Sans elle,
 * `login_attempts` et `rate_limits` finiraient par coûter plus cher que les
 * données métier. Les données scolaires ne sont jamais touchées.
 */
export async function purgerTablesTechniques(): Promise<Record<string, number>> {
  const resultats: Record<string, number> = {};

  const purges: Array<[string, string]> = [
    [
      "login_attempts",
      "delete from login_attempts where date_creation < now() - interval '30 days'",
    ],
    [
      "rate_limits",
      "delete from rate_limits where fenetre < now() - interval '1 day'",
    ],
    [
      "journal_actions",
      "delete from journal_actions where date_creation < now() - interval '90 days'",
    ],
    [
      "password_resets",
      "delete from password_resets where expire_le < now() - interval '1 day'",
    ],
    [
      "taches",
      "delete from taches where statut in ('TERMINE', 'ECHEC') and updated_at < now() - interval '30 days'",
    ],
  ];

  for (const [nom, requete] of purges) {
    try {
      const lignes = await sql<{ supprimees: string }>(
        `with supprimees as (${requete} returning 1)
         select count(*)::text as supprimees from supprimees`,
      );
      resultats[nom] = Number(lignes[0]?.supprimees ?? 0);
    } catch (erreur) {
      console.error("Purge impossible :", {
        table: nom,
        code: (erreur as { code?: string })?.code,
      });
      resultats[nom] = -1;
    }
  }

  return resultats;
}

/** Traite une passe de file d'attente. `purge` est réservé au cron. */
export async function traiterTaches({
  limite = TACHES_PAR_PASSAGE,
  purge = false,
}: {
  limite?: number;
  purge?: boolean;
} = {}): Promise<ResultatWorker> {
  const recyclees = await recyclerTachesBloquees();
  const taches = await reserverTaches(Math.max(0, Math.min(limite, 25)));

  let reussies = 0;
  let echouees = 0;

  for (const tache of taches) {
    try {
      if (tache.type === "BULLETIN_WHATSAPP") {
        await traiterBulletin(tache);
      } else if (tache.type === "RAPPORT") {
        await traiterRapport(tache);
      }
      await terminerTache(tache.id);
      reussies += 1;
    } catch (erreur) {
      echouees += 1;
      const message =
        erreur instanceof Error ? erreur.message : "Erreur inconnue.";
      await echouerTache(tache.id, message);
    }
  }

  return {
    traitees: taches.length,
    reussies,
    echouees,
    recyclees,
    purge: purge ? await purgerTablesTechniques() : undefined,
  };
}

/**
 * Traite la file par petits lots avec un budget de temps borné.
 * Utilisé après la publication des bulletins : l'envoi démarre tout de suite,
 * sans jamais faire durer la fonction serverless au-delà de sa limite.
 */
export async function viderFile({
  limite = 5,
  secondesMax = 20,
  maximum = 100,
}: {
  limite?: number;
  secondesMax?: number;
  maximum?: number;
} = {}): Promise<ResultatWorker> {
  const fin = Date.now() + secondesMax * 1000;
  const cumul: ResultatWorker = {
    traitees: 0,
    reussies: 0,
    echouees: 0,
    recyclees: 0,
  };

  while (cumul.traitees < maximum && Date.now() < fin) {
    const passe = await traiterTaches({ limite });
    cumul.traitees += passe.traitees;
    cumul.reussies += passe.reussies;
    cumul.echouees += passe.echouees;
    cumul.recyclees += passe.recyclees;
    // File vidée (ou tâches reportées après échec) : inutile d'insister.
    if (passe.traitees < limite) break;
  }

  return cumul;
}
