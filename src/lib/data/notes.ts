import { sql, uneLigne } from "../db";
import type {
  BulletinClasse,
  BulletinEleve,
  Matiere,
  NotesEleve,
  Trimestre,
} from "../types";

/** Matières de l'école, dans l'ordre choisi. */
export async function listerMatieres(ecoleId: string): Promise<Matiere[]> {
  return sql<Matiere>(
    `select id, nom, coefficient
       from matieres
      where ecole_id = $1
      order by ordre, nom`,
    [ecoleId],
  );
}

export type EleveNotes = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F" | null;
};

/**
 * Élèves d'une classe pour une année donnée.
 *
 * La source est `inscriptions` : un élève promu en 2027-2028 garde son
 * bulletin de 2026-2027 intact et reste rattaché à son ancienne classe pour
 * cette année. `inclureSortis` permet à l'archive d'afficher aussi les élèves
 * transférés ou diplômés.
 */
export async function listerElevesClasse(
  ecoleId: string,
  annee: string,
  classeId: string,
  inclureSortis = false,
): Promise<EleveNotes[]> {
  return sql<EleveNotes>(
    `select e.id, e.nom, e.prenom, e.sexe
       from inscriptions i
       join eleves e on e.id = i.eleve_id
      where i.ecole_id = $1
        and i.annee_scolaire = $2
        and i.classe_id = $3
        and ($4::boolean or i.statut = 'INSCRIT')
      order by e.nom, e.prenom`,
    [ecoleId, annee, classeId, inclureSortis],
  );
}

export type GrilleNotes = {
  eleves: EleveNotes[];
  matieres: Matiere[];
  /** notes[eleveId][matiereId] = note ou null. */
  notes: Record<string, NotesEleve>;
};

/** Grille de saisie : élèves × matières pour un trimestre. */
export async function grilleNotes(
  ecoleId: string,
  annee: string,
  classeId: string,
  trimestre: Trimestre,
): Promise<GrilleNotes> {
  const [eleves, matieres, lignes] = await Promise.all([
    listerElevesClasse(ecoleId, annee, classeId),
    listerMatieres(ecoleId),
    sql<{ eleve_id: string; matiere_id: string; note: number }>(
      `select n.eleve_id, n.matiere_id, n.note::float8 as note
         from notes n
         join inscriptions i
           on i.eleve_id = n.eleve_id
          and i.annee_scolaire = n.annee_scolaire
          and i.ecole_id = n.ecole_id
        where n.ecole_id = $1
          and n.annee_scolaire = $2
          and n.trimestre = $3
          and i.classe_id = $4`,
      [ecoleId, annee, trimestre, classeId],
    ),
  ]);

  const notes: Record<string, NotesEleve> = {};
  for (const eleve of eleves) {
    notes[eleve.id] = {};
    for (const matiere of matieres) notes[eleve.id][matiere.id] = null;
  }
  for (const ligne of lignes) {
    if (!notes[ligne.eleve_id]) notes[ligne.eleve_id] = {};
    notes[ligne.eleve_id][ligne.matiere_id] = ligne.note;
  }

  return { eleves, matieres, notes };
}

/** Trimestres pour lesquels l'élève a au moins une note (archive incluse). */
export async function trimestresNotesEleve(
  ecoleId: string,
  annee: string,
  eleveId: string,
): Promise<Trimestre[]> {
  const lignes = await sql<{ trimestre: Trimestre }>(
    `select distinct trimestre
       from notes
      where ecole_id = $1 and annee_scolaire = $2 and eleve_id = $3
      order by trimestre`,
    [ecoleId, annee, eleveId],
  );
  return lignes.map((ligne) => ligne.trimestre);
}

export type ResumeNotesClasse = {
  classe_id: string;
  notes_saisies: number;
  eleves_notes: number;
};

/** Nombre de notes déjà saisies par classe, pour l'écran d'accueil du module. */
export async function resumeNotes(
  ecoleId: string,
  annee: string,
  trimestre: Trimestre,
): Promise<ResumeNotesClasse[]> {
  return sql<ResumeNotesClasse>(
    `select i.classe_id,
            count(n.id)::int as notes_saisies,
            count(distinct n.eleve_id)::int as eleves_notes
       from inscriptions i
       left join notes n
         on n.eleve_id = i.eleve_id
        and n.ecole_id = i.ecole_id
        and n.annee_scolaire = i.annee_scolaire
        and n.trimestre = $3
      where i.ecole_id = $1
        and i.annee_scolaire = $2
        and i.statut = 'INSCRIT'
      group by i.classe_id`,
    [ecoleId, annee, trimestre],
  );
}

/** Mention affichée sur un bulletin, sur 20. */
export function mentionPour(moyenne: number | null): string {
  if (moyenne === null) return "Non évalué";
  if (moyenne >= 16) return "Excellent";
  if (moyenne >= 14) return "Très bien";
  if (moyenne >= 12) return "Bien";
  if (moyenne >= 10) return "Assez bien";
  if (moyenne >= 8) return "Passable";
  return "Insuffisant";
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/**
 * Toutes les données d'un bulletin de classe : matières, notes, moyennes
 * pondérées, rangs et statistiques. Les matières sans note sont ignorées dans
 * la moyenne mais restent affichées avec un tiret.
 */
export async function donneesBulletin(
  ecoleId: string,
  annee: string,
  classeId: string,
  trimestre: Trimestre,
  inclureSortis = false,
): Promise<BulletinClasse | null> {
  const entete = await uneLigne<{
    id: string;
    nom: string;
    ecole_nom: string;
    adresse: string | null;
    telephone: string | null;
    logo_url: string | null;
  }>(
    `select c.id, c.nom, ec.nom as ecole_nom, ec.adresse, ec.telephone, ec.logo_url
       from classes c
       join ecoles ec on ec.id = c.ecole_id
      where c.id = $1 and c.ecole_id = $2`,
    [classeId, ecoleId],
  );
  if (!entete) return null;

  const [matieres, eleves, lignes] = await Promise.all([
    listerMatieres(ecoleId),
    listerElevesClasse(ecoleId, annee, classeId, inclureSortis),
    sql<{
      eleve_id: string;
      matiere_id: string;
      note: number;
      devoir1: number | null;
      devoir2: number | null;
      composition: number | null;
      appreciation: string | null;
    }>(
      // Seules les notes dont la saisie a été validée par le directeur sont
      // publiées. Un brouillon de professeur reste invisible aux parents.
      `select n.eleve_id, n.matiere_id, n.note::float8 as note,
              n.devoir1::float8 as devoir1,
              n.devoir2::float8 as devoir2,
              n.composition::float8 as composition,
              n.appreciation
         from notes n
         join inscriptions i
           on i.eleve_id = n.eleve_id
          and i.annee_scolaire = n.annee_scolaire
          and i.ecole_id = n.ecole_id
         join saisies_notes s
           on s.ecole_id = n.ecole_id
          and s.annee_scolaire = n.annee_scolaire
          and s.trimestre = n.trimestre
          and s.matiere_id = n.matiere_id
          and s.classe_id = i.classe_id
          and s.statut = 'VALIDE'
        where n.ecole_id = $1
          and n.annee_scolaire = $2
          and n.trimestre = $3
          and i.classe_id = $4`,
      [ecoleId, annee, trimestre, classeId],
    ),
  ]);

  const parEleve = new Map<
    string,
    Map<
      string,
      {
        note: number;
        devoir1: number | null;
        devoir2: number | null;
        composition: number | null;
        appreciation: string | null;
      }
    >
  >();
  for (const ligne of lignes) {
    const notesEleve = parEleve.get(ligne.eleve_id) ?? new Map();
    notesEleve.set(ligne.matiere_id, {
      note: ligne.note,
      devoir1: ligne.devoir1,
      devoir2: ligne.devoir2,
      composition: ligne.composition,
      appreciation: ligne.appreciation,
    });
    parEleve.set(ligne.eleve_id, notesEleve);
  }

  const bulletins: BulletinEleve[] = eleves.map((eleve) => {
    const notesEleve = parEleve.get(eleve.id);
    let totalPoints = 0;
    let totalCoefficients = 0;

    const detail = matieres.map((matiere) => {
      const saisie = notesEleve?.get(matiere.id);
      const note = saisie?.note ?? null;
      const points = note === null ? null : arrondi(note * matiere.coefficient);
      if (note !== null) {
        totalPoints += note * matiere.coefficient;
        totalCoefficients += matiere.coefficient;
      }
      return {
        matiere_id: matiere.id,
        nom: matiere.nom,
        coefficient: matiere.coefficient,
        note,
        devoir1: saisie?.devoir1 ?? null,
        devoir2: saisie?.devoir2 ?? null,
        composition: saisie?.composition ?? null,
        points,
        appreciation:
          saisie?.appreciation ?? (note === null ? null : mentionPour(note)),
      };
    });

    const moyenne =
      totalCoefficients > 0 ? arrondi(totalPoints / totalCoefficients) : null;

    return {
      id: eleve.id,
      nom: eleve.nom,
      prenom: eleve.prenom,
      sexe: eleve.sexe,
      lignes: detail,
      total_coefficients: totalCoefficients,
      total_points: arrondi(totalPoints),
      moyenne,
      rang: null,
      mention: mentionPour(moyenne),
    };
  });

  // Classement : les élèves sans aucune note restent « non évalués ».
  const evalues = bulletins
    .filter((bulletin) => bulletin.moyenne !== null)
    .sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));

  let rangPrecedent = 0;
  let moyennePrecedente: number | null = null;
  evalues.forEach((bulletin, index) => {
    if (moyennePrecedente !== null && bulletin.moyenne === moyennePrecedente) {
      bulletin.rang = rangPrecedent;
    } else {
      bulletin.rang = index + 1;
      rangPrecedent = index + 1;
      moyennePrecedente = bulletin.moyenne;
    }
  });

  const moyennes = evalues.map((bulletin) => bulletin.moyenne as number);
  const moyenneClasse =
    moyennes.length > 0
      ? arrondi(moyennes.reduce((somme, valeur) => somme + valeur, 0) / moyennes.length)
      : null;

  return {
    classe: { id: entete.id, nom: entete.nom },
    ecole: {
      nom: entete.ecole_nom,
      adresse: entete.adresse,
      telephone: entete.telephone,
      logo_url: entete.logo_url,
    },
    annee,
    trimestre,
    matieres,
    eleves: bulletins.sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    moyenne_classe: moyenneClasse,
    meilleure_moyenne: moyennes.length > 0 ? Math.max(...moyennes) : null,
    plus_faible_moyenne: moyennes.length > 0 ? Math.min(...moyennes) : null,
  };
}
