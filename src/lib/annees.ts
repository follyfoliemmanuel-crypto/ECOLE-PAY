/** Aides pures autour des libellés d'années scolaires « 2026-2027 ». */

import { anneeScolaire } from "./mois";

export function estAnneeScolaire(valeur: string): boolean {
  return /^\d{4}-\d{4}$/.test(valeur);
}

/** "2026-2027" -> "2027-2028". */
export function anneeSuivante(annee: string): string {
  const debut = Number.parseInt(annee.slice(0, 4), 10);
  if (!Number.isFinite(debut)) return anneeScolaire();
  return `${debut + 1}-${debut + 2}`;
}

/** "2026-2027" -> "2025-2026". */
export function anneePrecedente(annee: string): string {
  const debut = Number.parseInt(annee.slice(0, 4), 10);
  if (!Number.isFinite(debut)) return anneeScolaire();
  return `${debut - 1}-${debut}`;
}

/** Bornes administratives : 1er septembre -> 31 août. */
export function bornesAnnee(annee: string): { debut: string; fin: string } {
  const debut = Number.parseInt(annee.slice(0, 4), 10);
  if (!Number.isFinite(debut)) {
    const courante = anneeScolaire();
    return bornesAnnee(courante);
  }
  return {
    debut: `${debut}-09-01`,
    fin: `${debut + 1}-08-31`,
  };
}

/** Année d'une date (AAAA-MM-JJ ou Date) au format scolaire. */
export function anneeDeDate(date: string | Date): string {
  const valeur = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  if (Number.isNaN(valeur.getTime())) return anneeScolaire();
  return anneeScolaire(valeur);
}

/** Trimestre 1..3 d'une date (septembre-décembre, janvier-mars, avril-juin). */
export function trimestreDeDate(date: Date = new Date()): 1 | 2 | 3 {
  const mois = date.getMonth() + 1;
  if (mois >= 9 || mois === 12) return 1;
  if (mois >= 1 && mois <= 3) return 2;
  if (mois >= 4 && mois <= 6) return 3;
  // Juillet / août : vacances, on rattache à la fin du 3e trimestre.
  return 3;
}

/** Bornes de date d'un trimestre scolaire. */
export function bornesTrimestre(
  annee: string,
  trimestre: 1 | 2 | 3,
): { debut: string; fin: string } {
  const debut = Number.parseInt(annee.slice(0, 4), 10);
  if (trimestre === 1) {
    return { debut: `${debut}-09-01`, fin: `${debut}-12-31` };
  }
  if (trimestre === 2) {
    return { debut: `${debut + 1}-01-01`, fin: `${debut + 1}-03-31` };
  }
  return { debut: `${debut + 1}-04-01`, fin: `${debut + 1}-06-30` };
}

export function libelleTrimestreRapport(trimestre: number): string {
  return ["1er trimestre", "2e trimestre", "3e trimestre"][trimestre - 1] ??
    "";
}
