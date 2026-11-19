"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { sql, transaction, uneLigne } from "../db";
import { getSession, refusEcriture } from "../auth";
import {
  anneeSuivante,
  bornesAnnee,
  estAnneeScolaire,
  trimestreDeDate,
} from "../annees";
import { apercuCloture } from "../data/annees";
import { empilerTache } from "../file-attente";
import { viderFile } from "../worker-taches";
import { journaliser } from "../journal";
import { estUuid, messageErreurBdd, texte } from "./helpers";
import type {
  DecisionFinAnnee,
  ResultatAction,
  StatutEleve,
  StatutInscription,
} from "../types";

/** Rôles autorisés à préparer une année, un transfert ou une absence. */
function peutGererEleves(role: string): boolean {
  return role === "directeur" || role === "secretaire";
}

function dateValide(valeur: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(valeur) &&
    !Number.isNaN(new Date(`${valeur}T12:00:00`).getTime())
  );
}

function aujourdhui(): string {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

function rafraichirAnnee(): void {
  revalidatePath("/app");
  revalidatePath("/app/eleves");
  revalidatePath("/app/classes");
  revalidatePath("/app/annees");
  revalidatePath("/app/archive");
  revalidatePath("/app/rapports");
}

// ---------------------------------------------------------------------------
//  Clôture d'année : promotion, redoublement, diplôme, décision d'examen
// ---------------------------------------------------------------------------

type Mouvement = {
  eleveId: string;
  inscriptionStatut: StatutInscription;
  decision: DecisionFinAnnee;
  /** Classe d'accueil dans la nouvelle année, ou null si l'élève sort. */
  classeSuivante: string | null;
  /** true = l'élève continue et reçoit une inscription dans l'année suivante. */
  continueEcole: boolean;
  statutEleve: StatutEleve;
  dateSortie: string | null;
};

export async function cloturerAnnee(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (session.role !== "directeur") {
    return { error: "Seul le directeur peut clôturer une année scolaire." };
  }

  const annee = texte(donnees, "annee");
  if (!estAnneeScolaire(annee)) return { error: "Année scolaire invalide." };

  const apercu = await apercuCloture(session.ecoleId, annee);
  if (apercu.statut === "ABSENTE") {
    return { error: "Cette année scolaire n'existe pas dans votre école." };
  }
  if (apercu.statut === "CLOTUREE") {
    return { error: "Cette année scolaire est déjà clôturée." };
  }
  if (apercu.bloquants.length > 0) {
    return { error: apercu.bloquants[0] };
  }
  if (apercu.eleves.length === 0) {
    return { error: "Aucun élève n'est inscrit sur cette année." };
  }

  // Les classes d'examen exigent une décision explicite du directeur.
  const decisionsExamen = new Map<string, "ADMIS" | "ECHOUE">();
  for (const eleve of apercu.eleves) {
    if (eleve.decision_auto !== "EXAMEN") continue;
    const choix = texte(donnees, `decision_${eleve.eleve_id}`);
    if (choix !== "ADMIS" && choix !== "ECHOUE") {
      return {
        error: `Indiquez la décision d'examen pour ${eleve.prenom} ${eleve.nom} (admis ou échoué).`,
      };
    }
    decisionsExamen.set(eleve.eleve_id, choix);
  }

  const suivante = anneeSuivante(annee);
  const dateCloture = aujourdhui();
  const mouvements: Mouvement[] = [];

  for (const eleve of apercu.eleves) {
    // Élève déjà sorti : on ne le réinscrit pas, son archive reste complète.
    if (
      eleve.statut_eleve === "transfere" ||
      eleve.statut_eleve === "diplome" ||
      eleve.statut_eleve === "inactif"
    ) {
      const statut: StatutInscription =
        eleve.statut_eleve === "transfere"
          ? "TRANSFERE"
          : eleve.statut_eleve === "diplome"
            ? "DIPLOME"
            : "INACTIF";
      const decision: DecisionFinAnnee =
        eleve.statut_eleve === "transfere"
          ? "TRANSFERE"
          : eleve.statut_eleve === "diplome"
            ? "DIPLOME"
            : "INACTIF";
      mouvements.push({
        eleveId: eleve.eleve_id,
        inscriptionStatut: statut,
        decision,
        classeSuivante: null,
        continueEcole: false,
        statutEleve: eleve.statut_eleve,
        dateSortie: null,
      });
      continue;
    }

    if (eleve.type_fin === "EXAMEN") {
      const choix = decisionsExamen.get(eleve.eleve_id);
      if (choix === "ECHOUE") {
        mouvements.push({
          eleveId: eleve.eleve_id,
          inscriptionStatut: "REDOUBLANT",
          decision: "ECHOUE",
          classeSuivante: eleve.classe_id,
          continueEcole: true,
          statutEleve: "actif",
          dateSortie: null,
        });
      } else if (eleve.classe_suivante_id) {
        mouvements.push({
          eleveId: eleve.eleve_id,
          inscriptionStatut: "PROMU",
          decision: "ADMIS",
          classeSuivante: eleve.classe_suivante_id,
          continueEcole: true,
          statutEleve: "actif",
          dateSortie: null,
        });
      } else {
        mouvements.push({
          eleveId: eleve.eleve_id,
          inscriptionStatut: "DIPLOME",
          decision: "ADMIS",
          classeSuivante: null,
          continueEcole: false,
          statutEleve: "diplome",
          dateSortie: dateCloture,
        });
      }
      continue;
    }

    const passe =
      eleve.moyenne_annuelle !== null && eleve.moyenne_annuelle >= 10;

    if (!passe) {
      mouvements.push({
        eleveId: eleve.eleve_id,
        inscriptionStatut: "REDOUBLANT",
        decision: "REDOUBLE",
        classeSuivante: eleve.classe_id,
        continueEcole: true,
        statutEleve: "actif",
        dateSortie: null,
      });
      continue;
    }

    if (eleve.classe_suivante_id) {
      mouvements.push({
        eleveId: eleve.eleve_id,
        inscriptionStatut: "PROMU",
        decision: "PASSE",
        classeSuivante: eleve.classe_suivante_id,
        continueEcole: true,
        statutEleve: "actif",
        dateSortie: null,
      });
    } else {
      // Réussite dans la dernière classe du cycle : l'élève est diplômé.
      mouvements.push({
        eleveId: eleve.eleve_id,
        inscriptionStatut: "DIPLOME",
        decision: "DIPLOME",
        classeSuivante: null,
        continueEcole: false,
        statutEleve: "diplome",
        dateSortie: dateCloture,
      });
    }
  }

  const moyennes = new Map(
    apercu.eleves.map((eleve) => [eleve.eleve_id, eleve.moyenne_annuelle]),
  );
  const bornes = bornesAnnee(suivante);

  try {
    await transaction(async (client) => {
      // L'année suivante devient l'année de travail de l'école.
      await client.query(
        `insert into annees_scolaires
           (ecole_id, libelle, date_debut, date_fin, statut)
         values ($1, $2, $3::date, $4::date, 'OUVERTE')
         on conflict (ecole_id, libelle) do update
           set statut = 'OUVERTE'`,
        [session.ecoleId, suivante, bornes.debut, bornes.fin],
      );

      // Les inscriptions de l'année close gardent la décision et la moyenne.
      for (const mouvement of mouvements) {
        await client.query(
          `update inscriptions
              set statut = $1,
                  decision = $2,
                  moyenne_annuelle = coalesce(moyenne_annuelle, $3),
                  date_sortie = coalesce($4::date, date_sortie)
            where ecole_id = $5 and eleve_id = $6 and annee_scolaire = $7`,
          [
            mouvement.inscriptionStatut,
            mouvement.decision,
            moyennes.get(mouvement.eleveId) ?? null,
            mouvement.dateSortie,
            session.ecoleId,
            mouvement.eleveId,
            annee,
          ],
        );

        if (mouvement.continueEcole && mouvement.classeSuivante) {
          await client.query(
            `update eleves
                set classe_id = $1,
                    annee_scolaire = $2,
                    type_inscription = 'ANCIEN',
                    statut = 'actif',
                    date_sortie = null,
                    ecole_destination = null
              where id = $3 and ecole_id = $4`,
            [mouvement.classeSuivante, suivante, mouvement.eleveId, session.ecoleId],
          );
          // Le trigger ne se déclenche pas sur un redoublement à classe
          // identique : on régénère explicitement les frais de la nouvelle année.
          await client.query(`select ajuster_frais_eleve($1)`, [
            mouvement.eleveId,
          ]);
        } else if (mouvement.statutEleve === "diplome") {
          await client.query(
            `update eleves
                set statut = 'diplome',
                    date_sortie = coalesce($1::date, current_date)
              where id = $2 and ecole_id = $3`,
            [mouvement.dateSortie, mouvement.eleveId, session.ecoleId],
          );
        }
      }

      await client.query(
        `update annees_scolaires
            set statut = 'CLOTUREE',
                cloturee_le = now(),
                cloturee_par = $1
          where ecole_id = $2 and libelle = $3`,
        [session.userId, session.ecoleId, annee],
      );
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  const promus = mouvements.filter((m) => m.inscriptionStatut === "PROMU").length;
  const redoublants = mouvements.filter(
    (m) => m.inscriptionStatut === "REDOUBLANT",
  ).length;
  const diplomes = mouvements.filter(
    (m) => m.inscriptionStatut === "DIPLOME",
  ).length;

  await journaliser({
    action: "ANNEE_CLOTUREE",
    libelle: `Année ${annee} clôturée : ${promus} promu(s), ${redoublants} redoublant(s), ${diplomes} diplômé(s).`,
    auteur: session.email ?? session.identifiant ?? session.userId,
    cible: annee,
    details: { ecole: session.ecole.nom, suivante, promus, redoublants, diplomes },
  });

  rafraichirAnnee();
  revalidatePath(`/app/archive/${annee}`);

  return {
    success: `Année ${annee} clôturée. ${promus} élève${promus > 1 ? "s passent" : " passe"}, ${redoublants} redouble${redoublants > 1 ? "nt" : ""}, ${diplomes} diplômé${diplomes > 1 ? "s" : ""}. L'année ${suivante} est maintenant ouverte.`,
  };
}

// ---------------------------------------------------------------------------
//  Transfert d'un élève vers une autre école
// ---------------------------------------------------------------------------

export async function transfererEleve(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!peutGererEleves(session.role)) {
    return { error: "Vous n'êtes pas autorisé à transférer un élève." };
  }

  const id = texte(donnees, "id");
  const destination = texte(donnees, "ecole_destination");
  const dateSortie = texte(donnees, "date_sortie") || aujourdhui();

  if (!estUuid(id)) return { error: "Élève introuvable." };
  if (destination.length < 2) {
    return { error: "Indiquez le nom de la nouvelle école." };
  }
  if (destination.length > 160) {
    return { error: "Le nom de l'école de destination est trop long." };
  }
  if (!dateValide(dateSortie)) {
    return { error: "Indiquez une date de départ valide." };
  }

  const eleve = await uneLigne<{
    id: string;
    nom: string;
    prenom: string;
    statut: StatutEleve;
    annee_scolaire: string;
  }>(
    `select id, nom, prenom, statut, annee_scolaire
       from eleves
      where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!eleve) return { error: "Élève introuvable." };
  if (eleve.statut === "transfere") {
    return { error: "Cet élève est déjà transféré." };
  }
  if (eleve.statut === "diplome") {
    return { error: "Cet élève est diplômé : son parcours est déjà clôturé." };
  }

  try {
    await transaction(async (client) => {
      await client.query(
        `update eleves
            set statut = 'transfere',
                date_sortie = $1::date,
                ecole_destination = $2
          where id = $3 and ecole_id = $4`,
        [dateSortie, destination, id, session.ecoleId],
      );
      // La décision annuelle est explicite : l'archive montrera le motif.
      await client.query(
        `update inscriptions
            set statut = 'TRANSFERE',
                decision = 'TRANSFERE',
                date_sortie = $1::date,
                ecole_destination = $2
          where eleve_id = $3 and ecole_id = $4
            and annee_scolaire = $5`,
        [dateSortie, destination, id, session.ecoleId, eleve.annee_scolaire],
      );
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  await journaliser({
    action: "ELEVE_TRANSFERE",
    libelle: `Élève transféré : ${eleve.prenom} ${eleve.nom} vers ${destination}.`,
    auteur: session.email ?? session.identifiant ?? session.userId,
    cible: `${eleve.prenom} ${eleve.nom}`,
    cibleId: id,
    details: {
      ecole: session.ecole.nom,
      destination,
      date_sortie: dateSortie,
    },
  });

  rafraichirAnnee();
  revalidatePath(`/app/eleves/${id}`);

  return {
    success: `Le transfert de ${eleve.prenom} ${eleve.nom} est enregistré. Ses données restent conservées et consultables dans l'archive.`,
  };
}

// ---------------------------------------------------------------------------
//  Absences
// ---------------------------------------------------------------------------

export async function enregistrerAbsence(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!peutGererEleves(session.role)) {
    return { error: "Vous n'êtes pas autorisé à saisir une absence." };
  }

  const eleveId = texte(donnees, "eleve_id");
  const dateSaisie = texte(donnees, "date_absence") || aujourdhui();
  const motif = texte(donnees, "motif").slice(0, 300);
  const justifiee = texte(donnees, "justifiee") === "1";

  if (!estUuid(eleveId)) return { error: "Élève introuvable." };
  if (!dateValide(dateSaisie)) return { error: "Date d'absence invalide." };

  const eleve = await uneLigne<{ id: string; annee_scolaire: string; statut: string }>(
    `select id, annee_scolaire, statut
       from eleves
      where id = $1 and ecole_id = $2`,
    [eleveId, session.ecoleId],
  );
  if (!eleve) return { error: "Élève introuvable." };
  if (eleve.statut !== "actif") {
    return { error: "Cet élève n'est plus actif : impossible d'ajouter une absence." };
  }

  const trimestre = trimestreDeDate(new Date(`${dateSaisie}T12:00:00`));

  try {
    await sql(
      `insert into absences
         (ecole_id, eleve_id, annee_scolaire, trimestre, date_absence,
          motif, justifiee, enregistre_par)
       values ($1, $2, $3, $4, $5::date, $6, $7, $8)`,
      [
        session.ecoleId,
        eleveId,
        eleve.annee_scolaire,
        trimestre,
        dateSaisie,
        motif || null,
        justifiee,
        session.userId,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath(`/app/eleves/${eleveId}`);
  revalidatePath("/app/archive");
  return { success: "Absence enregistrée." };
}

export async function supprimerAbsence(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!peutGererEleves(session.role)) {
    return { error: "Vous n'êtes pas autorisé à corriger une absence." };
  }

  const id = texte(donnees, "id");
  const eleveId = texte(donnees, "eleve_id");
  if (!estUuid(id)) return { error: "Absence introuvable." };

  const lignes = await sql<{ id: string }>(
    `delete from absences
      where id = $1 and ecole_id = $2
      returning id`,
    [id, session.ecoleId],
  );
  if (lignes.length === 0) return { error: "Absence introuvable." };

  if (estUuid(eleveId)) revalidatePath(`/app/eleves/${eleveId}`);
  revalidatePath("/app/archive");
  return { success: "Absence supprimée." };
}

// ---------------------------------------------------------------------------
//  Rapports (tous les plans)
// ---------------------------------------------------------------------------

export async function demanderRapport(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!["directeur", "secretaire", "comptable"].includes(session.role)) {
    return { error: "Vous n'êtes pas autorisé à générer un rapport." };
  }

  const annee = texte(donnees, "annee");
  const typeSaisi = texte(donnees, "type");
  const trimestreSaisi = Number.parseInt(texte(donnees, "trimestre"), 10);

  if (!estAnneeScolaire(annee)) return { error: "Année scolaire invalide." };
  if (typeSaisi !== "TRIMESTRIEL" && typeSaisi !== "ANNUEL") {
    return { error: "Type de rapport invalide." };
  }
  if (
    typeSaisi === "TRIMESTRIEL" &&
    ![1, 2, 3].includes(trimestreSaisi)
  ) {
    return { error: "Choisissez un trimestre." };
  }

  const type = typeSaisi as "TRIMESTRIEL" | "ANNUEL";
  const trimestre = type === "ANNUEL" ? 0 : trimestreSaisi;

  const rapport = await uneLigne<{ id: string }>(
    `insert into rapports
       (ecole_id, annee_scolaire, type, trimestre, statut, demande_par)
     values ($1, $2, $3, $4, 'EN_ATTENTE', $5)
     on conflict (ecole_id, annee_scolaire, type, trimestre) do update
       set statut = 'EN_ATTENTE',
           contenu = null,
           erreur = null,
           demande_par = excluded.demande_par,
           date_generation = null,
           updated_at = now()
     returning id`,
    [session.ecoleId, annee, type, trimestre, session.userId],
  );
  if (!rapport) return { error: "Impossible de préparer le rapport." };

  await empilerTache({
    ecoleId: session.ecoleId,
    type: "RAPPORT",
    charge: { rapport_id: rapport.id },
  });

  // Traitement immédiat par petits lots, sans faire attendre la réponse.
  after(async () => {
    try {
      await viderFile({ limite: 3, secondesMax: 20 });
    } catch (erreur) {
      console.error(
        "[rapport] traitement immédiat impossible :",
        (erreur as Error).message.slice(0, 200),
      );
    }
  });

  const libelle =
    type === "ANNUEL"
      ? `le rapport annuel ${annee}`
      : `le rapport du ${trimestre}e trimestre ${annee}`;

  await journaliser({
    action: "RAPPORT_DEMANDE",
    libelle: `Rapport demandé : ${libelle}.`,
    auteur: session.email ?? session.identifiant ?? session.userId,
    cible: annee,
    details: { ecole: session.ecole.nom, type, trimestre },
  });

  revalidatePath("/app/rapports");
  return {
    success: `Le rapport est en préparation. Il sera téléchargeable dans quelques instants.`,
  };
}
