/** Mois calendaires utilisés par la paie (aucun accès base de données). */
export const MOIS_PAIE: { valeur: number; libelle: string; court: string }[] = [
  { valeur: 1, libelle: "Janvier", court: "Janv" },
  { valeur: 2, libelle: "Février", court: "Févr" },
  { valeur: 3, libelle: "Mars", court: "Mars" },
  { valeur: 4, libelle: "Avril", court: "Avr" },
  { valeur: 5, libelle: "Mai", court: "Mai" },
  { valeur: 6, libelle: "Juin", court: "Juin" },
  { valeur: 7, libelle: "Juillet", court: "Juil" },
  { valeur: 8, libelle: "Août", court: "Août" },
  { valeur: 9, libelle: "Septembre", court: "Sept" },
  { valeur: 10, libelle: "Octobre", court: "Oct" },
  { valeur: 11, libelle: "Novembre", court: "Nov" },
  { valeur: 12, libelle: "Décembre", court: "Déc" },
];

export function libelleMoisPaie(mois: number): string {
  return MOIS_PAIE.find((element) => element.valeur === mois)?.libelle ?? "";
}
