import type { MotifLectureSeule, Offre, PlanAbo, StatutEcole } from "./types";

/**
 * Socle unique du système d'offres : prix, limites et fonctionnalités.
 *
 * Facturation mensuelle (table `subscriptions`) :
 *   • STARTER 15.000F / mois : élèves, classes, fiches professeurs, notes,
 *     bulletins et rapports trimestriels/annuels.
 *   • STANDARD 25.000F / mois : tout STARTER + paiements des parents, reçus,
 *     impayés, relances et présences/absences.
 *   • PREMIUM 35.000F / mois : tout STANDARD + rapports graphiques, export
 *     Excel, SMS illimités, portail parent, comptes profs et support prioritaire.
 *
 * Option annuelle : 9 mois payés d'un coup = 12 mois d'accès (année scolaire).
 *
 * Toute la plateforme (navigation, pages, actions, super admin, page
 * d'abonnement) lit ces définitions. Modifier une fonctionnalité ici la
 * répercute partout, y compris côté serveur.
 */

export type CleFonctionnalite =
  // Socle commun — disponible dès STARTER
  | "eleves"
  | "inscriptions"
  | "fiches_profs"
  | "notes_bulletins"
  /** Rapports trimestriels et annuels : présents dans TOUS les plans. */
  | "rapports"
  // STANDARD — gestion de la caisse et des parents
  | "tranches"
  | "paiements"
  | "recu_whatsapp"
  | "impayes"
  | "relances"
  | "absences"
  | "exports"
  | "historique"
  | "dashboard_totaux"
  | "equipe"
  // PREMIUM uniquement
  | "comptes_profs"
  | "saisie_notes_prof"
  | "validation_notes"
  | "portail_parent"
  | "qr_portail"
  | "envoi_bulletins_whatsapp"
  | "profs_salaires"
  | "multi_ecoles"
  | "stats_avancees"
  | "rapports_graphiques"
  | "export_excel"
  | "sms_illimites"
  | "sauvegarde_auto"
  | "support_prioritaire";

export type OffreInfo = {
  code: Offre;
  nom: string;
  prix: number;
  /** Prix de l'année scolaire : 9 mois payés, 12 mois d'accès. */
  prixAnnuel: number;
  /** null = illimité. */
  limiteEleves: number | null;
  limiteUtilisateurs: number | null;
  limiteClasses: number | null;
  resume: string;
  fonctionnalites: string[];
  cles: CleFonctionnalite[];
};

const SOCLE_STARTER: CleFonctionnalite[] = [
  "eleves",
  "inscriptions",
  "fiches_profs",
  "notes_bulletins",
  "rapports",
];

const CLES_STANDARD: CleFonctionnalite[] = [
  ...SOCLE_STARTER,
  "tranches",
  "paiements",
  "recu_whatsapp",
  "impayes",
  "relances",
  "absences",
  "exports",
  "historique",
  "dashboard_totaux",
  "equipe",
];

/** Fonctions strictement PREMIUM. Aucune ne doit apparaître dans STANDARD. */
export const CLES_PREMIUM_UNIQUEMENT: CleFonctionnalite[] = [
  "comptes_profs",
  "saisie_notes_prof",
  "validation_notes",
  "portail_parent",
  "qr_portail",
  "envoi_bulletins_whatsapp",
  "profs_salaires",
  "multi_ecoles",
  "stats_avancees",
  "rapports_graphiques",
  "export_excel",
  "sms_illimites",
  "sauvegarde_auto",
  "support_prioritaire",
];

const CLES_PREMIUM: CleFonctionnalite[] = [
  ...CLES_STANDARD,
  ...CLES_PREMIUM_UNIQUEMENT,
];

export const OFFRES: Record<Offre, OffreInfo> = {
  STARTER: {
    code: "STARTER",
    nom: "STARTER",
    prix: 15_000,
    prixAnnuel: 135_000,
    limiteEleves: 150,
    limiteUtilisateurs: 1,
    limiteClasses: 30,
    resume: "L'essentiel : élèves, classes, professeurs, notes et bulletins.",
    fonctionnalites: [
      "1 utilisateur : le directeur",
      "150 élèves maximum",
      "Gestion des élèves, des classes et des professeurs",
      "Notes et bulletins numériques",
      "Rapport trimestriel et rapport annuel",
    ],
    cles: SOCLE_STARTER,
  },
  STANDARD: {
    code: "STANDARD",
    nom: "STANDARD",
    prix: 25_000,
    prixAnnuel: 225_000,
    limiteEleves: 500,
    limiteUtilisateurs: 3,
    limiteClasses: 80,
    resume: "Tout STARTER + la caisse des parents et le suivi des absences.",
    fonctionnalites: [
      "Tout STARTER",
      "500 élèves maximum",
      "3 utilisateurs : directeur, comptable, secrétaire",
      "Gestion des paiements des parents",
      "Reçus WhatsApp et relance des impayés",
      "Présences / absences avec SMS aux parents",
      "Rapport trimestriel et rapport annuel",
    ],
    cles: CLES_STANDARD,
  },
  PREMIUM: {
    code: "PREMIUM",
    nom: "PREMIUM",
    prix: 35_000,
    prixAnnuel: 315_000,
    limiteEleves: null,
    limiteUtilisateurs: null,
    limiteClasses: null,
    resume: "Tout STANDARD + graphiques, export Excel, SMS illimités et portail parent.",
    fonctionnalites: [
      "Tout STANDARD",
      "Élèves, classes et utilisateurs illimités",
      "Rapports avec graphiques + export Excel",
      "SMS illimités aux parents",
      "Portail parent et bulletins PDF sur WhatsApp",
      "Comptes professeurs et validation des notes",
      "Support prioritaire",
    ],
    cles: CLES_PREMIUM,
  },
};

/** Pendant l'essai, l'école teste l'intégralité de l'offre PREMIUM. */
export const OFFRE_ESSAI: Offre = "PREMIUM";

/** Prix et libellés utilisés dans les fenêtres de passage à PREMIUM. */
export const PRIX_PREMIUM_TEXTE = "35.000F";

/** Message exact affiché sur les pages réservées et les écrans verrouillés. */
export const MESSAGE_PREMIUM =
  "Cette fonctionnalité est réservée à l'offre PREMIUM 35.000F / mois.";

/** Texte exact de la fenêtre d'upgrade dans l'interface directeur. */
export const MESSAGE_UPGRADE_PREMIUM =
  "Passez à PREMIUM 35.000F / mois pour débloquer les rapports graphiques, l'export Excel, les SMS illimités et le portail parent. Payez par Mobile Money au +228 70309744 ou contactez follyfoliemmanuel@gmail.com.";

/** Nombre de mois payés pour l'option annuelle (année scolaire complète). */
export const MOIS_PAYES_ANNEE = 9;
/** Nombre de mois d'accès accordés pour l'option annuelle. */
export const MOIS_ACCES_ANNEE = 12;

export function estOffre(valeur: unknown): valeur is Offre {
  return valeur === "STARTER" || valeur === "STANDARD" || valeur === "PREMIUM";
}

/** Plan de `subscriptions` (minuscules) correspondant à une offre. */
export function planDepuisOffre(offre: Offre): PlanAbo {
  switch (offre) {
    case "STARTER":
      return "starter";
    case "STANDARD":
      return "standard";
    default:
      return "premium";
  }
}

/** Offre affichée à partir du plan stocké dans `subscriptions`. */
export function offreDepuisPlan(plan: string | null | undefined): Offre {
  switch ((plan ?? "").toLowerCase()) {
    case "starter":
      return "STARTER";
    case "standard":
      return "STANDARD";
    case "premium":
      return "PREMIUM";
    default:
      return "PREMIUM";
  }
}

/** Offre réellement appliquée : un essai actif ouvre toutes les fonctions. */
export function offreEffective(ecole: {
  offre: Offre;
  statut: StatutEcole;
}): Offre {
  return ecole.statut === "ESSAI" ? OFFRE_ESSAI : ecole.offre;
}

export function limitesOffre(offre: Offre): {
  eleves: number | null;
  utilisateurs: number | null;
  classes: number | null;
  prix: number;
  prixAnnuel: number;
} {
  const info = OFFRES[offre];
  return {
    eleves: info.limiteEleves,
    utilisateurs: info.limiteUtilisateurs,
    classes: info.limiteClasses,
    prix: info.prix,
    prixAnnuel: info.prixAnnuel,
  };
}

export function aFonctionnalite(offre: Offre, cle: CleFonctionnalite): boolean {
  return OFFRES[offre].cles.includes(cle);
}

/** Raccourci pour les composants serveur qui disposent de la session. */
export function peut(
  ecole: {
    offre: Offre;
    statut: StatutEcole;
    lectureSeule?: boolean;
  },
  cle: CleFonctionnalite,
): boolean {
  return aFonctionnalite(offreEffective(ecole), cle);
}

/** Offre minimale qui débloque une fonctionnalité. */
export function offreRequise(cle: CleFonctionnalite): Offre {
  if (CLES_PREMIUM_UNIQUEMENT.includes(cle)) return "PREMIUM";
  if (CLES_STANDARD.includes(cle)) return "STANDARD";
  return "STARTER";
}

/** Vrai si la fonctionnalité est verrouillée en STARTER et STANDARD. */
export function estFonctionnalitePremium(cle: CleFonctionnalite): boolean {
  return offreRequise(cle) === "PREMIUM";
}

/** Anciennes formules -> nouvelles offres (migration des bases existantes). */
export function offreDepuisAncienPlan(plan: string): Offre {
  switch (plan) {
    case "petite":
      return "STARTER";
    case "moyenne":
      return "STANDARD";
    case "grosse":
      return "PREMIUM";
    default:
      // « essai » et les valeurs inconnues démarrent avec tout PREMIUM.
      return "PREMIUM";
  }
}

/** Phrase de paiement affichée sur la page d'abonnement et dans les paramètres. */
export function messagePaiement(offre?: Offre): string {
  const choix = offre
    ? ` en précisant l'offre choisie (${offre})`
    : " en précisant l'offre choisie";
  return `Payez par Mobile Money au +228 70309744 et envoyez la capture sur WhatsApp au même numéro ou par email à follyfoliemmanuel@gmail.com${choix}.`;
}

export function formatPrixOffre(offre: Offre): string {
  return `${OFFRES[offre].prix.toLocaleString("fr-FR").replace(/\u202f/g, " ")} F`;
}

export function formatPrixAnnuel(offre: Offre): string {
  return `${OFFRES[offre].prixAnnuel.toLocaleString("fr-FR").replace(/\u202f/g, " ")} F`;
}

export function limiteTexte(
  valeur: number | null,
  singulier: string,
  pluriel: string,
): string {
  return valeur === null ? "Illimité" : `${valeur} ${valeur > 1 ? pluriel : singulier}`;
}

/**
 * Vrai si l'école peut encore consulter mais plus modifier.
 * Utilisé pour adapter l'interface et refuser les écritures côté serveur.
 */
export function enLectureSeule(ecole: {
  lectureSeule?: boolean;
  motifLectureSeule?: MotifLectureSeule | null;
}): boolean {
  return ecole.lectureSeule === true;
}

/** Rappel affiché dans le bandeau de lecture seule. */
export const MESSAGE_LECTURE_SEULE =
  "Le paiement de votre abonnement SCHOOL PAY n'a pas été reçu. Le compte est en lecture seule : vous pouvez consulter vos données, mais plus les modifier. Dès réception du paiement, l'accès complet est rétabli.";
