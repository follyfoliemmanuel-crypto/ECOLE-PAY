"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { getSession } from "../auth";
import { sql, transaction, uneLigne } from "../db";
import { anneeScolaire } from "../mois";
import { peut } from "../offres";
import { messageVerrou, moyenneEvaluations } from "../saisies";
import type {
  ResultatAction,
  Session,
  StatutSaisie,
  Trimestre,
} from "../types";
import { estUuid, messageErreurBdd, texte } from "./helpers";

// ---------------------------------------------------------------------------
//  Accès
// ---------------------------------------------------------------------------

type AccesProf = { session: Session; profId: string } | { error: string };

async function accesProf(): Promise<AccesProf> {
  const session = await getSession();
  if (!session || session.role !== "prof" || !session.profId) {
    return { error: "Votre session a expiré. Reconnectez-vous." };
  }
  if (!peut(session.ecole, "saisie_notes_prof")) {
    return {
      error:
        "Cette fonctionnalité est réservée à l'offre PREMIUM 40.000F. Contactez le directeur.",
    };
  }
  return { session, profId: session.profId };
}

type AccesDirecteur = { session: Session } | { error: string };

async function accesDirecteur(): Promise<AccesDirecteur> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  if (session.role !== "directeur") {
    return { error: "Seul le directeur peut valider ou libérer les notes." };
  }
  if (!peut(session.ecole, "validation_notes")) {
    return {
      error:
        "Cette fonctionnalité est réservée à l'offre PREMIUM 40.000F. Passez à PREMIUM pour valider les notes des professeurs.",
    };
  }
  return { session };
}

function lireTrimestre(brut: string): Trimestre | null {
  const valeur = Number.parseInt(brut, 10);
  return valeur === 1 || valeur === 2 || valeur === 3 ? valeur : null;
}

function rafraichirSaisies() {
  revalidatePath("/prof");
  revalidatePath("/prof/saisie/[id]", "page");
  revalidatePath("/app");
  revalidatePath("/app/notes");
  revalidatePath("/app/notes/validation");
  revalidatePath("/app/notes/validation/[id]", "page");
  revalidatePath("/app/profs");
}

type SaisieVerrou = {
  id: string;
  ecole_id: string;
  annee_scolaire: string;
  trimestre: Trimestre;
  classe_id: string;
  classe_nom: string;
  matiere_id: string;
  matiere_nom: string;
  prof_id: string | null;
  statut: StatutSaisie;
};

async function lireSaisie(
  ecoleId: string,
  saisieId: string,
): Promise<SaisieVerrou | null> {
  return uneLigne<SaisieVerrou>(
    `select s.id, s.ecole_id, s.annee_scolaire, s.trimestre,
            s.classe_id, c.nom as classe_nom,
            s.matiere_id, m.nom as matiere_nom,
            s.prof_id, s.statut
       from saisies_notes s
       join classes c on c.id = s.classe_id
       join matieres m on m.id = s.matiere_id
      where s.id = $1 and s.ecole_id = $2`,
    [saisieId, ecoleId],
  );
}

// ---------------------------------------------------------------------------
//  Professeur : choisir Classe + Matière et verrouiller la combinaison
// ---------------------------------------------------------------------------

export async function demarrerSaisie(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProf();
  if ("error" in acces) return { error: acces.error };
  const { session, profId } = acces;

  const classeId = texte(donnees, "classe_id");
  const matiereId = texte(donnees, "matiere_id");
  const trimestre = lireTrimestre(texte(donnees, "trimestre"));

  if (!estUuid(classeId) || !estUuid(matiereId) || !trimestre) {
    return { error: "Choisissez une classe, une matière et un trimestre." };
  }

  // L'année scolaire n'est jamais lue depuis le navigateur.
  const annee = anneeScolaire();

  const [classe, matiere] = await Promise.all([
    uneLigne<{ id: string; nom: string; nb_eleves: number }>(
      `select c.id, c.nom,
              (select count(*)::int
                 from eleves e
                where e.classe_id = c.id
                  and e.ecole_id = c.ecole_id
                  and e.annee_scolaire = $2
                  and e.statut = 'actif') as nb_eleves
         from classes c
        where c.id = $1 and c.ecole_id = $3`,
      [classeId, annee, session.ecoleId],
    ),
    uneLigne<{ id: string }>(
      `select id from matieres where id = $1 and ecole_id = $2`,
      [matiereId, session.ecoleId],
    ),
  ]);

  if (!classe || !matiere) {
    return { error: "Classe ou matière introuvable dans votre école." };
  }
  if (classe.nb_eleves === 0) {
    return {
      error: `La classe ${classe.nom} n'a aucun élève actif cette année.`,
    };
  }

  let nouvelId: string | null = null;

  try {
    const cree = await sql<{ id: string }>(
      `insert into saisies_notes
         (ecole_id, annee_scolaire, trimestre, classe_id, matiere_id,
          prof_id, statut)
       values ($1, $2, $3, $4, $5, $6, 'EN_COURS')
       on conflict do nothing
       returning id`,
      [session.ecoleId, annee, trimestre, classeId, matiereId, profId],
    );
    nouvelId = cree[0]?.id ?? null;
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  if (nouvelId) {
    rafraichirSaisies();
    redirect(`/prof/saisie/${nouvelId}`);
  }

  // La combinaison est déjà verrouillée : on dit qui la traite.
  const verrou = await uneLigne<{
    id: string;
    statut: StatutSaisie;
    prof_id: string | null;
    prenom: string | null;
    nom: string | null;
  }>(
    `select s.id, s.statut, s.prof_id, p.prenom, p.nom
       from saisies_notes s
       left join profs p on p.id = s.prof_id
      where s.ecole_id = $1
        and s.annee_scolaire = $2
        and s.trimestre = $3
        and s.classe_id = $4
        and s.matiere_id = $5
        and s.statut in ('EN_COURS', 'ENVOYE', 'VALIDE')
      limit 1`,
    [
      session.ecoleId,
      annee,
      trimestre,
      classeId,
      matiereId,
    ],
  );

  if (!verrou) {
    return {
      error: "Impossible de verrouiller cette combinaison. Réessayez dans un instant.",
    };
  }

  // C'est sa propre saisie : on le ramène directement dessus.
  if (verrou.prof_id === profId) {
    redirect(`/prof/saisie/${verrou.id}`);
  }

  return { error: messageVerrou(verrou.prenom, verrou.nom, verrou.statut) };
}

// ---------------------------------------------------------------------------
//  Lecture et validation des valeurs envoyées par le tableau de saisie
// ---------------------------------------------------------------------------

type NoteLue = number | null;

function lireNote(brut: unknown): NoteLue | "invalide" {
  if (brut === null || brut === undefined) return null;
  const valeur = String(brut).trim().replace(",", ".");
  if (valeur === "") return null;
  const nombre = Number.parseFloat(valeur);
  if (!Number.isFinite(nombre) || nombre < 0 || nombre > 20) return "invalide";
  return Math.round(nombre * 100) / 100;
}

type LigneNote = {
  eleveId: string;
  devoir1: number | null;
  devoir2: number | null;
  composition: number | null;
  note: number | null;
};

/**
 * Lit le JSON envoyé par le tableau de saisie :
 * { "eleveId": { devoir1: "12,5", devoir2: "", composition: "14" } }
 */
function lireGrille(
  brut: string,
  elevesValides: Set<string>,
): { error: string } | { lignes: LigneNote[] } {
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut || "{}");
  } catch {
    return { error: "Le tableau est illisible. Rechargez la page." };
  }
  if (typeof donnees !== "object" || donnees === null || Array.isArray(donnees)) {
    return { error: "Le tableau de notes est invalide." };
  }

  const entrees = Object.entries(donnees as Record<string, unknown>);
  if (entrees.length > 2000) {
    return { error: "Le tableau contient trop d'élèves d'un seul coup." };
  }

  const lignes: LigneNote[] = [];

  for (const [eleveId, valeur] of entrees) {
    if (!estUuid(eleveId) || !elevesValides.has(eleveId)) continue;
    if (typeof valeur !== "object" || valeur === null) continue;

    const champs = valeur as Record<string, unknown>;
    const devoir1 = lireNote(champs.devoir1);
    const devoir2 = lireNote(champs.devoir2);
    const composition = lireNote(champs.composition);

    if (
      devoir1 === "invalide" ||
      devoir2 === "invalide" ||
      composition === "invalide"
    ) {
      return {
        error:
          "Chaque note doit être un nombre entre 0 et 20. Corrigez la cellule signalée puis réessayez.",
      };
    }

    lignes.push({
      eleveId,
      devoir1,
      devoir2,
      composition,
      note: moyenneEvaluations(devoir1, devoir2, composition),
    });
  }

  return { lignes };
}

/** Écrit les notes d'une combinaison (brouillon ou correction). */
async function ecrireNotes(
  client: PoolClient,
  ecoleId: string,
  annee: string,
  saisie: SaisieVerrou,
  lignes: LigneNote[],
): Promise<number> {
  let enregistrees = 0;

  for (const ligne of lignes) {
    if (ligne.note === null) {
      await client.query(
        `delete from notes
          where ecole_id = $1 and eleve_id = $2 and matiere_id = $3
            and annee_scolaire = $4 and trimestre = $5`,
        [
          ecoleId,
          ligne.eleveId,
          saisie.matiere_id,
          annee,
          saisie.trimestre,
        ],
      );
      continue;
    }

    await client.query(
      `insert into notes
         (ecole_id, eleve_id, matiere_id, annee_scolaire, trimestre, note,
          devoir1, devoir2, composition)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (eleve_id, matiere_id, annee_scolaire, trimestre)
       do update set note = excluded.note,
                     devoir1 = excluded.devoir1,
                     devoir2 = excluded.devoir2,
                     composition = excluded.composition,
                     updated_at = now()`,
      [
        ecoleId,
        ligne.eleveId,
        saisie.matiere_id,
        annee,
        saisie.trimestre,
        ligne.note,
        ligne.devoir1,
        ligne.devoir2,
        ligne.composition,
      ],
    );
    enregistrees += 1;
  }

  return enregistrees;
}

async function elevesDeClasse(
  ecoleId: string,
  annee: string,
  classeId: string,
): Promise<Set<string>> {
  const eleves = await sql<{ id: string }>(
    `select id from eleves
      where ecole_id = $1 and annee_scolaire = $2
        and classe_id = $3 and statut = 'actif'`,
    [ecoleId, annee, classeId],
  );
  return new Set(eleves.map((eleve) => eleve.id));
}

// ---------------------------------------------------------------------------
//  Professeur : brouillon / envoi au directeur
// ---------------------------------------------------------------------------

export async function enregistrerSaisieNotes(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesProf();
  if ("error" in acces) return { error: acces.error };
  const { session, profId } = acces;

  const saisieId = texte(donnees, "saisie_id");
  const intention = texte(donnees, "intention") === "envoyer"
    ? "envoyer"
    : "brouillon";

  if (!estUuid(saisieId)) return { error: "Saisie introuvable." };

  const saisie = await lireSaisie(session.ecoleId, saisieId);
  if (!saisie) return { error: "Saisie introuvable." };
  if (saisie.prof_id !== profId) {
    return { error: "Cette combinaison est traitée par un autre professeur." };
  }
  if (saisie.statut !== "EN_COURS") {
    return {
      error:
        "Ces notes ont déjà été envoyées. Le directeur doit libérer la combinaison pour les corriger.",
    };
  }

  const eleves = await elevesDeClasse(
    session.ecoleId,
    saisie.annee_scolaire,
    saisie.classe_id,
  );
  const lecture = lireGrille(texte(donnees, "notes"), eleves);
  if ("error" in lecture) return { error: lecture.error };

  if (intention === "envoyer") {
    const notes = lecture.lignes.filter((ligne) => ligne.note !== null);
    if (notes.length === 0) {
      return {
        error:
          "Saisissez au moins une note avant d'envoyer le travail au directeur.",
      };
    }
  }

  try {
    const resultat = await transaction(async (client) => {
      const enregistrees = await ecrireNotes(
        client,
        session.ecoleId,
        saisie.annee_scolaire,
        saisie,
        lecture.lignes,
      );

      if (intention === "envoyer") {
        const envoye = await client.query<{ id: string }>(
          `update saisies_notes
              set statut = 'ENVOYE', envoye_le = now()
            where id = $1 and ecole_id = $2 and statut = 'EN_COURS'
            returning id`,
          [saisieId, session.ecoleId],
        );
        if (envoye.rowCount === 0) {
          throw new Error("SAISIE_DEJA_ENVOYEE");
        }
      }

      return enregistrees;
    });

    rafraichirSaisies();

    if (intention === "envoyer") {
      return {
        success:
          "Notes envoyées au directeur. Elles seront visibles par les parents après sa validation.",
      };
    }

    return {
      success:
        resultat > 0
          ? `Brouillon enregistré : ${resultat} élève${resultat > 1 ? "s" : ""} noté${resultat > 1 ? "s" : ""}.`
          : "Brouillon enregistré. Aucune note saisie pour l'instant.",
    };
  } catch (erreur) {
    if (erreur instanceof Error && erreur.message === "SAISIE_DEJA_ENVOYEE") {
      return { error: "Ces notes viennent d'être envoyées au directeur." };
    }
    return { error: messageErreurBdd(erreur) };
  }
}

// ---------------------------------------------------------------------------
//  Directeur : correction, validation, libération
// ---------------------------------------------------------------------------

export async function corrigerNotesDirecteur(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesDirecteur();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  const saisieId = texte(donnees, "saisie_id");
  if (!estUuid(saisieId)) return { error: "Saisie introuvable." };

  const saisie = await lireSaisie(session.ecoleId, saisieId);
  if (!saisie) return { error: "Saisie introuvable." };
  if (saisie.statut !== "ENVOYE" && saisie.statut !== "VALIDE") {
    return {
      error:
        "Cette saisie n'est pas encore envoyée par le professeur : rien à corriger.",
    };
  }

  const eleves = await elevesDeClasse(
    session.ecoleId,
    saisie.annee_scolaire,
    saisie.classe_id,
  );
  const lecture = lireGrille(texte(donnees, "notes"), eleves);
  if ("error" in lecture) return { error: lecture.error };

  try {
    const enregistrees = await transaction((client) =>
      ecrireNotes(
        client,
        session.ecoleId,
        saisie.annee_scolaire,
        saisie,
        lecture.lignes,
      ),
    );

    rafraichirSaisies();
    return {
      success:
        saisie.statut === "VALIDE"
          ? `Correction enregistrée (${enregistrees} note${enregistrees > 1 ? "s" : ""}). Les parents voient déjà la version corrigée.`
          : `Correction enregistrée (${enregistrees} note${enregistrees > 1 ? "s" : ""}). Vous pouvez maintenant valider et publier.`,
    };
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }
}

export async function validerEtPublier(
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesDirecteur();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  const saisieId = texte(donnees, "saisie_id");
  if (!estUuid(saisieId)) return { error: "Saisie introuvable." };

  const saisie = await lireSaisie(session.ecoleId, saisieId);
  if (!saisie) return { error: "Saisie introuvable." };
  if (saisie.statut === "VALIDE") {
    return { success: "Ces notes sont déjà validées et publiées." };
  }
  if (saisie.statut !== "ENVOYE") {
    return {
      error:
        "Seule une saisie envoyée par le professeur peut être validée et publiée.",
    };
  }

  const compteur = await uneLigne<{ total: number }>(
    `select count(*)::int as total
       from notes n
       join eleves e on e.id = n.eleve_id
      where n.ecole_id = $1
        and n.annee_scolaire = $2
        and n.trimestre = $3
        and n.matiere_id = $4
        and e.classe_id = $5`,
    [
      session.ecoleId,
      saisie.annee_scolaire,
      saisie.trimestre,
      saisie.matiere_id,
      saisie.classe_id,
    ],
  );

  if ((compteur?.total ?? 0) === 0) {
    return {
      error:
        "Aucune note enregistrée pour cette combinaison : demandez au professeur de ressaisir son tableau.",
    };
  }

  const valide = await sql<{ id: string }>(
    `update saisies_notes
        set statut = 'VALIDE', valide_le = now(), valide_par = $1
      where id = $2 and ecole_id = $3 and statut = 'ENVOYE'
      returning id`,
    [session.userId, saisieId, session.ecoleId],
  );

  if (valide.length === 0) {
    return { error: "Cette saisie a changé entre-temps. Rechargez la page." };
  }

  rafraichirSaisies();
  return {
    success: `${saisie.classe_nom} · ${saisie.matiere_nom} : notes validées et publiées sur le portail parent.`,
  };
}

export async function libererSaisie(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesDirecteur();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  const saisieId = texte(donnees, "saisie_id");
  const motif = texte(donnees, "motif").slice(0, 300);
  if (!estUuid(saisieId)) return { error: "Saisie introuvable." };

  const saisie = await lireSaisie(session.ecoleId, saisieId);
  if (!saisie) return { error: "Saisie introuvable." };
  if (saisie.statut === "LIBERE") {
    return { success: "Cette combinaison est déjà libre." };
  }

  const libere = await sql<{ id: string }>(
    `update saisies_notes
        set statut = 'LIBERE', libere_le = now(), libere_par = $1,
            motif_liberation = $2
      where id = $3 and ecole_id = $4
      returning id`,
    [session.userId, motif || null, saisieId, session.ecoleId],
  );

  if (libere.length === 0) return { error: "Saisie introuvable." };

  rafraichirSaisies();
  return {
    success: `${saisie.classe_nom} · ${saisie.matiere_nom} libérée. Un autre professeur peut reprendre la combinaison.`,
  };
}

/** Date limite de dépôt : « Notes à envoyer avant le 20 ». */
export async function definirEcheanceNotes(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesDirecteur();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  const annee = anneeScolaire();
  const trimestre = lireTrimestre(texte(donnees, "trimestre"));
  const dateLimite = texte(donnees, "date_limite");

  if (!trimestre) return { error: "Trimestre invalide." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLimite)) {
    return { error: "Indiquez une date limite valide." };
  }

  try {
    await sql(
      `insert into notes_echeances
         (ecole_id, annee_scolaire, trimestre, date_limite, updated_at)
       values ($1, $2, $3, $4::date, now())
       on conflict (ecole_id, annee_scolaire, trimestre)
       do update set date_limite = excluded.date_limite, updated_at = now()`,
      [session.ecoleId, annee, trimestre, dateLimite],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirSaisies();
  return { success: "Date limite de dépôt des notes enregistrée." };
}
