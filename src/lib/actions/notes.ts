"use server";

import { revalidatePath } from "next/cache";
import { getSession, refusEcriture } from "../auth";
import { sql, transaction, uneLigne } from "../db";
import { peut } from "../offres";
import type { ResultatAction, Session, Trimestre } from "../types";
import { estUuid, messageErreurBdd, texte } from "./helpers";

type Acces = { session: Session } | { error: string };

async function accesNotes(): Promise<Acces> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };
  if (!peut(session.ecole, "notes_bulletins")) {
    return {
      error:
        "Les notes et bulletins ne sont pas disponibles avec l'offre actuelle de votre école.",
    };
  }
  return { session };
}

function estDirecteur(role: string): boolean {
  return role === "directeur";
}

function lireTrimestre(brut: string): Trimestre | null {
  const valeur = Number.parseInt(brut, 10);
  return valeur === 1 || valeur === 2 || valeur === 3 ? valeur : null;
}

function rafraichirNotes() {
  revalidatePath("/app/notes");
  revalidatePath("/app/notes/saisie");
  revalidatePath("/app/notes/bulletins");
}

export async function creerMatiere(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesNotes();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut ajouter une matière." };
  }

  const nom = texte(donnees, "nom").slice(0, 80);
  const coefficient = Number.parseInt(texte(donnees, "coefficient") || "1", 10);

  if (nom.length < 1) return { error: "Indiquez le nom de la matière." };
  if (!Number.isFinite(coefficient) || coefficient < 1 || coefficient > 20) {
    return { error: "Le coefficient doit être compris entre 1 et 20." };
  }

  try {
    await sql(
      `insert into matieres (ecole_id, nom, coefficient, ordre)
       values ($1, $2, $3,
               coalesce((select max(ordre) + 1 from matieres where ecole_id = $1), 0))`,
      [session.ecoleId, nom, coefficient],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirNotes();
  return { success: `La matière ${nom} a été ajoutée.` };
}

export async function modifierMatiere(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesNotes();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut modifier une matière." };
  }

  const id = texte(donnees, "id");
  const nom = texte(donnees, "nom").slice(0, 80);
  const coefficient = Number.parseInt(texte(donnees, "coefficient") || "1", 10);

  if (!estUuid(id)) return { error: "Matière introuvable." };
  if (nom.length < 1) return { error: "Indiquez le nom de la matière." };
  if (!Number.isFinite(coefficient) || coefficient < 1 || coefficient > 20) {
    return { error: "Le coefficient doit être compris entre 1 et 20." };
  }

  try {
    const modifiee = await sql<{ id: string }>(
      `update matieres
          set nom = $1, coefficient = $2
        where id = $3 and ecole_id = $4
        returning id`,
      [nom, coefficient, id, session.ecoleId],
    );
    if (modifiee.length === 0) return { error: "Matière introuvable." };
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirNotes();
  return { success: "Matière mise à jour. Les moyennes sont recalculées automatiquement." };
}

export async function supprimerMatiere(
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesNotes();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  if (!estDirecteur(session.role)) {
    return { error: "Seul le directeur peut supprimer une matière." };
  }

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Matière introuvable." };

  const compteur = await uneLigne<{ notes: number }>(
    `select count(*)::int as notes
       from notes
      where matiere_id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );

  const supprimee = await sql<{ nom: string }>(
    `delete from matieres
      where id = $1 and ecole_id = $2
      returning nom`,
    [id, session.ecoleId],
  );
  if (supprimee.length === 0) return { error: "Matière introuvable." };

  rafraichirNotes();
  return {
    success:
      (compteur?.notes ?? 0) > 0
        ? `Matière ${supprimee[0].nom} supprimée avec ${compteur?.notes} note(s).`
        : `Matière ${supprimee[0].nom} supprimée.`,
  };
}

/**
 * Enregistre une grille complète. Le champ `notes` contient un JSON
 * { "eleveId:matiereId": "12,5" }. Une valeur vide supprime la note.
 */
export async function enregistrerNotes(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const acces = await accesNotes();
  if ("error" in acces) return { error: acces.error };
  const { session } = acces;

  const classeId = texte(donnees, "classe_id");
  const trimestre = lireTrimestre(texte(donnees, "trimestre"));
  if (!estUuid(classeId) || !trimestre) {
    return { error: "Classe ou trimestre invalide." };
  }

  const classe = await uneLigne<{ id: string; nom: string }>(
    `select id, nom from classes where id = $1 and ecole_id = $2`,
    [classeId, session.ecoleId],
  );
  if (!classe) return { error: "Classe introuvable." };

  let brut: unknown;
  try {
    brut = JSON.parse(texte(donnees, "notes") || "{}");
  } catch {
    return { error: "La grille de notes est illisible. Rechargez la page." };
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { error: "La grille de notes est invalide." };
  }

  const entrees = Object.entries(brut as Record<string, unknown>);
  if (entrees.length > 5000) {
    return { error: "La grille contient trop de notes d'un seul coup." };
  }

  const annee = texte(donnees, "annee");
  if (!/^\d{4}-\d{4}$/.test(annee)) {
    return { error: "Année scolaire invalide." };
  }

  const [eleves, matieres] = await Promise.all([
    sql<{ id: string }>(
      `select id from eleves
        where ecole_id = $1 and annee_scolaire = $2
          and classe_id = $3 and statut = 'actif'`,
      [session.ecoleId, annee, classeId],
    ),
    sql<{ id: string }>(`select id from matieres where ecole_id = $1`, [
      session.ecoleId,
    ]),
  ]);
  const elevesValides = new Set(eleves.map((eleve) => eleve.id));
  const matieresValides = new Set(matieres.map((matiere) => matiere.id));

  const aEnregistrer: { eleveId: string; matiereId: string; note: number }[] = [];
  const aSupprimer: { eleveId: string; matiereId: string }[] = [];

  for (const [cle, valeur] of entrees) {
    const [eleveId, matiereId] = cle.split(":");
    if (
      !estUuid(eleveId ?? "") ||
      !estUuid(matiereId ?? "") ||
      !elevesValides.has(eleveId) ||
      !matieresValides.has(matiereId)
    ) {
      continue;
    }

    const texteValeur = typeof valeur === "string" ? valeur.trim() : String(valeur ?? "");
    if (texteValeur === "") {
      aSupprimer.push({ eleveId, matiereId });
      continue;
    }

    const note = Number.parseFloat(texteValeur.replace(",", "."));
    if (!Number.isFinite(note) || note < 0 || note > 20) {
      return {
        error:
          "Chaque note doit être un nombre entre 0 et 20. Corrigez la cellule signalée puis réessayez.",
      };
    }
    aEnregistrer.push({
      eleveId,
      matiereId,
      note: Math.round(note * 100) / 100,
    });
  }

  try {
    await transaction(async (client) => {
      for (const ligne of aSupprimer) {
        await client.query(
          `delete from notes
            where ecole_id = $1 and eleve_id = $2 and matiere_id = $3
              and annee_scolaire = $4 and trimestre = $5`,
          [
            session.ecoleId,
            ligne.eleveId,
            ligne.matiereId,
            annee,
            trimestre,
          ],
        );
      }

      for (const ligne of aEnregistrer) {
        await client.query(
          `insert into notes
             (ecole_id, eleve_id, matiere_id, annee_scolaire, trimestre, note)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (eleve_id, matiere_id, annee_scolaire, trimestre)
           do update set note = excluded.note, updated_at = now()`,
          [
            session.ecoleId,
            ligne.eleveId,
            ligne.matiereId,
            annee,
            trimestre,
            ligne.note,
          ],
        );
      }

      // Une saisie directe du directeur est publiée immédiatement : on marque
      // la combinaison Classe + Matière comme VALIDE pour que le portail
      // parent la voie. Si un professeur avait un brouillon sur la même
      // combinaison, la décision du directeur prime.
      const matieresTouchees = Array.from(
        new Set(aEnregistrer.map((ligne) => ligne.matiereId)),
      );
      for (const matiereId of matieresTouchees) {
        await client.query(
          `insert into saisies_notes
             (ecole_id, annee_scolaire, trimestre, classe_id, matiere_id,
              prof_id, statut, valide_le, valide_par)
           values ($1, $2, $3, $4, $5, null, 'VALIDE', now(), $6)
           on conflict (ecole_id, annee_scolaire, trimestre, classe_id, matiere_id)
             where statut in ('EN_COURS', 'ENVOYE', 'VALIDE')
           do update set statut = 'VALIDE',
                         valide_le = now(),
                         valide_par = $6,
                         updated_at = now()`,
          [
            session.ecoleId,
            annee,
            trimestre,
            classeId,
            matiereId,
            session.userId,
          ],
        );
      }

      // Matières dont toutes les notes ont été effacées : on libère la
      // combinaison pour qu'un professeur puisse la reprendre.
      const matieresVidees = Array.from(
        new Set(aSupprimer.map((ligne) => ligne.matiereId)),
      ).filter((matiereId) => !matieresTouchees.includes(matiereId));

      for (const matiereId of matieresVidees) {
        await client.query(
          `update saisies_notes s
              set statut = 'LIBERE', libere_le = now(), libere_par = $6,
                  motif_liberation = 'Notes effacées par le directeur'
            where s.ecole_id = $1
              and s.annee_scolaire = $2
              and s.trimestre = $3
              and s.classe_id = $4
              and s.matiere_id = $5
              and s.statut in ('EN_COURS', 'ENVOYE', 'VALIDE')
              and not exists (
                select 1
                  from notes n
                  join eleves e on e.id = n.eleve_id
                 where n.ecole_id = s.ecole_id
                   and n.annee_scolaire = s.annee_scolaire
                   and n.trimestre = s.trimestre
                   and n.matiere_id = s.matiere_id
                   and e.classe_id = s.classe_id
              )`,
          [
            session.ecoleId,
            annee,
            trimestre,
            classeId,
            matiereId,
            session.userId,
          ],
        );
      }
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  rafraichirNotes();
  return {
    success: `${aEnregistrer.length} note${aEnregistrer.length > 1 ? "s" : ""} enregistrée${aEnregistrer.length > 1 ? "s" : ""} pour ${classe.nom} · trimestre ${trimestre}.`,
  };
}
