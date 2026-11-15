/**
 * Règles partagées de la saisie des notes par les professeurs.
 *
 * Ce module est volontairement pur : il ne touche ni à la base, ni aux
 * cookies, ni à `process.env`. Il peut donc être importé tel quel dans un
 * composant client (listes déroulantes, messages de verrouillage).
 */

import type { StatutSaisie, Trimestre } from "./types";

export const TRIMESTRES_SAISIE: { valeur: Trimestre; libelle: string }[] = [
  { valeur: 1, libelle: "1er trimestre" },
  { valeur: 2, libelle: "2e trimestre" },
  { valeur: 3, libelle: "3e trimestre" },
];

export function libelleTrimestreSaisie(trimestre: Trimestre): string {
  return (
    TRIMESTRES_SAISIE.find((element) => element.valeur === trimestre)?.libelle ??
    "1er trimestre"
  );
}

/** Trimestre probable selon le mois (Sept–Déc = T1, Jan–Mars = T2, Avr–Juin = T3). */
export function trimestreCourant(date: Date = new Date()): Trimestre {
  const mois = date.getMonth() + 1;
  if (mois >= 9 || mois === 1) return 1;
  if (mois >= 2 && mois <= 4) return 2;
  if (mois >= 5 && mois <= 8) return 3;
  return 1;
}

export function trimestreDepuisParametre(
  valeur: string | undefined,
  defaut: Trimestre = trimestreCourant(),
): Trimestre {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return nombre === 1 || nombre === 2 || nombre === 3 ? nombre : defaut;
}

/** "Koffi AMEGAN" sans espace superflu. */
export function nomCompletProf(
  prenom: string | null | undefined,
  nom: string | null | undefined,
): string {
  return `${prenom ?? ""} ${nom ?? ""}`.trim();
}

/** Formule d'adresse reprise dans les messages de verrouillage. */
export function nomAvecTitre(
  prenom: string | null | undefined,
  nom: string | null | undefined,
): string {
  const complet = nomCompletProf(prenom, nom);
  return complet ? `M. ${complet}` : "un autre professeur";
}

/** Message affiché quand une combinaison est déjà verrouillée. */
export function messageVerrou(
  prenom: string | null | undefined,
  nom: string | null | undefined,
  statut: StatutSaisie,
): string {
  const titulaire = nomAvecTitre(prenom, nom);
  if (statut === "VALIDE") {
    return `Ces notes ont déjà été validées et publiées (saisie de ${titulaire}).`;
  }
  return `Déjà en cours par ${titulaire}.`;
}

/** Moyenne d'une matière à partir des évaluations saisies, ou null. */
export function moyenneEvaluations(
  devoir1: number | null,
  devoir2: number | null,
  composition: number | null,
): number | null {
  const valeurs = [devoir1, devoir2, composition].filter(
    (valeur): valeur is number => valeur !== null && Number.isFinite(valeur),
  );
  if (valeurs.length === 0) return null;
  const somme = valeurs.reduce((total, valeur) => total + valeur, 0);
  return Math.round((somme / valeurs.length) * 100) / 100;
}

export function formatNoteSaisie(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toFixed(2).replace(".", ",");
}
