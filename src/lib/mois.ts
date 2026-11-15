/** Année scolaire Septembre → Juin, découpée en 10 mois. */

export type MoisScolaire = {
  /** 1 = Septembre … 10 = Juin */
  numero: number;
  court: string;
  long: string;
};

export const MOIS_SCOLAIRES: MoisScolaire[] = [
  { numero: 1, court: "Sept", long: "Septembre" },
  { numero: 2, court: "Oct", long: "Octobre" },
  { numero: 3, court: "Nov", long: "Novembre" },
  { numero: 4, court: "Déc", long: "Décembre" },
  { numero: 5, court: "Janv", long: "Janvier" },
  { numero: 6, court: "Févr", long: "Février" },
  { numero: 7, court: "Mars", long: "Mars" },
  { numero: 8, court: "Avr", long: "Avril" },
  { numero: 9, court: "Mai", long: "Mai" },
  { numero: 10, court: "Juin", long: "Juin" },
];

/** "2026-2027" pour un mois de septembre à décembre 2026, ou de janvier à juin 2027. */
export function anneeScolaire(date: Date = new Date()): string {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

/**
 * Mois scolaire courant (1..10).
 * Juillet et août sont hors année scolaire : on retombe sur Septembre.
 */
export function moisScolaireCourant(date: Date = new Date()): number {
  const mois = date.getMonth() + 1;
  if (mois >= 9) return mois - 8;
  if (mois <= 6) return mois + 4;
  return 1;
}

/** Lit un paramètre d'URL ("3") et renvoie un mois valide. */
export function moisDepuisParametre(
  valeur: string | undefined,
  defaut: number = moisScolaireCourant(),
): number {
  const n = Number.parseInt(valeur ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : defaut;
}

export function libelleMois(numero: number, court = false): string {
  const mois = MOIS_SCOLAIRES.find((m) => m.numero === numero);
  if (!mois) return "";
  return court ? mois.court : mois.long;
}

/** "2026-2027" → "2026 – 2027" */
export function libelleAnnee(annee: string): string {
  return annee.replace("-", " – ");
}

/** Années scolaires proposées (année courante + précédente). */
export function anneesDisponibles(date: Date = new Date()): string[] {
  const courante = anneeScolaire(date);
  const debut = Number.parseInt(courante.slice(0, 4), 10);
  return [courante, `${debut - 1}-${debut}`];
}
