import type { Offre, StatutEcole } from "./types";

/**
 * Socle unique du système d'offres : prix, limites et fonctionnalités.
 *
 * Règle commerciale stricte :
 *   • STARTER 15.000F : le directeur seul. Élèves, classes, paiements et notes
 *     saisies manuellement. Aucun compte prof, aucun portail parent, aucun
 *     envoi WhatsApp de bulletin.
 *   • PRO 25.000F : les mêmes fonctions avec des limites plus grandes. Toujours
 *     aucun compte prof, aucun portail parent, aucun envoi WhatsApp de bulletin.
 *   • PREMIUM 40.000F : la seule offre qui débloque les comptes profs, la
 *     saisie/validation des notes, le portail parent et l'envoi des bulletins
 *     PDF sur WhatsApp.
 *
 * Toute la plateforme (navigation, pages, actions, super admin, page de
 * blocage) lit ces définitions. Modifier une fonctionnalité ici la répercute
 * partout, y compris côté serveur.
 */

export type CleFonctionnalite =
  // Socle commun — disponible dès STARTER
  | "eleves"
  | "inscriptions"
  | "tranches"
  | "paiements"
  | "recu_whatsapp"
  | "impayes"
  /** Notes manuelles du directeur + bulletins PDF. Toutes les offres. */
  | "notes_bulletins"
  // PRO — confort et contrôle, sans les fonctions PREMIUM
  | "relances"
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
  | "sauvegarde_auto"
  | "support_prioritaire";

export type OffreInfo = {
  code: Offre;
  nom: string;
  prix: number;
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
  "tranches",
  "paiements",
  "recu_whatsapp",
  "impayes",
  "notes_bulletins",
];

const CLES_PRO: CleFonctionnalite[] = [
  ...SOCLE_STARTER,
  "relances",
  "exports",
  "historique",
  "dashboard_totaux",
  "equipe",
];

/** Fonctions strictement PREMIUM. Aucune ne doit apparaître dans PRO. */
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
  "sauvegarde_auto",
  "support_prioritaire",
];

const CLES_PREMIUM: CleFonctionnalite[] = [
  ...CLES_PRO,
  ...CLES_PREMIUM_UNIQUEMENT,
];

export const OFFRES: Record<Offre, OffreInfo> = {
  STARTER: {
    code: "STARTER",
    nom: "STARTER",
    prix: 15_000,
    limiteEleves: 150,
    limiteUtilisateurs: 1,
    limiteClasses: 30,
    resume: "Le directeur seul tient la caisse, les élèves et les notes.",
    fonctionnalites: [
      "1 utilisateur : le directeur",
      "150 élèves maximum",
      "Gestion des élèves, classes et inscriptions",
      "Tranches libres : montants et dates personnalisables",
      "Enregistrement des paiements, y compris partiels",
      "Reçu WhatsApp structuré au nom de l'école",
      "Liste des impayés par tranche",
      "Notes saisies manuellement par le directeur",
      "Bulletins PDF avec moyennes et rangs",
    ],
    cles: SOCLE_STARTER,
  },
  PRO: {
    code: "PRO",
    nom: "PRO",
    prix: 25_000,
    limiteEleves: 500,
    limiteUtilisateurs: 3,
    limiteClasses: 80,
    resume: "Une version plus grande de STARTER, sans les fonctions PREMIUM.",
    fonctionnalites: [
      "Tout STARTER",
      "500 élèves maximum",
      "3 utilisateurs : directeur, comptable, secrétaire",
      "Relance WhatsApp des parents impayés",
      "Export Excel et PDF des paiements",
      "Historique complet des paiements par élève",
      "Tableau de bord : total encaissé et total restant",
      "Notes saisies manuellement par le directeur",
      "Pas de compte professeur",
      "Pas de portail parent",
      "Pas d'envoi WhatsApp des bulletins",
    ],
    cles: CLES_PRO,
  },
  PREMIUM: {
    code: "PREMIUM",
    nom: "PREMIUM",
    prix: 40_000,
    limiteEleves: null,
    limiteUtilisateurs: null,
    limiteClasses: null,
    resume: "La seule offre qui débloque les profs, le portail parent et WhatsApp.",
    fonctionnalites: [
      "Tout PRO",
      "Élèves, classes et utilisateurs illimités",
      "Création de comptes professeurs",
      "Connexion prof avec choix libre classe + matière",
      "Verrouillage de la combinaison classe + matière",
      "Tableau de saisie des notes par le professeur",
      "Envoi des notes au directeur, validation et publication",
      "Portail parent : /parent/nom-de-lecole",
      "Recherche parent par classe + nom de l'enfant",
      "Notes, moyenne, rang et bulletin PDF pour le parent",
      "Masquage d'un élève du portail parent",
      "Envoi automatique du bulletin PDF sur WhatsApp",
      "Copie du lien parent + QR code à imprimer",
    ],
    cles: CLES_PREMIUM,
  },
};

/** Pendant l'essai, l'école teste l'intégralité de l'offre PREMIUM. */
export const OFFRE_ESSAI: Offre = "PREMIUM";

/** Prix et libellés utilisés dans les fenêtres de passage à PREMIUM. */
export const PRIX_PREMIUM_TEXTE = "40.000F";

/** Message exact affiché sur la page de paiement et les écrans bloqués. */
export const MESSAGE_PREMIUM =
  "Cette fonctionnalité est réservée à l'offre PREMIUM 40.000F.";

/** Texte exact de la fenêtre d'upgrade dans l'interface directeur. */
export const MESSAGE_UPGRADE_PREMIUM =
  "Passez à PREMIUM 40.000F pour débloquer les comptes profs, le portail parent et l'envoi WhatsApp. Payez par Mobile Money au +228 70309744 ou contactez follyfoliemmanuel@gmail.com.";

export function estOffre(valeur: unknown): valeur is Offre {
  return valeur === "STARTER" || valeur === "PRO" || valeur === "PREMIUM";
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
} {
  const info = OFFRES[offre];
  return {
    eleves: info.limiteEleves,
    utilisateurs: info.limiteUtilisateurs,
    classes: info.limiteClasses,
    prix: info.prix,
  };
}

export function aFonctionnalite(offre: Offre, cle: CleFonctionnalite): boolean {
  return OFFRES[offre].cles.includes(cle);
}

/** Raccourci pour les composants serveur qui disposent de la session. */
export function peut(
  ecole: { offre: Offre; statut: StatutEcole },
  cle: CleFonctionnalite,
): boolean {
  return aFonctionnalite(offreEffective(ecole), cle);
}

/** Offre minimale qui débloque une fonctionnalité. */
export function offreRequise(cle: CleFonctionnalite): Offre {
  if (CLES_PREMIUM_UNIQUEMENT.includes(cle)) return "PREMIUM";
  if (CLES_PRO.includes(cle)) return "PRO";
  return "STARTER";
}

/** Vrai si la fonctionnalité est verrouillée en STARTER et PRO. */
export function estFonctionnalitePremium(cle: CleFonctionnalite): boolean {
  return offreRequise(cle) === "PREMIUM";
}

/** Anciennes formules -> nouvelles offres (migration des bases existantes). */
export function offreDepuisAncienPlan(plan: string): Offre {
  switch (plan) {
    case "petite":
      return "STARTER";
    case "moyenne":
      return "PRO";
    case "grosse":
      return "PREMIUM";
    default:
      // « essai » et les valeurs inconnues démarrent avec tout PREMIUM.
      return "PREMIUM";
  }
}

/** Phrase de paiement affichée sur la page de blocage et dans les paramètres. */
export function messagePaiement(offre?: Offre): string {
  const choix = offre
    ? ` en précisant l'offre choisie (${offre})`
    : " en précisant l'offre choisie";
  return `Payez par Mobile Money au +228 70309744 et envoyez la capture sur WhatsApp au même numéro ou par email à follyfoliemmanuel@gmail.com${choix}.`;
}

export function formatPrixOffre(offre: Offre): string {
  return `${OFFRES[offre].prix.toLocaleString("fr-FR").replace(/\u202f/g, " ")} F`;
}

export function limiteTexte(
  valeur: number | null,
  singulier: string,
  pluriel: string,
): string {
  return valeur === null ? "Illimité" : `${valeur} ${valeur > 1 ? pluriel : singulier}`;
}
